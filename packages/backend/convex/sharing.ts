import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { nanoid } from "nanoid";
import ensureCurrentUser from "./users";

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
      const baseUrl = process.env.SHARE_BASE_URL || "https://diaryvibes.com";
      return {
        shareId: existing.shareId,
        shareUrl: `${baseUrl}/share/${existing.shareId}`,
      };
    }

    const shareId = nanoid(10);
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

    const baseUrl = process.env.SHARE_BASE_URL || "https://diaryvibes.com";

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

    await ctx.db.patch(shared._id, {
      viewCount: shared.viewCount + 1,
      updatedAt: Date.now(),
    });

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
      createdAt: music.createdAt,
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

    const baseUrl = process.env.SHARE_BASE_URL || "https://diaryvibes.com";

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
