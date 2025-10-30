import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const addEmailNotification = mutation({
  args: {
    email: v.string(),
    isAndroidInvite: v.optional(v.boolean()),
    source: v.optional(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.trim().toLowerCase();
    
    // Check if email already exists
    const existingEmail = await ctx.db
      .query("emailNotify")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();

    if (existingEmail) {
      if (args.isAndroidInvite) {
        await ctx.db.patch(existingEmail._id, {
          isAndroidInvite: true,
          source: args.source,
          androidRequestedAt: Date.now(),
        });
      }
      return normalizedEmail;
    }

    await ctx.db.insert("emailNotify", {
      email: normalizedEmail,
      isAndroidInvite: args.isAndroidInvite,
      source: args.source,
      androidRequestedAt: args.isAndroidInvite ? Date.now() : undefined,
    });

    return normalizedEmail;
  },
});

