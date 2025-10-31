"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  MAX_TRANSCRIPT_LENGTH,
} from "./utils/constants";
import { createOpenAIClientFromEnv } from "./integrations/openai/client";

/**
 * Generate a diary entry from call transcript and trigger music generation
 * This is triggered after a call ends via the VAPI webhook
 */
export const generateDiaryFromCall = internalAction({
  args: {
    userId: v.id("users"),
    callSessionId: v.id("callSessions"),
    endedAt: v.optional(v.number()),
    transcript: v.optional(v.string()),
    messages: v.optional(v.any()),
  },
  returns: v.object({
    success: v.boolean(),
    diaryId: v.optional(v.id("diaries")),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Create OpenAI client for generating diary content
    let openaiClient;
    try {
      openaiClient = createOpenAIClientFromEnv({
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        OPENAI_TIMEOUT: process.env.OPENAI_TIMEOUT,
      });
    } catch (error) {
      console.error("Failed to create OpenAI client:", error);
      await ctx.runMutation(internal.callJobs.updateCallSessionMetadata, {
        callSessionId: args.callSessionId,
        metadata: { diaryError: "OPENAI_API_KEY not configured" },
      });
      return {
        success: false,
        error: "OPENAI_API_KEY not configured",
      };
    }

    let transcriptText = args.transcript || "";
    
    if (!transcriptText && args.messages) {
      try {
        if (Array.isArray(args.messages)) {
          transcriptText = args.messages
            .filter((msg: any) => {
              if (!msg || typeof msg !== "object") return false;
              const hasUserRole = msg.role === "user" || msg.role === "assistant";
              const content = msg.content;
              if (typeof content === "string") return hasUserRole && content;
              if (Array.isArray(content)) {
                return hasUserRole && content.some((c: any) => 
                  typeof c === "object" && c.type === "text" && c.text
                );
              }
              return false;
            })
            .map((msg: any) => {
              const content = msg.content;
              if (typeof content === "string") return content;
              if (Array.isArray(content)) {
                return content
                  .filter((c: any) => typeof c === "object" && c.type === "text")
                  .map((c: any) => c.text)
                  .join(" ");
              }
              return "";
            })
            .filter((text: string) => text.trim().length > 0)
            .join("\n");
        }
      } catch (error) {
        console.error("Failed to extract transcript from messages:", error);
      }
    }

    if (!transcriptText || transcriptText.trim().length === 0) {
      console.warn("No transcript available for diary generation");
      await ctx.runMutation(internal.callJobs.updateCallSessionMetadata, {
        callSessionId: args.callSessionId,
        metadata: { diaryError: "No transcript available" },
      });
      return {
        success: false,
        error: "No transcript available",
      };
    }

    if (transcriptText.length > MAX_TRANSCRIPT_LENGTH) {
      console.warn(`Transcript too long (${transcriptText.length} chars), truncating to ${MAX_TRANSCRIPT_LENGTH}`);
      transcriptText = transcriptText.substring(0, MAX_TRANSCRIPT_LENGTH) + "\n\n[Transcript truncated due to length]";
    }

    // Generate diary content using OpenAI client
    let diaryContent: string;
    try {
      diaryContent = await openaiClient.generateDiary({
        transcript: transcriptText,
      });
      console.log("Generated diary content from call transcript");
    } catch (error) {
      console.error("OpenAI API error during diary generation:", error);
      const errorMsg = `Failed to generate diary: ${error instanceof Error ? error.message : String(error)}`;
      await ctx.runMutation(internal.callJobs.updateCallSessionMetadata, {
        callSessionId: args.callSessionId,
        metadata: { diaryError: errorMsg },
      });
      return {
        success: false,
        error: errorMsg,
      };
    }

    let diaryId;
    try {
      const result = await ctx.runMutation(internal.diaries.createDiaryInternal, {
        userId: args.userId,
        content: diaryContent,
        date: args.endedAt,
      });
      diaryId = result._id;
      console.log(`Created diary ${diaryId} from call session ${args.callSessionId}`);
      
      await ctx.runMutation(internal.callJobs.updateCallSessionMetadata, {
        callSessionId: args.callSessionId,
        metadata: { diaryId: diaryId },
      });
    } catch (error) {
      console.error("Failed to create diary:", error);
      const errorMsg = `Failed to create diary: ${error instanceof Error ? error.message : String(error)}`;
      await ctx.runMutation(internal.callJobs.updateCallSessionMetadata, {
        callSessionId: args.callSessionId,
        metadata: { diaryError: errorMsg },
      });
      return {
        success: false,
        error: errorMsg,
      };
    }

    try {
      await ctx.scheduler.runAfter(0, internal.callDiaryWorkflow.generateMusicForCallDiary, {
        userId: args.userId,
        diaryId,
        content: diaryContent,
      });
      console.log(`Scheduled music generation for diary ${diaryId}`);
    } catch (error) {
      console.error("Failed to schedule music generation:", error);
    }

    return {
      success: true,
      diaryId,
    };
  },
});

/**
 * Generate music for a diary created from a call
 * This checks usage limits and triggers the Suno generation
 */
export const generateMusicForCallDiary = internalAction({
  args: {
    userId: v.id("users"),
    diaryId: v.id("diaries"),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check usage limit and increment counter for music generation
    const usageResult = await ctx.runMutation(
      internal.usage.recordMusicGeneration,
      {
        userId: args.userId,
      },
    );

    if (!usageResult.success) {
      console.warn(
        `Music generation skipped for diary ${args.diaryId}: ${usageResult.reason}. ` +
        `User has ${usageResult.remainingQuota} remaining quota.`
      );
      return null;
    }

    // Schedule music generation with usage tracking info
    await ctx.scheduler.runAfter(0, internal.musicActions.requestSunoGeneration, {
      diary: {
        diaryId: args.diaryId,
        userId: args.userId,
        content: args.content,
      },
      usageResult: {
        success: usageResult.success,
        currentUsage: usageResult.currentUsage,
        remainingQuota: usageResult.remainingQuota,
      },
    });

    console.log(`Music generation scheduled for call diary ${args.diaryId}`);
    return null;
  },
});
