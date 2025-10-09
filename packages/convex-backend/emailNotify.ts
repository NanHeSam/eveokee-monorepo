import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const addEmailNotification = mutation({
  args: {
    email: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    // Check if email already exists
    const existingEmail = await ctx.db
      .query("emailNotify")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (existingEmail) {
      throw new Error("Email already exists");
    }

    await ctx.db.insert("emailNotify", {
      email: args.email,
    });

    return args.email;
  },
});

