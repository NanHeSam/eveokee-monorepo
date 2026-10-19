import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAIClient } from "../convex/integrations/openai/client";
import { AIClient } from "../convex/integrations/ai/client";

afterEach(() => vi.unstubAllGlobals());

describe("AI Gateway transport", () => {
  it("sends vision files to the installed provider's v4 endpoint", async () => {
    // Keep the real AI SDK/provider: mocking generateText hid the v1/v4 mismatch.
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({
      content: [{ type: "text", text: "A cinematic lakeside moment." }],
      finishReason: { unified: "stop", raw: "end_turn" },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 5, text: 5, reasoning: 0 },
      },
      warnings: [],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new OpenAIClient({ apiKey: "test-key" }).generateImageVideoPrompt({
      lyrics: "Golden water", imageUrl: "https://example.com/photo.jpg",
    });

    expect(result).toBe("A cinematic lakeside moment.");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ai-gateway.vercel.sh/v4/ai/language-model");
    expect(new Headers(init.headers).get("ai-language-model-specification-version")).toBe("4");
    const body = JSON.parse(init.body as string);
    expect(body.prompt.find((message: { role: string }) => message.role === "user").content).toContainEqual(expect.objectContaining({
      type: "file",
      data: { type: "url", url: "https://example.com/photo.jpg" },
    }));
  });

  it("preserves an explicitly configured gateway endpoint", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ content: [], warnings: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await new AIClient({ apiKey: "test-key", baseURL: "https://gateway.example/v4/ai" })
      .getModel().doGenerate({ prompt: [] });
    expect(fetchMock.mock.calls[0][0]).toBe("https://gateway.example/v4/ai/language-model");
  });
});
