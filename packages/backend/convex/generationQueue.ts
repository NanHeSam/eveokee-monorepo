/**
 * Generation Queue Management
 * Handles queuing and processing of Suno music and Kie video generation requests
 * with concurrency limits and rate limiting
 */

import { internalMutation, internalQuery, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const SUNO_CONCURRENCY_LIMIT = 20;
const SUNO_RATE_LIMIT_WINDOW_MS = 10000; // 10 seconds
const SUNO_RATE_LIMIT_MAX_REQUESTS = 20;
const KIE_CONCURRENCY_LIMIT = 10; // Conservative limit for Kie.ai

/**
 * Enqueue a new generation request
 */
export const enqueueRequest = internalMutation({
  args: {
    type: v.union(v.literal("suno"), v.literal("kie")),
    userId: v.id("users"),
    payload: v.any(),
  },
  returns: v.object({
    queueId: v.id("generationQueue"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const queueId = await ctx.db.insert("generationQueue", {
      type: args.type,
      userId: args.userId,
      status: "pending",
      payload: args.payload,
      createdAt: now,
      updatedAt: now,
    });

    return { queueId };
  },
});

/**
 * Get count of in-flight requests for a specific queue type
 */
export const getInFlightCount = internalQuery({
  args: {
    type: v.union(v.literal("suno"), v.literal("kie")),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const count = await ctx.db
      .query("generationQueue")
      .withIndex("by_type_and_status", (q) => 
        q.eq("type", args.type).eq("status", "inFlight")
      )
      .collect();
    
    return count.length;
  },
});

/**
 * Get recent requests within rate limit window for Suno
 */
export const getRecentSunoRequests = internalQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const windowStart = now - SUNO_RATE_LIMIT_WINDOW_MS;
    
    const recentRequests = await ctx.db
      .query("generationQueue")
      .withIndex("by_type_and_status", (q) => 
        q.eq("type", "suno").eq("status", "inFlight")
      )
      .filter((q) => 
        q.gte(q.field("startedAt"), windowStart)
      )
      .collect();
    
    return recentRequests.length;
  },
});

/**
 * Get next pending request for a specific queue type
 */
export const getNextPendingRequest = internalQuery({
  args: {
    type: v.union(v.literal("suno"), v.literal("kie")),
  },
  returns: v.union(
    v.object({
      _id: v.id("generationQueue"),
      type: v.union(v.literal("suno"), v.literal("kie")),
      userId: v.id("users"),
      payload: v.any(),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const request = await ctx.db
      .query("generationQueue")
      .withIndex("by_type_and_status", (q) => 
        q.eq("type", args.type).eq("status", "pending")
      )
      .order("asc")
      .first();
    
    if (!request) {
      return null;
    }

    return {
      _id: request._id,
      type: request.type,
      userId: request.userId,
      payload: request.payload,
      createdAt: request.createdAt,
    };
  },
});

/**
 * Mark a request as in-flight
 */
export const markRequestInFlight = internalMutation({
  args: {
    queueId: v.id("generationQueue"),
    taskId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    
    await ctx.db.patch(args.queueId, {
      status: "inFlight",
      taskId: args.taskId,
      startedAt: now,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Mark a request as completed
 */
export const markRequestCompleted = internalMutation({
  args: {
    taskId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db
      .query("generationQueue")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .first();
    
    if (!request) {
      console.warn(`No queue request found for taskId ${args.taskId}`);
      return null;
    }

    const now = Date.now();
    await ctx.db.patch(request._id, {
      status: "completed",
      completedAt: now,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Mark a request as failed
 */
export const markRequestFailed = internalMutation({
  args: {
    queueId: v.id("generationQueue"),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    
    await ctx.db.patch(args.queueId, {
      status: "failed",
      errorMessage: args.errorMessage,
      completedAt: now,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Process the queue for a specific type
 * Checks concurrency limits and rate limits, then dispatches pending requests
 */
export const processQueue = internalAction({
  args: {
    type: v.union(v.literal("suno"), v.literal("kie")),
  },
  returns: v.object({
    processed: v.number(),
    skipped: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const inFlightCount = await ctx.runQuery(internal.generationQueue.getInFlightCount, {
      type: args.type,
    });

    const concurrencyLimit = args.type === "suno" ? SUNO_CONCURRENCY_LIMIT : KIE_CONCURRENCY_LIMIT;

    if (inFlightCount >= concurrencyLimit) {
      return {
        processed: 0,
        skipped: true,
        reason: `At concurrency limit (${inFlightCount}/${concurrencyLimit})`,
      };
    }

    if (args.type === "suno") {
      const recentRequests = await ctx.runQuery(internal.generationQueue.getRecentSunoRequests, {});
      if (recentRequests >= SUNO_RATE_LIMIT_MAX_REQUESTS) {
        return {
          processed: 0,
          skipped: true,
          reason: `Rate limit reached (${recentRequests}/${SUNO_RATE_LIMIT_MAX_REQUESTS} in last 10s)`,
        };
      }
    }

    const availableSlots = concurrencyLimit - inFlightCount;
    let processed = 0;

    for (let i = 0; i < availableSlots; i++) {
      if (args.type === "suno") {
        const recentRequests = await ctx.runQuery(internal.generationQueue.getRecentSunoRequests, {});
        if (recentRequests >= SUNO_RATE_LIMIT_MAX_REQUESTS) {
          break;
        }
      }

      const nextRequest = await ctx.runQuery(internal.generationQueue.getNextPendingRequest, {
        type: args.type,
      });

      if (!nextRequest) {
        break; // No more pending requests
      }

      try {
        if (args.type === "suno") {
          await ctx.runAction(internal.generationQueue.dispatchSunoRequest, {
            queueId: nextRequest._id,
            payload: nextRequest.payload,
          });
        } else {
          await ctx.runAction(internal.generationQueue.dispatchKieRequest, {
            queueId: nextRequest._id,
            payload: nextRequest.payload,
          });
        }
        processed++;
      } catch (error) {
        console.error(`Failed to dispatch ${args.type} request:`, error);
        await ctx.runMutation(internal.generationQueue.markRequestFailed, {
          queueId: nextRequest._id,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      processed,
      skipped: false,
    };
  },
});

/**
 * Dispatch a Suno music generation request
 */
export const dispatchSunoRequest = internalAction({
  args: {
    queueId: v.id("generationQueue"),
    payload: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.generationQueue.markRequestInFlight, {
      queueId: args.queueId,
    });

    try {
      await ctx.runAction(internal.musicActions.requestSunoGeneration, args.payload);
    } catch (error) {
      await ctx.runMutation(internal.generationQueue.markRequestFailed, {
        queueId: args.queueId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    return null;
  },
});

/**
 * Dispatch a Kie video generation request
 */
export const dispatchKieRequest = internalAction({
  args: {
    queueId: v.id("generationQueue"),
    payload: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.generationQueue.markRequestInFlight, {
      queueId: args.queueId,
    });

    try {
      await ctx.runAction(internal.videoActions.requestKieVideoGeneration, args.payload);
    } catch (error) {
      await ctx.runMutation(internal.generationQueue.markRequestFailed, {
        queueId: args.queueId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    return null;
  },
});
