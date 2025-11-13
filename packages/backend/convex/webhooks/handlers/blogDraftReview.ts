/**
 * Blog draft review HTTP endpoints
 * Handles approve/dismiss actions from Slack buttons
 */

import { httpAction } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import {
  createWebhookLogger,
  errorResponse,
  successResponse,
  validateHttpMethod,
} from "../shared";
import {
  HTTP_STATUS_BAD_REQUEST,
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
} from "../../utils/constants/webhooks";
import { logWebhookEvent } from "../../utils/logger";
import { generateSlug } from "../../utils/blogHelpers";

/**
 * Escape HTML special characters to prevent XSS attacks
 */
const escapeHtml = (value: string): string => {
  const htmlEscapeMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (char) => htmlEscapeMap[char]!);
};

/**
 * Approve a draft post (publish it)
 * GET /api/blog/draft/approve?postId=...&token=...
 */
export const approveDraftHandler = httpAction(async (ctx, request) => {
  const logger = createWebhookLogger("approveDraftHandler");
  logger.startTimer();

  // Validate HTTP method
  const methodError = validateHttpMethod(request, "GET");
  if (methodError) {
    logger.warn("Invalid HTTP method", { method: request.method });
    return methodError;
  }

  // Parse query parameters
  const url = new URL(request.url);
  const postId = url.searchParams.get("postId");
  const token = url.searchParams.get("token");

  if (!postId || !token) {
    logger.warn("Missing required parameters", { hasPostId: !!postId, hasToken: !!token });
    return errorResponse("Missing postId or token parameter", HTTP_STATUS_BAD_REQUEST);
  }

  try {
    // Verify token matches the draft
    const post = await ctx.runQuery(api.blog.getDraftByPreviewToken, {
      previewToken: token,
    });

    if (!post) {
      logger.warn("Draft not found or invalid token", { postId, token });
      return errorResponse("Draft not found or invalid token", HTTP_STATUS_NOT_FOUND);
    }

    if (post._id !== postId) {
      logger.warn("Post ID mismatch", { providedPostId: postId, tokenPostId: post._id });
      return errorResponse("Post ID mismatch", HTTP_STATUS_BAD_REQUEST);
    }

    // Generate slug from title if not already set
    const slug = post.slug || generateSlug(post.title);

    if (!slug) {
      logger.warn("Generated slug is empty", { postId: post._id, title: post.title });
      return errorResponse("Unable to generate valid slug from title", HTTP_STATUS_BAD_REQUEST);
    }

    // Approve (publish) the draft
    await ctx.runMutation(internal.blog.approveDraft, {
      postId: post._id,
      slug,
    });

    logWebhookEvent(logger, "blogDraftReview", "processed", {
      action: "approved",
      postId: post._id,
      slug,
    });

    // Get frontend base URL for the published post link
    const frontendBaseUrl = process.env.SHARE_BASE_URL || "http://localhost:5173";
    const publishedPostUrl = `${frontendBaseUrl}/blog/${slug}`;

    // Escape HTML to prevent XSS
    const safeTitle = escapeHtml(post.title);
    const safePublishedPostUrl = escapeHtml(publishedPostUrl);

    // Return HTML response for Slack button click
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <title>Draft Approved</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <div style="font-family: sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
    <h1>✅ Draft Approved</h1>
    <p>The blog post "<strong>${safeTitle}</strong>" has been published.</p>
    <p><a href="${safePublishedPostUrl}">View Published Post</a></p>
  </div>
</body>
</html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  } catch (error: any) {
    logger.error("Failed to approve draft", error, { postId, token });
    logWebhookEvent(logger, "blogDraftReview", "failed", {
      action: "approve",
      error: error.message || "Failed to approve draft",
    });
    return errorResponse(
      error.message || "Failed to approve draft",
      HTTP_STATUS_INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * Dismiss a draft post (delete it)
 * GET /api/blog/draft/dismiss?postId=...&token=...
 */
export const dismissDraftHandler = httpAction(async (ctx, request) => {
  const logger = createWebhookLogger("dismissDraftHandler");
  logger.startTimer();

  // Validate HTTP method
  const methodError = validateHttpMethod(request, "GET");
  if (methodError) {
    logger.warn("Invalid HTTP method", { method: request.method });
    return methodError;
  }

  // Parse query parameters
  const url = new URL(request.url);
  const postId = url.searchParams.get("postId");
  const token = url.searchParams.get("token");

  if (!postId || !token) {
    logger.warn("Missing required parameters", { hasPostId: !!postId, hasToken: !!token });
    return errorResponse("Missing postId or token parameter", HTTP_STATUS_BAD_REQUEST);
  }

  try {
    // Verify token matches the draft
    const post = await ctx.runQuery(api.blog.getDraftByPreviewToken, {
      previewToken: token,
    });

    if (!post) {
      logger.warn("Draft not found or invalid token", { postId, token });
      return errorResponse("Draft not found or invalid token", HTTP_STATUS_NOT_FOUND);
    }

    if (post._id !== postId) {
      logger.warn("Post ID mismatch", { providedPostId: postId, tokenPostId: post._id });
      return errorResponse("Post ID mismatch", HTTP_STATUS_BAD_REQUEST);
    }

    // Dismiss (delete) the draft
    await ctx.runMutation(internal.blog.dismissDraft, {
      postId: post._id,
    });

    logWebhookEvent(logger, "blogDraftReview", "processed", {
      action: "dismissed",
      postId: post._id,
    });

    // Escape HTML to prevent XSS
    const safeTitle = escapeHtml(post.title);

    // Return HTML response for Slack button click
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <title>Draft Dismissed</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <div style="font-family: sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
    <h1>❌ Draft Dismissed</h1>
    <p>The blog post "<strong>${safeTitle}</strong>" has been deleted.</p>
  </div>
</body>
</html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  } catch (error: any) {
    logger.error("Failed to dismiss draft", error, { postId, token });
    logWebhookEvent(logger, "blogDraftReview", "failed", {
      action: "dismiss",
      error: error.message || "Failed to dismiss draft",
    });
    return errorResponse(
      error.message || "Failed to dismiss draft",
      HTTP_STATUS_INTERNAL_SERVER_ERROR
    );
  }
});

