/**
 * Blog draft review HTTP endpoints
 * Handles approve/dismiss actions from Slack buttons
 *
 * DEPENDENCY TREE:
 *
 * slackInteractiveHandler (main entry)
 * ├─ parseSlackPayload
 * ├─ validateButtonAction
 * ├─ parseButtonValue
 * ├─ handleApproveDraftAction
 * │  ├─ approveDraft (queries/mutations)
 * │  ├─ createAlreadyProcessedResponse
 * │  ├─ createEphemeralErrorResponse
 * │  ├─ extractUserMetadata
 * │  ├─ buildApprovedMessage
 * │  │  └─ escapeSlackMarkdown
 * │  └─ updateSlackMessage
 * └─ handleDismissDraftAction
 *    ├─ dismissDraft (queries/mutations)
 *    ├─ createAlreadyProcessedResponse
 *    ├─ createEphemeralErrorResponse
 *    ├─ extractUserMetadata
 *    ├─ buildDismissedMessage
 *    │  └─ escapeSlackMarkdown
 *    └─ updateSlackMessage
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
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
  HTTP_STATUS_OK,
} from "../../utils/constants/webhooks";
import { logWebhookEvent } from "../../utils/logger";
import { generateSlug } from "../../utils/blogHelpers";

// ============================================================================
// Type Definitions (exported for testing)
// ============================================================================

/**
 * Slack button text structure
 */
export interface SlackButtonText {
  type: "plain_text";
  text: string;
  emoji?: boolean;
}

/**
 * Slack button action structure
 * Received when a user clicks an interactive button
 */
export interface SlackButtonAction {
  type: "button";
  action_id: "approve_draft" | "dismiss_draft";
  block_id: string;
  text: SlackButtonText;
  value: string; // Format: "postId:token"
  style?: "primary" | "danger";
  action_ts: string; // Unix timestamp as string
}

/**
 * Slack user information
 */
export interface SlackUser {
  id: string;
  username: string;
  name: string;
  team_id: string;
}

/**
 * Slack team information
 */
export interface SlackTeam {
  id: string;
  domain: string;
}

/**
 * Slack channel information
 */
export interface SlackChannel {
  id: string;
  name: string;
}

/**
 * Slack message container information
 */
export interface SlackContainer {
  type: "message";
  message_ts: string;
  channel_id: string;
  is_ephemeral: boolean;
}

/**
 * Slack message structure in the payload
 */
export interface SlackMessage {
  type: "message";
  subtype?: "bot_message";
  text: string;
  ts: string;
  bot_id?: string;
  blocks?: any[]; // Block Kit blocks (complex structure)
}

/**
 * Slack interactive payload structure
 * Sent when a user interacts with buttons in a message
 *
 * This matches the actual structure received from Slack when
 * a user clicks approve or dismiss buttons.
 */
export interface SlackInteractivePayload {
  type: "block_actions"; // We only handle button interactions
  user: SlackUser;
  api_app_id: string;
  token: string; // Verification token (deprecated, use signing secret instead)
  container: SlackContainer;
  trigger_id: string; // Can be used to open modals
  team: SlackTeam;
  enterprise: null; // Enterprise Grid field (null for non-enterprise)
  is_enterprise_install: boolean;
  channel: SlackChannel;
  message: SlackMessage;
  state: {
    values: Record<string, any>; // For input fields (empty for button actions)
  };
  response_url: string; // URL for async responses (valid for 30 minutes)
  actions: SlackButtonAction[]; // Array of actions (we expect exactly 1 button click)
}

/**
 * Parsed button value containing post identification
 * Format: "postId:token"
 */
export interface ButtonValue {
  postId: string;
  token: string;
}

/**
 * Escape Slack markdown special characters
 * Exported for testing
 */
