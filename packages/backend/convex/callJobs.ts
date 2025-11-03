/**
 * Call Jobs management
 * Handles lifecycle of scheduled VAPI calls
 */

import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";
import { Doc, Id } from "./_generated/dataModel";
import {
  DEFAULT_CALL_JOBS_LIMIT,
  DEFAULT_CALL_JOBS_STATS_LIMIT,
  DEFAULT_CALL_SESSIONS_LIMIT,
  DEFAULT_DASHBOARD_STATS_LIMIT,
} from "./utils/constants";

/**
 * Get call jobs for current user
 */
export const getCallJobs = query({
  args: {
    limit: v.optional(v.number()),
    status: v.optional(v.union(
      v.literal("queued"),
      v.literal("scheduled"),
      v.literal("started"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("canceled")
    )),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    let jobsQuery = ctx.db
      .query("callJobs")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc");
    
    if (args.status) {
      jobsQuery = jobsQuery.filter((q) => q.eq(q.field("status"), args.status));
    }
    
    const jobs = await jobsQuery.take(args.limit || DEFAULT_CALL_JOBS_LIMIT);
    
    return jobs;
  },
});

/**
 * Get call job statistics for current user
 * Only analyzes the most recent jobs to avoid OOM on users with many jobs
 */
export const getCallJobStats = query({
  args: {
    limit: v.optional(v.number()), // Limit to most recent N jobs (default: 500)
  },
  returns: v.object({
    total: v.number(),
    queued: v.number(),
    scheduled: v.number(),
    started: v.number(),
    completed: v.number(),
    failed: v.number(),
    canceled: v.number(),
    lastError: v.optional(v.string()),
    lastErrorAt: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    // Process only the most recent jobs to avoid OOM
    // Use index on userId and updatedAt to get most recently updated jobs first
    const recentJobs = await ctx.db
      .query("callJobs")
      .withIndex("by_userId_and_updatedAt", (q) => q.eq("userId", user._id))
      .order("desc") // Order by updatedAt descending to get most recent
      .take(args.limit || DEFAULT_CALL_JOBS_STATS_LIMIT);
    
    const stats = {
      total: recentJobs.length,
      queued: 0,
      scheduled: 0,
      started: 0,
      completed: 0,
      failed: 0,
      canceled: 0,
    };
    
    for (const job of recentJobs) {
      stats[job.status]++;
    }
    
    const lastFailedJob = recentJobs
      .filter(j => j.status === "failed" && j.errorMessage)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    
    return {
      ...stats,
      lastError: lastFailedJob?.errorMessage,
      lastErrorAt: lastFailedJob?.updatedAt,
    };
  },
});

/**
 * Create a new call job (internal - used by executor)
 * Ensures only one queued job exists per callSettingsId by updating if one exists
 */
export const createCallJob = internalMutation({
  args: {
    userId: v.id("users"),
    callSettingsId: v.id("callSettings"),
    scheduledForUTC: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if a queued job already exists for this callSettingsId
    // Use index for efficient lookup
    const existingJob = await ctx.db
      .query("callJobs")
      .withIndex("by_callSettingsId", (q) => 
        q.eq("callSettingsId", args.callSettingsId)
      )
      .filter((q) => q.eq(q.field("status"), "queued"))
      .first();
    
    if (existingJob) {
      // Update existing queued job instead of creating a new one
      const now = Date.now();
      await ctx.db.patch(existingJob._id, {
        scheduledForUTC: args.scheduledForUTC,
        updatedAt: now,
        // Reset attempts since this is a new scheduled time
        attempts: 0,
      });
      console.log(`Updated existing queued job for settings ${args.callSettingsId} at ${args.scheduledForUTC}`);
      return existingJob._id;
    }
    
    // Create new job if none exists
    const now = Date.now();
    
    const jobId = await ctx.db.insert("callJobs", {
      userId: args.userId,
      callSettingsId: args.callSettingsId,
      scheduledForUTC: args.scheduledForUTC,
      status: "queued",
      attempts: 0,
      updatedAt: now,
    });
    
    return jobId;
  },
});

/**
 * Update call job status (internal - used by VAPI integration and webhooks)
 */
export const updateCallJobStatus = internalMutation({
  args: {
    jobId: v.id("callJobs"),
    status: v.union(
      v.literal("queued"),
      v.literal("scheduled"),
      v.literal("started"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("canceled")
    ),
    vapiCallId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Call job not found");
    }
    
    const now = Date.now();
    
    const updateData: Partial<Doc<"callJobs">> = {
      status: args.status,
      updatedAt: now,
    };
    
    if (args.vapiCallId !== undefined) {
      updateData.vapiCallId = args.vapiCallId;
    }
    
    if (args.errorMessage !== undefined) {
      updateData.errorMessage = args.errorMessage;
    }
    
    await ctx.db.patch(args.jobId, updateData);
    
    return { success: true };
  },
});

/**
 * Increment call job attempts (internal)
 */
export const incrementCallJobAttempts = internalMutation({
  args: {
    jobId: v.id("callJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Call job not found");
    }
    
    await ctx.db.patch(args.jobId, {
      attempts: job.attempts + 1,
      updatedAt: Date.now(),
    });
    
    return { attempts: job.attempts + 1 };
  },
});

/**
 * Get call job by VAPI call ID (internal - used by webhooks)
 */
export const getCallJobByVapiId = internalQuery({
  args: {
    vapiCallId: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("callJobs")
      .withIndex("by_vapiCallId", (q) => q.eq("vapiCallId", args.vapiCallId))
      .first();
    
    return job;
  },
});

/**
 * Get call job by ID (internal - used by VAPI integration)
 */
export const getCallJobById = internalQuery({
  args: {
    jobId: v.id("callJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    return job;
  },
});

/**
 * Get call sessions for current user
 */
export const getCallSessions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    const sessions = await ctx.db
      .query("callSessions")
      .withIndex("by_userId_and_startedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(args.limit || DEFAULT_CALL_SESSIONS_LIMIT);
    
    return sessions;
  },
});

