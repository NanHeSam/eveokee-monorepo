import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import { MUSIC_GENERATION_CALLBACK_PATH } from "../convex/utils/constants";
import {
  appendWebhookToken,
  extractWebhookToken,
  hasValidWebhookToken,
  timingSafeEqualString,
} from "../convex/utils/webhookAuth";
import { createKieMusicClientFromEnv } from "../convex/integrations/kie/musicClient";
import { createTestDiary, createTestEnvironment, createTestUser } from "./convexTestUtils";

const SUNO_SECRET = "suno-test-secret-0123456789abcdef";

describe("webhookAuth helpers", () => {
  it("timingSafeEqualString compares exactly", () => {
    expect(timingSafeEqualString("abc", "abc")).toBe(true);
    expect(timingSafeEqualString("abc", "abd")).toBe(false);
    expect(timingSafeEqualString("abc", "abcd")).toBe(false);
    expect(timingSafeEqualString("", "a")).toBe(false);
    expect(timingSafeEqualString("ü", "u")).toBe(false);
  });

  it("round-trips the token through a callback URL", () => {
    const url = appendWebhookToken("https://x.convex.site/callback/suno", "s3cr3t/+=");
    expect(extractWebhookToken(url)).toBe("s3cr3t/+=");
    expect(hasValidWebhookToken(url, "s3cr3t/+=")).toBe(true);
    expect(hasValidWebhookToken(url, "other")).toBe(false);
    expect(hasValidWebhookToken("https://x.convex.site/callback/suno", "s3cr3t/+=")).toBe(false);
  });

  it("createKieMusicClientFromEnv embeds the secret in the callback URL only when given", () => {
    const base = {
      KIE_AI_API_KEY: "key",
      CONVEX_SITE_URL: "https://x.convex.site/",
      CALLBACK_PATH: MUSIC_GENERATION_CALLBACK_PATH,
    };
    const signed = createKieMusicClientFromEnv({ ...base, WEBHOOK_SECRET: SUNO_SECRET });
    expect(signed.getCallbackUrl()).toBe(
      `https://x.convex.site${MUSIC_GENERATION_CALLBACK_PATH}?token=${SUNO_SECRET}`,
    );
    expect(createKieMusicClientFromEnv(base).getCallbackUrl()).toBe(
      `https://x.convex.site${MUSIC_GENERATION_CALLBACK_PATH}`,
    );
  });
});

function sunoCompletePayload(taskId: string) {
  return {
    code: 200,
    msg: "success",
    data: {
      callbackType: "complete",
      task_id: taskId,
      data: [
        { id: "clip-1", title: "Forged?", duration: 180, audio_url: "https://cdn1.suno.ai/a.mp3" },
        { id: "clip-2", title: "Second", duration: 170, audio_url: "https://cdn1.suno.ai/b.mp3" },
      ],
    },
  };
}

async function setupPendingSunoTask(taskId: string) {
  const t = createTestEnvironment();
  const { userId } = await createTestUser(t);
  const diaryId = await createTestDiary(t, userId, "A private diary entry");
  await t.mutation(internal.music.createPendingMusicRecords, {
    diaryId,
    userId,
    taskId,
    prompt: "lyrics",
    model: "V6",
    trackCount: 2,
  });
  const readRows = () =>
    t.run(async (ctx) =>
      ctx.db
        .query("music")
        .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
        .collect(),
    );
  return { t, readRows };
}

