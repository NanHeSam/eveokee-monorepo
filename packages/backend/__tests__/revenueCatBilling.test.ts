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

  it("sets canceledAt when status is canceled", async () => {
    const t = createTestEnvironment();
    const { userId, subscriptionId } = await createTestUser(t, {
      tier: "yearly",
    });

    // First, ensure we have an active subscription
    await t.mutation(
      internal.revenueCatBilling.syncRevenueCatSubscription,
      {
        userId,
        productId: "eveokee_premium_annual",
        status: "active",
        platform: "app_store",
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
      }
    );

    let subscription = await getSubscription(t, subscriptionId);
    expect(subscription?.canceledAt).toBeUndefined();

    // Cancel the subscription
    const cancelResult = await t.mutation(
      internal.revenueCatBilling.syncRevenueCatSubscription,
      {
        userId,
        productId: "eveokee_premium_annual",
        status: "canceled",
        platform: "app_store",
      }
    );

    expect(cancelResult.success).toBe(true);

    subscription = await getSubscription(t, subscriptionId);
    expect(subscription?.status).toBe("canceled");
    expect(subscription?.canceledAt).toBeDefined();
    expect(typeof subscription?.canceledAt).toBe("number");
  });

  it("clears canceledAt when subscription becomes active again", async () => {
    const t = createTestEnvironment();
    const { userId, subscriptionId } = await createTestUser(t, {
      tier: "yearly",
    });

    // First, cancel the subscription
    await t.mutation(
      internal.revenueCatBilling.syncRevenueCatSubscription,
      {
        userId,
        productId: "eveokee_premium_annual",
        status: "canceled",
        platform: "app_store",
      }
    );

    let subscription = await getSubscription(t, subscriptionId);
    expect(subscription?.status).toBe("canceled");
    expect(subscription?.canceledAt).toBeDefined();

    // Reactivate the subscription (user renewed)
    const reactivateResult = await t.mutation(
      internal.revenueCatBilling.syncRevenueCatSubscription,
      {
        userId,
        productId: "eveokee_premium_annual",
        status: "active",
        platform: "app_store",
        expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
      }
    );

    expect(reactivateResult.success).toBe(true);

    subscription = await getSubscription(t, subscriptionId);
    expect(subscription?.status).toBe("active");
    expect(subscription?.canceledAt).toBeUndefined();
  });

  it("sets canceledAt when status is expired", async () => {
    const t = createTestEnvironment();
    const { userId, subscriptionId } = await createTestUser(t, {
      tier: "monthly",
    });

    // Start with active subscription
    await t.mutation(
      internal.revenueCatBilling.syncRevenueCatSubscription,
      {
        userId,
        productId: "eveokee_premium_monthly",
        status: "active",
        platform: "play_store",
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      }
    );

    let subscription = await getSubscription(t, subscriptionId);
    expect(subscription?.canceledAt).toBeUndefined();

    // Expire the subscription
    await t.mutation(
      internal.revenueCatBilling.syncRevenueCatSubscription,
      {
        userId,
        productId: "eveokee_premium_monthly",
        status: "expired",
        platform: "play_store",
      }
    );

    subscription = await getSubscription(t, subscriptionId);
    expect(subscription?.status).toBe("expired");
    expect(subscription?.canceledAt).toBeDefined();
    expect(typeof subscription?.canceledAt).toBe("number");
  });

  it("clears canceledAt when transitioning from expired to in_grace", async () => {
    const t = createTestEnvironment();
    const { userId, subscriptionId } = await createTestUser(t, {
      tier: "yearly",
    });

    // Expire the subscription
    await t.mutation(
      internal.revenueCatBilling.syncRevenueCatSubscription,
      {
        userId,
        productId: "eveokee_premium_annual",
        status: "expired",
        platform: "app_store",
      }
    );

    let subscription = await getSubscription(t, subscriptionId);
    expect(subscription?.canceledAt).toBeDefined();

    // Move to grace period (payment issue resolved)
    await t.mutation(
      internal.revenueCatBilling.syncRevenueCatSubscription,
      {
        userId,
        productId: "eveokee_premium_annual",
        status: "in_grace",
        platform: "app_store",
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      }
    );

    subscription = await getSubscription(t, subscriptionId);
    expect(subscription?.status).toBe("in_grace");
    expect(subscription?.canceledAt).toBeUndefined();
  });
});
