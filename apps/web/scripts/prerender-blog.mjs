#!/usr/bin/env node
/**
 * Prerender script for blog posts
 * Fetches blog posts from Convex and generates static HTML files with embedded data and SSR-rendered content
 * 
 * Usage:
 *   CONVEX_URL=https://... pnpm prerender:blog
 *   Or: CONVEX_URL=https://... node scripts/prerender-blog.mjs
 * 
 * Note: This script imports the compiled SSR entry from dist-ssr/entry-blog-ssr.mjs.
 * Make sure to run 'pnpm build:ssr' first to compile the SSR entry.
 */

import { ConvexHttpClient } from "convex/browser";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Escape characters in a string to their HTML entity equivalents to make it safe for insertion into HTML content.
 * @param {string} text - Input string that may contain HTML-sensitive characters.
 * @returns {string} The input string with &, <, >, ", and ' replaced by their HTML entities.
 */
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Escape a serialized JSON string for safe embedding inside a <script> tag.
 * @param {string} jsonString - A JSON string produced by JSON.stringify.
 * @returns {string} The input with every `<` character replaced by `\u003c` to prevent `</script>`-style tag injection.
 */
function escapeJsonForScript(jsonString) {
  // Replace < with \u003c to prevent </script> from breaking the tag
  return jsonString.replace(/</g, "\\u003c");
}

/**
 * Prerenders blog listing and individual post pages into the dist/blog directory using SSR and Convex data.
 *
 * Connects to a Convex deployment (via CONVEX_URL or VITE_CONVEX_URL), dynamically loads the generated Convex API
 * and the compiled SSR entry, fetches published posts, SSR-renders each post and the listing page, injects
 * hydration data and meta tags, and writes the resulting HTML files to dist/blog/[slug]/index.html and dist/blog/index.html.
 *
 * Side effects: performs network requests to Convex, reads dist/index.html, writes files under dist/blog, and calls process.exit()
 * with a non-zero code if required resources are missing or if any prerendering errors occur.
 */