function postSuno(
  t: ReturnType<typeof createTestEnvironment>,
  body: unknown,
  token?: string,
) {
  const path = token
    ? `${MUSIC_GENERATION_CALLBACK_PATH}?token=${encodeURIComponent(token)}`
    : MUSIC_GENERATION_CALLBACK_PATH;
  return t.fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Suno callback authentication (HTTP)", () => {
  const fetchSpy = vi.fn(async (..._args: Parameters<typeof fetch>) => new Response("unexpected outbound fetch", { status: 599 }));

  beforeEach(() => {
    vi.stubEnv("SUNO_WEBHOOK_SECRET", SUNO_SECRET);
    vi.stubEnv("CONVEX_SITE_URL", "");
    vi.stubGlobal("fetch", fetchSpy);
    fetchSpy.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects a callback without a token and leaves the task untouched", async () => {
    const { t, readRows } = await setupPendingSunoTask("suno-no-token");
    const res = await postSuno(t, sunoCompletePayload("suno-no-token"));
    expect(res.status).toBe(401);
    const rows = await readRows();
    expect(rows.every((r) => r.status === "pending")).toBe(true);
    expect(rows.every((r) => r.title === undefined)).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a callback with the wrong token", async () => {
    const { t, readRows } = await setupPendingSunoTask("suno-bad-token");
    const res = await postSuno(t, sunoCompletePayload("suno-bad-token"), "not-the-secret");
    expect(res.status).toBe(401);
    expect((await readRows()).every((r) => r.status === "pending")).toBe(true);
  });

  it("fails closed when the secret is not configured", async () => {
    vi.stubEnv("SUNO_WEBHOOK_SECRET", "");
    const { t, readRows } = await setupPendingSunoTask("suno-no-secret");
    const res = await postSuno(t, sunoCompletePayload("suno-no-secret"), "anything");
    expect(res.status).toBe(500);
    expect((await readRows()).every((r) => r.status === "pending")).toBe(true);
  });

  it("rejects before parsing the body", async () => {
    const t = createTestEnvironment();
    const res = await t.fetch(MUSIC_GENERATION_CALLBACK_PATH, { method: "POST", body: "not json" });
    expect(res.status).toBe(401);
  });

  it("accepts a callback with the right token and completes the task", async () => {
    const { t, readRows } = await setupPendingSunoTask("suno-good-token");
    const res = await postSuno(t, sunoCompletePayload("suno-good-token"), SUNO_SECRET);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    const rows = (await readRows()).sort((a, b) => (a.musicIndex ?? 0) - (b.musicIndex ?? 0));
    expect(rows.map((r) => r.status)).toEqual(["ready", "ready"]);
    expect(rows[0].audioId).toBe("clip-1");
  });

  it("accepts an authenticated unified Kie music callback without source URLs", async () => {
    const { t, readRows } = await setupPendingSunoTask("kie-jobs");
    const res = await postSuno(t, { code: 200, data: { taskId: "kie-jobs", state: "success", resultJson: JSON.stringify({ data: [
      { id: "kie-1", audio_url: "https://musicfile.kie.ai/a.mp3" },
      { id: "kie-2", audio_url: "https://musicfile.kie.ai/b.mp3" },
    ] }) } }, SUNO_SECRET);
    expect(res.status).toBe(200);
    expect((await readRows()).map((row) => row.status)).toEqual(["ready", "ready"]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(["text", "first"])("ignores intermediate %s callback and keeps rows pending", async (callbackType) => {
    const { t, readRows } = await setupPendingSunoTask("kie-intermediate");
    const res = await postSuno(t, { code: 200, data: { task_id: "kie-intermediate", callbackType } }, SUNO_SECRET);
    expect(await res.json()).toEqual({ status: "ignored" });
    expect((await readRows()).every((row) => row.status === "pending")).toBe(true);
  });

  it("marks failed unified Kie tasks failed without fetching media", async () => {
    const { t, readRows } = await setupPendingSunoTask("kie-failed");
    const res = await postSuno(t, { code: 200, data: { taskId: "kie-failed", state: "fail", failMsg: "No audio" } }, SUNO_SECRET);
    expect(res.status).toBe(200);
    expect((await readRows()).every((row) => row.status === "failed")).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("re-fetches structured music details for generic resultUrls callbacks", async () => {
    vi.stubEnv("KIE_AI_API_KEY", "test-key");
    vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ code: 200, data: { state: "success", response: { data: [
      { id: "a", audio_url: "https://musicfile.kie.ai/a.mp3" },
      { id: "b", audio_url: "https://musicfile.kie.ai/b.mp3" },
    ] } } })));
    const { t, readRows } = await setupPendingSunoTask("kie-urls");
    const res = await postSuno(t, { code: 200, data: { taskId: "kie-urls", state: "success", resultJson: JSON.stringify({ resultUrls: ["https://musicfile.kie.ai/a.mp3"] }) } }, SUNO_SECRET);
    expect(res.status).toBe(200);
    expect(fetchSpy.mock.calls[0][0]).toContain("https://api.kie.ai/api/v1/jobs/recordInfo?");
    expect((await readRows()).every((row) => row.status === "ready")).toBe(true);
  });

  it("ignores a valid callback for a task that is no longer pending", async () => {
    const { t, readRows } = await setupPendingSunoTask("suno-replay");
    await postSuno(t, sunoCompletePayload("suno-replay"), SUNO_SECRET);
    const before = await readRows();

    const replay = sunoCompletePayload("suno-replay");
    replay.data.data[0].title = "Overwritten";
    replay.data.data[0].audio_url = "https://cdn1.suno.ai/other.mp3";
    const res = await postSuno(t, replay, SUNO_SECRET);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ignored" });

    const after = await readRows();
    expect(after.map((r) => [r.title, r.audioUrl, r.updatedAt])).toEqual(
      before.map((r) => [r.title, r.audioUrl, r.updatedAt]),
    );
  });
});

describe("completeSunoTask pending guard", () => {
  it("does not overwrite rows that are no longer pending", async () => {
    const { t, readRows } = await setupPendingSunoTask("suno-guard");
    await t.mutation(internal.music.completeSunoTask, {
      taskId: "suno-guard",
      tracks: [{ id: "a", title: "First" }, { id: "b", title: "Second" }],
    });
    await t.mutation(internal.music.completeSunoTask, {
      taskId: "suno-guard",
      tracks: [{ id: "x", title: "Forged" }, { id: "y", title: "Forged" }],
    });
    const rows = await readRows();
    expect(rows.map((r) => r.title).sort()).toEqual(["First", "Second"]);
  });
});
