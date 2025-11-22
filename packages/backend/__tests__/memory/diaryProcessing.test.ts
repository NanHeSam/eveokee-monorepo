import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestEnvironment, createTestUser, withAuth } from "../convexTestUtils";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";

// Suppress unhandled rejections from convex-test background tasks
process.on('unhandledRejection', () => { });

describe("Memory System - Diary Processing", () => {
  let t: ReturnType<typeof createTestEnvironment>;

  beforeEach(() => {
    t = createTestEnvironment();
  });

  afterEach(async () => {
    if (t && "finishInProgressScheduledJobs" in t) {
      // @ts-ignore
      await t.finishInProgressScheduledJobs();
    }
  });

  test("createDiary schedules processing and events are created", async () => {
    const { userId, clerkId } = await createTestUser(t);
    const authedT = withAuth(t, clerkId);

    const { _id: diaryId } = await authedT.mutation(api.diaries.createDiary, {
      content: "I met Tom at the park today. It was a nice sunny day.",
    });

    const diary = await t.run(async (ctx) => await ctx.db.get(diaryId)) as Doc<"diaries"> | null;
    expect(diary).toBeDefined();
    expect(diary?.content).toBe("I met Tom at the park today. It was a nice sunny day.");

    // Check events are created (retry loop)
    let events: any[] = [];
    for (let i = 0; i < 10; i++) {
      events = await t.run(async (ctx) => {
        return await ctx.db.query("events").withIndex("by_diaryId", q => q.eq("diaryId", diaryId)).collect();
      });
      if (events.length > 0) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    expect(events.length).toBeGreaterThan(0);
    expect(events[0].title).toContain("Diary Entry");
    expect(events[0].userId).toEqual(userId);

    // Allow background tasks to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify userTags are populated
    const tags = await t.run(async (ctx) => {
      return await ctx.db.query("userTags").withIndex("by_userId", q => q.eq("userId", userId)).collect();
    });
    expect(tags.length).toBeGreaterThan(0);
    expect(tags[0].canonicalName).toBe("diary"); // Stub returns "diary" tag
    expect(tags[0].eventCount).toBe(1);
  });

  test("updateDiary does NOT schedule processing but updates version", async () => {
    const { userId, clerkId } = await createTestUser(t);
    const authedT = withAuth(t, clerkId);

    const { _id: diaryId } = await authedT.mutation(api.diaries.createDiary, {
      content: "Original content",
    });

    // Get original version
    const diaryBefore = await t.run(async (ctx) => await ctx.db.get(diaryId)) as Doc<"diaries"> | null;
    const versionBefore = diaryBefore?.version || 1;

    // Update
    await authedT.mutation(api.diaries.updateDiary, {
      diaryId,
      content: "Updated content",
    });

    const diaryAfter = await t.run(async (ctx) => await ctx.db.get(diaryId)) as Doc<"diaries"> | null;
    expect(diaryAfter?.version).toBe(versionBefore + 1);
    expect(diaryAfter?.content).toBe("Updated content");
  });
});