/**
 * Get dashboard statistics for current user
 */
export const getDashboardStats = query({
  args: {},
  returns: v.object({
    totalCalls: v.number(),
    activeDaysThisMonth: v.number(),
  }),
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);

    // Get recent call sessions (limit to avoid OOM)
    const recentSessions = await ctx.db
      .query("callSessions")
      .withIndex("by_userId_and_startedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(DEFAULT_DASHBOARD_STATS_LIMIT);

    const totalCalls = recentSessions.length;

    // Calculate active days this month from diary entries
    const now = Date.now();
    const startOfMonth = new Date(now);
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startOfMonthTimestamp = startOfMonth.getTime();

    // Get diary entries from this month (filter at query time)
    const diariesThisMonth = await ctx.db
      .query("diaries")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .filter((q) => q.gte(q.field("date"), startOfMonthTimestamp))
      .take(DEFAULT_DASHBOARD_STATS_LIMIT);
    
    const uniqueDays = new Set<string>();
    for (const diary of diariesThisMonth) {
      const date = new Date(diary.date);
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      uniqueDays.add(dayKey);
    }
    
    return {
      totalCalls,
      activeDaysThisMonth: uniqueDays.size,
    };
  },
});

/**
 * Get call session by VAPI call ID (internal - used by webhooks)
 */
export const getCallSessionByVapiId = internalQuery({
  args: {
    vapiCallId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("callSessions")
      .withIndex("by_vapiCallId", (q) => q.eq("vapiCallId", args.vapiCallId))
      .first();
    
    return session;
  },
});

/**
 * Update call session metadata (internal - used by workflows)
 * Merges new metadata with existing metadata
 */
export const updateCallSessionMetadata = internalMutation({
  args: {
    callSessionId: v.id("callSessions"),
    metadata: v.any(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.callSessionId);
    if (!session) {
      console.warn(`Call session ${args.callSessionId} not found, cannot update metadata`);
      return;
    }
    
    const existingMetadata = session.metadata || {};
    const mergedMetadata = { ...existingMetadata, ...args.metadata };
    
    await ctx.db.patch(args.callSessionId, {
      metadata: mergedMetadata,
    });
  },
});

/**
 * Update a call session (internal - used by webhooks)
 * Creates the session if it doesn't exist (handles out-of-order webhooks)
 */
export const updateCallSession = internalMutation({
  args: {
    vapiCallId: v.string(),
    jobId: v.optional(v.id("callJobs")),
    userId: v.optional(v.id("users")),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    durationSec: v.optional(v.number()),
    disposition: v.optional(v.string()),
    metadata: v.optional(v.any()),
    endOfCallReport: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    let session = await ctx.db
      .query("callSessions")
      .withIndex("by_vapiCallId", (q) => q.eq("vapiCallId", args.vapiCallId))
      .first();
    
    // If session doesn't exist, create it (handles out-of-order webhooks)
    if (!session) {
      // Need job info to create session
      if (!args.jobId || !args.userId) {
        console.warn(`No call session found for VAPI call ID ${args.vapiCallId}, and missing job info to create it. Skipping update.`);
        return { success: false, reason: "Session not found and missing job info" };
      }
      
      const sessionId = await ctx.db.insert("callSessions", {
        userId: args.userId,
        callJobId: args.jobId,
        vapiCallId: args.vapiCallId,
        startedAt: args.startedAt || Date.now(),
        endedAt: args.endedAt,
        durationSec: args.durationSec,
        disposition: args.disposition,
        metadata: args.metadata,
        endOfCallReport: args.endOfCallReport,
      });
      
      console.log(`Created call session ${sessionId} for VAPI call ID ${args.vapiCallId}`);
      return { success: true, created: true };
    }
    
    const updateData: Partial<Doc<"callSessions">> = {};
    
    if (args.endedAt !== undefined) {
      updateData.endedAt = args.endedAt;
    }
    
    if (args.durationSec !== undefined) {
      updateData.durationSec = args.durationSec;
    }
    
    if (args.disposition !== undefined) {
      updateData.disposition = args.disposition;
    }
    
    if (args.metadata !== undefined) {
      updateData.metadata = args.metadata;
    }
    
    if (args.endOfCallReport !== undefined) {
      updateData.endOfCallReport = args.endOfCallReport;
    }
    
    await ctx.db.patch(session._id, updateData);
    
    return { success: true, created: false };
  },
});
