/**
 * Blog service - fetches blog posts from Convex
 * Checks window.__BLOG_INITIAL__ for prerendered data before fetching
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "@backend/convex";
import type { Id } from "@backend/convex/convex/_generated/dataModel";

export interface BlogPost {
  _id: string;
  _creationTime: number; // Use Convex's built-in _creationTime instead of createdAt
  slug: string;
  title: string;
  bodyMarkdown: string;
  excerpt?: string;
  publishedAt: number;
  author: string;
  tags: string[];
  readingTime?: number;
  canonicalUrl?: string;
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

// Initialize Convex client
const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL environment variable is not set");
}

const client = new ConvexHttpClient(convexUrl);

/**
 * Get all published blog posts
 */
export async function getAllPosts(): Promise<BlogPost[]> {
  try {
    const posts = await client.query(api.blog.listPublished, {});
    return posts;
  } catch (error) {
    console.error("Error fetching blog posts:", error);
    return [];
  }
}

/**
 * Get a single blog post by slug
 * Checks window.__BLOG_INITIAL__ first to avoid refetch
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
    const post = await client.query(api.blog.getBySlug, { slug });
    return post;
  } catch (error) {
    console.error(`Error fetching blog post ${slug}:`, error);
    return null;
  }
}

/**
 * Get recent posts (limited)
 */
export async function getRecentPosts(limit: number = 3): Promise<BlogPost[]> {
  try {
    const posts = await client.query(api.blog.listPublished, {});
    return posts.slice(0, limit);
  } catch (error) {
    console.error("Error fetching recent posts:", error);
    return [];
  }
}

/**
 * Get posts by tag
 */
export async function getPostsByTag(tag: string): Promise<BlogPost[]> {
  try {
    const posts = await client.query(api.blog.listPublished, {});
    return posts.filter((post) =>
      post.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
    );
  } catch (error) {
    console.error(`Error fetching posts by tag ${tag}:`, error);
    return [];
  }
}

/**
 * Get a draft post by preview token
 */
export async function getDraftByPreviewToken(previewToken: string): Promise<BlogPost | null> {
  try {
    const post = await client.query(api.blog.getDraftByPreviewToken, { previewToken });
    return post;
  } catch (error) {
    console.error(`Error fetching draft by preview token:`, error);
    return null;
  }
}

/**
 * Track a view for a blog post
 */
export async function trackView(postId: string): Promise<void> {
  try {
    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    await client.mutation(api.blog.incrementViewCount, {
      postId: postId as Id<"blogPosts">,
      date,
    });
  } catch (error) {
    console.error(`Error tracking view for post ${postId}:`, error);
  }
}

// Legacy export for backward compatibility
export class BlogService {
  static async getAllPosts(): Promise<BlogPost[]> {
    return getAllPosts();
  }

  static async getPostBySlug(slug: string): Promise<BlogPost | null> {
    return getPostBySlug(slug);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static async getPostById(_id: string): Promise<BlogPost | null> {
    // ID-based lookup not supported in new API, use slug instead
    console.warn("getPostById is deprecated, use getPostBySlug instead");
    return null;
  }

  static async getRecentPosts(limit: number = 3): Promise<BlogPost[]> {
    return getRecentPosts(limit);
  }

  static async getPostsByTag(tag: string): Promise<BlogPost[]> {
    return getPostsByTag(tag);
  }
}
