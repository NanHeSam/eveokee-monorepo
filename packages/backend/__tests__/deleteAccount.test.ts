import { describe, it, expect } from "vitest";
import { api } from "../convex/_generated/api";
import {
  createTestEnvironment,
  createTestUser,
  withAuth,
} from "./convexTestUtils";

describe("Account deletion", () => {
  it("purges all user data and deletes the user document", async () => {
    const t = createTestEnvironment();

    const { clerkId, email, name, userId } = await createTestUser(t);
    const asUser = withAuth(t, clerkId, email, name);

    // Seed: diaries
    const [diaryId1, diaryId2] = await t.run(async (ctx) => {
      const now = Date.now();
      const d1 = await ctx.db.insert("diaries", {
        userId,
        content: "First entry",
        date: now - 1000,
        updatedAt: now - 1000,
      });
      const d2 = await ctx.db.insert("diaries", {
        userId,
        content: "Second entry",
        date: now,
        updatedAt: now,
      });
      return [d1, d2];
    });

    // Seed: music (one linked to diary)
    const [musicId1, musicId2] = await t.run(async (ctx) => {
      const now = Date.now();
      const m1 = await ctx.db.insert("music", {
        userId,
        title: "Track 1",
        status: "ready",
        createdAt: now,
        updatedAt: now,
      });
      const m2 = await ctx.db.insert("music", {
        userId,
        title: "Track 2",
        diaryId: diaryId1,
        status: "ready",
        createdAt: now,
        updatedAt: now,
      });
      return [m1, m2];
    });

    // Seed: shared music link
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("sharedMusic", {
        musicId: musicId1,
        userId,
        shareId: "SHAREID123",
        viewCount: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Seed: call settings, jobs, sessions
    const callSettingsId = await t.run(async (ctx) => {
      const now = Date.now();
      return await ctx.db.insert("callSettings", {
        userId,
        phoneE164: "+15551234567",
        timezone: "America/New_York",
        timeOfDay: "09:00",
        cadence: "daily",
        active: true,
        updatedAt: now,
      });
    });

    const callJobId = await t.run(async (ctx) => {
      const now = Date.now();
      return await ctx.db.insert("callJobs", {
        userId,
        callSettingsId,
        scheduledForUTC: now + 3600000,
        status: "queued",
        attempts: 0,
        updatedAt: now,
      });
    });

    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("callSessions", {
        userId,
        callJobId,
        vapiCallId: "call_123",
        startedAt: now,
      });
    });

    // Seed: emailNotify by email
    await t.run(async (ctx) => {
      await ctx.db.insert("emailNotify", { email });
    });

    // Sanity: records exist
    const preCounts = await t.run(async (ctx) => {
      const diaries = await ctx.db
        .query("diaries")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      const music = await ctx.db
        .query("music")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      const shared = await ctx.db
        .query("sharedMusic")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      const subs = await ctx.db
        .query("subscriptionStatuses")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      const settings = await ctx.db
        .query("callSettings")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      const jobs = await ctx.db
        .query("callJobs")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      const sessions = await ctx.db
        .query("callSessions")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      const emailRecords = await ctx.db
        .query("emailNotify")
        .withIndex("by_email", (q) => q.eq("email", email))
        .collect();
      return {
        diaries: diaries.length,
        music: music.length,
        shared: shared.length,
        subs: subs.length,
        settings: settings.length,
        jobs: jobs.length,
        sessions: sessions.length,
        emailRecords: emailRecords.length,
      };
    });

    expect(preCounts.diaries).toBeGreaterThan(0);
    expect(preCounts.music).toBeGreaterThan(0);
    expect(preCounts.shared).toBeGreaterThan(0);
    expect(preCounts.subs).toBeGreaterThan(0);
    expect(preCounts.settings).toBeGreaterThan(0);
    expect(preCounts.jobs).toBeGreaterThan(0);
    expect(preCounts.sessions).toBeGreaterThan(0);
    expect(preCounts.emailRecords).toBeGreaterThan(0);

    // Execute deletion
    const result = await asUser.mutation((api as any).users.deleteAccount, {});
    expect(result.success).toBe(true);

    // Verify data purge
    await t.run(async (ctx) => {
      const user = await ctx.db.get(userId);
      expect(user).toBeNull();

      const diaries = await ctx.db
        .query("diaries")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      expect(diaries.length).toBe(0);

      const music = await ctx.db
        .query("music")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      expect(music.length).toBe(0);

      const shared = await ctx.db
        .query("sharedMusic")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      expect(shared.length).toBe(0);

      const subs = await ctx.db
        .query("subscriptionStatuses")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      expect(subs.length).toBe(0);

      const settings = await ctx.db
        .query("callSettings")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      expect(settings.length).toBe(0);

      const jobs = await ctx.db
        .query("callJobs")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      expect(jobs.length).toBe(0);

      const sessions = await ctx.db
        .query("callSessions")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      expect(sessions.length).toBe(0);

      const emailRecords = await ctx.db
        .query("emailNotify")
        .withIndex("by_email", (q) => q.eq("email", email))
        .collect();
      expect(emailRecords.length).toBe(0);
    });
  });
});
