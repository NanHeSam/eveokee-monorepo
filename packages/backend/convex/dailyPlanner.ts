/**
 * Daily Planner for VAPI Calls
 * Scheduled job that runs daily to plan and schedule calls for eligible users
 */

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { isTodayInCadence } from "./cadenceHelpers";
import { localTimeToUTC, getUTCDayBounds } from "./timezoneHelpers";

/**
 * Daily planner job - should be run once per day (e.g., at 00:00 UTC)
 * This function:
 * 1. Loads all active call settings
 * 2. For each setting, checks if today matches their cadence
 * 3. If yes, computes the UTC time for their local scheduled time
 * 4. If that time is in the future and no job exists for today, creates a job and schedules with VAPI
 */
export const runDailyPlanner = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("Starting daily planner job...");
    
    try {
      const activeSettings = await ctx.runQuery(internal.callSettings.getActiveCallSettings);
      
      console.log(`Found ${activeSettings.length} active call settings`);
      
      const results = {
        total: activeSettings.length,
        scheduled: 0,
        skipped: 0,
        failed: 0,
        errors: [] as Array<{ userId: string; error: string }>,
      };
      
      for (const setting of activeSettings) {
        try {
          const matchesCadence = isTodayInCadence(
            setting.cadence,
            setting.timezone,
            setting.daysOfWeek
          );
          
          if (!matchesCadence) {
            console.log(`User ${setting.userId} - today does not match cadence ${setting.cadence}`);
            results.skipped++;
            continue;
          }
          
          const scheduledForUTC = localTimeToUTC(setting.timeOfDay, setting.timezone);
          
          const now = Date.now();
          if (scheduledForUTC <= now) {
            console.log(`User ${setting.userId} - scheduled time ${setting.timeOfDay} has already passed today`);
            results.skipped++;
            continue;
          }
          
          const { startOfDay, endOfDay } = getUTCDayBounds(setting.timezone);
          
          const hasExistingJob = await ctx.runMutation(internal.callJobs.hasCallJobForDay, {
            userId: setting.userId,
            startOfDayUTC: startOfDay,
            endOfDayUTC: endOfDay,
          });
          
          if (hasExistingJob) {
            console.log(`User ${setting.userId} - job already exists for today`);
            results.skipped++;
            continue;
          }
          
          const jobId = await ctx.runMutation(internal.callJobs.createCallJob, {
            userId: setting.userId,
            callSettingsId: setting._id,
            scheduledForUTC,
          });
          
          console.log(`Created job ${jobId} for user ${setting.userId}, scheduled for ${new Date(scheduledForUTC).toISOString()}`);
          
          const scheduleResult = await ctx.runAction(internal.vapiIntegration.scheduleVapiCall, {
            jobId,
            phoneNumber: setting.phoneE164,
            scheduledForUTC,
            userId: setting.userId,
          });
          
          if (scheduleResult.success) {
            console.log(`Successfully scheduled VAPI call for user ${setting.userId}, VAPI call ID: ${scheduleResult.vapiCallId}`);
            results.scheduled++;
          } else {
            console.error(`Failed to schedule VAPI call for user ${setting.userId}: ${scheduleResult.error}`);
            results.failed++;
            results.errors.push({
              userId: setting.userId,
              error: scheduleResult.error || "Unknown error",
            });
          }
        } catch (error) {
          console.error(`Error processing setting for user ${setting.userId}:`, error);
          results.failed++;
          results.errors.push({
            userId: setting.userId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
      
      console.log("Daily planner job completed:", results);
      
      return results;
    } catch (error) {
      console.error("Daily planner job failed:", error);
      throw error;
    }
  },
});

/**
 * Manual trigger for daily planner (for testing/debugging)
 * This can be called from the Convex dashboard or via API
 */
export const triggerDailyPlanner = internalAction({
  args: {},
  handler: async (ctx) => {
    return await ctx.runAction(internal.dailyPlanner.runDailyPlanner);
  },
});
