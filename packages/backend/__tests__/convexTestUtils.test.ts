import { describe, it, expect } from "vitest";
import {
  createTestEnvironment,
  createTestUser,
  createTestDiary,
  withAuth,
  getUser,
  getSubscription,
  getDiary,
} from "./convexTestUtils";

describe("Test Utilities", () => {
  it("should create test environment", () => {
    const t = createTestEnvironment();
    expect(t).toBeDefined();
  });

  it("should create test user with subscription", async () => {
    const t = createTestEnvironment();
    const { userId, subscriptionId, clerkId, email, name } = await createTestUser(t, {
      tier: "alpha",
      musicGenerationsUsed: 2,
    });

    expect(userId).toBeDefined();
    expect(subscriptionId).toBeDefined();
    expect(clerkId).toBeDefined();
    expect(email).toBeDefined();
    expect(name).toBe("Test User");

    // Verify user exists
    const user = await getUser(t, userId);
    expect(user).toBeDefined();
    expect(user?.clerkId).toBe(clerkId);
    expect(user?.email).toBe(email);
    expect(user?.activeSubscriptionId).toBe(subscriptionId);

    // Verify subscription exists
    const subscription = await getSubscription(t, subscriptionId);
    expect(subscription).toBeDefined();
    expect(subscription?.userId).toBe(userId);
    expect(subscription?.subscriptionTier).toBe("alpha");
    expect(subscription?.musicGenerationsUsed).toBe(2);
  });

  it("should create test diary", async () => {
    const t = createTestEnvironment();
    const { userId } = await createTestUser(t);

    const diaryId = await createTestDiary(t, userId, "Test diary content");

    expect(diaryId).toBeDefined();

    const diary = await getDiary(t, diaryId);
    expect(diary).toBeDefined();
    expect(diary?.content).toBe("Test diary content");
    expect(diary?.userId).toBe(userId);
  });

  it("should create authenticated context", async () => {
    const t = createTestEnvironment();
    const { clerkId, email, name } = await createTestUser(t);

    const asUser = withAuth(t, clerkId, email, name);

    expect(asUser).toBeDefined();
  });
});
