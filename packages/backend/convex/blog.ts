import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// ============================================================================
// PUBLIC QUERIES
// ============================================================================

/**
 * List all published blog posts, sorted by publishedAt descending
 */
export const listPublished = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("blogPosts"),
      _creationTime: v.number(),
      slug: v.string(),
      title: v.string(),
      bodyMarkdown: v.string(),
      excerpt: v.optional(v.string()),
      publishedAt: v.number(),
      author: v.string(),
      tags: v.array(v.string()),
      readingTime: v.optional(v.number()),
      canonicalUrl: v.optional(v.string()),
      featuredImage: v.optional(v.string()),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const posts = await ctx.db
      .query("blogPosts")
      .withIndex("by_status_and_publishedAt", (q) =>
        q.eq("status", "published")
      )
      .order("desc")
      .collect();

    // Filter out posts without slug or publishedAt (shouldn't happen but defensive)
    return posts
      .filter((post) => post.slug && post.publishedAt)
      .map((post) => ({
        _id: post._id,
        _creationTime: post._creationTime,
        slug: post.slug!,
        title: post.title,
        bodyMarkdown: post.bodyMarkdown,
        excerpt: post.excerpt,
        publishedAt: post.publishedAt!,
        author: post.author,
        tags: post.tags,
        readingTime: post.readingTime,
        canonicalUrl: post.canonicalUrl,
        featuredImage: post.featuredImage,
        updatedAt: post.updatedAt,
      }));
  },
});

/**
 * Get the N most recently published blog posts, sorted by publishedAt descending
 * More efficient than fetching all posts and sorting client-side
 */
export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("blogPosts"),
      _creationTime: v.number(),
      slug: v.string(),
      title: v.string(),
      bodyMarkdown: v.string(),
      excerpt: v.optional(v.string()),
      publishedAt: v.number(),
      author: v.string(),
      tags: v.array(v.string()),
      readingTime: v.optional(v.number()),
      canonicalUrl: v.optional(v.string()),
      featuredImage: v.optional(v.string()),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 3;
    const posts = await ctx.db
      .query("blogPosts")
      .withIndex("by_status_and_publishedAt", (q) =>
        q.eq("status", "published")
      )
      .order("desc")
      .take(limit);

    // Filter out posts without slug or publishedAt (shouldn't happen but defensive)
    return posts
      .filter((post) => post.slug && post.publishedAt)
      .map((post) => ({
        _id: post._id,
        _creationTime: post._creationTime,
        slug: post.slug!,
        title: post.title,
        bodyMarkdown: post.bodyMarkdown,
        excerpt: post.excerpt,
        publishedAt: post.publishedAt!,
        author: post.author,
        tags: post.tags,
        readingTime: post.readingTime,
        canonicalUrl: post.canonicalUrl,
        featuredImage: post.featuredImage,
        updatedAt: post.updatedAt,
      }));
  },
});

/**
 * Get published blog posts that include the specified tag (case-insensitive)
 * More efficient than fetching all posts and filtering client-side
 */
export const listByTag = query({
  args: { tag: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("blogPosts"),
      _creationTime: v.number(),
      slug: v.string(),
      title: v.string(),
      bodyMarkdown: v.string(),
      excerpt: v.optional(v.string()),
      publishedAt: v.number(),
      author: v.string(),
      tags: v.array(v.string()),
      readingTime: v.optional(v.number()),
      canonicalUrl: v.optional(v.string()),
      featuredImage: v.optional(v.string()),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const tagLower = args.tag.toLowerCase();
    const posts = await ctx.db
      .query("blogPosts")
      .withIndex("by_status_and_publishedAt", (q) =>
        q.eq("status", "published")
      )
      .order("desc")
      .collect();

    // Filter by tag (case-insensitive) and ensure slug/publishedAt exist
    return posts
      .filter(
        (post) =>
          post.slug &&
          post.publishedAt &&
          post.tags.some((t) => t.toLowerCase() === tagLower)
      )
      .map((post) => ({
        _id: post._id,
        _creationTime: post._creationTime,
        slug: post.slug!,
        title: post.title,
        bodyMarkdown: post.bodyMarkdown,
        excerpt: post.excerpt,
        publishedAt: post.publishedAt!,
        author: post.author,
        tags: post.tags,
        readingTime: post.readingTime,
        canonicalUrl: post.canonicalUrl,
        featuredImage: post.featuredImage,
        updatedAt: post.updatedAt,
      }));
  },
});

