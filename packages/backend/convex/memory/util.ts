import { generateObject } from "ai";
import { z } from "zod";
import { AIClient } from "../integrations/ai/client";

// Define words once - change here to update everywhere
export const MOOD_WORDS = [
  "very negative",
  "negative",
  "neutral",
  "positive",
  "very positive",
] as const;

export const AROUSAL_WORDS = [
  "very calm",
  "relaxed",
  "moderate",
  "energetic",
  "very energetic",
] as const;

// Define number values
const MOOD_VALUES = [-2, -1, 0, 1, 2] as const;
export type MoodValue = (typeof MOOD_VALUES)[number];
const MOOD_SET = new Set<number>(MOOD_VALUES);

const AROUSAL_VALUES = [1, 2, 3, 4, 5] as const;
export type ArousalValue = (typeof AROUSAL_VALUES)[number];
const AROUSAL_SET = new Set<number>(AROUSAL_VALUES);

// Generate mappings programmatically from words and values
export const MOOD_MAPPINGS = Object.fromEntries(
  MOOD_WORDS.map((word, index) => [word, MOOD_VALUES[index]])
) as Record<(typeof MOOD_WORDS)[number], MoodValue>;

export const MOOD_REVERSE_MAPPINGS: Record<number, string> = Object.fromEntries(
  MOOD_WORDS.map((word, index) => [MOOD_VALUES[index], word])
) as Record<number, string>;

export const AROUSAL_MAPPINGS = Object.fromEntries(
  AROUSAL_WORDS.map((word, index) => [word, AROUSAL_VALUES[index]])
) as Record<(typeof AROUSAL_WORDS)[number], ArousalValue>;

export const AROUSAL_REVERSE_MAPPINGS: Record<number, string> = Object.fromEntries(
  AROUSAL_WORDS.map((word, index) => [AROUSAL_VALUES[index], word])
) as Record<number, string>;

// Type exports
export type MoodWord = (typeof MOOD_WORDS)[number];
export type ArousalWord = (typeof AROUSAL_WORDS)[number];

const SYSTEM_PROMPT = `You are an AI assistant that extracts memorable events from a user's diary entry.
Your goal is to identify distinct events and capture all relevant metadata for each event.
- events: A list of distinct events found in the text.
- people: Full names or nicknames of people mentioned.
- tags: 1-3 tags related to the event.
- mood: Overall sentiment of the event. Use one of: "very negative", "negative", "neutral", "positive", "very positive".
- arousal: Energy level of the event. Use one of: "very calm", "relaxed", "moderate", "energetic", "very energetic".
- anniversaryCandidate: true if this event should be remembered annually, otherwise false.
`;

const EventSchema = z.object({
  title: z.string().describe("A concise title for the event"),
  summary: z.string().describe("A 1-2 sentence summary of the event"),
  // best to just use diary date for Phase 1 unless specific time is mentioned.
  tags: z.array(z.string()).describe("1-3 tags related to the event"),
  people: z.array(z.string()).describe("Names of people involved"),
  mood: z
    .enum(MOOD_WORDS)
    .optional()
    .describe("Sentiment: 'very negative', 'negative', 'neutral', 'positive', or 'very positive'"),
  arousal: z
    .enum(AROUSAL_WORDS)
    .optional()
    .describe("Energy level: 'very calm', 'relaxed', 'moderate', 'energetic', or 'very energetic'"),
  anniversaryCandidate: z
    .boolean()
    .optional()
    .describe("True if this should be remembered annually"),
});

type EventExtraction = z.infer<typeof EventSchema>;
const EXTRACTION_MODEL = "google/gemini-3-pro-preview";
const MAX_EXTRACTION_ATTEMPTS = 3;

let cachedAIClient: AIClient | null = null;
let cachedApiKey: string | null = null;

type ExtractedEvent = {
  title: string;
  summary: string;
  happenedAt: number;
  tags: string[];
  people: string[];
  mood?: MoodValue;
  arousal?: ArousalValue;
  anniversaryCandidate?: boolean;
};

