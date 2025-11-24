import { v } from "convex/values";
import { query } from "./_generated/server";

export const getUserFlags = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    let userId = args.userId;

    // If no userId provided, try to get from auth
    if (!userId) {
      const identity = await ctx.auth.getUserIdentity();
      if (identity) {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
          .unique();
        if (user) {
          userId = user._id;
        }
      }
    }

    // If still no userId, return empty/false for all
    if (!userId) {
      return {};
    }

    // Fetch all feature flags
    const flags = await ctx.db.query("featureFlags").collect();

    const result: Record<string, boolean> = {};

    for (const flag of flags) {
      const { flagKey, allowUserIds, denyUserIds, rolloutPercentage } = flag;

      // 1. Explicitly denied
      if (denyUserIds.includes(userId)) {
        result[flagKey] = false;
        continue;
      }

      // 2. Explicitly allowed
      if (allowUserIds.includes(userId)) {
        result[flagKey] = true;
        continue;
      }

      // 3. Percentage rollout
      // Use a deterministic hash of the user ID + flag key to decide
      const hash = simpleHash(`${userId}-${flagKey}`);
      const normalizedHash = hash % 100;

      result[flagKey] = normalizedHash < rolloutPercentage;
    }

    return result;
  },
});

// Simple DJB2-like hash function for deterministic rollout
function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}
