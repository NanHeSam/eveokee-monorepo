import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import ensureCurrentUser from "../users";
import { Id } from "../_generated/dataModel";
import { moodNumberToWord, arousalNumberToWord } from "./util";

export const getTimelineEvents = query({
  args: {
    range: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await ensureCurrentUser(ctx);

    let q = ctx.db
      .query("events")
      .withIndex("by_userId_and_happenedAt", (q) => q.eq("userId", userId));

    // For Phase 1, just take the most recent ones.
    // If filtering by range is strictly needed, we can do it in memory for small datasets or improve query later.
    const events = await q.order("desc").take(args.limit || 50);
    
    const personIds = new Set<Id<"people">>();
    events.forEach(e => e.personIds?.forEach(id => personIds.add(id)));
    
    const peopleMap = new Map<Id<"people">, any>();
    await Promise.all(Array.from(personIds).map(async (id) => {
        const p = await ctx.db.get(id);
        if (p) peopleMap.set(id, p);
    }));

    // Resolve tags
    const tagIds = new Set<Id<"userTags">>();
    events.forEach(e => e.tagIds?.forEach(id => tagIds.add(id)));
    
    const tagsMap = new Map<Id<"userTags">, any>();
    await Promise.all(Array.from(tagIds).map(async (id) => {
        const t = await ctx.db.get(id);
        if (t) tagsMap.set(id, t);
    }));

    return events.map(e => ({
        ...e,
        people: e.personIds?.map(id => peopleMap.get(id)).filter(Boolean),
        tags: e.tagIds?.map(id => tagsMap.get(id)?.displayName || tagsMap.get(id)?.canonicalName).filter(Boolean),
        tagsDetails: e.tagIds?.map(id => {
            const t = tagsMap.get(id);
            return t ? {
                _id: t._id,
                name: t.canonicalName,
                displayName: t.displayName,
            } : null;
        }).filter(Boolean),
        moodWord: moodNumberToWord(e.mood),
        arousalWord: arousalNumberToWord(e.arousal),
    }));
  },
});

