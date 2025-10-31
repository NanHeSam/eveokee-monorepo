"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  MUSIC_GENERATION_CALLBACK_PATH,
  SUNO_SONGS_PER_REQUEST,
  SUNO_DEFAULT_MODEL,
} from "./utils/constants";
import { createOpenAIClientFromEnv } from "./integrations/openai/client";
import { createSunoClientFromEnv } from "./integrations/suno/client";

export const requestSunoGeneration = internalAction({
  args: {
    diary: v.object({
      diaryId: v.id("diaries"),
      userId: v.id("users"),
      content: v.string(),
    }),
    usageResult: v.optional(v.object({
      success: v.boolean(),
      currentUsage: v.number(),
      remainingQuota: v.number(),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Create OpenAI client for generating song data
    const openaiClient = createOpenAIClientFromEnv({
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_TIMEOUT: process.env.OPENAI_TIMEOUT,
    });

    // Create Suno client for music generation
    const sunoCallbackUrl = process.env.SUNO_CALLBACK_URL;
    if (!sunoCallbackUrl) {
      throw new Error("SUNO_CALLBACK_URL secret is not set");
    }
    const sunoClient = createSunoClientFromEnv({
      SUNO_API_KEY: process.env.SUNO_API_KEY,
      SUNO_CALLBACK_URL: sunoCallbackUrl + MUSIC_GENERATION_CALLBACK_PATH,
      SUNO_TIMEOUT: process.env.SUNO_TIMEOUT,
    });

    // Generate song data from diary content using OpenAI
    let songData: { lyric: string; style: string; title: string };
    try {
      songData = await openaiClient.generateMusicData({
        diaryContent: args.diary.content,
      });
      console.log("Generated song data:", songData);
    } catch (error) {
      console.error("OpenAI API error:", error);
      
      // Decrement usage counter if we have usage tracking info
      if (args.usageResult) {
        try {
          await ctx.runMutation(internal.usage.decrementMusicGeneration, {
            userId: args.diary.userId,
          });
        } catch (decrementError) {
          console.error("Failed to decrement usage counter:", decrementError);
        }
      }
      
      throw new Error(`Failed to generate song data from OpenAI: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Generate music using Suno API
    let taskId: string;
    try {
      const result = await sunoClient.generateMusic({
        prompt: songData.lyric,
        style: songData.style,
        title: songData.title,
      });
      taskId = result.taskId;
    } catch (error) {
      // Decrement usage counter if Suno API fails
      if (args.usageResult) {
        try {
          await ctx.runMutation(internal.usage.decrementMusicGeneration, {
            userId: args.diary.userId,
          });
        } catch (decrementError) {
          console.error("Failed to decrement usage counter:", decrementError);
        }
      }
      
      throw error;
    }

    await ctx.runMutation(internal.music.createPendingMusicRecords, {
      diaryId: args.diary.diaryId,
      userId: args.diary.userId,
      taskId,
      prompt: songData.lyric,
      model: SUNO_DEFAULT_MODEL,
      trackCount: SUNO_SONGS_PER_REQUEST,
    });

    return null;
  },
});

