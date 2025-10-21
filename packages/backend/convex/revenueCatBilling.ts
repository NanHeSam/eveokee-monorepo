import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const REVENUECAT_PRODUCT_TO_TIER: Record<string, string> = {
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

    const tier = REVENUECAT_PRODUCT_TO_TIER[args.productId] || "free";

    if (user.activeSubscriptionId) {
      const existingSubscription = await ctx.db.get(user.activeSubscriptionId);

      await ctx.db.patch(user.activeSubscriptionId, {
        ...(args.platform && { platform: args.platform }),
        productId: args.productId,
        status: args.status,
        subscriptionTier: tier,
        lastVerifiedAt: now,
        ...(args.status === "canceled" && { canceledAt: now }),
      });
    } else {
      const subscriptionId = await ctx.db.insert("subscriptionStatuses", {
        userId: user._id,
        ...(args.platform && { platform: args.platform }),
        productId: args.productId,
        status: args.status,
        subscriptionTier: tier,
        lastResetAt: now,
        musicGenerationsUsed: 0,
        lastVerifiedAt: now,
        ...(args.status === "canceled" && { canceledAt: now }),
      });

      // Update user with active subscription
      await ctx.db.patch(user._id, {
        activeSubscriptionId: subscriptionId,
        updatedAt: now,
      });
    }

    console.log(
      `Successfully synced RevenueCat subscription for user ${user._id}: ${tier} (${args.status})`
    );

    return { success: true, userId: user._id };
  },
});

