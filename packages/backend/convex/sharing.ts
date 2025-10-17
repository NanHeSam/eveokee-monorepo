import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import ensureCurrentUser from "./users";

const SHARE_ID_ALPHABET =
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const SHARE_ID_LENGTH = 10;
const MAX_COLLISION_ATTEMPTS = 5;

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
      const baseUrl = process.env.SHARE_BASE_URL || "https://eveokee.com";
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
      createdAt: now,
      updatedAt: now,
    });

    // SHARE_BASE_URL should be set in Convex dashboard (Settings → Environment Variables)
    // Fallback to eveokee.com is for development only
    // See packages/backend/ENV_VARS.md for setup instructions
    const baseUrl = process.env.SHARE_BASE_URL || "https://eveokee.com";

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

    if (!shared || !shared.isActive) {
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

export const deactivateShareLink = mutation({
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
      throw new Error("Not authorized to deactivate this share link");
    }

    const shared = await ctx.db
      .query("sharedMusic")
      .withIndex("by_musicId", (q) => q.eq("musicId", args.musicId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (shared) {
      await ctx.db.patch(shared._id, {
        isActive: false,
        updatedAt: Date.now(),
      });
    }

    return null;
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

    if (!shared || !shared.isActive) {
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

export const getMySharedMusic = query({
  args: {},
  returns: v.array(
    v.object({
      shareId: v.string(),
      musicId: v.id("music"),
      title: v.string(),
      imageUrl: v.optional(v.string()),
      viewCount: v.number(),
      createdAt: v.number(),
      shareUrl: v.string(),
    })
  ),
  handler: async (ctx) => {
    const { userId } = await ensureCurrentUser(ctx);

    const shares = await ctx.db
      .query("sharedMusic")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    // SHARE_BASE_URL should be set in Convex dashboard (Settings → Environment Variables)
    // Fallback to eveokee.com is for development only
    // See packages/backend/ENV_VARS.md for setup instructions
    const baseUrl = process.env.SHARE_BASE_URL || "https://eveokee.com";

    const results = await Promise.all(
      shares.map(async (share) => {
        const music = await ctx.db.get(share.musicId);
        if (!music || music.deletedAt) {
          return null;
        }

        const imageUrl = music.imageUrl ?? music.metadata?.source_image_url;

        return {
          shareId: share.shareId,
          musicId: share.musicId,
          title: music.title ?? "Untitled Track",
          imageUrl: imageUrl ?? undefined,
          viewCount: share.viewCount,
          createdAt: share.createdAt,
          shareUrl: `${baseUrl}/share/${share.shareId}`,
        };
      })
    );

    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});
