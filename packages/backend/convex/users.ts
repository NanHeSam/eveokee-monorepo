import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id, Doc } from "./_generated/dataModel";
import { getEffectiveMusicLimit, getPeriodDurationMs, type SubscriptionTier } from "./billing";

export const createUser = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  returns: v.object({
    userId: v.id("users"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      ...(args.email ? { email: args.email } : {}),
      ...(args.name ? { name: args.name } : {}),
      ...(args.tags ? { tags: args.tags } : {}),
      createdAt: now,
      updatedAt: now,
    });

    return { userId };
  },
});

type EnsureCurrentUserResult = {
  userId: Id<"users">;
};

const isMutationCtx = (ctx: MutationCtx | QueryCtx): ctx is MutationCtx => {
  return "runMutation" in ctx;
};

const ensureCurrentUserHandler = async (
  ctx: MutationCtx | QueryCtx,
): Promise<EnsureCurrentUserResult> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthorized");
  }

  const now = Date.now();

  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (existingUser) {
    if (isMutationCtx(ctx)) {
      const updates: Record<string, unknown> = {};

      if (identity.email && identity.email !== existingUser.email) {
        updates.email = identity.email;
      }

      if (identity.name && identity.name !== existingUser.name) {
        updates.name = identity.name;
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = now;
        await ctx.db.patch(existingUser._id, updates);
      }

      if (!existingUser.activeSubscriptionId) {
        await ctx.runMutation(internal.billing.createFreeSubscription, {
          userId: existingUser._id,
        });
      }
    }

    return { userId: existingUser._id };
  }

  if (!isMutationCtx(ctx)) {
    throw new Error("User not found");
  }

  console.warn(
    `No existing user found for clerkId ${identity.subject}, creating new user`,
  );

  const { userId } = await ctx.runMutation(internal.users.createUser, {
    clerkId: identity.subject,
    ...(identity.email ? { email: identity.email } : {}),
    ...(identity.name ? { name: identity.name } : {}),
  });

  // Ensure the new user is enrolled in the free subscription tier
  await ctx.runMutation(internal.billing.createFreeSubscription, {
    userId,
  });

  return { userId };
};

const AUTH_ERROR_MESSAGES = new Set(["Unauthorized", "User not found"]);

export const getOptionalCurrentUser = async (
  ctx: MutationCtx | QueryCtx,
): Promise<EnsureCurrentUserResult | null> => {
  try {
    return await ensureCurrentUserHandler(ctx);
  } catch (error) {
    if (
      error instanceof Error &&
      AUTH_ERROR_MESSAGES.has(error.message)
    ) {
      return null;
    }
    throw error;
  }
};

export const getCurrentUserOrThrow = async (
  ctx: MutationCtx | QueryCtx,
): Promise<Doc<"users">> => {
  const result = await ensureCurrentUserHandler(ctx);
  const user = await ctx.db.get(result.userId);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
};

export const ensureCurrentUser = mutation({
  args: {},
  returns: v.object({
    userId: v.id("users"),
  }),
  handler: ensureCurrentUserHandler,
});

export const getUserProfile = query({
  args: {},
  returns: v.union(
    v.object({
      user: v.object({
        _id: v.id("users"),
        name: v.optional(v.string()),
        email: v.optional(v.string()),
      }),
      subscription: v.union(
        v.object({
          tier: v.string(),
          productId: v.string(),
          status: v.union(
            v.literal("active"),
            v.literal("canceled"),
            v.literal("expired"),
            v.literal("in_grace")
          ),
          musicGenerationsUsed: v.number(),
          musicLimit: v.number(),
          periodStart: v.number(),
          periodEnd: v.number(),
          isActive: v.boolean(),
          remainingQuota: v.number(),
        }),
        v.null()
      ),
      callSettings: v.union(
        v.object({
          _id: v.id("callSettings"),
          phoneE164: v.string(),
          timezone: v.string(),
          timeOfDay: v.string(),
          cadence: v.union(
            v.literal("daily"),
            v.literal("weekdays"),
            v.literal("weekends"),
            v.literal("custom")
          ),
          daysOfWeek: v.optional(v.array(v.number())),
          active: v.boolean(),
        }),
        v.null()
      ),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const authResult = await getOptionalCurrentUser(ctx);
    if (!authResult) {
      return null;
    }
    const { userId } = authResult;

    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    // Fetch subscription
    let subscription = null;
    if (user.activeSubscriptionId) {
      const sub = await ctx.db.get(user.activeSubscriptionId);
      if (sub) {
        const musicLimit = getEffectiveMusicLimit(
          sub.subscriptionTier as SubscriptionTier,
          sub.customMusicLimit ?? undefined
        );
        const isActive =
          sub.status === "active" || sub.status === "in_grace";

        const periodDurationMs = getPeriodDurationMs(
          sub.subscriptionTier as SubscriptionTier
        );

        subscription = {
          tier: sub.subscriptionTier,
          productId: sub.productId,
          status: sub.status,
          musicGenerationsUsed: sub.musicGenerationsUsed,
          musicLimit,
          periodStart: sub.lastResetAt,
          periodEnd: sub.lastResetAt + periodDurationMs,
          isActive,
          remainingQuota: Math.max(0, musicLimit - sub.musicGenerationsUsed),
        };
      }
    }

    // Fetch call settings
    let callSettings = null;
    const settings = await ctx.db
      .query("callSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (settings) {
      callSettings = {
        _id: settings._id,
        phoneE164: settings.phoneE164,
        timezone: settings.timezone,
        timeOfDay: settings.timeOfDay,
        cadence: settings.cadence,
        daysOfWeek: settings.daysOfWeek,
        active: settings.active,
      };
    }

    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
      subscription,
      callSettings,
    };
  },
});

/**
 * Get user by ID (internal - used by VAPI integration)
 */
export const getUserById = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user;
  },
});

export default ensureCurrentUserHandler;

