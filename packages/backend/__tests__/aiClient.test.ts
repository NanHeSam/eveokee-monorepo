import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateObject, generateText } from "ai";
import { createGateway } from "@ai-sdk/gateway";
import { AIClient } from "../convex/integrations/ai/client";
import { OpenAIClient, createOpenAIClientFromEnv } from "../convex/integrations/openai/client";
import { extractEventsFromDiary, generateRelationshipHighlight } from "../convex/memory/util";

vi.mock("ai", () => ({ generateText: vi.fn(), generateObject: vi.fn() }));
vi.mock("@ai-sdk/gateway", () => ({
  createGateway: vi.fn(() => (modelId: string) => ({ modelId })),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllEnvs());

describe("AI Gateway migration", () => {
  it("uses a Gateway key and the verified default model", () => {
    const client = new AIClient({ apiKey: "gateway-test-key" });
    expect(createGateway).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "gateway-test-key" }));
    expect(client.getModel()).toEqual({ modelId: "anthropic/claude-haiku-5.5" });
    expect(() => createOpenAIClientFromEnv({ OPENAI_API_KEY: "provider-key" })).toThrow("AI_GATEWAY_API_KEY");
    expect(() => createOpenAIClientFromEnv({ AI_GATEWAY_API_KEY: "key", AI_GATEWAY_TIMEOUT: "NaN" })).toThrow("positive number");
  });

  it("keeps diary text and video prompt return contracts and a request deadline", async () => {
    vi.mocked(generateText).mockResolvedValue({ text: "  A quiet afternoon.  " } as never);
    const client = createOpenAIClientFromEnv({ AI_GATEWAY_API_KEY: "key", AI_GATEWAY_TIMEOUT: "1234" });
    expect(await client.generateDiary({ transcript: "Had a quiet day." })).toBe("A quiet afternoon.");
    expect(generateText).toHaveBeenLastCalledWith(expect.objectContaining({
      model: { modelId: "anthropic/claude-haiku-5.5" }, abortSignal: expect.any(AbortSignal),
    }));
    expect(await client.generateVideoScript({ lyrics: "Quiet skies", songTitle: "Quiet", diaryEntry: "A quiet day" })).toBe("A quiet afternoon.");
    expect(generateText).toHaveBeenLastCalledWith(expect.objectContaining({ model: { modelId: "anthropic/claude-sonnet-5.5" } }));
  });

  it("passes the diary photo as an AI SDK image to the vision model", async () => {
    vi.mocked(generateText).mockResolvedValue({ text: "A cinematic moment" } as never);
    const client = new OpenAIClient({ apiKey: "key" });
    expect(await client.generateImageVideoPrompt({ lyrics: "Skies", imageUrl: "https://example.com/photo.jpg" })).toBe("A cinematic moment");
    const request = vi.mocked(generateText).mock.calls[0][0];
    expect(request.model).toEqual({ modelId: "anthropic/claude-sonnet-5.5" });
    expect(request.messages?.[1].content).toEqual([
      expect.objectContaining({ type: "text" }),
      { type: "image", image: new URL("https://example.com/photo.jpg") },
    ]);
  });

  it("validates song fields and preserves the caller's exact style", async () => {
    const song = { lyric: "[Verse] Clear skies", mood: "peaceful", title: "Skies", style: "pop" };
    vi.mocked(generateObject).mockResolvedValue({ object: { ...song } } as never);
    const client = new OpenAIClient({ apiKey: "key" });
    expect(await client.generateMusicData({ diaryContent: "A walk", style: "  lo-fi, jazz  " })).toEqual({ ...song, style: "lo-fi, jazz" });
    const request = vi.mocked(generateObject).mock.calls[0][0];
    expect(request.model).toEqual({ modelId: "anthropic/claude-sonnet-5.5" });
    // The real SDK validates with this schema; malformed outputs must be rejected.
    const schema = request.schema as { safeParse: (value: unknown) => { success: boolean } };
    expect(schema.safeParse(song).success).toBe(true);
    expect(schema.safeParse({ ...song, lyric: 42 }).success).toBe(false);
    expect(schema.safeParse({ title: "Only a title" }).success).toBe(false);
  });

  it("returns a bounded string array for structured tags", async () => {
    vi.mocked(generateObject).mockResolvedValue({ object: { tags: ["AI", "Music", "Diary", "Art", "Life", "Extra"] } } as never);
    expect(await new OpenAIClient({ apiKey: "key" }).extractTags({ title: "Music", content: "A diary" })).toEqual(["AI", "Music", "Diary", "Art", "Life"]);
    expect(generateObject).toHaveBeenCalledWith(expect.objectContaining({ model: { modelId: "anthropic/claude-haiku-5.5" } }));
  });

  it.each(["AI_JSONParseError", "AI_TypeValidationError", "AI_NoObjectGeneratedError", "AI_APICallError"])("does not expose private model output from %s", async (name) => {
    const error = Object.assign(new Error("private diary text"), { name, requestBody: "private diary text" });
    vi.mocked(generateObject).mockRejectedValue(error);
    await expect(new OpenAIClient({ apiKey: "key" }).generateMusicData({ diaryContent: "Private" })).rejects.toThrow(`OpenAI music generation failed: ${name}`);
    await expect(new OpenAIClient({ apiKey: "key" }).extractTags({ title: "Private", content: "Private" })).rejects.not.toThrow("private diary text");
  });

  it("rejects empty text rather than returning an unusable diary", async () => {
    vi.mocked(generateText).mockResolvedValue({ text: "" } as never);
    await expect(new OpenAIClient({ apiKey: "key" }).generateDiary({ transcript: "Today" })).rejects.toThrow("Empty response");
  });

  it("routes memory extraction and relationship highlights through Haiku", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "memory-test-key");
    vi.mocked(generateObject).mockResolvedValueOnce({ object: [{
      title: "Walk", summary: "I walked with Sam", tags: ["walk"], people: ["Sam"], mood: "positive", arousal: "relaxed",
    }] } as never).mockResolvedValueOnce({ object: { highlight: "  I walk with Sam.  " } } as never);
    const events = await extractEventsFromDiary("I walked with Sam", 1234);
    expect(events[0]).toMatchObject({ happenedAt: 1234, mood: 1, arousal: 2 });
    expect(await generateRelationshipHighlight("Sam", events)).toBe("I walk with Sam.");
    for (const [request] of vi.mocked(generateObject).mock.calls) {
      expect(request.model).toEqual({ modelId: "anthropic/claude-haiku-5.5" });
      expect(request.abortSignal).toBeInstanceOf(AbortSignal);
    }
  });
});
