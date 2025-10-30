import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * Permanently deletes all data associated with a user.
 * This includes: diaries, music, shared links, subscriptions/usage,
 * call settings/jobs/sessions, and any email notification records.
 * Finally, removes the user document itself.
 */
export async function deleteUserData(ctx: MutationCtx, user: Doc<"users">): Promise<void> {
  const userId: Id<"users"> = user._id;

  // Collect delete operations and run in parallel per collection batch
  const deletions: Promise<unknown>[] = [];

  // Delete shared links created by the user
  const shared = await ctx.db
    .query("sharedMusic")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  deletions.push(...shared.map((doc) => ctx.db.delete(doc._id)));

  // Delete call sessions (history)
  const callSessions = await ctx.db
    .query("callSessions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  deletions.push(...callSessions.map((doc) => ctx.db.delete(doc._id)));

  // Delete call jobs
  const callJobs = await ctx.db
    .query("callJobs")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  deletions.push(...callJobs.map((doc) => ctx.db.delete(doc._id)));

  // Delete call settings
  const callSettings = await ctx.db
    .query("callSettings")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  deletions.push(...callSettings.map((doc) => ctx.db.delete(doc._id)));

  // Delete music owned by the user (hard delete)
  const music = await ctx.db
    .query("music")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  deletions.push(...music.map((doc) => ctx.db.delete(doc._id)));

  // Delete diaries owned by the user
  const diaries = await ctx.db
    .query("diaries")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  deletions.push(...diaries.map((doc) => ctx.db.delete(doc._id)));

  // Delete subscription/usage state
  const subs = await ctx.db
    .query("subscriptionStatuses")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  deletions.push(...subs.map((doc) => ctx.db.delete(doc._id)));

  // Delete any email notification records tied to the user's email
  if (user.email) {
    const emailRecords = await ctx.db
      .query("emailNotify")
      .withIndex("by_email", (q) => q.eq("email", user.email as string))
      .collect();
    deletions.push(...emailRecords.map((doc) => ctx.db.delete(doc._id)));
  }

  await Promise.all(deletions);

  // Finally, delete the user record itself
  await ctx.db.delete(userId);
}
