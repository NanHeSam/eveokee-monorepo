/**
 * RevenueCat webhook handler
 * Processes subscription events from RevenueCat billing service
 */

import { httpAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { parseRevenueCatPayload } from "../../models/webhooks/revenuecat";
import {
  errorResponse,
  successResponse,
  isValidConvexId,
  getPlatformFromStore,
  validateHttpMethod,
  parseJsonBody,
  verifyBearerToken,
  createWebhookLogger,
} from "../shared";
import {
  sanitizeForConvex,
} from "../../utils/logger";
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
} from "../../utils/constants";
import { logWebhookEvent } from "../../utils/logger";

/**
 * Handle RevenueCat webhook events
 * 
 * Steps:
 * 1. Initialize structured logger with correlation ID
 * 2. Validate HTTP method (POST only)
 * 3. Verify Bearer token authentication
 * 4. Parse and validate JSON payload
 * 5. Extract and validate required fields (eventType, userId, productId)
 * 6. Validate user ID format (must be valid Convex ID)
 * 7. Extract subscription metadata (expiration, entitlements, etc.)
 * 8. Update subscription in database via internal mutation
 * 9. Return success response with correlation ID
 */
export const revenueCatWebhookHandler = httpAction(async (ctx, req) => {
  // Step 1: Initialize structured logger
  const logger = createWebhookLogger("revenueCatWebhookHandler");
  logger.startTimer();
  logWebhookEvent(logger, "revenuecat", "received");

  // Step 2: Validate HTTP method
  const methodError = validateHttpMethod(req);
  if (methodError) {
    logger.warn("Invalid HTTP method", { method: req.method });
    return methodError;
  }

  // Step 3: Verify Bearer token authentication
  const authError = verifyBearerToken(req, process.env.REVENUECAT_WEBHOOK_SECRET);
  if (authError) {
    logger.warn("Webhook authentication failed");
    return authError;
  }
  logger.debug("Webhook authentication successful");

  // Step 4: Parse JSON payload
  const parseResult = await parseJsonBody<unknown>(req);
  if (parseResult.error) {
    logger.error("Failed to parse JSON payload");
    return parseResult.error;
  }

  // Step 5: Parse and validate payload
  const parsedPayload = parseRevenueCatPayload(parseResult.data);
  if (parsedPayload.success === false) {
    logger.warn("Payload validation failed", { error: parsedPayload.error });
    return errorResponse(parsedPayload.error, HTTP_STATUS_BAD_REQUEST);
  }
  const event = parsedPayload.data;

  // Step 6: Extract and validate required fields
  const eventType = event.event.type;
  const appUserId = event.event.app_user_id;
  // For PRODUCT_CHANGE events, use new_product_id if available, otherwise fall back to product_id
  const productId = eventType === "PRODUCT_CHANGE" && event.event.new_product_id
    ? event.event.new_product_id
    : event.event.product_id;
  const store = event.event.store;
  const environment = event.event.environment; // SANDBOX or PRODUCTION

  // Add event context to logger
  const eventLogger = logger.child({
    eventType,
    userId: appUserId,
    productId,
    store,
    environment,
  });

  eventLogger.info("Webhook payload parsed", {
    hasEntitlements: !!event.event.entitlements,
    hasExpirationDate: !!event.event.expiration_at_ms,
    environment, // Log environment to track sandbox vs production receipts
  });

  // Step 7: Validate user ID format
  if (!isValidConvexId(appUserId)) {
    eventLogger.error("Invalid user ID format", undefined, {
      userIdLength: appUserId.length,
      userIdPattern: /^[a-zA-Z0-9_-]+$/.test(appUserId),
    });
    return errorResponse("Invalid user ID format", HTTP_STATUS_BAD_REQUEST);
  }

  eventLogger.debug("Webhook validation passed");

  // Step 8: Extract subscription metadata
  const expirationAtMs = event.event.expiration_at_ms;
  const purchasedAtMs = event.event.purchased_at_ms;
  const isTrialConversion = event.event.is_trial_conversion;

  // Extract entitlement IDs (use entitlement_ids if available, otherwise extract from entitlements object)
  const entitlementIds = event.event.entitlement_ids ?? 
    (event.event.entitlements ? Object.keys(event.event.entitlements) : []);

  eventLogger.debug("Webhook data extracted", {
    entitlementCount: entitlementIds.length,
    hasExpiration: !!expirationAtMs,
    isTrialConversion,
  });

  // Step 9: Update subscription in database
  try {
    // Note: appUserId is validated as Id<"users"> by isValidConvexId() type guard above
    // Sanitize rawEvent to remove Convex-incompatible field names (starting with $ or _)
    const sanitizedEvent = sanitizeForConvex(event);

    await ctx.runMutation(internal.revenueCatBilling.updateSubscriptionFromWebhook, {
      userId: appUserId, // Type-safe: validated by isValidConvexId()
      eventType,
      productId,
      store,
      expirationAtMs,
      purchasedAtMs,
      isTrialConversion,
      entitlementIds,
      rawEvent: sanitizedEvent,
    });

    eventLogger.info("Webhook processed successfully");
    logWebhookEvent(eventLogger, "revenuecat", "processed");
    return successResponse({ status: "ok" });
  } catch (error) {
    eventLogger.error("Failed to process webhook mutation", error, {
      mutationName: "updateSubscriptionFromWebhook",
    });
    logWebhookEvent(eventLogger, "revenuecat", "failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return errorResponse("Failed to process webhook", HTTP_STATUS_INTERNAL_SERVER_ERROR);
  }
});

