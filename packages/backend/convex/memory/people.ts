import { query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import ensureCurrentUser from "../users";
import { moodNumberToWord, arousalNumberToWord } from "./util";

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

    const filteredEvents = recentEvents.filter(e => e.personIds?.includes(args.personId));
    
    // Resolve tags for these events
    const tagIds = new Set<Id<"userTags">>();
    filteredEvents.forEach(e => e.tagIds?.forEach(id => tagIds.add(id)));
    
    const tagsMap = new Map<Id<"userTags">, any>();
    await Promise.all(Array.from(tagIds).map(async (id) => {
        const t = await ctx.db.get(id);
        if (t) tagsMap.set(id, t);
    }));

    const events = filteredEvents.map(e => {
      const tags = e.tagIds?.map(id => tagsMap.get(id)?.displayName || tagsMap.get(id)?.canonicalName).filter(Boolean);
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
  handler: async (ctx) => {
    const { userId } = await ensureCurrentUser(ctx);
    return await ctx.db
      .query("people")
      .withIndex("by_userId_and_interactionCount", q => q.eq("userId", userId))
      .order("desc")
      .take(50);
  }
});

