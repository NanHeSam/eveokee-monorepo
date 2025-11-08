import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  internalAction,
  mutation,
  query,
  action,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  getEffectiveMusicLimit,
  getResetPeriodDurationMs,
  getAnnualMonthlyCredit,
  type SubscriptionTier,
  subscriptionStatusValidator,
} from "./billing";
import ensureCurrentUser, { getOptionalCurrentUser } from "./users";
import { isMutationCtx } from "./utils/contextHelpers";

/**
 * Subscription Usage Reset and Query Functions
 * 
 * These functions handle subscription usage tracking with automatic period-based resets.
 * 
 * CRITICAL RESET PERIOD MAPPING (not intuitive):
 * - Weekly subscriptions → reset weekly
 * - Monthly subscriptions → reset monthly
 * - Yearly subscriptions → reset MONTHLY (not yearly!)
 * 
 * This means annual subscriptions receive their total quota divided into 12 monthly
 * allocations, resetting each month rather than once per year.
 * 
 * Key Implementation Details:
 * 
 * 1. Period Boundary Alignment:
 *    - Resets occur at period boundaries, NOT at the current time ("now")
 *    - This prevents timeline drift: if a user checks usage 2.5 periods after last reset,
 *      we reset to the boundary at 2 periods, not to "now"
 *    - Example: If lastResetAt was 10 days ago and period is 7 days, we reset to 14 days
 *      ago (2 periods), not to "now"
 * 
 * 2. Annual Subscription Behavior:
 *    - Annual subscriptions use monthly reset periods (via getResetPeriodDurationMs)
 *    - Monthly credit = total annual quota / 12, rounded UP
 *    - customMusicLimit is set on reset to track the monthly allocation
 * 
 * 3. Reset Calculation Steps:
 *    a. Calculate periodEnd = lastResetAt + resetPeriodDuration
 *    b. If now > periodEnd, calculate how many full periods have passed
 *    c. Reset lastResetAt to the most recent period boundary (not "now")
 *    d. Reset musicGenerationsUsed to 0
 *    e. For annual subscriptions, set customMusicLimit to monthly credit
 * 
 * 4. Usage Info Calculation:
 *    - Returns current usage, effective limit, period boundaries, and remaining quota
 *    - Effective limit accounts for customMusicLimit override (used for annual monthly credits)
 *    - Period boundaries use reset period duration (monthly for annual, otherwise tier's period)
 * 
 * @see getResetPeriodDurationMs in billing.ts for reset period logic
 * @see getAnnualMonthlyCredit in billing.ts for annual monthly credit calculation
 */
// Helper function to check and reset subscription if period expired
// If ctx is a query context (no patch method), computes reset values without modifying DB
async function checkAndResetSubscription(ctx: MutationCtx | QueryCtx, subscriptionId: Id<"subscriptionStatuses">, tier: SubscriptionTier) {
  const now = Date.now();
  const resetPeriodDuration = getResetPeriodDurationMs(tier);
  const subscription = await ctx.db.get(subscriptionId);
  
  if (!subscription) {
    throw new Error("Subscription not found");
  }

  const periodEnd = subscription.lastResetAt + resetPeriodDuration;

  // Check if period has expired and reset if needed
  if (now > periodEnd) {
    // Calculate how many full periods have passed
    const periodsPassed = Math.floor((now - subscription.lastResetAt) / resetPeriodDuration);
    // Reset to the most recent period boundary (not 'now') to avoid shifting timeline forward
    const newLastResetAt = subscription.lastResetAt + (periodsPassed * resetPeriodDuration);

    const resetData: {
      lastResetAt: number;
      musicGenerationsUsed: number;
      lastVerifiedAt: number;
      customMusicLimit?: number;
    } = {
      lastResetAt: newLastResetAt,
      musicGenerationsUsed: 0,
      lastVerifiedAt: now,
    };

    // For annual subscriptions, set monthly credit (total / 12, rounded up)
    if (tier === "yearly") {
      resetData.customMusicLimit = getAnnualMonthlyCredit();
    }

    // Only patch if we're in a mutation context
    if (isMutationCtx(ctx)) {
      await ctx.db.patch(subscriptionId, resetData);
      return await ctx.db.get(subscriptionId);
    } else {
      // In query context, return computed values without patching
      return {
        ...subscription,
        ...resetData,
      };
    }
  }

  return subscription;
}

