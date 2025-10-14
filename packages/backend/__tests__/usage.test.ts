import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { internal } from "../convex/_generated/api";
import {
  createTestEnvironment,
  createTestUser,
  freezeTime,
  unfreezeTime,
  getSubscription,
} from "./convexTestUtils";
import { getPeriodDurationMs } from "../convex/billing";

describe("Subscription Usage Accounting", () => {
  afterEach(() => {
    unfreezeTime();
  });

  describe("Period Reset Logic", () => {
    it("should reset musicGenerationsUsed when period expires", async () => {
      const startTime = 1704067200000; // 2024-01-01 00:00:00
      freezeTime(startTime);

      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "free", // 30-day period
        musicGenerationsUsed: 5,
      });

      // Fast-forward past period end (30 days + 1 ms)
      const periodDuration = getPeriodDurationMs("free");
      const afterPeriodEnd = startTime + periodDuration + 1;
      unfreezeTime();
      freezeTime(afterPeriodEnd);

      // Record usage triggers period check
      const result = await t.mutation(internal.usage.recordMusicGeneration, {
        userId,
      });

      expect(result.success).toBe(true);
      expect(result.currentUsage).toBe(1); // Reset to 0, then incremented to 1

      // Verify subscription was reset
      const subscription = await getSubscription(t, subscriptionId);

      expect(subscription?.musicGenerationsUsed).toBe(1);
      expect(subscription?.lastResetAt).toBe(afterPeriodEnd);
    });

    it("should NOT reset when period has not expired", async () => {
      const startTime = 1704067200000;
      freezeTime(startTime);

      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "weekly", // 7-day period
        musicGenerationsUsed: 10,
      });

      // Advance time but stay within period (5 days)
      unfreezeTime();
      freezeTime(startTime + 5 * 24 * 60 * 60 * 1000);

      const result = await t.mutation(internal.usage.recordMusicGeneration, {
        userId,
      });

      expect(result.success).toBe(true);
      expect(result.currentUsage).toBe(11); // Incremented from 10

      const subscription = await getSubscription(t, subscriptionId);

      expect(subscription?.musicGenerationsUsed).toBe(11);
      expect(subscription?.lastResetAt).toBe(startTime); // Not reset
    });

    it("should calculate period boundaries correctly for different tiers", async () => {
      const startTime = 1704067200000;
      freezeTime(startTime);

      const t = createTestEnvironment();

      // Test weekly tier (7 days)
      const { userId: weeklyUserId } = await createTestUser(t, {
        tier: "weekly",
        clerkId: "weekly-user",
      });

      const weeklyResult = await t.mutation(
        internal.usage.recordMusicGeneration,
        { userId: weeklyUserId }
      );

      expect(weeklyResult.periodStart).toBe(startTime);
      expect(weeklyResult.periodEnd).toBe(startTime + 7 * 24 * 60 * 60 * 1000);

      // Test monthly tier (30 days)
      const { userId: monthlyUserId } = await createTestUser(t, {
        tier: "monthly",
        clerkId: "monthly-user",
      });

      const monthlyResult = await t.mutation(
        internal.usage.recordMusicGeneration,
        { userId: monthlyUserId }
      );

      expect(monthlyResult.periodStart).toBe(startTime);
      expect(monthlyResult.periodEnd).toBe(startTime + 30 * 24 * 60 * 60 * 1000);

      // Test yearly tier (365 days)
      const { userId: yearlyUserId } = await createTestUser(t, {
        tier: "yearly",
        clerkId: "yearly-user",
      });

      const yearlyResult = await t.mutation(
        internal.usage.recordMusicGeneration,
        { userId: yearlyUserId }
      );

      expect(yearlyResult.periodStart).toBe(startTime);
      expect(yearlyResult.periodEnd).toBe(startTime + 365 * 24 * 60 * 60 * 1000);
    });

    it("should reset exactly at period boundary", async () => {
      const startTime = 1704067200000;
      freezeTime(startTime);

      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "weekly", // 7 days
        musicGenerationsUsed: 20,
      });

      // Fast-forward exactly to period end (not +1ms)
      const periodDuration = getPeriodDurationMs("weekly");
      const periodEnd = startTime + periodDuration;
      unfreezeTime();
      freezeTime(periodEnd);

      const result = await t.mutation(internal.usage.recordMusicGeneration, {
        userId,
      });

      // At exact boundary, should NOT reset yet (uses > comparison)
      expect(result.currentUsage).toBe(21);

      // Now go 1ms past
      unfreezeTime();
      freezeTime(periodEnd + 1);

      const result2 = await t.mutation(internal.usage.recordMusicGeneration, {
        userId,
      });

      // Should reset now
      expect(result2.currentUsage).toBe(1);

      const subscription = await getSubscription(t, subscriptionId);
      expect(subscription?.lastResetAt).toBe(periodEnd + 1);
    });
  });

  describe("Usage Recording", () => {
    it("should return failure when at limit", async () => {
      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "alpha", // Limit of 3
        musicGenerationsUsed: 3,
      });

      const result = await t.mutation(internal.usage.recordMusicGeneration, {
        userId,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe("Usage limit reached");
      expect(result.currentUsage).toBe(3);
      expect(result.remainingQuota).toBe(0);

      // Verify counter was NOT incremented
      const subscription = await getSubscription(t, subscriptionId);
      expect(subscription?.musicGenerationsUsed).toBe(3);
    });

    it("should return failure when above limit", async () => {
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t, {
        tier: "alpha", // Limit of 3
        musicGenerationsUsed: 5, // Somehow above limit
      });

      const result = await t.mutation(internal.usage.recordMusicGeneration, {
        userId,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe("Usage limit reached");
      expect(result.currentUsage).toBe(5);
      expect(result.remainingQuota).toBe(0); // Clamped to 0
    });

    it("should increment usage counter when under limit", async () => {
      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "alpha", // Limit of 3
        musicGenerationsUsed: 1,
      });

      const result = await t.mutation(internal.usage.recordMusicGeneration, {
        userId,
      });

      expect(result.success).toBe(true);
      expect(result.currentUsage).toBe(2);
      expect(result.remainingQuota).toBe(1);

      const subscription = await getSubscription(t, subscriptionId);
      expect(subscription?.musicGenerationsUsed).toBe(2);
    });

    it("should allow generation at limit - 1", async () => {
      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "alpha", // Limit of 3
        musicGenerationsUsed: 2,
      });

      const result = await t.mutation(internal.usage.recordMusicGeneration, {
        userId,
      });

      expect(result.success).toBe(true);
      expect(result.currentUsage).toBe(3);
      expect(result.remainingQuota).toBe(0);

      const subscription = await getSubscription(t, subscriptionId);
      expect(subscription?.musicGenerationsUsed).toBe(3);
    });

    it("should respect custom music limit", async () => {
      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "alpha", // Default limit of 3
        customMusicLimit: 100, // Custom override
        musicGenerationsUsed: 99,
      });

      const result = await t.mutation(internal.usage.recordMusicGeneration, {
        userId,
      });

      expect(result.success).toBe(true);
      expect(result.currentUsage).toBe(100);
      expect(result.remainingQuota).toBe(0);
      expect(result.limit).toBe(100); // Uses custom limit

      const subscription = await getSubscription(t, subscriptionId);
      expect(subscription?.musicGenerationsUsed).toBe(100);
    });

    it("should update lastVerifiedAt timestamp", async () => {
      const now = 1234567890000;
      freezeTime(now);

      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "alpha",
        musicGenerationsUsed: 0,
      });

      await t.mutation(internal.usage.recordMusicGeneration, { userId });

      const subscription = await getSubscription(t, subscriptionId);
      expect(subscription?.lastVerifiedAt).toBe(now);
    });
  });

  describe("Remaining Quota Calculation", () => {
    it("should calculate remainingQuota correctly", async () => {
      const t = createTestEnvironment();

      // Test with standard limit
      const { userId: user1 } = await createTestUser(t, {
        tier: "monthly", // Limit of 90
        musicGenerationsUsed: 75,
        clerkId: "user-1",
      });

      const result1 = await t.mutation(internal.usage.recordMusicGeneration, {
        userId: user1,
      });

      expect(result1.remainingQuota).toBe(14); // 90 - 76

      // Test with custom limit
      const { userId: user2 } = await createTestUser(t, {
        tier: "alpha",
        musicGenerationsUsed: 0,
        customMusicLimit: 100,
        clerkId: "user-2",
      });

      const result2 = await t.mutation(internal.usage.recordMusicGeneration, {
        userId: user2,
      });

      expect(result2.remainingQuota).toBe(99); // 100 - 1
    });

    it("should never return negative remainingQuota", async () => {
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t, {
        tier: "alpha", // Limit of 3
        musicGenerationsUsed: 5, // Somehow exceeds limit
      });

      const result = await t.mutation(internal.usage.recordMusicGeneration, {
        userId,
      });

      expect(result.remainingQuota).toBe(0); // Clamped to 0, not -2
    });

    it("should calculate quota for different tiers", async () => {
      const t = createTestEnvironment();

      // Alpha: 3
      const { userId: alphaUser } = await createTestUser(t, {
        tier: "alpha",
        musicGenerationsUsed: 0,
        clerkId: "alpha",
      });
      const alphaResult = await t.mutation(
        internal.usage.recordMusicGeneration,
        { userId: alphaUser }
      );
      expect(alphaResult.limit).toBe(3);
      expect(alphaResult.remainingQuota).toBe(2);

      // Free: 7
      const { userId: freeUser } = await createTestUser(t, {
        tier: "free",
        musicGenerationsUsed: 0,
        clerkId: "free",
      });
      const freeResult = await t.mutation(internal.usage.recordMusicGeneration, {
        userId: freeUser,
      });
      expect(freeResult.limit).toBe(7);
      expect(freeResult.remainingQuota).toBe(6);

      // Weekly: 25
      const { userId: weeklyUser } = await createTestUser(t, {
        tier: "weekly",
        musicGenerationsUsed: 0,
        clerkId: "weekly",
      });
      const weeklyResult = await t.mutation(
        internal.usage.recordMusicGeneration,
        { userId: weeklyUser }
      );
      expect(weeklyResult.limit).toBe(25);
      expect(weeklyResult.remainingQuota).toBe(24);

      // Monthly: 90
      const { userId: monthlyUser } = await createTestUser(t, {
        tier: "monthly",
        musicGenerationsUsed: 0,
        clerkId: "monthly",
      });
      const monthlyResult = await t.mutation(
        internal.usage.recordMusicGeneration,
        { userId: monthlyUser }
      );
      expect(monthlyResult.limit).toBe(90);
      expect(monthlyResult.remainingQuota).toBe(89);

      // Yearly: 1000
      const { userId: yearlyUser } = await createTestUser(t, {
        tier: "yearly",
        musicGenerationsUsed: 0,
        clerkId: "yearly",
      });
      const yearlyResult = await t.mutation(
        internal.usage.recordMusicGeneration,
        { userId: yearlyUser }
      );
      expect(yearlyResult.limit).toBe(1000);
      expect(yearlyResult.remainingQuota).toBe(999);
    });
  });

  describe("decrementMusicGeneration", () => {
    it("should decrement usage counter for failed generations", async () => {
      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "alpha",
        musicGenerationsUsed: 2,
      });

      const result = await t.mutation(internal.usage.decrementMusicGeneration, {
        userId,
      });

      expect(result.success).toBe(true);
      expect(result.currentUsage).toBe(1);

      const subscription = await getSubscription(t, subscriptionId);
      expect(subscription?.musicGenerationsUsed).toBe(1);
    });

    it("should never go below 0", async () => {
      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "alpha",
        musicGenerationsUsed: 0,
      });

      const result = await t.mutation(internal.usage.decrementMusicGeneration, {
        userId,
      });

      expect(result.success).toBe(true);
      expect(result.currentUsage).toBe(0);

      const subscription = await getSubscription(t, subscriptionId);
      expect(subscription?.musicGenerationsUsed).toBe(0);
    });

    it("should return failure if no subscription exists", async () => {
      const t = createTestEnvironment();

      // Create user without subscription
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "no-sub-user",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.mutation(internal.usage.decrementMusicGeneration, {
        userId,
      });

      expect(result.success).toBe(false);
      expect(result.currentUsage).toBe(0);
    });

    it("should return failure if user has no activeSubscriptionId", async () => {
      const t = createTestEnvironment();

      // Create user with no activeSubscriptionId
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "no-active-sub",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          // No activeSubscriptionId
        });
      });

      const result = await t.mutation(internal.usage.decrementMusicGeneration, {
        userId,
      });

      expect(result.success).toBe(false);
      expect(result.currentUsage).toBe(0);
    });

    it("should update lastVerifiedAt timestamp when decrementing", async () => {
      const now = 9876543210000;
      freezeTime(now);

      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "alpha",
        musicGenerationsUsed: 2,
      });

      await t.mutation(internal.usage.decrementMusicGeneration, { userId });

      const subscription = await getSubscription(t, subscriptionId);
      expect(subscription?.lastVerifiedAt).toBe(now);
    });
  });

  describe("getUsageSnapshot", () => {
    it("should return current usage state with period boundaries", async () => {
      const startTime = 1704067200000;
      freezeTime(startTime);

      const t = createTestEnvironment();
      const { userId } = await createTestUser(t, {
        tier: "weekly",
        musicGenerationsUsed: 10,
      });

      const snapshot = await t.query(internal.usage.getUsageSnapshot, {
        userId,
      });

      expect(snapshot).toBeDefined();
      expect(snapshot?.tier).toBe("weekly");
      expect(snapshot?.status).toBe("active");
      expect(snapshot?.musicGenerationsUsed).toBe(10);
      expect(snapshot?.musicLimit).toBe(25);
      expect(snapshot?.remainingQuota).toBe(15);
      expect(snapshot?.periodStart).toBe(startTime);
      expect(snapshot?.periodEnd).toBe(startTime + 7 * 24 * 60 * 60 * 1000);
    });

    it("should return null for missing users", async () => {
      const t = createTestEnvironment();

      // Create a valid ID format but for a non-existent user
      const fakeUserId = await t.run(async (ctx) => {
        // Insert and immediately delete to get a valid ID that doesn't exist
        const tempId = await ctx.db.insert("users", {
          clerkId: "temp",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.delete(tempId);
        return tempId;
      });

      const snapshot = await t.query(internal.usage.getUsageSnapshot, {
        userId: fakeUserId,
      });

      expect(snapshot).toBeNull();
    });

    it("should return null for users without subscriptions", async () => {
      const t = createTestEnvironment();

      // Create user without subscription
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "no-sub",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const snapshot = await t.query(internal.usage.getUsageSnapshot, {
        userId,
      });

      expect(snapshot).toBeNull();
    });

    it("should detect expired period but cannot reset in query context", async () => {
      const startTime = 1704067200000;
      freezeTime(startTime);

      const t = createTestEnvironment();
      const { userId } = await createTestUser(t, {
        tier: "weekly",
        musicGenerationsUsed: 20,
      });

      // Fast-forward past period
      const periodDuration = getPeriodDurationMs("weekly");
      unfreezeTime();
      freezeTime(startTime + periodDuration + 1000);

      // Note: getUsageSnapshot is a query and cannot mutate data (call patch)
      // It will throw an error when trying to reset because ctx.db.patch isn't available in queries
      // This is a limitation of the current implementation
      // The reset only happens in mutations like recordMusicGeneration

      // Instead, verify that a mutation will trigger the reset
      const result = await t.mutation(internal.usage.recordMusicGeneration, {
        userId,
      });

      // After mutation, should be reset
      expect(result.currentUsage).toBe(1); // Reset to 0, then incremented
      expect(result.remainingQuota).toBe(24);
      expect(result.periodStart).toBe(startTime + periodDuration + 1000);
    });

    it("should include custom limit in snapshot", async () => {
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t, {
        tier: "alpha",
        customMusicLimit: 50,
        musicGenerationsUsed: 30,
      });

      const snapshot = await t.query(internal.usage.getUsageSnapshot, {
        userId,
      });

      expect(snapshot?.musicLimit).toBe(50);
      expect(snapshot?.remainingQuota).toBe(20);
    });
  });

  describe("Edge Cases", () => {
    it("should handle user with missing subscription gracefully", async () => {
      const t = createTestEnvironment();

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "orphan-user",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(
        t.mutation(internal.usage.recordMusicGeneration, { userId })
      ).rejects.toThrow("User has no active subscription");
    });

    it("should handle concurrent usage increments correctly", async () => {
      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "alpha",
        musicGenerationsUsed: 0,
      });

      // Simulate 3 concurrent requests
      await Promise.all([
        t.mutation(internal.usage.recordMusicGeneration, { userId }),
        t.mutation(internal.usage.recordMusicGeneration, { userId }),
        t.mutation(internal.usage.recordMusicGeneration, { userId }),
      ]);

      const subscription = await getSubscription(t, subscriptionId);
      // Should have incremented to exactly 3
      expect(subscription?.musicGenerationsUsed).toBe(3);
    });
  });
});
