import { v } from "convex/values";
import {
  query,
  internalMutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getOptionalCurrentUser } from "./users";
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

// Mutation to create a free subscription for new users
export const createFreeSubscription = internalMutation({
  args: { userId: v.id("users") },
  returns: v.id("subscriptionStatuses"),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if user already has a subscription
    const user = await ctx.db.get(args.userId);
    if (user?.activeSubscriptionId) {
      return user.activeSubscriptionId;
    }

    // Create free subscription
    const subscriptionId = await ctx.db.insert("subscriptionStatuses", {
      userId: args.userId,
      platform: "clerk",
      productId: "free-tier",
      status: "active",
      subscriptionTier: "free",
      lastResetAt: now,
      musicGenerationsUsed: 0,
      lastVerifiedAt: now,
      // Uses plan default (10 per month)
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
    }),
  ),
  handler: async () => {
    const entries = Object.keys(PLAN_CONFIG).map(key => [key, PLAN_CONFIG[key as SubscriptionTier]]) as Array<[
      SubscriptionTier,
      (typeof PLAN_CONFIG)[SubscriptionTier],
    ]>;
    return entries.map(([tier, config]) => ({
      tier,
      musicLimit: config.musicLimit,
      periodDays: config.periodDays,
      price: config.price,
    }));
  },
});

const usageStateValidator = v.object({
  tier: v.string(),
  status: subscriptionStatusValidator,
  musicGenerationsUsed: v.number(),
  musicLimit: v.number(),
  periodStart: v.number(),
  periodEnd: v.number(),
  isActive: v.boolean(),
  remainingQuota: v.number(),
});

export const getCurrentUserStatus = query({
  args: {},
  returns: v.union(usageStateValidator, v.null()),
  handler: async (ctx) => {
    const authResult = await getOptionalCurrentUser(ctx);
    if (!authResult) {
      return null;
    }
    const { userId } = authResult;

    // Fetch the subscription directly
    const user = await ctx.db.get(userId);
    if (!user || !user.activeSubscriptionId) {
      return null;
    }

    const subscription = await ctx.db.get(user.activeSubscriptionId);
    if (!subscription) {
      return null;
    }

    const musicLimit = getEffectiveMusicLimit(
      subscription.subscriptionTier as SubscriptionTier,
      subscription.customMusicLimit ?? undefined
    );
    const isActive = subscription.status === "active" || subscription.status === "in_grace";

    return {
      tier: subscription.subscriptionTier,
      status: subscription.status,
      musicGenerationsUsed: subscription.musicGenerationsUsed,
      musicLimit,
      periodStart: subscription.lastResetAt,
      periodEnd: subscription.lastResetAt + getPeriodDurationMs(subscription.subscriptionTier as SubscriptionTier),
      isActive,
      remainingQuota: Math.max(0, musicLimit - subscription.musicGenerationsUsed),
    };
  },
});
