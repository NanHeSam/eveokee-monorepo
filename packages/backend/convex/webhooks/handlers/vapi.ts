/**
 * VAPI webhook handler
 * Processes call events from VAPI voice AI service
 */

import { httpAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { VapiWebhookEvent } from "../../models/webhooks/vapi";
import {
  isValidVapiWebhookEvent,
  parseVapiPayload,
  extractVapiCallId,
  extractEndedAt,
  extractDurationSeconds,
  extractDisposition,
  extractArtifact,
} from "../../models/webhooks/vapi";
import {
  errorResponse,
  successResponse,
  validateHttpMethod,
  parseJsonBody,
  createWebhookLogger,
  verifyBearerToken,
} from "../shared";
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
} from "../../utils/constants";
import { logWebhookEvent } from "../../utils/logger";

/**
 * Handle VAPI webhook events (end-of-call-report)
 * 
 * Steps:
 * 1. Validate HTTP method (POST only)
 * 2. Verify Bearer token authentication
 * 3. Parse and validate JSON payload structure
 * 4. Extract call ID and message type
 * 5. Validate event.message structure and call data
 * 6. Look up call job by VAPI call ID
 * 7. Extract call metadata (endedAt, duration, disposition, artifacts)
 * 8. Update call job status to completed
 * 9. Create/update call session with transcript and metadata
 * 10. Schedule diary generation workflow if transcript available
 */
export const vapiWebhookHandler = httpAction(async (ctx, req) => {
  // Initialize structured logger
  const logger = createWebhookLogger("vapiWebhookHandler");
  logger.startTimer();
  logWebhookEvent(logger, "vapi", "received");

  // Step 1: Validate HTTP method
  const methodError = validateHttpMethod(req);
  if (methodError) {
    logger.warn("Invalid HTTP method", { method: req.method });
    return methodError;
  }

  // Step 2: Verify Bearer token authentication
  const authError = verifyBearerToken(req, process.env.VAPI_WEBHOOK_SECRET);
  if (authError) {
    logger.warn("Webhook authentication failed");
    return authError;
  }
  logger.debug("Webhook authentication successful");

  // Step 3: Parse JSON payload
  const parseResult = await parseJsonBody<unknown>(req);
  if (parseResult.error) {
    logger.error("Failed to parse JSON payload");
    return parseResult.error;
  }

  // Step 4: Parse and validate payload
  const parsedPayload = parseVapiPayload(parseResult.data);
  if (parsedPayload.success === false) {
    logger.error("Payload validation failed", { error: parsedPayload.error });
    return errorResponse(parsedPayload.error, HTTP_STATUS_BAD_REQUEST);
  }
  const event = parsedPayload.data;

  // Step 5: Extract and validate call ID
  const vapiCallId = extractVapiCallId(event);
  if (!vapiCallId) {
    logger.warn("Webhook missing call ID");
    return errorResponse("Missing call ID", HTTP_STATUS_BAD_REQUEST);
  }

  const messageType = event.message.type;

  // Add event context to logger
  const eventLogger = logger.child({ messageType, vapiCallId });

  try {
    // Step 6: Handle end-of-call-report events
    if (messageType === "end-of-call-report") {
      // Step 6.1: Look up call job
      const job = await ctx.runQuery(internal.callJobs.getCallJobByVapiId, {
        vapiCallId,
      });

      if (!job) {
        eventLogger.warn("No job found for VAPI call ID");
        return successResponse({ status: "ignored", reason: "Job not found" });
      }

      // Add job context to logger
      const jobLogger = eventLogger.child({ jobId: job._id, userId: job.userId });

      // Step 7: Extract call metadata using validation helpers
      const endedAt = extractEndedAt(event);
      const durationSeconds = extractDurationSeconds(event);
      const disposition = extractDisposition(event);
      const artifact = extractArtifact(event);

      // Step 8: Update call job status
      await ctx.runMutation(internal.callJobs.updateCallJobStatus, {
        jobId: job._id,
        status: "completed",
      });

      // Step 9: Create/update call session
      await ctx.runMutation(internal.callJobs.updateCallSession, {
        vapiCallId,
        jobId: job._id,
        userId: job.userId,
        endedAt,
        durationSec: durationSeconds,
        disposition,
        metadata: {
          transcript: artifact.transcript,
          messages: artifact.messages,
          recording: artifact.recording,
          endedReason: event.message.endedReason,
        },
      });

      jobLogger.info("Call completed", {
        duration: durationSeconds,
        disposition,
        hasTranscript: !!artifact.transcript,
        hasMessages: !!artifact.messages,
      });

      // Step 10: Schedule diary generation workflow if transcript available
      if (artifact.transcript || artifact.messages) {
        try {
          const callSession = await ctx.runQuery(internal.callJobs.getCallSessionByVapiId, {
            vapiCallId,
          });

          if (callSession) {
            const existingDiaryId = callSession.metadata?.diaryId;
            if (existingDiaryId) {
              jobLogger.info("Diary already exists, skipping workflow", {
                callSessionId: callSession._id,
                diaryId: existingDiaryId,
              });
            } else {
              await ctx.scheduler.runAfter(0, internal.callDiaryWorkflow.generateDiaryFromCall, {
                userId: job.userId,
                callSessionId: callSession._id,
                endedAt: callSession.endedAt,
                transcript: artifact.transcript as string | undefined,
                messages: artifact.messages,
              });
              jobLogger.info("Scheduled diary generation workflow", {
                callSessionId: callSession._id,
              });
            }
          } else {
            jobLogger.warn("Could not find call session to trigger diary workflow");
          }
        } catch (workflowError) {
          jobLogger.error("Failed to schedule diary generation workflow", workflowError);
        }
      }

      logWebhookEvent(jobLogger, "vapi", "processed", {
        duration: durationSeconds,
        disposition,
      });
    } else {
      eventLogger.info("Ignoring webhook event type");
    }
  } catch (error) {
    eventLogger.error("Failed to process webhook", error);
    logWebhookEvent(eventLogger, "vapi", "failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return errorResponse("Failed to process webhook", HTTP_STATUS_INTERNAL_SERVER_ERROR);
  }

  return successResponse({ status: "ok" });
});

