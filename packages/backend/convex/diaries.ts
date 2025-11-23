
import { mutation, query, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import ensureCurrentUser, { getOptionalCurrentUser } from "./users";
import { internal } from "./_generated/api";
import { extractEventsFromDiary, normalizeTag, normalizePersonName, moodNumberToWord, arousalNumberToWord } from "./memory/util";

/**
 * Create a new diary entry
 * 
 * Steps:
 * 1. Authenticate user and get userId
 * 2. Insert new diary record with current timestamp
 * 3. Schedule background processing for memory extraction
 * 
 * Returns the created diary ID.
 */
export const createDiary = mutation({
  args: {
    content: v.string(),
  },
  returns: v.object({
    _id: v.id("diaries"),
  }),
  handler: async (ctx, args) => {
    // Step 1: Authenticate user
    const { userId } = await ensureCurrentUser(ctx);

    // Step 2: Create diary entry
    const now = Date.now();
    const _id: Id<"diaries"> = await ctx.db.insert("diaries", {
      userId,
      content: args.content,
      date: now,
      updatedAt: now,
      originalText: args.content,
      version: 1,
    });

    // Step 3: Schedule memory processing
    await ctx.scheduler.runAfter(0, internal.diaries.processDiaryEntry, {
      diaryId: _id,
    });

    return { _id };
  },
});

/**
 * Update an existing diary entry
 * 
 * Steps:
 * 1. Authenticate user and get userId
 * 2. Fetch diary record and verify ownership
 * 3. Update content and updatedAt timestamp, increment version
 * 
 * Returns updated diary ID and timestamp.
 * Throws error if diary not found or user doesn't own it.
 */
export const updateDiary = mutation({
  args: {
    diaryId: v.id("diaries"),
    content: v.string(),
  },
  returns: v.object({
    _id: v.id("diaries"),
    updatedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    // Step 1: Authenticate user
    const { userId } = await ensureCurrentUser(ctx);

    // Step 2: Verify ownership
    const diary = await ctx.db.get(args.diaryId);
    if (!diary) {
      throw new Error("Diary not found");
    }

    if (userId !== diary.userId) {
      throw new Error("Forbidden");
    }

    // Step 3: Update diary
    const updatedAt = Date.now();
    const newVersion = (diary.version || 1) + 1;

    await ctx.db.patch(args.diaryId, {
      content: args.content,
      updatedAt,
      version: newVersion,
    });

    return {
      _id: args.diaryId,
      updatedAt,
    };
  },
});

/**
 * Delete a diary entry and all associated music records, memory events, and media
 * 
 * Steps:
 * 1. Authenticate user and get userId
 * 2. Fetch diary record and verify ownership
 * 3. Find and delete all associated music records
 * 4. Find and delete all associated memory events
 * 5. Find and delete all associated media records and their storage objects
 * 6. Delete the diary entry
 * 
 * WARNING: This permanently deletes the diary, all associated music tracks,
 * memory events, and all associated media storage objects.
 * 
 * NOTE: This operation is idempotent. If the diary is already deleted or
 * doesn't exist, the function returns null without throwing an error. This
 * allows safe retry behavior and matches UI flows that may call delete on
 * already-removed entries.
 */
export const deleteDiary = mutation({
  args: {
    diaryId: v.id("diaries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Step 1: Authenticate user
    const { userId } = await ensureCurrentUser(ctx);

    // Step 2: Verify ownership
    const diary = await ctx.db.get(args.diaryId);
    if (!diary) {
      // Diary already deleted or doesn't exist - idempotent operation, return silently
      return null;
    }

    if (userId !== diary.userId) {
      throw new Error("Forbidden");
    }

    // Step 3: Delete associated music records
    const musicRecords = await ctx.db
      .query("music")
      .withIndex("by_diaryId", (q) => q.eq("diaryId", args.diaryId))
      .collect();

    await Promise.all(
      musicRecords.map((music) => ctx.db.delete(music._id))
    );

    // Step 4: Delete associated memory events
    const eventRecords = await ctx.db
      .query("events")
      .withIndex("by_diaryId", (q) => q.eq("diaryId", args.diaryId))
      .collect();

    await Promise.all(
      eventRecords.map((event) => ctx.db.delete(event._id))
    );

    // Step 5: Delete associated media records and their storage objects
    const mediaRecords = await ctx.db
      .query("diaryMedia")
      .withIndex("by_diaryId", (q) => q.eq("diaryId", args.diaryId))
      .collect();

    // Delete storage objects first
    await Promise.all(
      mediaRecords.map((media) => ctx.storage.delete(media.storageId))
    );

    // Then delete the database records
    await Promise.all(
      mediaRecords.map((media) => ctx.db.delete(media._id))
    );

    // Step 6: Delete diary entry
    await ctx.db.delete(args.diaryId);
    return null;
  },
});

export const createDiaryInternal = internalMutation({
  args: {
    userId: v.id("users"),
    content: v.string(),
    date: v.optional(v.number()),
  },
  returns: v.object({
    _id: v.id("diaries"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const diaryDate = args.date ?? now;
    const _id: Id<"diaries"> = await ctx.db.insert("diaries", {
      userId: args.userId,
      content: args.content,
      date: diaryDate,
      updatedAt: now,
    });

    return { _id };
  },
});

/**
 * Get a single diary entry by ID with its associated music
 * 
 * Steps:
 * 1. Authenticate user and get userId
 * 2. Fetch diary record and verify ownership
 * 3. Fetch associated primary music if available
 * 
 * Returns the diary with its primary music, or null if not found or user doesn't own it.
 */
export const getDiary = query({
  args: {
    diaryId: v.id("diaries"),
  },
  returns: v.union(
    v.object({
      _id: v.id("diaries"),
      userId: v.id("users"),
      title: v.optional(v.string()),
      content: v.string(),
      date: v.number(),
      primaryMusicId: v.optional(v.id("music")),
      updatedAt: v.number(),
      primaryMusic: v.optional(
        v.object({
          _id: v.id("music"),
          title: v.optional(v.string()),
          imageUrl: v.optional(v.string()),
          audioUrl: v.optional(v.string()),
          duration: v.optional(v.number()),
          lyric: v.optional(v.string()),
          lyricWithTime: v.optional(
            v.object({
              alignedWords: v.array(
                v.object({
                  word: v.string(),
                  startS: v.number(),
                  endS: v.number(),
                  palign: v.number(),
                }),
              ),
              waveformData: v.array(v.number()),
              hootCer: v.number(),
            }),
          ),
          status: v.union(
            v.literal("pending"),
            v.literal("ready"),
            v.literal("failed"),
          ),
        }),
      ),
      events: v.optional(
        v.array(
          v.object({
            _id: v.id("events"),
            _creationTime: v.number(),
            userId: v.id("users"),
            diaryId: v.id("diaries"),
            happenedAt: v.number(),
            personIds: v.optional(v.array(v.id("people"))),
            title: v.string(),
            summary: v.string(),
            mood: v.optional(v.union(v.literal(-2), v.literal(-1), v.literal(0), v.literal(1), v.literal(2))),
            moodWord: v.optional(v.string()),
            arousal: v.optional(v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4), v.literal(5))),
            arousalWord: v.optional(v.string()),
            anniversaryCandidate: v.optional(v.boolean()),
            tags: v.optional(v.array(v.string())),
            importance: v.optional(v.number()),
            peopleDetails: v.array(
              v.object({
                name: v.string(),
                role: v.optional(v.string()),
              })
            ),
          })
        )
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const authResult = await getOptionalCurrentUser(ctx);
    if (!authResult) {
      return null;
    }
    const { userId } = authResult;

    // Fetch diary and verify ownership
    const diary = await ctx.db.get(args.diaryId);
    if (!diary || diary.userId !== userId) {
      return null;
    }

    // Fetch primary music if available
    let primaryMusic: {
      _id: Id<"music">;
      title?: string;
      imageUrl?: string;
      audioUrl?: string;
      duration?: number;
      lyric?: string;
      lyricWithTime?: {
        alignedWords: Array<{
          word: string;
          startS: number;
          endS: number;
          palign: number;
        }>;
        waveformData: number[];
        hootCer: number;
      };
      status: "pending" | "ready" | "failed";
    } | undefined;

    if (diary.primaryMusicId) {
      const music = await ctx.db.get(diary.primaryMusicId);
      if (music) {
        const imageUrl = music.imageUrl ?? music.metadata?.source_image_url;
        const audioUrl =
          music.audioUrl ??
          music.metadata?.stream_audio_url ??
          music.metadata?.source_audio_url;

        primaryMusic = {
          _id: music._id,
          title: music.title,
          imageUrl: imageUrl,
          audioUrl: audioUrl,
          duration: music.duration,
          lyric: music.lyric,
          lyricWithTime: music.lyricWithTime,
          status: music.status,
        };
      }
    }

    // Fetch events for this diary
    const events = await ctx.db
      .query("events")
      .withIndex("by_diaryId", (q) => q.eq("diaryId", diary._id))
      .collect();

    // Resolve people names for events
    const eventsWithDetails = await Promise.all(
      events.map(async (event) => {
        let peopleDetails: { name: string; role?: string }[] = [];
        if (event.personIds && event.personIds.length > 0) {
          const peopleDocs = await Promise.all(
            event.personIds.map((id) => ctx.db.get(id))
          );
          peopleDetails = peopleDocs
            .filter((p) => p !== null)
            .map((p) => ({
              name: p!.primaryName,
              role: p!.relationshipLabel,
            }));
        }
        return {
          ...event,
          peopleDetails,
          moodWord: moodNumberToWord(event.mood),
          arousalWord: arousalNumberToWord(event.arousal),
        };
      })
    );

    return {
      _id: diary._id,
      userId: diary.userId,
      title: diary.title,
      content: diary.content,
      date: diary.date,
      primaryMusicId: diary.primaryMusicId,
      updatedAt: diary.updatedAt,
      primaryMusic,
      events: eventsWithDetails,
    };
  },
});

export const listDiaries = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("diaries"),
      userId: v.id("users"),
      title: v.optional(v.string()),
      content: v.string(),
      date: v.number(),
      primaryMusicId: v.optional(v.id("music")),
      updatedAt: v.number(),
      primaryMusic: v.optional(
        v.object({
          _id: v.id("music"),
          title: v.optional(v.string()),
          imageUrl: v.optional(v.string()),
          audioUrl: v.optional(v.string()),
          duration: v.optional(v.number()),
          lyric: v.optional(v.string()),
          lyricWithTime: v.optional(
            v.object({
              alignedWords: v.array(
                v.object({
                  word: v.string(),
                  startS: v.number(),
                  endS: v.number(),
                  palign: v.number(),
                }),
              ),
              waveformData: v.array(v.number()),
              hootCer: v.number(),
            }),
          ),
          status: v.union(
            v.literal("pending"),
            v.literal("ready"),
            v.literal("failed"),
          ),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const authResult = await getOptionalCurrentUser(ctx);
    if (!authResult) {
      // User deleted or not authenticated - return empty array gracefully
      return [];
    }
    const { userId } = authResult;

    const diaries = await ctx.db
      .query("diaries")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const uniqueMusicIds = Array.from(
      new Set(
        diaries
          .map((doc) => doc.primaryMusicId)
          .filter((id): id is Id<"music"> => id !== undefined),
      ),
    );

    const musicDataById = new Map<Id<"music">, {
      _id: Id<"music">;
      title?: string;
      imageUrl?: string;
      audioUrl?: string;
      duration?: number;
      lyric?: string;
      lyricWithTime?: {
        alignedWords: Array<{
          word: string;
          startS: number;
          endS: number;
          palign: number;
        }>;
        waveformData: number[];
        hootCer: number;
      };
      status: "pending" | "ready" | "failed";
    }>();

    await Promise.all(
      uniqueMusicIds.map(async (musicId) => {
        const music = await ctx.db.get(musicId);
        if (music) {
          const imageUrl = music.imageUrl ?? music.metadata?.source_image_url;
          const audioUrl =
            music.audioUrl ??
            music.metadata?.stream_audio_url ??
            music.metadata?.source_audio_url;

          musicDataById.set(musicId, {
            _id: music._id,
            title: music.title,
            imageUrl: imageUrl,
            audioUrl: audioUrl,
            duration: music.duration,
            lyric: music.lyric,
            lyricWithTime: music.lyricWithTime,
            status: music.status,
          });
        }
      }),
    );

    return diaries.map((doc) => ({
      _id: doc._id,
      userId: doc.userId,
      title: doc.title,
      content: doc.content,
      date: doc.date,
      primaryMusicId: doc.primaryMusicId,
      updatedAt: doc.updatedAt,
      primaryMusic: doc.primaryMusicId
        ? musicDataById.get(doc.primaryMusicId)
        : undefined,
    }));
  },
});

// ============================================================================
// Memory System Logic (Migrated from memory/diary.ts)
// ============================================================================

export const getDiaryContext = internalQuery({
  args: {
    diaryId: v.id("diaries"),
  },
  handler: async (ctx, args) => {
    const diary = await ctx.db.get(args.diaryId);
    if (!diary) return null;

    const people = await ctx.db
      .query("people")
      .withIndex("by_userId", (q) => q.eq("userId", diary.userId))
      .collect();

    const themes = await ctx.db
      .query("userTags")
      .withIndex("by_userId", (q) => q.eq("userId", diary.userId))
      .collect();

    return {
      diary,
      existingPeople: people.map((p) => p.primaryName),
      existingTags: themes.map((t) => t.canonicalName),
    };
  },
});

export const saveDiaryEvents = internalMutation({
  args: {
    diaryId: v.id("diaries"),
    extractedEvents: v.array(
      v.object({
        title: v.string(),
        summary: v.string(),
        happenedAt: v.number(),
        tags: v.array(v.string()),
        people: v.array(v.string()),
        mood: v.optional(
          v.union(
            v.literal(-2),
            v.literal(-1),
            v.literal(0),
            v.literal(1),
            v.literal(2),
          ),
        ),
        arousal: v.optional(
          v.union(
            v.literal(1),
            v.literal(2),
            v.literal(3),
            v.literal(4),
            v.literal(5),
          ),
        ),
        anniversaryCandidate: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const diary = await ctx.db.get(args.diaryId);
    if (!diary) {
      console.warn(`Diary ${args.diaryId} not found during processing`);
      return;
    }
    // 1. Delete existing events for this diary
    const existingEvents = await ctx.db
      .query("events")
      .withIndex("by_diaryId", (q) => q.eq("diaryId", diary._id))
      .collect();

    await Promise.all(existingEvents.map((e) => ctx.db.delete(e._id)));

    // 2. Insert new events and handle People/Themes
    for (const eventData of args.extractedEvents) {
      const personIds = [];
      // Simple person resolution
      for (const name of eventData.people) {
        const normalizedName = normalizePersonName(name);
        let person = await ctx.db
          .query("people")
          .withIndex("by_userId_and_primaryName", (q) =>
            q.eq("userId", diary.userId).eq("primaryName", normalizedName)
          )
          .first();

        if (!person) {
          const personId = await ctx.db.insert("people", {
            userId: diary.userId,
            primaryName: normalizedName,
            interactionCount: 1,
            lastMentionedAt: eventData.happenedAt,
          });
          personIds.push(personId);
        } else {
          personIds.push(person._id);
          // Update stats
          await ctx.db.patch(person._id, {
            interactionCount: (person.interactionCount || 0) + 1,
            lastMentionedAt: Math.max(person.lastMentionedAt || 0, eventData.happenedAt)
          });
        }
      }

      // Simple Theme/Tag handling (populate userTags)
      const tags = eventData.tags.map(normalizeTag);

      for (const tag of tags) {
        const existingTheme = await ctx.db
          .query("userTags")
          .withIndex("by_userId_and_canonicalName", (q) =>
            q.eq("userId", diary.userId).eq("canonicalName", tag)
          )
          .first();

        if (existingTheme) {
          await ctx.db.patch(existingTheme._id, {
            eventCount: existingTheme.eventCount + 1,
            lastUsedAt: eventData.happenedAt,
          });
        } else {
          await ctx.db.insert("userTags", {
            userId: diary.userId,
            canonicalName: tag,
            displayName: tag, // Use canonical as display for now
            eventCount: 1,
            lastUsedAt: eventData.happenedAt,
          });
        }
      }

      const eventRecord: Omit<Doc<"events">, "_id" | "_creationTime"> = {
        userId: diary.userId,
        diaryId: diary._id,
        happenedAt: eventData.happenedAt,
        title: eventData.title,
        summary: eventData.summary,
        tags: tags,
        personIds: personIds,
      };

      if (eventData.mood !== undefined) {
        eventRecord.mood = eventData.mood;
      }

      if (eventData.arousal !== undefined) {
        eventRecord.arousal = eventData.arousal;
      }

      if (eventData.anniversaryCandidate !== undefined) {
        eventRecord.anniversaryCandidate = eventData.anniversaryCandidate;
      }

      await ctx.db.insert("events", eventRecord);
    }

    // 3. Update Diary metadata (version tracking if needed, but lastProcessedAt is removed)
    // For now, we just leave it as is or update version if we want to track processing version
    // But since lastProcessedAt is gone, we don't update it.
  },
});

export const processDiaryEntry = internalAction({
  args: {
    diaryId: v.id("diaries"),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.diaries.getDiaryContext, {
      diaryId: args.diaryId,
    });

    if (!context || !context.diary) {
      console.warn(`Diary ${args.diaryId} not found during processing`);
      return;
    }

    const { diary, existingPeople, existingTags } = context;

    const extractedEvents = await extractEventsFromDiary(
      diary.content,
      diary.date,
      existingPeople,
      existingTags
    );

    await ctx.runMutation(internal.diaries.saveDiaryEvents, {
      diaryId: args.diaryId,
      extractedEvents,
    });
  },
});
