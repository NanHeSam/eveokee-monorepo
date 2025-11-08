import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import ensureCurrentUser, { getOptionalCurrentUser } from "./users";
import { MAX_SAFE_MUSIC_INDEX } from "./utils/constants";

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

/**
 * Start music generation for a diary entry
 * 
 * Steps:
 * 1. Validate and trim diary content
 * 2. Authenticate user and get userId
 * 3. Create or update diary entry (if diaryId provided, update; otherwise create new)
 * 4. Check for existing pending music generation to prevent duplicates
 * 5. Check usage limits and record music generation attempt
 * 6. Schedule async music generation via Suno API
 * 
 * Returns success status with diaryId and remaining quota, or error code if limit reached or already in progress.
 */
export const startDiaryMusicGeneration = action({
  args: {
    content: v.string(),
    diaryId: v.optional(v.id("diaries")),
  },
  returns: v.object({
    diaryId: v.id("diaries"),
    success: v.boolean(),
    code: v.optional(v.union(
      v.literal("USAGE_LIMIT_REACHED"),
      v.literal("ALREADY_IN_PROGRESS"),
      v.literal("UNKNOWN_ERROR")
    )),
    reason: v.optional(v.string()),
    remainingQuota: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    // Step 1: Validate and trim content
    const trimmed = args.content.trim();
    if (trimmed.length === 0) {
      throw new Error("Content cannot be empty");
    }

    // Step 2: Authenticate user via mutation (actions cannot access DB directly)
    const { userId } = await ctx.runMutation(api.users.ensureCurrentUserMutation, {});

    // Step 3: Create or update diary entry
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

    // Step 4: Check for existing pending music generation via internal query
    const hasPending = await ctx.runQuery(internal.music.hasPendingMusicForDiary, {
      diaryId,
    });

    if (hasPending) {
      return {
        diaryId,
        success: false,
        code: "ALREADY_IN_PROGRESS" as const,
        reason: "Music generation already in progress for this diary",
        remainingQuota: undefined,
      };
    }

    // Step 5: Reconcile subscription with RevenueCat before recording usage
    const usageResult = await ctx.runAction(
      internal.usage.recordMusicGenerationWithReconciliation,
      {
        userId,
      },
    );

    // If usage limit reached, return error but diary was still created/updated
    if (!usageResult.success) {
      return {
        diaryId,
        success: false,
        code: (usageResult.code || "UNKNOWN_ERROR") as
          | "USAGE_LIMIT_REACHED"
          | "UNKNOWN_ERROR",
        reason: usageResult.reason,
        remainingQuota: usageResult.remainingQuota,
      };
    }

    // Step 6: Schedule async music generation
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
      code: undefined,
      remainingQuota: usageResult.remainingQuota,
    };
  },
});

export const hasPendingMusicForDiary = internalQuery({
  args: {
    diaryId: v.id("diaries"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const TEN_MINUTES_MS = 10 * 60 * 1000;
    const now = Date.now();

    const pending = await ctx.db
      .query("music")
      .withIndex("by_diaryId", (q) => q.eq("diaryId", args.diaryId))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "pending"),
          q.gte(q.field("createdAt"), now - TEN_MINUTES_MS)
        )
      )
      .first();

    return pending !== null;
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
      const indexA = a.musicIndex ?? MAX_SAFE_MUSIC_INDEX;
      const indexB = b.musicIndex ?? MAX_SAFE_MUSIC_INDEX;
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

/**
 * Soft delete a music track (mark as deleted without removing from database)
 * 
 * Steps:
 * 1. Authenticate user and get userId
 * 2. Fetch music record and verify ownership
 * 3. Check if already deleted
 * 4. Update record with deletedAt timestamp
 */
export const softDeleteMusic = mutation({
  args: {
    musicId: v.id("music"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Step 1: Authenticate user
    const { userId } = await ensureCurrentUser(ctx);

    // Step 2: Fetch and verify ownership
    const music = await ctx.db.get(args.musicId);
    if (!music) {
      throw new Error("Music not found");
    }

    if (music.userId !== userId) {
      throw new Error("Not authorized to delete this music");
    }

    // Step 3: Check if already deleted
    if (music.deletedAt) {
      throw new Error("Music already deleted");
    }

    // Step 4: Soft delete by setting deletedAt timestamp
    const now = Date.now();
    await ctx.db.patch(args.musicId, {
      deletedAt: now,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * List all music tracks for the current user's playlist
 * 
 * Steps:
 * 1. Authenticate user (optional - returns empty array if not authenticated)
 * 2. Query music records filtered by userId and musicIndex=0 (primary tracks only)
 * 3. Filter out soft-deleted tracks
 * 4. Collect unique diary IDs and fetch diary metadata
 * 5. Map music records with enriched diary data and fallback URLs
 * 
 * Returns array of music tracks with associated diary information, ordered by creation date (newest first).
 */
/**
 * Internal query to get music record by ID
 * Used for internal operations like video generation
 */
export const getMusicInternal = internalQuery({
  args: {
    musicId: v.id("music"),
  },
  returns: v.union(
    v.object({
      _id: v.id("music"),
      userId: v.id("users"),
      diaryId: v.optional(v.id("diaries")),
      title: v.optional(v.string()),
      lyric: v.optional(v.string()),
      duration: v.optional(v.number()),
      audioUrl: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("ready"),
        v.literal("failed"),
      ),
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
      userId: music.userId,
      diaryId: music.diaryId,
      title: music.title,
      lyric: music.lyric,
      duration: music.duration,
      audioUrl: music.audioUrl,
      imageUrl: music.imageUrl,
      status: music.status,
    };
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
    // Step 1: Authenticate user (optional)
    const authResult = await getOptionalCurrentUser(ctx);
    if (!authResult) {
      // User deleted or not authenticated - return empty array gracefully
      return [];
    }
    const { userId } = authResult;

    // Step 2: Query user's primary music tracks (musicIndex=0)
    const docs = await ctx.db
      .query("music")
      .withIndex("by_userId_and_musicIndex", (q) =>
        q.eq("userId", userId).eq("musicIndex", 0),
      )
      .order("desc")
      .collect();

    // Step 3: Filter out soft-deleted tracks
    const activeDocs = docs.filter((doc) => doc.deletedAt === undefined);

    // Step 4: Collect unique diary IDs and fetch diary metadata
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

    // Step 5: Map music records with enriched data
    return activeDocs.map((doc) => {
      // Use primary URLs with fallback to metadata URLs
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