export async function extractEventsFromDiary(
  text: string,
  date: number,
  existingPeople: string[] = [],
  existingTags: string[] = []
): Promise<ExtractedEvent[]> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;

  if (!apiKey) {
    console.warn("AI gateway API key missing. Using stub.");
    return stubExtract(text, date);
  }

  const client = getOrCreateAIClient(apiKey);
  const model = client.getModel(EXTRACTION_MODEL);
  const contextPrompt = constructContextPrompt(existingPeople, existingTags);
  const systemPrompt = SYSTEM_PROMPT + contextPrompt;

  let previousError: string | undefined;

  for (let attempt = 1; attempt <= MAX_EXTRACTION_ATTEMPTS; attempt++) {
    try {
      const prompt = buildDiaryPrompt(text, date, previousError);

      const result = await generateObject({
        model,
        schema: EventSchema,
        output: "array",
        prompt,
        system: systemPrompt,
      });

      const rawEvents = result.object as EventExtraction[];

      const mappedEvents: ExtractedEvent[] = rawEvents.map((event) => ({
        title: event.title,
        summary: event.summary,
        tags: event.tags,
        people: event.people,
        happenedAt: date, // Force diary date for Phase 1 simplicity
        mood: moodWordToNumber(event.mood),
        arousal: arousalWordToNumber(event.arousal),
        anniversaryCandidate: event.anniversaryCandidate,
      }));
      console.log("Extracted events from AI:", mappedEvents);
      return mappedEvents;
    } catch (error) {
      previousError = getErrorMessage(error);
      console.warn(
        `AI extraction attempt ${attempt} failed`,
        previousError
      );
    }
  }

  console.error(
    "AI Extraction failed after retries:",
    previousError ?? "Unknown error"
  );
  return stubExtract(text, date);
}

function stubExtract(text: string, date: number): ExtractedEvent[] {
  const summary = text.slice(0, 100) + (text.length > 100 ? "..." : "");
  const title = `Diary Entry from ${new Date(date).toLocaleDateString()}`;

  return [
    {
      title,
      summary: summary,
      happenedAt: date,
      tags: ["diary"],
      people: [],
      mood: 0 as MoodValue,
      arousal: 3 as ArousalValue,
      anniversaryCandidate: false,
    },
  ];
}

function getOrCreateAIClient(apiKey: string): AIClient {
  if (!cachedAIClient || cachedApiKey !== apiKey) {
    cachedAIClient = new AIClient({ apiKey });
    cachedApiKey = apiKey;
  }
  return cachedAIClient;
}

function buildDiaryPrompt(
  text: string,
  date: number,
  previousError?: string
): string {
  let prompt = `Diary Entry (${new Date(date).toISOString()}): "${text}"`;
  if (previousError) {
    prompt += `
Previous attempt failed because: ${previousError}
Please correct the output and strictly follow the required JSON schema.`;
  }
  return prompt;
}

/**
 * Convert mood word/phrase to number for database storage
 */
export function moodWordToNumber(word?: string): MoodValue | undefined {
  if (!word) return undefined;
  const normalized = word.toLowerCase().trim();
  const number = MOOD_MAPPINGS[normalized as keyof typeof MOOD_MAPPINGS];
  if (number === undefined) return undefined;
  return MOOD_SET.has(number) ? (number as MoodValue) : undefined;
}

/**
 * Convert arousal word/phrase to number for database storage
 */
export function arousalWordToNumber(word?: string): ArousalValue | undefined {
  if (!word) return undefined;
  const normalized = word.toLowerCase().trim();
  const number = AROUSAL_MAPPINGS[normalized as keyof typeof AROUSAL_MAPPINGS];
  if (number === undefined) return undefined;
  return AROUSAL_SET.has(number) ? (number as ArousalValue) : undefined;
}

/**
 * Convert mood number to word/phrase for frontend display
 */
export function moodNumberToWord(value?: MoodValue): string | undefined {
  if (value === undefined || value === null) return undefined;
  return MOOD_REVERSE_MAPPINGS[value];
}

/**
 * Convert arousal number to word/phrase for frontend display
 */
export function arousalNumberToWord(value?: ArousalValue): string | undefined {
  if (value === undefined || value === null) return undefined;
  return AROUSAL_REVERSE_MAPPINGS[value];
}

function getErrorMessage(error: unknown): string {
  if (!error) {
    return "Unknown error";
  }
  if (error instanceof Error) {
    return error.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function normalizePersonName(name: string): string {
  return name.trim();
}

export function constructContextPrompt(
  existingPeople: string[],
  existingTags: string[]
): string {
  const peopleLine =
    existingPeople.length > 0
      ? `Existing People: ${existingPeople.join(", ")}`
      : "No existing people.";
  const tagsLine =
    existingTags.length > 0
      ? `Existing Tags: ${existingTags.join(", ")}`
      : "No existing tags.";

  let instruction = "Create new names and tags as needed.";
  if (existingPeople.length > 0 && existingTags.length > 0) {
    instruction =
      "When extracting people and tags, prefer using the exact names and tags from the lists above if they match the context; otherwise, create new ones.";
  } else if (existingPeople.length > 0) {
    instruction =
      "When extracting people, prefer using the exact names from the list above if they match the context; otherwise, create new names.";
  } else if (existingTags.length > 0) {
    instruction =
      "When extracting tags, prefer using the exact tags from the list above if they match the context; otherwise, create new tags.";
  }

  return `
${peopleLine}
${tagsLine}
${instruction}
`;
}
