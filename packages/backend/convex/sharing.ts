import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import ensureCurrentUser from "./users";
import {
  SHARE_ID_ALPHABET,
  SHARE_ID_LENGTH,
  MAX_COLLISION_ATTEMPTS,
  DEFAULT_SHARE_BASE_URL,
} from "./utils/constants";

/**
 * Generates a unique share ID with collision detection.
 * Attempts up to MAX_COLLISION_ATTEMPTS times to find an unused ID.
 * 
 * @throws {Error} If unable to generate a unique ID after max attempts
 */
const generateShareId = async (ctx: MutationCtx): Promise<string> => {
  for (let attempts = 0; attempts < MAX_COLLISION_ATTEMPTS; attempts += 1) {
    let id = "";
    for (let i = 0; i < SHARE_ID_LENGTH; i += 1) {
      const index = Math.floor(Math.random() * SHARE_ID_ALPHABET.length);
      id += SHARE_ID_ALPHABET[index];
    }
    
    const existing = await ctx.db
      .query("sharedMusic")
      .withIndex("by_shareId", (q) => q.eq("shareId", id))
      .first();
    
    if (!existing) {
      return id;
    }
  }
  
  throw new Error("Failed to generate unique share ID after multiple attempts");
};

export const createShareLink = mutation({
  args: {
    musicId: v.id("music"),
  },
  returns: v.object({
    shareId: v.string(),
    shareUrl: v.string(),
  }),
  handler: async (ctx, args) => {
    const { userId } = await ensureCurrentUser(ctx);

    const music = await ctx.db.get(args.musicId);
    if (!music) {
      throw new Error("Music not found");
    }

    if (music.userId !== userId) {
      throw new Error("Not authorized to share this music");
    }

    if (music.deletedAt) {
      throw new Error("Cannot share deleted music");
    }

    if (music.status !== "ready") {
      throw new Error("Music is not ready to be shared");
    }

    const existing = await ctx.db
      .query("sharedMusic")
      .withIndex("by_musicId", (q) => q.eq("musicId", args.musicId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (existing) {
      // SHARE_BASE_URL should be set in Convex dashboard (Settings → Environment Variables)
      // Fallback to eveokee.com is for development only
      // See packages/backend/ENV_VARS.md for setup instructions
      const baseUrl = process.env.SHARE_BASE_URL || DEFAULT_SHARE_BASE_URL;
      return {
        shareId: existing.shareId,
        shareUrl: `${baseUrl}/share/${existing.shareId}`,
      };
    }

    const shareId = await generateShareId(ctx);
    const now = Date.now();

    await ctx.db.insert("sharedMusic", {
      musicId: args.musicId,
      userId,
      shareId,
      viewCount: 0,
      isActive: true,
      isPrivate: false,
      createdAt: now,
      updatedAt: now,
    });

    // SHARE_BASE_URL should be set in Convex dashboard (Settings → Environment Variables)
    // Fallback to eveokee.com is for development only
    // See packages/backend/ENV_VARS.md for setup instructions
    const baseUrl = process.env.SHARE_BASE_URL || DEFAULT_SHARE_BASE_URL;

    return {
      shareId,
      shareUrl: `${baseUrl}/share/${shareId}`,
    };
  },
});

export const getSharedMusic = query({
  args: {
    shareId: v.string(),
  },
  returns: v.union(
    v.object({
      found: v.literal(true),
      title: v.string(),
      imageUrl: v.optional(v.string()),
      audioUrl: v.optional(v.string()),
      lyric: v.optional(v.string()),
      duration: v.optional(v.number()),
      createdAt: v.number(),
      userName: v.optional(v.string()),
      diaryDate: v.optional(v.number()),
    }),
    v.object({
      found: v.literal(false),
    })
  ),
  handler: async (ctx, args) => {
    const shared = await ctx.db
      .query("sharedMusic")
      .withIndex("by_shareId", (q) => q.eq("shareId", args.shareId))
      .first();

    if (!shared || !shared.isActive || shared.isPrivate) {
      return { found: false as const };
    }

    const music = await ctx.db.get(shared.musicId);
    if (!music || music.deletedAt || music.status !== "ready") {
      return { found: false as const };
    }

    const user = await ctx.db.get(shared.userId);

    const imageUrl = music.imageUrl ?? music.metadata?.source_image_url;
    const audioUrl =
      music.audioUrl ??
      music.metadata?.stream_audio_url ??
      music.metadata?.source_audio_url;

    let diaryDate: number | undefined;
    if (music.diaryId) {
      const diary = await ctx.db.get(music.diaryId);
      diaryDate = diary?.date;
    }

    return {
      found: true as const,
      title: music.title ?? "Untitled Track",
      imageUrl: imageUrl ?? undefined,
      audioUrl: audioUrl ?? undefined,
      lyric: music.lyric ?? undefined,
      duration: music.duration ?? undefined,
      createdAt: shared.createdAt,
      userName: user?.name ?? undefined,
      diaryDate,
    };
  },
});

/**
 * Records a view for a shared music track.
 * 
 * Note: This is a public, unauthenticated mutation that increments view counts.
 * View counts are approximate and can be inflated through repeated calls.
 * This prioritizes simplicity for basic engagement metrics.
 * 
 * Mitigation: The client-side Share page implements session storage to prevent
 * duplicate view recording within the same browser session, which significantly
 * reduces abuse potential from page refreshes and basic scripting.
 * 
 * Future improvements could include:
 * - Server-side rate limiting by IP/session
 * - Unique visitor tracking via separate table
 * - Integration with dedicated analytics service (Google Analytics, Mixpanel, etc.)
 */
export const recordShareView = mutation({
  args: {
    shareId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const shared = await ctx.db
      .query("sharedMusic")
      .withIndex("by_shareId", (q) => q.eq("shareId", args.shareId))
      .first();

    if (!shared || !shared.isActive || shared.isPrivate) {
      return null;
    }

    const music = await ctx.db.get(shared.musicId);
    if (!music || music.deletedAt || music.status !== "ready") {
      return null;
    }

    await ctx.db.patch(shared._id, {
      viewCount: shared.viewCount + 1,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Lists all shared music for the current user.
 * Returns music entries with their sharing status (isPrivate).
 */
export const listSharedMusic = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("sharedMusic"),
      musicId: v.id("music"),
      shareId: v.string(),
      viewCount: v.number(),
      isPrivate: v.optional(v.boolean()),
      createdAt: v.number(),
      updatedAt: v.number(),
      music: v.object({
        _id: v.id("music"),
        title: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        audioUrl: v.optional(v.string()),
        duration: v.optional(v.number()),
        lyric: v.optional(v.string()),
        status: v.union(
          v.literal("pending"),
          v.literal("ready"),
          v.literal("failed")
        ),
        createdAt: v.number(),
        diaryId: v.optional(v.id("diaries")),
        diaryContent: v.optional(v.string()),
        diaryDate: v.optional(v.number()),
      }),
    })
  ),
  handler: async (ctx) => {
    const { userId } = await ensureCurrentUser(ctx);

    const sharedList = await ctx.db
      .query("sharedMusic")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const result = [];
    for (const shared of sharedList) {
      const music = await ctx.db.get(shared.musicId);
      if (!music || music.deletedAt) {
        continue;
      }

      let diaryContent: string | undefined;
      let diaryDate: number | undefined;
      if (music.diaryId) {
        const diary = await ctx.db.get(music.diaryId);
        if (diary) {
          diaryContent = diary.content;
          diaryDate = diary.date;
        }
      }

      result.push({
        _id: shared._id,
        musicId: shared.musicId,
        shareId: shared.shareId,
        viewCount: shared.viewCount,
        isPrivate: shared.isPrivate,
        createdAt: shared.createdAt,
        updatedAt: shared.updatedAt,
        music: {
          _id: music._id,
          title: music.title,
          imageUrl: music.imageUrl,
          audioUrl: music.audioUrl,
          duration: music.duration,
          lyric: music.lyric,
          status: music.status,
          createdAt: music.createdAt,
          diaryId: music.diaryId,
          diaryContent,
          diaryDate,
        },
      });
    }

    // Sort by updatedAt descending (most recently updated first)
    return result.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/**
 * Toggles the privacy status of a shared music track.
 * If isPrivate is true, the share link will not be accessible publicly.
 */
export const toggleSharePrivacy = mutation({
  args: {
    sharedMusicId: v.id("sharedMusic"),
  },
  returns: v.object({
    isPrivate: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { userId } = await ensureCurrentUser(ctx);

    const shared = await ctx.db.get(args.sharedMusicId);
    if (!shared) {
      throw new Error("Shared music not found");
    }

    if (shared.userId !== userId) {
      throw new Error("Not authorized to modify this share");
    }

    if (!shared.isActive) {
      throw new Error("Cannot modify inactive share");
    }

    const newIsPrivate = !shared.isPrivate;
    await ctx.db.patch(args.sharedMusicId, {
      isPrivate: newIsPrivate,
      updatedAt: Date.now(),
    });

    return { isPrivate: newIsPrivate };
  },
});