export const escapeSlackMarkdown = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*/g, "\\*")  // Escape bold
    .replace(/_/g, "\\_")   // Escape italic
    .replace(/~/g, "\\~")   // Escape strikethrough
    .replace(/`/g, "\\`")   // Escape code
    .replace(/\[/g, "\\[")  // Escape link opening
    .replace(/\]/g, "\\]"); // Escape link closing
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
  // First, verify token matches the draft
  const post = await ctx.runQuery(api.blog.getDraftByPreviewToken, {
    previewToken: token,
  });

  if (!post) {
    // Check if post exists by ID to provide better error message
    const postById = await ctx.runQuery(internal.blog.getPostStatusById, {
      postId: postId as any,
    });

    if (!postById) {
      logger.warn("Post not found", { postId, token });
      return { success: false, error: "Post not found. It may have been deleted." };
    }

    if (postById.status === "published") {
      logger.warn("Post already published", { postId, token, status: postById.status });
      return { success: false, error: "This draft has already been published." };
    }

    if (postById.status === "archived") {
      logger.warn("Post is archived", { postId, token, status: postById.status });
      return { success: false, error: "This post is archived and cannot be approved." };
    }

    // Post exists but token doesn't match or token was cleared
    logger.warn("Draft token mismatch or invalid", { postId, token, status: postById.status });
    return { success: false, error: "Invalid preview token. The draft may have been updated." };
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
  try {
    await ctx.runMutation(internal.blog.approveDraft, {
      postId: post._id,
      slug,
    });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to approve draft mutation", error, {
      postId: post._id,
      slug,
    });
    return { success: false, error: errorMessage };
  }

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
  try {
    await ctx.runMutation(internal.blog.dismissDraft, {
      postId: post._id,
    });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Failed to dismiss draft mutation", error, {
      postId: post._id,
    });
    return { success: false, error: errorMessage };
  }

  logWebhookEvent(logger, "blogDraftReview", "processed", {
    action: "dismissed",
    postId: post._id,
  });

  return { success: true, post };
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse and validate Slack form data payload
 * Returns parsed payload or null if invalid
 */
const parseSlackPayload = (formData: FormData, logger: any): SlackInteractivePayload | null => {
  // Type assertion for compatibility: FormData.get() exists in Web API but mobile TS may not recognize it
  const payloadStr = (formData as unknown as { get: (key: string) => string | null }).get("payload");

  if (!payloadStr) {
    logger.warn("Missing payload in form data");
    return null;
  }

  try {
    const payload = JSON.parse(payloadStr) as SlackInteractivePayload;
    return payload;
  } catch (error) {
    logger.error("Failed to parse payload JSON", error);
    return null;
  }
};

/**
 * Validate that the payload is a button action
 * Returns the action object or null if invalid
 * Exported for testing
 */
export const validateButtonAction = (payload: SlackInteractivePayload, logger: any): SlackButtonAction | null => {
  // Verify this is a button click (not a different interactive component)
  if (payload.type !== "block_actions") {
    logger.warn("Ignoring non-button interaction", { type: payload.type });
    return null;
  }

  const action = payload.actions?.[0];
  if (!action || action.type !== "button") {
    logger.warn("Invalid action in payload", { action });
    return null;
  }

  return action;
};

/**
 * Extract postId and token from button value
 * Format: "postId:token" (must contain exactly one colon)
 * Returns { postId, token } or null if invalid
 * Exported for testing
 */
export const parseButtonValue = (buttonValue: string, logger: any): ButtonValue | null => {
  // Verify the string contains exactly one colon
  const colonCount = (buttonValue.match(/:/g) || []).length;
  if (colonCount !== 1) {
    logger.warn("Invalid button value format - must contain exactly one colon", { buttonValue, colonCount });
    return null;
  }

  // Split with limit of 2 and verify we get exactly 2 parts, both non-empty
  const parts = buttonValue.split(":", 2);
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    logger.warn("Invalid button value format - missing postId or token", { buttonValue, partsLength: parts.length });
    return null;
  }

  return { postId: parts[0], token: parts[1] };
};

/**
 * Create a Slack response for already-processed errors
 * Updates the message to show the draft has already been handled
 */
