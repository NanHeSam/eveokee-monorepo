"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  MAX_TRANSCRIPT_LENGTH,
} from "./utils/constants";
import { getOpenAIClient } from "./integrations/openai/client";

/**
 * Quality check helper to determine if diary/music should be generated from a call
 * Uses heuristic checks and VAPI's success evaluation
 * 
 * @param durationSeconds - Call duration in seconds
 * @param endedReason - Reason the call ended (may indicate voicemail, etc.)
 * @param successEvaluation - VAPI's success evaluation result ("true"/"false" for Binary, or numeric string)
 * @returns Object with shouldGenerate flag and reason string
 */
export function shouldGenerateDiaryFromCall(
  durationSeconds: number | undefined,
  endedReason: string | undefined,
  successEvaluation: string | undefined
): { shouldGenerate: boolean; reason: string } {
  // Heuristic check 1: Reject calls < 15 seconds
  if (durationSeconds !== undefined && durationSeconds < 15) {
    return {
      shouldGenerate: false,
      reason: `Call too short (${durationSeconds}s < 15s)`,
    };
  }

  // Heuristic check 2: Reject voicemail/no-answer/busy calls
  if (endedReason) {
    const lowerReason = endedReason.toLowerCase();
    if (
      lowerReason.includes("voicemail") ||
      lowerReason.includes("no-answer") ||
      lowerReason.includes("busy") ||
      lowerReason.includes("no answer")
    ) {
      return {
        shouldGenerate: false,
        reason: `Call ended with reason: ${endedReason}`,
      };
    }
  }

  // Use VAPI's success evaluation if available
  if (successEvaluation !== undefined && successEvaluation !== null) {
    const evalStr = String(successEvaluation).trim().toLowerCase();

    // PassFail rubric: "true" = generate, "false" = skip
    if (evalStr === "true") {
      return {
        shouldGenerate: true,
        reason: "VAPI evaluation: true",
      };
    }
    if (evalStr === "false") {
      return {
        shouldGenerate: false,
        reason: "VAPI evaluation: false",
      };
    }

    // NumericScale: threshold-based (e.g., >= 6/10 = generate)
    const numericValue = parseFloat(evalStr);
    if (!isNaN(numericValue)) {
      const threshold = 6; // 6 out of 10 or higher
      if (numericValue >= threshold) {
        return {
          shouldGenerate: true,
          reason: `VAPI evaluation score: ${numericValue} (>= ${threshold})`,
        };
      } else {
        return {
          shouldGenerate: false,
          reason: `VAPI evaluation score: ${numericValue} (< ${threshold})`,
        };
      }
    }
  }

  // Default: generate if evaluation unavailable (conservative - don't miss legitimate calls)
  return {
    shouldGenerate: false,
    reason: "No evaluation available, defaulting to not generate",
  };
}

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
    summary: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    diaryId: v.optional(v.id("diaries")),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Get OpenAI client for generating diary content
    let openaiClient;
    try {
      openaiClient = getOpenAIClient();
    } catch (error) {
      console.error("Failed to get OpenAI client:", error);
      await ctx.runMutation(internal.callJobs.updateCallSessionMetadata, {
        callSessionId: args.callSessionId,
        metadata: { diaryError: "OPENAI_API_KEY not configured" },
      });
      return {
        success: false,
        error: "OPENAI_API_KEY not configured",
      };
    }

    // Use VAPI summary if available, otherwise generate with OpenAI from transcript
    let diaryContent: string;
    if (args.summary && args.summary.trim().length > 0) {
      // Use the summary from VAPI's analysisPlan.summaryPlan
      diaryContent = args.summary.trim();
      console.log("Using VAPI summary for diary content");
    } else {
      // Extract transcript text for OpenAI generation
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
        console.warn("No transcript or summary available for diary generation");
        await ctx.runMutation(internal.callJobs.updateCallSessionMetadata, {
          callSessionId: args.callSessionId,
          metadata: { diaryError: "No transcript or summary available" },
        });
        return {
          success: false,
          error: "No transcript or summary available",
        };
      }

      if (transcriptText.length > MAX_TRANSCRIPT_LENGTH) {
        console.warn(`Transcript too long (${transcriptText.length} chars), truncating to ${MAX_TRANSCRIPT_LENGTH}`);
        transcriptText = transcriptText.substring(0, MAX_TRANSCRIPT_LENGTH) + "\n\n[Transcript truncated due to length]";
      }
      // Fall back to OpenAI generation if no summary available
      try {
        diaryContent = await openaiClient.generateDiary({
          transcript: transcriptText,
        });
        console.log("Generated diary content from call transcript using OpenAI");
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
    // Use reconciliation version to ensure RevenueCat product ID is up-to-date (single source of truth)
    const usageResult = await ctx.runAction(
      internal.usage.recordMusicGenerationWithReconciliation,
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
