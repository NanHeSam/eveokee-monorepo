import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "../convex/_generated/api";
import { VIDEO_GENERATION_CALLBACK_PATH } from "../convex/utils/constants";
import { createKieClientFromEnv } from "../convex/integrations/kie/client";
import {
  computeKieWebhookSignature,
  verifyKieWebhookSignature,
} from "../convex/utils/webhookAuth";
import { createTestDiary, createTestEnvironment, createTestUser } from "./convexTestUtils";

const KIE_SECRET = "kie-test-secret-abcdef0123456789";
const KIE_HMAC_KEY = "kie-hmac-key-for-tests";
const VIDEO_URL = "https://tempfile.aiquickdraw.com/v/result.mp4";

describe("Kie HMAC signature", () => {
  it("matches Kie's documented algorithm", async () => {
    // base64(HMAC-SHA256("task_123.1700000000", "secret")), computed independently with openssl
    const signature = await computeKieWebhookSignature("task_123", "1700000000", "secret");
    expect(signature).toBe("tSoXDOtgWeIuZv6fkQS1TTzbjjxd8FiM6rwExKaFkN8=");
  });

  it("rejects missing, stale, future and wrong signatures", async () => {
    const now = 1_700_000_000_000;
    const ts = String(now / 1000);
    const good = await computeKieWebhookSignature("t1", ts, KIE_HMAC_KEY);
    const base = { taskId: "t1", hmacKey: KIE_HMAC_KEY, nowMs: now };

    expect(await verifyKieWebhookSignature({ ...base, timestamp: ts, signature: good })).toEqual({ valid: true });
    expect(await verifyKieWebhookSignature({ ...base, timestamp: null, signature: good })).toMatchObject({ reason: "missing_headers" });
    expect(await verifyKieWebhookSignature({ ...base, timestamp: "abc", signature: good })).toMatchObject({ reason: "bad_timestamp" });
    expect(await verifyKieWebhookSignature({ ...base, nowMs: now + 16 * 60_000, timestamp: ts, signature: good })).toMatchObject({ reason: "stale_timestamp" });
    expect(await verifyKieWebhookSignature({ ...base, nowMs: now - 6 * 60_000, timestamp: ts, signature: good })).toMatchObject({ reason: "stale_timestamp" });
    expect(await verifyKieWebhookSignature({ ...base, taskId: "t2", timestamp: ts, signature: good })).toMatchObject({ reason: "bad_signature" });
  });

  it("createKieClientFromEnv embeds the secret in the callback URL", () => {
    const client = createKieClientFromEnv({
      KIE_AI_API_KEY: "key",
      CONVEX_SITE_URL: "https://x.convex.site",
      CALLBACK_PATH: VIDEO_GENERATION_CALLBACK_PATH,
      WEBHOOK_SECRET: KIE_SECRET,
    });
    expect(client.getCallbackUrl()).toBe(`https://x.convex.site${VIDEO_GENERATION_CALLBACK_PATH}?token=${KIE_SECRET}`);
  });
});

function successPayload(taskId: string, videoUrl = VIDEO_URL) {
  return {
    code: 200,
    msg: "Playground task completed successfully.",
    data: {
      taskId,
      model: "bytedance/seedance-2-fast",
      state: "success",
      param: "{}",
      resultJson: JSON.stringify({ resultUrls: [videoUrl] }),
    },
  };
}

function failurePayload(taskId: string) {
  return {
    code: 501,
    msg: "Playground task failed.",
    data: { taskId, model: "bytedance/seedance-2-fast", state: "fail", param: "{}", failCode: "500", failMsg: "boom" },
  };
}

async function setupPendingVideo(taskId: string, musicGenerationsUsed = 3) {
  const t = createTestEnvironment();
  const { userId, subscriptionId } = await createTestUser(t, { musicGenerationsUsed });
  const diaryId = await createTestDiary(t, userId, "A private diary entry");
  const { musicIds } = await t.mutation(internal.music.createPendingMusicRecords, {
    diaryId,
    userId,
    taskId: `music-for-${taskId}`,
    prompt: "lyrics",
    model: "V6",
    trackCount: 1,
  });
  await t.mutation(internal.videos.createPendingVideoRecord, {
    musicId: musicIds[0],
    userId,
    kieTaskId: taskId,
    scriptPrompt: "script",
  });
  const readVideo = () =>
    t.run(async (ctx) =>
      ctx.db
        .query("musicVideos")
        .withIndex("by_kieTaskId", (q) => q.eq("kieTaskId", taskId))
        .first(),
    );
  const readUsage = () => t.run(async (ctx) => (await ctx.db.get(subscriptionId))?.musicGenerationsUsed);
  return { t, readVideo, readUsage };
}

