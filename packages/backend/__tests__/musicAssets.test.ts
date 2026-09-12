import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestEnvironment, createTestUser } from "./convexTestUtils";
import { internal } from "../convex/_generated/api";
import {
  isAllowedAssetUrl,
  isConvexStorageUrl,
  pickFreshTrackForMusic,
  uniqueNonEmpty,
} from "../convex/utils/musicAssets";

describe("musicAssets helpers", () => {
  it("recognises Convex storage URLs", () => {
    expect(isConvexStorageUrl("https://artful-tiger-110.convex.cloud/api/storage/abc")).toBe(true);
    expect(isConvexStorageUrl("https://cdn1.suno.ai/abc.mp3")).toBe(false);
  });

  it("only allows https URLs on known provider hosts", () => {
    expect(isAllowedAssetUrl("https://cdn1.suno.ai/a.mp3")).toBe(true);
    expect(isAllowedAssetUrl("https://tempfile.aiquickdraw.com/r/a.mp3")).toBe(true);
    expect(isAllowedAssetUrl("https://audiostream.api.box/stream/a.mp3")).toBe(true);
    expect(isAllowedAssetUrl("http://cdn1.suno.ai/a.mp3")).toBe(false);
    expect(isAllowedAssetUrl("https://evil.example/suno.ai/a.mp3")).toBe(false);
    expect(isAllowedAssetUrl("https://notsuno.ai/a.mp3")).toBe(false);
    expect(isAllowedAssetUrl("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isAllowedAssetUrl("https://user:pw@cdn1.suno.ai/a.mp3")).toBe(false);
    expect(isAllowedAssetUrl("not a url")).toBe(false);
  });

  it("dedupes candidates and drops empties", () => {
    expect(uniqueNonEmpty(["a", undefined, "", "b", "a", null])).toEqual(["a", "b"]);
  });

  it("matches provider tracks by clip id, then by position", () => {
    const tracks = [
      { id: "clip-0", audioUrl: "u0" },
      { id: "clip-1", audioUrl: "u1" },
    ];
    expect(pickFreshTrackForMusic(tracks, { audioId: "clip-1" })?.audioUrl).toBe("u1");
    expect(pickFreshTrackForMusic(tracks, { musicIndex: 0 })?.audioUrl).toBe("u0");
    expect(pickFreshTrackForMusic(tracks, { audioId: "unknown", musicIndex: 1 })?.audioUrl).toBe("u1");
    expect(pickFreshTrackForMusic(tracks, { audioId: "unknown", musicIndex: 5 })).toBeUndefined();
  });
});

describe("musicAssets.persistMusicAssets", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(routes: Record<string, { status: number; type: string; body: Uint8Array | string }>) {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const route = routes[url];
      if (!route) {
        return new Response("not found", { status: 404, headers: { "content-type": "text/plain" } });
      }
      return new Response(route.body, {
        status: route.status,
        headers: { "content-type": route.type },
      });
    }) as unknown as typeof fetch;
  }

  async function insertReadyMusic(
    t: ReturnType<typeof createTestEnvironment>,
    audioUrl: string,
    extra: Record<string, unknown> = {},
  ) {
    const { userId } = await createTestUser(t);
    return await t.run(async (ctx) => {
      const now = Date.now();
      return await ctx.db.insert("music", {
        userId,
        taskId: "task-1",
        musicIndex: 0,
        audioId: "clip-0",
        status: "ready",
        audioUrl,
        imageUrl: "https://cdn2.suno.ai/image_clip-0.jpeg",
        createdAt: now,
        updatedAt: now,
        ...extra,
      });
    });
  }

  it("falls through dead provider URLs, stores the first working one and rewrites audioUrl", async () => {
    const t = createTestEnvironment();
    const musicId = await insertReadyMusic(t, "https://cdn1.suno.ai/clip-0.mp3");
    mockFetch({
      "https://cdn1.suno.ai/clip-0.mp3": { status: 403, type: "text/xml", body: "<Error>MissingKey</Error>" },
      "https://tempfile.aiquickdraw.com/r/fresh.mp3": { status: 200, type: "audio/mpeg", body: new Uint8Array([1, 2, 3, 4]) },
      "https://cdn2.suno.ai/image_clip-0.jpeg": { status: 200, type: "image/jpeg", body: new Uint8Array([9, 9]) },
    });

    const result = await t.action(internal.musicAssets.persistMusicAssets, {
      musicId,
      audioCandidates: ["https://cdn1.suno.ai/clip-0.mp3", "https://tempfile.aiquickdraw.com/r/fresh.mp3"],
    });

    expect(result.audioStored).toBe(true);
    expect(result.imageStored).toBe(true);
    const music = await t.run((ctx) => ctx.db.get(musicId));
    expect(music?.audioStorageId).toBeDefined();
    expect(music?.imageStorageId).toBeDefined();
    expect(music?.audioUrl).not.toContain("suno.ai");
    expect(music?.imageUrl).not.toContain("suno.ai");
    const storedBytes = await t.run(async (ctx) => {
      const blob = await ctx.storage.get(music!.audioStorageId!);
      return blob ? (await blob.arrayBuffer()).byteLength : -1;
    });
    expect(storedBytes).toBe(4);
  });

  it("leaves the row untouched and reports failure when every URL is dead", async () => {
    const t = createTestEnvironment();
    const musicId = await insertReadyMusic(t, "https://cdn1.suno.ai/clip-0.mp3");
    mockFetch({});

    const result = await t.action(internal.musicAssets.persistMusicAssets, { musicId });

    expect(result.audioStored).toBe(false);
    expect(result.audioError).toMatch(/failed/);
    const music = await t.run((ctx) => ctx.db.get(musicId));
    expect(music?.audioUrl).toBe("https://cdn1.suno.ai/clip-0.mp3");
    expect(music?.audioStorageId).toBeUndefined();
  });

  it("is idempotent once assets are stored", async () => {
    const t = createTestEnvironment();
    const musicId = await insertReadyMusic(t, "https://cdn1.suno.ai/clip-0.mp3");
    mockFetch({
      "https://cdn1.suno.ai/clip-0.mp3": { status: 200, type: "audio/mpeg", body: new Uint8Array([1]) },
      "https://cdn2.suno.ai/image_clip-0.jpeg": { status: 200, type: "image/jpeg", body: new Uint8Array([1]) },
    });
    await t.action(internal.musicAssets.persistMusicAssets, { musicId });
    const second = await t.action(internal.musicAssets.persistMusicAssets, { musicId });
    expect(second.skipped).toBe("already-stored");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("listMusicNeedingRehost skips stored, deleted, and taskless rows", async () => {
    const t = createTestEnvironment();
    const pending = await insertReadyMusic(t, "https://cdn1.suno.ai/a.mp3");
    await insertReadyMusic(t, "https://x.convex.cloud/api/storage/a", { audioStorageId: undefined });
    const { userId } = await createTestUser(t);
    await t.run(async (ctx) => {
      const now = Date.now();
      const storageId = await ctx.storage.store(new Blob([new Uint8Array([1])]));
      await ctx.db.insert("music", { userId, taskId: "t2", status: "ready", audioStorageId: storageId, createdAt: now, updatedAt: now });
      await ctx.db.insert("music", { userId, taskId: "t3", status: "ready", deletedAt: now, createdAt: now, updatedAt: now });
      await ctx.db.insert("music", { userId, status: "ready", createdAt: now, updatedAt: now });
      await ctx.db.insert("music", { userId, taskId: "t4", status: "failed", createdAt: now, updatedAt: now });
    });

    const rows = await t.query(internal.musicAssets.listMusicNeedingRehost, { limit: 50 });
    const ids = rows.map((r: { _id: string }) => r._id);
    expect(ids).toContain(pending);
    expect(rows.every((r: { taskId: string }) => r.taskId.length > 0)).toBe(true);
    // `pending`, the storage-URL row that has no storageId yet, and the audio-only row (cover still missing)
    expect(rows).toHaveLength(3);
  });

  it("refuses to download from hosts outside the allowlist", async () => {
    const t = createTestEnvironment();
    const musicId = await insertReadyMusic(t, "https://cdn1.suno.ai/clip-0.mp3");
    mockFetch({
      "https://attacker.example/x.mp3": { status: 200, type: "audio/mpeg", body: new Uint8Array([1]) },
    });
    const result = await t.action(internal.musicAssets.persistMusicAssets, {
      musicId,
      audioCandidates: ["https://attacker.example/x.mp3"],
    });
    expect(result.audioStored).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalledWith("https://attacker.example/x.mp3", expect.anything());
  });

  it("does not overwrite assets attached by a concurrent writer", async () => {
    const t = createTestEnvironment();
    const musicId = await insertReadyMusic(t, "https://cdn1.suno.ai/clip-0.mp3");
    const existing = await t.run(async (ctx) => {
      const id = await ctx.storage.store(new Blob([new Uint8Array([7])]));
      await ctx.db.patch(musicId, { audioStorageId: id, imageStorageId: id });
      return id;
    });
    const result = await t.action(internal.musicAssets.persistMusicAssets, { musicId });
    expect(result.skipped).toBe("already-stored");
    const music = await t.run((ctx) => ctx.db.get(musicId));
    expect(music?.audioStorageId).toBe(existing);
  });

  it("migration stamps attempts so dead rows stop blocking the batch", async () => {
    const t = createTestEnvironment();
    const musicId = await insertReadyMusic(t, "https://cdn1.suno.ai/clip-0.mp3");
    await t.run((ctx) => ctx.db.patch(musicId, { assetRehostAttemptedAt: Date.now() }));
    const rows = await t.query(internal.musicAssets.listMusicNeedingRehost, { limit: 10 });
    expect(rows.map((r: { _id: string }) => r._id)).not.toContain(musicId);
    const retry = await t.query(internal.musicAssets.listMusicNeedingRehost, { limit: 10, includeAttempted: true });
    expect(retry.map((r: { _id: string }) => r._id)).toContain(musicId);
  });
});
