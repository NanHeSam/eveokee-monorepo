import { describe, it, expect, afterEach } from "vitest";
import { internal } from "../convex/_generated/api";
import {
  createTestEnvironment,
  createTestUser,
  freezeTime,
  unfreezeTime,
  getSubscription,
} from "./convexTestUtils";
import { getAnnualMonthlyCredit } from "../convex/billing";

describe("RevenueCat Billing - Tier Change Reset Logic", () => {
  afterEach(() => {
    unfreezeTime();
  });

  describe("Upgrade Scenarios", () => {
    it("should reset usage when upgrading from free to monthly", async () => {
      const startTime = 1704067200000; // 2024-01-01 00:00:00
      freezeTime(startTime);

      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "free",
        musicGenerationsUsed: 4, // User has used 4 out of 5 free credits
      });

      // Simulate webhook for upgrade to monthly
      await t.mutation(internal.revenueCatBilling.updateSubscriptionFromWebhook, {
        userId,
        eventType: "PRODUCT_CHANGE",
        productId: "eveokee_premium_monthly",
        store: "APP_STORE",
        entitlementIds: ["premium"],
      });

      // Verify subscription was updated and usage reset
      const subscription = await getSubscription(t, subscriptionId);

      expect(subscription?.subscriptionTier).toBe("monthly");
      expect(subscription?.musicGenerationsUsed).toBe(0); // Should reset to 0
      expect(subscription?.lastResetAt).toBe(startTime);
      expect(subscription?.customMusicLimit).toBeUndefined(); // Monthly uses plan default
    });

    it("should reset usage when upgrading from weekly to monthly", async () => {
      const startTime = 1704067200000;
      freezeTime(startTime);

      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "weekly",
        musicGenerationsUsed: 18, // User has used 18 out of 20 weekly credits
      });

      // Simulate webhook for upgrade to monthly
      await t.mutation(internal.revenueCatBilling.updateSubscriptionFromWebhook, {
        userId,
        eventType: "PRODUCT_CHANGE",
        productId: "eveokee_premium_monthly",
        store: "APP_STORE",
        entitlementIds: ["premium"],
      });

      // Verify subscription was updated and usage reset
      const subscription = await getSubscription(t, subscriptionId);

      expect(subscription?.subscriptionTier).toBe("monthly");
      expect(subscription?.musicGenerationsUsed).toBe(0); // Should reset to 0
      expect(subscription?.lastResetAt).toBe(startTime);
      expect(subscription?.customMusicLimit).toBeUndefined();
    });

    it("should reset usage and set customMusicLimit when upgrading to yearly", async () => {
      const startTime = 1704067200000;
      freezeTime(startTime);

      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "monthly",
        musicGenerationsUsed: 50, // User has used 50 out of 90 monthly credits
      });

      const expectedMonthlyCredit = getAnnualMonthlyCredit();

      // Simulate webhook for upgrade to yearly
      await t.mutation(internal.revenueCatBilling.updateSubscriptionFromWebhook, {
        userId,
        eventType: "PRODUCT_CHANGE",
        productId: "eveokee_premium_annual",
        store: "APP_STORE",
        entitlementIds: ["premium"],
      });

      // Verify subscription was updated with yearly monthly credit
      const subscription = await getSubscription(t, subscriptionId);

      expect(subscription?.subscriptionTier).toBe("yearly");
      expect(subscription?.musicGenerationsUsed).toBe(0); // Should reset to 0
      expect(subscription?.lastResetAt).toBe(startTime);
      expect(subscription?.customMusicLimit).toBe(expectedMonthlyCredit); // Should have monthly credit
    });
  });

  describe("Downgrade Scenarios", () => {
    it("should reset usage when downgrading from monthly to free", async () => {
      const startTime = 1704067200000;
      freezeTime(startTime);

      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "monthly",
        musicGenerationsUsed: 85, // User has used 85 out of 90 credits
      });

      // Simulate webhook for expiration/downgrade to free
      await t.mutation(internal.revenueCatBilling.updateSubscriptionFromWebhook, {
        userId,
        eventType: "EXPIRATION",
        productId: "eveokee_premium_monthly",
        store: "APP_STORE",
        entitlementIds: [], // No active entitlements
      });

      // Verify subscription was updated and usage reset
      const subscription = await getSubscription(t, subscriptionId);

      expect(subscription?.subscriptionTier).toBe("free");
      expect(subscription?.musicGenerationsUsed).toBe(0); // Should reset to 0, not stay at 85
      expect(subscription?.lastResetAt).toBe(startTime);
      expect(subscription?.customMusicLimit).toBeUndefined();
    });

    it("should reset usage when downgrading from yearly to free", async () => {
      const startTime = 1704067200000;
      freezeTime(startTime);

      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "yearly",
        musicGenerationsUsed: 80,
        customMusicLimit: getAnnualMonthlyCredit(),
      });

      // Simulate webhook for expiration
      await t.mutation(internal.revenueCatBilling.updateSubscriptionFromWebhook, {
        userId,
        eventType: "EXPIRATION",
        productId: "eveokee_premium_annual",
        store: "APP_STORE",
        entitlementIds: [],
      });

      // Verify subscription was updated and usage reset
      const subscription = await getSubscription(t, subscriptionId);

      expect(subscription?.subscriptionTier).toBe("free");
      expect(subscription?.musicGenerationsUsed).toBe(0); // Should reset to 0
      expect(subscription?.lastResetAt).toBe(startTime);
      expect(subscription?.customMusicLimit).toBeUndefined(); // Should clear custom limit
    });
  });

  describe("Same Tier Scenarios (No Reset)", () => {
    it("should NOT reset usage when renewing same tier", async () => {
      const startTime = 1704067200000;
      freezeTime(startTime);

      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "monthly",
        musicGenerationsUsed: 45,
      });

      // Simulate webhook for renewal (same tier)
      await t.mutation(internal.revenueCatBilling.updateSubscriptionFromWebhook, {
        userId,
        eventType: "RENEWAL",
        productId: "eveokee_premium_monthly",
        store: "APP_STORE",
        entitlementIds: ["premium"],
      });

      // Verify subscription was updated but usage NOT reset
      const subscription = await getSubscription(t, subscriptionId);

      expect(subscription?.subscriptionTier).toBe("monthly");
      expect(subscription?.musicGenerationsUsed).toBe(45); // Should remain at 45
    });

    it("should NOT reset usage when product ID changes but tier remains the same", async () => {
      const startTime = 1704067200000;
      freezeTime(startTime);

      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "monthly",
        musicGenerationsUsed: 30,
      });

      // Simulate webhook for product change (iOS to Android) but same tier
      await t.mutation(internal.revenueCatBilling.updateSubscriptionFromWebhook, {
        userId,
        eventType: "PRODUCT_CHANGE",
        productId: "eveokee_premium:eveokee-premium-monthly", // Android product ID
        store: "PLAY_STORE",
        entitlementIds: ["premium"],
      });

      // Verify subscription was updated but usage NOT reset (same tier)
      const subscription = await getSubscription(t, subscriptionId);

      expect(subscription?.subscriptionTier).toBe("monthly"); // Still monthly
      expect(subscription?.musicGenerationsUsed).toBe(30); // Should remain at 30
      expect(subscription?.productId).toBe("eveokee_premium:eveokee-premium-monthly"); // Product ID updated
    });
  });

  describe("Edge Cases", () => {
    it("should handle new subscription creation with correct initial state", async () => {
      const startTime = 1704067200000;
      freezeTime(startTime);

      const t = createTestEnvironment();

      // Create user without subscription
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "test-clerk-new",
          email: "new@example.com",
          name: "New User",
          createdAt: startTime,
          updatedAt: startTime,
        });
      });

      // Simulate webhook for initial purchase
      await t.mutation(internal.revenueCatBilling.updateSubscriptionFromWebhook, {
        userId,
        eventType: "INITIAL_PURCHASE",
        productId: "eveokee_premium_monthly",
        store: "APP_STORE",
        entitlementIds: ["premium"],
      });

      // Get the created subscription
      const user = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });

      expect(user?.activeSubscriptionId).toBeDefined();

      const subscription = await getSubscription(t, user!.activeSubscriptionId!);

      expect(subscription?.subscriptionTier).toBe("monthly");
      expect(subscription?.musicGenerationsUsed).toBe(0);
      expect(subscription?.lastResetAt).toBe(startTime);
      expect(subscription?.customMusicLimit).toBeUndefined();
    });

    it("should handle multiple tier changes correctly", async () => {
      const startTime = 1704067200000;
      freezeTime(startTime);

      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "free",
        musicGenerationsUsed: 3,
      });

      // First upgrade: free -> weekly
      await t.mutation(internal.revenueCatBilling.updateSubscriptionFromWebhook, {
        userId,
        eventType: "PRODUCT_CHANGE",
        productId: "eveokee_premium_weekly",
        store: "APP_STORE",
        entitlementIds: ["premium"],
      });

      let subscription = await getSubscription(t, subscriptionId);
      expect(subscription?.subscriptionTier).toBe("weekly");
      expect(subscription?.musicGenerationsUsed).toBe(0); // Reset on tier change

      // Use some credits
      await t.run(async (ctx) => {
        await ctx.db.patch(subscriptionId, {
          musicGenerationsUsed: 10,
        });
      });

      // Second upgrade: weekly -> monthly
      await t.mutation(internal.revenueCatBilling.updateSubscriptionFromWebhook, {
        userId,
        eventType: "PRODUCT_CHANGE",
        productId: "eveokee_premium_monthly",
        store: "APP_STORE",
        entitlementIds: ["premium"],
      });

      subscription = await getSubscription(t, subscriptionId);
      expect(subscription?.subscriptionTier).toBe("monthly");
      expect(subscription?.musicGenerationsUsed).toBe(0); // Reset on tier change again

      // Use some credits
      await t.run(async (ctx) => {
        await ctx.db.patch(subscriptionId, {
          musicGenerationsUsed: 50,
        });
      });

      // Third upgrade: monthly -> yearly
      await t.mutation(internal.revenueCatBilling.updateSubscriptionFromWebhook, {
        userId,
        eventType: "PRODUCT_CHANGE",
        productId: "eveokee_premium_annual",
        store: "APP_STORE",
        entitlementIds: ["premium"],
      });

      subscription = await getSubscription(t, subscriptionId);
      expect(subscription?.subscriptionTier).toBe("yearly");
      expect(subscription?.musicGenerationsUsed).toBe(0); // Reset on tier change
      expect(subscription?.customMusicLimit).toBe(getAnnualMonthlyCredit());
    });

    it("should reset usage on cancellation (tier changes to free)", async () => {
      const startTime = 1704067200000;
      freezeTime(startTime);

      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "monthly",
        musicGenerationsUsed: 60,
      });

      // Simulate webhook for cancellation (tier changes to free, status becomes canceled)
      await t.mutation(internal.revenueCatBilling.updateSubscriptionFromWebhook, {
        userId,
        eventType: "CANCELLATION",
        productId: "eveokee_premium_monthly",
        store: "APP_STORE",
        entitlementIds: ["premium"], // Still active until period end
      });

      // Verify subscription tier changed to free and usage reset
      const subscription = await getSubscription(t, subscriptionId);

      expect(subscription?.subscriptionTier).toBe("free");
      expect(subscription?.status).toBe("canceled");
      expect(subscription?.musicGenerationsUsed).toBe(0); // Should reset to 0 due to tier change
    });
  });
});
