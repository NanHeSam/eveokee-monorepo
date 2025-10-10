import {
  internalMutation,
  mutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

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
        await ctx.runMutation(internal.billing.createAlphaSubscription, {
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
  await ctx.runMutation(internal.billing.createAlphaSubscription, {
    userId,
  });

  return { userId };
};

export const ensureCurrentUser = mutation({
  args: {},
  returns: v.object({
    userId: v.id("users"),
  }),
  handler: ensureCurrentUserHandler,
});

export default ensureCurrentUserHandler;


