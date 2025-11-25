import { query, mutation, action, internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import ensureCurrentUser from "../users";
import { moodNumberToWord, arousalNumberToWord, generateRelationshipHighlight } from "./util";

export const getPersonDetail = query({
  args: {
    personId: v.id("people"),
  },
  returns: v.union(
    v.object({
      person: v.object({
        _id: v.id("people"),
        _creationTime: v.number(),
        userId: v.id("users"),
        primaryName: v.string(),
        altNames: v.optional(v.array(v.string())),
        relationshipLabel: v.optional(v.string()),
        lastMentionedAt: v.optional(v.number()),
        interactionCount: v.optional(v.number()),
        highlights: v.optional(v.object({
          summary: v.string(),
          lastGeneratedAt: v.number(),
        })),
      }),
      recentEvents: v.array(
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
          tags: v.optional(v.array(v.string())),
          tagsDetails: v.optional(
            v.array(
              v.object({
                _id: v.id("userTags"),
                name: v.string(),
                displayName: v.string(),
              })
            )
          ),
          moodWord: v.optional(v.string()),
          arousalWord: v.optional(v.string()),
        })
      ),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const { userId } = await ensureCurrentUser(ctx);
    const person = await ctx.db.get(args.personId);

    if (!person || person.userId !== userId) {
      return null;
    }

    // Fetch recent events for this person
    // Note: We are scanning recent events because we don't have an inverted index on personIds yet.
    const recentEvents = await ctx.db
      .query("events")
      .withIndex("by_userId_and_happenedAt", q => q.eq("userId", userId))
      .order("desc")
      .take(100);

    const filteredEvents = recentEvents.filter(e => e.personIds?.includes(args.personId));
    
    // Sort by happenedAt descending (most recent first) and take top 3
    const topEvents = filteredEvents
      .sort((a, b) => b.happenedAt - a.happenedAt)
      .slice(0, 3);
    
    // Resolve tags for these events
    const tagIds = new Set<Id<"userTags">>();
    topEvents.forEach(e => e.tagIds?.forEach(id => tagIds.add(id)));
    
    const tagsMap = new Map<Id<"userTags">, Doc<"userTags">>();
    await Promise.all(Array.from(tagIds).map(async (id) => {
        const t = await ctx.db.get(id);
        if (t) tagsMap.set(id, t);
    }));

    const events = topEvents.map(e => {
      const tags = e.tagIds?.map(id => {
        const t = tagsMap.get(id);
        return t?.displayName ?? t?.canonicalName;
      }).filter(Boolean);
      const tagsDetails = e.tagIds?.map(id => {
        const t = tagsMap.get(id);
        return t ? {
          _id: t._id,
          name: t.canonicalName,
          displayName: t.displayName,
        } : null;
      }).filter(Boolean);
      
      return {
        ...e,
        tags: tags && tags.length > 0 ? tags : undefined,
        tagsDetails: tagsDetails && tagsDetails.length > 0 ? tagsDetails : undefined,
        moodWord: moodNumberToWord(e.mood),
        arousalWord: arousalNumberToWord(e.arousal),
      };
    });

    return {
      person,
      recentEvents: events
    };
  },
});

export const listPeople = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("people"),
      _creationTime: v.number(),
      userId: v.id("users"),
      primaryName: v.string(),
      altNames: v.optional(v.array(v.string())),
      relationshipLabel: v.optional(v.string()),
      lastMentionedAt: v.optional(v.number()),
      interactionCount: v.optional(v.number()),
      highlights: v.optional(v.object({
        summary: v.string(),
        lastGeneratedAt: v.number(),
      })),
    })
  ),
  handler: async (ctx) => {
    const { userId } = await ensureCurrentUser(ctx);
    return await ctx.db
      .query("people")
      .withIndex("by_userId_and_interactionCount", q => q.eq("userId", userId))
      .order("desc")
      .take(50);
  }
});

