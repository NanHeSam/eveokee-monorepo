
import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import ensureCurrentUser, { getOptionalCurrentUser } from "./users";

/**
 * Create a new diary entry
 * 
 * Steps:
 * 1. Authenticate user and get userId
 * 2. Insert new diary record with current timestamp
 * 
 * Returns the created diary ID.
 */
export const createDiary = mutation({
  args: {
    content: v.string(),
  },
  returns: v.object({
    _id: v.id("diaries"),
  }),
  handler: async (ctx, args) => {
    // Step 1: Authenticate user
    const { userId } = await ensureCurrentUser(ctx);

    // Step 2: Create diary entry
    const now = Date.now();
    const _id: Id<"diaries"> = await ctx.db.insert("diaries", {
      userId,
      content: args.content,
      date: now,
      updatedAt: now,
    });

    return { _id };
  },
});

/**
 * Update an existing diary entry
 * 
 * Steps:
 * 1. Authenticate user and get userId
 * 2. Fetch diary record and verify ownership
 * 3. Update content and updatedAt timestamp
 * 
 * Returns updated diary ID and timestamp.
 * Throws error if diary not found or user doesn't own it.
 */
export const updateDiary = mutation({
  args: {
    diaryId: v.id("diaries"),
    content: v.string(),
  },
  returns: v.object({
    _id: v.id("diaries"),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    // Step 1: Authenticate user
    const { userId } = await ensureCurrentUser(ctx);

    // Step 2: Verify ownership
    const diary = await ctx.db.get(args.diaryId);
    if (!diary) {
      throw new Error("Diary not found");
    }

    if (userId !== diary.userId) {
      throw new Error("Forbidden");
    }

    // Step 3: Update diary
    const updatedAt = Date.now();

    await ctx.db.patch(args.diaryId, {
      content: args.content,
      updatedAt,
    });

    return {
      _id: args.diaryId,
      updatedAt,
    };
  },
});

/**
 * Delete a diary entry and all associated music records
 * 
 * Steps:
 * 1. Authenticate user and get userId
 * 2. Fetch diary record and verify ownership
 * 3. Find and delete all associated music records
 * 4. Delete the diary entry
 * 
 * WARNING: This permanently deletes the diary and all associated music tracks.
 */
export const deleteDiary = mutation({
  args: {
    diaryId: v.id("diaries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Step 1: Authenticate user
    const { userId } = await ensureCurrentUser(ctx);

    // Step 2: Verify ownership
    const diary = await ctx.db.get(args.diaryId);
    if (!diary) {
      throw new Error("Diary not found");
    }

    if (userId !== diary.userId) {
      throw new Error("Forbidden");
    }

    // Step 3: Delete associated music records
    const musicRecords = await ctx.db
      .query("music")
      .withIndex("by_diaryId", (q) => q.eq("diaryId", args.diaryId))
      .collect();

    await Promise.all(
      musicRecords.map((music) => ctx.db.delete(music._id))
    );

    // Step 4: Delete diary entry
    await ctx.db.delete(args.diaryId);
    return null;
  },
});

export const createDiaryInternal = internalMutation({
  args: {
    userId: v.id("users"),
    content: v.string(),
    date: v.optional(v.number()),
  },
  returns: v.object({
    _id: v.id("diaries"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const diaryDate = args.date ?? now;
    const _id: Id<"diaries"> = await ctx.db.insert("diaries", {
      userId: args.userId,
      content: args.content,
      date: diaryDate,
      updatedAt: now,
    });

    return { _id };
  },
});

export const listDiaries = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("diaries"),
      userId: v.id("users"),
      title: v.optional(v.string()),
      content: v.string(),
      date: v.number(),
      primaryMusicId: v.optional(v.id("music")),
      updatedAt: v.number(),
      primaryMusic: v.optional(
        v.object({
          _id: v.id("music"),
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
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const authResult = await getOptionalCurrentUser(ctx);
    if (!authResult) {
      // User deleted or not authenticated - return empty array gracefully
      return [];
    }
    const { userId } = authResult;

    const diaries = await ctx.db
      .query("diaries")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const uniqueMusicIds = Array.from(
      new Set(
        diaries
          .map((doc) => doc.primaryMusicId)
          .filter((id): id is Id<"music"> => id !== undefined),
      ),
    );

    const musicDataById = new Map<Id<"music">, {
      _id: Id<"music">;
      title?: string;
      imageUrl?: string;
      audioUrl?: string;
      duration?: number;
      lyric?: string;
      lyricWithTime?: {
        alignedWords: Array<{
          word: string;
          startS: number;
          endS: number;
          palign: number;
        }>;
        waveformData: number[];
        hootCer: number;
      };
      status: "pending" | "ready" | "failed";
    }>();

    await Promise.all(
      uniqueMusicIds.map(async (musicId) => {
        const music = await ctx.db.get(musicId);
        if (music) {
          const imageUrl = music.imageUrl ?? music.metadata?.source_image_url;
          const audioUrl =
            music.audioUrl ??
            music.metadata?.stream_audio_url ??
            music.metadata?.source_audio_url;

          musicDataById.set(musicId, {
            _id: music._id,
            title: music.title,
            imageUrl: imageUrl,
            audioUrl: audioUrl,
            duration: music.duration,
            lyric: music.lyric,
            lyricWithTime: music.lyricWithTime,
            status: music.status,
          });
        }
      }),
    );

    return diaries.map((doc) => ({
      _id: doc._id,
      userId: doc.userId,
      title: doc.title,
      content: doc.content,
      date: doc.date,
      primaryMusicId: doc.primaryMusicId,
      updatedAt: doc.updatedAt,
      primaryMusic: doc.primaryMusicId
        ? musicDataById.get(doc.primaryMusicId)
        : undefined,
    }));
  },
});
