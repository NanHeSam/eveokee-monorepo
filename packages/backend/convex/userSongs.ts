import { action, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import ensureCurrentUser, { getOptionalCurrentUser } from "./users";
import { internal } from "./_generated/api";

/**
 * Internal mutation to link a user to a music track.
 * Used both by music creation and migration/backfill.
 * Only links musicIndex === 0 tracks (primary tracks) to avoid exposing secondary tracks.
 * 
 * Idempotent: if the link already exists, returns the existing record.
 */
export const linkUserToMusic = internalMutation({
  args: {
    userId: v.id("users"),
    musicId: v.id("music"),
    musicIndex: v.optional(v.number()),
    ownershipType: v.optional(v.union(
      v.literal("owned"),
      v.literal("shared")
    )),
  },
  returns: v.id("userSongs"),
  handler: async (ctx, args) => {
    // Only link musicIndex === 0 (primary tracks) for now
    // This matches the current behavior where we hide secondary tracks
    if (args.musicIndex !== undefined && args.musicIndex !== 0) {
      throw new Error("Only musicIndex 0 tracks should be linked to userSongs");
    }

    // Check if link already exists
    const existing = await ctx.db
      .query("userSongs")
      .withIndex("by_userId_and_musicId", (q) =>
        q.eq("userId", args.userId).eq("musicId", args.musicId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    const userSongId = await ctx.db.insert("userSongs", {
      userId: args.userId,
      musicId: args.musicId,
      ownershipType: args.ownershipType ?? "owned",
      linkedFromMusicIndex: args.musicIndex ?? 0,
      updatedAt: now,
    });

    return userSongId;
  },
});

/**
 * Check if a shared music track is already in the current user's library.
 */
export const isShareInLibrary = query({
  args: {
    shareId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const authResult = await getOptionalCurrentUser(ctx);
    if (!authResult) {
      return false;
    }
    const { userId } = authResult;

    const shared = await ctx.db
      .query("sharedMusic")
      .withIndex("by_shareId", (q) => q.eq("shareId", args.shareId))
      .first();

    if (!shared) {
      return false;
    }

    const existing = await ctx.db
      .query("userSongs")
      .withIndex("by_userId_and_musicId", (q) =>
        q.eq("userId", userId).eq("musicId", shared.musicId)
      )
      .first();

    return existing !== null;
  },
});

/**
 * Add a shared music track to the current user's library.
 * 
 * Steps:
 * 1. Authenticate user
 * 2. Validate share link exists and is active
 * 3. Check if user already has this track (prevent duplicates)
 * 4. Create userSongs entry with ownershipType "shared"
 * 
 * Returns success status.
 */
export const addFromShare = mutation({
  args: {
    shareId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    alreadyAdded: v.optional(v.boolean()),
  }),
  handler: async (ctx, args) => {
    // Step 1: Authenticate user
    const { userId } = await ensureCurrentUser(ctx);

    // Step 2: Validate share link exists and is active
    const shared = await ctx.db
      .query("sharedMusic")
      .withIndex("by_shareId", (q) => q.eq("shareId", args.shareId))
      .first();

    if (!shared || !shared.isActive || shared.isPrivate) {
      throw new Error("Share link not found or inactive");
    }

    const music = await ctx.db.get(shared.musicId);
    if (!music || music.deletedAt || music.status !== "ready") {
      throw new Error("Music not available");
    }

    // Step 3: Check if user already has this track
    const existing = await ctx.db
      .query("userSongs")
      .withIndex("by_userId_and_musicId", (q) =>
        q.eq("userId", userId).eq("musicId", shared.musicId)
      )
      .first();

    if (existing) {
      return { success: true, alreadyAdded: true };
    }

    // Step 4: Create userSongs entry
    const now = Date.now();
    await ctx.db.insert("userSongs", {
      userId,
      musicId: shared.musicId,
      ownershipType: "shared",
      sharedMusicId: shared._id,
      linkedFromMusicIndex: music.musicIndex ?? 0,
      updatedAt: now,
    });

    return { success: true, alreadyAdded: false };
  },
});

/**
 * Internal mutation to migrate existing music records to userSongs table.
 * 
 * This migration:
 * - Finds all music records where musicIndex === 0 (or undefined/null)
 * - Creates userSongs entries with ownershipType "owned" for each
 * - Is idempotent (won't create duplicates if run multiple times)
 * 
 * Returns statistics about the migration.
 */
export const migrateExistingMusic = internalMutation({
  args: {
    batchSize: v.optional(v.number()), // Number of records to process per batch
    cursor: v.optional(v.id("music")), // Cursor for pagination
  },
  returns: v.object({
    processed: v.number(),
    created: v.number(),
    skipped: v.number(),
    nextCursor: v.union(v.id("music"), v.null()),
    isComplete: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;
    let processed = 0;
    let created = 0;
    let skipped = 0;
    let nextCursor: Id<"music"> | null = args.cursor ?? null;

    // Query music records using the by_createdAt index for pagination
    // We'll filter for musicIndex === 0 or undefined/null in memory
    let query = ctx.db.query("music").withIndex("by_createdAt");
    
    // If we have a cursor, we need to find records after that point
    // Since we can't directly query by cursor with filters, we'll:
    // 1. Get a batch of records ordered by creation time
    // 2. Filter for primary tracks (musicIndex === 0 or undefined/null) and not deleted
    // 3. Process up to batchSize matching records
    
    const allMusic = await query.order("asc").collect();
    
    // Filter to only musicIndex === 0 or undefined/null, and not deleted
    const primaryTracks = allMusic.filter(
      (m) => 
        (m.musicIndex === 0 || m.musicIndex === undefined || m.musicIndex === null) &&
        !m.deletedAt
    );

    // If we have a cursor, start from that point
    let startIndex = 0;
    if (nextCursor) {
      const cursorIndex = primaryTracks.findIndex((m) => m._id === nextCursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }

    // Process batch
    const batch = primaryTracks.slice(startIndex, startIndex + batchSize);
    
    for (const music of batch) {
      processed++;

      // Check if userSongs entry already exists
      const existing = await ctx.db
        .query("userSongs")
        .withIndex("by_userId_and_musicId", (q) =>
          q.eq("userId", music.userId).eq("musicId", music._id)
        )
        .first();

      if (existing) {
        skipped++;
        continue;
      }

      // Create userSongs entry
      const now = Date.now();
      await ctx.db.insert("userSongs", {
        userId: music.userId,
        musicId: music._id,
        ownershipType: "owned",
        linkedFromMusicIndex: music.musicIndex ?? 0,
        updatedAt: now,
      });
      created++;
    }

    // Determine next cursor and completion status
    const lastProcessedIndex = startIndex + batch.length - 1;
    if (lastProcessedIndex >= 0 && lastProcessedIndex < primaryTracks.length - 1) {
      nextCursor = primaryTracks[lastProcessedIndex]._id;
    } else {
      nextCursor = null;
    }

    const isComplete = nextCursor === null;

    return {
      processed,
      created,
      skipped,
      nextCursor,
      isComplete,
    };
  },
});

/**
 * Public action wrapper for migrateExistingMusic.
 * This allows the migration script to call the internal mutation via HTTP.
 * 
 * Note: This is a one-time migration function. Consider removing or securing
 * this after migration is complete.
 */
export const runMigration = action({
  args: {
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.id("music")),
  },
  returns: v.object({
    processed: v.number(),
    created: v.number(),
    skipped: v.number(),
    nextCursor: v.union(v.id("music"), v.null()),
    isComplete: v.boolean(),
  }),
  handler: async (ctx, args) => {
    return await ctx.runMutation(internal.userSongs.migrateExistingMusic, {
      batchSize: args.batchSize,
      cursor: args.cursor,
    });
  },
});

