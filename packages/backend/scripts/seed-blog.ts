#!/usr/bin/env node
/**
 * Seed script to import blog posts from markdown files into Convex
 * 
 * Usage: 
 *   node seed-blog.ts                    # Upsert posts (create or update)
 *   node seed-blog.ts --delete-existing  # Delete existing posts first, then import fresh
 * 
 * This script:
 * - Reads markdown files from apps/web/src/content/blog/
 * - Parses frontmatter to extract metadata
 * - Derives slug from filename if not in frontmatter
 * - Upserts posts (creates if new, updates if exists)
 * - With --delete-existing: deletes existing posts before importing
 */

import { ConvexHttpClient } from "convex/browser";
import fs from "fs";
import path from "path";
import { api } from "../convex/_generated/api";

// Parse frontmatter from markdown
interface Frontmatter {
  title?: string;
  slug?: string;
  excerpt?: string;
  publishedAt?: string;
  author?: string;
  tags?: string[];
  readTime?: number;
  coverImage?: string;
  canonicalUrl?: string;
}

interface ParsedMarkdown {
  frontmatter: Frontmatter;
  content: string;
}

function parseFrontmatter(content: string): ParsedMarkdown {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, content };
  }

  const [, frontmatterStr, markdownContent] = match;
  const frontmatter: Frontmatter = {};

  // Parse YAML-like frontmatter
  frontmatterStr.split("\n").forEach((line) => {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();

      // Remove quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      // Handle arrays (tags)
      if (value.startsWith("[") && value.endsWith("]")) {
        const arrayValue = value
          .slice(1, -1)
          .split(",")
          .map((item) => item.trim().replace(/"/g, ""));
        (frontmatter as any)[key] = arrayValue;
      } else if (key === "readTime") {
        (frontmatter as any)[key] = parseInt(value, 10);
      } else {
        (frontmatter as any)[key] = value;
      }
    }
  });

  return { frontmatter, content: markdownContent };
}

function deriveSlugFromFilename(filename: string): string {
  // Remove .md extension and use as slug
  return filename.replace(/\.md$/, "");
}

async function seedBlogPosts() {
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    console.error("Error: CONVEX_URL environment variable is not set");
    process.exit(1);
  }

  // Check for --delete-existing flag
  const deleteExisting = process.argv.includes("--delete-existing");

  const client = new ConvexHttpClient(convexUrl);

  // Path to blog markdown files
  const blogDir = path.join(
    __dirname,
    "../../../apps/web/src/content/blog"
  );

  if (!fs.existsSync(blogDir)) {
    console.error(`Error: Blog directory not found at ${blogDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(blogDir).filter((f) => f.endsWith(".md"));

  console.log(`Found ${files.length} markdown files to process`);

  // If --delete-existing flag is set, delete existing posts first
  if (deleteExisting) {
    console.log("\n⚠️  --delete-existing flag detected. Deleting existing posts...");
    
    for (const file of files) {
      const filePath = path.join(blogDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const { frontmatter } = parseFrontmatter(content);
      const slug = frontmatter.slug || deriveSlugFromFilename(file);

      try {
        const result = await client.mutation(api.blog.deletePostBySlug, { slug });
        if (result.deleted) {
          console.log(`  ✓ Deleted: ${slug}`);
        }
      } catch (error) {
        console.error(`  ✗ Error deleting ${slug}:`, error);
      }
    }
    
    console.log("\nDeletion complete. Starting fresh import...\n");
  }

  for (const file of files) {
    const filePath = path.join(blogDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const { frontmatter, content: bodyMarkdown } = parseFrontmatter(content);

    // Derive slug from filename if not in frontmatter
    const slug = frontmatter.slug || deriveSlugFromFilename(file);

    // Validate required fields
    if (!frontmatter.title) {
      console.warn(`Skipping ${file}: missing title in frontmatter`);
      continue;
    }

    if (!frontmatter.author) {
      console.warn(`Skipping ${file}: missing author in frontmatter`);
      continue;
    }

    console.log(`Processing: ${file} (slug: ${slug})`);

    try {
      // Check if post already exists
      const existingPost = await client.query(api.blog.getPostBySlugForSeed, {
        slug,
      });

      if (existingPost && !deleteExisting) {
        // Update existing post (only if not deleting first)
        console.log(`  - Updating existing post: ${slug}`);
        await client.mutation(api.blog.updateDraft, {
          postId: existingPost._id,
          title: frontmatter.title,
          bodyMarkdown,
          excerpt: frontmatter.excerpt,
          author: frontmatter.author,
          tags: frontmatter.tags || [],
          readingTime: frontmatter.readTime,
          canonicalUrl: frontmatter.canonicalUrl,
        });

        // If post is published, ensure it stays published with correct date
        if (existingPost.status === "published") {
          const publishedDate = frontmatter.publishedAt 
            ? new Date(frontmatter.publishedAt + "T00:00:00Z").getTime()
            : existingPost.publishedAt || undefined;
          
          await client.mutation(api.blog.publish, {
            postId: existingPost._id,
            slug,
            publishedAt: publishedDate,
          });
        } else if (frontmatter.publishedAt) {
          // If updating a draft and publishedAt is set, publish it
          const publishedDate = new Date(frontmatter.publishedAt + "T00:00:00Z").getTime();
          await client.mutation(api.blog.publish, {
            postId: existingPost._id,
            slug,
            publishedAt: publishedDate,
          });
          console.log(`  - Published: ${slug} (${frontmatter.publishedAt})`);
        }
      } else {
        // Create new post
        console.log(`  - Creating new post: ${slug}`);
        const { postId } = await client.mutation(api.blog.createDraft, {
          title: frontmatter.title!,
          bodyMarkdown,
          excerpt: frontmatter.excerpt,
          author: frontmatter.author!,
          tags: frontmatter.tags || [],
          readingTime: frontmatter.readTime,
          canonicalUrl: frontmatter.canonicalUrl,
        });

        // Publish immediately if publishedAt is set
        if (frontmatter.publishedAt) {
          // Parse YYYY-MM-DD format to timestamp (midnight UTC)
          const publishedDate = new Date(frontmatter.publishedAt + "T00:00:00Z");
          const publishedAtTimestamp = publishedDate.getTime();
          
          await client.mutation(api.blog.publish, {
            postId,
            slug,
            publishedAt: publishedAtTimestamp,
          });
          
          console.log(`  - Published: ${slug} (${frontmatter.publishedAt})`);
        }
      }

      console.log(`  ✓ Success: ${slug}`);
    } catch (error) {
      console.error(`  ✗ Error processing ${file}:`, error);
    }
  }

  console.log("\n✓ Seed complete!");
  
  if (!deleteExisting) {
    console.log(
      "Note: Existing posts in database that don't have corresponding files were left untouched (no deletion)."
    );
    console.log("Tip: Use --delete-existing flag to delete existing posts before importing.");
  }
}

// Run the seed script
seedBlogPosts().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

