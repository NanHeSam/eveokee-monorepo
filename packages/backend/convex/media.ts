/**
 * Media Upload Mutations
 * Handles photo and video uploads for diary entries
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Generate an upload URL for client-side file uploads
 * This allows clients to upload photos/videos directly to Convex storage
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Get a public URL for a stored media file
 * Used to retrieve and display uploaded photos/videos
 */
export const getMediaUrl = mutation({
  args: {
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
