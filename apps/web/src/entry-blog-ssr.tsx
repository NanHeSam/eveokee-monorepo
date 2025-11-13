/**
 * SSR entry point for blog prerendering
 * Renders React components to HTML strings for static generation
 */

import React from "react";
import { renderToString } from "react-dom/server";
import BlogPost from "./components/BlogPost";
import BlogListing from "./components/BlogListing";
import { BlogPost as BlogPostType } from "./lib/blog-service";
import { AudioContext } from "./contexts/AudioContext";

// Re-export the BlogPost type for use in prerender script
export type { BlogPost as BlogPostType } from "./lib/blog-service";

/**
 * Mock AudioManager for SSR - provides no-op implementations
 * since audio functionality requires browser APIs
 */
const mockAudioManager = {
  currentAudioId: null as string | null,
  isPlaying: false,
  isLoading: false,
  error: null as string | null,
  currentTime: 0,
  duration: 0,
  currentTrack: null,
  playAudio: async () => {},
  pauseAudio: () => {},
  toggleAudio: async () => {},
  seekTo: () => {},
  isCurrentAudio: () => false,
  setCurrentTrack: () => {},
};

/**
 * SSR-safe AudioProvider wrapper component
 * Provides a mock AudioManager context for SSR rendering
 */
function SSRAudioProvider({ children }: { children: React.ReactNode }) {
  return React.createElement(
    AudioContext.Provider,
    { value: mockAudioManager },
    children
  );
}

/**
 * Render a blog post to an HTML string suitable for static prerendering.
 *
 * The rendered output is produced in an SSR-safe environment: a mock audio context is provided
 * and the `onBack` handler used by the component is replaced with a no-op.
 *
 * @param post - The blog post data to render
 * @returns The HTML string of the rendered blog post
 */
export function renderBlogPost(post: BlogPostType): string {
  // No-op handler for SSR (back button won't work in static HTML)
  const noOpHandler = () => {};
  
  const html = renderToString(
    React.createElement(
      SSRAudioProvider,
      { children: React.createElement(BlogPost, { post, onBack: noOpHandler }) }
    )
  );
  
  return html;
}

/**
 * Render a blog listing page to an HTML string
 * @param posts - Array of blog posts to display in the listing
 * @returns HTML string of the rendered blog listing
 */
export function renderBlogListing(posts: BlogPostType[]): string {
  return renderToString(
    React.createElement(
      SSRAudioProvider,
      { children: React.createElement(BlogListing, { posts }) }
    )
  );
}

