/**
 * Suno webhook handler
 * Processes Kie Suno callbacks and in-flight legacy sunoapi callbacks
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
  verifyWebhookToken,
} from "../shared";
import {
  HTTP_STATUS_OK,
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  MUSIC_GENERATION_CALLBACK_PATH,
} from "../../utils/constants";
import { logWebhookEvent } from "../../utils/logger";
import { createKieMusicClientFromEnv } from "../../integrations/kie/musicClient";

/**
 * Handle Suno music generation callback webhook
 * 
 * Steps:
 * 1. Validate HTTP method (POST only)
 * 2. Authenticate the secret token we put in the callback URL
 *    (the existing music route/token also accepts legacy callbacks)
 * 3. Parse and validate JSON payload
 * 4. Extract taskId and tracks from callback data
 * 5. Verify callback type is "complete" and the task is still pending
 * 6. Process completed music generation via internal mutation
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

  // Step 2: Authenticate before touching the body or the database
  const authError = verifyWebhookToken(req, process.env.SUNO_WEBHOOK_SECRET);
  if (authError) {
    logger.warn("Webhook authentication failed", { status: authError.status });
    return authError;
  }

  // Step 3: Parse JSON payload
  const parseResult = await parseJsonBody<SunoWebhookPayload>(req);
  if (parseResult.error) {
    logger.error("Failed to parse JSON payload");
    return parseResult.error;
  }

  // Step 4: Validate payload structure using type guard
  if (!isValidSunoCallback(parseResult.data)) {
    // Suno payloads carry lyrics; log the shape only.
    logger.warn("Invalid payload structure", {
      payloadType: Array.isArray(parseResult.data) ? "array" : typeof parseResult.data,
    });
    return errorResponse("Invalid payload", HTTP_STATUS_BAD_REQUEST);
  }
  const body = parseResult.data;

  // Step 5: Parse and validate payload
  const parsedPayload = parseSunoPayload(body);
  if (parsedPayload.success === false) {
    logger.warn("Payload validation failed", { error: parsedPayload.error });
    return errorResponse(parsedPayload.error, HTTP_STATUS_BAD_REQUEST);
  }

  const { taskId, callbackType, code } = parsedPayload.data;
  let tracksRaw = parsedPayload.data.tracks;

  // Add taskId to logger context
  const eventLogger = logger.child({ taskId, callbackType, code });
  eventLogger.info("Music callback shape", {
    format: body.data?.callbackType ? "staged" : "jobs",
    hasResultJson: typeof body.data?.resultJson === "string",
    trackCount: tracksRaw.length,
  });

  // Step 6: Verify callback type
  if (callbackType !== "complete") {
    eventLogger.info("Ignoring non-complete callback");
    return successResponse({ status: "ignored" });
  }

  if (code !== HTTP_STATUS_OK) {
    eventLogger.warn("Received non-success callback");
  }

  // A replayed callback, or one for a task that already finished, is a no-op.
  const isPending = await ctx.runQuery(internal.music.hasPendingMusicForTask, { taskId });
  if (!isPending) {
    eventLogger.info("Ignoring callback for task that is not pending");
    return successResponse({ status: "ignored" });
  }

  // Step 7: Process completed music generation
  try {
    // Generic jobs callbacks may only contain resultUrls (without track IDs).
    // Re-fetch the task's structured music result before completing rows.
    if (code === HTTP_STATUS_OK && tracksRaw.length === 0 && !body.data?.callbackType) {
      const client = createKieMusicClientFromEnv({
        KIE_AI_API_KEY: process.env.KIE_AI_API_KEY,
        CONVEX_SITE_URL: process.env.CONVEX_SITE_URL,
        CALLBACK_PATH: MUSIC_GENERATION_CALLBACK_PATH,
        KIE_AI_TIMEOUT: "10000",
      });
      const info = await client.getRecordInfo(taskId);
      tracksRaw = info.tracks.map((track) => ({
        id: track.id, audio_url: track.audioUrl, image_url: track.imageUrl,
        stream_audio_url: track.streamAudioUrl, title: track.title, duration: track.duration,
      }));
    }
    if (code === HTTP_STATUS_OK && tracksRaw.length === 0) {
      throw new Error("Completed music callback has no tracks");
    }
    eventLogger.info("Music asset hosts", {
      hosts: [...new Set(tracksRaw.flatMap((track) => [track.audio_url, track.image_url, track.stream_audio_url])
        .filter((url): url is string => Boolean(url)).flatMap((url) => {
          try { return [new URL(url).hostname]; } catch { return []; }
        }))],
    });
    await ctx.runMutation(internal.music.completeSunoTask, {
      taskId,
      tracks: tracksRaw,
    });
    
    // Timed lyrics are best effort and must not delay the callback response.
    if (code === HTTP_STATUS_OK) {
      await ctx.scheduler.runAfter(0, internal.musicActions.fetchTimedLyrics, { taskId });
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

