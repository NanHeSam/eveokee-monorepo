import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import { getOpenAIClient } from "../convex/integrations/openai/client";
import { createTestDiary, createTestEnvironment, createTestUser } from "./convexTestUtils";

vi.mock("../convex/integrations/openai/client", () => ({ getOpenAIClient: vi.fn() }));
const fetchMock = vi.fn();
const generateMusicData = vi.fn();

beforeEach(() => {
  vi.stubEnv("KIE_AI_API_KEY", "kie-test-key");
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
  vi.stubEnv("SUNO_WEBHOOK_SECRET", "music-secret");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  generateMusicData.mockReset().mockResolvedValue({ lyric: "[Verse] Skies", mood: "peaceful", style: "folk", title: "Skies" });
  vi.mocked(getOpenAIClient).mockReturnValue({ generateMusicData } as never);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function setup() {
  const t = createTestEnvironment();
  const { userId, subscriptionId } = await createTestUser(t, { musicGenerationsUsed: 1 });
  const diaryId = await createTestDiary(t, userId, "An evening walk");
  const args = {
    diary: { diaryId, userId, content: "An evening walk" },
    usageResult: { success: true, currentUsage: 1, remainingQuota: 4 },
  };
  return { t, args, subscriptionId };
}

describe("music generation action", () => {
  it("uses the Kie key and authenticated legacy callback route, and creates pending V6 rows", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 200, data: { taskId: "kie-task" } })));
    const { t, args } = await setup();
    expect(await t.action(internal.musicActions.requestSunoGeneration, args)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.kie.ai/api/v1/jobs/createTask");
    expect(request.headers.Authorization).toBe("Bearer kie-test-key");
    expect(JSON.parse(request.body)).toMatchObject({
      model: "ai-music-api/generate",
      callBackUrl: "https://test.convex.site/callback/suno-music-generation?token=music-secret",
      input: { custom_mode: true, model: "V6", duration: 120, lyrics: "[Verse] Skies", style: "peaceful, folk" },
    });
    const rows = await t.run((ctx) => ctx.db.query("music").withIndex("by_taskId", (q) => q.eq("taskId", "kie-task")).collect());
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.status === "pending")).toBe(true);
  });

  it("stores timed lyrics after the callback without starting another generation", async () => {
    const { t, args } = await setup();
    const musicId = await t.run((ctx) => ctx.db.insert("music", {
      userId: args.diary.userId, status: "ready", taskId: "kie-lyrics", audioId: "clip-1", createdAt: 1, updatedAt: 1,
    }));
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 200, data: { code: 200, data: {
      alignedWords: [{ word: "Sky", startS: 0, endS: 1, palign: 0, success: true }], waveformData: [0, 1], hootCer: 0,
    } } })));
    await t.action(internal.musicActions.fetchTimedLyrics, { taskId: "kie-lyrics" });
    const row = await t.run((ctx) => ctx.db.get(musicId));
    expect(row?.lyricWithTime?.alignedWords).toEqual([{ word: "Sky", startS: 0, endS: 1, palign: 0 }]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("ai-music-api/timeStamped-lyrics");
  });

  it.each(["SUNO_WEBHOOK_SECRET", "KIE_AI_API_KEY"])("fails before inference and refunds usage without %s", async (name) => {
    vi.stubEnv(name, "");
    const { t, args, subscriptionId } = await setup();
    await expect(t.action(internal.musicActions.requestSunoGeneration, args)).rejects.toThrow(name);
    expect(generateMusicData).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await t.run((ctx) => ctx.db.get(subscriptionId)))?.musicGenerationsUsed).toBe(0);
  });

  it("refunds a Kie 402 without retrying or creating pending rows", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 402, msg: "No credits" })));
    const { t, args, subscriptionId } = await setup();
    await expect(t.action(internal.musicActions.requestSunoGeneration, args)).rejects.toThrow("error code 402");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await t.run((ctx) => ctx.db.query("music").collect())).toEqual([]);
    expect((await t.run((ctx) => ctx.db.get(subscriptionId)))?.musicGenerationsUsed).toBe(0);
  });
});
