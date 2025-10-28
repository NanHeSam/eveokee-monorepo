/**
 * Call Settings CRUD operations
 * Manages user call configuration for VAPI integration
 */

import { v } from "convex/values";
import { mutation, internalMutation, internalQuery } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";
import { isValidE164 } from "./phoneHelpers";
import { isValidTimeOfDay, isValidTimezone } from "./timezoneHelpers";
import { isValidCadenceConfig, calculateLocalMinutes, calculateBydayMask, calculateNextRunAtUTC } from "./cadenceHelpers";

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
