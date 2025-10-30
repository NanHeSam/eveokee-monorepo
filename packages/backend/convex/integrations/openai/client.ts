/**
 * OpenAI Client Service
 * Provides a clean interface for interacting with the OpenAI API
 * with proper error handling, timeout management, and type safety
 */

import OpenAI from "openai";
import {
  OPENAI_DIARY_MODEL,
  OPENAI_DIARY_MAX_COMPLETION_TOKENS,
  OPENAI_MUSIC_MODEL,
  OPENAI_MUSIC_MAX_COMPLETION_TOKENS,
} from "../../utils/constants";

export interface OpenAIClientConfig {
  apiKey: string;
  timeout?: number;
}

export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateDiaryParams {
  transcript: string;
}

export interface GenerateMusicParams {
  diaryContent: string;
}

/**
 * OpenAI client for chat completions
 */
export class OpenAIClient {
  private client: OpenAI;
  private readonly timeout: number;

  constructor(config: OpenAIClientConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.timeout ?? 60000, // Default 60 seconds
    });
    this.timeout = config.timeout ?? 60000;
  }

  /**
   * Generate diary content from a call transcript
   * @param params - Parameters including transcript
   * @returns Generated diary content
   * @throws Error if the API call fails
   */
  async generateDiary(params: GenerateDiaryParams): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        model: OPENAI_DIARY_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a thoughtful diary writer. Based on the conversation transcript from a wellness check-in call, create a personal diary entry that:
- Captures the main thoughts, feelings, and experiences shared
- Writes in first person as if the user is writing their own diary
- Maintains an authentic, personal tone
- Focuses on emotional insights and meaningful moments
- Is concise but meaningful (200-400 words)
- Uses the same language as the conversation

Do not mention that this is from a call or conversation. Write as if the user is naturally reflecting on their day.`,
          },
          {
            role: "user",
            content: `Conversation transcript:\n\n${params.transcript}`,
          },
        ],
        max_completion_tokens: OPENAI_DIARY_MAX_COMPLETION_TOKENS,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Failed to generate diary content: Empty response");
      }

      return content.trim();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI diary generation failed: ${error.message}`);
      }
      throw new Error(`OpenAI diary generation failed: ${String(error)}`);
    }
  }

  /**
   * Generate song data (lyrics, style, title) from diary content
   * @param params - Parameters including diary content
   * @returns Generated song data with lyric, style, and title
   * @throws Error if the API call fails
   */
  async generateMusicData(params: GenerateMusicParams): Promise<{
    lyric: string;
    style: string;
    title: string;
  }> {
    try {
      const completion = await this.client.chat.completions.create({
        model: OPENAI_MUSIC_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a creative lyricist and music curator. Generate a song based on the diary entry provided. 
Create lyrics with structure tags like [Verse], [Chorus], [Bridge], etc. Keep concise and emotional for a 1-2 minute song.
Choose an appropriate music genre/style (e.g., 'indie pop, acoustic, melancholic' or 'electronic, upbeat, synthpop').
Create a creative song title.
Use the same language as the diary entry for lyrics and title.`,
          },
          {
            role: "user",
            content: params.diaryContent,
          },
        ],
        max_completion_tokens: OPENAI_MUSIC_MAX_COMPLETION_TOKENS,
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
                  description: "Song lyrics with structure tags like [Verse], [Chorus], [Bridge], etc.",
                },
                style: {
                  type: "string",
                  description: "Music genre and style tags (e.g., 'indie pop, acoustic, melancholic')",
                },
                title: {
                  type: "string",
                  description: "Creative song title",
                },
              },
              required: ["lyric", "style", "title"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Failed to generate song data: Empty response");
      }

      // Parse JSON response
      let songData: { lyric: string; style: string; title: string };
      try {
        songData = JSON.parse(content);
      } catch (parseError) {
        throw new Error(
          `Failed to parse OpenAI response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}. ` +
          `Raw content: ${content.substring(0, 500)}${content.length > 500 ? "..." : ""}`
        );
      }

      if (!songData.lyric || !songData.style || !songData.title) {
        throw new Error("OpenAI response missing required fields (lyric, style, or title)");
      }

      return songData;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI music generation failed: ${error.message}`);
      }
      throw new Error(`OpenAI music generation failed: ${String(error)}`);
    }
  }
}

/**
 * Instantiate an OpenAIClient using OPENAI_API_KEY environment variable.
 *
 * @param env - Object containing OpenAI configuration environment variables:
 *   - `OPENAI_API_KEY`: API key for authorization (required)
 *   - `OPENAI_TIMEOUT`: optional request timeout in milliseconds
 * @returns A configured OpenAIClient instance
 * @throws Error if `OPENAI_API_KEY` is missing
 */
export function createOpenAIClientFromEnv(env: {
  OPENAI_API_KEY?: string;
  OPENAI_TIMEOUT?: string;
}): OpenAIClient {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const timeout = env.OPENAI_TIMEOUT ? parseInt(env.OPENAI_TIMEOUT, 10) : undefined;

  return new OpenAIClient({
    apiKey,
    timeout,
  });
}

