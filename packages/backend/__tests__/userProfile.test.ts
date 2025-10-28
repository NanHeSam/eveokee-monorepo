import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { Id } from "../convex/_generated/dataModel";

describe("getUserProfile", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    t = convexTest(schema);
  });

  it("returns null when user is not authenticated", async () => {
    const result = await t.query(api.users.getUserProfile, {});
    expect(result).toBeNull();
  });

  it("returns user profile with subscription but no call settings", async () => {
    const userId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "user_test123",
        email: "test@example.com",
        name: "Test User",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const subscriptionId = await ctx.db.insert("subscriptionStatuses", {
        userId,
        platform: "clerk",
        productId: "free-tier",
        status: "active",
        subscriptionTier: "free",
        lastResetAt: Date.now(),
        musicGenerationsUsed: 5,
        lastVerifiedAt: Date.now(),
      });

      await ctx.db.patch(userId, { activeSubscriptionId: subscriptionId });

      return userId;
    });

    const result = await t.query(api.users.getUserProfile, {}, userId);

    expect(result).toBeDefined();
    expect(result?.user.name).toBe("Test User");
    expect(result?.user.email).toBe("test@example.com");
    expect(result?.subscription).toBeDefined();
    expect(result?.subscription?.tier).toBe("free");
    expect(result?.subscription?.status).toBe("active");
    expect(result?.subscription?.musicGenerationsUsed).toBe(5);
    expect(result?.subscription?.musicLimit).toBe(10); // Free tier default
    expect(result?.callSettings).toBeNull();
  });

  it("returns user profile with call settings", async () => {
    const userId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "user_test456",
        email: "test2@example.com",
        name: "Test User 2",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const subscriptionId = await ctx.db.insert("subscriptionStatuses", {
        userId,
        platform: "stripe",
        productId: "premium-tier",
        status: "active",
        subscriptionTier: "premium",
        lastResetAt: Date.now(),
        musicGenerationsUsed: 50,
        lastVerifiedAt: Date.now(),
      });

      await ctx.db.patch(userId, { activeSubscriptionId: subscriptionId });

      await ctx.db.insert("callSettings", {
        userId,
        phoneE164: "+12125551234",
        timezone: "America/New_York",
        timeOfDay: "09:00",
        cadence: "daily",
        active: true,
        updatedAt: Date.now(),
      });

      return userId;
    });

    const result = await t.query(api.users.getUserProfile, {}, userId);

    expect(result).toBeDefined();
    expect(result?.user.name).toBe("Test User 2");
    expect(result?.subscription).toBeDefined();
    expect(result?.subscription?.tier).toBe("premium");
    expect(result?.callSettings).toBeDefined();
    expect(result?.callSettings?.phoneE164).toBe("+12125551234");
    expect(result?.callSettings?.timezone).toBe("America/New_York");
    expect(result?.callSettings?.timeOfDay).toBe("09:00");
    expect(result?.callSettings?.cadence).toBe("daily");
    expect(result?.callSettings?.active).toBe(true);
  });

  it("returns user profile with custom cadence settings", async () => {
    const userId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "user_test789",
        email: "test3@example.com",
        name: "Test User 3",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const subscriptionId = await ctx.db.insert("subscriptionStatuses", {
        userId,
        platform: "clerk",
        productId: "free-tier",
        status: "active",
        subscriptionTier: "free",
        lastResetAt: Date.now(),
        musicGenerationsUsed: 0,
        lastVerifiedAt: Date.now(),
      });

      await ctx.db.patch(userId, { activeSubscriptionId: subscriptionId });

      await ctx.db.insert("callSettings", {
        userId,
        phoneE164: "+14155551234",
        timezone: "America/Los_Angeles",
        timeOfDay: "14:30",
        cadence: "custom",
        daysOfWeek: [1, 3, 5], // Monday, Wednesday, Friday
        active: true,
        updatedAt: Date.now(),
      });

      return userId;
    });

    const result = await t.query(api.users.getUserProfile, {}, userId);

    expect(result).toBeDefined();
    expect(result?.callSettings).toBeDefined();
    expect(result?.callSettings?.cadence).toBe("custom");
    expect(result?.callSettings?.daysOfWeek).toEqual([1, 3, 5]);
  });

  it("handles inactive call settings", async () => {
    const userId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "user_test000",
        email: "test4@example.com",
        name: "Test User 4",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const subscriptionId = await ctx.db.insert("subscriptionStatuses", {
        userId,
        platform: "clerk",
        productId: "free-tier",
        status: "active",
        subscriptionTier: "free",
        lastResetAt: Date.now(),
        musicGenerationsUsed: 0,
        lastVerifiedAt: Date.now(),
      });

      await ctx.db.patch(userId, { activeSubscriptionId: subscriptionId });

      await ctx.db.insert("callSettings", {
        userId,
        phoneE164: "+16505551234",
        timezone: "America/Phoenix",
        timeOfDay: "10:00",
        cadence: "weekdays",
        active: false, // Inactive
        updatedAt: Date.now(),
      });

      return userId;
    });

    const result = await t.query(api.users.getUserProfile, {}, userId);

    expect(result).toBeDefined();
    expect(result?.callSettings).toBeDefined();
    expect(result?.callSettings?.active).toBe(false);
    expect(result?.callSettings?.cadence).toBe("weekdays");
  });

  it("calculates subscription metrics correctly for premium tier", async () => {
    const now = Date.now();
    const userId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "user_premium",
        email: "premium@example.com",
        name: "Premium User",
        createdAt: now,
        updatedAt: now,
      });

      const subscriptionId = await ctx.db.insert("subscriptionStatuses", {
        userId,
        platform: "stripe",
        productId: "premium-tier",
        status: "active",
        subscriptionTier: "premium",
        lastResetAt: now - 10 * 24 * 60 * 60 * 1000, // 10 days ago
        musicGenerationsUsed: 100,
        lastVerifiedAt: now,
      });

      await ctx.db.patch(userId, { activeSubscriptionId: subscriptionId });

      return userId;
    });

    const result = await t.query(api.users.getUserProfile, {}, userId);

    expect(result).toBeDefined();
    expect(result?.subscription).toBeDefined();
    expect(result?.subscription?.tier).toBe("premium");
    expect(result?.subscription?.musicLimit).toBe(9007199254740991); // Effectively unlimited
    expect(result?.subscription?.remainingQuota).toBe(9007199254740991);
    expect(result?.subscription?.isActive).toBe(true);
  });

  it("handles canceled subscription status", async () => {
    const userId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "user_canceled",
        email: "canceled@example.com",
        name: "Canceled User",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const subscriptionId = await ctx.db.insert("subscriptionStatuses", {
        userId,
        platform: "stripe",
        productId: "premium-tier",
        status: "canceled",
        subscriptionTier: "premium",
        lastResetAt: Date.now(),
        musicGenerationsUsed: 20,
        lastVerifiedAt: Date.now(),
      });

      await ctx.db.patch(userId, { activeSubscriptionId: subscriptionId });

      return userId;
    });

    const result = await t.query(api.users.getUserProfile, {}, userId);

    expect(result).toBeDefined();
    expect(result?.subscription).toBeDefined();
    expect(result?.subscription?.status).toBe("canceled");
    expect(result?.subscription?.isActive).toBe(false);
  });

  it("returns null subscription when user has no active subscription", async () => {
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "user_nosub",
        email: "nosub@example.com",
        name: "No Sub User",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.query(api.users.getUserProfile, {}, userId);

    expect(result).toBeDefined();
    expect(result?.user.name).toBe("No Sub User");
    expect(result?.subscription).toBeNull();
    expect(result?.callSettings).toBeNull();
  });
});

