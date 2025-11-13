/**
 * Blog service - fetches blog posts from Convex
 * Checks window.__BLOG_INITIAL__ for prerendered data before fetching
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@backend/convex";
import type { Id } from "@backend/convex/convex/_generated/dataModel";

export interface BlogPost {
  _id: Id<"blogPosts">;
  _creationTime: number; // Use Convex's built-in _creationTime instead of createdAt
  slug?: string; // Optional for drafts
  title: string;
  bodyMarkdown: string;
  excerpt?: string;
  publishedAt?: number; // Optional for drafts
  author: string;
  tags: string[];
  readingTime?: number;
  canonicalUrl?: string;
  featuredImage?: string; // Featured image URL from RankPill
  redirectFrom?: string[];
  updatedAt: number;
}

// Prerendered data structure
interface BlogInitialData {
  slug: string;
  post: BlogPost;
}

declare global {
  interface Window {
    __BLOG_INITIAL__?: BlogInitialData;
  }
}

// Lazy client initialization to support tests/SSR environments
let client: ConvexHttpClient | null = null;

/**
 * Get or create the Convex client instance.
 * Allows injection for testing and defers initialization until first use.
 */
function getClient(): ConvexHttpClient {
  if (client) {
    return client;
  }

  const convexUrl = import.meta.env.VITE_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("VITE_CONVEX_URL environment variable is not set");
  }

  client = new ConvexHttpClient(convexUrl);
  return client;
}

/**
 * Set a custom Convex client instance (useful for testing).
 * @internal
 */
export function setClient(customClient: ConvexHttpClient | null): void {
  client = customClient;
}

/**
 * Retrieve all published blog posts.
 *
 * @returns An array of published BlogPost objects; `[]` if fetching fails.
 */
export async function getAllPosts(): Promise<BlogPost[]> {
  try {
    const posts = await getClient().query(api.blog.listPublished, {});
    return posts;
  } catch (error) {
    console.error("Error fetching blog posts:", error);
    return [];
  }
}

/**
 * Retrieve a blog post by its slug, using prerendered data when available.
 *
 * If a matching prerendered post exists on `window.__BLOG_INITIAL__`, that post
 * is returned and the prerendered data is cleared so subsequent requests will
 * fetch fresh data. If no matching prerendered data exists, the function fetches
 * the post from the backend.
 *
 * @param slug - The slug identifier for the blog post to retrieve
 * @returns The matching `BlogPost` if found, `null` otherwise
 */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  // Check if we have prerendered data
  if (typeof window !== "undefined" && window.__BLOG_INITIAL__) {
    const initialData = window.__BLOG_INITIAL__;
    if (initialData.slug === slug) {
      // Clear the initial data so subsequent navigations fetch fresh data
      delete window.__BLOG_INITIAL__;
      return initialData.post;
    }
  }

  // Fetch from Convex
  try {
    const post = await getClient().query(api.blog.getBySlug, { slug });
    return post;
  } catch (error) {
    console.error(`Error fetching blog post ${slug}:`, error);
    return null;
  }
}

/**
 * Retrieve a limited list of the most recently published blog posts.
 * Uses server-side sorting and limiting for better performance.
 *
 * @param limit - Maximum number of posts to return (defaults to 3)
 * @returns An array of published blog posts ordered newest first, containing at most `limit` items
 */
export async function getRecentPosts(limit: number = 3): Promise<BlogPost[]> {
  try {
    const posts = await getClient().query(api.blog.listRecent, { limit });
    return posts;
  } catch (error) {
    console.error("Error fetching recent posts:", error);
    return [];
  }
}

/**
 * Retrieve published blog posts that include the specified tag (case-insensitive).
 * Uses server-side filtering for better performance.
 *
 * @param tag - The tag to match against each post's tags (comparison is case-insensitive).
 * @returns An array of `BlogPost` objects whose `tags` include `tag`. Returns an empty array if there are no matches or if an error occurs.
 */
export async function getPostsByTag(tag: string): Promise<BlogPost[]> {
  try {
    const posts = await getClient().query(api.blog.listByTag, { tag });
    return posts;
  } catch (error) {
    console.error(`Error fetching posts by tag ${tag}:`, error);
    return [];
  }
}

/**
 * Retrieve a draft blog post associated with a preview token.
 *
 * @param previewToken - The preview token used to look up the draft post.
 * @returns The matching `BlogPost`, or `null` if no draft is found or on failure.
 */
export async function getDraftByPreviewToken(previewToken: string): Promise<BlogPost | null> {
  try {
    const post = await getClient().query(api.blog.getDraftByPreviewToken, { previewToken });
    return post;
  } catch (error) {
    console.error(`Error fetching draft by preview token:`, error);
    return null;
  }
}

/**
 * Increment the view count for a blog post for the current date.
 *
 * Calls the backend mutation to record a daily view using the date formatted as `YYYY-MM-DD`.
 * Errors are logged to the console and are not propagated.
 *
 * @param postId - The `_id` of the blog post to increment the view count for
 */
export async function trackView(postId: Id<"blogPosts">): Promise<void> {
  try {
    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    await getClient().mutation(api.blog.incrementViewCount, {
      postId,
      date,
    });
  } catch (error) {
    console.error(`Error tracking view for post ${postId}:`, error);
  }
}