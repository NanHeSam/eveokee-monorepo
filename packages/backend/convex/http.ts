import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { MUSIC_GENERATION_CALLBACK_PATH, CLERK_WEBHOOK_PATH, REVENUECAT_WEBHOOK_PATH, VAPI_WEBHOOK_PATH } from "./constant";
import { verifyWebhook } from "@clerk/backend/webhooks";

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

// Map RevenueCat store names to our platform enum
const getPlatformFromStore = (store: string | undefined): string | undefined => {
  const platformMap: Record<string, string> = {
    "APP_STORE": "app_store",
    "PLAY_STORE": "play_store",
    "STRIPE": "stripe",
    "AMAZON": "amazon",
    "MAC_APP_STORE": "mac_app_store",
    "PROMOTIONAL": "promotional",
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
  // 1. Validate request
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let event: any;
  try {
    event = await req.json();
  } catch (error) {
    console.error("Failed to parse RevenueCat webhook JSON", error);
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      {
        status: 400,
        headers: jsonHeaders,
      },
    );
  }

  const eventType = event.event?.type;
  
  // Handle all RC webhook event types
  const appUserId = event.event?.app_user_id;
  const productId = event.event?.product_id;
  
  if (!appUserId || !productId) {
    console.warn("RevenueCat webhook missing required fields", event);
    return new Response(
      JSON.stringify({ status: "ignored", reason: "Missing required fields" }),
      {
        status: 200,
        headers: jsonHeaders,
      },
    );
  }

  // Extract webhook event fields
  const expirationAtMs = event.event?.expiration_at_ms;
  const purchasedAtMs = event.event?.purchased_at_ms;
  const store = event.event?.store;
  const isTrialConversion = event.event?.is_trial_conversion;
  const entitlements = event.event?.entitlements || {};
  const entitlementIds = entitlements.keys ? Object.keys(entitlements) : [];

  try {
    // Use the new webhook handler that updates snapshot and logs conditionally
    await ctx.runMutation(internal.revenueCatBilling.updateSubscriptionFromWebhook, {
      userId: appUserId as any,
      eventType,
      productId,
      store,
      expirationAtMs,
      purchasedAtMs,
      isTrialConversion,
      entitlementIds,
      rawEvent: event,
    });
  } catch (error) {
    console.error("Failed to process RevenueCat webhook", error);
    return new Response(
      JSON.stringify({ error: "Failed to process webhook" }),
      {
        status: 500,
        headers: jsonHeaders,
      },
    );
  }

  // Always return success (idempotent processing)
  return new Response(
    JSON.stringify({ status: "ok" }),
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
