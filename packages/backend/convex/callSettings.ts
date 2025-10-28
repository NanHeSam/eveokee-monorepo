/**
 * Call Settings CRUD operations
 * Manages user call configuration for VAPI integration
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";
import { isValidE164, isValidTimeOfDay, isValidTimezone } from "./timezoneHelpers";
import { isValidCadenceConfig } from "./cadenceHelpers";

/**
 * Get current user's call settings
 */
export const getCallSettings = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    const settings = await ctx.db
      .query("callSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    
    return settings;
  },
});

/**
 * Create or update call settings for current user
 */
export const upsertCallSettings = mutation({
  args: {
    phoneE164: v.string(),
    timezone: v.string(),
    timeOfDay: v.string(),
    cadence: v.union(
      v.literal("daily"),
      v.literal("weekdays"),
      v.literal("weekends"),
      v.literal("custom")
    ),
    daysOfWeek: v.optional(v.array(v.number())),
    active: v.boolean(),
    voiceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    if (!isValidE164(args.phoneE164)) {
      throw new Error("Invalid phone number. Must be in E.164 format (e.g., +12125551234)");
    }
    
    if (!isValidTimezone(args.timezone)) {
      throw new Error("Invalid timezone. Must be a valid IANA timezone (e.g., America/New_York)");
    }
    
    if (!isValidTimeOfDay(args.timeOfDay)) {
      throw new Error("Invalid time of day. Must be in HH:MM format (24h)");
    }
    
    if (!isValidCadenceConfig(args.cadence, args.daysOfWeek)) {
      throw new Error("Invalid cadence configuration. Custom cadence requires daysOfWeek array with values 0-6");
    }
    
    const now = Date.now();
    
    const existing = await ctx.db
      .query("callSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        phoneE164: args.phoneE164,
        timezone: args.timezone,
        timeOfDay: args.timeOfDay,
        cadence: args.cadence,
        daysOfWeek: args.daysOfWeek,
        active: args.active,
        voiceId: args.voiceId,
        updatedAt: now,
      });
      
      return { settingsId: existing._id, updated: true };
    } else {
      const settingsId = await ctx.db.insert("callSettings", {
        userId: user._id,
        phoneE164: args.phoneE164,
        timezone: args.timezone,
        timeOfDay: args.timeOfDay,
        cadence: args.cadence,
        daysOfWeek: args.daysOfWeek,
        active: args.active,
        voiceId: args.voiceId,
        updatedAt: now,
      });
      
      return { settingsId, updated: false };
    }
  },
});

/**
 * Toggle active status of call settings
 */
export const toggleCallSettings = mutation({
  args: {
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    const settings = await ctx.db
      .query("callSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    
    if (!settings) {
      throw new Error("No call settings found. Please create settings first.");
    }
    
    await ctx.db.patch(settings._id, {
      active: args.active,
      updatedAt: Date.now(),
    });
    
    return { success: true };
  },
});

/**
 * Delete call settings for current user
 */
export const deleteCallSettings = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    const settings = await ctx.db
      .query("callSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    
    if (!settings) {
      throw new Error("No call settings found");
    }
    
    const pendingJobs = await ctx.db
      .query("callJobs")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .filter((q) => 
        q.or(
          q.eq(q.field("status"), "queued"),
          q.eq(q.field("status"), "scheduled")
        )
      )
      .collect();
    
    for (const job of pendingJobs) {
      await ctx.db.patch(job._id, {
        status: "canceled",
        updatedAt: Date.now(),
      });
    }
    
    await ctx.db.delete(settings._id);
    
    return { success: true, canceledJobs: pendingJobs.length };
  },
});

/**
 * Get all active call settings (for daily planner)
 * Internal function for scheduled jobs
 */
export const getActiveCallSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db
      .query("callSettings")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    
    return settings;
  },
});
