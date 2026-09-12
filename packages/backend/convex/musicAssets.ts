/**
 * Durable storage for generated music assets.
 *
 * The music provider serves audio and cover art from CDNs whose URLs are not
 * durable: hosts get rotated and older ones now require signed URLs. This
 * module copies each track's audio and image into Convex storage right after
 * generation, and provides a migration action that re-fetches fresh URLs from
 * the provider (by task ID) for tracks that were created before this existed.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { createSunoClientFromEnv } from "./integrations/suno/client";
import { MUSIC_GENERATION_CALLBACK_PATH } from "./utils/constants";
import {
  isConvexStorageUrl,
  pickFreshTrackForMusic,
  uniqueNonEmpty,
} from "./utils/musicAssets";

const MAX_ASSET_BYTES = 60 * 1024 * 1024; // generous cap; songs are ~3-6 MB
const DOWNLOAD_TIMEOUT_MS = 60_000;

/**
 * Download a URL into a Blob, validating status, content type and size.
 * Returns null (rather than throwing) when the URL is not usable so callers
 * can move on to the next candidate.
 */
async function downloadAsset(
  url: string,
  kind: "audio" | "image",
): Promise<{ blob: Blob; contentType: string } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return null;
    }
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const expectedPrefix = kind === "audio" ? "audio/" : "image/";
    // Some hosts serve mp3 as application/octet-stream; only reject clearly wrong types.
    if (contentType.startsWith("text/") || contentType.includes("json") || contentType.includes("xml")) {
      return null;
    }
    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_ASSET_BYTES) {
      return null;
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_ASSET_BYTES) {
      return null;
    }
    const type = contentType.startsWith(expectedPrefix)
      ? contentType.split(";")[0]
      : kind === "audio"
        ? "audio/mpeg"
        : "image/jpeg";
    return { blob: new Blob([buffer], { type }), contentType: type };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const getMusicForAssetPersist = internalQuery({
  args: { musicId: v.id("music") },
  returns: v.union(
    v.object({
      _id: v.id("music"),
      taskId: v.optional(v.string()),
      audioId: v.optional(v.string()),
      musicIndex: v.optional(v.number()),
      audioUrl: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      audioStorageId: v.optional(v.id("_storage")),
      imageStorageId: v.optional(v.id("_storage")),
      streamAudioUrl: v.optional(v.string()),
      sourceAudioUrl: v.optional(v.string()),
      sourceImageUrl: v.optional(v.string()),
      deleted: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const music = await ctx.db.get(args.musicId);
    if (!music) {
      return null;
    }
    return {
      _id: music._id,
      taskId: music.taskId,
      audioId: music.audioId,
      musicIndex: music.musicIndex,
      audioUrl: music.audioUrl,
      imageUrl: music.imageUrl,
      audioStorageId: music.audioStorageId,
      imageStorageId: music.imageStorageId,
      streamAudioUrl: music.metadata?.stream_audio_url,
      sourceAudioUrl: music.metadata?.source_audio_url,
      sourceImageUrl: music.metadata?.source_image_url,
      deleted: music.deletedAt !== undefined,
    };
  },
});

export const setStoredAssets = internalMutation({
  args: {
    musicId: v.id("music"),
    audioStorageId: v.optional(v.id("_storage")),
    audioUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
    imageUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const music = await ctx.db.get(args.musicId);
    if (!music) {
      return null;
    }
    const patch: Partial<Doc<"music">> = { updatedAt: Date.now() };
    if (args.audioStorageId && args.audioUrl) {
      patch.audioStorageId = args.audioStorageId;
      patch.audioUrl = args.audioUrl;
    }
    if (args.imageStorageId && args.imageUrl) {
      patch.imageStorageId = args.imageStorageId;
      patch.imageUrl = args.imageUrl;
    }
    await ctx.db.patch(args.musicId, patch);
    return null;
  },
});

/**
 * Rows that still point at provider URLs. Ordered oldest first so the
 * migration works through the backlog deterministically.
 */
export const listMusicNeedingRehost = internalQuery({
  args: { limit: v.number() },
  returns: v.array(
    v.object({
      _id: v.id("music"),
      taskId: v.string(),
      audioId: v.optional(v.string()),
      musicIndex: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const results: Array<{
      _id: Id<"music">;
      taskId: string;
      audioId?: string;
      musicIndex?: number;
    }> = [];
    const rows = ctx.db
      .query("music")
      .withIndex("by_status", (q) => q.eq("status", "ready"))
      .order("asc");
    for await (const music of rows) {
      if (music.deletedAt !== undefined) continue;
      if (music.audioStorageId !== undefined) continue;
      if (!music.taskId) continue;
      results.push({
        _id: music._id,
        taskId: music.taskId,
        audioId: music.audioId,
        musicIndex: music.musicIndex,
      });
      if (results.length >= args.limit) break;
    }
    return results;
  },
});

const persistResultValidator = v.object({
  musicId: v.id("music"),
  audioStored: v.boolean(),
  imageStored: v.boolean(),
  skipped: v.optional(v.string()),
  audioError: v.optional(v.string()),
  imageError: v.optional(v.string()),
});

/**
 * Copy a track's audio (and cover image) into Convex storage and point the
 * row's audioUrl/imageUrl at the stored files. Candidates are tried in order;
 * the row's own URLs are appended as a fallback. Idempotent: a row whose audio
 * is already in storage is skipped unless `force` is set.
 */
export const persistMusicAssets = internalAction({
  args: {
    musicId: v.id("music"),
    audioCandidates: v.optional(v.array(v.string())),
    imageCandidates: v.optional(v.array(v.string())),
    force: v.optional(v.boolean()),
  },
  returns: persistResultValidator,
  handler: async (ctx, args) => {
    const music = await ctx.runQuery(internal.musicAssets.getMusicForAssetPersist, {
      musicId: args.musicId,
    });
    if (!music || music.deleted) {
      return { musicId: args.musicId, audioStored: false, imageStored: false, skipped: "missing-or-deleted" };
    }

    const needAudio = args.force === true || music.audioStorageId === undefined;
    const needImage = args.force === true || music.imageStorageId === undefined;
    if (!needAudio && !needImage) {
      return { musicId: args.musicId, audioStored: false, imageStored: false, skipped: "already-stored" };
    }

    const audioCandidates = uniqueNonEmpty([
      ...(args.audioCandidates ?? []),
      music.audioUrl,
      music.streamAudioUrl,
      music.sourceAudioUrl,
    ]).filter((url) => !isConvexStorageUrl(url));
    const imageCandidates = uniqueNonEmpty([
      ...(args.imageCandidates ?? []),
      music.imageUrl,
      music.sourceImageUrl,
    ]).filter((url) => !isConvexStorageUrl(url));

    let audioStorageId: Id<"_storage"> | undefined;
    let audioUrl: string | undefined;
    let audioError: string | undefined;
    if (needAudio) {
      for (const candidate of audioCandidates) {
        const downloaded = await downloadAsset(candidate, "audio");
        if (!downloaded) continue;
        audioStorageId = await ctx.storage.store(downloaded.blob);
        audioUrl = (await ctx.storage.getUrl(audioStorageId)) ?? undefined;
        if (audioUrl) break;
      }
      if (!audioStorageId || !audioUrl) {
        audioError =
          audioCandidates.length === 0 ? "no-audio-url" : `all ${audioCandidates.length} audio URLs failed`;
      }
    }

    let imageStorageId: Id<"_storage"> | undefined;
    let imageUrl: string | undefined;
    let imageError: string | undefined;
    if (needImage) {
      for (const candidate of imageCandidates) {
        const downloaded = await downloadAsset(candidate, "image");
        if (!downloaded) continue;
        imageStorageId = await ctx.storage.store(downloaded.blob);
        imageUrl = (await ctx.storage.getUrl(imageStorageId)) ?? undefined;
        if (imageUrl) break;
      }
      if (!imageStorageId || !imageUrl) {
        imageError =
          imageCandidates.length === 0 ? "no-image-url" : `all ${imageCandidates.length} image URLs failed`;
      }
    }

    if (audioStorageId || imageStorageId) {
      await ctx.runMutation(internal.musicAssets.setStoredAssets, {
        musicId: args.musicId,
        audioStorageId,
        audioUrl,
        imageStorageId,
        imageUrl,
      });
    }

    return {
      musicId: args.musicId,
      audioStored: audioStorageId !== undefined,
      imageStored: imageStorageId !== undefined,
      audioError,
      imageError,
    };
  },
});

/**
 * One-time migration: for tracks still pointing at provider URLs, ask the
 * provider for the task's current record (fresh URLs), then persist the assets
 * into Convex storage. Processes up to `limit` rows per invocation so it fits
 * within action time limits; run repeatedly until it reports zero candidates.
 *
 * Run with: npx convex run musicAssets:rehostMusicFromProvider '{"limit": 20}' [--prod]
 */
export const rehostMusicFromProvider = internalAction({
  args: {
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    candidates: v.number(),
    tasksQueried: v.number(),
    results: v.array(
      v.object({
        musicId: v.id("music"),
        taskId: v.string(),
        outcome: v.string(),
        detail: v.optional(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const dryRun = args.dryRun ?? false;
    const rows = await ctx.runQuery(internal.musicAssets.listMusicNeedingRehost, { limit });

    const sunoClient = createSunoClientFromEnv({
      SUNO_API_KEY: process.env.SUNO_API_KEY,
      CONVEX_SITE_URL: process.env.CONVEX_SITE_URL,
      CALLBACK_PATH: MUSIC_GENERATION_CALLBACK_PATH,
      SUNO_TIMEOUT: process.env.SUNO_TIMEOUT,
    });

    const byTask = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byTask.get(row.taskId) ?? [];
      list.push(row);
      byTask.set(row.taskId, list);
    }

    const results: Array<{ musicId: Id<"music">; taskId: string; outcome: string; detail?: string }> = [];
    let tasksQueried = 0;

    for (const [taskId, taskRows] of byTask) {
      let tracks: Awaited<ReturnType<typeof sunoClient.getRecordInfo>>["tracks"] = [];
      try {
        const info = await sunoClient.getRecordInfo(taskId);
        tracks = info.tracks;
        tasksQueried += 1;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        for (const row of taskRows) {
          results.push({ musicId: row._id, taskId, outcome: "record-info-failed", detail });
        }
        continue;
      }

      for (const row of taskRows) {
        const fresh = pickFreshTrackForMusic(tracks, row);
        if (!fresh) {
          results.push({ musicId: row._id, taskId, outcome: "no-matching-track" });
          continue;
        }
        const audioCandidates = uniqueNonEmpty([
          fresh.audioUrl,
          fresh.sourceAudioUrl,
          fresh.streamAudioUrl,
          fresh.sourceStreamAudioUrl,
        ]);
        const imageCandidates = uniqueNonEmpty([fresh.imageUrl, fresh.sourceImageUrl]);

        if (dryRun) {
          results.push({
            musicId: row._id,
            taskId,
            outcome: "would-persist",
            detail: audioCandidates[0],
          });
          continue;
        }

        const persisted = await ctx.runAction(internal.musicAssets.persistMusicAssets, {
          musicId: row._id,
          audioCandidates,
          imageCandidates,
        });
        results.push({
          musicId: row._id,
          taskId,
          outcome: persisted.audioStored ? "persisted" : "audio-failed",
          detail: [persisted.audioError, persisted.imageError].filter(Boolean).join("; ") || undefined,
        });
      }
    }

    return { candidates: rows.length, tasksQueried, results };
  },
});
