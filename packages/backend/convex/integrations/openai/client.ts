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

export interface GenerateImageVideoPromptParams extends GenerateVideoScriptParams {
  imageUrl: string; // URL of the reference image to analyze and use in video generation
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
    style: string;
  }> {
    try {
      const completion = await this.client.chat.completions.create({
        model: OPENAI_LYRIC_GENERATION_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a creative lyricist. Generate a song based on the diary entry provided. 
Create lyrics with structure tags like [Verse], [Chorus], [Bridge], etc. Keep concise and emotional for a 1-2 minute song.

Rhythm / Singability (very important):
- The lyrics MUST feel rhythmic in the SAME LANGUAGE as the diary main entry.
- Adapt to that language’s natural prosody (stress timing vs syllable timing, typical word lengths, and common line breaks in that language). Do NOT force English-centric stress patterns onto other languages.
- Use short, beat-friendly lines with consistent length within each section.
- Aim for ~6–10 syllables (or roughly 5–10 words, depending on the language) per line.
- Avoid run-on sentences. If a line gets long, split it into two lines.
- Keep punctuation simple so lines are easy to sing.
- Language-specific punctuation rule:
  - If the lyric language is Chinese/Japanese/Korean, prefer LINE BREAKS over commas. Avoid frequent "，" mid-line; each line should read as a clean, singable phrase. If you use punctuation, keep it sparse and intentional (e.g., occasional "。" or no punctuation at all).
- Chinese-specific rhyme & line-length rule (very important when writing Chinese lyrics):
  - Make line lengths consistent within each section: pick a target of 8–10 Chinese characters per line (±1 max) and keep it steady in that section.
  - Add clear end-rhyme: choose ONE main rhyme family (same pinyin final / 韵母) for the Chorus and keep every Chorus line ending on that rhyme.
  - Use a simple rhyme scheme per section (e.g., AABB or ABAB). Avoid random endings that break the rhyme.
  - Prefer common, natural-sounding rhymes; do not force awkward wording just to rhyme—if needed, slightly rewrite the line to keep meaning and rhyme.

Lyric Style (important):
- If the user provides a Style hint, use it to influence both the lyrical vibe (imagery, tone, vocabulary) and the downstream music style.
- If a Style hint is provided, set the output field "style" to EXACTLY the provided Style hint (trim whitespace only; do not rewrite).
- If no Style hint is provided, generate a short style string based on the diary’s sensation: 2–4 comma-separated tags (e.g. "lo-fi, indie pop, warm, mellow"). Keep tags short.

Emotion/Mood Identification:
Identify the PRIMARY EMOTION or MOOD from the diary entry. Common emotions include:
- Positive: happy, joyful, excited, hopeful, content, peaceful, grateful, euphoric, optimistic
- Negative: sad, melancholic, depressed, miserable, anxious, fearful, worried, lonely, hopeless
- Intense: angry, frustrated, enraged, resentful, bitter, aggressive, defiant
- Complex: nostalgic, bittersweet, conflicted, contemplative, reflective, introspective, yearning

Return ONLY the mood/emotion as a single descriptive word or short phrase (e.g., "melancholic", "joyful", "angry", "nostalgic", "anxious", "peaceful"). This mood will be combined with the style tags for downstream music generation.

Create a creative song title.
Use the same language as the diary entry for lyrics and title.`,
          },
          {
            role: "user",
            content:
              (params.style && params.style.trim()
                ? `Style hint:\n${params.style.trim()}\n\nDiary entry:\n${params.diaryContent}`
                : `Diary entry:\n${params.diaryContent}`),
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
                style: {
                  type: "string",
                  description:
                    "Style hint/tags used for lyric vibe and downstream music style. If user provided a Style hint, copy it verbatim (trim only). Otherwise generate 2–4 short comma-separated tags.",
                },
                title: {
                  type: "string",
                  description: "Creative song title",
                },
              },
              required: ["lyric", "mood", "title", "style"],
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
      let songData: { lyric: string; mood: string; title: string; style: string };
      try {
        songData = JSON.parse(content);
      } catch (parseError) {
        throw new Error(
          `Failed to parse OpenAI response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}. ` +
          `Raw content: ${content.substring(0, 500)}${content.length > 500 ? "..." : ""}`
        );
      }

      if (!songData.lyric || !songData.mood || !songData.title || !songData.style) {
        throw new Error("OpenAI response missing required fields (lyric, mood, title, or style)");
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
   * Generate an image-conditioned video prompt
   * Tailored for image-to-video: stresses character consistency with the reference photo
   */
  async generateImageVideoPrompt(params: GenerateImageVideoPromptParams): Promise<string> {
    try {
      const userMessageSections: Array<string> = [];
      if (params.songTitle) {
        userMessageSections.push(`Song Title:\n${params.songTitle}`);
      }
      if (params.diaryEntry) {
        userMessageSections.push(`Diary Reflection:\n${params.diaryEntry}`);
      }
      userMessageSections.push(`Song Lyrics:\n${params.lyrics}`);
      const textContent = userMessageSections.join("\n\n");

      const completion = await this.client.chat.completions.create({
        model: OPENAI_VIDEO_SCRIPT_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a MUSIC VIDEO DIRECTOR crafting a 10-second vertical AI-video prompt for image-to-video generation. You will analyze a reference photo along with diary context and song lyrics to create a cohesive video.

YOUR TASK:
1. Analyze the reference photo carefully - identify if there are people, the environment, mood, lighting, colors, and setting
2. Understand the diary context - the emotional tone, place, time, and personal meaning
3. Connect the lyrics - how the words relate to the image and diary
4. Create exactly 3 shots/scenes that flow naturally together

MANDATORY RULES:
- If the photo contains people: Use the person(s) in the photo as the main subject. Keep their appearance exactly as shown (same faces, outfits, hair, age, build). Never introduce new characters or alter their clothing. The person should appear in all 3 shots with consistent looks.
- If the photo has no people: Use the environment, objects, or setting from the photo. Maintain the same location, lighting, and atmosphere across all shots.
- The reference photo is the starting point (first frame). All 3 shots must feel like a natural continuation from this image.
- Use the diary and lyrics together to understand the full context - the diary provides emotional grounding and setting, the lyrics provide visual rhythm and imagery.
- Portrait format, 10 seconds total, exactly 3 shots/scenes:
  * Shot 1 (0-3s): Establish the scene and character/environment from the photo
  * Shot 2 (3-6s): Develop the action or emotion tied to the lyrics
  * Shot 3 (6-10s): Resolution or visual echo that connects back to the diary emotion
- Write as one cohesive paragraph with clear timing markers. Use cinematic language (camera moves, shot types, lighting, transitions).
- Keep it natural, realistic, and emotionally resonant. Avoid surreal elements or disjointed montage.
- Do NOT apologize or add meta text. Output only the final video prompt paragraph.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Reference Photo Context:\nAnalyze this image carefully. Note the people (if any), environment, mood, lighting, colors, and setting.\n\n${textContent}`,
              },
              {
                type: "image_url",
                image_url: {
                  url: params.imageUrl,
                },
              },
            ],
          },
        ],
        reasoning_effort: "low",
        max_completion_tokens: OPENAI_VIDEO_SCRIPT_MAX_OUTPUT_TOKENS,
      } as any);

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Failed to generate image-to-video prompt: Empty response");
      }

      return content.trim();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI image-to-video prompt generation failed: ${error.message}`);
      }
      throw new Error(`OpenAI image-to-video prompt generation failed: ${String(error)}`);
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

