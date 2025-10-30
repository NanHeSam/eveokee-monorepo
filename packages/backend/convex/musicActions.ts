"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { MUSIC_GENERATION_CALLBACK_PATH } from "./constant";
import OpenAI from "openai";

const SUNO_GENERATE_ENDPOINT = "https://api.sunoapi.org/api/v1/generate";

const SONGS_PER_REQUEST = 2;
const DEFAULT_MODEL = "V5" as const;

type SunoGenerateResponse = {
  code: number;
  msg: string;
  data?: {
    taskId?: string;
  };
};

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
    const apiKey = process.env.SUNO_API_KEY;
    if (!apiKey) {
      throw new Error("SUNO_API_KEY secret is not set");
    }

    const callbackUrl = process.env.SUNO_CALLBACK_URL;
    if (!callbackUrl) {
      throw new Error("SUNO_CALLBACK_URL secret is not set");
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY secret is not set");
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });
    let songData: { lyric: string; style: string; title: string };
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a creative lyricist and music curator. Generate a song based on the diary entry provided. 
Create lyrics with structure tags like [Verse], [Chorus], [Bridge], etc. Keep concise and emotional for a 1-2 minute song.
Choose an appropriate music genre/style (e.g., 'indie pop, acoustic, melancholic' or 'electronic, upbeat, synthpop').
Create a creative song title.
Use the same language as the diary entry for lyrics and title.`
          },
          {
            role: "user",
            content: args.diary.content
          }
        ],
        max_completion_tokens: 1000,
        reasoning_effort: "low",
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "song_generation",
            strict: true,
            schema: {
              type: "object",
              properties: {
                lyric: {
                  type: "string",
                  description: "Song lyrics with structure tags like [Verse], [Chorus], [Bridge], etc."
                },
                style: {
                  type: "string",
                  description: "Music genre and style tags (e.g., 'indie pop, acoustic, melancholic')"
                },
                title: {
                  type: "string",
                  description: "Creative song title"
                }
              },
              required: ["lyric", "style", "title"],
              additionalProperties: false
            }
          }
        },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        console.error("OpenAI response:", JSON.stringify(completion, null, 2));
        throw new Error("Failed to generate song data from OpenAI: Empty response content");
      }
      
      // Parse JSON with targeted error handling for debugging
      try {
        songData = JSON.parse(content);
        console.log("Generated song data:", songData);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        console.error("Raw content from OpenAI:", content);
        throw new Error(
          `Failed to parse OpenAI response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}. ` +
          `Raw content: ${content.substring(0, 500)}${content.length > 500 ? '...' : ''}`
        );
      }
      
      if (!songData.lyric || !songData.style || !songData.title) {
        throw new Error("OpenAI response missing required fields (lyric, style, or title)");
      }
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
    
    const payload = {
      prompt: songData.lyric,
      style: songData.style,
      title: songData.title,
      customMode: true,
      instrumental: false,
      model: DEFAULT_MODEL,
      callBackUrl: callbackUrl + MUSIC_GENERATION_CALLBACK_PATH,
    };

    const response = await fetch(SUNO_GENERATE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorText = await response.text();
      
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
      
      throw new Error(
        `Suno API request failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data = (await response.json()) as SunoGenerateResponse;
    if (data.code !== 200) {
      // Decrement usage counter if Suno API returns error
      if (args.usageResult) {
        try {
          await ctx.runMutation(internal.usage.decrementMusicGeneration, {
            userId: args.diary.userId,
          });
        } catch (decrementError) {
          console.error("Failed to decrement usage counter:", decrementError);
        }
      }
      
      throw new Error(`Suno API returned error code ${data.code}: ${data.msg}`);
    }

    const taskId = data.data?.taskId;
    if (!taskId) {
      // Decrement usage counter if no taskId returned
      if (args.usageResult) {
        try {
          await ctx.runMutation(internal.usage.decrementMusicGeneration, {
            userId: args.diary.userId,
          });
        } catch (decrementError) {
          console.error("Failed to decrement usage counter:", decrementError);
        }
      }
      
      throw new Error("Suno API response missing taskId");
    }

    await ctx.runMutation(internal.music.createPendingMusicRecords, {
      diaryId: args.diary.diaryId,
      userId: args.diary.userId,
      taskId,
      prompt: songData.lyric,
      model: payload.model,
      trackCount: SONGS_PER_REQUEST,
    });

    return null;
  },
});