/**
 * Get a post by slug for seeding/admin purposes (includes drafts)
 * This is a public query but should only be used for seeding/admin operations
 */
export const getPostBySlugForSeed = query({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("blogPosts"),
      _creationTime: v.number(),
      slug: v.optional(v.string()),
      title: v.string(),
      status: v.union(
        v.literal("draft"),
        v.literal("published"),
        v.literal("archived")
      ),
      publishedAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const post = await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!post) return null;

    return {
      _id: post._id,
      _creationTime: post._creationTime,
      slug: post.slug,
      title: post.title,
      status: post.status,
      publishedAt: post.publishedAt,
    };
  },
});

/**
 * Get a single published blog post by slug
 * Also checks redirectFrom array to resolve old slugs
 */
export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("blogPosts"),
      _creationTime: v.number(),
      slug: v.string(),
      title: v.string(),
      bodyMarkdown: v.string(),
      excerpt: v.optional(v.string()),
      publishedAt: v.number(),
      author: v.string(),
      tags: v.array(v.string()),
      readingTime: v.optional(v.number()),
      canonicalUrl: v.optional(v.string()),
      featuredImage: v.optional(v.string()),
      redirectFrom: v.optional(v.array(v.string())),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // First try direct slug match
    const directMatch = await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .filter((q) => q.eq(q.field("status"), "published"))
      .first();

    if (directMatch && directMatch.publishedAt) {
      return {
        _id: directMatch._id,
        _creationTime: directMatch._creationTime,
        slug: directMatch.slug!,
        title: directMatch.title,
        bodyMarkdown: directMatch.bodyMarkdown,
        excerpt: directMatch.excerpt,
        publishedAt: directMatch.publishedAt,
        author: directMatch.author,
        tags: directMatch.tags,
        readingTime: directMatch.readingTime,
        canonicalUrl: directMatch.canonicalUrl,
        featuredImage: directMatch.featuredImage,
        redirectFrom: directMatch.redirectFrom,
        updatedAt: directMatch.updatedAt,
      };
    }

    // Check if this slug is in any post's redirectFrom array
    const allPublished = await ctx.db
      .query("blogPosts")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();

    const redirectMatch = allPublished.find(
      (post) =>
        post.redirectFrom &&
        post.redirectFrom.includes(args.slug) &&
        post.slug &&
        post.publishedAt
    );

    if (redirectMatch && redirectMatch.publishedAt) {
      return {
        _id: redirectMatch._id,
        _creationTime: redirectMatch._creationTime,
        slug: redirectMatch.slug!,
        title: redirectMatch.title,
        bodyMarkdown: redirectMatch.bodyMarkdown,
        excerpt: redirectMatch.excerpt,
        publishedAt: redirectMatch.publishedAt,
        author: redirectMatch.author,
        tags: redirectMatch.tags,
        readingTime: redirectMatch.readingTime,
        canonicalUrl: redirectMatch.canonicalUrl,
        featuredImage: redirectMatch.featuredImage,
        redirectFrom: redirectMatch.redirectFrom,
        updatedAt: redirectMatch.updatedAt,
      };
    }

    return null;
  },
});

// ============================================================================
// INTERNAL QUERIES (for prerender and admin)
// ============================================================================

/**
 * List all posts for prerender script (includes drafts and archived)
 */
export const listAllForPrerender = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("blogPosts"),
      _creationTime: v.number(),
      slug: v.optional(v.string()),
      title: v.string(),
      bodyMarkdown: v.string(),
      excerpt: v.optional(v.string()),
      status: v.union(
        v.literal("draft"),
        v.literal("published"),
        v.literal("archived")
      ),
      publishedAt: v.optional(v.number()),
      author: v.string(),
      tags: v.array(v.string()),
      readingTime: v.optional(v.number()),
      canonicalUrl: v.optional(v.string()),
      featuredImage: v.optional(v.string()),
      redirectFrom: v.optional(v.array(v.string())),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db.query("blogPosts").collect();
  },
});

/**
 * Get a post for prerender (can access drafts)
 */
export const getPostForPrerender = internalQuery({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("blogPosts"),
      _creationTime: v.number(),
      slug: v.optional(v.string()),
      title: v.string(),
      bodyMarkdown: v.string(),
      excerpt: v.optional(v.string()),
      status: v.union(
        v.literal("draft"),
        v.literal("published"),
        v.literal("archived")
      ),
      publishedAt: v.optional(v.number()),
      author: v.string(),
      tags: v.array(v.string()),
      readingTime: v.optional(v.number()),
      canonicalUrl: v.optional(v.string()),
      featuredImage: v.optional(v.string()),
      redirectFrom: v.optional(v.array(v.string())),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const post = await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    return post || null;
  },
});

