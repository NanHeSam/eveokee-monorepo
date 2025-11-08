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
 * 7. On failure: Mark video as failed and refund 3 credits
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

  // Step 3: Validate payload structure using type guard
  if (!isValidKieCallback(parseResult.data)) {
    logger.warn("Invalid payload structure", { payload: parseResult.data });
    return errorResponse("Invalid payload", HTTP_STATUS_BAD_REQUEST);
  }
  const body = parseResult.data;

  // Step 4: Parse and validate payload
  const parsedPayload = parseKiePayload(body);
  if (parsedPayload.success === false) {
    logger.warn("Payload validation failed", { error: parsedPayload.error });
    return errorResponse(parsedPayload.error, HTTP_STATUS_BAD_REQUEST);
  }

  const { taskId, videoUrl, callbackType, code, videoData } = parsedPayload.data;

  // Add taskId to logger context
  const eventLogger = logger.child({ taskId, callbackType, code });

  // Step 5: Check callback type
  if (callbackType !== "complete" && callbackType !== "completed" && callbackType !== "success") {
    // If it's a failure callback
    if (callbackType === "failed" || callbackType === "error") {
      eventLogger.warn("Received failure callback");
      try {
        // Get video record to find userId for credit refund
        const video = await ctx.runQuery(internal.videos.getVideoByTaskId, {
          taskId,
        });
        
        if (video) {
          // Refund 3 credits
          await ctx.runMutation(internal.usage.decrementVideoGeneration, {
            userId: video.userId,
          });
          
          // Mark video as failed
          await ctx.runMutation(internal.videos.failVideoGeneration, {
            kieTaskId: taskId,
            errorMessage: "Video generation failed on Kie.ai",
          });
        }
        
        return successResponse({ status: "failure_handled" });
      } catch (error) {
        eventLogger.error("Failed to process failure callback", error);
        return errorResponse("Failed to process failure callback", HTTP_STATUS_INTERNAL_SERVER_ERROR);
      }
    }
    
    eventLogger.info("Ignoring non-complete callback");
    return successResponse({ status: "ignored" });
  }

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
    
    // Get video record to find userId for credit refund
    const video = await ctx.runQuery(internal.videos.getVideoByTaskId, {
      taskId,
    });
    
    if (video) {
      // Refund 3 credits
      await ctx.runMutation(internal.usage.decrementVideoGeneration, {
        userId: video.userId,
      });
      
      // Mark video as failed
      await ctx.runMutation(internal.videos.failVideoGeneration, {
        kieTaskId: taskId,
        errorMessage: error instanceof Error ? error.message : "Failed to download video",
      });
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
    
    // Get video record to find userId for credit refund
    const video = await ctx.runQuery(internal.videos.getVideoByTaskId, {
      taskId,
    });
    
    if (video) {
      // Refund 3 credits
      await ctx.runMutation(internal.usage.decrementVideoGeneration, {
        userId: video.userId,
      });
      
      // Mark video as failed
      await ctx.runMutation(internal.videos.failVideoGeneration, {
        kieTaskId: taskId,
        errorMessage: error instanceof Error ? error.message : "Failed to upload video",
      });
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


