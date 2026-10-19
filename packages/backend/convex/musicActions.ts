"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  MUSIC_GENERATION_CALLBACK_PATH,
  SUNO_SONGS_PER_REQUEST,
  SUNO_DEFAULT_MODEL,
} from "./utils/constants";
import { getOpenAIClient } from "./integrations/openai/client";
import { describeErrorForLog } from "./utils/logger";
import { createKieMusicClientFromEnv } from "./integrations/kie/musicClient";

/**
 * Combine mood with style descriptors to create final style string
 */
function combineMoodAndStyles(mood: string, styles: string[]): string {
  return [mood, ...styles].join(", ");
}

function splitStyleTags(style: string): string[] {
  return style
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export const requestSunoGeneration = internalAction({
  args: {
    diary: v.object({
      diaryId: v.id("diaries"),
      userId: v.id("users"),
      content: v.string(),
      style: v.optional(v.string()), // Optional user-provided style
    }),
    usageResult: v.optional(v.object({
      success: v.boolean(),
      currentUsage: v.number(),
      remainingQuota: v.number(),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let openaiClient: ReturnType<typeof getOpenAIClient>;
    let sunoClient: ReturnType<typeof createKieMusicClientFromEnv>;
    try {
      // Get OpenAI client for generating song data
      openaiClient = getOpenAIClient();

      // Create Kie Suno client for music generation
      // CONVEX_SITE_URL is provided automatically by Convex
      const convexSiteUrl = process.env.CONVEX_SITE_URL;
      if (!convexSiteUrl) {
        throw new Error("CONVEX_SITE_URL is not available (this should be provided automatically by Convex)");
      }
      // The callback handler rejects unauthenticated callbacks, so starting a
      // generation without the secret would only burn provider credits.
      const webhookSecret = process.env.SUNO_WEBHOOK_SECRET;
      if (!webhookSecret) {
        throw new Error("SUNO_WEBHOOK_SECRET environment variable is not set");
      }
      sunoClient = createKieMusicClientFromEnv({
        KIE_AI_API_KEY: process.env.KIE_AI_API_KEY,
        CONVEX_SITE_URL: convexSiteUrl,
        CALLBACK_PATH: MUSIC_GENERATION_CALLBACK_PATH,
        KIE_AI_TIMEOUT: process.env.KIE_AI_TIMEOUT,
        WEBHOOK_SECRET: webhookSecret,
      });
    } catch (error) {
      // Refund the generation if client setup fails
      if (args.usageResult) {
        try {
          await ctx.runMutation(internal.usage.decrementMusicGeneration, {
            userId: args.diary.userId,
          });
        } catch (decrementError) {
          console.error("Failed to decrement usage counter after client setup error:", decrementError);
        }
      }
      throw error;
    }

    // Generate song data from diary content using OpenAI (mood + lyrics + title)
    let songData: { lyric: string; mood: string; title: string; style: string };
    try {
      songData = await openaiClient.generateMusicData({
        diaryContent: args.diary.content,
        style: args.diary.style,
      });
      console.log("Generated song data", {
        diaryId: args.diary.diaryId,
        lyricLength: songData.lyric.length,
      });
    } catch (error) {
      // Message only: AI SDK errors carry the request body (the diary text).
      console.error("AI error during song generation:", describeErrorForLog(error));
      
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
      
      throw new Error(`Failed to generate song data: ${describeErrorForLog(error)}`);
    }
    
    // Determine final style: always combine mood + style tags (style is user-provided or LLM-generated)
    const finalStyle = combineMoodAndStyles(songData.mood, splitStyleTags(songData.style));
    
    // Generate music using Kie Suno
    let taskId: string;
    try {
      const result = await sunoClient.generateMusic({
        prompt: songData.lyric,
        style: finalStyle,
        title: songData.title,
      });
      taskId = result.taskId;
    } catch (error) {
      // Decrement usage counter if Kie music generation fails
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

/** Fetch synchronized lyrics through Kie after acknowledging the music callback. */
export const fetchTimedLyrics = internalAction({
  args: { taskId: v.string() },
  returns: v.null(),
  handler: async (ctx, { taskId }) => {
    let records;
    let client;
    try {
      records = await ctx.runQuery(internal.music.getAllMusicByTaskId, { taskId });
      client = createKieMusicClientFromEnv({
        KIE_AI_API_KEY: process.env.KIE_AI_API_KEY,
        CONVEX_SITE_URL: process.env.CONVEX_SITE_URL,
        CALLBACK_PATH: MUSIC_GENERATION_CALLBACK_PATH,
        KIE_AI_TIMEOUT: process.env.KIE_AI_TIMEOUT,
      });
    } catch (error) {
      console.warn("Timed lyrics unavailable", {
        taskId, phase: "setup",
        errorType: error instanceof Error ? error.name : typeof error,
      });
      return null;
    }
    await Promise.all(records.filter((record) => record.audioId).map(async (record) => {
      let phase = "fetch";
      try {
        const lyricWithTime = await client.getTimestampedLyrics({ taskId, audioId: record.audioId! });
        phase = "persist";
        await ctx.runMutation(internal.music.updateLyricWithTime, { musicId: record._id, lyricWithTime });
      } catch (error) {
        // Legacy tasks cannot be queried in Kie. Keep their audio and plain lyrics.
        console.warn("Timed lyrics unavailable", {
          taskId, musicId: record._id, phase,
          errorType: error instanceof Error ? error.name : typeof error,
          providerCode: error instanceof Error ? error.message.match(/(?:error code |failed: )(\d{3})/)?.[1] : undefined,
          // Kie can accept the same key locally yet reject Convex's egress IP.
          // Classify the cause without logging raw provider bodies or secrets.
          providerReason: error instanceof Error && /IP whitelist/i.test(error.message) ? "ip_whitelist" : undefined,
        });
      }
    }));
    return null;
  },
});
