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
        // Create new post without createdAt
        const newPostId = await ctx.db.insert("blogPosts", {
          slug: post.slug,
          title: post.title,
          bodyMarkdown: post.bodyMarkdown,
          excerpt: post.excerpt,
          status: post.status,
          publishedAt: post.publishedAt,
          author: post.author,
          tags: post.tags,
          readingTime: post.readingTime,
          canonicalUrl: post.canonicalUrl,
          redirectFrom: post.redirectFrom,
          updatedAt: post.updatedAt,
          // Intentionally omit createdAt
        });

        // Migrate revisions to new post
        const revisions = await ctx.db
          .query("blogPostRevisions")
          .withIndex("by_postId", (q) => q.eq("postId", post._id))
          .collect();

        for (const revision of revisions) {
          await ctx.db.insert("blogPostRevisions", {
            postId: newPostId,
            bodyMarkdown: revision.bodyMarkdown,
            title: revision.title,
            excerpt: revision.excerpt,
            author: revision.author,
            tags: revision.tags,
            createdAt: revision.createdAt,
          });
        }

        // Migrate analytics to new post
        const analytics = await ctx.db
          .query("blogPostAnalytics")
          .withIndex("by_postId", (q) => q.eq("postId", post._id))
          .collect();

        for (const analytic of analytics) {
          await ctx.db.insert("blogPostAnalytics", {
            postId: newPostId,
            date: analytic.date,
            viewCount: analytic.viewCount,
            updatedAt: analytic.updatedAt,
          });
        }

        // Delete old post (this will cascade delete revisions/analytics via foreign key constraints)
        // Actually, we need to delete them manually first
        for (const revision of revisions) {
          await ctx.db.delete(revision._id);
        }
        for (const analytic of analytics) {
          await ctx.db.delete(analytic._id);
        }
        await ctx.db.delete(post._id);

        migrated++;
      } catch (error) {
        console.error(`Error migrating post ${post._id}:`, error);
        errors++;
      }
    }

    return { migrated, errors };
  },
});