/**
 * Get User's Current Usage Information
 * 
 * Retrieves comprehensive usage information for a user's active subscription, including
 * automatic period reset if needed. Works in both query and mutation contexts:
 * - In mutation contexts: Actually resets the subscription if period expired
 * - In query contexts: Computes what the reset would be without modifying the database
 * 
 * Execution Flow:
 * 1. Validates user exists and has an active subscription
 * 2. Calls checkAndResetSubscription() which:
 *    - In mutation contexts: Resets subscription if period expired (modifies DB)
 *    - In query contexts: Computes reset values without modifying DB
 * 3. Calculates effective limit (accounts for customMusicLimit override for annual subscriptions)
 * 4. Computes period boundaries using reset period duration:
 *    - Weekly subscriptions: 7-day periods
 *    - Monthly subscriptions: ~30-day periods
 *    - Yearly subscriptions: ~30-day periods (monthly reset, not yearly!)
 * 5. Calculates remaining quota (effectiveLimit - currentUsage, clamped to >= 0)
 * 
 * Important Assumptions:
 * - User MUST have an activeSubscriptionId (throws error if missing)
 * - Subscription is automatically reset if period expired (in mutation contexts)
 * - Period boundaries use reset period duration, not billing period duration
 *   (e.g., yearly subscriptions show monthly period boundaries)
 * - Effective limit respects customMusicLimit override (set for annual monthly credits)
 * 
 * Return Value Structure:
 * - subscriptionId: The active subscription document ID
 * - tier: Subscription tier (free, weekly, monthly, yearly)
 * - status: Subscription status (active, canceled, expired, in_grace)
 * - currentUsage: Number of music generations used in current period
 * - effectiveLimit: Total quota available (may be customMusicLimit for annual subscriptions)
 * - periodStart: Timestamp of current period start (lastResetAt)
 * - periodEnd: Timestamp of current period end (periodStart + resetPeriodDuration)
 * - remainingQuota: Available quota remaining (max(0, effectiveLimit - currentUsage))
 * 
 * @param ctx - Convex context (query or mutation - automatically detects context type)
 * @param userId - User ID to get usage info for
 * @returns Usage information object with current usage, limits, and period boundaries
 * @throws Error if user not found, no active subscription, or subscription not found
 * 
 * @see checkAndResetSubscription for reset logic details
 * @see getEffectiveMusicLimit for limit calculation logic
 * @see getResetPeriodDurationMs for reset period duration calculation
 */
// Helper function to get user's current usage info (works in both query and mutation contexts)
async function getUserUsageInfo(ctx: MutationCtx | QueryCtx, userId: Id<"users">) {
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

  // Note: Product ID reconciliation with RevenueCat should happen before this point
  // via reconcileSubscription action. This ensures RevenueCat is the single source of truth.
  // The subscription.productId should already be reconciled at this point.

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
  // Use reset period duration (monthly for annual, otherwise tier's period)
  const resetPeriodDuration = getResetPeriodDurationMs(tier);
  const periodStart = updatedSubscription.lastResetAt;
  const periodEnd = periodStart + resetPeriodDuration;
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

// Internal action to record a music generation with RevenueCat reconciliation
// This ensures we always have the latest product ID from RevenueCat before checking usage
export const recordMusicGenerationWithReconciliation = action({
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
    // Reconcile product ID with RevenueCat first (single source of truth)
    const reconcileResult = await ctx.runAction(internal.revenueCatBilling.reconcileSubscription, {
      userId: args.userId,
    });

    if (reconcileResult.productIdUpdated) {
      console.log(`Product ID reconciled for user ${args.userId} before usage check`);
    }

    // Now proceed with recording music generation
    const result = await ctx.runMutation(internal.usage.recordMusicGeneration, {
      userId: args.userId,
    });

    return result;
  },
});

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
    const { subscriptionId, tier, status, currentUsage, effectiveLimit, periodStart, periodEnd, remainingQuota } =
      await getUserUsageInfo(ctx, args.userId);

    // Check if user has reached their limit
    if (remainingQuota == 0) {
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

    const newRemainingQuota = Math.max(0, effectiveLimit - (currentUsage + 1));

    return {
      success: true,
      code: undefined,
      currentUsage: currentUsage + 1,
      limit: effectiveLimit,
      remainingQuota: newRemainingQuota,
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

/**
 * Record video generation with RevenueCat reconciliation
 * Videos cost 3 credits (same quota system as music)
 * INTERNAL ACTION: Fetches canonical subscription data from RevenueCat API and reconciles if needed
 */
export const recordVideoGenerationWithReconciliation = internalAction({
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
    // Reconcile product ID with RevenueCat first (single source of truth)
    const reconcileResult = await ctx.runAction(internal.revenueCatBilling.reconcileSubscription, {
      userId: args.userId,
    });

    if (reconcileResult.productIdUpdated) {
      console.log(`Product ID reconciled for user ${args.userId} before video generation check`);
    }

    // Now proceed with recording video generation (costs 3 credits)
    const result = await ctx.runMutation(internal.usage.recordVideoGeneration, {
      userId: args.userId,
    });

    return result;
  },
});

/**
 * Internal mutation to record a video generation and enforce usage limits
 * Video generation costs 3 music generation credits
 */
export const recordVideoGeneration = internalMutation({
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
    const VIDEO_CREDIT_COST = 3; // Each video costs 3 credits

    const { subscriptionId, tier, status, currentUsage, effectiveLimit, periodStart, periodEnd, remainingQuota } =
      await getUserUsageInfo(ctx, args.userId);

    // Check if user has enough credits (need 3 for video generation)
    if (remainingQuota < VIDEO_CREDIT_COST) {
      return {
        success: false,
        code: "USAGE_LIMIT_REACHED" as const,
        reason: `Insufficient credits. Video generation requires ${VIDEO_CREDIT_COST} credits, but only ${remainingQuota} remaining.`,
        currentUsage,
        limit: effectiveLimit,
        remainingQuota,
        tier,
        status,
        periodStart,
        periodEnd,
      };
    }

    // Increment usage counter by 3
    await ctx.db.patch(subscriptionId, {
      musicGenerationsUsed: currentUsage + VIDEO_CREDIT_COST,
      lastVerifiedAt: Date.now(),
    });

    const newRemainingQuota = Math.max(0, effectiveLimit - (currentUsage + VIDEO_CREDIT_COST));

    return {
      success: true,
      code: undefined,
      currentUsage: currentUsage + VIDEO_CREDIT_COST,
      limit: effectiveLimit,
      remainingQuota: newRemainingQuota,
      tier,
      status,
      periodStart,
      periodEnd,
    };
  },
});

