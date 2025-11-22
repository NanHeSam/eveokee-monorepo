import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import ensureCurrentUser from "../users";
import { Id } from "../_generated/dataModel";

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

    return events.map(e => ({
        ...e,
        people: e.personIds?.map(id => peopleMap.get(id)).filter(Boolean)
    }));
  },
});

