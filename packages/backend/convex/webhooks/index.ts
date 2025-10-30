/**
 * Webhook router and entry point
 * Routes incoming HTTP requests to appropriate webhook handlers based on path
 */

import { httpRouter } from "convex/server";
import {
  MUSIC_GENERATION_CALLBACK_PATH,
  CLERK_WEBHOOK_PATH,
  REVENUECAT_WEBHOOK_PATH,
  VAPI_WEBHOOK_PATH,
} from "../utils/constants";
import { sunoMusicGenerationCallback } from "./handlers/suno";
import { clerkWebhookHandler } from "./handlers/clerk";
import { revenueCatWebhookHandler } from "./handlers/revenuecat";
import { vapiWebhookHandler } from "./handlers/vapi";

const http = httpRouter();

// Route: Suno music generation callback
http.route({
  path: MUSIC_GENERATION_CALLBACK_PATH,
  method: "POST",
  handler: sunoMusicGenerationCallback,
});

// Route: Clerk user creation webhook
http.route({
  path: CLERK_WEBHOOK_PATH,
  method: "POST",
  handler: clerkWebhookHandler,
});

// Route: RevenueCat subscription webhook
http.route({
  path: REVENUECAT_WEBHOOK_PATH,
  method: "POST",
  handler: revenueCatWebhookHandler,
});

// Route: VAPI call events webhook
http.route({
  path: VAPI_WEBHOOK_PATH,
  method: "POST",
  handler: vapiWebhookHandler,
});

export default http;

