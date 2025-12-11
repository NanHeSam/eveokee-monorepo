/**
 * Kie.ai webhook handler
 * Processes video generation completion callbacks from Kie.ai API
 */

import { httpAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { KieWebhookPayload } from "../../models/webhooks/kie";
import {
  isValidKieCallback,
  parseKiePayload,
  extractKieCallbackType,
  extractKieTaskId,
} from "../../models/webhooks/kie";
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
} from "../../utils/constants";
import { logWebhookEvent } from "../../utils/logger";

/**
 * Handle Kie.ai video generation callback webhook
 *
 * Steps:
 * 1. Validate HTTP method (POST only)
 * 2. Parse and validate JSON payload
 * 3. Extract taskId and video URL from callback data
 * 4. Download video from Kie.ai URL
 * 5. Upload video to Convex storage
 * 6. Process completed video generation via internal mutation
 * 7. On failure: Mark video as failed (failVideoGeneration handles credit refund atomically)
 *
 * IMPORTANT: Credit refunds are now idempotent - failVideoGeneration atomically checks
 * the video status and only refunds if status is "pending", preventing duplicate refunds
 * when callbacks are retried.
 */
export const kieVideoGenerationCallback = httpAction(async (ctx, req) => {
  // Initialize structured logger
  const logger = createWebhookLogger("kieVideoGenerationCallback");
  logger.startTimer();
  logWebhookEvent(logger, "kie-callback", "received");

  // Step 1: Validate HTTP method
  const methodError = validateHttpMethod(req);
  if (methodError) {
    logger.warn("Invalid HTTP method", { method: req.method });
    return methodError;
  }



  // Step 2: Parse JSON payload
  const parseResult = await parseJsonBody<KieWebhookPayload>(req);
  if (parseResult.error) {
    logger.error("Failed to parse JSON payload");
    return parseResult.error;
  }

  const body = parseResult.data;
  logger.info("Received Kie.ai callback payload", { payload: JSON.stringify(body) });

  // Step 3: Validate payload structure using type guard
  if (!isValidKieCallback(body)) {
    logger.warn("Invalid payload structure", { payload: JSON.stringify(body) });
    return errorResponse("Invalid payload", HTTP_STATUS_BAD_REQUEST);
  }

  // Step 4: Extract callback type and taskId first (before requiring videoUrl)
  const callbackType = extractKieCallbackType(body);
  const taskId = extractKieTaskId(body);

  if (!taskId) {
    logger.warn("Missing taskId in callback");
    return errorResponse("Missing taskId", HTTP_STATUS_BAD_REQUEST);
  }

  const eventLogger = logger.child({ taskId, callbackType });

  // Step 5: Detect failure callbacks (which may not have videoUrl)
  // Check for failure indicators: state="fail", non-200 codes, or failMsg/failCode
  const isFailure = 
    callbackType === "failed" || 
    callbackType === "error" || 
    callbackType === "fail" ||
    (typeof body.code === "number" && body.code !== HTTP_STATUS_OK && body.code !== 200) ||
    (body.data && typeof body.data === "object" && ("failMsg" in body.data || "failCode" in body.data));

  if (isFailure) {
    // Extract failure message from payload
    let errorMessage = "Video generation failed on Kie.ai";
    if (body.data && typeof body.data === "object") {
      const data = body.data as Record<string, unknown>;
      if (typeof data.failMsg === "string" && data.failMsg) {
        errorMessage = data.failMsg;
      } else if (typeof data.msg === "string" && data.msg) {
        errorMessage = data.msg;
      } else if (typeof body.msg === "string" && body.msg) {
        errorMessage = body.msg;
      }
      
      // Include failCode if available
      if (typeof data.failCode === "string" && data.failCode) {
        errorMessage = `[${data.failCode}] ${errorMessage}`;
      }
    }

    eventLogger.warn("Received failure callback", { 
      callbackType, 
      code: body.code,
      errorMessage 
    });

    try {
      // Mark video as failed (failVideoGeneration now handles refund atomically)
      const result = await ctx.runMutation(internal.videos.failVideoGeneration, {
        kieTaskId: taskId,
        errorMessage: "Video generation failed on Kie.ai",
      });

      if (result.alreadyFailed) {
        eventLogger.info("Video already failed, skipped duplicate refund");
      } else if (result.refunded) {
        eventLogger.info("Marked video as failed and refunded 3 credits");
      }

      return successResponse({ status: "failure_handled" });
    } catch (error) {
      eventLogger.error("Failed to process failure callback", error);
      return errorResponse("Failed to process failure callback", HTTP_STATUS_INTERNAL_SERVER_ERROR);
    }
  }

  // Step 6: Handle non-completion callbacks
  if (callbackType !== "complete" && callbackType !== "completed" && callbackType !== "success") {
    eventLogger.info("Ignoring non-complete callback");
    return successResponse({ status: "ignored" });
  }

  // Step 7: Parse and validate success payload (requires videoUrl)
  const parsedPayload = parseKiePayload(body);
  if (parsedPayload.success === false) {
    logger.warn("Payload validation failed", { error: parsedPayload.error });
    return errorResponse(parsedPayload.error, HTTP_STATUS_BAD_REQUEST);
  }

  const { videoUrl, code, videoData } = parsedPayload.data;

  if (code !== HTTP_STATUS_OK && code !== 200) {
    eventLogger.warn("Received non-success callback");
  }

  // Step 6: Download video from Kie.ai URL
  let videoBlob: Blob;
  try {
    eventLogger.info("Downloading video from Kie.ai", { videoUrl });
    const videoResponse = await fetch(videoUrl);

    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status} ${videoResponse.statusText}`);
    }

    videoBlob = await videoResponse.blob();
    eventLogger.info("Video downloaded successfully", { size: videoBlob.size });
  } catch (error) {
    eventLogger.error("Failed to download video", error);

    // Mark video as failed (failVideoGeneration handles refund atomically)
    const result = await ctx.runMutation(internal.videos.failVideoGeneration, {
      kieTaskId: taskId,
      errorMessage: error instanceof Error ? error.message : "Failed to download video",
    });

    if (result.refunded) {
      eventLogger.info("Refunded 3 credits for download failure");
    }

    return errorResponse("Failed to download video", HTTP_STATUS_INTERNAL_SERVER_ERROR);
  }

  // Step 7: Upload video to Convex storage
  let storageId: string;
  try {
    eventLogger.info("Uploading video to Convex storage");
    storageId = await ctx.storage.store(videoBlob);
    eventLogger.info("Video uploaded successfully", { storageId });
  } catch (error) {
    eventLogger.error("Failed to upload video to storage", error);

    // Mark video as failed (failVideoGeneration handles refund atomically)
    const result = await ctx.runMutation(internal.videos.failVideoGeneration, {
      kieTaskId: taskId,
      errorMessage: error instanceof Error ? error.message : "Failed to upload video",
    });

    if (result.refunded) {
      eventLogger.info("Refunded 3 credits for upload failure");
    }

    return errorResponse("Failed to upload video to storage", HTTP_STATUS_INTERNAL_SERVER_ERROR);
  }

  // Step 8: Process completed video generation
  try {
    await ctx.runMutation(internal.videos.completeKieVideoTask, {
      kieTaskId: taskId,
      videoStorageId: storageId,
      duration: videoData?.duration,
      metadata: {
        data: videoData,
        videoUrl,
        model: videoData?.model,
        aspectRatio: videoData?.aspectRatio,
        nFrames: videoData?.nFrames,
      },
    });
    
    // Get the video record to send push notification
    const videoRecord = await ctx.runQuery(internal.videos.getVideoByTaskId, {
      taskId,
    });
    
    // Send push notification if video was successfully completed
    if (videoRecord && videoRecord.status === "ready") {
      try {
        await ctx.runAction(internal.pushNotifications.sendPushNotification, {
          userId: videoRecord.userId,
          title: "Your video is ready!",
          body: "Your music video has finished generating",
          data: {
            type: "video_ready",
            videoId: videoRecord._id,
            musicId: videoRecord.musicId,
          },
        });
      } catch (notificationError) {
        // Log but don't fail the webhook if notification fails
        eventLogger.warn("Failed to send push notification", {
          error: notificationError instanceof Error ? notificationError.message : "Unknown error",
        });
      }
    }
    
    logWebhookEvent(eventLogger, "kie-callback", "processed", {
      storageId,
      duration: videoData?.duration,
    });
    
    return successResponse({ status: "ok" });
  } catch (error) {
    eventLogger.error("Failed to process callback", error);
    logWebhookEvent(eventLogger, "kie-callback", "failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return errorResponse("Failed to process callback", HTTP_STATUS_INTERNAL_SERVER_ERROR);
  }
});


