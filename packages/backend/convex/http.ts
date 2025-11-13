/**
 * HTTP webhook entry point
 * Routes incoming HTTP requests to appropriate webhook handlers based on path
 */

import { httpRouter } from "convex/server";
import {
  MUSIC_GENERATION_CALLBACK_PATH,
  VIDEO_GENERATION_CALLBACK_PATH,
  CLERK_WEBHOOK_PATH,
  REVENUECAT_WEBHOOK_PATH,
  VAPI_WEBHOOK_PATH,
  VAPI_ASSISTANT_REQUEST_PATH,
  BLOG_API_PATH,
  BLOG_DRAFT_APPROVE_PATH,
  BLOG_DRAFT_DISMISS_PATH,
} from "./utils/constants";
import { sunoMusicGenerationCallback } from "./webhooks/handlers/suno";
import { kieVideoGenerationCallback } from "./webhooks/handlers/kie";
import { clerkWebhookHandler } from "./webhooks/handlers/clerk";
import { revenueCatWebhookHandler } from "./webhooks/handlers/revenuecat";
import { vapiWebhookHandler } from "./webhooks/handlers/vapi";
import { vapiAssistantRequestHandler } from "./webhooks/handlers/vapiAssistantRequest";
import { blogApiHandler } from "./webhooks/handlers/blogApi";
import { approveDraftHandler, dismissDraftHandler } from "./webhooks/handlers/blogDraftReview";

const http = httpRouter();

// Route: Suno music generation callback
http.route({
  path: MUSIC_GENERATION_CALLBACK_PATH,
  method: "POST",
  handler: sunoMusicGenerationCallback,
});

// Route: Kie.ai video generation callback
http.route({
  path: VIDEO_GENERATION_CALLBACK_PATH,
  method: "POST",
  handler: kieVideoGenerationCallback,
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

// Route: VAPI assistant-request (for inbound calls)
http.route({
  path: VAPI_ASSISTANT_REQUEST_PATH,
  method: "POST",
  handler: vapiAssistantRequestHandler,
});

// Route: Blog API (HMAC-authenticated)
http.route({
  path: BLOG_API_PATH,
  method: "POST",
  handler: blogApiHandler,
});

// Route: Blog draft approve (from Slack button)
http.route({
  path: BLOG_DRAFT_APPROVE_PATH,
  method: "GET",
  handler: approveDraftHandler,
});

// Route: Blog draft dismiss (from Slack button)
http.route({
  path: BLOG_DRAFT_DISMISS_PATH,
  method: "GET",
  handler: dismissDraftHandler,
});

export default http;
