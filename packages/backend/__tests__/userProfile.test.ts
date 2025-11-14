import { describe, it, expect } from "vitest";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { createTestEnvironment, withAuth } from "./convexTestUtils";

describe("getUserProfile", () => {
  const createT = () => createTestEnvironment();

  it("returns null when user is not authenticated", async () => {
    const t = createT();
    const result = await t.query(api.users.getUserProfile, {});
    expect(result).toBeNull();
  });

  it("returns user profile with subscription but no call settings", async () => {
    const t = createT();
    const clerkId = "user_test123";
    const email = "test@example.com";
    const name = "Test User";

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId,
        email,
        name,
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
    });

    const asUser = withAuth(t, clerkId, email, name);
    const result = await asUser.query(api.users.getUserProfile, {});

    expect(result).toBeDefined();
    expect(result?.user.name).toBe("Test User");
    expect(result?.user.email).toBe("test@example.com");
    expect(result?.subscription).toBeDefined();
    expect(result?.subscription?.tier).toBe("free");
    expect(result?.subscription?.status).toBe("active");
    expect(result?.subscription?.musicGenerationsUsed).toBe(5);
    expect(result?.subscription?.musicLimit).toBe(5); // Free tier default
    expect(result?.callSettings).toBeNull();
  });

  it("returns user profile with call settings", async () => {
    const t = createT();
    const clerkId = "user_test456";
    const email = "test2@example.com";
    const name = "Test User 2";

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId,
        email,
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const subscriptionId = await ctx.db.insert("subscriptionStatuses", {
        userId,
        platform: "stripe",
        productId: "yearly-tier",
        status: "active",
        subscriptionTier: "yearly",
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
    });

    const asUser = withAuth(t, clerkId, email, name);
    const result = await asUser.query(api.users.getUserProfile, {});

    expect(result).toBeDefined();
    expect(result?.user.name).toBe("Test User 2");
    expect(result?.subscription).toBeDefined();
    expect(result?.subscription?.tier).toBe("yearly");
    expect(result?.callSettings).toBeDefined();
    expect(result?.callSettings?.phoneE164).toBe("+12125551234");
    expect(result?.callSettings?.timezone).toBe("America/New_York");
    expect(result?.callSettings?.timeOfDay).toBe("09:00");
    expect(result?.callSettings?.cadence).toBe("daily");
    expect(result?.callSettings?.active).toBe(true);
  });

  it("returns user profile with custom cadence settings", async () => {
    const t = createT();
    const clerkId = "user_test789";
    const email = "test3@example.com";
    const name = "Test User 3";

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId,
        email,
        name,
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
    });

    const asUser = withAuth(t, clerkId, email, name);
    const result = await asUser.query(api.users.getUserProfile, {});

    expect(result).toBeDefined();
    expect(result?.callSettings).toBeDefined();
    expect(result?.callSettings?.cadence).toBe("custom");
    expect(result?.callSettings?.daysOfWeek).toEqual([1, 3, 5]);
  });

  it("handles inactive call settings", async () => {
    const t = createT();
    const clerkId = "user_test000";
    const email = "test4@example.com";
    const name = "Test User 4";

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId,
        email,
        name,
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
    });

    const asUser = withAuth(t, clerkId, email, name);
    const result = await asUser.query(api.users.getUserProfile, {});

    expect(result).toBeDefined();
    expect(result?.callSettings).toBeDefined();
    expect(result?.callSettings?.active).toBe(false);
    expect(result?.callSettings?.cadence).toBe("weekdays");
  });

  it("calculates subscription metrics correctly for yearly tier", async () => {
    const t = createT();
    const clerkId = "user_yearly";
    const email = "yearly@example.com";
    const name = "Yearly User";
    const now = Date.now();

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId,
        email,
        name,
        createdAt: now,
        updatedAt: now,
      });

      const subscriptionId = await ctx.db.insert("subscriptionStatuses", {
        userId,
        platform: "stripe",
        productId: "yearly-tier",
        status: "active",
        subscriptionTier: "yearly",
        lastResetAt: now - 10 * 24 * 60 * 60 * 1000, // 10 days ago
        musicGenerationsUsed: 100,
        lastVerifiedAt: now,
      });

      await ctx.db.patch(userId, { activeSubscriptionId: subscriptionId });
    });

    const asUser = withAuth(t, clerkId, email, name);
    const result = await asUser.query(api.users.getUserProfile, {});

    expect(result).toBeDefined();
    expect(result?.subscription).toBeDefined();
    expect(result?.subscription?.tier).toBe("yearly");
    expect(result?.subscription?.musicLimit).toBe(100); // Yearly tier monthly credit (1200 / 12 rounded up)
    expect(result?.subscription?.remainingQuota).toBe(0); // 100 - 100 used = 0 (clamped)
    expect(result?.subscription?.isActive).toBe(true);
  });

  it("handles canceled subscription status", async () => {
    const t = createT();
    const clerkId = "user_canceled";
    const email = "canceled@example.com";
    const name = "Canceled User";

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId,
        email,
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const subscriptionId = await ctx.db.insert("subscriptionStatuses", {
        userId,
        platform: "stripe",
        productId: "monthly-tier",
        status: "canceled",
        subscriptionTier: "monthly",
        lastResetAt: Date.now(),
        musicGenerationsUsed: 20,
        lastVerifiedAt: Date.now(),
      });

      await ctx.db.patch(userId, { activeSubscriptionId: subscriptionId });
    });

    const asUser = withAuth(t, clerkId, email, name);
    const result = await asUser.query(api.users.getUserProfile, {});

    expect(result).toBeDefined();
    expect(result?.subscription).toBeDefined();
    expect(result?.subscription?.status).toBe("canceled");
    expect(result?.subscription?.isActive).toBe(false);
  });

  it("returns null subscription when user has no active subscription", async () => {
    const t = createT();
    const clerkId = "user_nosub";
    const email = "nosub@example.com";
    const name = "No Sub User";

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkId,
        email,
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const asUser = withAuth(t, clerkId, email, name);
    const result = await asUser.query(api.users.getUserProfile, {});

    expect(result).toBeDefined();
    expect(result?.user.name).toBe("No Sub User");
    expect(result?.subscription).toBeNull();
    expect(result?.callSettings).toBeNull();
  });
});