/**
 * Internal mutation to decrement video generation counter (refund 3 credits for failed generations)
 */
export const decrementVideoGeneration = internalMutation({
  args: { userId: v.id("users") },
  returns: v.object({
    success: v.boolean(),
    currentUsage: v.number(),
  }),
  handler: async (ctx, args) => {
    const VIDEO_CREDIT_COST = 3;

    const user = await ctx.db.get(args.userId);
    if (!user?.activeSubscriptionId) {
      return { success: false, currentUsage: 0 };
    }

    const subscription = await ctx.db.get(user.activeSubscriptionId);
    if (!subscription) {
      return { success: false, currentUsage: 0 };
    }

    // Decrement by 3 credits (video cost)
    const currentUsage = Math.max(0, subscription.musicGenerationsUsed - VIDEO_CREDIT_COST);

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
      // getUserUsageInfo automatically detects query context and computes without patching
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

/**
 * Check usage with reconciliation
 * ACTION: Fetches canonical subscription data from RevenueCat API and reconciles if needed
 * Server-side reconciliation ensures we use the authoritative RevenueCat data
 */
export const checkUsageWithReconciliation = action({
  args: {},
  returns: v.object({
    canGenerate: v.boolean(),
    tier: v.string(),
    currentUsage: v.number(),
    limit: v.number(),
    remainingQuota: v.number(),
    reconciled: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Get user identity from auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Get userId via internal query
    const userId = await ctx.runQuery(internal.users.getUserIdByClerkId, {
      clerkId: identity.subject,
    });

    if (!userId) {
      throw new Error("User not found");
    }

    // Always reconcile with canonical RevenueCat data server-side
    const reconcileResult = await ctx.runAction(internal.revenueCatBilling.reconcileSubscription, {
      userId,
    });

    let reconciled = false;
    if (reconcileResult.success && reconcileResult.updated) {
      reconciled = true;
      console.log(`Reconciled subscription: ${reconcileResult.backendStatus} → ${reconcileResult.rcStatus}`);
    } else if (!reconcileResult.success) {
      console.error(`Failed to reconcile subscription: userId=${userId}`);
    }

    // Get usage after potential reconciliation
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
        reconciled,
      };
    }

    const canGenerate = snapshot.remainingQuota > 0;

    return {
      canGenerate,
      tier: snapshot.tier,
      currentUsage: snapshot.musicGenerationsUsed,
      limit: snapshot.musicLimit,
      remainingQuota: snapshot.remainingQuota,
      reconciled,
    };
  },
});
