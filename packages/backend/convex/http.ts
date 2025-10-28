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


  const messageType = event.message?.type;
  const vapiCallId = event.call?.id || event.callId || event.id || event.message?.call?.id;

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
      const job = await ctx.runMutation(internal.callJobs.getCallJobByVapiId, {
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

      const endedAt = event.message.call?.endedAt || Date.now();
      const durationSeconds = event.message.call?.durationSeconds;
      const disposition = event.message.call?.disposition || "completed";
      
      // Store the complete artifact in metadata
      const artifact = event.message.artifact || {};

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

      console.log(`Call completed with transcript for job ${job._id}, VAPI call ID: ${vapiCallId}, duration: ${durationSeconds}s, ${JSON.parse(event)}`);
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
  
  if (eventType === "INITIAL_PURCHASE" || eventType === "RENEWAL" || eventType === "NON_RENEWING_PURCHASE") {
    const appUserId = event.event?.app_user_id; // This is the Convex user._id
    const productId = event.event?.product_id;
    const expiresAt = event.event?.expiration_at_ms;
    const store = event.event?.store; // e.g., "APP_STORE", "PLAY_STORE", "STRIPE", etc.

    if (!appUserId || !productId) {
      console.warn("RevenueCat webhook missing required fields", event);
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: jsonHeaders,
        },
      );
    }

    // Map RevenueCat store names to our platform enum
    const platform = getPlatformFromStore(store);

    try {
      // app_user_id is the Convex user._id (set via Purchases.logIn)
      await ctx.runMutation(internal.revenueCatBilling.syncRevenueCatSubscription, {
        userId: appUserId as any, // Cast to Id<"users"> - validated in mutation
        productId,
        status: "active",
        platform: platform as any,
        expiresAt: expiresAt ? parseInt(expiresAt) : undefined,
      });
    } catch (error) {
      console.error("Failed to sync RevenueCat subscription", error);
      return new Response(
        JSON.stringify({ error: "Failed to sync subscription" }),
        {
          status: 500,
          headers: jsonHeaders,
        },
      );
    }
  } else if (eventType === "CANCELLATION" || eventType === "EXPIRATION") {
    const appUserId = event.event?.app_user_id; // This is the Convex user._id
    const productId = event.event?.product_id;
    const store = event.event?.store;

    if (!appUserId || !productId) {
      console.warn("RevenueCat webhook missing required fields", event);
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: jsonHeaders,
        },
      );
    }

    // Map RevenueCat store names to our platform enum
    const platform = getPlatformFromStore(store);

    try {
      // app_user_id is the Convex user._id (set via Purchases.logIn)
      await ctx.runMutation(internal.revenueCatBilling.syncRevenueCatSubscription, {
        userId: appUserId as any, // Cast to Id<"users"> - validated in mutation
        productId,
        status: eventType === "CANCELLATION" ? "canceled" : "expired",
        platform: platform as any,
      });
    } catch (error) {
      console.error("Failed to sync RevenueCat subscription", error);
      return new Response(
        JSON.stringify({ error: "Failed to sync subscription" }),
        {
          status: 500,
          headers: jsonHeaders,
        },
      );
    }
  } else {
    console.log(`Ignoring RevenueCat webhook event type: ${eventType}`, event);
  }

  // 3. Return response
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