async function prerenderBlog() {
  console.log("🚀 Starting blog prerender...");

  // Get Convex URL
  const convexUrl = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
  if (!convexUrl) {
    console.error("❌ Error: CONVEX_URL or VITE_CONVEX_URL environment variable is not set");
    console.error("Set it with: CONVEX_URL=https://your-deployment.convex.cloud pnpm prerender:blog");
    process.exit(1);
  }

  console.log(`📡 Connecting to Convex: ${convexUrl}`);

  // Dynamic import to avoid build-time errors
  // Use relative path to the backend package
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
      console.error("\nTried paths:");
      const apiPath = path.resolve(__dirname, "..", "..", "..", "packages", "backend", "convex", "_generated", "api.js");
      console.error(`  - file://${apiPath}`);
      console.error("  - @backend/convex/_generated/api");
      console.error("\nOriginal error:", error.message);
      process.exit(1);
    }
  }

  // Import SSR rendering functions from compiled JS (pure Node ESM)
  let renderBlogPost, renderBlogListing;
  try {
    const ssrEntryPath = path.resolve(
      __dirname,
      "..",
      "dist-ssr",
      "entry-blog-ssr.js"
    );
    
    // Check if compiled file exists
    if (!fs.existsSync(ssrEntryPath)) {
      console.error("❌ Error: Compiled SSR entry not found.");
      console.error(`Expected at: ${ssrEntryPath}`);
      console.error("\nRun the build step first:");
      console.error("  pnpm build:ssr");
      console.error("Or run the full build:");
      console.error("  pnpm build:prerender");
      process.exit(1);
    }

    const ssrModule = await import(`file://${ssrEntryPath}`);
    renderBlogPost = ssrModule.renderBlogPost;
    renderBlogListing = ssrModule.renderBlogListing;
    
    if (!renderBlogPost || !renderBlogListing) {
      throw new Error("SSR module missing required exports (renderBlogPost, renderBlogListing)");
    }
    
    console.log(`✅ Loaded SSR entry from: ${ssrEntryPath}`);
  } catch (error) {
    console.error("❌ Error: Could not import compiled SSR entry.");
    console.error("\nMake sure the SSR entry is compiled:");
    console.error("  pnpm build:ssr");
    console.error("\nError:", error.message);
    if (error.stack) {
      console.error("\nStack:", error.stack);
    }
    process.exit(1);
  }

  const client = new ConvexHttpClient(convexUrl);

  // Fetch published posts
  let publishedPosts;
  try {
    console.log("📥 Fetching published blog posts...");
    publishedPosts = await client.query(api.blog.listPublished, {});
    publishedPosts = publishedPosts.filter((post) => post.slug);
    console.log(`✅ Found ${publishedPosts.length} published posts`);
  } catch (error) {
    console.error("❌ Error fetching posts:", error.message);
    process.exit(1);
  }

  if (publishedPosts.length === 0) {
    console.warn("⚠️  No published posts found. Nothing to prerender.");
    return;
  }

  // Read built index.html
  const webRoot = path.join(__dirname, "..");
  const distIndexPath = path.join(webRoot, "dist", "index.html");
  
  if (!fs.existsSync(distIndexPath)) {
    console.error(`❌ Error: dist/index.html not found at ${distIndexPath}`);
    console.error("Run 'pnpm build' first to create the dist directory.");
    process.exit(1);
  }

  const baseHTML = fs.readFileSync(distIndexPath, "utf-8");

  // Create output directory
  const blogOutputDir = path.join(webRoot, "dist", "blog");
  fs.mkdirSync(blogOutputDir, { recursive: true });

  let successCount = 0;
  let errorCount = 0;

  // Prerender each blog post
  for (const post of publishedPosts) {
    try {
      if (!post.slug) {
        console.warn(`⚠️  Skipping post ${post._id}: no slug`);
        errorCount++;
        continue;
      }

      // 1. Create initial data structure for hydration
      const initialData = {
        slug: post.slug,
        post: {
          _id: post._id,
          _creationTime: post._creationTime,
          slug: post.slug,
          title: post.title,
          bodyMarkdown: post.bodyMarkdown,
          excerpt: post.excerpt,
          publishedAt: post.publishedAt,
          author: post.author,
          tags: post.tags,
          readingTime: post.readingTime,
          canonicalUrl: post.canonicalUrl,
          redirectFrom: post.redirectFrom,
          updatedAt: post.updatedAt,
        },
      };

      // 2. SSR render the blog post component
      const appHtml = renderBlogPost(initialData.post);

      // 3. Create JSON for hydration with proper escaping
      const jsonString = JSON.stringify(initialData);
      const escapedJson = escapeJsonForScript(jsonString);
      const prerenderScript = `<script>
      (function() {
        window.__BLOG_INITIAL__ = ${escapedJson};
      })();
    </script>`;

      // 4. Start with base HTML
      let prerenderedHTML = baseHTML;

      // 5. Inject script after </title> tag, before any module scripts
      if (prerenderedHTML.includes("</title>")) {
        prerenderedHTML = prerenderedHTML.replace("</title>", `</title>${prerenderScript}`);
      } else {
        // Fallback: inject before </head>
        prerenderedHTML = prerenderedHTML.replace("</head>", `${prerenderScript}</head>`);
      }

      // 6. Inject rendered HTML into root div
      const rootDivRegex = /<div\s+id=["']root["'][^>]*>\s*<\/div>/i;
      if (rootDivRegex.test(prerenderedHTML)) {
        prerenderedHTML = prerenderedHTML.replace(
          rootDivRegex,
          `<div id="root">${appHtml}</div>`
        );
      } else {
        // Fallback: try to find any root div
        prerenderedHTML = prerenderedHTML.replace(
          /<div\s+id=["']root["'][^>]*>/i,
          `<div id="root">${appHtml}`
        );
      }

      // 7. Inject per-post meta tags (title, description, canonical)
      // Replace title tag
      const titleRegex = /<title>.*?<\/title>/i;
      const newTitle = `<title>${escapeHtml(post.title)}</title>`;
      if (titleRegex.test(prerenderedHTML)) {
        prerenderedHTML = prerenderedHTML.replace(titleRegex, newTitle);
      } else {
        // Insert before </head> if no title found
        prerenderedHTML = prerenderedHTML.replace("</head>", `${newTitle}</head>`);
      }

      // Add meta description
      const metaDescription = post.excerpt 
        ? `<meta name="description" content="${escapeHtml(post.excerpt)}">`
        : "";
      
      // Add canonical URL if provided
      const canonicalLink = post.canonicalUrl
        ? `<link rel="canonical" href="${escapeHtml(post.canonicalUrl)}">`
        : "";

      // Insert meta tags before </head>
      if (metaDescription || canonicalLink) {
        const metaTags = [metaDescription, canonicalLink].filter(Boolean).join("\n      ");
        prerenderedHTML = prerenderedHTML.replace("</head>", `\n      ${metaTags}\n    </head>`);
      }

      // 8. Save to dist/blog/[slug]/index.html (for proper routing)
      const postDir = path.join(blogOutputDir, post.slug);
      fs.mkdirSync(postDir, { recursive: true });
      const outputPath = path.join(postDir, "index.html");
      fs.writeFileSync(outputPath, prerenderedHTML, "utf-8");

      console.log(`✅ Prerendered: /blog/${post.slug}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to prerender ${post.slug}:`, error.message);
      if (error.stack) {
        console.error(error.stack);
      }
      errorCount++;
    }
  }

  // Also prerender the blog listing page
  try {
    // SSR render the listing
    const listingAppHtml = renderBlogListing(publishedPosts);
    
    // Create initial data for listing (optional - can be empty for now)
    const listingInitialData = { posts: publishedPosts };
    const listingJsonString = JSON.stringify(listingInitialData);
    const listingEscapedJson = escapeJsonForScript(listingJsonString);
    const listingPrerenderScript = `<script>
      (function() {
        window.__BLOG_INITIAL__ = ${listingEscapedJson};
      })();
    </script>`;

    let listingHTML = baseHTML;

    // Inject script
    if (listingHTML.includes("</title>")) {
      listingHTML = listingHTML.replace("</title>", `</title>${listingPrerenderScript}`);
    } else {
      listingHTML = listingHTML.replace("</head>", `${listingPrerenderScript}</head>`);
    }

    // Inject rendered HTML
    const rootDivRegex = /<div\s+id=["']root["'][^>]*>\s*<\/div>/i;
    if (rootDivRegex.test(listingHTML)) {
      listingHTML = listingHTML.replace(
        rootDivRegex,
        `<div id="root">${listingAppHtml}</div>`
      );
    }

    // Update title for listing page
    const titleRegex = /<title>.*?<\/title>/i;
    const listingTitle = `<title>The eveokee Blog</title>`;
    if (titleRegex.test(listingHTML)) {
      listingHTML = listingHTML.replace(titleRegex, listingTitle);
    }

    // Add meta description for listing
    const listingMeta = `<meta name="description" content="Stories, insights, and updates from the journey of building something that turns your words into music.">`;
    listingHTML = listingHTML.replace("</head>", `\n      ${listingMeta}\n    </head>`);

    const listingPath = path.join(blogOutputDir, "index.html");
    fs.writeFileSync(listingPath, listingHTML, "utf-8");
    console.log(`✅ Prerendered: /blog (listing) - ${publishedPosts.length} posts`);
    successCount++;
  } catch (error) {
    console.error(`❌ Failed to prerender blog listing:`, error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    errorCount++;
  }

  console.log("\n" + "=".repeat(50));
  console.log("📊 Prerender Summary");
  console.log("=".repeat(50));
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`📁 Output: ${blogOutputDir}`);
  console.log("\n✨ Prerendering complete!");
  console.log("\nFiles are ready for deployment:");
  console.log(`  - Blog listing: /blog/index.html`);
  console.log(`  - Blog posts: /blog/[slug]/index.html`);

  // Exit with error status if any pages failed to prerender
  if (errorCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

// Run if executed directly
prerenderBlog().catch((error) => {
  console.error("💥 Fatal error:", error);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
