"use node";

import { internalAction, action } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { VIDEO_GENERATION_CALLBACK_PATH, KIE_MODEL_IMAGE_TO_VIDEO, DEFAULT_VIDEO_DURATION, DEFAULT_VIDEO_RESOLUTION } from "./utils/constants";
import { getOpenAIClient, type OpenAIClient } from "./integrations/openai/client";
import { createKieClientFromEnv, type KieGenerateRequest } from "./integrations/kie/client";

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
      diaryPhotoMediaId: music.diaryPhotoMediaId,
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
    diaryPhotoMediaId: v.optional(v.id("diaryMedia")),
    usageResult: v.optional(v.object({
      success: v.boolean(),
      currentUsage: v.number(),
      remainingQuota: v.number(),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get clients with refund protection
    let openaiClient: OpenAIClient;
    let kieClient: ReturnType<typeof createKieClientFromEnv>;

    try {
      // Get OpenAI client for generating video script
      openaiClient = getOpenAIClient();

      // Create Kie.ai client for video generation
      // CONVEX_SITE_URL is provided automatically by Convex
      const convexSiteUrl = process.env.CONVEX_SITE_URL;
      if (!convexSiteUrl) {
        throw new Error("CONVEX_SITE_URL is not available (this should be provided automatically by Convex)");
      }
      kieClient = createKieClientFromEnv({
        KIE_AI_API_KEY: process.env.KIE_AI_API_KEY,
        CONVEX_SITE_URL: convexSiteUrl,
        CALLBACK_PATH: VIDEO_GENERATION_CALLBACK_PATH,
        KIE_AI_TIMEOUT: process.env.KIE_AI_TIMEOUT,
      });
    } catch (error) {
      // Refund credits if client construction fails
      if (args.usageResult) {
        try {
          await ctx.runMutation(internal.usage.decrementVideoGeneration, {
            userId: args.userId,
          });
        } catch (decrementError) {
          console.error("Failed to decrement usage counter after client setup error:", decrementError);
        }
      }
      throw error;
    }

    // Resolve diary photo URL if one exists (needed for both prompt generation and video API)
    let referenceImageUrl: string | undefined;
    if (args.diaryPhotoMediaId) {
      try {
        const signedMedia = await ctx.runQuery(internal.diaryMedia.getSignedMediaUrl, {
          mediaId: args.diaryPhotoMediaId,
          userId: args.userId,
        });
        referenceImageUrl = signedMedia?.url;

        if (!referenceImageUrl) {
          console.warn("Diary photo URL missing despite media reference; falling back to text-only video", {
            diaryPhotoMediaId: args.diaryPhotoMediaId,
          });
        }
      } catch (error) {
        console.error("Failed to generate signed URL for diary media, falling back to text-only video", {
          diaryPhotoMediaId: args.diaryPhotoMediaId,
          error,
        });
      }
    }

    // Step 1: Generate video script from lyrics/diary using OpenAI
    let videoScript: string;
    try {
      const useImagePrompt = !!referenceImageUrl;
      videoScript = useImagePrompt
        ? await openaiClient.generateImageVideoPrompt({
            lyrics: args.lyric,
            songTitle: args.title,
            diaryEntry: args.diaryEntry,
            imageUrl: referenceImageUrl,
          })
        : await openaiClient.generateVideoScript({
            lyrics: args.lyric,
            songTitle: args.title,
            diaryEntry: args.diaryEntry,
          });

      console.log(useImagePrompt ? "Image-to-video prompt generated" : "Video script generated successfully", {
        scriptLength: videoScript.length,
      });
    } catch (error) {
      console.error("OpenAI API error:", error);
      
      // Step 4: On error, refund 3 credits (decrement usage counter)
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
    
    // Step 2: Call Kie.ai API to start video generation with callback URL
    let taskId: string;
    try {
      const generationRequest: Omit<KieGenerateRequest, "callbackUrl"> = {
        prompt: videoScript,
        aspect_ratio: "portrait", // Mobile-first
        duration: DEFAULT_VIDEO_DURATION, // 10 seconds
        remove_watermark: true,
      };

      if (referenceImageUrl) {
        Object.assign(generationRequest, {
          model: KIE_MODEL_IMAGE_TO_VIDEO,
          image_url: referenceImageUrl,
          resolution: DEFAULT_VIDEO_RESOLUTION, // 720p
        });
        console.log("Submitting diary photo for image-to-video generation", {
          diaryPhotoMediaId: args.diaryPhotoMediaId,
          model: KIE_MODEL_IMAGE_TO_VIDEO,
        });
      }

      console.log("Sending video generation request to Kie.ai", {
        request: JSON.stringify(generationRequest, null, 2),
        musicId: args.musicId,
        userId: args.userId,
      });

      const result = await kieClient.generateVideo(generationRequest);
      taskId = result.taskId;
      console.log("Kie.ai video generation started with taskId:", taskId);
    } catch (error) {
      // Step 4: On error, refund 3 credits (decrement usage counter)
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

    // Step 3: Create pending video record with taskId
    await ctx.runMutation(internal.videos.createPendingVideoRecord, {
      musicId: args.musicId,
      userId: args.userId,
      kieTaskId: taskId,
      scriptPrompt: videoScript,
    });

    return null;
  },
});


