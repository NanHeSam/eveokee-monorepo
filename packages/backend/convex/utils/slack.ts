"use node";

/**
 * Slack notification utilities
 * Sends messages to Slack via webhook URL
 */

import { action } from "../_generated/server";
import { v } from "convex/values";

/**
 * Send a Slack message via webhook
 */
export const sendSlackMessage = action({
  args: {
    text: v.string(),
    blocks: v.optional(v.array(v.any())),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error("SLACK_WEBHOOK_URL environment variable not set");
      return { success: false, error: "SLACK_WEBHOOK_URL not configured" };
    }

    try {
      const payload: any = {
        text: args.text,
      };

      if (args.blocks && args.blocks.length > 0) {
        payload.blocks = args.blocks;
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Slack webhook error:", errorText);
        return {
          success: false,
          error: `Slack API error: ${response.status} ${errorText}`,
        };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send Slack message:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Send a Slack notification for a new blog draft awaiting review
 */
export const sendDraftReviewNotification = action({
  args: {
    postId: v.id("blogPosts"),
    title: v.string(),
    previewUrl: v.string(),
    approveUrl: v.string(),
    dismissUrl: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error("SLACK_WEBHOOK_URL environment variable not set");
      return { success: false, error: "SLACK_WEBHOOK_URL not configured" };
    }

    try {
      const blocks = [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "📝 New Blog Draft Ready for Review",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${args.title}*\n\nA new blog post draft from RankPill is ready for your review.`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `<${args.previewUrl}|👀 Preview Draft>`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "✅ Approve & Publish",
                emoji: true,
              },
              style: "primary",
              url: args.approveUrl,
            },
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "❌ Dismiss",
                emoji: true,
              },
              style: "danger",
              url: args.dismissUrl,
            },
          ],
        },
      ];

      const payload = {
        text: `New blog draft ready for review: ${args.title}`,
        blocks,
      };

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Slack webhook error:", errorText);
        return {
          success: false,
          error: `Slack API error: ${response.status} ${errorText}`,
        };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send Slack notification:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