/**
 * Get a draft post by preview token (for RankPill review flow)
 * Public query for preview access
 */
export const getDraftByPreviewToken = query({
  args: { previewToken: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("blogPosts"),
      _creationTime: v.number(),
      slug: v.optional(v.string()),
      title: v.string(),
      bodyMarkdown: v.string(),
      excerpt: v.optional(v.string()),
      status: v.union(
        v.literal("draft"),
        v.literal("published"),
        v.literal("archived")
      ),
      publishedAt: v.optional(v.number()),
      author: v.string(),
      tags: v.array(v.string()),
      readingTime: v.optional(v.number()),
      canonicalUrl: v.optional(v.string()),
      featuredImage: v.optional(v.string()),
      redirectFrom: v.optional(v.array(v.string())),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const post = await ctx.db
      .query("blogPosts")
      .withIndex("by_draftPreviewToken", (q) => q.eq("draftPreviewToken", args.previewToken))
      .first();

    // Only return if it's still a draft
    if (post && post.status === "draft") {
      return {
        _id: post._id,
        _creationTime: post._creationTime,
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
        featuredImage: post.featuredImage,
        redirectFrom: post.redirectFrom,
        updatedAt: post.updatedAt,
      };
    }

    return null;
  },
});

/**
 * Find a draft post by slug or title (for RankPill deduplication)
 * Internal query for webhook handlers
 */
