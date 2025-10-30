import { v } from "convex/values";
import { internalMutation, internalQuery, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createLogger, generateCorrelationId, logReconciliation, sanitizeForConvex } from "./lib/logger";

const REVENUECAT_PRODUCT_TO_TIER: Record<string, string> = {
  "eveokee_premium_weekly": "weekly",
  "eveokee_premium_monthly": "monthly",
  "eveokee_premium_annual": "yearly",
  "free-tier": "free",
};

const getPlatformFromStore = (store: string | undefined): "app_store" | "play_store" | "stripe" | undefined => {
  const platformMap: Record<string, "app_store" | "play_store" | "stripe"> = {
    "APP_STORE": "app_store",
    "PLAY_STORE": "play_store",
    "STRIPE": "stripe",
  };
  return store ? platformMap[store] : undefined;
};

const getStatusFromEventType = (eventType: string, isActive: boolean): "active" | "canceled" | "expired" | "in_grace" => {
  switch (eventType) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "SUBSCRIPTION_UNPAUSED":
    case "SUBSCRIPTION_RESUMED":
      return "active";
    case "CANCELLATION":
      return "canceled";
    case "EXPIRATION":
      return "expired";
    case "BILLING_ISSUE":
      return "in_grace";
    default:
      return isActive ? "active" : "expired";
  }
};

/**
 * Update subscription from RevenueCat webhook event
 * Updates snapshot and conditionally logs to audit log only if state changed
 */
