"use node";

import { internalAction, action } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { VIDEO_GENERATION_CALLBACK_PATH } from "./utils/constants";
import { createOpenAIClientFromEnv } from "./integrations/openai/client";
import { createKieClientFromEnv } from "./integrations/kie/client";

/**
 * Start video generation for a music track
 * 
 * Steps:
 * 1. Authenticate user and verify music ownership
 * 2. Check for existing pending video generation to prevent duplicates
 * 3. Check usage limits and record video generation attempt (costs 3 credits)
 * 4. Generate video script from lyrics using OpenAI
 * 5. Call Kie.ai API to start video generation (async via webhook)
 * 6. Create pending video record with taskId
 * 
 * Returns success status with videoId and remaining quota, or error code if limit reached or already in progress.
 */
export const startVideoGeneration = action({
  args: {
    musicId: v.id("music"),
  },
  returns: v.object({
    success: v.boolean(),
    videoId: v.optional(v.id("musicVideos")),
    code: v.optional(v.union(
      v.literal("USAGE_LIMIT_REACHED"),
      v.literal("ALREADY_IN_PROGRESS"),
      v.literal("NO_LYRICS"),
      v.literal("UNKNOWN_ERROR")
    )),
    reason: v.optional(v.string()),
    remainingQuota: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    // Step 1: Authenticate user and get music record
    const { userId } = await ctx.runMutation(api.users.ensureCurrentUser, {});

    const music = await ctx.runQuery(internal.videos.getMusicForVideoGeneration, {
      musicId: args.musicId,
      userId,
    });

    if (!music.success) {
      return {
        success: false,
        code: "UNKNOWN_ERROR" as const,
        reason: music.error ?? "Music not found or access denied",
        remainingQuota: undefined,
      };
    }

    // Check if music has lyrics
    if (!music.lyric || music.lyric.trim().length === 0) {
      return {
        success: false,
        code: "NO_LYRICS" as const,
        reason: "Cannot generate video: music has no lyrics",
        remainingQuota: undefined,
      };
    }

    // Step 2: Check for existing pending video generation
    const hasPending = await ctx.runMutation(internal.videos.hasPendingVideoForMusic, {
      musicId: args.musicId,
    });

    if (hasPending) {
      return {
        success: false,
        code: "ALREADY_IN_PROGRESS" as const,
        reason: "Video generation already in progress for this music",
        remainingQuota: undefined,
      };
    }

    // Step 3: Check usage limits and record video generation (costs 3 credits)
    const usageResult = await ctx.runAction(
      internal.usage.recordVideoGenerationWithReconciliation,
      {
        userId,
      },
    );

    // If usage limit reached, return error
    if (!usageResult.success) {
      return {
        success: false,
        code: (usageResult.code || "UNKNOWN_ERROR") as
          | "USAGE_LIMIT_REACHED"
          | "UNKNOWN_ERROR",
        reason: usageResult.reason,
        remainingQuota: usageResult.remainingQuota,
      };
    }

    // Step 4: Schedule async video generation
    await ctx.scheduler.runAfter(0, internal.videoActions.requestKieVideoGeneration, {
      musicId: args.musicId,
      userId,
      lyric: music.lyric,
      title: music.title,
      diaryEntry: music.diaryContent,
      usageResult: {
        success: usageResult.success,
        currentUsage: usageResult.currentUsage,
        remainingQuota: usageResult.remainingQuota,
      },
    });

    return {
      success: true,
      code: undefined,
      remainingQuota: usageResult.remainingQuota,
    };
  },
});

/**
 * Request video generation from Kie.ai API
 * Follows the same pattern as requestSunoGeneration
 * 
 * Steps:
 * 1. Generate video script from lyrics using OpenAI
 * 2. Call Kie.ai API to start video generation with callback URL
 * 3. Create pending video record with taskId
 * 4. On error: Refund 3 credits
 */
export const requestKieVideoGeneration = internalAction({
  args: {
    musicId: v.id("music"),
    userId: v.id("users"),
    lyric: v.string(),
    title: v.optional(v.string()),
    diaryEntry: v.optional(v.string()),
    usageResult: v.optional(v.object({
      success: v.boolean(),
      currentUsage: v.number(),
      remainingQuota: v.number(),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Create OpenAI client for generating video script
    const openaiClient = createOpenAIClientFromEnv({
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_TIMEOUT: process.env.OPENAI_TIMEOUT,
    });

    // Create Kie.ai client for video generation
    // CONVEX_SITE_URL is provided automatically by Convex
    const convexSiteUrl = process.env.CONVEX_SITE_URL;
    if (!convexSiteUrl) {
      throw new Error("CONVEX_SITE_URL is not available (this should be provided automatically by Convex)");
    }
    const kieClient = createKieClientFromEnv({
      KIE_AI_API_KEY: process.env.KIE_AI_API_KEY,
      CONVEX_SITE_URL: convexSiteUrl,
      CALLBACK_PATH: VIDEO_GENERATION_CALLBACK_PATH,
      KIE_AI_TIMEOUT: process.env.KIE_AI_TIMEOUT,
    });

    // Generate video script from lyrics using OpenAI
    let videoScript: string;
    try {
      videoScript = await openaiClient.generateVideoScript({
        lyrics: args.lyric,
        songTitle: args.title,
        diaryEntry: args.diaryEntry,
      });
      console.log("Generated video script:", videoScript);
    } catch (error) {
      console.error("OpenAI API error:", error);
      
      // Decrement usage counter if we have usage tracking info
      if (args.usageResult) {
        try {
          await ctx.runMutation(internal.usage.decrementVideoGeneration, {
            userId: args.userId,
          });
        } catch (decrementError) {
          console.error("Failed to decrement usage counter:", decrementError);
        }
      }
      
      throw new Error(`Failed to generate video script from OpenAI: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Generate video using Kie.ai API
    let taskId: string;
    try {
      const result = await kieClient.generateVideo({
        prompt: videoScript,
        aspect_ratio: "portrait", // Mobile-first
        n_frames: "15", // 15 seconds
        remove_watermark: true,
      });
      taskId = result.taskId;
      console.log("Kie.ai video generation started with taskId:", taskId);
    } catch (error) {
      // Decrement usage counter if Kie.ai API fails
      if (args.usageResult) {
        try {
          await ctx.runMutation(internal.usage.decrementVideoGeneration, {
            userId: args.userId,
          });
        } catch (decrementError) {
          console.error("Failed to decrement usage counter:", decrementError);
        }
      }
      
      throw error;
    }

    // Create pending video record
    await ctx.runMutation(internal.videos.createPendingVideoRecord, {
      musicId: args.musicId,
      userId: args.userId,
      kieTaskId: taskId,
      scriptPrompt: videoScript,
    });

    return null;
  },
});


