import { internalMutation, mutation, query } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import ensureCurrentUser from "./users";

const sunoTrackValidator = v.object({
  id: v.optional(v.string()),
  audio_url: v.optional(v.string()),
  source_audio_url: v.optional(v.string()),
  stream_audio_url: v.optional(v.string()),
  source_stream_audio_url: v.optional(v.string()),
  image_url: v.optional(v.string()),
  source_image_url: v.optional(v.string()),
  prompt: v.optional(v.string()),
  model_name: v.optional(v.string()),
  title: v.optional(v.string()),
  tags: v.optional(v.string()),
  duration: v.optional(v.number()),
  createTime: v.optional(v.union(v.number(), v.string())),
});

export const startDiaryMusicGeneration = mutation({
  args: {
    content: v.string(),
    diaryId: v.optional(v.id("diaries")),
  },
  returns: v.object({
    diaryId: v.id("diaries"),
    success: v.boolean(),
    reason: v.optional(v.string()),
    remainingQuota: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const trimmed = args.content.trim();
    if (trimmed.length === 0) {
      throw new Error("Content cannot be empty");
    }

    const { userId } = await ensureCurrentUser(ctx);

    // First, create or update the diary entry
    let diaryId: Id<"diaries">;

    if (args.diaryId) {
      await ctx.runMutation(api.diaries.updateDiary, {
        diaryId: args.diaryId,
        content: trimmed,
      });
      diaryId = args.diaryId;
    } else {
      const { _id } = await ctx.runMutation(api.diaries.createDiary, {
        content: trimmed,
      });
      diaryId = _id;
    }

    // Check if there's already a pending music generation for this diary
    const pendingMusic = await ctx.db
      .query("music")
      .withIndex("by_diaryId", (q) => q.eq("diaryId", diaryId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (pendingMusic) {
      return {
        diaryId,
        success: false,
        reason: "Music generation already in progress for this diary",
        remainingQuota: undefined,
      };
    }

    // Check usage limit and increment counter for music generation
    const usageResult = await ctx.runMutation(
      internal.usage.recordMusicGeneration,
      {
      userId,
      },
    );

    // If usage limit reached, return error but diary was still created/updated
    if (!usageResult.success) {
      return {
        diaryId,
        success: false,
        reason: usageResult.reason,
        remainingQuota: usageResult.remainingQuota,
      };
    }

    // Schedule music generation with usage tracking info
    await ctx.scheduler.runAfter(0, internal.musicActions.requestSunoGeneration, {
      diary: {
        diaryId,
        userId,
        content: trimmed,
      },
      usageResult: {
        success: usageResult.success,
        currentUsage: usageResult.currentUsage,
        remainingQuota: usageResult.remainingQuota,
      },
    });

    return { 
      diaryId,
      success: true,
      remainingQuota: usageResult.remainingQuota,
    };
  },
});

export const createPendingMusicRecords = internalMutation({
  args: {
    diaryId: v.id("diaries"),
    userId: v.id("users"),
    taskId: v.string(),
    prompt: v.string(),
    model: v.string(),
    trackCount: v.number(),
  },
  returns: v.object({
    musicIds: v.array(v.id("music")),
  }),
  handler: async (ctx, args) => {
    if (args.trackCount <= 0) {
      throw new Error("trackCount must be positive");
    }

    const existing = await ctx.db
      .query("music")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();
    if (existing.length > 0) {
      return { musicIds: existing.map((doc) => doc._id) };
    }

    const now = Date.now();
    const ids: Array<Id<"music">> = [];

    for (let index = 0; index < args.trackCount; index += 1) {
      const musicId = await ctx.db.insert("music", {
        userId: args.userId,
        diaryId: args.diaryId,
        taskId: args.taskId,
        musicIndex: index,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      });
      ids.push(musicId);
    }

    return { musicIds: ids };
  },
});

export const completeSunoTask = internalMutation({
  args: {
    taskId: v.string(),
    tracks: v.array(sunoTrackValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const pending = await ctx.db
      .query("music")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();

    if (pending.length === 0) {
      console.warn(`No pending music records found for taskId ${args.taskId}`);
      return null;
    }

    const sortedPending = [...pending].sort((a, b) => {
      const indexA = a.musicIndex ?? 9007199254740991;
      const indexB = b.musicIndex ?? 9007199254740991;
      return indexA - indexB;
    });

    const now = Date.now();

    if (args.tracks.length > sortedPending.length) {
      console.warn(
        `Received ${args.tracks.length} tracks but only ${sortedPending.length} pending records for taskId ${args.taskId}`,
      );
    }

    await Promise.all(
      sortedPending.map(async (doc, index) => {
        const track = args.tracks[index];
        if (!track) {
          await ctx.db.patch(doc._id, {
            status: "failed",
            updatedAt: now,
          });
          return;
        }

        const metadata: {
          data: unknown;
          id?: string;
          source_audio_url?: string;
          stream_audio_url?: string;
          source_stream_audio_url?: string;
          source_image_url?: string;
          model_name?: string;
          createTime?: number;
          prompt?: string;
          tags?: string;
        } = {
          data: track,
        };

        if (track.id) {
          metadata.id = track.id;
        }
        if (track.source_audio_url) {
          metadata.source_audio_url = track.source_audio_url;
        }
        if (track.stream_audio_url) {
          metadata.stream_audio_url = track.stream_audio_url;
        }
        if (track.source_stream_audio_url) {
          metadata.source_stream_audio_url = track.source_stream_audio_url;
        }
        if (track.source_image_url) {
          metadata.source_image_url = track.source_image_url;
        }
        if (track.model_name) {
          metadata.model_name = track.model_name;
        }
        if (track.prompt) {
          metadata.prompt = track.prompt;
        }
        if (track.tags) {
          metadata.tags = track.tags;
        }

        const createTimeValue = track.createTime;
        if (typeof createTimeValue === "number") {
          metadata.createTime = createTimeValue;
        } else if (typeof createTimeValue === "string") {
          const numeric = Number(createTimeValue);
          if (!isNaN(numeric)) {
            metadata.createTime = numeric;
          } else {
            const parsed = Date.parse(createTimeValue);
            if (!isNaN(parsed)) {
              metadata.createTime = parsed;
            }
          }
        }

        const patch: Record<string, unknown> = {
          status: "ready",
          updatedAt: now,
          metadata,
        };

        if (track.id) {
          patch.audioId = track.id;
        }
        if (track.audio_url) {
          patch.audioUrl = track.source_audio_url;
        }
        if (track.image_url) {
          patch.imageUrl = track.source_image_url;
        }
        if (typeof track.duration === "number") {
          patch.duration = track.duration;
        }
        if (track.title) {
          patch.title = track.title;
        }
        if (track.prompt) {
          patch.lyric = track.prompt;
        }

        await ctx.db.patch(doc._id, patch);
      }),
    );

    if (args.tracks.length < sortedPending.length) {
      const missing = sortedPending.slice(args.tracks.length);
      await Promise.all(
        missing.map((doc) =>
          ctx.db.patch(doc._id, {
            status: "failed",
            updatedAt: now,
          }),
        ),
      );
    }

    let musicIndex0 = undefined;
    for (const doc of sortedPending) {
      if (doc.musicIndex === 0) {
        musicIndex0 = doc;
        break;
      }
    }
    if (musicIndex0 && musicIndex0.diaryId && args.tracks[0]) {
      await ctx.db.patch(musicIndex0.diaryId, {
        primaryMusicId: musicIndex0._id,
        updatedAt: now,
      });
    }

    return null;
  },
});

export const softDeleteMusic = mutation({
  args: {
    musicId: v.id("music"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await ensureCurrentUser(ctx);

    const music = await ctx.db.get(args.musicId);
    if (!music) {
      throw new Error("Music not found");
    }

    if (music.userId !== userId) {
      throw new Error("Not authorized to delete this music");
    }

    if (music.deletedAt) {
      throw new Error("Music already deleted");
    }
    const now = Date.now();
    await ctx.db.patch(args.musicId, {
      deletedAt: now,
      updatedAt: now,
    });

    return null;
  },
});

export const listPlaylistMusic = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("music"),
      diaryId: v.optional(v.id("diaries")),
      title: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      audioUrl: v.optional(v.string()),
      duration: v.optional(v.number()),
      lyric: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("ready"),
        v.literal("failed"),
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
      diaryDate: v.optional(v.number()),
      diaryContent: v.optional(v.string()),
      diaryTitle: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const { userId } = await ensureCurrentUser(ctx);

    const docs = await ctx.db
      .query("music")
      .withIndex("by_userId_and_musicIndex", (q) =>
        q.eq("userId", userId).eq("musicIndex", 0),
      )
      .order("desc")
      .collect();

    const activeDocs = docs.filter((doc) => doc.deletedAt === undefined);

    const diaryIds = activeDocs
      .map((doc) => doc.diaryId)
      .filter((id): id is Id<"diaries"> => id !== undefined);
    const uniqueDiaryIds: Id<"diaries">[] = [];
    const seen: Record<string, boolean> = {};
    for (const id of diaryIds) {
      if (!seen[id]) {
        seen[id] = true;
        uniqueDiaryIds.push(id);
      }
    }

    const diaryDataById = new Map<Id<"diaries">, { date: number; content: string; title?: string }>();

    await Promise.all(
      uniqueDiaryIds.map(async (diaryId) => {
        const diary = await ctx.db.get(diaryId);
        if (diary) {
          diaryDataById.set(diaryId, {
            date: diary.date,
            content: diary.content,
            title: diary.title,
          });
        }
      }),
    );

    return activeDocs.map((doc) => {
      const imageUrl = doc.imageUrl ?? doc.metadata?.source_image_url;
      const audioUrl =
        doc.audioUrl ??
        doc.metadata?.stream_audio_url ??
        doc.metadata?.source_audio_url;

      const diaryData = doc.diaryId ? diaryDataById.get(doc.diaryId) : undefined;

      return {
        _id: doc._id,
        diaryId: doc.diaryId ?? undefined,
        title: doc.title ?? undefined,
        imageUrl: imageUrl ?? undefined,
        audioUrl: audioUrl ?? undefined,
        duration: doc.duration ?? undefined,
        lyric: doc.lyric ?? undefined,
        status: doc.status,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        diaryDate: diaryData?.date,
        diaryContent: diaryData?.content,
        diaryTitle: diaryData?.title,
      };
    });
  },
});

