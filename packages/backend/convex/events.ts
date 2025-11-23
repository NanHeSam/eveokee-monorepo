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
    handler: async (ctx, args) => {
        const event = await ctx.db.get(args.eventId);
        if (!event) {
            return null;
        }

        // Verify ownership
        const user = await ctx.auth.getUserIdentity();
        if (!user || user.subject !== (await ctx.db.get(event.userId))?.clerkId) {
            // We can't easily check ownership without fetching user first, 
            // but let's assume if we can't find the user or it doesn't match, we return null.
            // Actually, let's just check if the event belongs to the current user.
            // We need to get the current user's ID from our users table.
            // But since this is a query, we can just use ensureCurrentUser logic if we want strictness,
            // or just rely on the fact that we filter by userId usually.
            // For simplicity and performance in query, let's just fetch the user record if needed.
            // But wait, `ensureCurrentUser` is for mutations usually or async.
            // Let's just fetch the user based on auth.
        }

        // Better way:
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
        }

        return {
            ...event,
            peopleDetails,
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
        importance: v.optional(v.number()),
        mood: v.optional(v.union(v.literal(-2), v.literal(-1), v.literal(0), v.literal(1), v.literal(2))),
        tags: v.optional(v.array(v.string())),
        // For people, we might want to add/remove. For now, let's just allow updating the list of names?
        // Or maybe we just update the IDs if the frontend handles person management.
        // The design shows "People" list. If we want to add a person, we probably need a separate flow or just pass names.
        // Let's support passing a list of names to sync with.
        peopleNames: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        const { userId } = await ensureCurrentUser(ctx);
        const event = await ctx.db.get(args.eventId);

        if (!event || event.userId !== userId) {
            throw new Error("Event not found or unauthorized");
        }

        const updates: any = {};
        if (args.title !== undefined) updates.title = args.title;
        if (args.summary !== undefined) updates.summary = args.summary;
        if (args.importance !== undefined) updates.importance = args.importance;
        if (args.mood !== undefined) updates.mood = args.mood;

        if (args.tags !== undefined) {
            // Normalize tags
            updates.tags = args.tags.map(normalizeTag);

            // Update userTags stats (increment/decrement) - simplified for now, just updating the event.
            // Ideally we should recount or update lastUsedAt.
            // For this task, let's just update the event tags.
        }

        if (args.peopleNames !== undefined) {
            // Resolve people names to IDs, creating if necessary
            const personIds: Id<"people">[] = [];
            for (const name of args.peopleNames) {
                const normalizedName = normalizePersonName(name);
                const existingPerson = await ctx.db
                    .query("people")
                    .withIndex("by_userId_and_primaryName", (q) =>
                        q.eq("userId", userId).eq("primaryName", normalizedName)
                    )
                    .first();

                if (existingPerson) {
                    personIds.push(existingPerson._id);
                } else {
                    const newPersonId = await ctx.db.insert("people", {
                        userId,
                        primaryName: normalizedName,
                        interactionCount: 1,
                        lastMentionedAt: Date.now(),
                    });
                    personIds.push(newPersonId);
                }
            }
            updates.personIds = personIds;
        }

        await ctx.db.patch(args.eventId, updates);
    },
});
