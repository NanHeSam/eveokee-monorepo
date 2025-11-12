/**
 * Suno webhook handler
 * Processes music generation completion callbacks from Suno API
 */

import { httpAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { SunoWebhookPayload } from "../../models/webhooks/suno";
import {
  isValidSunoCallback,
  parseSunoPayload,
} from "../../models/webhooks/suno";
import {
  errorResponse,
  successResponse,
  validateHttpMethod,
  parseJsonBody,
  createWebhookLogger,
} from "../shared";
import {
  HTTP_STATUS_OK,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  MUSIC_GENERATION_CALLBACK_PATH,
} from "../../utils/constants";
import { logWebhookEvent } from "../../utils/logger";
import { createSunoClientFromEnv } from "../../integrations/suno/client";

/**
 * Handle Suno music generation callback webhook
 * 
 * Steps:
 * 1. Validate HTTP method (POST only)
 * 2. Parse and validate JSON payload
 * 3. Extract taskId and tracks from callback data
 * 4. Verify callback type is "complete"
 * 5. Process completed music generation via internal mutation
 */
export const sunoMusicGenerationCallback = httpAction(async (ctx, req) => {
  // Initialize structured logger
  const logger = createWebhookLogger("sunoMusicGenerationCallback");
  logger.startTimer();
  logWebhookEvent(logger, "suno-callback", "received");

  // Step 1: Validate HTTP method
  const methodError = validateHttpMethod(req);
  if (methodError) {
    logger.warn("Invalid HTTP method", { method: req.method });
    return methodError;
  }

  // Step 2: Parse JSON payload
  const parseResult = await parseJsonBody<SunoWebhookPayload>(req);
  if (parseResult.error) {
    logger.error("Failed to parse JSON payload");
    return parseResult.error;
  }

  // Step 3: Validate payload structure using type guard
  if (!isValidSunoCallback(parseResult.data)) {
    logger.warn("Invalid payload structure", { payload: parseResult.data });
    return errorResponse("Invalid payload", HTTP_STATUS_BAD_REQUEST);
  }
  const body = parseResult.data;

  // Step 4: Parse and validate payload
  const parsedPayload = parseSunoPayload(body);
  if (parsedPayload.success === false) {
    logger.warn("Payload validation failed", { error: parsedPayload.error });
    return errorResponse(parsedPayload.error, HTTP_STATUS_BAD_REQUEST);
  }

  const { taskId, tracks: tracksRaw, callbackType, code } = parsedPayload.data;

  // Add taskId to logger context
  const eventLogger = logger.child({ taskId, callbackType, code });

  // Step 6: Verify callback type
  if (callbackType !== "complete") {
    eventLogger.info("Ignoring non-complete callback");
    return successResponse({ status: "ignored" });
  }

  if (code !== HTTP_STATUS_OK) {
    eventLogger.warn("Received non-success callback");
  }

  // Step 7: Process completed music generation
  try {
    await ctx.runMutation(internal.music.completeSunoTask, {
      taskId,
      tracks: tracksRaw,
    });
    
    // Step 8: Fetch timed lyrics for each track
    try {
      const musicRecords = await ctx.runQuery(internal.music.getAllMusicByTaskId, {
        taskId,
      });

      // Create Suno client for fetching timed lyrics
      const convexSiteUrl = process.env.CONVEX_SITE_URL;
      if (!convexSiteUrl) {
        eventLogger.warn("CONVEX_SITE_URL not available, skipping timed lyrics fetch");
      } else {
        const sunoClient = createSunoClientFromEnv({
          SUNO_API_KEY: process.env.SUNO_API_KEY,
          CONVEX_SITE_URL: convexSiteUrl,
          CALLBACK_PATH: MUSIC_GENERATION_CALLBACK_PATH,
          SUNO_TIMEOUT: process.env.SUNO_TIMEOUT,
        });

        // Fetch timed lyrics for each track
        await Promise.all(
          tracksRaw.map(async (track, index) => {
            const audioId = track.id;
            if (!audioId) {
              eventLogger.warn("Track missing audioId, skipping timed lyrics fetch", {
                trackIndex: index,
              });
              return;
            }

            // Find matching music record by audioId
            const musicRecord = musicRecords.find((m) => m.audioId === audioId);
            if (!musicRecord) {
              eventLogger.warn("No music record found for audioId", {
                audioId,
                trackIndex: index,
              });
              return;
            }

            try {
              const timedLyrics = await sunoClient.getTimestampedLyrics({
                taskId,
                audioId,
              });

              // Update music record with timed lyrics
              await ctx.runMutation(internal.music.updateLyricWithTime, {
                musicId: musicRecord._id,
                lyricWithTime: timedLyrics,
              });

              eventLogger.debug("Successfully fetched and stored timed lyrics", {
                audioId,
                musicId: musicRecord._id,
              });
            } catch (lyricsError) {
              // Log but don't fail the webhook if timed lyrics fetch fails
              eventLogger.warn("Failed to fetch timed lyrics", {
                audioId,
                musicId: musicRecord._id,
                error: lyricsError instanceof Error ? lyricsError.message : "Unknown error",
              });
            }
          }),
        );
      }
    } catch (lyricsError) {
      // Log but don't fail the webhook if timed lyrics processing fails
      eventLogger.warn("Failed to process timed lyrics", {
        error: lyricsError instanceof Error ? lyricsError.message : "Unknown error",
      });
    }
    
    // Get the music record to send push notification
    const musicRecord = await ctx.runQuery(internal.music.getMusicByTaskId, {
      taskId,
    });
    
    // Send push notification if music was successfully completed
    if (musicRecord && musicRecord.status === "ready") {
      try {
        const musicTitle = musicRecord.title || "Your music";
        await ctx.runAction(internal.pushNotifications.sendPushNotification, {
          userId: musicRecord.userId,
          title: "Your music is ready!",
          body: `"${musicTitle}" has finished generating`,
          data: {
            type: "music_ready",
            musicId: musicRecord._id,
            diaryId: musicRecord.diaryId,
          },
        });
      } catch (notificationError) {
        // Log but don't fail the webhook if notification fails
        eventLogger.warn("Failed to send push notification", {
          error: notificationError instanceof Error ? notificationError.message : "Unknown error",
        });
      }
    }
    
    logWebhookEvent(eventLogger, "suno-callback", "processed", {
      trackCount: tracksRaw.length,
    });
    return successResponse({ status: "ok" });
  } catch (error) {
    eventLogger.error("Failed to process callback", error);
    logWebhookEvent(eventLogger, "suno-callback", "failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return errorResponse("Failed to process callback", HTTP_STATUS_INTERNAL_SERVER_ERROR);
  }
});