async function postKie(
  t: ReturnType<typeof createTestEnvironment>,
  body: { data: { taskId: string } },
  opts: { token?: string; signed?: boolean | { signature: string; timestamp: string } } = {},
) {
  const path = opts.token
    ? `${VIDEO_GENERATION_CALLBACK_PATH}?token=${encodeURIComponent(opts.token)}`
    : VIDEO_GENERATION_CALLBACK_PATH;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.signed === true) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    headers["X-Webhook-Timestamp"] = timestamp;
    headers["X-Webhook-Signature"] = await computeKieWebhookSignature(body.data.taskId, timestamp, KIE_HMAC_KEY);
  } else if (opts.signed) {
    headers["X-Webhook-Timestamp"] = opts.signed.timestamp;
    headers["X-Webhook-Signature"] = opts.signed.signature;
  }
  return t.fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
}

describe("Kie video callback (HTTP)", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("KIE_WEBHOOK_SECRET", KIE_SECRET);
    vi.stubEnv("KIE_WEBHOOK_HMAC_KEY", "");
    fetchSpy = vi.fn(async () =>
      new Response(new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]), {
        headers: { "content-type": "video/mp4", "content-length": "8" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects an unauthenticated callback before any fetch or DB write", async () => {
    const { t, readVideo, readUsage } = await setupPendingVideo("kie-no-token");
    const res = await postKie(t, successPayload("kie-no-token"));
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((await readVideo())?.status).toBe("pending");
    expect(await readUsage()).toBe(3);
  });

  it("rejects a wrong token, including forged failure callbacks", async () => {
    const { t, readVideo, readUsage } = await setupPendingVideo("kie-bad-token");
    const res = await postKie(t, failurePayload("kie-bad-token"), { token: "wrong" });
    expect(res.status).toBe(401);
    expect((await readVideo())?.status).toBe("pending");
    expect(await readUsage()).toBe(3);
  });

  it("fails closed when the secret is not configured", async () => {
    vi.stubEnv("KIE_WEBHOOK_SECRET", "");
    const { t } = await setupPendingVideo("kie-no-secret");
    const res = await postKie(t, successPayload("kie-no-secret"), { token: "anything" });
    expect(res.status).toBe(500);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requires a valid HMAC signature when the key is configured", async () => {
    vi.stubEnv("KIE_WEBHOOK_HMAC_KEY", KIE_HMAC_KEY);
    const { t, readVideo } = await setupPendingVideo("kie-hmac");

    const unsigned = await postKie(t, successPayload("kie-hmac"), { token: KIE_SECRET });
    expect(unsigned.status).toBe(401);

    const forged = await postKie(t, successPayload("kie-hmac"), {
      token: KIE_SECRET,
      signed: { timestamp: String(Math.floor(Date.now() / 1000)), signature: "AAAA" },
    });
    expect(forged.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect((await readVideo())?.status).toBe("pending");

    const signed = await postKie(t, successPayload("kie-hmac"), { token: KIE_SECRET, signed: true });
    expect(signed.status).toBe(200);
    expect((await readVideo())?.status).toBe("ready");
  });

  it("stores the video on a valid callback (happy path)", async () => {
    const { t, readVideo } = await setupPendingVideo("kie-ok");
    const res = await postKie(t, successPayload("kie-ok"), { token: KIE_SECRET });
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe(VIDEO_URL);
    const video = await readVideo();
    expect(video?.status).toBe("ready");
    expect(video?.videoStorageId).toBeDefined();
    const storedSize = await t.run(async (ctx) => (await ctx.storage.get(video!.videoStorageId!))?.size ?? null);
    expect(storedSize).toBe(8);
  });

  it("refuses to download from a host that is not allowlisted", async () => {
    const { t, readVideo, readUsage } = await setupPendingVideo("kie-ssrf");
    const res = await postKie(t, successPayload("kie-ssrf", "https://169.254.169.254/latest/meta-data"), { token: KIE_SECRET });
    expect(res.status).toBe(500);
    expect(fetchSpy).not.toHaveBeenCalled();
    const video = await readVideo();
    expect(video?.status).toBe("failed");
    expect(video?.videoStorageId).toBeUndefined();
    expect(await readUsage()).toBe(0); // refunded
  });

  it("refuses an oversized download", async () => {
    fetchSpy.mockImplementation(async () =>
      new Response(new Uint8Array(4), {
        headers: { "content-type": "video/mp4", "content-length": String(500 * 1024 * 1024) },
      }),
    );
    const { t, readVideo } = await setupPendingVideo("kie-huge");
    const res = await postKie(t, successPayload("kie-huge"), { token: KIE_SECRET });
    expect(res.status).toBe(500);
    const video = await readVideo();
    expect(video?.status).toBe("failed");
    expect(video?.videoStorageId).toBeUndefined();
  });

  it("ignores callbacks for tasks that are not pending (no fetch, no refund)", async () => {
    const { t, readVideo, readUsage } = await setupPendingVideo("kie-replay");
    await postKie(t, successPayload("kie-replay"), { token: KIE_SECRET });
    const ready = await readVideo();
    expect(ready?.status).toBe("ready");
    fetchSpy.mockClear();

    const replay = await postKie(t, successPayload("kie-replay", "https://tempfile.aiquickdraw.com/v/other.mp4"), { token: KIE_SECRET });
    expect(await replay.json()).toEqual({ status: "ignored" });
    const lateFailure = await postKie(t, failurePayload("kie-replay"), { token: KIE_SECRET });
    expect(await lateFailure.json()).toEqual({ status: "ignored" });

    expect(fetchSpy).not.toHaveBeenCalled();
    const after = await readVideo();
    expect(after?.status).toBe("ready");
    expect(after?.videoStorageId).toBe(ready?.videoStorageId);
    expect(await readUsage()).toBe(3);
  });

  it("ignores callbacks for unknown tasks", async () => {
    const t = createTestEnvironment();
    const res = await postKie(t, successPayload("kie-unknown"), { token: KIE_SECRET });
    expect(await res.json()).toEqual({ status: "ignored" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("handles an authenticated failure callback with a refund", async () => {
    const { t, readVideo, readUsage } = await setupPendingVideo("kie-fail");
    const res = await postKie(t, failurePayload("kie-fail"), { token: KIE_SECRET });
    expect(await res.json()).toEqual({ status: "failure_handled" });
    expect((await readVideo())?.status).toBe("failed");
    expect(await readUsage()).toBe(0);
  });
});

describe("video mutations pending guards", () => {
  it("failVideoGeneration does not flip a ready video to failed", async () => {
    const { t, readVideo, readUsage } = await setupPendingVideo("kie-guard");
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob([new Uint8Array([1])])));
    await t.mutation(internal.videos.completeKieVideoTask, { kieTaskId: "kie-guard", videoStorageId: storageId });
    const result = await t.mutation(internal.videos.failVideoGeneration, { kieTaskId: "kie-guard" });
    expect(result).toEqual({ refunded: false, alreadyFailed: false });
    expect((await readVideo())?.status).toBe("ready");
    expect(await readUsage()).toBe(3);
  });

  it("completeKieVideoTask ignores a second completion and drops its blob", async () => {
    const { t, readVideo } = await setupPendingVideo("kie-guard-2");
    const first = await t.run(async (ctx) => ctx.storage.store(new Blob([new Uint8Array([1])])));
    const second = await t.run(async (ctx) => ctx.storage.store(new Blob([new Uint8Array([2])])));
    await t.mutation(internal.videos.completeKieVideoTask, { kieTaskId: "kie-guard-2", videoStorageId: first });
    await t.mutation(internal.videos.completeKieVideoTask, { kieTaskId: "kie-guard-2", videoStorageId: second });
    expect((await readVideo())?.videoStorageId).toBe(first);
    expect(await t.run(async (ctx) => (await ctx.storage.get(second)) === null)).toBe(true);
  });
});
