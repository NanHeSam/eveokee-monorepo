import { convexTest } from "convex-test";
import { vi } from "vitest";
import schema from "../convex/schema";
import { Id } from "../convex/_generated/dataModel";

/**
 * Initialize a new convex-test environment with the schema
 */
export function createTestEnvironment() {
  // Provide the path to convex modules explicitly for monorepo setup
  return convexTest(schema, import.meta.glob("../convex/**/*.*s"));
}

/**
 * Helper to create a test user with subscription
 *
 * @param t - The convex-test instance
 * @param options - Configuration options for the user and subscription
 * @returns Object containing userId, subscriptionId, clerkId, email, name
 */
export async function createTestUser(
  t: ReturnType<typeof convexTest>,
  options?: {
    clerkId?: string;
    email?: string;
    name?: string;
    tier?: "free" | "weekly" | "monthly" | "yearly";
    musicGenerationsUsed?: number;
    customMusicLimit?: number;
    tags?: string[];
  }
) {
  const clerkId = options?.clerkId ?? `test-clerk-${Date.now()}-${Math.random()}`;
  const email = options?.email ?? `test-${Date.now()}-${Math.random()}@example.com`;
  const name = options?.name ?? "Test User";
  const tier = options?.tier ?? "free";
  const tags = options?.tags ?? [];

  return await t.run(async (ctx) => {
    const now = Date.now();

    // Create user
    const userId = await ctx.db.insert("users", {
      clerkId,
      email,
      name,
      ...(tags.length > 0 ? { tags } : {}),
      createdAt: now,
      updatedAt: now,
    });

    // Create subscription
    const subscriptionId = await ctx.db.insert("subscriptionStatuses", {
      userId,
      platform: "clerk",
      productId: tier === "free" ? "free-tier" : `${tier}-plan`,
      status: "active",
      subscriptionTier: tier,
      lastResetAt: now,
      musicGenerationsUsed: options?.musicGenerationsUsed ?? 0,
      lastVerifiedAt: now,
      ...(options?.customMusicLimit !== undefined ? { customMusicLimit: options.customMusicLimit } : {}),
    });

    // Link subscription to user
    await ctx.db.patch(userId, {
      activeSubscriptionId: subscriptionId,
      updatedAt: now,
    });

    return { userId, subscriptionId, clerkId, email, name };
  });
}

/**
 * Helper to create a test diary
 *
 * @param t - The convex-test instance
 * @param userId - The user ID to associate the diary with
 * @param content - The diary content
 * @param options - Additional options like date
 * @returns The diary ID
 */
export async function createTestDiary(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  content: string,
  options?: { date?: number; title?: string }
) {
  return await t.run(async (ctx) => {
    const now = options?.date ?? Date.now();
    const diaryId = await ctx.db.insert("diaries", {
      userId,
      content,
      date: now,
      updatedAt: now,
      ...(options?.title ? { title: options.title } : {}),
    });
    return diaryId;
  });
}

/**
 * Helper to create authenticated context for testing
 *
 * @param t - The convex-test instance
 * @param clerkId - The Clerk ID to authenticate as (subject)
 * @param email - Optional email for the identity
 * @param name - Optional name for the identity
 * @returns A new test instance with the identity attached
 */
export function withAuth(
  t: ReturnType<typeof convexTest>,
  clerkId: string,
  email?: string,
  name?: string
) {
  return t.withIdentity({
    subject: clerkId,
    ...(email ? { email } : {}),
    ...(name ? { name } : {}),
  });
}

/**
 * Freeze time for deterministic tests
 * Uses Vitest's fake timers to control Date.now()
 *
 * @param timestamp - The timestamp to freeze at (milliseconds since epoch)
 */
export function freezeTime(timestamp: number) {
  vi.useFakeTimers();
  vi.setSystemTime(timestamp);
}

/**
 * Restore real timers after using freezeTime
 */
export function unfreezeTime() {
  vi.useRealTimers();
}

/**
 * Helper to get all records for a taskId
 *
 * @param t - The convex-test instance
 * @param taskId - The task ID to query
 * @returns Array of music records
 */
export async function getMusicRecordsByTaskId(
  t: ReturnType<typeof convexTest>,
  taskId: string
) {
  return await t.run(async (ctx) => {
    return await ctx.db
      .query("music")
      // @ts-expect-error - Convex index types are runtime-validated, not compile-time
      .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
      .collect();
  });
}

/**
 * Helper to get subscription by ID
 *
 * @param t - The convex-test instance
 * @param subscriptionId - The subscription ID
 * @returns The subscription record or null
 */
export async function getSubscription(
  t: ReturnType<typeof convexTest>,
  subscriptionId: Id<"subscriptionStatuses">
) {
  return await t.run(async (ctx) => {
    return await ctx.db.get(subscriptionId);
  });
}

/**
 * Helper to get user by ID
 *
 * @param t - The convex-test instance
 * @param userId - The user ID
 * @returns The user record or null
 */
export async function getUser(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">
) {
  return await t.run(async (ctx) => {
    return await ctx.db.get(userId);
  });
}

/**
 * Helper to get diary by ID
 *
 * @param t - The convex-test instance
 * @param diaryId - The diary ID
 * @returns The diary record or null
 */
export async function getDiary(
  t: ReturnType<typeof convexTest>,
  diaryId: Id<"diaries">
) {
  return await t.run(async (ctx) => {
    return await ctx.db.get(diaryId);
  });
}
