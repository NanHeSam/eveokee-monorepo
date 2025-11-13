#!/usr/bin/env node
/**
 * Script to verify and clean up createdAt field from blog posts
 * 
 * Usage: CONVEX_URL=<url> npx tsx scripts/remove-createdAt.ts
 * 
 * This script checks if any posts still have createdAt and reports them.
 * Since Convex doesn't support removing fields, the solution is to:
 * 1. Run seed:blog:clean to delete and recreate all posts
 * 2. New posts won't have createdAt since createDraft doesn't set it
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

async function checkCreatedAt() {
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    console.error("Error: CONVEX_URL environment variable is not set");
    process.exit(1);
  }

  const client = new ConvexHttpClient(convexUrl);

  try {
    // Get all posts using internal query
    const allPosts = await client.query(api.blog.listAllForPrerender, {});
    
    const postsWithCreatedAt = allPosts.filter((post: any) => 
      "createdAt" in post && post.createdAt !== undefined
    );

    console.log(`Total posts: ${allPosts.length}`);
    console.log(`Posts with createdAt: ${postsWithCreatedAt.length}`);

    if (postsWithCreatedAt.length > 0) {
      console.log("\nPosts that still have createdAt:");
      postsWithCreatedAt.forEach((post: any) => {
        console.log(`  - ${post.slug || post._id} (ID: ${post._id})`);
      });
      console.log("\nTo fix: Run 'pnpm seed:blog:clean' to delete and recreate all posts without createdAt");
    } else {
      console.log("\n✓ All posts are clean - no createdAt field found!");
      console.log("You can now remove createdAt from the schema.");
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkCreatedAt().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

