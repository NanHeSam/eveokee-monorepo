/**
 * Migration script to remove createdAt field from existing blog posts
 * 
 * Note: Convex doesn't support removing fields from existing documents.
 * This migration recreates posts without createdAt by:
 * 1. Reading all posts
 * 2. Creating new posts without createdAt
 * 3. Migrating revisions and analytics to new posts
 * 4. Deleting old posts
 * 
 * This migration is idempotent and can handle partial migrations from failed runs.
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Remove createdAt field from all blog posts by recreating them
 * This migration is idempotent and handles partial migrations gracefully
 */
export const removeCreatedAtFromPosts = internalMutation({
  args: {},
  returns: v.object({
    migrated: v.number(),
    completed: v.number(), // Partially migrated posts that were completed
    errors: v.number(),
  }),
  handler: async (ctx) => {
    const posts = await ctx.db.query("blogPosts").collect();
    let migrated = 0;
    let completed = 0;
    let errors = 0;

    // First pass: process old posts (with createdAt) and complete partial migrations
    for (const post of posts) {
      try {
        // Skip posts that have already been fully migrated (no createdAt field)
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

        let newPostId;
        let isPartialMigration = false;

        // Check if this is a partially migrated post (new post already exists)
        if (postWithoutCreatedAt.slug) {
          const existingPost = await ctx.db
            .query("blogPosts")
            .withIndex("by_slug", (q) => q.eq("slug", postWithoutCreatedAt.slug))
            .first();

          if (existingPost && !('createdAt' in existingPost)) {
            // This is a partially migrated post - continue migration
            isPartialMigration = true;
            newPostId = existingPost._id;
          } else {
            // Create new post
            newPostId = await ctx.db.insert("blogPosts", postWithoutCreatedAt);
          }
        } else {
          // No slug - skip to avoid potential duplicates on re-run
          // Draft posts without slugs should be handled manually if needed
          console.warn(`Post ${oldPostId} has no slug, skipping migration to avoid duplicates`);
          continue;
        }

        // Migrate revisions to new post (idempotent)
        const oldRevisions = await ctx.db
          .query("blogPostRevisions")
          .withIndex("by_postId", (q) => q.eq("postId", oldPostId))
          .collect();

        // Check which revisions already exist for the new post
        const existingRevisions = await ctx.db
          .query("blogPostRevisions")
          .withIndex("by_postId", (q) => q.eq("postId", newPostId))
          .collect();

        const revisionSignature = (rev: (typeof existingRevisions)[number]) =>
          JSON.stringify({
            createdAt: rev.createdAt ?? null,
            title: rev.title ?? null,
            bodyMarkdown: rev.bodyMarkdown,
            excerpt: rev.excerpt ?? null,
            author: rev.author ?? null,
            tags: rev.tags ?? [],
          });

        const existingRevisionSignatures = new Set(
          existingRevisions.map(revisionSignature)
        );

        for (const revision of oldRevisions) {
          // Only migrate if this revision doesn't already exist for the new post
          const signature = revisionSignature(revision);
          if (!existingRevisionSignatures.has(signature)) {
            // Preserve all revision fields except _id, _creationTime, and update postId
            const {
              _id: _oldRevisionId,
              _creationTime: _oldRevisionCreationTime,
              postId: _oldRevisionPostId,
              ...revisionData
            } = revision as any;
            await ctx.db.insert("blogPostRevisions", {
              ...revisionData,
              postId: newPostId,
            });
            existingRevisionSignatures.add(signature);
          }
        }

        // Migrate analytics to new post (idempotent)
        const oldAnalytics = await ctx.db
          .query("blogPostAnalytics")
          .withIndex("by_postId", (q) => q.eq("postId", oldPostId))
          .collect();

        // Check which analytics already exist for the new post
        const existingAnalytics = await ctx.db
          .query("blogPostAnalytics")
          .withIndex("by_postId", (q) => q.eq("postId", newPostId))
          .collect();

        const existingAnalyticsDates = new Set(
          existingAnalytics.map((a) => a.date)
        );

        for (const analytic of oldAnalytics) {
          // Only migrate if this analytics record doesn't already exist for the new post
          if (!existingAnalyticsDates.has(analytic.date)) {
            // Preserve all analytics fields except _id, _creationTime, and update postId
            const {
              _id: _oldAnalyticId,
              _creationTime: _oldAnalyticCreationTime,
              postId: _oldAnalyticPostId,
              ...analyticsData
            } = analytic as any;
            await ctx.db.insert("blogPostAnalytics", {
              ...analyticsData,
              postId: newPostId,
            });
          }
        }

        // Delete old post and related data (idempotent - check existence before deleting)
        for (const revision of oldRevisions) {
          // Check if revision still exists before deleting
          const existingRevision = await ctx.db.get(revision._id);
          if (existingRevision) {
            await ctx.db.delete(revision._id);
          }
        }
        for (const analytic of oldAnalytics) {
          // Check if analytics record still exists before deleting
          const existingAnalytic = await ctx.db.get(analytic._id);
          if (existingAnalytic) {
            await ctx.db.delete(analytic._id);
          }
        }
        // Check if old post still exists before deleting
        const existingOldPost = await ctx.db.get(oldPostId);
        if (existingOldPost) {
          await ctx.db.delete(oldPostId);
        }

        if (isPartialMigration) {
          completed++;
        } else {
          migrated++;
        }
      } catch (error) {
        console.error(`Error migrating post ${post._id}:`, error);
        errors++;
        // Continue processing other posts even if one fails
      }
    }

    // Second pass: handle orphaned new posts (without createdAt) that may have matching old posts
    // This handles the case where a new post was created but the old post still exists
    const processedNewPostIds = new Set<string>();
    
    for (const post of posts) {
      try {
        // Only process new posts (without createdAt) that we haven't already processed
        if ('createdAt' in post || !post.slug || processedNewPostIds.has(post._id)) {
          continue;
        }

        // Find old post by checking if it has createdAt field
        const allPostsWithSlug = await ctx.db
          .query("blogPosts")
          .withIndex("by_slug", (q) => q.eq("slug", post.slug))
          .collect();
        
        const matchingOldPost = allPostsWithSlug.find(
          (p) => 'createdAt' in p && p._id !== post._id
        );

        if (matchingOldPost && 'createdAt' in matchingOldPost) {
          // Found an old post matching this new post - complete the migration
          const oldPostId = matchingOldPost._id;
          const newPostId = post._id;
          processedNewPostIds.add(newPostId);

          // Migrate revisions to new post (idempotent)
          const oldRevisions = await ctx.db
            .query("blogPostRevisions")
            .withIndex("by_postId", (q) => q.eq("postId", oldPostId))
            .collect();

          const existingRevisions = await ctx.db
            .query("blogPostRevisions")
            .withIndex("by_postId", (q) => q.eq("postId", newPostId))
            .collect();

          const revisionSignature = (rev: (typeof existingRevisions)[number]) =>
            JSON.stringify({
              createdAt: rev.createdAt ?? null,
              title: rev.title ?? null,
              bodyMarkdown: rev.bodyMarkdown,
              excerpt: rev.excerpt ?? null,
              author: rev.author ?? null,
              tags: rev.tags ?? [],
            });

          const existingRevisionSignatures = new Set(
            existingRevisions.map(revisionSignature)
          );

          for (const revision of oldRevisions) {
            const signature = revisionSignature(revision);
            if (!existingRevisionSignatures.has(signature)) {
              const {
                _id: _oldRevisionId,
                _creationTime: _oldRevisionCreationTime,
                postId: _oldRevisionPostId,
                ...revisionData
              } = revision as any;
              await ctx.db.insert("blogPostRevisions", {
                ...revisionData,
                postId: newPostId,
              });
              existingRevisionSignatures.add(signature);
            }
          }

          // Migrate analytics to new post (idempotent)
          const oldAnalytics = await ctx.db
            .query("blogPostAnalytics")
            .withIndex("by_postId", (q) => q.eq("postId", oldPostId))
            .collect();

          const existingAnalytics = await ctx.db
            .query("blogPostAnalytics")
            .withIndex("by_postId", (q) => q.eq("postId", newPostId))
            .collect();

          const existingAnalyticsDates = new Set(
            existingAnalytics.map((a) => a.date)
          );

          for (const analytic of oldAnalytics) {
            if (!existingAnalyticsDates.has(analytic.date)) {
              const {
                _id: _oldAnalyticId,
                _creationTime: _oldAnalyticCreationTime,
                postId: _oldAnalyticPostId,
                ...analyticsData
              } = analytic as any;
              await ctx.db.insert("blogPostAnalytics", {
                ...analyticsData,
                postId: newPostId,
              });
            }
          }

          // Delete old post and related data (idempotent)
          for (const revision of oldRevisions) {
            const existingRevision = await ctx.db.get(revision._id);
            if (existingRevision) {
              await ctx.db.delete(revision._id);
            }
          }
          for (const analytic of oldAnalytics) {
            const existingAnalytic = await ctx.db.get(analytic._id);
            if (existingAnalytic) {
              await ctx.db.delete(analytic._id);
            }
          }
          const existingOldPost = await ctx.db.get(oldPostId);
          if (existingOldPost) {
            await ctx.db.delete(oldPostId);
          }

          completed++;
        }
      } catch (error) {
        console.error(`Error completing migration for orphaned post ${post._id}:`, error);
        errors++;
      }
    }

    return { migrated, completed, errors };
  },
});