export const findDraftBySlugOrTitle = internalQuery({
  args: {
    slug: v.optional(v.string()),
    title: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("blogPosts"),
      slug: v.optional(v.string()),
      title: v.string(),
      status: v.union(
        v.literal("draft"),
        v.literal("published"),
        v.literal("archived")
      ),
      draftPreviewToken: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Query all drafts and find match by slug or title
    const drafts = await ctx.db
      .query("blogPosts")
      .withIndex("by_status", (q) => q.eq("status", "draft"))
      .collect();

    const titleLower = args.title.toLowerCase();
    const match = drafts.find((post) => {
      // If slug is provided, match by slug
      if (args.slug && post.slug === args.slug) {
        return true;
      }
      // Otherwise, match by title (case-insensitive)
      return post.title.toLowerCase() === titleLower;
    });

    if (match) {
      return {
        _id: match._id,
        slug: match.slug,
        title: match.title,
        status: match.status,
        draftPreviewToken: match.draftPreviewToken,
      };
    }

    return null;
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new draft blog post (slug is nullable)
 * Also exposed as internal mutation for HTTP API
 */
export const createDraft = mutation({
  args: {
    title: v.string(),
    bodyMarkdown: v.string(),
    excerpt: v.optional(v.string()),
    author: v.string(),
    tags: v.array(v.string()),
    readingTime: v.optional(v.number()),
    canonicalUrl: v.optional(v.string()),
    slug: v.optional(v.string()), // Optional slug (e.g., from RankPill)
    featuredImage: v.optional(v.string()), // Optional featured image URL (e.g., from RankPill)
    publishedAt: v.optional(v.number()), // Optional publishedAt timestamp (e.g., from RankPill)
    draftPreviewToken: v.optional(v.string()), // Optional preview token for draft review flow
  },
  returns: v.object({
    postId: v.id("blogPosts"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    const postId = await ctx.db.insert("blogPosts", {
      slug: args.slug, // Can be provided (e.g., from RankPill) or undefined for drafts
      title: args.title,
      bodyMarkdown: args.bodyMarkdown,
      excerpt: args.excerpt,
      status: "draft",
      publishedAt: args.publishedAt, // Store publishedAt even for drafts (e.g., from RankPill)
      author: args.author,
      tags: args.tags,
      readingTime: args.readingTime,
      canonicalUrl: args.canonicalUrl,
      featuredImage: args.featuredImage,
      redirectFrom: undefined,
      draftPreviewToken: args.draftPreviewToken,
      updatedAt: now,
    });

    return { postId };
  },
});

/**
 * Update an existing draft or published post
 * Also exposed as internal mutation for HTTP API
 */
export const updateDraft = mutation({
  args: {
    postId: v.id("blogPosts"),
    title: v.optional(v.string()),
    bodyMarkdown: v.optional(v.string()),
    excerpt: v.optional(v.string()),
    author: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    readingTime: v.optional(v.number()),
    canonicalUrl: v.optional(v.string()),
    featuredImage: v.optional(v.string()),
    draftPreviewToken: v.optional(v.string()), // Optional preview token for draft review flow
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new Error("Post not found");
    }

    const updates: Partial<Doc<"blogPosts">> = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) updates.title = args.title;
    if (args.bodyMarkdown !== undefined) updates.bodyMarkdown = args.bodyMarkdown;
    if (args.excerpt !== undefined) updates.excerpt = args.excerpt;
    if (args.author !== undefined) updates.author = args.author;
    if (args.tags !== undefined) updates.tags = args.tags;
    if (args.readingTime !== undefined) updates.readingTime = args.readingTime;
    if (args.canonicalUrl !== undefined) updates.canonicalUrl = args.canonicalUrl;
    if (args.featuredImage !== undefined) updates.featuredImage = args.featuredImage;
    if (args.draftPreviewToken !== undefined) updates.draftPreviewToken = args.draftPreviewToken;

    await ctx.db.patch(args.postId, updates);

    // Create a revision
    await ctx.db.insert("blogPostRevisions", {
      postId: args.postId,
      bodyMarkdown: args.bodyMarkdown || post.bodyMarkdown,
      title: args.title || post.title,
      excerpt: args.excerpt !== undefined ? args.excerpt : post.excerpt,
      author: args.author || post.author,
      tags: args.tags || post.tags,
      createdAt: Date.now(),
    });

    return null;
  },
});

/**
 * Publish a post (enforces slug uniqueness, sets slug if null)
 * Also exposed as internal mutation for HTTP API
 */
export const publish = mutation({
  args: {
    postId: v.id("blogPosts"),
    slug: v.optional(v.string()), // If not provided, must already exist on post
    publishedAt: v.optional(v.number()), // Optional timestamp to set publishedAt (for seed script)
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new Error("Post not found");
    }

    const targetSlug = args.slug || post.slug;
    if (!targetSlug) {
      throw new Error("Slug is required to publish");
    }

    // Check slug uniqueness (only for non-null slugs)
    const existingPost = await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", targetSlug))
      .first();

    if (existingPost && existingPost._id !== args.postId) {
      throw new Error(`Slug "${targetSlug}" is already in use by another post`);
    }

    const now = Date.now();
    // Use provided publishedAt, or keep existing, or use now
    const publishedAt = args.publishedAt || post.publishedAt || now;
    
    await ctx.db.patch(args.postId, {
      slug: targetSlug,
      status: "published",
      publishedAt,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Archive a post
 * Also exposed as internal mutation for HTTP API
 */
export const archive = mutation({
  args: {
    postId: v.id("blogPosts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new Error("Post not found");
    }

    await ctx.db.patch(args.postId, {
      status: "archived",
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Approve a draft post (publish it)
 * Used for RankPill review flow
 */
export const approveDraft = internalMutation({
  args: {
    postId: v.id("blogPosts"),
    slug: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new Error("Post not found");
    }

    if (post.status !== "draft") {
      throw new Error("Post is not a draft");
    }

    const targetSlug = args.slug || post.slug;
    if (!targetSlug) {
      throw new Error("Slug is required to publish");
    }

    // Check slug uniqueness
    const existingPost = await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", targetSlug))
      .first();

    if (existingPost && existingPost._id !== args.postId) {
      throw new Error(`Slug "${targetSlug}" is already in use by another post`);
    }

    const now = Date.now();
    
    await ctx.db.patch(args.postId, {
      slug: targetSlug,
      status: "published",
      publishedAt: post.publishedAt || now,
      updatedAt: now,
      draftPreviewToken: undefined, // Clear preview token after publishing
    });

    return null;
  },
});

/**
 * Dismiss a draft post (delete it)
 * Used for RankPill review flow
 */
export const dismissDraft = internalMutation({
  args: {
    postId: v.id("blogPosts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new Error("Post not found");
    }

    if (post.status !== "draft") {
      throw new Error("Post is not a draft");
    }

    // Delete associated revisions
    const revisions = await ctx.db
      .query("blogPostRevisions")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .collect();
    
    for (const revision of revisions) {
      await ctx.db.delete(revision._id);
    }

    // Delete associated analytics
    const analytics = await ctx.db
      .query("blogPostAnalytics")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .collect();
    
    for (const analytic of analytics) {
      await ctx.db.delete(analytic._id);
    }

    // Delete the post itself
    await ctx.db.delete(args.postId);

    return null;
  },
});

/**
 * Delete a post by ID (for seed script/admin use)
 * Also deletes associated revisions and analytics
 */
export const deletePost = mutation({
  args: {
    postId: v.id("blogPosts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new Error("Post not found");
    }

    // Delete associated revisions
    const revisions = await ctx.db
      .query("blogPostRevisions")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .collect();
    
    for (const revision of revisions) {
      await ctx.db.delete(revision._id);
    }

    // Delete associated analytics
    const analytics = await ctx.db
      .query("blogPostAnalytics")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .collect();
    
    for (const analytic of analytics) {
      await ctx.db.delete(analytic._id);
    }

    // Delete the post itself
    await ctx.db.delete(args.postId);

    return null;
  },
});

/**
 * Delete a post by slug (for seed script convenience)
 */
export const deletePostBySlug = mutation({
  args: {
    slug: v.string(),
  },
  returns: v.object({
    deleted: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const post = await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!post) {
      return { deleted: false };
    }

    // Delete associated revisions
    const revisions = await ctx.db
      .query("blogPostRevisions")
      .withIndex("by_postId", (q) => q.eq("postId", post._id))
      .collect();
    
    for (const revision of revisions) {
      await ctx.db.delete(revision._id);
    }

    // Delete associated analytics
    const analytics = await ctx.db
      .query("blogPostAnalytics")
      .withIndex("by_postId", (q) => q.eq("postId", post._id))
      .collect();
    
    for (const analytic of analytics) {
      await ctx.db.delete(analytic._id);
    }

    // Delete the post itself
    await ctx.db.delete(post._id);

    return { deleted: true };
  },
});

/**
 * Set redirect slugs for a post
 * Also exposed as internal mutation for HTTP API
 */
export const setRedirects = mutation({
  args: {
    postId: v.id("blogPosts"),
    redirectFrom: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new Error("Post not found");
    }

    await ctx.db.patch(args.postId, {
      redirectFrom: args.redirectFrom,
      updatedAt: Date.now(),
    });

    return null;
  },
});

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * Increment view count for a post on a specific date
 */
export const incrementViewCount = mutation({
  args: {
    postId: v.id("blogPosts"),
    date: v.string(), // YYYY-MM-DD format
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check if post exists
    const post = await ctx.db.get(args.postId);
    if (!post) {
      throw new Error("Post not found");
    }

    // Find existing analytics record for this post and date
    const existing = await ctx.db
      .query("blogPostAnalytics")
      .withIndex("by_postId_and_date", (q) =>
        q.eq("postId", args.postId).eq("date", args.date)
      )
      .first();

    if (existing) {
      // Increment existing count
      await ctx.db.patch(existing._id, {
        viewCount: existing.viewCount + 1,
        updatedAt: Date.now(),
      });
    } else {
      // Create new analytics record
      await ctx.db.insert("blogPostAnalytics", {
        postId: args.postId,
        date: args.date,
        viewCount: 1,
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});

/**
 * Get analytics aggregates for a post
 */
export const getPostAnalytics = query({
  args: {
    postId: v.id("blogPosts"),
  },
  returns: v.object({
    totalViews: v.number(),
    viewsByDate: v.array(
      v.object({
        date: v.string(),
        viewCount: v.number(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const analytics = await ctx.db
      .query("blogPostAnalytics")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .collect();

    const totalViews = analytics.reduce((sum, record) => sum + record.viewCount, 0);
    const viewsByDate = analytics.map((record) => ({
      date: record.date,
      viewCount: record.viewCount,
    }));

    return {
      totalViews,
      viewsByDate,
    };
  },
});

/**
 * Get analytics for all posts (dashboard view)
 */
export const getAllPostsAnalytics = query({
  args: {},
  returns: v.array(
    v.object({
      postId: v.id("blogPosts"),
      postTitle: v.string(),
      postSlug: v.optional(v.string()),
      totalViews: v.number(),
    })
  ),
  handler: async (ctx) => {
    const posts = await ctx.db.query("blogPosts").collect();
    const analytics = await ctx.db.query("blogPostAnalytics").collect();

    // Group analytics by postId
    const viewsByPost = new Map<Id<"blogPosts">, number>();
    for (const record of analytics) {
      const current = viewsByPost.get(record.postId) || 0;
      viewsByPost.set(record.postId, current + record.viewCount);
    }

    return posts.map((post) => ({
      postId: post._id,
      postTitle: post.title,
      postSlug: post.slug,
      totalViews: viewsByPost.get(post._id) || 0,
    }));
  },
});

