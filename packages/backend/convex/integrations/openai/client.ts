/**
 * OpenAI Client Service
 * Provides a clean interface for interacting with the OpenAI API
 * with proper error handling, timeout management, and type safety
 */

import OpenAI from "openai";
import type { ChatCompletion } from "openai/resources/chat/completions";
import {
  OPENAI_DIARY_MODEL,
  OPENAI_DIARY_MAX_COMPLETION_TOKENS,
  OPENAI_MUSIC_MAX_COMPLETION_TOKENS,
  OPENAI_LYRIC_GENERATION_MODEL,
  OPENAI_VIDEO_SCRIPT_MODEL,
  OPENAI_VIDEO_SCRIPT_MAX_OUTPUT_TOKENS,
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
  style?: string; // Optional user-provided style
}

export interface GenerateVideoScriptParams {
  lyrics: string;
  songTitle?: string;
  diaryEntry?: string;
}

export interface ExtractTagsParams {
  title: string;
  content: string;
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
- Is concise but meaningful (50-200 words)
- Uses the same language as the conversation

Do not mention that this is from a call or conversation. Write as if the user is naturally reflecting on their day.`,
          },
          {
            role: "user",
            content: `Conversation transcript:\n\n${params.transcript}`,
          },
        ],
        max_tokens: OPENAI_DIARY_MAX_COMPLETION_TOKENS,
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
   * Generate song data (lyrics, mood, title) from diary content
   * @param params - Parameters including diary content and optional style
   * @returns Generated song data with lyric, mood, and title
   * @throws Error if the API call fails
   */
  async generateMusicData(params: GenerateMusicParams): Promise<{
    lyric: string;
    mood: string;
    title: string;
  }> {
    try {
      const completion = await this.client.chat.completions.create({
        model: OPENAI_LYRIC_GENERATION_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a creative lyricist. Generate a song based on the diary entry provided. 
Create lyrics with structure tags like [Verse], [Chorus], [Bridge], etc. Keep concise and emotional for a 1-2 minute song.

Emotion/Mood Identification:
Identify the PRIMARY EMOTION or MOOD from the diary entry. Common emotions include:
- Positive: happy, joyful, excited, hopeful, content, peaceful, grateful, euphoric, optimistic
- Negative: sad, melancholic, depressed, miserable, anxious, fearful, worried, lonely, hopeless
- Intense: angry, frustrated, enraged, resentful, bitter, aggressive, defiant
- Complex: nostalgic, bittersweet, conflicted, contemplative, reflective, introspective, yearning

Return ONLY the mood/emotion as a single descriptive word or short phrase (e.g., "melancholic", "joyful", "angry", "nostalgic", "anxious", "peaceful"). This mood will be combined with music style descriptors separately.

Create a creative song title.
Use the same language as the diary entry for lyrics and title.`,
          },
          {
            role: "user",
            content: params.diaryContent,
          },
        ],
        max_tokens: OPENAI_MUSIC_MAX_COMPLETION_TOKENS,
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
                mood: {
                  type: "string",
                  description: "Primary emotion or mood from the diary entry (e.g., 'melancholic', 'joyful', 'angry', 'nostalgic', 'anxious', 'peaceful', 'lonely', 'conflicted', 'contemplative', 'reflective', 'introspective', 'yearning', etc.). Single word or short phrase.",
                },
                title: {
                  type: "string",
                  description: "Creative song title",
                },
              },
              required: ["lyric", "mood", "title"],
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
      let songData: { lyric: string; mood: string; title: string };
      try {
        songData = JSON.parse(content);
      } catch (parseError) {
        throw new Error(
          `Failed to parse OpenAI response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}. ` +
          `Raw content: ${content.substring(0, 500)}${content.length > 500 ? "..." : ""}`
        );
      }

      if (!songData.lyric || !songData.mood || !songData.title) {
        throw new Error("OpenAI response missing required fields (lyric, mood, or title)");
      }

      return songData;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI music generation failed: ${error.message}`);
      }
      throw new Error(`OpenAI music generation failed: ${String(error)}`);
    }
  }

  /**
   * Generate video script from song lyrics
   * Converts lyrics into visual scene descriptions suitable for Sora 2 video generation
   * @param params - Parameters including lyrics and optional song title
   * @returns Generated video script/prompt for Kie.ai
   * @throws Error if the API call fails
   */
  async generateVideoScript(params: GenerateVideoScriptParams): Promise<string> {
    try {
      const userMessageSections: Array<string> = [];
      if (params.songTitle) {
        userMessageSections.push(`Song Title:\n${params.songTitle}`);
      }
      if (params.diaryEntry) {
        userMessageSections.push(`Diary Reflection:\n${params.diaryEntry}`);
      }
      userMessageSections.push(`Song Lyrics:\n${params.lyrics}`);
      const userContent = userMessageSections.join("\n\n");
      
      const completion = await this.client.chat.completions.create({
        model: OPENAI_VIDEO_SCRIPT_MODEL,
        messages: [
            {
              role: "system",
              content: `You are a MUSIC VIDEO DIRECTOR crafting a 15-second vertical AI-video prompt (for Sora 2 or similar) that turns a diary entry and its resulting song lyrics into one cohesive, cinematic moment.

Input: You will receive two texts from the user - (1) a short personal diary reflection, and (2) the generated song lyrics. Use both together.

GOAL: Create ONE vivid, beat-synchronized 15-second scene that visually expresses the emotion, imagery, and story implied by the lyrics, while grounding it in the diary's setting, mood, and perspective.

