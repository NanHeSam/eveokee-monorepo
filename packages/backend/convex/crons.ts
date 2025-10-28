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
 * VAPI Call Executor
 * 
 * Runs every minute to:
 * 1. Find call settings where nextRunAtUTC <= now
 * 2. Schedule immediate VAPI calls for those settings
 * 3. Calculate and update nextRunAtUTC for the next occurrence
 * 
 * This ensures calls are scheduled efficiently without scanning all settings daily.
 */
crons.interval(
  "call-executor",
  { minutes: 1 },
  internal.service.vapi.executor.executeScheduledCalls,
  {}
);

export default crons;
