import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const REVENUECAT_PRODUCT_TO_TIER: Record<string, string> = {
  "eveokee_premium_weekly": "monthly",
  "eveokee_premium_monthly": "monthly",
  "eveokee_premium_annual": "yearly",
};

export const syncRevenueCatSubscription = internalMutation({
  args: {
    userId: v.id("users"),
    productId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("expired"),
      v.literal("in_grace")
    ),
    platform: v.optional(v.union(
      v.literal("app_store"),
      v.literal("play_store"),
      v.literal("stripe"),
      v.literal("amazon"),
      v.literal("mac_app_store"),
      v.literal("promotional")
    )),
    expiresAt: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    userId: v.optional(v.id("users")),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    const user = await ctx.db.get(args.userId);

    if (!user) {
      console.error(
        `User not found for ID: ${args.userId}`
      );
      return { success: false };
    }

    // Validate product ID mapping
    const mappedTier = REVENUECAT_PRODUCT_TO_TIER[args.productId];
    if (!mappedTier) {
      console.error(
        `Unknown RevenueCat product ID: ${args.productId}. Valid products: ${Object.keys(REVENUECAT_PRODUCT_TO_TIER).join(", ")}`
      );
      return { success: false };
    }
    const effectiveTier =
      args.status === "active" || args.status === "in_grace" ? mappedTier : "free";

    if (user.activeSubscriptionId) {
      const existingSubscription = await ctx.db.get(user.activeSubscriptionId);

      // Determine canceledAt based on status
      let canceledAtUpdate: { canceledAt: number } | { canceledAt: undefined } | {} = {};
      if (args.status === "canceled" || args.status === "expired") {
        // Set canceledAt when subscription is canceled or expired
        canceledAtUpdate = { canceledAt: now };
      } else if (args.status === "active" || args.status === "in_grace") {
        // Clear canceledAt when subscription is active or in grace period
        canceledAtUpdate = { canceledAt: undefined };
      }

      await ctx.db.patch(user.activeSubscriptionId, {
        ...(args.platform && { platform: args.platform }),
        productId: args.productId,
        status: args.status,
        subscriptionTier: effectiveTier,
        ...(typeof args.expiresAt === "number" && { expiresAt: args.expiresAt }),
        lastVerifiedAt: now,
        ...canceledAtUpdate,
      });
    } else {
      // For new subscriptions, only set canceledAt if status is canceled or expired
      const subscriptionId = await ctx.db.insert("subscriptionStatuses", {
        userId: user._id,
        ...(args.platform && { platform: args.platform }),
        productId: args.productId,
        status: args.status,
        subscriptionTier: effectiveTier,
        lastResetAt: now,
        musicGenerationsUsed: 0,
        lastVerifiedAt: now,
        ...(typeof args.expiresAt === "number" && { expiresAt: args.expiresAt }),
        ...((args.status === "canceled" || args.status === "expired") && { canceledAt: now }),
      });

      // Update user with active subscription
      await ctx.db.patch(user._id, {
        activeSubscriptionId: subscriptionId,
        updatedAt: now,
      });
    }

    console.log(
      `Successfully synced RevenueCat subscription for user ${user._id}: ${effectiveTier} (${args.status})`
    );

    return { success: true, userId: user._id };
  },
});
