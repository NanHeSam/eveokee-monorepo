#!/usr/bin/env node
/**
 * Generate sitemap.xml for SEO
 * Fetches blog posts from Convex and generates a sitemap with all public pages
 * 
 * Usage:
 *   CONVEX_URL=https://... pnpm generate:sitemap
 *   Or: CONVEX_URL=https://... node scripts/generate-sitemap.mjs
 */

import { ConvexHttpClient } from "convex/browser";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateSitemap() {
  console.log("🚀 Starting sitemap generation...");

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

  // Fetch all published blog posts
  let blogPosts = [];
  try {
    blogPosts = await client.query(api.blog.listPublished, {});
    console.log(`📝 Found ${blogPosts.length} published blog posts`);
  } catch (error) {
    console.error("❌ Error fetching blog posts:", error);
    process.exit(1);
  }

  // Static pages
  const staticPages = [
    { url: "", changefreq: "weekly", priority: "1.0" },
    { url: "blog", changefreq: "weekly", priority: "0.9" },
    { url: "terms", changefreq: "monthly", priority: "0.5" },
    { url: "privacy", changefreq: "monthly", priority: "0.5" },
  ];

  // Generate sitemap XML
  const currentDate = new Date().toISOString();
  
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  // Add static pages
  for (const page of staticPages) {
    const fullUrl = `${baseUrl}/${page.url}`;
    sitemap += `  <url>
    <loc>${escapeXml(fullUrl)}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
  }

  // Add blog posts
  for (const post of blogPosts) {
    if (!post.slug) continue;
    
    const postUrl = `${baseUrl}/blog/${post.slug}`;
    const lastmod = post.updatedAt 
      ? new Date(post.updatedAt).toISOString()
      : post.publishedAt 
        ? new Date(post.publishedAt).toISOString()
        : currentDate;
    
    sitemap += `  <url>
    <loc>${escapeXml(postUrl)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;
  }

  sitemap += `</urlset>`;

  // Write sitemap to public directory
  const webRoot = path.join(__dirname, "..");
  const publicDir = path.join(webRoot, "public");
  const sitemapPath = path.join(publicDir, "sitemap.xml");

  // Ensure public directory exists
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(sitemapPath, sitemap, "utf-8");
  console.log(`✅ Sitemap generated successfully: ${sitemapPath}`);
  console.log(`   - ${staticPages.length} static pages`);
  console.log(`   - ${blogPosts.length} blog posts`);
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Run if called directly
if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  generateSitemap().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}

export { generateSitemap };

