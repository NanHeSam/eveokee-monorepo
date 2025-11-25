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

CRITICAL: If you add a person to the "people" array for an event, you MUST mention their name in the event's "summary". Every person listed in "people" must be explicitly named in the summary text.
`;

const EventSchema = z.object({
  title: z.string().describe("A concise title for the event"),
  summary: z.string().describe("A 1-2 sentence summary of the event. IMPORTANT: If any person is listed in the 'people' array, their name MUST be mentioned in this summary."),
  // best to just use diary date for Phase 1 unless specific time is mentioned.
  tags: z.array(z.string()).describe("1-3 tags related to the event"),
  people: z.array(z.string()).describe("Names of people involved. Only include people if they are relevant to the event and will be mentioned in the summary."),
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

const HIGHLIGHT_MODEL = "openai/gpt-4o-mini";

type HighlightEventSummary = {
  title: string;
  summary: string;
  happenedAt: number;
};

export async function generateRelationshipHighlight(
  personName: string,
  events: HighlightEventSummary[]
): Promise<string> {
  const fallback = () => buildFallbackHighlight(personName, events);

  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    console.warn("AI gateway API key missing. Using fallback highlight.");
    return fallback();
  }

  try {
    const client = getOrCreateAIClient(apiKey);
    const model = client.getModel(HIGHLIGHT_MODEL);

    const eventsText =
      events
        .map(
          (event, idx) =>
            `${idx + 1}. ${event.title} (${new Date(event.happenedAt).toLocaleDateString()}): ${event.summary}`
        )
        .join("\n") || "No events available.";


    const prompt = `You are summarizing my relationship with ${personName}. Use first person ("I") and talk specifically about ${personName}—mention their name at least once and do not introduce other people unless they appear in the events.

Events:
${eventsText}

Generate a highlight that:
- Summarizes the recent interactions with ${personName} in a casual, sincere tone
- References 1-2 concrete themes or patterns from these events
- Is written in first person (from my perspective) and uses ${personName}'s name
- Is concise but meaningful (2-3 sentences)
- Uses natural, conversational language—avoid formal phrases like "highlights the importance" or "deepens my appreciation"
- Keep it simple and genuine—don't overstate the significance of casual connections like mutual friends or small interactions
- Write like you're talking to a friend, not writing a formal reflection

Highlight:`;

    const HighlightSchema = z.object({
      highlight: z
        .string()
        .describe("A 2-3 sentence highlight summarizing the relationship"),
    });
    console.log("[HighlightAI] Generating highlight prompt", {
      personName,
      eventsCount: events.length,
      promptPreview: prompt,
    });
    const result = await generateObject({
      model,
      schema: HighlightSchema,
      prompt,
    });

    const highlight = result.object.highlight.trim();
    console.log("[HighlightAI] Generated highlight result", {
      personName,
      highlightPreview: highlight.slice(0, 500),
    });
    return highlight;
  } catch (error) {
    console.error("Failed to generate relationship highlight via AI:", error);
    return fallback();
  }
}

function buildFallbackHighlight(
  personName: string,
  events: HighlightEventSummary[]
): string {
  if (events.length === 0) {
    const summary = `I'm looking forward to creating more moments with ${personName}.`;
    console.log("[HighlightAI] Using fallback highlight (no events)", {
      personName,
      highlightPreview: summary,
    });
    return summary;
  }

  const recent = events[0];
  const eventDate = new Date(recent.happenedAt).toLocaleDateString();

  const summary = `Recently (${eventDate}), I shared "${recent.title}" with ${personName}. Moments like these remind me why this relationship matters.`;
  console.log("[HighlightAI] Using fallback highlight", {
    personName,
    highlightPreview: summary,
  });
  return summary;
}
