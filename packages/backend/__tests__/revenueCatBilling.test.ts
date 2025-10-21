import { describe, it, expect } from "vitest";
import { internal } from "../convex/_generated/api";
import {
  createTestEnvironment,
  createTestUser,
  getSubscription,
  getUser,
} from "./convexTestUtils";

describe("RevenueCat subscription sync", () => {
  it("maps weekly product to monthly tier and stores expiresAt on new subscriptions", async () => {
    const t = createTestEnvironment();
    const { userId } = await t.run(async (ctx) => {
      const now = Date.now();
      const insertedUserId = await ctx.db.insert("users", {
        clerkId: `test-clerk-${now}`,
        email: `test-${now}@example.com`,
        name: "RevenueCat Tester",
        createdAt: now,
        updatedAt: now,
      });
      return { userId: insertedUserId };
    });

    const expiresAt = 1_790_000_000_000;

    const result = await t.mutation(
      internal.revenueCatBilling.syncRevenueCatSubscription,
      {
        userId,
        productId: "eveokee_premium_weekly",
        status: "active",
        platform: "app_store",
        expiresAt,
      }
    );

    expect(result.success).toBe(true);
    expect(result.userId).toEqual(userId);

    const user = await getUser(t, userId);
    expect(user?.activeSubscriptionId).toBeDefined();

    const subscription = await getSubscription(
      t,
      user!.activeSubscriptionId!
    );

    expect(subscription?.subscriptionTier).toBe("monthly");
    expect(subscription?.expiresAt).toBe(expiresAt);
    expect(subscription?.status).toBe("active");
    expect(subscription?.platform).toBe("app_store");
  });

  it("stores expiresAt on updates and downgrades tier when status is not active", async () => {
    const t = createTestEnvironment();
    const { userId, subscriptionId } = await createTestUser(t, {
      tier: "monthly",
    });

    const expiresAt = 1_800_000_000_000;

    const activeResult = await t.mutation(
      internal.revenueCatBilling.syncRevenueCatSubscription,
      {
        userId,
        productId: "eveokee_premium_monthly",
        status: "active",
        expiresAt,
      }
    );

    expect(activeResult.success).toBe(true);

    let subscription = await getSubscription(t, subscriptionId);
    expect(subscription?.subscriptionTier).toBe("monthly");
    expect(subscription?.expiresAt).toBe(expiresAt);

    const expiredResult = await t.mutation(
      internal.revenueCatBilling.syncRevenueCatSubscription,
      {
        userId,
        productId: "eveokee_premium_monthly",
        status: "expired",
      }
    );

    expect(expiredResult.success).toBe(true);

    subscription = await getSubscription(t, subscriptionId);
    expect(subscription?.subscriptionTier).toBe("free");
    expect(subscription?.status).toBe("expired");
  });
});
