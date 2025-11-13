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
  HTTP_STATUS_OK,
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
 * Escape Slack markdown special characters
 */
const escapeSlackMarkdown = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

/**
 * Shared logic to approve a draft
 */
const approveDraft = async (
  ctx: any,
  postId: string,
  token: string,
  logger: any
): Promise<{ success: boolean; post?: any; slug?: string; error?: string }> => {
  // Verify token matches the draft
  const post = await ctx.runQuery(api.blog.getDraftByPreviewToken, {
    previewToken: token,
  });

  if (!post) {
    logger.warn("Draft not found or invalid token", { postId, token });
    return { success: false, error: "Draft not found or invalid token" };
  }

  if (post._id !== postId) {
    logger.warn("Post ID mismatch", { providedPostId: postId, tokenPostId: post._id });
    return { success: false, error: "Post ID mismatch" };
  }

  const slug = post.slug || generateSlug(post.title);

  if (!slug) {
    logger.warn("Generated slug is empty", { postId: post._id, title: post.title });
    return { success: false, error: "Unable to generate valid slug from title" };
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

  return { success: true, post, slug };
};

/**
 * Shared logic to dismiss a draft
 */
const dismissDraft = async (
  ctx: any,
  postId: string,
  token: string,
  logger: any
): Promise<{ success: boolean; post?: any; error?: string }> => {
  // Verify token matches the draft
  const post = await ctx.runQuery(api.blog.getDraftByPreviewToken, {
    previewToken: token,
  });

  if (!post) {
    logger.warn("Draft not found or invalid token", { postId, token });
    return { success: false, error: "Draft not found or invalid token" };
  }

  if (post._id !== postId) {
    logger.warn("Post ID mismatch", { providedPostId: postId, tokenPostId: post._id });
    return { success: false, error: "Post ID mismatch" };
  }

  // Dismiss (delete) the draft
  await ctx.runMutation(internal.blog.dismissDraft, {
    postId: post._id,
  });

  logWebhookEvent(logger, "blogDraftReview", "processed", {
    action: "dismissed",
    postId: post._id,
  });

  return { success: true, post };
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
    const result = await approveDraft(ctx, postId, token, logger);

    if (!result.success) {
      if (result.error === "Draft not found or invalid token") {
        return errorResponse(result.error, HTTP_STATUS_NOT_FOUND);
      }
      return errorResponse(result.error || "Failed to approve draft", HTTP_STATUS_BAD_REQUEST);
    }

    const { post, slug } = result;

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
    const result = await dismissDraft(ctx, postId, token, logger);

    if (!result.success) {
      if (result.error === "Draft not found or invalid token") {
        return errorResponse(result.error, HTTP_STATUS_NOT_FOUND);
      }
      return errorResponse(result.error || "Failed to dismiss draft", HTTP_STATUS_BAD_REQUEST);
    }

    const { post } = result;

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

/**
 * Handle Slack interactive button clicks
 * POST /webhooks/slack/interactive
 * This endpoint receives interactive payloads from Slack when buttons are clicked
 */
export const slackInteractiveHandler = httpAction(async (ctx, request) => {
  const logger = createWebhookLogger("slackInteractiveHandler");
  logger.startTimer();

  // Validate HTTP method
  const methodError = validateHttpMethod(request, "POST");
  if (methodError) {
    logger.warn("Invalid HTTP method", { method: request.method });
    return methodError;
  }

  try {
    // Slack sends interactive payloads as form-encoded data
    const formData = await request.formData();
    const payloadStr = formData.get("payload") as string;

    if (!payloadStr) {
      logger.warn("Missing payload in form data");
      return errorResponse("Missing payload", HTTP_STATUS_BAD_REQUEST);
    }

    const payload = JSON.parse(payloadStr);

    // Verify this is a button click (not a different interactive component)
    if (payload.type !== "block_actions") {
      logger.info("Ignoring non-button interaction", { type: payload.type });
      return successResponse({ message: "Interaction type not supported" });
    }

    const action = payload.actions?.[0];
    if (!action || action.type !== "button") {
      logger.warn("Invalid action in payload", { action });
      return errorResponse("Invalid action", HTTP_STATUS_BAD_REQUEST);
    }

    // Extract postId and token from button value
    // Format: "postId:token"
    const buttonValue = action.value as string;
    const [postId, token] = buttonValue.split(":");

    if (!postId || !token) {
      logger.warn("Invalid button value format", { buttonValue });
      return errorResponse("Invalid button value", HTTP_STATUS_BAD_REQUEST);
    }

    const actionId = action.action_id;

    // Process the action based on action_id
    if (actionId === "approve_draft") {
      const result = await approveDraft(ctx, postId, token, logger);

      if (!result.success) {
        logger.error("Failed to approve draft", { postId, error: result.error });
        return new Response(
          JSON.stringify({
            response_type: "ephemeral",
            text: `❌ Failed to approve draft: ${result.error || "Unknown error"}`,
          }),
          {
            status: HTTP_STATUS_OK,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const { post, slug } = result;
      const frontendBaseUrl = process.env.SHARE_BASE_URL || "http://localhost:5173";
      const publishedPostUrl = `${frontendBaseUrl}/blog/${slug}`;
      const safeTitle = escapeSlackMarkdown(post.title);
      const safeUrl = escapeSlackMarkdown(publishedPostUrl);

      // Return updated message blocks
      return new Response(
        JSON.stringify({
          response_type: "in_channel",
          replace_original: true,
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "✅ Blog Draft Approved & Published",
                emoji: true,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${safeTitle}*\n\nThe blog post has been published and is now live.`,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `<${safeUrl}|👀 View Published Post>`,
              },
            },
          ],
        }),
        {
          status: HTTP_STATUS_OK,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else if (actionId === "dismiss_draft") {
      const result = await dismissDraft(ctx, postId, token, logger);

      if (!result.success) {
        logger.error("Failed to dismiss draft", { postId, error: result.error });
        return new Response(
          JSON.stringify({
            response_type: "ephemeral",
            text: `❌ Failed to dismiss draft: ${result.error || "Unknown error"}`,
          }),
          {
            status: HTTP_STATUS_OK,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const { post } = result;
      const safeTitle = escapeSlackMarkdown(post.title);

      // Return updated message blocks
      return new Response(
        JSON.stringify({
          response_type: "in_channel",
          replace_original: true,
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "❌ Blog Draft Dismissed",
                emoji: true,
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*${safeTitle}*\n\nThe blog draft has been dismissed and deleted.`,
              },
            },
          ],
        }),
        {
          status: HTTP_STATUS_OK,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      logger.warn("Unknown action_id", { actionId });
      return errorResponse("Unknown action", HTTP_STATUS_BAD_REQUEST);
    }
  } catch (error: any) {
    logger.error("Failed to process Slack interactive payload", error);
    logWebhookEvent(logger, "blogDraftReview", "failed", {
      action: "slack_interactive",
      error: error.message || "Failed to process interactive payload",
    });
    return errorResponse(
      error.message || "Failed to process interactive payload",
      HTTP_STATUS_INTERNAL_SERVER_ERROR
    );
  }
});

