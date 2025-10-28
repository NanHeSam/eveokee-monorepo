/**
 * Call Settings CRUD operations
 * Manages user call configuration for VAPI integration
 */

import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";
import { isValidE164, isValidTimeOfDay, isValidTimezone } from "./timezoneHelpers";
import { isValidCadenceConfig, calculateLocalMinutes, calculateBydayMask, calculateNextRunAtUTC } from "./cadenceHelpers";

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
    
    // Calculate canonical cadence fields
    const localMinutes = calculateLocalMinutes(args.timeOfDay);
    const bydayMask = calculateBydayMask(args.cadence, args.daysOfWeek);
    const nextRunAtUTC = calculateNextRunAtUTC(
      localMinutes,
      bydayMask,
      args.timezone,
      now
    );
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        phoneE164: args.phoneE164,
        timezone: args.timezone,
        timeOfDay: args.timeOfDay,
        cadence: args.cadence,
        daysOfWeek: args.daysOfWeek,
        active: args.active,
        localMinutes,
        bydayMask,
        nextRunAtUTC,
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
        localMinutes,
        bydayMask,
        nextRunAtUTC,
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
    
    const now = Date.now();
    
    // If cadence fields are missing, calculate and set them
    const needsCadenceUpdate = 
      settings.localMinutes === undefined || 
      settings.bydayMask === undefined || 
      settings.nextRunAtUTC === undefined;
    
    const update: any = {
      active: args.active,
      updatedAt: now,
    };
    
    if (needsCadenceUpdate) {
      const localMinutes = calculateLocalMinutes(settings.timeOfDay);
      const bydayMask = calculateBydayMask(settings.cadence, settings.daysOfWeek);
      const nextRunAtUTC = calculateNextRunAtUTC(
        localMinutes,
        bydayMask,
        settings.timezone,
        now
      );
      update.localMinutes = localMinutes;
      update.bydayMask = bydayMask;
      update.nextRunAtUTC = nextRunAtUTC;
    }
    
    await ctx.db.patch(settings._id, update);
    
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

/**
 * Get settings that are ready to call (internal for executor)
 */
export const getActiveCallSettingsForExecutor = internalMutation({
  args: {
    currentTime: v.number(),
  },
  handler: async (ctx, args) => {
    // Query where active=true AND nextRunAtUTC <= currentTime
    const settings = await ctx.db
      .query("callSettings")
      .withIndex("by_active_and_nextRunAtUTC", (q) => 
        q.eq("active", true)
         .lte("nextRunAtUTC", args.currentTime)
      )
      .collect();
    
    // Also include active settings with undefined nextRunAtUTC (old documents needing migration)
    const activeSettingsWithoutNextRun = await ctx.db
      .query("callSettings")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    
    const settingsNeedingMigration = activeSettingsWithoutNextRun.filter(
      s => s.nextRunAtUTC === undefined
    );
    
    return [...settings, ...settingsNeedingMigration];
  },
});

/**
 * Get call settings by ID (internal for executor)
 */
export const getCallSettingsById = internalQuery({
  args: {
    settingsId: v.id("callSettings"),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db.get(args.settingsId);
    return settings;
  },
});

/**
 * Update nextRunAtUTC for a settings record (internal for executor)
 */
export const updateNextRunAtUTC = internalMutation({
  args: {
    settingsId: v.id("callSettings"),
    nextRunAtUTC: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.settingsId, {
      nextRunAtUTC: args.nextRunAtUTC,
      updatedAt: now,
    });
  },
});
