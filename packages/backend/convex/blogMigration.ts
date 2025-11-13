/**
 * Migration script to remove createdAt field from existing blog posts
 * 
 * Note: Convex doesn't support removing fields from existing documents.
 * This migration recreates posts without createdAt by:
 * 1. Reading all posts
 * 2. Creating new posts without createdAt
 * 3. Deleting old posts
 * 
 * WARNING: This will change post IDs. Only run this once during migration.
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Remove createdAt field from all blog posts by recreating them
 * This migration can be run once to clean up old data
 */
export const removeCreatedAtFromPosts = internalMutation({
  args: {},
  returns: v.object({
    migrated: v.number(),
    errors: v.number(),
  }),
  handler: async (ctx) => {
    const posts = await ctx.db.query("blogPosts").collect();
    let migrated = 0;
    let errors = 0;

    for (const post of posts) {
      try {
        // Skip posts that have already been migrated (no createdAt field)
        if (!('createdAt' in post)) {
          continue;
        }

        // Create new post without createdAt, preserving all other fields
        // Destructure to remove _id, _creationTime, and createdAt
        const {
          _id: oldPostId,
          _creationTime: _legacyCreationTime,
          createdAt: _legacyCreatedAt,
          ...postWithoutCreatedAt
        } = post as any;

        // Idempotency check: if a post with this slug already exists and lacks createdAt,
        // it means we already inserted it in a previous failed run - skip to avoid duplicates
        if (postWithoutCreatedAt.slug) {
          const existingPost = await ctx.db
            .query("blogPosts")
            .withIndex("by_slug", (q) => q.eq("slug", postWithoutCreatedAt.slug))
            .first();

          if (existingPost && !('createdAt' in existingPost)) {
            // Already migrated in a previous run, skip processing
            continue;
          }
        }

        const newPostId = await ctx.db.insert("blogPosts", postWithoutCreatedAt);

        // Migrate revisions to new post
        const revisions = await ctx.db
          .query("blogPostRevisions")
          .withIndex("by_postId", (q) => q.eq("postId", oldPostId))
          .collect();

        for (const revision of revisions) {
          // Preserve all revision fields except _id, _creationTime, and update postId
          const { _id: _oldRevisionId, _creationTime: _oldRevisionCreationTime, postId: _oldRevisionPostId, ...revisionData } = revision as any;
          await ctx.db.insert("blogPostRevisions", {
            ...revisionData,
            postId: newPostId,
          });
        }

        // Migrate analytics to new post
        const analytics = await ctx.db
          .query("blogPostAnalytics")
          .withIndex("by_postId", (q) => q.eq("postId", oldPostId))
          .collect();

        for (const analytic of analytics) {
          // Preserve all analytics fields except _id, _creationTime, and update postId
          const { _id: _oldAnalyticId, _creationTime: _oldAnalyticCreationTime, postId: _oldAnalyticPostId, ...analyticsData } = analytic as any;
          await ctx.db.insert("blogPostAnalytics", {
            ...analyticsData,
            postId: newPostId,
          });
        }

        // Delete old post and related data
        for (const revision of revisions) {
          await ctx.db.delete(revision._id);
        }
        for (const analytic of analytics) {
          await ctx.db.delete(analytic._id);
        }
        await ctx.db.delete(oldPostId);

        migrated++;
      } catch (error) {
        console.error(`Error migrating post ${post._id}:`, error);
        errors++;
      }
    }

    return { migrated, errors };
  },
});

