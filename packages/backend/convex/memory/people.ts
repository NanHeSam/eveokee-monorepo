import { query } from "../_generated/server";
import { v } from "convex/values";
import ensureCurrentUser from "../users";

export const getPersonDetail = query({
  args: {
    personId: v.id("people"),
  },
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

    const events = recentEvents.filter(e => e.personIds?.includes(args.personId));

    return {
      person,
      recentEvents: events
    };
  },
});

export const listPeople = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await ensureCurrentUser(ctx);
    return await ctx.db
      .query("people")
      .withIndex("by_userId_and_interactionCount", q => q.eq("userId", userId))
      .order("desc")
      .take(50);
  }
});

