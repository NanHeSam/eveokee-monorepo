/**
 * Music Video Queries and Mutations
 * Handles video management, retrieval, and associations with music
 */

import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { ensureCurrentUserHandler, getOptionalCurrentUser } from "./users";
import { Id } from "./_generated/dataModel";

/**
 * List all videos for a specific music track
 * Returns videos ordered by creation date (newest first)
 */
export const listVideosForMusic = query({
  args: {
    musicId: v.id("music"),
  },
  returns: v.array(
    v.object({
      _id: v.id("musicVideos"),
      musicId: v.id("music"),
      userId: v.id("users"),
      kieTaskId: v.string(),
      videoStorageId: v.optional(v.string()),
      scriptPrompt: v.string(),
      duration: v.optional(v.number()),
      status: v.union(
        v.literal("pending"),
        v.literal("ready"),
        v.literal("failed"),
      ),
      videoUrl: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      isPrimary: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const authResult = await getOptionalCurrentUser(ctx);
    if (!authResult) {
      return [];
    }
    const { userId } = authResult;

    // Verify music ownership
    const music = await ctx.db.get(args.musicId);
    if (!music || music.userId !== userId) {
      return [];
    }

    const videos = await ctx.db
      .query("musicVideos")
      .withIndex("by_musicId", (q) => q.eq("musicId", args.musicId))
      .order("desc")
      .collect();

    // Get video URLs from storage
    return await Promise.all(
      videos.map(async (video) => {
        let videoUrl: string | undefined = video.metadata?.videoUrl;
        
        // If we have a storage ID, get the URL from Convex storage
        if (video.videoStorageId) {
          videoUrl = await ctx.storage.getUrl(video.videoStorageId);
        }

        return {
          _id: video._id,
          musicId: video.musicId,
          userId: video.userId,
          kieTaskId: video.kieTaskId,
          videoStorageId: video.videoStorageId,
          scriptPrompt: video.scriptPrompt,
          duration: video.duration,
          status: video.status,
          videoUrl: videoUrl ?? undefined,
          createdAt: video.createdAt,
          updatedAt: video.updatedAt,
          isPrimary: music.primaryVideoId === video._id,
        };
      }),
    );
  },
});

/**
 * Get a single video by ID with its URL
 */
export const getVideo = query({
  args: {
    videoId: v.id("musicVideos"),
  },
  returns: v.union(
    v.object({
      _id: v.id("musicVideos"),
      musicId: v.id("music"),
      userId: v.id("users"),
      kieTaskId: v.string(),
      videoStorageId: v.optional(v.string()),
      scriptPrompt: v.string(),
      duration: v.optional(v.number()),
      status: v.union(
        v.literal("pending"),
        v.literal("ready"),
        v.literal("failed"),
      ),
      videoUrl: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      isPrimary: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const authResult = await getOptionalCurrentUser(ctx);
    if (!authResult) {
      return null;
    }
    const { userId } = authResult;

    const video = await ctx.db.get(args.videoId);
    if (!video || video.userId !== userId) {
      return null;
    }

    // Get music to check if this is the primary video
    const music = await ctx.db.get(video.musicId);
    if (!music) {
      return null;
    }

    let videoUrl: string | undefined = video.metadata?.videoUrl;
    
    // If we have a storage ID, get the URL from Convex storage
    if (video.videoStorageId) {
      videoUrl = await ctx.storage.getUrl(video.videoStorageId);
    }

    return {
      _id: video._id,
      musicId: video.musicId,
      userId: video.userId,
      kieTaskId: video.kieTaskId,
      videoStorageId: video.videoStorageId,
      scriptPrompt: video.scriptPrompt,
      duration: video.duration,
      status: video.status,
      videoUrl: videoUrl ?? undefined,
      createdAt: video.createdAt,
      updatedAt: video.updatedAt,
      isPrimary: music.primaryVideoId === video._id,
    };
  },
});

/**
 * Delete a video (no credit refund)
 * Removes the video record and clears primary video reference if applicable
 */
export const deleteVideo = mutation({
  args: {
    videoId: v.id("musicVideos"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await ensureCurrentUserHandler(ctx);

    const video = await ctx.db.get(args.videoId);
    if (!video) {
      throw new Error("Video not found");
    }

    if (video.userId !== userId) {
      throw new Error("Not authorized to delete this video");
    }

    // Get the associated music track
    const music = await ctx.db.get(video.musicId);
    
    // If this is the primary video, clear the reference
    if (music && music.primaryVideoId === args.videoId) {
      await ctx.db.patch(video.musicId, {
        primaryVideoId: undefined,
        updatedAt: Date.now(),
      });
    }

    // Delete the video record
    await ctx.db.delete(args.videoId);

    return null;
  },
});

/**
 * Set a video as the primary/favorite video for a music track
 */
export const setAsPrimaryVideo = mutation({
  args: {
    videoId: v.id("musicVideos"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await ensureCurrentUserHandler(ctx);

    const video = await ctx.db.get(args.videoId);
    if (!video) {
      throw new Error("Video not found");
    }

    if (video.userId !== userId) {
      throw new Error("Not authorized to modify this video");
    }

    // Verify video is ready
    if (video.status !== "ready") {
      throw new Error("Cannot set pending or failed video as primary");
    }

    const music = await ctx.db.get(video.musicId);
    if (!music) {
      throw new Error("Associated music not found");
    }

    if (music.userId !== userId) {
      throw new Error("Not authorized to modify this music");
    }

    // Update music to set this as primary video
    await ctx.db.patch(video.musicId, {
      primaryVideoId: args.videoId,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Internal mutation to create a pending video record
 * Called during video generation workflow
 */
export const createPendingVideoRecord = internalMutation({
  args: {
    musicId: v.id("music"),
    userId: v.id("users"),
    kieTaskId: v.string(),
    scriptPrompt: v.string(),
  },
  returns: v.object({
    videoId: v.id("musicVideos"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    const videoId = await ctx.db.insert("musicVideos", {
      musicId: args.musicId,
      userId: args.userId,
      kieTaskId: args.kieTaskId,
      scriptPrompt: args.scriptPrompt,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return { videoId };
  },
});

/**
 * Internal mutation to check if there's a pending video for a music track
 * Prevents duplicate video generation requests
 */
export const hasPendingVideoForMusic = internalMutation({
  args: {
    musicId: v.id("music"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const TEN_MINUTES_MS = 10 * 60 * 1000;
    const now = Date.now();

    const pending = await ctx.db
      .query("musicVideos")
      .withIndex("by_musicId", (q) => q.eq("musicId", args.musicId))
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

/**
 * Internal mutation to complete video generation
 * Updates video record with storage ID and marks as ready
 * Always sets the newly completed video as the primary video for the music track
 */
export const completeKieVideoTask = internalMutation({
  args: {
    kieTaskId: v.string(),
    videoStorageId: v.string(),
    duration: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const video = await ctx.db
      .query("musicVideos")
      .withIndex("by_kieTaskId", (q) => q.eq("kieTaskId", args.kieTaskId))
      .first();

    if (!video) {
      console.warn(`No video record found for kieTaskId ${args.kieTaskId}`);
      return null;
    }

    const now = Date.now();

    // Update video record
    await ctx.db.patch(video._id, {
      videoStorageId: args.videoStorageId,
      duration: args.duration,
      status: "ready",
      metadata: args.metadata,
      updatedAt: now,
    });

    // Always set this video as the primary video for the music track
    // This ensures regenerated videos always become the primary video
    const music = await ctx.db.get(video.musicId);
    if (music) {
      await ctx.db.patch(video.musicId, {
        primaryVideoId: video._id,
        updatedAt: now,
      });
    }

    return null;
  },
});

/**
 * Internal query to get video by Kie task ID
 * Used by webhook handler for credit refunds
 */
export const getVideoByTaskId = internalQuery({
  args: {
    taskId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("musicVideos"),
      userId: v.id("users"),
      musicId: v.id("music"),
      kieTaskId: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("ready"),
        v.literal("failed"),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const video = await ctx.db
      .query("musicVideos")
      .withIndex("by_kieTaskId", (q) => q.eq("kieTaskId", args.taskId))
      .first();

    if (!video) {
      return null;
    }

    return {
      _id: video._id,
      userId: video.userId,
      musicId: video.musicId,
      kieTaskId: video.kieTaskId,
      status: video.status,
    };
  },
});

/**
 * Internal mutation to mark video generation as failed and refund credits
 * IDEMPOTENT: Only refunds credits if video status is "pending" (not already failed)
 * This prevents duplicate refunds when webhook callbacks are retried
 */
export const failVideoGeneration = internalMutation({
  args: {
    kieTaskId: v.string(),
    errorMessage: v.optional(v.string()),
  },
  returns: v.object({
    refunded: v.boolean(),
    alreadyFailed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const video = await ctx.db
      .query("musicVideos")
      .withIndex("by_kieTaskId", (q) => q.eq("kieTaskId", args.kieTaskId))
      .first();

    if (!video) {
      console.warn(`No video record found for kieTaskId ${args.kieTaskId}`);
      return { refunded: false, alreadyFailed: false };
    }

    // Check if video is already failed - if so, bail out early to prevent duplicate refund
    if (video.status === "failed") {
      console.log(`Video ${args.kieTaskId} already marked as failed, skipping refund`);
      return { refunded: false, alreadyFailed: true };
    }

    // Only refund if status was pending (not already failed or completed)
    const shouldRefund = video.status === "pending";

    const metadataBase = video.metadata ?? { data: null };

    // Atomically mark as failed
    await ctx.db.patch(video._id, {
      status: "failed",
      metadata: {
        ...metadataBase,
        errorMessage: args.errorMessage,
      },
      updatedAt: Date.now(),
    });

    // Refund 3 credits if this was a pending video
    if (shouldRefund) {
      const VIDEO_CREDIT_COST = 3;
      const user = await ctx.db.get(video.userId);

      if (user?.activeSubscriptionId) {
        const subscription = await ctx.db.get(user.activeSubscriptionId);

        if (subscription) {
          const currentUsage = Math.max(0, subscription.musicGenerationsUsed - VIDEO_CREDIT_COST);

          await ctx.db.patch(user.activeSubscriptionId, {
            musicGenerationsUsed: currentUsage,
            lastVerifiedAt: Date.now(),
          });

          console.log(`Refunded ${VIDEO_CREDIT_COST} credits for failed video ${args.kieTaskId}`);
        }
      }
    }

    return { refunded: shouldRefund, alreadyFailed: false };
  },
});

/**
 * Internal query to get music for video generation
 * Verifies ownership and returns music data needed for video generation
 */
export const getMusicForVideoGeneration = internalQuery({
  args: {
    musicId: v.id("music"),
    userId: v.id("users"),
  },
  returns: v.object({
    success: v.boolean(),
    lyric: v.optional(v.string()),
    title: v.optional(v.string()),
    diaryContent: v.optional(v.string()),
    diaryPhotoMediaId: v.optional(v.id("diaryMedia")),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const music = await ctx.db.get(args.musicId);

    if (!music) {
      return {
        success: false,
        error: "Music not found",
      };
    }

    if (music.userId !== args.userId) {
      return {
        success: false,
        error: "Not authorized to access this music",
      };
    }

    let diaryContent: string | undefined;
    let diaryPhotoMediaId: Id<"diaryMedia"> | undefined;
    if (music.diaryId) {
      const diary = await ctx.db.get(music.diaryId);
      if (diary && diary.userId === args.userId) {
        diaryContent = diary.content;

        const diaryPhoto = await ctx.db
          .query("diaryMedia")
          .withIndex("by_diaryId_and_mediaType", (q) =>
            q.eq("diaryId", music.diaryId!).eq("mediaType", "photo"),
          )
          .order("asc")
          .first();

        if (diaryPhoto) {
          diaryPhotoMediaId = diaryPhoto._id;
        }
      }
    }

    return {
      success: true,
      lyric: music.lyric,
      title: music.title,
      diaryContent,
      diaryPhotoMediaId,
    };
  },
});

