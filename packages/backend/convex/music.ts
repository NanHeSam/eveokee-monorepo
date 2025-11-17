import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Minimal context type for getOwnerNamesForUserPlaylist helper.
 * Only includes the database property from QueryCtx, restricting access
 * to only the database operations (not other QueryCtx properties like scheduler, etc).
 */
type PlaylistOwnerNamesCtx = {
  db: QueryCtx["db"];
};
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
    const { userId } = await ctx.runMutation(api.users.ensureCurrentUser, {});

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

      // Link user to music track (only for musicIndex === 0 to match current behavior)
      if (index === 0) {
        await ctx.runMutation(internal.userSongs.linkUserToMusic, {
          userId: args.userId,
          musicId,
          musicIndex: 0,
          ownershipType: "owned",
        });
      }
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
 * Update lyricWithTime field for a music record
 * Used internally after fetching timestamped lyrics from Suno API
 */
export const updateLyricWithTime = internalMutation({
  args: {
    musicId: v.id("music"),
    lyricWithTime: v.object({
      alignedWords: v.array(
        v.object({
          word: v.string(),
          startS: v.number(),
          endS: v.number(),
          palign: v.number(),
        }),
      ),
      waveformData: v.array(v.number()),
      hootCer: v.number(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const music = await ctx.db.get(args.musicId);
    if (!music) {
      console.warn(`Music record ${args.musicId} not found`);
      return null;
    }

    await ctx.db.patch(args.musicId, {
      lyricWithTime: args.lyricWithTime,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Delete a music track from user's library or soft delete if user is the owner
 * 
 * Behavior:
 * - If user is the owner: Soft delete the music track (sets deletedAt timestamp)
 *   This will make the song unavailable for all users who have it in their library
 * - If user is not the owner but has the song in their library: Remove the userSongs reference
 *   This only removes the song from the user's library, not the actual music record
 * 
 * Steps:
 * 1. Authenticate user and get userId
 * 2. Fetch music record
 * 3. Check if user is the owner or has a reference in userSongs
 * 4. If owner: Soft delete the music track
 * 5. If not owner: Delete the userSongs reference
 */
export const softDeleteMusic = mutation({
  args: {
    musicId: v.id("music"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Step 1: Authenticate user
    const { userId } = await ensureCurrentUser(ctx);

    // Step 2: Fetch music record
    const music = await ctx.db.get(args.musicId);
    if (!music) {
      throw new Error("Music not found");
    }

    // Step 3: Check if user is the owner
    const isOwner = music.userId === userId;

    if (isOwner) {
      // Step 4: Owner deletion - soft delete the music track
      if (music.deletedAt) {
        throw new Error("Music already deleted");
      }

      const now = Date.now();
      await ctx.db.patch(args.musicId, {
        deletedAt: now,
        updatedAt: now,
      });
    } else {
      // Step 5: Non-owner deletion - remove userSongs reference
      const userSong = await ctx.db
        .query("userSongs")
        .withIndex("by_userId_and_musicId", (q) =>
          q.eq("userId", userId).eq("musicId", args.musicId)
        )
        .first();

      if (!userSong) {
        throw new Error("Song not found in your library");
      }

      await ctx.db.delete(userSong._id);
    }

    return null;
  },
});

/**
 * Internal helper to fetch owner names for shared tracks in a user's playlist.
 * Returns a Map of owner user IDs to their names.
 */
async function getOwnerNamesForUserPlaylist(
  ctx: PlaylistOwnerNamesCtx,
  userId: Id<"users">,
): Promise<Map<Id<"users">, string>> {
  // Query userSongs to find shared tracks
  const userSongs = await ctx.db
    .query("userSongs")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  // Collect unique owner user IDs from shared tracks
  const ownerUserIds = new Set<Id<"users">>();
  
  for (const userSong of userSongs) {
    if (userSong.sharedMusicId) {
      const sharedMusic = await ctx.db.get(userSong.sharedMusicId);
      if (sharedMusic && sharedMusic.isActive && !sharedMusic.isPrivate) {
        ownerUserIds.add(sharedMusic.userId);
      }
    }
  }

  // Fetch owner names
  const ownerNameById = new Map<Id<"users">, string>();
  
  await Promise.all(
    Array.from(ownerUserIds).map(async (ownerUserId) => {
      const owner = await ctx.db.get(ownerUserId);
      if (owner && owner.name) {
        ownerNameById.set(ownerUserId, owner.name);
      }
    }),
  );

  return ownerNameById;
}

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

/**
 * Internal query to get all music records by taskId with audioId
 * Used for fetching timed lyrics after music generation completes
 */
export const getAllMusicByTaskId = internalQuery({
  args: {
    taskId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("music"),
      audioId: v.optional(v.string()),
      musicIndex: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const musicRecords = await ctx.db
      .query("music")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();

    return musicRecords.map((m) => ({
      _id: m._id,
      audioId: m.audioId,
      musicIndex: m.musicIndex,
    }));
  },
});

/**
 * Internal query to get music record by taskId (returns the first musicIndex=0 record)
 * Used for push notifications after music generation completes
 */
export const getMusicByTaskId = internalQuery({
  args: {
    taskId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("music"),
      userId: v.id("users"),
      diaryId: v.optional(v.id("diaries")),
      title: v.optional(v.string()),
      status: v.union(
        v.literal("pending"),
        v.literal("ready"),
        v.literal("failed"),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const musicRecords = await ctx.db
      .query("music")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .collect();

    // Find the musicIndex=0 record (primary track)
    const primaryMusic = musicRecords.find((m) => m.musicIndex === 0);
    
    if (!primaryMusic) {
      return null;
    }

    return {
      _id: primaryMusic._id,
      userId: primaryMusic.userId,
      diaryId: primaryMusic.diaryId,
      title: primaryMusic.title,
      status: primaryMusic.status,
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
      lyricWithTime: v.optional(
        v.object({
          alignedWords: v.array(
            v.object({
              word: v.string(),
              startS: v.number(),
              endS: v.number(),
              palign: v.number(),
            }),
          ),
          waveformData: v.array(v.number()),
          hootCer: v.number(),
        }),
      ),
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
      // New fields for userSongs (backwards compatible - optional)
      userSongId: v.optional(v.id("userSongs")),
      ownershipType: v.optional(v.union(v.literal("owned"), v.literal("shared"))),
      addedViaShareId: v.optional(v.string()),
      linkedFromMusicIndex: v.optional(v.number()),
      ownerName: v.optional(v.string()),
      // Availability flags for deleted/unshared songs
      isUnavailable: v.optional(v.boolean()),
      unavailableReason: v.optional(v.union(
        v.literal("deleted"),
        v.literal("unshared")
      )),
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

    // Step 2: Query userSongs ordered by _creationTime (newest first)
    const userSongs = await ctx.db
      .query("userSongs")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    // Sort by _creationTime descending (newest first)
    userSongs.sort((a, b) => b._creationTime - a._creationTime);

    // Step 3: Fetch music records and check availability
    const musicRecords: Array<{
      userSong: typeof userSongs[0];
      music: Awaited<ReturnType<typeof ctx.db.get<"music">>>;
      sharedMusic: Awaited<ReturnType<typeof ctx.db.get<"sharedMusic">>> | null;
      isUnavailable: boolean;
      unavailableReason?: "deleted" | "unshared";
    }> = [];

    for (const userSong of userSongs) {
      const music = await ctx.db.get(userSong.musicId);
      if (!music) {
        // Music record doesn't exist - skip
        continue;
      }

      // Check if music is deleted
      const isDeleted = !!music.deletedAt;

      // For shared tracks, check if the share is still active (only if music is not deleted)
      // Skip fetching sharedMusic if music is deleted since ownerName is only included when !isUnavailable
      let sharedMusic = null;
      let isUnshared = false;
      if (!isDeleted && userSong.sharedMusicId) {
        sharedMusic = await ctx.db.get(userSong.sharedMusicId);
        if (!sharedMusic || !sharedMusic.isActive || sharedMusic.isPrivate) {
          isUnshared = true;
        }
      }

      // Determine availability status (deleted takes precedence over unshared)
      const isUnavailable = isDeleted || isUnshared;
      const unavailableReason = isDeleted ? "deleted" as const : (isUnshared ? "unshared" as const : undefined);

      musicRecords.push({ userSong, music, sharedMusic, isUnavailable, unavailableReason });
    }

    // Step 4: Collect unique diary IDs (only for owned tracks where user is the music owner and music is available)
    const diaryIds = musicRecords
      .filter(({ userSong, music, isUnavailable }) => 
        !isUnavailable &&
        userSong.ownershipType === "owned" && 
        music.userId === userId && 
        music.diaryId
      )
      .map(({ music }) => music.diaryId)
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

    // Step 4b: Get owner names for shared tracks using shared helper
    const ownerNameById = await getOwnerNamesForUserPlaylist(ctx, userId);

    // Step 5: Map to result format
    return musicRecords.map(({ userSong, music, sharedMusic, isUnavailable, unavailableReason }) => {
      // Use primary URLs with fallback to metadata URLs (only if available)
      const imageUrl = !isUnavailable 
        ? (music.imageUrl ?? music.metadata?.source_image_url)
        : undefined;
      const audioUrl = !isUnavailable
        ? (music.audioUrl ??
          music.metadata?.stream_audio_url ??
          music.metadata?.source_audio_url)
        : undefined;

      // Only include diary metadata if user owns the music and it's available
      const diaryData = 
        !isUnavailable &&
        userSong.ownershipType === "owned" && 
        music.userId === userId && 
        music.diaryId
          ? diaryDataById.get(music.diaryId)
          : undefined;

      // Get owner name for shared tracks (only if share is still active)
      const ownerName = sharedMusic && !isUnavailable
        ? ownerNameById.get(sharedMusic.userId)
        : undefined;

      return {
        _id: music._id,
        diaryId: music.diaryId ?? undefined,
        title: music.title ?? undefined,
        imageUrl: imageUrl ?? undefined,
        audioUrl: audioUrl ?? undefined,
        duration: music.duration ?? undefined,
        lyric: music.lyric ?? undefined,
        lyricWithTime: music.lyricWithTime ?? undefined,
        status: music.status,
        createdAt: music.createdAt,
        updatedAt: music.updatedAt,
        diaryDate: diaryData?.date,
        diaryContent: diaryData?.content,
        diaryTitle: diaryData?.title,
        // New fields
        userSongId: userSong._id,
        ownershipType: userSong.ownershipType,
        addedViaShareId: sharedMusic?.shareId,
        linkedFromMusicIndex: userSong.linkedFromMusicIndex,
        ownerName: ownerName ?? undefined,
        // Availability flags
        isUnavailable: isUnavailable || undefined,
        unavailableReason: unavailableReason ?? undefined,
      };
    });
  },
});

/**
 * Get a map of owner user IDs to owner names for shared tracks in the user's playlist.
 * This can be used for filtering or displaying owner information in the frontend.
 */
export const getPlaylistOwnerNames = query({
  args: {},
  returns: v.record(v.string(), v.string()),
  handler: async (ctx) => {
    // Step 1: Authenticate user (optional)
    const authResult = await getOptionalCurrentUser(ctx);
    if (!authResult) {
      // User deleted or not authenticated - return empty record
      return {};
    }
    const { userId } = authResult;

    // Step 2: Get owner names using shared helper
    const ownerNameByIdMap = await getOwnerNamesForUserPlaylist(ctx, userId);

    // Step 3: Convert Map to Record for serialization
    const ownerNameById: Record<string, string> = {};
    for (const [userId, name] of ownerNameByIdMap.entries()) {
      ownerNameById[userId] = name;
    }

    return ownerNameById;
  },
});
