/**
 * Clerk webhook handler
 * Processes user creation events from Clerk authentication service
 */

import { httpAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { verifyWebhook } from "@clerk/backend/webhooks";
import type { ClerkWebhookEvent } from "../../models/webhooks/clerk";
import {
  errorResponse,
  successResponse,
  validateHttpMethod,
  createWebhookLogger,
} from "../shared";
import {
  HTTP_STATUS_UNAUTHORIZED,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
} from "../../utils/constants";
import { logWebhookEvent } from "../../utils/logger";

/**
 * Handle Clerk user.created webhook event
 * 
 * Steps:
 * 1. Validate HTTP method (POST only)
 * 2. Verify webhook signature using Clerk SDK
 * 3. Filter events - only process user.created
 * 4. Extract user profile information (email, name)
 * 5. Create user record in database
 * 6. Provision free subscription for new user
 */
export const clerkWebhookHandler = httpAction(async (ctx, req) => {
  // Initialize structured logger
  const logger = createWebhookLogger("clerkWebhookHandler");
  logger.startTimer();
  logWebhookEvent(logger, "clerk", "received");

  // Step 1: Validate HTTP method
  const methodError = validateHttpMethod(req);
  if (methodError) {
    logger.warn("Invalid HTTP method", { method: req.method });
    return methodError;
  }

  // Step 2: Verify webhook signature
  let event: ClerkWebhookEvent;
  try {
    event = (await verifyWebhook(req, {
      signingSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
    })) as ClerkWebhookEvent;
  } catch (error) {
    logger.error("Failed to verify webhook signature", error);
    return errorResponse("Invalid webhook signature", HTTP_STATUS_UNAUTHORIZED);
  }

  // Add event context to logger
  const eventLogger = logger.child({ eventType: event.type });

  // Step 3: Filter events - only process user.created
  if (event.type !== "user.created") {
    eventLogger.info("Ignoring webhook event type");
    return successResponse({ status: "ignored" });
  }

  const { data: userData } = event;

  // Step 4: Extract user profile information
  const primaryEmail = userData.primary_email_address_id
    ? userData.email_addresses.find(
        (email) => email.id === userData.primary_email_address_id
      )?.email_address
    : userData.email_addresses[0]?.email_address;

  const fullName = [userData.first_name, userData.last_name]
    .filter(Boolean)
    .join(" ");

  // Add user context to logger
  const userLogger = eventLogger.child({ clerkId: userData.id });

  // Step 5 & 6: Create user and provision subscription
  try {
    const { userId } = await ctx.runMutation(internal.users.createUser, {
      clerkId: userData.id,
      email: primaryEmail || undefined,
      name: fullName || userData.username || undefined,
    });

    await ctx.runMutation(internal.billing.createFreeSubscription, {
      userId,
    });

    logWebhookEvent(userLogger, "clerk", "processed", {
      userId,
      email: primaryEmail || undefined,
    });
    return successResponse({ status: "ok" });
  } catch (error) {
    userLogger.error("Failed to create user from webhook", error);
    logWebhookEvent(userLogger, "clerk", "failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return errorResponse("Failed to create user", HTTP_STATUS_INTERNAL_SERVER_ERROR);
  }
});

