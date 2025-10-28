/**
 * Call Jobs management
 * Handles lifecycle of scheduled VAPI calls
 */

import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getCurrentUserOrThrow } from "./users";
import { Doc, Id } from "./_generated/dataModel";

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
    
    const jobs = await jobsQuery.take(args.limit || 50);
    
    return jobs;
  },
});

/**
 * Get call job statistics for current user
 */
export const getCallJobStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    const allJobs = await ctx.db
      .query("callJobs")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    
    const stats = {
      total: allJobs.length,
      queued: 0,
      scheduled: 0,
      started: 0,
      completed: 0,
      failed: 0,
      canceled: 0,
    };
    
    for (const job of allJobs) {
      stats[job.status]++;
    }
    
    const lastFailedJob = allJobs
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
 * Create a new call job (internal - used by daily planner)
 */
export const createCallJob = internalMutation({
  args: {
    userId: v.id("users"),
    callSettingsId: v.id("callSettings"),
    scheduledForUTC: v.number(),
  },
  handler: async (ctx, args) => {
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
export const getCallJobByVapiId = internalMutation({
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
 * Check if a call job exists for a user on a specific day (internal)
 */
export const hasCallJobForDay = internalMutation({
  args: {
    userId: v.id("users"),
    startOfDayUTC: v.number(),
    endOfDayUTC: v.number(),
  },
  handler: async (ctx, args) => {
    const existingJob = await ctx.db
      .query("callJobs")
      .withIndex("by_userId_and_scheduledForUTC", (q) => 
        q.eq("userId", args.userId)
          .gte("scheduledForUTC", args.startOfDayUTC)
          .lte("scheduledForUTC", args.endOfDayUTC)
      )
      .first();
    
    return existingJob !== null;
  },
});

/**
 * Cancel a call job (user-facing)
 */
export const cancelCallJob = mutation({
  args: {
    jobId: v.id("callJobs"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Call job not found");
    }
    
    if (job.userId !== user._id) {
      throw new Error("Unauthorized: This call job does not belong to you");
    }
    
    if (job.status === "completed" || job.status === "failed" || job.status === "canceled") {
      throw new Error(`Cannot cancel job with status: ${job.status}`);
    }
    
    await ctx.db.patch(args.jobId, {
      status: "canceled",
      updatedAt: Date.now(),
    });
    
    
    return { success: true };
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
      .take(args.limit || 50);
    
    return sessions;
  },
});

/**
 * Create a call session (internal - used by webhooks)
 */
export const createCallSession = internalMutation({
  args: {
    userId: v.id("users"),
    callJobId: v.id("callJobs"),
    vapiCallId: v.string(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    durationSec: v.optional(v.number()),
    disposition: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    
    const sessionId = await ctx.db.insert("callSessions", {
      userId: args.userId,
      callJobId: args.callJobId,
      vapiCallId: args.vapiCallId,
      startedAt: args.startedAt,
      endedAt: args.endedAt,
      durationSec: args.durationSec,
      disposition: args.disposition,
      metadata: args.metadata,
    });
    
    return sessionId;
  },
});

/**
 * Update a call session (internal - used by webhooks)
 */
export const updateCallSession = internalMutation({
  args: {
    vapiCallId: v.string(),
    endedAt: v.optional(v.number()),
    durationSec: v.optional(v.number()),
    disposition: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("callSessions")
      .withIndex("by_vapiCallId", (q) => q.eq("vapiCallId", args.vapiCallId))
      .first();
    
    if (!session) {
      throw new Error("Call session not found");
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
    
    await ctx.db.patch(session._id, updateData);
    
    return { success: true };
  },
});
