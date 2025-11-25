import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { api } from "../convex/_generated/api";
import {
  createTestEnvironment,
  withAuth,
  createTestUser,
  createTestDiary,
  freezeTime,
  unfreezeTime,
} from "./convexTestUtils";
import { Id } from "../convex/_generated/dataModel";

describe("events.updateEvent", () => {
  const createT = () => createTestEnvironment();
  const FROZEN_TIME = 1000000000000; // Fixed timestamp for deterministic tests

  beforeEach(() => {
    freezeTime(FROZEN_TIME);
  });

  afterEach(() => {
    unfreezeTime();
  });

  async function createTestEvent(
    t: ReturnType<typeof createTestEnvironment>,
    userId: Id<"users">,
    diaryId: Id<"diaries">,
    options?: {
      title?: string;
      summary?: string;
      mood?: -2 | -1 | 0 | 1 | 2;
      arousal?: 1 | 2 | 3 | 4 | 5;
      tagIds?: Id<"userTags">[];
      personIds?: Id<"people">[];
    }
  ) {
    return await t.run(async (ctx) => {
      return await ctx.db.insert("events", {
        userId,
        diaryId,
        happenedAt: FROZEN_TIME,
        title: options?.title ?? "Test Event",
        summary: options?.summary ?? "Test summary",
        mood: options?.mood,
        arousal: options?.arousal,
        tagIds: options?.tagIds,
        personIds: options?.personIds,
      });
    });
  }

  async function createTestTag(
    t: ReturnType<typeof createTestEnvironment>,
    userId: Id<"users">,
    canonicalName: string,
    options?: {
      eventCount?: number;
      lastUsedAt?: number;
    }
  ) {
    return await t.run(async (ctx) => {
      return await ctx.db.insert("userTags", {
        userId,
        canonicalName,
        displayName: canonicalName,
        eventCount: options?.eventCount ?? 0,
        lastUsedAt: options?.lastUsedAt ?? FROZEN_TIME,
      });
    });
  }

  async function createTestPerson(
    t: ReturnType<typeof createTestEnvironment>,
    userId: Id<"users">,
    primaryName: string,
    options?: {
      interactionCount?: number;
      lastMentionedAt?: number;
    }
  ) {
    return await t.run(async (ctx) => {
      return await ctx.db.insert("people", {
        userId,
        primaryName,
        interactionCount: options?.interactionCount ?? 0,
        lastMentionedAt: options?.lastMentionedAt ?? FROZEN_TIME,
      });
    });
  }

  describe("basic field updates", () => {
    it("updates title", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const eventId = await createTestEvent(t, userId, diaryId, { title: "Old Title" });

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        title: "New Title",
      });

      const event = await t.run(async (ctx) => await ctx.db.get(eventId));
      expect(event?.title).toBe("New Title");
    });

    it("updates summary", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const eventId = await createTestEvent(t, userId, diaryId, { summary: "Old summary" });

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        summary: "New summary",
      });

      const event = await t.run(async (ctx) => await ctx.db.get(eventId));
      expect(event?.summary).toBe("New summary");
    });

    it("updates mood", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const eventId = await createTestEvent(t, userId, diaryId, { mood: -1 });

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        mood: 1,
      });

      const event = await t.run(async (ctx) => await ctx.db.get(eventId));
      expect(event?.mood).toBe(1);
    });

    it("updates arousal", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const eventId = await createTestEvent(t, userId, diaryId, { arousal: 2 });

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        arousal: 4,
      });

      const event = await t.run(async (ctx) => await ctx.db.get(eventId));
      expect(event?.arousal).toBe(4);
    });

    it("updates multiple fields at once", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const eventId = await createTestEvent(t, userId, diaryId, {
        title: "Old",
        summary: "Old summary",
        mood: -1,
        arousal: 2,
      });

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        title: "New",
        summary: "New summary",
        mood: 1,
        arousal: 4,
      });

      const event = await t.run(async (ctx) => await ctx.db.get(eventId));
      expect(event?.title).toBe("New");
      expect(event?.summary).toBe("New summary");
      expect(event?.mood).toBe(1);
      expect(event?.arousal).toBe(4);
    });
  });

  describe("tag scenarios", () => {
    it("creates new tags when adding tags to event without tags", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const eventId = await createTestEvent(t, userId, diaryId);

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        tags: ["work", "meeting"],
      });

      const event = await t.run(async (ctx) => await ctx.db.get(eventId));
      expect(event?.tagIds).toHaveLength(2);

      // Verify tags were created with correct properties
      const tags = await t.run(async (ctx) => {
        if (!event?.tagIds) return [];
        return Promise.all(event.tagIds.map((id) => ctx.db.get(id)));
      });

      expect(tags).toHaveLength(2);
      expect(tags[0]?.canonicalName).toBe("work");
      expect(tags[0]?.eventCount).toBe(1);
      expect(tags[1]?.canonicalName).toBe("meeting");
      expect(tags[1]?.eventCount).toBe(1);
    });

    it("uses existing tags when adding tags that already exist", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const existingTagId = await createTestTag(t, userId, "work", { eventCount: 2 });
      const eventId = await createTestEvent(t, userId, diaryId);

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        tags: ["work"],
      });

      const event = await t.run(async (ctx) => await ctx.db.get(eventId));
      expect(event?.tagIds).toEqual([existingTagId]);

      // Verify eventCount was incremented
      const tag = await t.run(async (ctx) => await ctx.db.get(existingTagId));
      expect(tag?.eventCount).toBe(3);
    });

    it("decrements eventCount when removing tags", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const tag1Id = await createTestTag(t, userId, "work", { eventCount: 3 });
      const tag2Id = await createTestTag(t, userId, "meeting", { eventCount: 2 });
      const eventId = await createTestEvent(t, userId, diaryId, {
        tagIds: [tag1Id, tag2Id],
      });

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        tags: ["work"], // Remove "meeting"
      });

      const event = await t.run(async (ctx) => await ctx.db.get(eventId));
      expect(event?.tagIds).toEqual([tag1Id]);

      // Verify eventCounts were updated
      const tag1 = await t.run(async (ctx) => await ctx.db.get(tag1Id));
      const tag2 = await t.run(async (ctx) => await ctx.db.get(tag2Id));
      expect(tag1?.eventCount).toBe(3); // Kept, so unchanged
      expect(tag2?.eventCount).toBe(1); // Decremented from 2
    });

    it("replaces tags correctly (removes old, adds new)", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const oldTagId = await createTestTag(t, userId, "work", { eventCount: 2 });
      const newTagId = await createTestTag(t, userId, "personal", { eventCount: 1 });
      const eventId = await createTestEvent(t, userId, diaryId, {
        tagIds: [oldTagId],
      });

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        tags: ["personal"],
      });

      const event = await t.run(async (ctx) => await ctx.db.get(eventId));
      expect(event?.tagIds).toEqual([newTagId]);

      // Verify eventCounts
      const oldTag = await t.run(async (ctx) => await ctx.db.get(oldTagId));
      const newTag = await t.run(async (ctx) => await ctx.db.get(newTagId));
      expect(oldTag?.eventCount).toBe(1); // Decremented
      expect(newTag?.eventCount).toBe(2); // Incremented
    });

    it("handles empty tags array", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const tagId = await createTestTag(t, userId, "work", { eventCount: 2 });
      const eventId = await createTestEvent(t, userId, diaryId, {
        tagIds: [tagId],
      });

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        tags: [],
      });

      const event = await t.run(async (ctx) => await ctx.db.get(eventId));
      expect(event?.tagIds).toBeUndefined();

      // Verify eventCount was decremented
      const tag = await t.run(async (ctx) => await ctx.db.get(tagId));
      expect(tag?.eventCount).toBe(1);
    });

    it("normalizes tag names (lowercase, trimmed)", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const eventId = await createTestEvent(t, userId, diaryId);

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        tags: ["  WORK  ", "Meeting"],
      });

      const event = await t.run(async (ctx) => await ctx.db.get(eventId));
      expect(event?.tagIds).toHaveLength(2);

      const tags = await t.run(async (ctx) => {
        if (!event?.tagIds) return [];
        return Promise.all(event.tagIds.map((id) => ctx.db.get(id)));
      });

      expect(tags[0]?.canonicalName).toBe("work");
      expect(tags[1]?.canonicalName).toBe("meeting");
    });

    it("does not increment eventCount for newly created tags", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const eventId = await createTestEvent(t, userId, diaryId);

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        tags: ["newtag"],
      });

      const event = await t.run(async (ctx) => await ctx.db.get(eventId));
      const tagId = event?.tagIds?.[0];
      expect(tagId).toBeDefined();

      const tag = await t.run(async (ctx) => await ctx.db.get(tagId!));
      expect(tag?.eventCount).toBe(1); // Set during creation, not incremented
    });

    it("updates lastUsedAt for existing tags that are added", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const oldTime = FROZEN_TIME - 1000000;
      const tagId = await createTestTag(t, userId, "work", {
        eventCount: 1,
        lastUsedAt: oldTime,
      });
      const eventId = await createTestEvent(t, userId, diaryId);

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        tags: ["work"],
      });

      const tag = await t.run(async (ctx) => await ctx.db.get(tagId));
      expect(tag?.lastUsedAt).toBeGreaterThan(oldTime);
    });

    it("clamps eventCount to 0 when decrementing", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const tagId = await createTestTag(t, userId, "work", { eventCount: 0 });
      const eventId = await createTestEvent(t, userId, diaryId, {
        tagIds: [tagId],
      });

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        tags: [],
      });

      const tag = await t.run(async (ctx) => await ctx.db.get(tagId));
      expect(tag?.eventCount).toBe(0); // Clamped, not negative
    });
  });

  describe("people scenarios", () => {
    it("creates new people when adding people to event without people", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const eventId = await createTestEvent(t, userId, diaryId);

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        peopleNames: ["Alice", "Bob"],
      });

      const event = await t.run(async (ctx) => await ctx.db.get(eventId));
      expect(event?.personIds).toHaveLength(2);

      // Verify people were created with correct properties
      const people = await t.run(async (ctx) => {
        if (!event?.personIds) return [];
        return Promise.all(event.personIds.map((id) => ctx.db.get(id)));
      });

      expect(people).toHaveLength(2);
      expect(people[0]?.primaryName).toBe("Alice");
      expect(people[0]?.interactionCount).toBe(1);
      expect(people[1]?.primaryName).toBe("Bob");
      expect(people[1]?.interactionCount).toBe(1);
    });

    it("uses existing people when adding people that already exist", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const existingPersonId = await createTestPerson(t, userId, "Alice", {
        interactionCount: 2,
      });
      const eventId = await createTestEvent(t, userId, diaryId);

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        peopleNames: ["Alice"],
      });

      const event = await t.run(async (ctx) => await ctx.db.get(eventId));
      expect(event?.personIds).toEqual([existingPersonId]);

      // Verify interactionCount was incremented
      const person = await t.run(async (ctx) => await ctx.db.get(existingPersonId));
      expect(person?.interactionCount).toBe(3);
    });

    it("decrements interactionCount when removing people", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const person1Id = await createTestPerson(t, userId, "Alice", {
        interactionCount: 3,
      });
      const person2Id = await createTestPerson(t, userId, "Bob", {
        interactionCount: 2,
      });
      const eventId = await createTestEvent(t, userId, diaryId, {
        personIds: [person1Id, person2Id],
      });

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        peopleNames: ["Alice"], // Remove "Bob"
      });

      const event = await t.run(async (ctx) => await ctx.db.get(eventId));
      expect(event?.personIds).toEqual([person1Id]);

      // Verify interactionCounts were updated
      const person1 = await t.run(async (ctx) => await ctx.db.get(person1Id));
      const person2 = await t.run(async (ctx) => await ctx.db.get(person2Id));
      expect(person1?.interactionCount).toBe(3); // Kept, so unchanged
      expect(person2?.interactionCount).toBe(1); // Decremented from 2
    });

    it("replaces people correctly (removes old, adds new)", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const oldPersonId = await createTestPerson(t, userId, "Alice", {
        interactionCount: 2,
      });
      const newPersonId = await createTestPerson(t, userId, "Bob", {
        interactionCount: 1,
      });
      const eventId = await createTestEvent(t, userId, diaryId, {
        personIds: [oldPersonId],
      });

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        peopleNames: ["Bob"],
      });

      const event = await t.run(async (ctx) => await ctx.db.get(eventId));
      expect(event?.personIds).toEqual([newPersonId]);

      // Verify interactionCounts
      const oldPerson = await t.run(async (ctx) => await ctx.db.get(oldPersonId));
      const newPerson = await t.run(async (ctx) => await ctx.db.get(newPersonId));
      expect(oldPerson?.interactionCount).toBe(1); // Decremented
      expect(newPerson?.interactionCount).toBe(2); // Incremented
    });

    it("handles empty people array", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const personId = await createTestPerson(t, userId, "Alice", {
        interactionCount: 2,
      });
      const eventId = await createTestEvent(t, userId, diaryId, {
        personIds: [personId],
      });

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        peopleNames: [],
      });

      const event = await t.run(async (ctx) => await ctx.db.get(eventId));
      expect(event?.personIds).toEqual([]);

      // Verify interactionCount was decremented
      const person = await t.run(async (ctx) => await ctx.db.get(personId));
      expect(person?.interactionCount).toBe(1);
    });

    it("normalizes person names (trimmed)", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const eventId = await createTestEvent(t, userId, diaryId);

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        peopleNames: ["  Alice  ", "Bob"],
      });

      const event = await t.run(async (ctx) => await ctx.db.get(eventId));
      expect(event?.personIds).toHaveLength(2);

      const people = await t.run(async (ctx) => {
        if (!event?.personIds) return [];
        return Promise.all(event.personIds.map((id) => ctx.db.get(id)));
      });

      expect(people[0]?.primaryName).toBe("Alice");
      expect(people[1]?.primaryName).toBe("Bob");
    });

    it("does not increment interactionCount for newly created people", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const eventId = await createTestEvent(t, userId, diaryId);

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        peopleNames: ["NewPerson"],
      });

      const event = await t.run(async (ctx) => await ctx.db.get(eventId));
      const personId = event?.personIds?.[0];
      expect(personId).toBeDefined();

      const person = await t.run(async (ctx) => await ctx.db.get(personId!));
      expect(person?.interactionCount).toBe(1); // Set during creation, not incremented
    });

    it("updates lastMentionedAt for existing people that are added", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const oldTime = FROZEN_TIME - 1000000;
      const personId = await createTestPerson(t, userId, "Alice", {
        interactionCount: 1,
        lastMentionedAt: oldTime,
      });
      const eventId = await createTestEvent(t, userId, diaryId);

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        peopleNames: ["Alice"],
      });

      const person = await t.run(async (ctx) => await ctx.db.get(personId));
      expect(person?.lastMentionedAt).toBeGreaterThan(oldTime);
    });

    it("updates lastMentionedAt for kept people", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const oldTime = FROZEN_TIME - 1000000;
      const personId = await createTestPerson(t, userId, "Alice", {
        interactionCount: 2,
        lastMentionedAt: oldTime,
      });
      const eventId = await createTestEvent(t, userId, diaryId, {
        personIds: [personId],
      });

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        peopleNames: ["Alice"], // Kept person
        title: "Updated title", // Also update something else
      });

      const person = await t.run(async (ctx) => await ctx.db.get(personId));
      expect(person?.lastMentionedAt).toBeGreaterThan(oldTime);
      expect(person?.interactionCount).toBe(2); // Unchanged
    });

    it("clamps interactionCount to 0 when decrementing", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const personId = await createTestPerson(t, userId, "Alice", {
        interactionCount: 0,
      });
      const eventId = await createTestEvent(t, userId, diaryId, {
        personIds: [personId],
      });

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        peopleNames: [],
      });

      const person = await t.run(async (ctx) => await ctx.db.get(personId));
      expect(person?.interactionCount).toBe(0); // Clamped, not negative
    });

    it("handles complex scenario: remove some, add some, keep some", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const aliceId = await createTestPerson(t, userId, "Alice", {
        interactionCount: 3,
        lastMentionedAt: FROZEN_TIME - 2000000,
      });
      const bobId = await createTestPerson(t, userId, "Bob", {
        interactionCount: 2,
        lastMentionedAt: FROZEN_TIME - 1000000,
      });
      const charlieId = await createTestPerson(t, userId, "Charlie", {
        interactionCount: 1,
      });
      const eventId = await createTestEvent(t, userId, diaryId, {
        personIds: [aliceId, bobId],
      });

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        peopleNames: ["Alice", "Charlie"], // Keep Alice, remove Bob, add Charlie
      });

      const event = await t.run(async (ctx) => await ctx.db.get(eventId));
      expect(event?.personIds).toHaveLength(2);
      expect(event?.personIds).toContain(aliceId);
      expect(event?.personIds).toContain(charlieId);
      expect(event?.personIds).not.toContain(bobId);

      // Verify counts and timestamps
      const alice = await t.run(async (ctx) => await ctx.db.get(aliceId));
      const bob = await t.run(async (ctx) => await ctx.db.get(bobId));
      const charlie = await t.run(async (ctx) => await ctx.db.get(charlieId));

      expect(alice?.interactionCount).toBe(3); // Kept, unchanged
      expect(alice?.lastMentionedAt).toBeGreaterThan(FROZEN_TIME - 2000000); // Updated
      expect(bob?.interactionCount).toBe(1); // Decremented
      expect(charlie?.interactionCount).toBe(2); // Added (was 1, incremented to 2)
    });
  });

  describe("combined tag and people updates", () => {
    it("updates both tags and people in a single call", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const tagId = await createTestTag(t, userId, "work", { eventCount: 1 });
      const personId = await createTestPerson(t, userId, "Alice", {
        interactionCount: 1,
      });
      const eventId = await createTestEvent(t, userId, diaryId, {
        tagIds: [tagId],
        personIds: [personId],
      });

      const asUser = withAuth(t, clerkId, email, name);
      await asUser.mutation(api.events.updateEvent, {
        eventId,
        tags: ["personal"],
        peopleNames: ["Bob"],
      });

      const event = await t.run(async (ctx) => await ctx.db.get(eventId));
      expect(event?.tagIds).toHaveLength(1);
      expect(event?.personIds).toHaveLength(1);

      // Verify old tag was decremented
      const oldTag = await t.run(async (ctx) => await ctx.db.get(tagId));
      expect(oldTag?.eventCount).toBe(0);

      // Verify old person was decremented
      const oldPerson = await t.run(async (ctx) => await ctx.db.get(personId));
      expect(oldPerson?.interactionCount).toBe(0);
    });
  });

  describe("authorization and error cases", () => {
    it("throws error when event not found", async () => {
      const t = createT();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      // Create an event and then delete it to get a non-existent but valid ID
      const eventId = await createTestEvent(t, userId, diaryId);
      await t.run(async (ctx) => {
        await ctx.db.delete(eventId);
      });

      const asUser = withAuth(t, clerkId, email, name);
      await expect(
        asUser.mutation(api.events.updateEvent, {
          eventId,
          title: "New Title",
        })
      ).rejects.toThrow("Event not found or unauthorized");
    });

    it("throws error when user tries to update another user's event", async () => {
      const t = createT();
      const { userId: user1Id, clerkId: user1ClerkId, email: user1Email, name: user1Name } =
        await createTestUser(t);
      const { userId: user2Id, clerkId: user2ClerkId, email: user2Email, name: user2Name } =
        await createTestUser(t);
      const diaryId = await createTestDiary(t, user1Id, "Test diary");
      const eventId = await createTestEvent(t, user1Id, diaryId);

      const asUser2 = withAuth(t, user2ClerkId, user2Email, user2Name);
      await expect(
        asUser2.mutation(api.events.updateEvent, {
          eventId,
          title: "Hacked Title",
        })
      ).rejects.toThrow("Event not found or unauthorized");
    });

    it("throws error when not authenticated", async () => {
      const t = createT();
      const { userId } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");
      const eventId = await createTestEvent(t, userId, diaryId);

      await expect(
        t.mutation(api.events.updateEvent, {
          eventId,
          title: "New Title",
        })
      ).rejects.toThrow();
    });
  });
});

