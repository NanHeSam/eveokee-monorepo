#!/usr/bin/env node
/**
 * Migration script to populate userSongs table from existing music records
 * 
 * Usage: 
 *   CONVEX_URL=<url> npx tsx scripts/migrate-userSongs.ts
 * 
 * This script:
 * - Finds all existing music records where musicIndex === 0 (or undefined/null)
 * - Creates userSongs entries with ownershipType "owned" for each
 * - Processes in batches to avoid timeouts
 * - Is idempotent (safe to run multiple times)
 * 
 * The migration uses the api.userSongs.runMigration action which processes
 * records in batches and returns a cursor for pagination.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

interface MigrationStats {
  totalProcessed: number;
  totalCreated: number;
  totalSkipped: number;
  batches: number;
}

/**
 * Runs the userSongs migration by calling the internal mutation in batches
 * until all records are processed.
 */
async function migrateUserSongs() {
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    console.error("Error: CONVEX_URL environment variable is not set");
    console.error("Usage: CONVEX_URL=<url> npx tsx scripts/migrate-userSongs.ts");
    process.exit(1);
  }

  const client = new ConvexHttpClient(convexUrl);
  const batchSize = 100;
  const stats: MigrationStats = {
    totalProcessed: 0,
    totalCreated: 0,
    totalSkipped: 0,
    batches: 0,
  };

  let cursor: string | undefined = undefined;
  let isComplete = false;

  console.log("Starting userSongs migration...");
  console.log(`Batch size: ${batchSize}`);
  console.log("");

  try {
    while (!isComplete) {
      const result = await client.action(api.userSongs.runMigration, {
        batchSize,
        cursor: cursor,
      });

      stats.totalProcessed += result.processed;
      stats.totalCreated += result.created;
      stats.totalSkipped += result.skipped;
      stats.batches++;

      console.log(`Batch ${stats.batches}:`);
      console.log(`  Processed: ${result.processed}`);
      console.log(`  Created: ${result.created}`);
      console.log(`  Skipped (already exists): ${result.skipped}`);
      console.log("");

      isComplete = result.isComplete;
      cursor = result.nextCursor ?? undefined;

      // Small delay between batches to avoid overwhelming the system
      if (!isComplete) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log("=".repeat(50));
    console.log("Migration complete!");
    console.log("=".repeat(50));
    console.log(`Total batches: ${stats.batches}`);
    console.log(`Total processed: ${stats.totalProcessed}`);
    console.log(`Total created: ${stats.totalCreated}`);
    console.log(`Total skipped (already existed): ${stats.totalSkipped}`);
    console.log("");

    if (stats.totalSkipped > 0) {
      console.log(
        "Note: Some records were skipped because they already had userSongs entries."
      );
      console.log("This is normal if you've run the migration before.");
    }

    if (stats.totalCreated === 0 && stats.totalSkipped === 0) {
      console.log("No music records found to migrate.");
    }
  } catch (error) {
    console.error("Error during migration:", error);
    console.error("");
    console.error("Migration partially completed:");
    console.error(`  Processed: ${stats.totalProcessed}`);
    console.error(`  Created: ${stats.totalCreated}`);
    console.error(`  Skipped: ${stats.totalSkipped}`);
    console.error(`  Batches: ${stats.batches}`);
    process.exit(1);
  }
}

// Run the migration
migrateUserSongs().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

