import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import ensureCurrentUser from "./users";
import { normalizeTag, normalizePersonName, moodNumberToWord, arousalNumberToWord } from "./memory/util";

/**
 * Get a single event by ID with resolved details
 */
export const getEvent = query({
    args: {
        eventId: v.id("events"),
    },
    returns: v.union(
        v.null(),
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
            arousal: v.optional(v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4), v.literal(5))),
            anniversaryCandidate: v.optional(v.boolean()),
            tagIds: v.optional(v.array(v.id("userTags"))),
            people: v.array(v.object({
                _id: v.id("people"),
                name: v.string(),
            })),
            tags: v.array(v.object({
                _id: v.id("userTags"),
                name: v.string(),
            })),
            moodWord: v.string(),
            arousalWord: v.string(),
        })
    ),
    handler: async (ctx, args) => {
        const event = await ctx.db.get(args.eventId);
        if (!event) {
            return null;
        }

        // Verify ownership
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return null;
        }
        const userRecord = await ctx.db
            .query("users")
            .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (!userRecord || userRecord._id !== event.userId) {
            return null;
        }

        // Resolve people
        let people: { _id: Id<"people">; name: string }[] = [];
        let peopleDetails: { _id: Id<"people">; name: string; role?: string }[] = [];
        if (event.personIds && event.personIds.length > 0) {
            const peopleDocs = await Promise.all(
                event.personIds.map((id) => ctx.db.get(id))
            );
            peopleDetails = peopleDocs
                .filter((p) => p !== null)
                .map((p) => ({
                    _id: p!._id,
                    name: p!.primaryName,
                    role: p!.relationshipLabel,
                }));
            people = peopleDetails.map((p) => ({
                _id: p._id,
                name: p.name,
            }));
        }

        // Resolve tags
        let tags: { _id: Id<"userTags">; name: string }[] = [];
        if (event.tagIds && event.tagIds.length > 0) {
            const tagDocs = await Promise.all(
                event.tagIds.map((id) => ctx.db.get(id))
            );
            tags = tagDocs
                .filter((t) => t !== null)
                .map((t) => ({
                    _id: t!._id,
                    name: t!.displayName, // Use displayName for the name shown to users
                }));
        }

        return {
            ...event,
            people,
            tags,
            moodWord: moodNumberToWord(event.mood),
            arousalWord: arousalNumberToWord(event.arousal),
        };
    },
});

/**
 * Update an event's details
 */
