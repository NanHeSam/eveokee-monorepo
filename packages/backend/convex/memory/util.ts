import { z } from "zod";
import { AIClient } from "../integrations/ai/client";

const SYSTEM_PROMPT = `You are an AI assistant that extracts memorable events from a user's diary entry.
Your goal is to identify distinct events, the people involved, and relevant tags.
- events: A list of events found in the text.
- people: Full names or nicknames of people mentioned.
- tags: Conceptual themes or activities (e.g., "work", "hiking", "family").
- happenedAt: Infer the best timestamp for the event based on the diary date.
`;

const EventSchema = z.object({
  title: z.string().describe("A concise title for the event"),
  summary: z.string().describe("A 1-2 sentence summary of the event"),
  // best to just use diary date for Phase 1 unless specific time is mentioned.
  tags: z.array(z.string()).describe("Tags related to the event"),
  people: z.array(z.string()).describe("Names of people involved"),
});

const ResponseSchema = z.object({
  events: z.array(EventSchema),
});

export async function extractEventsFromDiary(
  text: string,
  date: number,
  existingPeople: string[] = [],
  existingTags: string[] = []
): Promise<{
  title: string;
  summary: string;
  happenedAt: number;
  tags: string[];
  people: string[];
}[]> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;

  if (!apiKey) {
    console.warn("AI gateway API key missing. Using stub.");
    return stubExtract(text, date);
  }

  try {
    const client = new AIClient({
      apiKey,
    });

    const contextPrompt = `
Existing People: ${existingPeople.join(", ") || "None"}
Existing Tags: ${existingTags.join(", ") || "None"}
When extracting people and tags, prefer using the exact names/tags from the lists above if they match the context, if not, create new names/tags.
`;

    const result = await client.generateStructured(
      `Diary Entry (${new Date(date).toISOString()}): "${text}"`,
      ResponseSchema,
      "google/gemini-3-pro-preview", // Model in format "provider/model-name"
      SYSTEM_PROMPT + contextPrompt
    );

    const mappedEvents = result.events.map((e) => ({
      ...e,
      happenedAt: date, // Force diary date for Phase 1 simplicity
    })) as {
      title: string;
      summary: string;
      happenedAt: number;
      tags: string[];
      people: string[];
    }[];
    console.log("Extracted events from AI:", mappedEvents);
    return mappedEvents;
  } catch (error) {
    console.error("AI Extraction failed:", error);
    return stubExtract(text, date);
  }
}

function stubExtract(text: string, date: number) {
  const summary = text.slice(0, 100) + (text.length > 100 ? "..." : "");
  const title = `Diary Entry from ${new Date(date).toLocaleDateString()}`;

  return [
    {
      title,
      summary: summary,
      happenedAt: date,
      tags: ["diary"],
      people: [],
    },
  ];
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function normalizePersonName(name: string): string {
  return name.trim();
}
