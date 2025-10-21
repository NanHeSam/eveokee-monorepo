import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  getPeriodDurationMs,
  getEffectiveMusicLimit,
  type SubscriptionTier,
  subscriptionStatusValidator,
} from "./billing";
import ensureCurrentUser, { getOptionalCurrentUser } from "./users";
import { internal } from "./_generated/api";

// Helper function to check and reset subscription if period expired
async function checkAndResetSubscription(ctx: any, subscriptionId: string, tier: SubscriptionTier) {
  const now = Date.now();
  const periodDuration = getPeriodDurationMs(tier);
  const subscription = await ctx.db.get(subscriptionId);
  
  if (!subscription) {
    throw new Error("Subscription not found");
  }

  const periodEnd = subscription.lastResetAt + periodDuration;

  // Check if period has expired and reset if needed
  if (now > periodEnd) {
    await ctx.db.patch(subscriptionId, {
      lastResetAt: now,
      musicGenerationsUsed: 0,
      lastVerifiedAt: now,
    });
  }

  return await ctx.db.get(subscriptionId);
}

// Helper function to get user's current usage info
async function getUserUsageInfo(ctx: any, userId: string) {
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("User not found");
  }

  if (!user.activeSubscriptionId) {
    throw new Error("User has no active subscription");
  }

  const subscription = await ctx.db.get(user.activeSubscriptionId);
  if (!subscription) {
    throw new Error("Subscription not found");
  }

  const tier = subscription.subscriptionTier as SubscriptionTier;
  const updatedSubscription = await checkAndResetSubscription(ctx, user.activeSubscriptionId, tier);
  
  if (!updatedSubscription) {
    throw new Error("Subscription not found after reset");
  }

  const currentUsage = updatedSubscription.musicGenerationsUsed;
  const effectiveLimit = getEffectiveMusicLimit(
    tier,
    updatedSubscription.customMusicLimit
  );
  const periodDuration = getPeriodDurationMs(tier);
  const periodStart = updatedSubscription.lastResetAt;
  const periodEnd = periodStart + periodDuration;
  const remainingQuota = Math.max(0, effectiveLimit - currentUsage);

  return {
    subscriptionId: user.activeSubscriptionId,
    tier,
    status: updatedSubscription.status,
    currentUsage,
    effectiveLimit,
    periodStart,
    periodEnd,
    remainingQuota,
  };
}

// Internal mutation to record a music generation and enforce usage limits
export const recordMusicGeneration = internalMutation({
  args: { userId: v.id("users") },
  returns: v.object({
    success: v.boolean(),
    code: v.optional(v.union(
      v.literal("USAGE_LIMIT_REACHED"),
      v.literal("UNKNOWN_ERROR")
    )),
    reason: v.optional(v.string()),
    currentUsage: v.number(),
    limit: v.number(),
    remainingQuota: v.number(),
    tier: v.string(),
    status: subscriptionStatusValidator,
    periodStart: v.number(),
    periodEnd: v.number(),
  }),
  handler: async (ctx, args) => {
    const { subscriptionId, tier, currentUsage, effectiveLimit, status, periodStart, periodEnd } =
      await getUserUsageInfo(ctx, args.userId);

    // Check if user has reached their limit
    if (currentUsage >= effectiveLimit) {
      return {
        success: false,
        code: "USAGE_LIMIT_REACHED" as const,
        reason: "Usage limit reached",
        currentUsage,
        limit: effectiveLimit,
        remainingQuota: 0,
        tier,
        status,
        periodStart,
        periodEnd,
      };
    }

    // Increment usage counter
    await ctx.db.patch(subscriptionId, {
      musicGenerationsUsed: currentUsage + 1,
      lastVerifiedAt: Date.now(),
    });

    const remainingQuota = Math.max(0, effectiveLimit - (currentUsage + 1));

    return {
      success: true,
      code: undefined,
      currentUsage: currentUsage + 1,
      limit: effectiveLimit,
      remainingQuota,
      tier,
      status,
      periodStart,
      periodEnd,
    };
  },
});