const createAlreadyProcessedResponse = (error: string) => {
  return new Response(
    JSON.stringify({
      response_type: "in_channel",
      replace_original: true,
      text: `⚠️ Draft Already Processed: ${error}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `⚠️ *Draft Already Processed*\n\n${error}`,
          },
        },
      ],
    }),
    {
      status: HTTP_STATUS_OK,
      headers: { "Content-Type": "application/json" },
    }
  );
};

/**
 * Create a Slack ephemeral error response
 * Shows an error message only to the user who clicked
 */
const createEphemeralErrorResponse = (error: string) => {
  return new Response(
    JSON.stringify({
      response_type: "ephemeral",
      text: `❌ ${error}`,
    }),
    {
      status: HTTP_STATUS_OK,
      headers: { "Content-Type": "application/json" },
    }
  );
};

/**
 * Extract user info and timestamp from payload
 * Returns formatted user ID and timestamp for display
 * Exported for testing
 */
export const extractUserMetadata = (payload: SlackInteractivePayload) => {
  const userId = payload.user?.id || payload.user?.name || "someone";
  const timestamp = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return { userId, timestamp };
};

/**
 * Build Slack message for approved draft
 * Creates a formatted message showing the draft was published
 */
const buildApprovedMessage = (post: any, slug: string, userId: string, timestamp: string, payload: SlackInteractivePayload) => {
  const frontendBaseUrl = process.env.SHARE_BASE_URL || "http://localhost:5173";
  const publishedPostUrl = `${frontendBaseUrl}/blog/${slug}`;
  const safeTitle = escapeSlackMarkdown(post.title);
  const safeUrl = escapeSlackMarkdown(publishedPostUrl);

  // Check if original message had [dev] prefix by examining the header block
  const originalHeader = payload.message?.blocks?.find((block: any) => block.type === "header");
  const isDev = originalHeader?.text?.text?.includes("[dev]") ?? false;
  const devPrefix = isDev ? "[dev] " : "";

  return {
    response_type: "in_channel",
    replace_original: true,
    text: `${devPrefix}✅ Blog Draft Approved & Published: ${safeTitle}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${devPrefix}✅ Blog Draft Approved & Published`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${safeTitle}*\n\nThe blog post has been published and is now live.\n\n<${safeUrl}|👀 View Published Post>`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Approved by <@${userId}> • ${timestamp}`,
          },
        ],
      },
    ],
  };
};

/**
 * Build Slack message for dismissed draft
 * Creates a formatted message showing the draft was deleted
 */
const buildDismissedMessage = (post: any, userId: string, timestamp: string, payload: SlackInteractivePayload) => {
  const safeTitle = escapeSlackMarkdown(post.title);

  // Check if original message had [dev] prefix by examining the header block
  const originalHeader = payload.message?.blocks?.find((block: any) => block.type === "header");
  const isDev = originalHeader?.text?.text?.includes("[dev]") ?? false;
  const devPrefix = isDev ? "[dev] " : "";

  return {
    response_type: "in_channel",
    replace_original: true,
    text: `${devPrefix}❌ Blog Draft Dismissed: ${safeTitle}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${devPrefix}❌ Blog Draft Dismissed`,
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
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Dismissed by <@${userId}> • ${timestamp}`,
          },
        ],
      },
    ],
  };
};

/**
 * Update Slack message asynchronously using response_url
 * Slack provides response_url for async updates after the 3-second timeout
 */
const updateSlackMessage = async (
  ctx: any,
  responseUrl: string | undefined,
  message: any,
  logger: any,
  context: { postId: string; slug?: string }
) => {
  if (responseUrl) {
    try {
      await ctx.runAction(internal.utils.slack.updateSlackMessage, {
        responseUrl,
        message,
      });
    } catch (err) {
      logger.error("Failed to update Slack message via response_url", err, context);
    }
  } else {
    logger.info("No response_url provided, relying on synchronous response", context);
  }
};

/**
 * Handle approve draft action
 * Processes the approval, builds response, and updates Slack message
 */
const handleApproveDraftAction = async (
  ctx: any,
  postId: string,
  token: string,
  payload: SlackInteractivePayload,
  responseUrl: string | undefined,
  logger: any
) => {
  // Execute approval mutation
  const result = await approveDraft(ctx, postId, token, logger);

  // Handle failure cases
  if (!result.success) {
    logger.error("Failed to approve draft", undefined, { postId, error: result.error });

    // Check if draft was already processed (idempotency)
    if (result.error?.includes("already been published") || result.error?.includes("not found")) {
      return createAlreadyProcessedResponse(result.error);
    }

    // Show ephemeral error for other failures
    return createEphemeralErrorResponse(`Failed to approve draft: ${result.error || "Unknown error"}`);
  }

  // Build success response
  const { post, slug } = result;
  const { userId, timestamp } = extractUserMetadata(payload);
  const updatedMessage = buildApprovedMessage(post!, slug!, userId, timestamp, payload);

  // Update Slack message (async if possible)
  await updateSlackMessage(ctx, responseUrl, updatedMessage, logger, { postId, slug });

  // Return synchronous response
  return new Response(JSON.stringify(updatedMessage), {
    status: HTTP_STATUS_OK,
    headers: { "Content-Type": "application/json" },
  });
};