export const updateEvent = mutation({
    args: {
        eventId: v.id("events"),
        title: v.optional(v.string()),
        summary: v.optional(v.string()),
        mood: v.optional(v.union(v.literal(-2), v.literal(-1), v.literal(0), v.literal(1), v.literal(2))),
        arousal: v.optional(v.union(v.literal(1), v.literal(2), v.literal(3), v.literal(4), v.literal(5))),
        tags: v.optional(v.array(v.string())),
        peopleNames: v.optional(v.array(v.string())),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const { userId } = await ensureCurrentUser(ctx);
        const event = await ctx.db.get(args.eventId);

        if (!event || event.userId !== userId) {
            throw new Error("Event not found or unauthorized");
        }

        const updates: any = {};
        if (args.title !== undefined) updates.title = args.title;
        if (args.summary !== undefined) updates.summary = args.summary;
        if (args.mood !== undefined) updates.mood = args.mood;
        if (args.arousal !== undefined) updates.arousal = args.arousal;

        if (args.tags !== undefined) {
            // Capture old tag IDs from the existing event
            const oldTagIds = event.tagIds || [];
            const oldTagIdsSet = new Set(oldTagIds);

            // Resolve tag names to tag IDs, creating if necessary
            const newTagIds: Id<"userTags">[] = [];
            const newlyCreatedTagIds = new Set<Id<"userTags">>();
            const normalizedTags = args.tags.map(normalizeTag);

            for (const tag of normalizedTags) {
                const existingTag = await ctx.db
                    .query("userTags")
                    .withIndex("by_userId_and_canonicalName", (q) =>
                        q.eq("userId", userId).eq("canonicalName", tag)
                    )
                    .first();

                if (existingTag) {
                    newTagIds.push(existingTag._id);
                } else {
                    const newTagId = await ctx.db.insert("userTags", {
                        userId,
                        canonicalName: tag,
                        displayName: tag, // Use canonical as display for now
                        eventCount: 1,
                        lastUsedAt: Date.now(),
                    });
                    newTagIds.push(newTagId);
                    newlyCreatedTagIds.add(newTagId);
                }
            }

            const newTagIdsSet = new Set(newTagIds);

            // Decrement eventCount for tags that were removed
            for (const oldTagId of oldTagIds) {
                if (!newTagIdsSet.has(oldTagId)) {
                    const tagDoc = await ctx.db.get(oldTagId);
                    if (tagDoc) {
                        const newCount = Math.max(0, (tagDoc.eventCount || 0) - 1);
                        await ctx.db.patch(oldTagId, { eventCount: newCount });
                    }
                }
            }

            // Increment eventCount for tags that were added (but weren't in oldTagIds and weren't just created)
            for (const newTagId of newTagIds) {
                if (!oldTagIdsSet.has(newTagId) && !newlyCreatedTagIds.has(newTagId)) {
                    const tagDoc = await ctx.db.get(newTagId);
                    if (tagDoc) {
                        await ctx.db.patch(newTagId, {
                            eventCount: (tagDoc.eventCount || 0) + 1,
                            lastUsedAt: Date.now(),
                        });
                    }
                }
            }

            updates.tagIds = newTagIds.length > 0 ? newTagIds : undefined;
        }

        if (args.peopleNames !== undefined) {
            // Capture old person IDs from the existing event
            const oldPersonIds = event.personIds || [];
            const oldPersonIdsSet = new Set(oldPersonIds);

            // Resolve people names to IDs, creating if necessary
            const newPersonIds: Id<"people">[] = [];
            const newlyCreatedPersonIds = new Set<Id<"people">>();
            for (const name of args.peopleNames) {
                const normalizedName = normalizePersonName(name);
                const existingPerson = await ctx.db
                    .query("people")
                    .withIndex("by_userId_and_primaryName", (q) =>
                        q.eq("userId", userId).eq("primaryName", normalizedName)
                    )
                    .first();

                if (existingPerson) {
                    newPersonIds.push(existingPerson._id);
                } else {
                    const newPersonId = await ctx.db.insert("people", {
                        userId,
                        primaryName: normalizedName,
                        interactionCount: 1,
                        lastMentionedAt: Date.now(),
                    });
                    newPersonIds.push(newPersonId);
                    newlyCreatedPersonIds.add(newPersonId);
                }
            }

            const newPersonIdsSet = new Set(newPersonIds);

            // Compute sets: removed = old - new, added = new - old, kept = intersection
            const removedPersonIds = oldPersonIds.filter((id) => !newPersonIdsSet.has(id));
            const addedPersonIds = newPersonIds.filter(
                (id) => !oldPersonIdsSet.has(id) && !newlyCreatedPersonIds.has(id)
            );
            const keptPersonIds = newPersonIds.filter(
                (id) => oldPersonIdsSet.has(id) && !newlyCreatedPersonIds.has(id)
            );

            // Decrement interactionCount for removed people (clamp to >= 0)
            for (const removedPersonId of removedPersonIds) {
                const personDoc = await ctx.db.get(removedPersonId);
                if (personDoc) {
                    const newCount = Math.max(0, (personDoc.interactionCount || 0) - 1);
                    await ctx.db.patch(removedPersonId, { interactionCount: newCount });
                }
            }

            // Increment interactionCount for added people (but not newly created ones)
            for (const addedPersonId of addedPersonIds) {
                const personDoc = await ctx.db.get(addedPersonId);
                if (personDoc) {
                    await ctx.db.patch(addedPersonId, {
                        interactionCount: (personDoc.interactionCount || 0) + 1,
                        lastMentionedAt: Date.now(),
                    });
                }
            }

            // Update lastMentionedAt for kept people
            for (const keptPersonId of keptPersonIds) {
                await ctx.db.patch(keptPersonId, {
                    lastMentionedAt: Date.now(),
                });
            }

            // Note: newly created people already have lastMentionedAt set during creation

            updates.personIds = newPersonIds;
        }

        await ctx.db.patch(args.eventId, updates);
    },
});