// Internal mutation to decrement music generation counter (for failed generations)
export const decrementMusicGeneration = internalMutation({
  args: { userId: v.id("users") },
  returns: v.object({
    success: v.boolean(),
    currentUsage: v.number(),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user?.activeSubscriptionId) {
      return { success: false, currentUsage: 0 };
    }

    const subscription = await ctx.db.get(user.activeSubscriptionId);
    if (!subscription) {
      return { success: false, currentUsage: 0 };
    }

    const currentUsage = Math.max(0, subscription.musicGenerationsUsed - 1);

    await ctx.db.patch(user.activeSubscriptionId, {
      musicGenerationsUsed: currentUsage,
      lastVerifiedAt: Date.now(),
    });

    return {
      success: true,
      currentUsage,
    };
  },
});

export const getUsageSnapshot = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      tier: v.string(),
      status: subscriptionStatusValidator,
      musicGenerationsUsed: v.number(),
      musicLimit: v.number(),
      periodStart: v.number(),
      periodEnd: v.number(),
      remainingQuota: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    try {
      const usageInfo = await getUserUsageInfo(ctx, args.userId);

      if (!usageInfo) {
        return null;
      }

      return {
        tier: usageInfo.tier,
        status: usageInfo.status,
        musicGenerationsUsed: usageInfo.currentUsage,
        musicLimit: usageInfo.effectiveLimit,
        periodStart: usageInfo.periodStart,
        periodEnd: usageInfo.periodEnd,
        remainingQuota: usageInfo.remainingQuota,
      };
    } catch (error) {
      console.error("Failed to compute usage snapshot", error);
      return null;
    }
  },
});

export const getCurrentUserUsage = query({
  args: {},
  returns: v.union(
    v.object({
      tier: v.string(),
      musicGenerationsUsed: v.number(),
      musicLimit: v.number(),
      remainingQuota: v.number(),
      periodStart: v.number(),
      periodEnd: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const authResult = await getOptionalCurrentUser(ctx);
    if (!authResult) {
      return null;
    }
    const { userId } = authResult;
    const snapshot = await ctx.runQuery(internal.usage.getUsageSnapshot, {
      userId,
    });

    if (!snapshot) {
      return null;
    }

    return {
      tier: snapshot.tier,
      musicGenerationsUsed: snapshot.musicGenerationsUsed,
      musicLimit: snapshot.musicLimit,
      remainingQuota: snapshot.remainingQuota,
      periodStart: snapshot.periodStart,
      periodEnd: snapshot.periodEnd,
    };
  },
});

export const recordCurrentUserMusicGeneration = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    code: v.optional(v.union(
      v.literal("USAGE_LIMIT_REACHED"),
      v.literal("UNKNOWN_ERROR")
    )),
    reason: v.optional(v.string()),
    currentUsage: v.number(),
    limit: v.number(),
    remainingQuota: v.number(),
    tier: v.string(),
  }),
  handler: async (ctx) => {
    const { userId } = await ensureCurrentUser(ctx);

    const result = await ctx.runMutation(internal.usage.recordMusicGeneration, {
      userId,
    });

    return {
      success: result.success,
      code: result.code,
      reason: result.reason,
      currentUsage: result.currentUsage,
      limit: result.limit,
      remainingQuota: result.remainingQuota,
      tier: result.tier,
    };
  },
});

export const canCurrentUserGenerateMusic = query({
  args: {},
  returns: v.object({
    canGenerate: v.boolean(),
    tier: v.string(),
    currentUsage: v.number(),
    limit: v.number(),
    remainingQuota: v.number(),
  }),
  handler: async (ctx) => {
    const authResult = await getOptionalCurrentUser(ctx);
    if (!authResult) {
      return {
        canGenerate: false,
        tier: "free",
        currentUsage: 0,
        limit: 0,
        remainingQuota: 0,
      };
    }
    const { userId } = authResult;
    const snapshot = await ctx.runQuery(internal.usage.getUsageSnapshot, {
      userId,
    });

    if (!snapshot) {
      return {
        canGenerate: false,
        tier: "free",
        currentUsage: 0,
        limit: 0,
        remainingQuota: 0,
      };
    }

    const canGenerate = snapshot.remainingQuota > 0;

    return {
      canGenerate,
      tier: snapshot.tier,
      currentUsage: snapshot.musicGenerationsUsed,
      limit: snapshot.musicLimit,
      remainingQuota: snapshot.remainingQuota,
    };
  },
});
