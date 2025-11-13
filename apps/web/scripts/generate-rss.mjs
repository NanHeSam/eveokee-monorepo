#!/usr/bin/env node
/**
 * Generate RSS feed for blog
 * Fetches blog posts from Convex and generates an RSS 2.0 feed
 * 
 * Usage:
 *   CONVEX_URL=https://... pnpm generate:rss
 *   Or: CONVEX_URL=https://... node scripts/generate-rss.mjs
 */

import { ConvexHttpClient } from "convex/browser";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateRSS() {
  console.log("🚀 Starting RSS feed generation...");

  // Get Convex URL
  const convexUrl = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
  if (!convexUrl) {
    console.error("❌ Error: CONVEX_URL or VITE_CONVEX_URL environment variable is not set");
    process.exit(1);
  }

  // Get base URL from environment or default
  const baseUrl = process.env.VITE_BASE_URL || process.env.BASE_URL || "https://eveokee.com";

  console.log(`📡 Connecting to Convex: ${convexUrl}`);
  console.log(`🌐 Base URL: ${baseUrl}`);

  // Dynamic import to avoid build-time errors
  let api;
  try {
    // Calculate path: scripts/ -> apps/web/ -> monorepo root -> packages/backend/convex/_generated/api.js
    const apiPath = path.resolve(__dirname, "..", "..", "..", "packages", "backend", "convex", "_generated", "api.js");
    const convexModule = await import(`file://${apiPath}`);
    api = convexModule.api;
    console.log(`✅ Loaded Convex API from: ${apiPath}`);
  } catch (error) {
    // Try workspace package as fallback
    try {
      const convexModule = await import("@backend/convex/_generated/api");
      api = convexModule.api;
      console.log(`✅ Loaded Convex API from workspace package`);
    } catch (fallbackError) {
      console.error("❌ Error: Could not import Convex API.");
      console.error("Make sure Convex types are generated:");
      console.error("  1. Run 'pnpm dev:convex' in another terminal");
      console.error("  2. Or ensure packages/backend/convex/_generated/api.js exists");
      console.error("\nOriginal error:", error.message);
      process.exit(1);
    }
  }

  const client = new ConvexHttpClient(convexUrl);

  // Fetch all published blog posts (limit to most recent 20 for RSS)
  let blogPosts = [];
  try {
    const allPosts = await client.query(api.blog.listPublished, {});
    blogPosts = allPosts.slice(0, 20); // RSS typically shows recent posts
    console.log(`📝 Found ${blogPosts.length} blog posts for RSS feed`);
  } catch (error) {
    console.error("❌ Error fetching blog posts:", error);
    process.exit(1);
  }

  // Generate RSS XML
  const currentDate = new Date().toUTCString();
  
  let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>eveokee Blog</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>Stories, insights, and updates from the journey of building something that turns your words into music.</description>
    <language>en-US</language>
    <lastBuildDate>${currentDate}</lastBuildDate>
    <atom:link href="${escapeXml(baseUrl)}/rss.xml" rel="self" type="application/rss+xml"/>
    <generator>eveokee RSS Generator</generator>
`;

  // Add blog posts as items
  for (const post of blogPosts) {
    if (!post.slug || !post.publishedAt) continue;
    
    const postUrl = `${baseUrl}/blog/${post.slug}`;
    const pubDate = new Date(post.publishedAt).toUTCString();
    const description = post.excerpt || stripMarkdown(post.bodyMarkdown || "").substring(0, 300) + "…";
    
    rss += `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid isPermaLink="true">${escapeXml(postUrl)}</guid>
      <description>${escapeXml(description)}</description>
      <pubDate>${pubDate}</pubDate>
      <author>${escapeXml(post.author)}</author>
`;
    
    // Add tags as categories
    for (const tag of post.tags) {
      rss += `      <category>${escapeXml(tag)}</category>
`;
    }
    
    rss += `    </item>
`;
  }

  rss += `  </channel>
</rss>`;

  // Write RSS to public directory
  const webRoot = path.join(__dirname, "..");
  const publicDir = path.join(webRoot, "public");
  const rssPath = path.join(publicDir, "rss.xml");

  // Ensure public directory exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(rssPath, rss, "utf-8");
  console.log(`✅ RSS feed generated successfully: ${rssPath}`);
  console.log(`   - ${blogPosts.length} blog posts included`);
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripMarkdown(markdown) {
  // Simple markdown stripping - remove headers, links, images, etc.
  return markdown
    .replace(/^#+\s+/gm, "") // Remove headers
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // Convert links to text
    .replace(/!\[([^\]]*)\]\([^\)]+\)/g, "") // Remove images
    .replace(/\*\*([^\*]+)\*\*/g, "$1") // Remove bold
    .replace(/\*([^\*]+)\*/g, "$1") // Remove italic
    .replace(/`([^`]+)`/g, "$1") // Remove inline code
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/\n+/g, " ") // Replace newlines with spaces
    .trim();
}

// Run if called directly
if (import.meta.url === new URL(process.argv[1] ? process.argv[1] : '', import.meta.url).href) {
  generateRSS().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}

export { generateRSS };

