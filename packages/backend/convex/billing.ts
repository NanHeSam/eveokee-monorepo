import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import ensureCurrentUser from "./users";
import { PLAN_CONFIG } from "./constant";

export const subscriptionStatusValidator = v.union(
  v.literal("active"),
  v.literal("canceled"),
  v.literal("expired"),
  v.literal("in_grace"),
);
export type SubscriptionStatus = "active" | "canceled" | "expired" | "in_grace";



export type SubscriptionTier = keyof typeof PLAN_CONFIG;

// Helper function to get period duration in milliseconds
export function getPeriodDurationMs(tier: SubscriptionTier): number {
  const periodDays = PLAN_CONFIG[tier].periodDays;
  if (periodDays === null) {
    return 100 * 365 * 24 * 60 * 60 * 1000;
  }
  return periodDays * 24 * 60 * 60 * 1000;
}

// Helper function to get effective music limit (with custom overrides)
export function getEffectiveMusicLimit(
  tier: SubscriptionTier,
  customLimit?: number
): number {
  // Priority: customLimit > plan default
  if (customLimit !== undefined && customLimit !== null) {
    return customLimit;
  }
  
  return PLAN_CONFIG[tier].musicLimit;
}

// Mutation to create an alpha subscription for alpha users
export const createAlphaSubscription = internalMutation({
  args: { userId: v.id("users") },
  returns: v.id("subscriptionStatuses"),
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if user already has a subscription
    const user = await ctx.db.get(args.userId);
    if (user?.activeSubscriptionId) {
      return user.activeSubscriptionId;
    }

    // Create alpha subscription
    const subscriptionId = await ctx.db.insert("subscriptionStatuses", {
      userId: args.userId,
      platform: "clerk",
      productId: "alpha-access",
      status: "active",
      subscriptionTier: "alpha",
      lastResetAt: now,
      musicGenerationsUsed: 0,
      lastVerifiedAt: now,
      // No custom limit or bonus credits by default - uses plan default (3)
    });

    // Update user with active subscription
    await ctx.db.patch(args.userId, {
      activeSubscriptionId: subscriptionId,
      updatedAt: now,
    });

    return subscriptionId;
  },
});

export const getPlans = query({
  args: {},
  returns: v.array(
    v.object({
      tier: v.string(),
      musicLimit: v.number(),
      periodDays: v.union(v.number(), v.null()),
      price: v.number(),
      hasUnlimited: v.boolean(),
    }),
  ),
  handler: async () => {
    const entries = Object.keys(PLAN_CONFIG).map(key => [key, PLAN_CONFIG[key as SubscriptionTier]]) as Array<[
      SubscriptionTier,
      (typeof PLAN_CONFIG)[SubscriptionTier],
    ]>;
    return entries.map(([tier, config]) => ({
      tier,
      musicLimit: isFinite(config.musicLimit)
        ? config.musicLimit
        : 9007199254740991,
      periodDays: config.periodDays,
      price: config.price,
      hasUnlimited: config.hasUnlimited ?? false,
    }));
  },
});

const usageStateValidator = v.object({
  tier: v.string(),
  status: subscriptionStatusValidator,
  musicGenerationsUsed: v.number(),
  musicLimit: v.number(),
  hasUnlimited: v.boolean(),
  periodStart: v.number(),
  periodEnd: v.number(),
  isActive: v.boolean(),
  remainingQuota: v.number(),
});

export const getCurrentUserStatus = query({
  args: {},
  returns: v.union(usageStateValidator, v.null()),
  handler: async (ctx) => {
    const { userId } = await ensureCurrentUser(ctx);

    const snapshot = await ctx.runQuery(internal.usage.getUsageSnapshot, {
      userId,
    });

    if (!snapshot) {
      return null;
    }

    const isActive = snapshot.status === "active" || snapshot.status === "in_grace";

    return {
      tier: snapshot.tier,
      status: snapshot.status,
      musicGenerationsUsed: snapshot.musicGenerationsUsed,
      musicLimit: snapshot.musicLimit,
      hasUnlimited: snapshot.hasUnlimited,
      periodStart: snapshot.periodStart,
      periodEnd: snapshot.periodEnd,
      isActive,
      remainingQuota: snapshot.remainingQuota,
    };
  },
});

export const resetCounters = mutation({
  args: {},
  returns: v.union(usageStateValidator, v.null()),
  handler: async (ctx) => {
    const { userId } = await ensureCurrentUser(ctx);
    const user = await ctx.db.get(userId);

    if (!user?.activeSubscriptionId) {
      return null;
    }

    const now = Date.now();

    await ctx.db.patch(user.activeSubscriptionId, {
      musicGenerationsUsed: 0,
      lastResetAt: now,
      lastVerifiedAt: now,
    });

    const snapshot = await ctx.runQuery(internal.usage.getUsageSnapshot, {
      userId,
    });

    if (!snapshot) {
      return null;
    }

    const isActive = snapshot.status === "active" || snapshot.status === "in_grace";

    return {
      tier: snapshot.tier,
      status: snapshot.status,
      musicGenerationsUsed: snapshot.musicGenerationsUsed,
      musicLimit: snapshot.musicLimit,
      hasUnlimited: snapshot.hasUnlimited,
      periodStart: snapshot.periodStart,
      periodEnd: snapshot.periodEnd,
      isActive,
      remainingQuota: snapshot.remainingQuota,
    };
  },
});
