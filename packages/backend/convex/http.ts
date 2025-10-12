import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { MUSIC_GENERATION_CALLBACK_PATH, CLERK_WEBHOOK_PATH } from "./constant";
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
    // 4.1 Create user record with alpha-user tag
    const { userId } = await ctx.runMutation(internal.users.createUser, {
      clerkId: userData.id,
      email: primaryEmail || undefined,
      name: fullName || userData.username || undefined,
      tags: ["alpha-user"],
    });

    // 4.2 Provision alpha subscription
    await ctx.runMutation(internal.billing.createAlphaSubscription, {
      userId,
    });

    console.log(`Successfully created alpha user with subscription for Clerk ID: ${userData.id}`);
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

export default http;
