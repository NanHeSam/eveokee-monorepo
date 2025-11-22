import { z } from "zod";
import { AIClient } from "../integrations/ai/client";

const SYSTEM_PROMPT = `You are an AI assistant that extracts memorable events from a user's diary entry.
Your goal is to identify distinct events, the people involved, and relevant tags.
- events: A list of events found in the text.
- people: Full names or nicknames of people mentioned.
- tags: 1-3 tags related to the event.
- happenedAt: Infer the best timestamp for the event based on the diary date.
`;

const EventSchema = z.object({
  title: z.string().describe("A concise title for the event"),
  summary: z.string().describe("A 1-2 sentence summary of the event"),
  // best to just use diary date for Phase 1 unless specific time is mentioned.
  tags: z.array(z.string()).describe("1-3 tags related to the event"),
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

    const contextPrompt = constructContextPrompt(existingPeople, existingTags);

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