---

DIRECTING RULES

1. **Lyric anchoring:** Integrate 2-3 exact lyric fragments (in quotes) as visible or symbolic elements in the scene (e.g., phone screen shows "five little words"). The visuals must clearly illustrate or mirror these moments.

2. **Diary grounding:** Use the diary to infer WHO the person is, WHERE they are, and the overall emotional tone (nostalgia, tension, hope, intimacy, etc.). The diary defines the emotional palette; the lyrics define the rhythm and imagery.

3. **Timeline beats (4-part arc):**
   - 0-3 s = establish setting & emotional cue
   - 3-6 s = first action or gesture tied to lyric A
   - 6-10 s = chorus or emotional lift / visual transformation
   - 10-15 s = resolution or visual echo of diary emotion

4. **Visual grammar:** One clear environment and 1 main character. Specify lighting, color tone, shot type, camera move, transitions, and emotional rhythm (e.g., "handheld close-up," "match-cut," "rack focus," "soft flare on chorus").

5. **Tone:** cinematic, realistic, emotionally resonant - avoid symbolic abstraction or disjointed montage.

6. **Mobile framing:** portrait orientation, subject centered, clean background, natural motion.

7. **Length:** 3-5 compact sentences, one cohesive paragraph, no bullet points or meta text.

8. **Output:** Only the final video prompt paragraph - no commentary, no extra text.

---

THINKING PROCESS (internal):
- Extract the diary's key emotion, location hints, time-of-day, and sensory cues.
- Find 2-3 lyric lines with the strongest visual anchors.
- Combine them into a mini-arc that feels like one real-time moment inside a music video.
- Describe it in cinematic language timed to the rhythm of a 15-second clip.

Your output should read like a film director's short shotlist written as prose, tightly synced to the lyrics and emotionally rooted in the diary.`,
            },
            {
              role: "user",
              content: userContent,
            },
          ],

          reasoning_effort: "low",
          max_completion_tokens: OPENAI_VIDEO_SCRIPT_MAX_OUTPUT_TOKENS,
        } as any);

      // Log token usage statistics
      if (completion.usage) {
        console.log("[OpenAI Video Script] Token Usage:", {
          prompt_tokens: completion.usage.prompt_tokens,
          completion_tokens: completion.usage.completion_tokens,
          total_tokens: completion.usage.total_tokens,
        });
      }

      // Log full response structure for debugging
      console.log("[OpenAI Video Script] Full response:", JSON.stringify({
        model: completion.model,
        id: completion.id,
        choices_count: completion.choices?.length ?? 0,
        usage: completion.usage,
        has_content: !!completion.choices?.[0]?.message?.content,
      }, null, 2));

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Failed to generate video script: Empty response");
      }

      return content.trim();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI video script generation failed: ${error.message}`);
      }
      throw new Error(`OpenAI video script generation failed: ${String(error)}`);
    }
  }

  /**
   * Extract relevant tags from blog post title and content
   * Uses AI to identify 3-5 relevant tags that categorize the content
   * @param params - Parameters including title and content
   * @returns Array of 3-5 relevant tags
   * @throws Error if the API call fails
   */
  async extractTags(params: ExtractTagsParams): Promise<string[]> {
    try {
      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-mini", // Using mini for fast, cost-effective tag extraction
        messages: [
          {
            role: "system",
            content: `You are a content categorization expert. Analyze the blog post title and content to extract 3-5 relevant tags.

Tags should be:
- Single words or short phrases (1-2 words max)
- Relevant to the main topics and themes
- Useful for categorization and search
- Capitalized appropriately (e.g., "AI", "Machine Learning", "JavaScript")
- Common industry terms or topics

Return ONLY the tags as a JSON array of strings. No explanations, no extra text.`,
          },
          {
            role: "user",
            content: `Title: ${params.title}\n\nContent:\n${params.content}`,
          },
        ],
        max_tokens: 100,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Failed to extract tags: Empty response");
      }

      // Parse JSON response
      let result: { tags?: string[] };
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        throw new Error(
          `Failed to parse OpenAI response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        );
      }

      // Extract tags array from various possible response formats
      const tags = result.tags || [];

      if (!Array.isArray(tags) || tags.length === 0) {
        throw new Error("OpenAI response did not contain valid tags array");
      }

      // Return 3-5 tags, filter out empty strings
      return tags.filter((tag: string) => tag && tag.trim().length > 0).slice(0, 5);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI tag extraction failed: ${error.message}`);
      }
      throw new Error(`OpenAI tag extraction failed: ${String(error)}`);
    }
  }
}

/**
 * Singleton instance of OpenAIClient
 * Lazily initialized on first use
 */
let openAIClientInstance: OpenAIClient | null = null;

/**
 * Get or create the singleton OpenAIClient instance.
 * Uses environment variables for configuration.
 *
 * @returns A configured OpenAIClient instance
 * @throws Error if `OPENAI_API_KEY` is not set in environment variables
 */
export function getOpenAIClient(): OpenAIClient {
  if (!openAIClientInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    const timeout = process.env.OPENAI_TIMEOUT
      ? parseInt(process.env.OPENAI_TIMEOUT, 10)
      : undefined;

    openAIClientInstance = new OpenAIClient({
      apiKey,
      timeout,
    });
  }

  return openAIClientInstance;
}

/**
 * @deprecated Use getOpenAIClient() instead. This function creates a new client instance each time.
 *
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

