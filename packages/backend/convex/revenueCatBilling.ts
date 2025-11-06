import { v } from "convex/values";
import { internalMutation, internalQuery, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createLogger, generateCorrelationId, logReconciliation, sanitizeForConvex } from "./utils/logger";
import {
  REVENUECAT_PRODUCT_TO_TIER,
  REVENUECAT_STORE_TO_PLATFORM,
  REVENUECAT_ACTIVE_EVENT_TYPES,
  REVENUECAT_SIGNIFICANT_EVENT_TYPES,
  REVENUECAT_RECONCILIATION_WINDOW_MS,
  MAX_RECONCILIATION_ERRORS_TO_LOG,
} from "./utils/constants";
import { createRevenueCatClientFromEnv, RevenueCatCustomerInfo } from "./integrations/revenuecat/client";

const getPlatformFromStore = (store: string | undefined): "app_store" | "play_store" | "stripe" | undefined => {
  return store ? REVENUECAT_STORE_TO_PLATFORM[store] : undefined;
};

const getStatusFromEventType = (eventType: string, isActive: boolean): "active" | "canceled" | "expired" | "in_grace" => {
  switch (eventType) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "SUBSCRIPTION_UNPAUSED":
    case "SUBSCRIPTION_RESUMED":
      return "active";
    case "PRODUCT_CHANGE":
      // PRODUCT_CHANGE indicates a subscription change (upgrade/downgrade)
      // If isActive is true (has entitlements), subscription is active
      // Otherwise, it's expired (user changed to a product that's no longer active)
      return isActive ? "active" : "expired";
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
    environment: v.optional(v.union(v.literal("SANDBOX"), v.literal("PRODUCTION"))),
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
    // For PRODUCT_CHANGE events, check entitlements to determine if subscription is active
    // For other events, use the event type list
    const isActive = args.eventType === "PRODUCT_CHANGE"
      ? (args.entitlementIds && args.entitlementIds.length > 0)
      : REVENUECAT_ACTIVE_EVENT_TYPES.includes(args.eventType as any);
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

    const isSignificantEvent = REVENUECAT_SIGNIFICANT_EVENT_TYPES.includes(args.eventType as any);

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
        platform: platform,
        subscriptionTier: effectiveTier,
        status,
        expiresAt,
        purchasedAt,
        isTrialConversion: args.isTrialConversion,
        entitlementIds: args.entitlementIds,
        store: args.store,
        environment: args.environment,
        rawEvent: args.rawEvent,
        recordedAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Internal mutation: Reconcile subscription status and product ID with RevenueCat customer data
 * This mutation updates the database based on RevenueCat customer info fetched server-side
 * RevenueCat is treated as the single source of truth for product ID and status
 */
export const reconcileSubscriptionWithData = internalMutation({
  args: {
    userId: v.id("users"),
    rcCustomerInfo: v.any(), // From RevenueCat API v2 (customer format)
  },
  returns: v.object({ 
    success: v.boolean(),
    updated: v.boolean(),
    backendStatus: v.string(),
    rcStatus: v.string(),
    productIdUpdated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !user.activeSubscriptionId) {
      return { success: false, updated: false, backendStatus: "none", rcStatus: "none", productIdUpdated: false };
    }

    const backendSubscription = await ctx.db.get(user.activeSubscriptionId);
    if (!backendSubscription) {
      return { success: false, updated: false, backendStatus: "missing", rcStatus: "none", productIdUpdated: false };
    }

    // Check RC entitlements to determine if user has active subscription
    // RevenueCat API v2 format: active_entitlements.items[]
    const rcEntitlements = getActiveEntitlementsFromV2(args.rcCustomerInfo);
    const hasActiveSubscription = Object.keys(rcEntitlements).length > 0;
    const rcStatus = hasActiveSubscription ? "active" : "expired";

    // Extract product ID from RevenueCat entitlements (v2 API)
    const rcProductId = getProductIdentifierFromV2(args.rcCustomerInfo);

    const now = Date.now();
    let statusUpdated = false;
    let productIdUpdated = false;
    const updates: Record<string, unknown> = {};

    // Reconcile product ID if mismatch (RevenueCat is source of truth)
    if (rcProductId && backendSubscription.productId !== rcProductId) {
      console.warn(
        `Product ID mismatch detected for user ${args.userId}: ` +
        `backend=${backendSubscription.productId}, RevenueCat=${rcProductId}. ` +
        `Updating database to match RevenueCat (single source of truth).`
      );
      
      // Map RC product ID to tier
      const mappedTier = REVENUECAT_PRODUCT_TO_TIER[rcProductId] || "free";
      // Use hasActiveSubscription to determine tier (active subscriptions get mapped tier, expired get free)
      const effectiveTier = hasActiveSubscription ? mappedTier : "free";
      
      updates.productId = rcProductId;
      updates.subscriptionTier = effectiveTier;
      productIdUpdated = true;
    }

    // Reconcile status if different (and not in grace period)
    if (backendSubscription.status !== rcStatus && backendSubscription.status !== "in_grace") {
      updates.status = rcStatus;
      statusUpdated = true;
    }

    // Update database if any changes
    if (statusUpdated || productIdUpdated) {
      updates.lastVerifiedAt = now;
      await ctx.db.patch(user.activeSubscriptionId, updates);

      // Log reconciliation
      await ctx.db.insert("subscriptionLog", {
        userId: user._id,
        eventType: "RECONCILIATION",
        productId: rcProductId || backendSubscription.productId,
        platform: backendSubscription.platform, // Type-safe: platform is validated in schema
        subscriptionTier: updates.subscriptionTier as string || backendSubscription.subscriptionTier,
        status: rcStatus,
        expiresAt: backendSubscription.expiresAt,
        rawEvent: sanitizeForConvex(args.rcCustomerInfo),
        recordedAt: now,
      });

      return { 
        success: true, 
        updated: true, 
        backendStatus: backendSubscription.status, 
        rcStatus,
        productIdUpdated,
      };
    }

    return { 
      success: true, 
      updated: false, 
      backendStatus: backendSubscription.status, 
      rcStatus,
      productIdUpdated: false,
    };
  },
});

/**
 * Internal mutation: Reconcile product ID from RevenueCat customer data
 * Called before usage checks to ensure product ID matches RevenueCat (single source of truth)
 */
export const reconcileProductIdFromRevenueCatData = internalMutation({
  args: {
    userId: v.id("users"),
    rcCustomerInfo: v.any(), // From RevenueCat API v2 (customer format)
  },
  returns: v.object({ 
    success: v.boolean(),
    productIdUpdated: v.boolean(),
    rcProductId: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !user.activeSubscriptionId) {
      return { success: false, productIdUpdated: false };
    }

    const backendSubscription = await ctx.db.get(user.activeSubscriptionId);
    if (!backendSubscription) {
      return { success: false, productIdUpdated: false };
    }

    // Extract product ID from RevenueCat entitlements (v2 API)
    const rcEntitlements = getActiveEntitlementsFromV2(args.rcCustomerInfo);
    const rcProductId = getProductIdentifierFromV2(args.rcCustomerInfo);

    // Reconcile product ID if mismatch (RevenueCat is source of truth)
    if (rcProductId && backendSubscription.productId !== rcProductId) {
      console.warn(
        `Product ID mismatch detected for user ${args.userId}: ` +
        `backend=${backendSubscription.productId}, RevenueCat=${rcProductId}. ` +
        `Updating database to match RevenueCat (single source of truth).`
      );
      
      // Map RC product ID to tier
      const mappedTier = REVENUECAT_PRODUCT_TO_TIER[rcProductId] || "free";
      const hasActiveSubscription = Object.keys(rcEntitlements).length > 0;
      const effectiveTier = hasActiveSubscription ? mappedTier : "free";
      
      const now = Date.now();
      await ctx.db.patch(user.activeSubscriptionId, {
        productId: rcProductId,
        subscriptionTier: effectiveTier,
        lastVerifiedAt: now,
        status: hasActiveSubscription ? "active" : "expired",
        // v2 API: platform info may be in last_seen_platform or entitlement details
        platform: args.rcCustomerInfo?.last_seen_platform === "iOS" 
          ? "app_store" 
          : args.rcCustomerInfo?.last_seen_platform === "ANDROID" 
          ? "play_store" 
          : undefined,
      });

      // Log reconciliation
      await ctx.db.insert("subscriptionLog", {
        userId: user._id,
        eventType: "RECONCILIATION",
        productId: rcProductId,
        platform: backendSubscription.platform,
        subscriptionTier: effectiveTier,
        status: backendSubscription.status,
        expiresAt: backendSubscription.expiresAt,
        rawEvent: sanitizeForConvex(args.rcCustomerInfo),
        recordedAt: now,
      });

      return { 
        success: true, 
        productIdUpdated: true,
        rcProductId,
      };
    }

    return { 
      success: true, 
      productIdUpdated: false,
      rcProductId,
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
        if (result.productIdUpdated) {
          logger.warn('Product ID updated during reconciliation', {
            userId: args.userId,
          });
        }
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
 * Reconcile product ID with RevenueCat before usage checks
 * ACTION: Fetches canonical customer data from RevenueCat API and reconciles product ID
 * This ensures RevenueCat is always the single source of truth for product ID
 */
export const reconcileProductId = internalAction({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({ 
    success: v.boolean(),
    productIdUpdated: v.boolean(),
    rcProductId: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      // Fetch canonical customer data from RevenueCat API
      const rcCustomerInfo = await fetchRevenueCatCustomer(args.userId);

      if (!rcCustomerInfo) {
        return { 
          success: false, 
          productIdUpdated: false,
        };
      }

      // Call mutation to update database based on canonical RC data
      const result = await ctx.runMutation(
        internal.revenueCatBilling.reconcileProductIdFromRevenueCatData,
        {
          userId: args.userId,
          rcCustomerInfo,
        }
      );

      return result;
    } catch (error) {
      console.error(`Failed to reconcile product ID: userId=${args.userId}`, error);
      
      return { 
        success: false, 
        productIdUpdated: false,
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
    const twentyFourHoursAgo = Date.now() - REVENUECAT_RECONCILIATION_WINDOW_MS;
    
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
 * Uses the RevenueCat client for consistent error handling
 */
async function fetchRevenueCatCustomer(appUserId: string): Promise<RevenueCatCustomerInfo | null> {
  const revenueCatClient = createRevenueCatClientFromEnv({
    REVENUECAT_API_KEY: process.env.REVENUECAT_API_KEY,
    REVENUECAT_PROJECT_ID: process.env.REVENUECAT_PROJECT_ID,
    REVENUECAT_TIMEOUT: process.env.REVENUECAT_TIMEOUT,
  });

  return await revenueCatClient.getCustomerInfo(appUserId);
}

/**
 * Helper to extract active entitlements from RevenueCat v2 API response
 * Returns a record compatible with the old v1 format for backward compatibility
 * @internal - Exported for testing purposes
 */
export function getActiveEntitlementsFromV2(customerInfo: RevenueCatCustomerInfo | null): Record<string, any> {
  if (!customerInfo?.active_entitlements?.items) {
    return {};
  }

  const entitlements: Record<string, any> = {};
  for (const entitlement of customerInfo.active_entitlements.items) {
    // Map entitlement_id to the entitlement object
    entitlements[entitlement.entitlement_id] = entitlement;
  }
  return entitlements;
}

/**
 * Helper to extract product identifier from RevenueCat v2 API response
 * Note: v2 API may require fetching entitlement details separately for full product info
 * @internal - Exported for testing purposes
 */
export function getProductIdentifierFromV2(customerInfo: RevenueCatCustomerInfo | null): string | undefined {
  const entitlements = getActiveEntitlementsFromV2(customerInfo);
  if (Object.keys(entitlements).length === 0) {
    return undefined;
  }

  // Try to get product_identifier from the first entitlement
  // v2 API structure: entitlement may have product_identifier or we may need to fetch details
  const firstEntitlement = Object.values(entitlements)[0] as any;
  return firstEntitlement?.product_identifier || firstEntitlement?.product_id;
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
        errors: errors.slice(0, MAX_RECONCILIATION_ERRORS_TO_LOG),
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

    // Check RC entitlements to determine subscription status (v2 API)
    const rcEntitlements = getActiveEntitlementsFromV2(args.rcCustomerInfo);
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
