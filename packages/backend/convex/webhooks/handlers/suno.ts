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
} from "../../utils/constants";
import { logWebhookEvent } from "../../utils/logger";

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

