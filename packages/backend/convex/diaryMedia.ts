import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import ensureCurrentUser, { getOptionalCurrentUser } from "./users";

/**
 * Generate an upload URL for media files
 * Client should upload to this URL, then call createDiaryMedia with the storageId
 */
export const generateUploadUrl = action({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await ctx.runMutation(api.users.ensureCurrentUser, {});
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Create diaryMedia record after file has been uploaded
 * 
 * Steps:
 * 1. Authenticate user and verify diary ownership
 * 2. Create diaryMedia record with storageId
 * 
 * Returns the created media record ID.
 */
export const createDiaryMedia = mutation({
  args: {
    diaryId: v.id("diaries"),
    storageId: v.id("_storage"),
    mediaType: v.union(v.literal("photo"), v.literal("video")),
    contentType: v.string(),
    fileSize: v.number(),
  },
  returns: v.object({
    _id: v.id("diaryMedia"),
  }),
  handler: async (ctx, args) => {
    // Step 1: Authenticate user
    const { userId } = await ensureCurrentUser(ctx);

    // Step 2: Verify diary ownership
    const diary = await ctx.db.get(args.diaryId);
    if (!diary) {
      throw new Error("Diary not found");
    }

    if (diary.userId !== userId) {
      throw new Error("Forbidden");
    }

    // Step 3: Create diaryMedia record
    const _id: Id<"diaryMedia"> = await ctx.db.insert("diaryMedia", {
      diaryId: args.diaryId,
      userId,
      storageId: args.storageId,
      mediaType: args.mediaType,
      contentType: args.contentType,
      fileSize: args.fileSize,
    });

    return { _id };
  },
});

/**
 * Get all media for a diary entry with signed URLs
 * 
 * Returns array of media with URLs from storage.
 */
export const getDiaryMedia = query({
  args: {
    diaryId: v.id("diaries"),
  },
  returns: v.array(
    v.object({
      _id: v.id("diaryMedia"),
      diaryId: v.id("diaries"),
      userId: v.id("users"),
      storageId: v.id("_storage"),
      mediaType: v.union(v.literal("photo"), v.literal("video")),
      contentType: v.string(),
      fileSize: v.number(),
      url: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const authResult = await getOptionalCurrentUser(ctx);
    if (!authResult) {
      return [];
    }
    const { userId } = authResult;

    // Verify diary ownership
    const diary = await ctx.db.get(args.diaryId);
    if (!diary || diary.userId !== userId) {
      return [];
    }

    // Get all media for this diary
    const media = await ctx.db
      .query("diaryMedia")
      .withIndex("by_diaryId", (q) => q.eq("diaryId", args.diaryId))
      .collect();

    // Get signed URLs for each media item
    return await Promise.all(
      media.map(async (item) => {
        const url = await ctx.storage.getUrl(item.storageId);
        return {
          _id: item._id,
          diaryId: item.diaryId,
          userId: item.userId,
          storageId: item.storageId,
          mediaType: item.mediaType,
          contentType: item.contentType,
          fileSize: item.fileSize,
          url: url ?? undefined,
        };
      })
    );
  },
});

/**
 * Delete a media item
 * 
 * Steps:
 * 1. Authenticate user and verify ownership
 * 2. Delete from storage (if possible)
 * 3. Delete diaryMedia record
 */
export const deleteDiaryMedia = mutation({
  args: {
    mediaId: v.id("diaryMedia"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Step 1: Authenticate user
    const { userId } = await ensureCurrentUser(ctx);

    // Step 2: Verify ownership
    const media = await ctx.db.get(args.mediaId);
    if (!media) {
      throw new Error("Media not found");
    }

    if (media.userId !== userId) {
      throw new Error("Forbidden");
    }

    // Step 3: Delete from storage (Convex handles cleanup automatically)
    // Step 4: Delete diaryMedia record
    await ctx.db.delete(args.mediaId);

    return null;
  },
});

