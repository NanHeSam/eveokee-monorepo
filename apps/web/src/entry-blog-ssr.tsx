/**
 * SSR entry point for blog prerendering
 * Renders React components to HTML strings for static generation
 */

import React from "react";
import { renderToString } from "react-dom/server";
import BlogPost from "./components/BlogPost";
import BlogListing from "./components/BlogListing";
import { BlogPost as BlogPostType } from "./lib/blog-service";

// Re-export the BlogPost type for use in prerender script
export type { BlogPost as BlogPostType } from "./lib/blog-service";

/**
 * Render a blog post to an HTML string
 * @param post - The blog post data to render
 * @returns HTML string of the rendered blog post
 */
export function renderBlogPost(post: BlogPostType): string {
  // No-op handler for SSR (back button won't work in static HTML)
  const noOpHandler = () => {};
  
  const html = renderToString(
    React.createElement(BlogPost, { post, onBack: noOpHandler })
  );
  
  return html;
}

/**
 * Render a blog listing page to an HTML string
 * @param posts - Array of blog posts to display in the listing
 * @returns HTML string of the rendered blog listing
 */
export function renderBlogListing(posts: BlogPostType[]): string {
  return renderToString(React.createElement(BlogListing, { posts }));
}


