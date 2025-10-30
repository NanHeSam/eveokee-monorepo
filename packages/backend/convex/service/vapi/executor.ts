/**
 * VAPI Call Executor
 * Runs every minute to process calls that are ready
 */

import { internalAction, internalMutation } from "../../_generated/server";
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { calculateNextRunAtUTC, calculateLocalMinutes, calculateBydayMask } from "../../utils/cadenceHelpers";

/**
 * Main executor - scans for settings that are ready to fire
 */
export const executeScheduledCalls = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    console.log("Executing scheduled calls at", new Date(now).toISOString());
    
    // Get settings ready to call
    const settingsToCall = await ctx.runMutation(
      internal.callSettings.getActiveCallSettingsForExecutor,
      { currentTime: now }
    );
    
    console.log(`Found ${settingsToCall.length} settings ready to call`);
    
    for (const setting of settingsToCall) {
      try {
        // Calculate and update next run time FIRST to prevent duplicate execution
        // This also calculates the proper scheduledForUTC for migrated records
        const result = await ctx.runMutation(
          internal.service.vapi.executor.calculateAndUpdateNextRun,
          {
            settingsId: setting._id,
            currentTime: now,
          }
        );

        console.log(`Updated next run for settings ${setting._id}, next run: ${new Date(result.nextRunAtUTC).toISOString()}`);

        // Use the calculated scheduled time (handles both new and migrated records)
        const scheduledForUTC = result.scheduledForUTC;

        // Schedule the call to be processed immediately
        await ctx.scheduler.runAfter(0, internal.service.vapi.executor.processCallJob, {
          callSettingsId: setting._id,
          userId: setting.userId,
          phoneE164: setting.phoneE164,
          scheduledForUTC,
        });

        console.log(`Scheduled call for settings ${setting._id}`);
      } catch (error) {
        console.error(`Failed to process call for settings ${setting._id}:`, error);
      }
    }
    
    return { processed: settingsToCall.length };
  },
});

/**
 * Calculate and update next run time for a settings record
 * Combines calculation and update in one mutation to avoid race conditions
 */
export const calculateAndUpdateNextRun = internalMutation({
  args: {
    settingsId: v.id("callSettings"),
    currentTime: v.number(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db.get(args.settingsId);

    if (!settings) {
      throw new Error(`Settings not found: ${args.settingsId}`);
    }

    // If cadence fields are missing, calculate them
    let localMinutes = settings.localMinutes;
    let bydayMask = settings.bydayMask;

    if (localMinutes === undefined || bydayMask === undefined) {
      localMinutes = calculateLocalMinutes(settings.timeOfDay);
      bydayMask = calculateBydayMask(settings.cadence, settings.daysOfWeek);
    }

    // For migrated records without nextRunAtUTC, use the setting's actual scheduled time
    // instead of the current execution time to avoid wrong time context in calls
    const scheduledForUTC = settings.nextRunAtUTC ?? args.currentTime;

    // Calculate next run time
    const nextRun = calculateNextRunAtUTC(
      localMinutes,
      bydayMask,
      settings.timezone,
      args.currentTime
    );

    // Update in database
    const now = Date.now();
    await ctx.db.patch(args.settingsId, {
      localMinutes,
      bydayMask,
      nextRunAtUTC: nextRun,
      updatedAt: now,
    });

    return { nextRunAtUTC: nextRun, scheduledForUTC };
  },
});

/**
 * Process a call job for a specific settings record
 */
export const processCallJob = internalAction({
  args: {
    callSettingsId: v.id("callSettings"),
    userId: v.id("users"),
    phoneE164: v.string(),
    scheduledForUTC: v.number(),
  },
  handler: async (ctx, args) => {
    console.log(`Processing call job for user ${args.userId}`);
    
    try {
      // Create the call job
      const jobId = await ctx.runMutation(internal.callJobs.createCallJob, {
        userId: args.userId,
        callSettingsId: args.callSettingsId,
        scheduledForUTC: args.scheduledForUTC,
      });
      
      console.log(`Created call job ${jobId}`);
      
      // Schedule the VAPI call (immediate, no scheduledFor field)
      const scheduleResult = await ctx.runAction(internal.integrations.vapi.integration.scheduleVapiCall, {
        jobId,
        phoneNumber: args.phoneE164,
        userId: args.userId,
      });
      
      if (scheduleResult.success) {
        console.log(`Successfully scheduled VAPI call for job ${jobId}, VAPI call ID: ${scheduleResult.vapiCallId}`);
      } else {
        console.error(`Failed to schedule VAPI call for job ${jobId}: ${scheduleResult.error}`);
      }
      
      return { jobId, success: scheduleResult.success };
    } catch (error) {
      console.error(`Failed to process call job:`, error);
      throw error;
    }
  },
});