/**
 * Handle dismiss draft action
 * Processes the dismissal, builds response, and updates Slack message
 */
const handleDismissDraftAction = async (
  ctx: any,
  postId: string,
  token: string,
  payload: SlackInteractivePayload,
  responseUrl: string | undefined,
  logger: any
) => {
  // Execute dismissal mutation
  const result = await dismissDraft(ctx, postId, token, logger);

  // Handle failure cases
  if (!result.success) {
    logger.error("Failed to dismiss draft", undefined, { postId, error: result.error });

    // Check if draft was already processed (idempotency)
    if (result.error?.includes("not found") || result.error?.includes("already")) {
      return createAlreadyProcessedResponse(result.error);
    }

    // Show ephemeral error for other failures
    return createEphemeralErrorResponse(`Failed to dismiss draft: ${result.error || "Unknown error"}`);
  }

  // Build success response
  const { post } = result;
  const { userId, timestamp } = extractUserMetadata(payload);
  const updatedMessage = buildDismissedMessage(post!, userId, timestamp, payload);

  // Update Slack message (async if possible)
  await updateSlackMessage(ctx, responseUrl, updatedMessage, logger, { postId });

  // Return synchronous response
  return new Response(JSON.stringify(updatedMessage), {
    status: HTTP_STATUS_OK,
    headers: { "Content-Type": "application/json" },
  });
};

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Handle Slack interactive button clicks
 * POST /webhooks/slack/interactive
 *
 * This endpoint processes Slack button interactions for blog draft review.
 *
 * Flow:
 * 1. Validate HTTP method and parse payload
 * 2. Validate button action and extract identifiers
 * 3. Route to appropriate handler (approve/dismiss)
 * 4. Execute action and update Slack message
 * 5. Return success/error response
 */
export const slackInteractiveHandler = httpAction(async (ctx, request) => {
  const logger = createWebhookLogger("slackInteractiveHandler");
  logger.startTimer();

  // Step 1: Validate HTTP method
  const methodError = validateHttpMethod(request, "POST");
  if (methodError) {
    logger.warn("Invalid HTTP method", { method: request.method });
    return methodError;
  }

  try {
    // Step 2: Parse and validate Slack payload
    const formData = await request.formData();
    const payload = parseSlackPayload(formData as unknown as FormData, logger);
    if (!payload) {
      return errorResponse("Missing or invalid payload", HTTP_STATUS_BAD_REQUEST);
    }

    // Step 3: Validate button action
    const action = validateButtonAction(payload, logger);
    if (!action) {
      return action === null && payload.type !== "block_actions"
        ? successResponse({ message: "Interaction type not supported" })
        : errorResponse("Invalid action", HTTP_STATUS_BAD_REQUEST);
    }

    // Step 4: Extract and validate button value (postId:token)
    const buttonData = parseButtonValue(action.value as string, logger);
    if (!buttonData) {
      return errorResponse("Invalid button value", HTTP_STATUS_BAD_REQUEST);
    }

    const { postId, token } = buttonData;
    const actionId = action.action_id;
    const responseUrl = payload.response_url;

    // Step 5: Route to appropriate action handler
    if (actionId === "approve_draft") {
      return await handleApproveDraftAction(ctx, postId, token, payload, responseUrl, logger);
    } else if (actionId === "dismiss_draft") {
      return await handleDismissDraftAction(ctx, postId, token, payload, responseUrl, logger);
    } else {
      logger.warn("Unknown action_id", { actionId });
      return errorResponse("Unknown action", HTTP_STATUS_BAD_REQUEST);
    }

  } catch (error: any) {
    // Step 6: Handle unexpected errors
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