export const updateSubscriptionFromWebhook = internalMutation({
  args: {
    userId: v.id("users"), // Validated by isValidConvexId() in http.ts before calling this mutation
    eventType: v.string(),
    productId: v.string(),
    store: v.optional(v.string()),
    // RevenueCat may send timestamps as string or number, normalize to number
    expirationAtMs: v.optional(v.union(v.string(), v.number())),
    purchasedAtMs: v.optional(v.union(v.string(), v.number())),
    isTrialConversion: v.optional(v.boolean()),
    entitlementIds: v.optional(v.array(v.string())),
    rawEvent: v.optional(v.any()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await ctx.db.get(args.userId);
    if (!user) return { success: false };

    const platform = getPlatformFromStore(args.store);
    const mappedTier = REVENUECAT_PRODUCT_TO_TIER[args.productId] || "free";

    // Normalize timestamps to numbers
    const expiresAt = args.expirationAtMs
      ? typeof args.expirationAtMs === 'number'
        ? args.expirationAtMs
        : parseInt(args.expirationAtMs)
      : undefined;
    const purchasedAt = args.purchasedAtMs
      ? typeof args.purchasedAtMs === 'number'
        ? args.purchasedAtMs
        : parseInt(args.purchasedAtMs)
      : undefined;

    // Determine if this is an active subscription
    const isActive = ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "SUBSCRIPTION_UNPAUSED", "SUBSCRIPTION_RESUMED"].includes(args.eventType);
    const status = getStatusFromEventType(args.eventType, isActive);

    const effectiveTier = status === "active" || status === "in_grace" ? mappedTier : "free";

    // Get current subscription state to detect changes
    const currentSubscription = user.activeSubscriptionId
      ? await ctx.db.get(user.activeSubscriptionId)
      : null;

    // Determine if we should log this event:
    // 1. Always log if state changed (status, productId, or tier)
    // 2. Always log renewal events (user was charged) even if state unchanged
    // 3. Always log initial purchases and cancellations
    const stateChanged = !currentSubscription ||
      currentSubscription.status !== status ||
      currentSubscription.productId !== args.productId ||
      currentSubscription.subscriptionTier !== effectiveTier;

    const isSignificantEvent = [
      "INITIAL_PURCHASE",
      "RENEWAL",
      "CANCELLATION",
      "UNCANCELLATION",
      "PRODUCT_CHANGE",
      "EXPIRATION",
    ].includes(args.eventType);

    const shouldLogToAudit = stateChanged || isSignificantEvent;

    // Update snapshot
    if (user.activeSubscriptionId && currentSubscription) {
      await ctx.db.patch(user.activeSubscriptionId, {
        ...(platform && { platform: platform as "app_store" | "play_store" | "stripe" }),
        productId: args.productId,
        status,
        subscriptionTier: effectiveTier,
        ...(typeof expiresAt === "number" && !isNaN(expiresAt) ? { expiresAt } : {}),
        lastVerifiedAt: now,
      });
    } else {
      const subscriptionId = await ctx.db.insert("subscriptionStatuses", {
        userId: user._id,
        ...(platform && { platform: platform as "app_store" | "play_store" | "stripe" }),
        productId: args.productId,
        status,
        subscriptionTier: effectiveTier,
        lastResetAt: now,
        musicGenerationsUsed: 0,
        lastVerifiedAt: now,
        ...(typeof expiresAt === "number" && !isNaN(expiresAt) ? { expiresAt } : {}),
      });

      await ctx.db.patch(user._id, {
        activeSubscriptionId: subscriptionId,
        updatedAt: now,
      });
    }

    // Append to audit log for significant events or state changes
    // This ensures we capture all renewals (when user is charged) even if state unchanged
    if (shouldLogToAudit) {
      await ctx.db.insert("subscriptionLog", {
        userId: user._id,
        eventType: args.eventType as any, // eventType is validated string, safe cast
        productId: args.productId,
        platform: platform as "app_store" | "play_store" | "stripe" | undefined,
        subscriptionTier: effectiveTier,
        status,
        expiresAt,
        purchasedAt,
        isTrialConversion: args.isTrialConversion,
        entitlementIds: args.entitlementIds,
        store: args.store,
        rawEvent: args.rawEvent,
        recordedAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Internal mutation: Reconcile subscription status with RevenueCat customer data
 * This mutation updates the database based on RevenueCat customer info fetched server-side
 */
export const reconcileSubscriptionWithData = internalMutation({
  args: {
    userId: v.id("users"),
    rcCustomerInfo: v.any(), // From RevenueCat API (subscriber format)
  },
  returns: v.object({ 
    success: v.boolean(),
    updated: v.boolean(),
    backendStatus: v.string(),
    rcStatus: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !user.activeSubscriptionId) {
      return { success: false, updated: false, backendStatus: "none", rcStatus: "none" };
    }

    const backendSubscription = await ctx.db.get(user.activeSubscriptionId);
    if (!backendSubscription) {
      return { success: false, updated: false, backendStatus: "missing", rcStatus: "none" };
    }

    // Check RC entitlements to determine if user has active subscription
    // RevenueCat API format: subscriber.entitlements.active
    const rcEntitlements = args.rcCustomerInfo?.subscriber?.entitlements?.active || {};
    const hasActiveSubscription = Object.keys(rcEntitlements).length > 0;
    const rcStatus = hasActiveSubscription ? "active" : "expired";

    // Only update if different
    if (backendSubscription.status !== rcStatus && backendSubscription.status !== "in_grace") {
      const now = Date.now();
      await ctx.db.patch(user.activeSubscriptionId, {
        status: rcStatus,
        lastVerifiedAt: now,
      });

      // Log reconciliation
      await ctx.db.insert("subscriptionLog", {
        userId: user._id,
        eventType: "RECONCILIATION",
        productId: backendSubscription.productId,
        platform: backendSubscription.platform, // Type-safe: platform is validated in schema
        subscriptionTier: backendSubscription.subscriptionTier,
        status: rcStatus,
        expiresAt: backendSubscription.expiresAt,
        rawEvent: sanitizeForConvex(args.rcCustomerInfo),
        recordedAt: now,
      });

      return { 
        success: true, 
        updated: true, 
        backendStatus: backendSubscription.status, 
        rcStatus 
      };
    }

    return { 
      success: true, 
      updated: false, 
      backendStatus: backendSubscription.status, 
      rcStatus 
    };
  },
});

/**
 * Reconcile subscription status with RevenueCat
 * ACTION: Fetches canonical customer data from RevenueCat API and reconciles subscription
 * Called from usage checks when reconciliation is needed
 */
export const reconcileSubscription = internalAction({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({ 
    success: v.boolean(),
    updated: v.boolean(),
    backendStatus: v.string(),
    rcStatus: v.string(),
  }),
  handler: async (ctx, args) => {
    const correlationId = generateCorrelationId();
    const logger = createLogger({
      functionName: 'reconcileSubscription',
      correlationId,
      userId: args.userId,
    });

    logger.startTimer();
    logger.info('Starting subscription reconciliation');

    try {
      // Fetch canonical customer data from RevenueCat API
      logger.debug('Fetching RevenueCat customer info');
      const rcCustomerInfo = await fetchRevenueCatCustomer(args.userId);

      if (!rcCustomerInfo) {
        logger.warn('Failed to fetch RevenueCat customer info - no data returned');
        return { 
          success: false, 
          updated: false, 
          backendStatus: "unknown", 
          rcStatus: "unknown" 
        };
      }

      logger.debug('Successfully fetched RevenueCat customer info');

      // Call mutation to update database based on canonical RC data
      const result = await ctx.runMutation(
        internal.revenueCatBilling.reconcileSubscriptionWithData,
        {
          userId: args.userId,
          rcCustomerInfo,
        }
      );

      if (result.updated) {
        logReconciliation(
          logger,
          args.userId,
          result.backendStatus,
          result.rcStatus
        );
      } else {
        logger.debug('Subscription status unchanged', {
          backendStatus: result.backendStatus,
          rcStatus: result.rcStatus,
        });
      }

      return result;
    } catch (error) {
      logger.error('Failed to reconcile subscription', error);
      
      return { 
        success: false, 
        updated: false, 
        backendStatus: "error", 
        rcStatus: "error" 
      };
    }
  },
});

/**
 * Query to get stale subscriptions for reconciliation cron
 */
export const getStaleSubscriptions = internalQuery({
  args: {},
  returns: v.array(v.object({
    userId: v.id("users"),
    subscriptionStatusId: v.id("subscriptionStatuses"),
    lastVerifiedAt: v.number(),
  })),
  handler: async (ctx) => {
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    // Get all subscription statuses with lastVerifiedAt > 24h ago
    const staleSubscriptions = await ctx.db
      .query("subscriptionStatuses")
      .withIndex("by_lastVerifiedAt", (q) => q.lt("lastVerifiedAt", twentyFourHoursAgo))
      .collect();

    return staleSubscriptions.map(sub => ({
      userId: sub.userId,
      subscriptionStatusId: sub._id,
      lastVerifiedAt: sub.lastVerifiedAt,
    }));
  },
});

/**
 * Fetch customer info from RevenueCat REST API
 */
async function fetchRevenueCatCustomer(appUserId: string): Promise<any> {
  const apiKey = process.env.REVENUECAT_API_KEY;
  if (!apiKey) {
    throw new Error("REVENUECAT_API_KEY not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const encodedUserId = encodeURIComponent(appUserId);
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodedUserId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`Failed to fetch RC customer: ${response.status} ${response.statusText}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      console.error("Request to RevenueCat API timed out");
      return null;
    }
    throw error;
  }
}

/**
 * Daily reconciliation cron: Reconcile stale subscriptions
 * ACTION: Orchestrates HTTP calls to RevenueCat and database updates via mutations
 * This follows Convex best practice: I/O operations in actions, database writes in mutations
 */
export const reconcileStaleSubscriptions = internalAction({
  args: {},
  returns: v.object({
    checked: v.number(),
    updated: v.number(),
  }),
  handler: async (ctx) => {
    const correlationId = generateCorrelationId();
    const logger = createLogger({
      functionName: 'reconcileStaleSubscriptions',
      correlationId,
    });

    logger.startTimer();
    logger.info('Starting subscription reconciliation cron');

    // Get list of stale subscriptions from database
    const staleSubscriptions = await ctx.runQuery(internal.revenueCatBilling.getStaleSubscriptions, {});

    logger.info('Retrieved stale subscriptions', {
      staleCount: staleSubscriptions.length,
    });

    let updated = 0;
    let checked = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    for (const subscription of staleSubscriptions) {
      checked++;

      const subLogger = logger.child({
        userId: subscription.userId,
        subscriptionStatusId: subscription.subscriptionStatusId,
      });

      try {
        // Call RevenueCat API with app_user_id (which equals userId)
        subLogger.debug('Fetching RevenueCat customer info');
        const rcCustomerInfo = await fetchRevenueCatCustomer(subscription.userId);

        if (!rcCustomerInfo) {
          subLogger.warn('Failed to fetch RC customer info - no data returned');
          continue;
        }

        // Call mutation to update database based on RC data
        const result = await ctx.runMutation(
          internal.revenueCatBilling.reconcileSingleSubscription,
          {
            subscriptionStatusId: subscription.subscriptionStatusId,
            userId: subscription.userId,
            rcCustomerInfo,
          }
        );

        if (result.updated) {
          updated++;
          logReconciliation(
            subLogger,
            subscription.userId,
            result.oldStatus || 'unknown',
            result.newStatus || 'unknown'
          );
        } else {
          subLogger.debug('Subscription status unchanged');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push({ userId: subscription.userId, error: errorMsg });
        subLogger.error('Failed to reconcile subscription', error);
      }
    }

    logger.info('Reconciliation completed', {
      checked,
      updated,
      unchanged: checked - updated,
      errorCount: errors.length,
      successRate: checked > 0 ? ((checked - errors.length) / checked * 100).toFixed(2) + '%' : '0%',
    });

    if (errors.length > 0) {
      logger.warn('Reconciliation errors encountered', {
        errors: errors.slice(0, 10), // Log first 10 errors
        totalErrors: errors.length,
      });
    }

    return { checked, updated };
  },
});

/**
 * MUTATION: Update a single subscription based on RevenueCat customer info
 * Separated from action to follow Convex best practice
 */
export const reconcileSingleSubscription = internalMutation({
  args: {
    subscriptionStatusId: v.id("subscriptionStatuses"),
    userId: v.id("users"),
    rcCustomerInfo: v.any(), // RevenueCat customer info from API
  },
  returns: v.object({
    updated: v.boolean(),
    oldStatus: v.optional(v.string()),
    newStatus: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Get the subscription record from database
    const backendSubscription = await ctx.db.get(args.subscriptionStatusId);
    if (!backendSubscription) {
      console.warn(`Subscription ${args.subscriptionStatusId} not found during reconciliation`);
      return { updated: false };
    }

    // Check RC entitlements to determine subscription status
    const rcEntitlements = args.rcCustomerInfo?.subscriber?.entitlements?.active || {};
    const hasActiveSubscription = Object.keys(rcEntitlements).length > 0;
    const rcStatus = hasActiveSubscription ? "active" : "expired";

    // Only update if status changed (and not in grace period)
    if (backendSubscription.status !== rcStatus && backendSubscription.status !== "in_grace") {
      const now = Date.now();

      // Patch the subscription record
      await ctx.db.patch(args.subscriptionStatusId, {
        status: rcStatus,
        lastVerifiedAt: now,
      });

      // Log reconciliation event
      await ctx.db.insert("subscriptionLog", {
        userId: args.userId,
        eventType: "RECONCILIATION",
        productId: backendSubscription.productId,
        platform: backendSubscription.platform, // Type-safe: platform is validated in schema
        subscriptionTier: backendSubscription.subscriptionTier,
        status: rcStatus,
        expiresAt: backendSubscription.expiresAt,
        rawEvent: sanitizeForConvex(args.rcCustomerInfo),
        recordedAt: now,
      });

      return {
        updated: true,
        oldStatus: backendSubscription.status,
        newStatus: rcStatus,
      };
    }

    return {
      updated: false,
      oldStatus: backendSubscription.status,
      newStatus: rcStatus,
    };
  },
});
