/**
 * VAPI assistant-request handler
 * Handles inbound call requests from VAPI, dynamically building assistant configuration
 * based on the caller's phone number
 */

import { httpAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { buildVapiAssistant } from "../../integrations/vapi/helpers";
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
  HTTP_STATUS_NOT_FOUND,
} from "../../utils/constants/webhooks";

/**
 * Type for Vapi assistant-request message
 */
interface VapiAssistantRequestMessage {
  type: "assistant-request";
  customer?: {
    number?: string;
  };
}

/**
 * Type for incoming Vapi assistant-request payload
 */
interface VapiAssistantRequestPayload {
  message?: VapiAssistantRequestMessage;
  customer?: {
    number?: string;
  };
}

/**
 * Handle VAPI assistant-request for inbound calls
 * 
 * Steps:
 * 1. Validate HTTP method (POST only)
 * 2. Verify Bearer token authentication
 * 3. Parse and validate JSON payload
 * 4. Extract customer phone number
 * 5. Look up user by phone number via callSettings
 * 6. Get user and callSettings
 * 7. Build assistant configuration using current time
 * 8. Return assistant configuration
 */
export const vapiAssistantRequestHandler = httpAction(async (ctx, req) => {
  // Initialize structured logger
  const logger = createWebhookLogger("vapiAssistantRequestHandler");
  logger.startTimer();
  logger.debug("Received assistant-request");

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
  const parseResult = await parseJsonBody<VapiAssistantRequestPayload>(req);
  if (parseResult.error) {
    logger.error("Failed to parse JSON payload");
    return parseResult.error;
  }

  const payload = parseResult.data;

  // Step 4: Extract customer phone number
  // Support both message.customer.number and customer.number formats
  const phoneNumber = payload.message?.customer?.number || payload.customer?.number;
  
  if (!phoneNumber) {
    logger.warn("Missing customer phone number in request");
    return errorResponse(
      "Missing customer phone number",
      HTTP_STATUS_BAD_REQUEST
    );
  }

  logger.debug("Processing assistant request", { phoneNumber });

  try {
    // Step 5: Look up callSettings by phone number
    const callSettings = await ctx.runQuery(
      internal.callSettings.getCallSettingsByPhoneE164,
      {
        phoneE164: phoneNumber,
      }
    );

    if (!callSettings) {
      logger.warn("No call settings found for phone number", { phoneNumber });
      return errorResponse(
        "It seems your account didn't have a number setup, please go to your eveokee account settings and setup a number.",
        HTTP_STATUS_NOT_FOUND
      );
    }

    // Step 6: Get user
    const user = await ctx.runQuery(internal.users.getUserById, {
      userId: callSettings.userId,
    });

    if (!user) {
      logger.error("User not found for call settings", {
        userId: callSettings.userId,
        phoneNumber,
      });
      return errorResponse(
        "User not found",
        HTTP_STATUS_INTERNAL_SERVER_ERROR
      );
    }

    // Step 7: Build assistant configuration
    // For inbound calls, use current time as the scheduled time
    const now = Date.now();
    // CONVEX_SITE_URL is provided automatically by Convex
    const convexSiteUrl = process.env.CONVEX_SITE_URL;
    if (!convexSiteUrl) {
      logger.error("CONVEX_SITE_URL not available (this should be provided automatically by Convex)");
      return errorResponse(
        "Server configuration error",
        HTTP_STATUS_INTERNAL_SERVER_ERROR
      );
    }
    // Construct webhook URL from site URL + path
    const baseUrlNormalized = convexSiteUrl.replace(/\/$/, "");
    const webhookUrl = `${baseUrlNormalized}/webhooks/vapi`;

    // Parse optional credentialId from environment variable
    const credentialId = process.env.VAPI_CREDENTIAL_ID;
    const credentialIds = credentialId ? [credentialId] : undefined;

    const assistant = buildVapiAssistant(
      user,
      callSettings,
      now,
      webhookUrl,
      credentialIds
    );

    logger.info("Assistant configuration built successfully", {
      userId: user._id,
      phoneNumber,
    });

    // Step 8: Return assistant configuration
    // According to Vapi docs: https://docs.vapi.ai/api-reference/webhooks/server-message#response.body.messageResponse.AssistantRequest
    // The response must be wrapped in a messageResponse object with an assistant property
    const response = {
      messageResponse: {
        assistant,
      },
    };


    return successResponse(response);
  } catch (error) {
    logger.error("Failed to process assistant request", error);
    return errorResponse(
      "Failed to process assistant request",
      HTTP_STATUS_INTERNAL_SERVER_ERROR
    );
  }
});

