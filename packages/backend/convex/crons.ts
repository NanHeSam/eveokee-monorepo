/**
 * Convex Cron Jobs Configuration
 * 
 * This file defines scheduled jobs that run automatically.
 * See: https://docs.convex.dev/scheduling/cron-jobs
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Daily VAPI Call Planner
 * 
 * Runs every day at 00:00 UTC (midnight UTC) to:
 * 1. Load all active call settings
 * 2. Check which users should receive calls today based on their cadence
 * 3. Schedule VAPI calls for eligible users at their local time
 * 
 * This ensures calls are scheduled once per day, accounting for:
 * - User timezone and DST transitions
 * - Cadence preferences (daily, weekdays, weekends)
 * - Avoiding duplicate scheduling
 */
crons.daily(
  "daily-vapi-call-planner",
  {
    hourUTC: 0,
    minuteUTC: 0,
  },
  internal.dailyPlanner.runDailyPlanner
);

export default crons;
