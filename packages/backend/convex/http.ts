import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { MUSIC_GENERATION_CALLBACK_PATH, CLERK_WEBHOOK_PATH, REVENUECAT_WEBHOOK_PATH, VAPI_WEBHOOK_PATH } from "./constant";
import { verifyWebhook } from "@clerk/backend/webhooks";
import type { Id } from "./_generated/dataModel";
import { createLogger, generateCorrelationId, sanitizeForLogging } from "./lib/logger";

type RawSunoCallback = {
  code?: unknown;
  msg?: unknown;
  data?: {
    callbackType?: unknown;
    task_id?: unknown;
    taskId?: unknown;
    data?: unknown;
  };
};

const jsonHeaders = {
  "Content-Type": "application/json",
};

/**
 * Type guard to validate if a string is a valid Convex ID format.
 * Convex IDs are base64-encoded strings with a specific pattern.
 */
function isValidConvexId(id: string): id is Id<"users"> {
  // Convex IDs are non-empty strings with alphanumeric characters, underscores, and hyphens
  // They typically follow a pattern but we'll do a basic validation
  return typeof id === "string" && id.length > 0 && /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * Map RevenueCat store names to our platform enum.
 * Only supports: Apple App Store, Google Play Store, and Stripe (web).
 * Returns undefined for unsupported platforms.
 */
const getPlatformFromStore = (store: string | undefined): "app_store" | "play_store" | "stripe" | undefined => {
  const platformMap: Record<string, "app_store" | "play_store" | "stripe"> = {
    "APP_STORE": "app_store",
    "PLAY_STORE": "play_store",
    "STRIPE": "stripe",
  };
  return store ? platformMap[store] : undefined;
};

const sunoMusicGenerationCallback = httpAction(async (ctx, req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: RawSunoCallback;
  try {
    body = (await req.json()) as RawSunoCallback;
  } catch (error) {
    console.error("Failed to parse Suno callback JSON", error);
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      {
        status: 400,
        headers: jsonHeaders,
      },
    );
  }

  if (!body || typeof body !== "object") {
    return new Response(
      JSON.stringify({ error: "Invalid payload" }),
      {
        status: 400,
        headers: jsonHeaders,
      },
    );
  }

  const { code, data } = body;
  if (!data || typeof data !== "object") {
    console.warn("Suno callback missing data field", body);
    return new Response(
      JSON.stringify({ status: "ignored" }),
      {
        status: 200,
        headers: jsonHeaders,
      },
    );
  }

  const callbackType = (data.callbackType as string | undefined) ?? undefined;
  const taskIdValue = data.task_id ?? data.taskId;
  const taskId = typeof taskIdValue === "string" ? taskIdValue : undefined;
  const tracksRaw = Array.isArray(data.data) ? data.data : [];

  if (!taskId) {
    console.warn("Suno callback missing taskId", body);
    return new Response(
      JSON.stringify({ error: "Missing taskId" }),
      {
        status: 400,
        headers: jsonHeaders,
      },
    );
  }

  if (callbackType !== "complete") {
    console.log(
      "Ignoring non-complete Suno callback",
      JSON.stringify({ taskId, callbackType, code }),
    );
    return new Response(
      JSON.stringify({ status: "ignored" }),
      {
        status: 200,
        headers: jsonHeaders,
      },
    );
  }

  if (code !== 200) {
    console.warn(
      "Received non-success Suno callback",
      JSON.stringify({ taskId, code, callbackType }),
    );
  }

  try {
    await ctx.runMutation(internal.music.completeSunoTask, {
      taskId,
      tracks: tracksRaw as Array<Record<string, unknown>>,
    });
  } catch (error) {
    console.error("Failed to process Suno callback", error);
    return new Response(
      JSON.stringify({ error: "Failed to process callback" }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }

  return new Response(
    JSON.stringify({ status: "ok" }),
    {
      status: 200,
      headers: jsonHeaders,
    },
  );
});

const clerkWebhookHandler = httpAction(async (ctx, req) => {
  // 1. Validate request
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let event: any;
  try {
    // 2. Security verification
    // 2.1 Verify webhook signature using Clerk SDK
    event = await verifyWebhook(req, {
      signingSecret: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
    });
  } catch (error) {
    // 2.2 Handle signature verification failure
    console.error("Failed to verify Clerk webhook signature", error);
    return new Response(
      JSON.stringify({ error: "Invalid webhook signature" }),
      {
        status: 401,
        headers: jsonHeaders,
      },
    );
  }

  // 3. Process webhook data
  // 3.1 Filter webhook events - only process user.created events
  if (event.type !== "user.created") {
    console.log(`Ignoring Clerk webhook event type: ${event.type}`);
    return new Response(
      JSON.stringify({ status: "ignored" }),
      {
        status: 200,
        headers: jsonHeaders,
      },
    );
  }

  const { data: userData } = event;
  
  // 3.2 Extract user profile information
  const primaryEmail = userData.primary_email_address_id 
    ? userData.email_addresses.find(
        (email: any) => email.id === userData.primary_email_address_id
      )?.email_address
    : userData.email_addresses[0]?.email_address;

  const fullName = [userData.first_name, userData.last_name]
    .filter(Boolean)
    .join(" ");

  try {
    // 4. Database operations
    // 4.1 Create user record
    const { userId } = await ctx.runMutation(internal.users.createUser, {
      clerkId: userData.id,
      email: primaryEmail || undefined,
      name: fullName || userData.username || undefined,
    });

    // 4.2 Provision free subscription
    await ctx.runMutation(internal.billing.createFreeSubscription, {
      userId,
    });

    console.log(`Successfully created user with free subscription for Clerk ID: ${userData.id}`);
  } catch (error) {
    console.error("Failed to create user from Clerk webhook", error);
    return new Response(
      JSON.stringify({ error: "Failed to create user" }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }

  // 5. Return response
  return new Response(
    JSON.stringify({ status: "ok" }),
    {
      status: 200,
      headers: jsonHeaders,
    },
  );
});

const vapiWebhookHandler = httpAction(async (ctx, req) => {
  // 1. Validate request
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // TODO: Implement webhook authentication (Bearer token, HMAC, or X-Vapi-Secret signature verification)
  // to prevent spoofing attacks. See Clerk webhook handler for reference implementation.

  let event: any;
  try {
    event = await req.json();
  } catch (error) {
    console.error("Failed to parse VAPI webhook JSON", error);
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      {
        status: 400,
        headers: jsonHeaders,
      },
    );
  }


  // Validate event structure
  if (!event || typeof event !== "object") {
    console.error("VAPI webhook: event is not an object", typeof event);
    return new Response(
      JSON.stringify({ error: "Invalid event structure" }),
      {
        status: 400,
        headers: jsonHeaders,
      },
    );
  }

  // Validate event.message structure
  const hasMessage = event.message !== undefined && event.message !== null;
  if (!hasMessage) {
    console.warn("VAPI webhook missing message field");
    return new Response(
      JSON.stringify({ error: "Missing message field" }),
      {
        status: 400,
        headers: jsonHeaders,
      },
    );
  }

  if (typeof event.message !== "object" || Array.isArray(event.message)) {
    console.error("VAPI webhook: message is not a plain object", typeof event.message, Array.isArray(event.message));
    return new Response(
      JSON.stringify({ error: "Invalid message field: must be an object" }),
      {
        status: 400,
        headers: jsonHeaders,
      },
    );
  }

  // Validate message.type
  const messageType = event.message.type;
  if (typeof messageType !== "string") {
    console.error("VAPI webhook: message.type is not a string", typeof messageType);
    return new Response(
      JSON.stringify({ error: "Invalid message.type: must be a string" }),
      {
        status: 400,
        headers: jsonHeaders,
      },
    );
  }

  const vapiCallId = event.message.call?.id;

  if (!vapiCallId) {
    console.warn("VAPI webhook missing call ID", event);
    return new Response(
      JSON.stringify({ error: "Missing call ID" }),
      {
        status: 400,
        headers: jsonHeaders,
      },
    );
  }

  try {
    // Handle end-of-call report (transcript data)
    if (messageType === "end-of-call-report") {
      const job = await ctx.runQuery(internal.callJobs.getCallJobByVapiId, {
        vapiCallId,
      });

      if (!job) {
        console.warn(`No job found for VAPI call ID: ${vapiCallId}`);
        return new Response(
          JSON.stringify({ status: "ignored", reason: "Job not found" }),
          {
            status: 200,
            headers: jsonHeaders,
          },
        );
      }

      // Validate message.call structure
      const hasCall = event.message.call !== undefined && event.message.call !== null;
      let endedAt = Date.now();
      let durationSeconds: number | undefined = undefined;
      let disposition = "completed";

      if (hasCall) {
        if (typeof event.message.call !== "object" || Array.isArray(event.message.call)) {
          console.error("VAPI webhook: message.call is not an object");
          return new Response(
            JSON.stringify({ error: "Invalid message.call: must be an object" }),
            {
              status: 400,
              headers: jsonHeaders,
            },
          );
        }

        // Validate endedAt
        const endedAtValue = event.message.call.endedAt;
        if (endedAtValue !== undefined && endedAtValue !== null) {
          if (typeof endedAtValue === "number") {
            endedAt = endedAtValue;
          } else if (typeof endedAtValue === "string") {
            // Try parsing as ISO string
            const parsed = Date.parse(endedAtValue);
            if (!isNaN(parsed)) {
              endedAt = parsed;
            } else {
              console.warn("VAPI webhook: invalid ISO string for endedAt", endedAtValue);
            }
          } else {
            console.warn("VAPI webhook: endedAt is not a number or ISO string", typeof endedAtValue);
          }
        }

        // Validate durationSeconds
        const durationValue = event.message.durationSeconds;
        if (durationValue !== undefined && durationValue !== null) {
          if (typeof durationValue === "number" && !isNaN(durationValue) && isFinite(durationValue)) {
            durationSeconds = durationValue;
          } else {
            console.warn("VAPI webhook: durationSeconds is not a valid number", typeof durationValue, durationValue);
          }
        }

        // Validate disposition
        const dispositionValue = event.message.call.disposition;
        if (dispositionValue !== undefined && dispositionValue !== null) {
          if (typeof dispositionValue === "string") {
            disposition = dispositionValue;
          } else {
            console.warn("VAPI webhook: disposition is not a string", typeof dispositionValue);
          }
        }
      }

      // Validate artifact - ensure it's always an object
      let artifact: Record<string, any> = {};
      if (event.message.artifact !== undefined && event.message.artifact !== null) {
        if (typeof event.message.artifact === "object" && !Array.isArray(event.message.artifact)) {
          artifact = event.message.artifact;
        } else {
          console.warn("VAPI webhook: artifact is not an object, using empty object", typeof event.message.artifact);
        }
      }

      await ctx.runMutation(internal.callJobs.updateCallJobStatus, {
        jobId: job._id,
        status: "completed",
      });

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

      console.log(`Call completed with transcript for job ${job._id}, VAPI call ID: ${vapiCallId}, duration: ${durationSeconds}s`, JSON.stringify(event));
    } else {
      console.log(`Ignoring VAPI webhook event type: ${messageType}`);
    }
  } catch (error) {
    console.error("Failed to process VAPI webhook", error);
    return new Response(
      JSON.stringify({ error: "Failed to process webhook" }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }

  return new Response(
    JSON.stringify({ status: "ok" }),
    {
      status: 200,
      headers: jsonHeaders,
    },
  );
});

const revenueCatWebhookHandler = httpAction(async (ctx, req) => {
  // Initialize structured logger with correlation ID
  const correlationId = generateCorrelationId();
  const logger = createLogger({
    functionName: 'revenueCatWebhookHandler',
    correlationId,
  });

  logger.startTimer();
  logger.info('RevenueCat webhook received');

  // 1. Validate request
  if (req.method !== "POST") {
    logger.warn('Invalid HTTP method', { method: req.method });
    return new Response("Method Not Allowed", { status: 405 });
  }

  // 2. Security verification
  // 2.1 Verify webhook authorization header (Bearer token)
  const authHeader = req.headers.get("Authorization");
  const expectedToken = process.env.REVENUECAT_WEBHOOK_SECRET;

  if (!expectedToken) {
    logger.error("REVENUECAT_WEBHOOK_SECRET not configured in environment variables");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn("Webhook authentication failed: missing or invalid Authorization header");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      {
        status: 401,
        headers: jsonHeaders,
      },
    );
  }

  const receivedToken = authHeader.substring(7); // Remove "Bearer " prefix
  if (receivedToken !== expectedToken) {
    logger.warn("Webhook authentication failed: token mismatch");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      {
        status: 401,
        headers: jsonHeaders,
      },
    );
  }

  logger.debug("Webhook authentication successful");

  // 3. Parse webhook payload
  let event: any;
  try {
    event = await req.json();
  } catch (error) {
    logger.error("Failed to parse webhook JSON payload", error);
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      {
        status: 400,
        headers: jsonHeaders,
      },
    );
  }

  // 4. Extract and validate webhook data
  const eventType = event.event?.type;
  const appUserId = event.event?.app_user_id;
  const productId = event.event?.product_id;
  const store = event.event?.store;

  // Add event context to logger
  const eventLogger = logger.child({
    eventType,
    userId: appUserId,
    productId,
    store,
  });

  eventLogger.info('Webhook payload parsed', {
    hasEntitlements: !!event.event?.entitlements,
    hasExpirationDate: !!event.event?.expiration_at_ms,
  });

  // 4.1 Validate required fields
  if (!appUserId || !productId) {
    eventLogger.warn("Webhook ignored: missing required fields", {
      hasUserId: !!appUserId,
      hasProductId: !!productId,
    });
    return new Response(
      JSON.stringify({ status: "ignored", reason: "Missing required fields" }),
      {
        status: 200,
        headers: jsonHeaders,
      },
    );
  }

  // 4.2 Validate user ID format (app_user_id should equal Convex users._id)
  if (!isValidConvexId(appUserId)) {
    eventLogger.error("Invalid user ID format", undefined, {
      userIdLength: appUserId.length,
      userIdPattern: /^[a-zA-Z0-9_-]+$/.test(appUserId),
    });
    return new Response(
      JSON.stringify({ status: "error", reason: "Invalid user ID format" }),
      {
        status: 400,
        headers: jsonHeaders,
      },
    );
  }

  eventLogger.debug("Webhook validation passed");

  // 5. Extract webhook event fields
  const expirationAtMs = event.event?.expiration_at_ms;
  const purchasedAtMs = event.event?.purchased_at_ms;
  const isTrialConversion = event.event?.is_trial_conversion;

  // 5.1 Fix entitlementIds extraction (CodeRabbit fix: use Object.keys for plain objects)
  const entitlements = (event.event?.entitlements ?? {}) as Record<string, unknown>;
  const entitlementIds = Object.keys(entitlements);

  eventLogger.debug("Webhook data extracted", {
    entitlementCount: entitlementIds.length,
    hasExpiration: !!expirationAtMs,
    isTrialConversion,
  });

  try {
    // 6. Process webhook - update subscription in database
    // Note: appUserId is validated as Id<"users"> by isValidConvexId() type guard above
    await ctx.runMutation(internal.revenueCatBilling.updateSubscriptionFromWebhook, {
      userId: appUserId, // Type-safe: validated by isValidConvexId()
      eventType,
      productId,
      store,
      expirationAtMs,
      purchasedAtMs,
      isTrialConversion,
      entitlementIds,
      rawEvent: event,
    });

    eventLogger.info("Webhook processed successfully");
  } catch (error) {
    eventLogger.error("Failed to process webhook mutation", error, {
      mutationName: 'updateSubscriptionFromWebhook',
    });
    return new Response(
      JSON.stringify({ error: "Failed to process webhook" }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }

  // 7. Return success response (idempotent processing)
  eventLogger.info("Webhook completed", {
    status: 'success',
    correlationId,
  });

  return new Response(
    JSON.stringify({ status: "ok", correlationId }),
    {
      status: 200,
      headers: jsonHeaders,
    },
  );
});

const http = httpRouter();

http.route({
  path: MUSIC_GENERATION_CALLBACK_PATH,
  method: "POST",
  handler: sunoMusicGenerationCallback,
});

http.route({
  path: CLERK_WEBHOOK_PATH,
  method: "POST",
  handler: clerkWebhookHandler,
});

http.route({
  path: REVENUECAT_WEBHOOK_PATH,
  method: "POST",
  handler: revenueCatWebhookHandler,
});

http.route({
  path: VAPI_WEBHOOK_PATH,
  method: "POST",
  handler: vapiWebhookHandler,
});

export default http;