export const updatePerson = mutation({
  args: {
    personId: v.id("people"),
    primaryName: v.optional(v.string()),
    altNames: v.optional(v.array(v.string())),
    relationshipLabel: v.optional(v.string()),
    highlights: v.optional(v.object({
      summary: v.string(),
      lastGeneratedAt: v.number(),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId } = await ensureCurrentUser(ctx);
    const person = await ctx.db.get(args.personId);

    if (!person || person.userId !== userId) {
      throw new Error("Person not found or unauthorized");
    }

    const updates: Partial<Doc<"people">> = {};
    if (args.primaryName !== undefined) {
      updates.primaryName = args.primaryName;
    }
    if (args.altNames !== undefined) {
      updates.altNames = args.altNames.length > 0 ? args.altNames : undefined;
    }
    if (args.relationshipLabel !== undefined) {
      updates.relationshipLabel = args.relationshipLabel || undefined;
    }
    if (args.highlights !== undefined) {
      updates.highlights = args.highlights;
    }

    await ctx.db.patch(args.personId, updates);
    return null;
  },
});

export const generatePersonHighlight = action({
  args: {
    personId: v.id("people"),
  },
  returns: v.object({
    summary: v.string(),
    lastGeneratedAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    // Get user ID from internal query
    const userResult = await ctx.runQuery(internal.users.getCurrentUserForAction);
    if (!userResult) {
      throw new Error("User not found");
    }
    const userId = userResult.userId;
    
    // Get person details
    const person = await ctx.runQuery(internal.memory.people.getPersonForHighlight, {
      personId: args.personId,
      userId,
    });

    if (!person) {
      throw new Error("Person not found or unauthorized");
    }

    // Get recent events for this person
    const events = await ctx.runQuery(internal.memory.people.getPersonEventsForHighlight, {
      personId: args.personId,
      userId,
    });

    if (events.length === 0) {
      throw new Error("No events found for this person");
    }

    const highlightSummary = await generateRelationshipHighlight(person.primaryName, events);

    // Save to database
    const now = Date.now();
    await ctx.runMutation(internal.memory.people.updatePersonHighlight, {
      personId: args.personId,
      highlights: {
        summary: highlightSummary,
        lastGeneratedAt: now,
      },
    });

    return {
      summary: highlightSummary,
      lastGeneratedAt: now,
    };
  },
});

// Internal query to get person for highlight generation
export const getPersonForHighlight = internalQuery({
  args: {
    personId: v.id("people"),
    userId: v.id("users"),
  },
  returns: v.union(
    v.object({
      _id: v.id("people"),
      _creationTime: v.number(),
      userId: v.id("users"),
      primaryName: v.string(),
      altNames: v.optional(v.array(v.string())),
      relationshipLabel: v.optional(v.string()),
      lastMentionedAt: v.optional(v.number()),
      interactionCount: v.optional(v.number()),
      highlights: v.optional(v.object({
        summary: v.string(),
        lastGeneratedAt: v.number(),
      })),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const person = await ctx.db.get(args.personId);
    if (!person || person.userId !== args.userId) {
      return null;
    }
    return person;
  },
});

// Internal query to get events for highlight generation
export const getPersonEventsForHighlight = internalQuery({
  args: {
    personId: v.id("people"),
    userId: v.id("users"),
  },
  returns: v.array(
    v.object({
      title: v.string(),
      summary: v.string(),
      happenedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Get recent events (up to 20) for this person
    const recentEvents = await ctx.db
      .query("events")
      .withIndex("by_userId_and_happenedAt", q => q.eq("userId", args.userId))
      .order("desc")
      .take(100);

    const filteredEvents = recentEvents
      .filter(e => e.personIds?.includes(args.personId))
      .slice(0, 20)
      .map(e => ({
        title: e.title,
        summary: e.summary,
        happenedAt: e.happenedAt,
      }));

    return filteredEvents;
  },
});

// Internal mutation to update person highlight
export const updatePersonHighlight = internalMutation({
  args: {
    personId: v.id("people"),
    highlights: v.object({
      summary: v.string(),
      lastGeneratedAt: v.number(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.personId, {
      highlights: args.highlights,
    });
    return null;
  },
});

