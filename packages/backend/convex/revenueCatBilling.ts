import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const REVENUECAT_PRODUCT_TO_TIER: Record<string, string> = {
  "eveokee_premium_weekly": "weekly",
  "eveokee_premium_monthly": "monthly",
  "eveokee_premium_annual": "yearly",
};

export const syncRevenueCatSubscription = internalMutation({
  args: {
    revenueCatCustomerId: v.string(),
    productId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("canceled"),
      v.literal("expired"),
      v.literal("in_grace")
    ),
    expiresAt: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    userId: v.optional(v.id("users")),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    let user = await ctx.db
      .query("users")
      .withIndex("by_revenueCatCustomerId", (q) =>
        q.eq("revenueCatCustomerId", args.revenueCatCustomerId)
      )
      .first();

    if (!user) {
      const userById = await ctx.db.get(args.revenueCatCustomerId as any);
      
      if (userById) {
        user = userById;
        await ctx.db.patch(userById._id, {
          revenueCatCustomerId: args.revenueCatCustomerId,
          updatedAt: now,
        });
        console.log(
          `Linked RevenueCat customer ${args.revenueCatCustomerId} to user ${userById._id}`
        );
      } else {
        console.error(
          `User not found for RevenueCat customer ID: ${args.revenueCatCustomerId}`
        );
        return { success: false };
      }
    }

    const tier = REVENUECAT_PRODUCT_TO_TIER[args.productId] || "free";

    if (user.activeSubscriptionId) {
      const existingSubscription = await ctx.db.get(user.activeSubscriptionId);

      await ctx.db.patch(user.activeSubscriptionId, {
        platform: "revenuecat",
        productId: args.productId,
        status: args.status,
        subscriptionTier: tier,
        lastVerifiedAt: now,
        ...(args.status === "canceled" && { canceledAt: now }),
      });
    } else {
      const subscriptionId = await ctx.db.insert("subscriptionStatuses", {
        userId: user._id,
        platform: "revenuecat",
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

export const linkRevenueCatCustomer = internalMutation({
  args: {
    userId: v.id("users"),
    revenueCatCustomerId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      revenueCatCustomerId: args.revenueCatCustomerId,
      updatedAt: Date.now(),
    });

    console.log(
      `Linked RevenueCat customer ${args.revenueCatCustomerId} to user ${args.userId}`
    );

    return { success: true };
  },
});
