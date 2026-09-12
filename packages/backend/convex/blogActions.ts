"use node";

/**
 * Blog-related actions that require Node.js APIs
 * Includes AI-powered tag extraction using OpenAI
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { getOpenAIClient } from "./integrations/openai/client";

/**
 * Extract relevant tags from blog post content using AI
 * Analyzes the title and content to identify 3-5 relevant tags
 * Falls back to a default tag if extraction fails
 */
export const extractTagsFromContent = action({
  args: {
    title: v.string(),
    content: v.string(),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    try {
      const openai = getOpenAIClient();
      const tags = await openai.extractTags({
        title: args.title,
        content: args.content,
        analytics: {
          traceId: `blog-${Date.now()}`,
          properties: {
            source: "blog.extractTags",
          },
        },
      });

      // Ensure we return at least one tag
      return tags.length > 0 ? tags : ["AI"];
    } catch (error) {
      // Log error but don't fail - return default tag instead
      console.error("Failed to extract tags with AI:", error instanceof Error ? error.message : String(error));
      return ["AI"];
    }
  },
});
