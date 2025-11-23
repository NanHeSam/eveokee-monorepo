import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import {
  createTestEnvironment,
  createTestUser,
  withAuth,
} from "./convexTestUtils";

describe("diaries.deleteDiary", () => {
  let t: ReturnType<typeof createTestEnvironment>;

  beforeEach(() => {
    t = createTestEnvironment();
  });

  afterEach(async () => {
    if (t && "finishInProgressScheduledJobs" in t) {
      // @ts-ignore - convex-test exposes this helper at runtime
      await t.finishInProgressScheduledJobs();
    }
  });

  it("removes associated events when diary is deleted", async () => {
    const { userId, clerkId } = await createTestUser(t);
    const authedT = withAuth(t, clerkId);

    const { _id: diaryId } = await authedT.mutation(api.diaries.createDiary, {
      content: "A diary entry that references events",
    });

    const happenedAt = Date.now();
    const eventId = await t.run(async (ctx) => {
      return await ctx.db.insert("events", {
        userId,
        diaryId,
        happenedAt,
        title: "Test Event",
        summary: "Details about the event",
      });
    });

    await authedT.mutation(api.diaries.deleteDiary, {
      diaryId,
    });

    const deletedDiary = await t.run(async (ctx) => ctx.db.get(diaryId));
    expect(deletedDiary).toBeNull();

    const deletedEvent = await t.run(async (ctx) => ctx.db.get(eventId));
    expect(deletedEvent).toBeNull();
  });
});

