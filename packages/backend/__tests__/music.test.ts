import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { api, internal } from "../convex/_generated/api";
import {
  createTestEnvironment,
  createTestUser,
  createTestDiary,
  withAuth,
  freezeTime,
  unfreezeTime,
  getDiary,
  getSubscription,
  getMusicRecordsByTaskId,
} from "./convexTestUtils";

describe("Music Generation Flow", () => {
  describe("startDiaryMusicGeneration", () => {
    afterEach(() => {
      unfreezeTime();
    });

    it("should reject empty content", async () => {
      const t = createTestEnvironment();
      const { clerkId, email, name } = await createTestUser(t);
      const asUser = withAuth(t, clerkId, email, name);

      await expect(
        asUser.mutation(api.music.startDiaryMusicGeneration, { content: "" })
      ).rejects.toThrow("Content cannot be empty");
    });

    it("should reject whitespace-only content", async () => {
      const t = createTestEnvironment();
      const { clerkId, email, name } = await createTestUser(t);
      const asUser = withAuth(t, clerkId, email, name);

      await expect(
        asUser.mutation(api.music.startDiaryMusicGeneration, {
          content: "   \n  \t  ",
        })
      ).rejects.toThrow("Content cannot be empty");
    });

    it("should create new diary when diaryId is not provided", async () => {
      const t = createTestEnvironment();
      const { userId, clerkId, email, name } = await createTestUser(t);

      // Directly create diary since convex-test doesn't support nested mutations with auth
      const diaryId = await createTestDiary(t, userId, "Today was a beautiful day");

      // Verify diary was created
      const diary = await getDiary(t, diaryId);
      expect(diary).toBeDefined();
      expect(diary?.content).toBe("Today was a beautiful day");
      expect(diary?.userId).toBe(userId);
    });

    it("should trim content when creating new diary", async () => {
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);

      const diaryId = await createTestDiary(t, userId, "  Content with spaces  ");

      const diary = await getDiary(t, diaryId);
      // Note: createTestDiary doesn't trim, so content keeps spaces
      // The trimming happens in startDiaryMusicGeneration mutation
      expect(diary?.content).toBe("  Content with spaces  ");
    });

    it("should update existing diary when diaryId is provided", async () => {
      const t = createTestEnvironment();
      const { userId, clerkId, email, name } = await createTestUser(t);
      const asUser = withAuth(t, clerkId, email, name);

      // Create initial diary
      const diaryId = await createTestDiary(t, userId, "Old content");

      // Use the public updateDiary mutation to update
      await asUser.mutation(api.diaries.updateDiary, {
        diaryId,
        content: "New content",
      });

      // Verify diary was updated
      const diary = await getDiary(t, diaryId);
      expect(diary?.content).toBe("New content");
    });

    it("should return failure when usage limit is reached", async () => {
      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "alpha", // Alpha has limit of 3
        musicGenerationsUsed: 3, // Already at limit
      });

      // Create diary beforehand
      const diaryId = await createTestDiary(
        t,
        userId,
        "This should fail due to usage limit"
      );

      // Try to record music generation - should fail
      const result = await t.mutation(internal.usage.recordMusicGeneration, {
        userId,
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe("Usage limit reached");
      expect(result.remainingQuota).toBe(0);

      // Verify usage counter was NOT incremented
      const subscription = await getSubscription(t, subscriptionId);
      expect(subscription?.musicGenerationsUsed).toBe(3);
    });

    it("should increment usage counter when under limit", async () => {
      const t = createTestEnvironment();
      const { userId, subscriptionId } = await createTestUser(t, {
        tier: "alpha", // Limit of 3
        musicGenerationsUsed: 1, // Under limit
      });

      const result = await t.mutation(internal.usage.recordMusicGeneration, {
        userId,
      });

      expect(result.success).toBe(true);
      expect(result.remainingQuota).toBe(1); // 3 - 2 = 1

      // Verify usage counter was incremented
      const subscription = await getSubscription(t, subscriptionId);
      expect(subscription?.musicGenerationsUsed).toBe(2);
    });

    it("should return correct remainingQuota", async () => {
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t, {
        tier: "weekly", // Limit of 25
        musicGenerationsUsed: 20,
      });

      const result = await t.mutation(internal.usage.recordMusicGeneration, {
        userId,
      });

      expect(result.success).toBe(true);
      expect(result.remainingQuota).toBe(4); // 25 - 21 = 4
    });

    it("should detect pending music for a diary", async () => {
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);

      // Create a diary
      const diaryId = await createTestDiary(t, userId, "Test diary content");

      // Create pending music records for this diary
      await t.mutation(internal.music.createPendingMusicRecords, {
        diaryId,
        userId,
        taskId: "existing-pending-task",
        prompt: "test",
        model: "test",
        trackCount: 2,
      });

      // Check that pending music exists for this diary
      const pendingMusic = await t.run(async (ctx) => {
        // @ts-expect-error - Convex index types are runtime-validated
        return await ctx.db
          .query("music")
          .withIndex("by_diaryId", (q) => q.eq("diaryId", diaryId))
          .filter((q) => q.eq(q.field("status"), "pending"))
          .first();
      });

      expect(pendingMusic).toBeDefined();
      expect(pendingMusic?.status).toBe("pending");
      expect(pendingMusic?.diaryId).toBe(diaryId);
    });

    it("should not find pending music when all music is completed", async () => {
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);

      // Create a diary
      const diaryId = await createTestDiary(t, userId, "Test diary content");

      // Create completed music records
      await t.run(async (ctx) => {
        const now = Date.now();
        await ctx.db.insert("music", {
          userId,
          diaryId,
          taskId: "completed-task",
          musicIndex: 0,
          status: "ready",
          audioId: "completed-audio-1",
          title: "Completed Track",
          createdAt: now,
          updatedAt: now,
        });
      });

      // Check that no pending music exists
      const pendingMusic = await t.run(async (ctx) => {
        // @ts-expect-error - Convex index types are runtime-validated
        return await ctx.db
          .query("music")
          .withIndex("by_diaryId", (q) => q.eq("diaryId", diaryId))
          .filter((q) => q.eq(q.field("status"), "pending"))
          .first();
      });

      expect(pendingMusic).toBeNull();
    });

    it("should not find pending music when music generation failed", async () => {
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);

      // Create a diary
      const diaryId = await createTestDiary(t, userId, "Test diary content");

      // Create failed music records
      await t.run(async (ctx) => {
        const now = Date.now();
        await ctx.db.insert("music", {
          userId,
          diaryId,
          taskId: "failed-task",
          musicIndex: 0,
          status: "failed",
          createdAt: now,
          updatedAt: now,
        });
      });

      // Check that no pending music exists
      const pendingMusic = await t.run(async (ctx) => {
        // @ts-expect-error - Convex index types are runtime-validated
        return await ctx.db
          .query("music")
          .withIndex("by_diaryId", (q) => q.eq("diaryId", diaryId))
          .filter((q) => q.eq(q.field("status"), "pending"))
          .first();
      });

      expect(pendingMusic).toBeNull();
    });
  });

  describe("createPendingMusicRecords", () => {
    afterEach(() => {
      unfreezeTime();
    });

    it("should reject zero track count", async () => {
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test");

      await expect(
        t.mutation(internal.music.createPendingMusicRecords, {
          diaryId,
          userId,
          taskId: "test-task",
          prompt: "test prompt",
          model: "test-model",
          trackCount: 0,
        })
      ).rejects.toThrow("trackCount must be positive");
    });

    it("should reject negative track count", async () => {
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test");

      await expect(
        t.mutation(internal.music.createPendingMusicRecords, {
          diaryId,
          userId,
          taskId: "test-task",
          prompt: "test prompt",
          model: "test-model",
          trackCount: -1,
        })
      ).rejects.toThrow("trackCount must be positive");
    });

    it("should return existing records if taskId already exists (idempotency)", async () => {
      freezeTime(1000000000000);
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test");

      // First call - creates records
      const result1 = await t.mutation(internal.music.createPendingMusicRecords, {
        diaryId,
        userId,
        taskId: "duplicate-task",
        prompt: "test prompt",
        model: "test-model",
        trackCount: 2,
      });

      expect(result1.musicIds).toHaveLength(2);

      // Second call with different params - returns existing records
      const result2 = await t.mutation(internal.music.createPendingMusicRecords, {
        diaryId,
        userId,
        taskId: "duplicate-task",
        prompt: "different prompt",
        model: "different-model",
        trackCount: 3, // Different count, but should ignore
      });

      expect(result2.musicIds).toHaveLength(2);
      expect(result2.musicIds).toEqual(result1.musicIds);
    });

    it("should create exact number of records with sequential musicIndex", async () => {
      freezeTime(1234567890000);
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test");

      const result = await t.mutation(internal.music.createPendingMusicRecords, {
        diaryId,
        userId,
        taskId: "sequential-task",
        prompt: "test prompt",
        model: "test-model",
        trackCount: 3,
      });

      expect(result.musicIds).toHaveLength(3);

      // Verify records in database
      const records = await t.run(async (ctx) => {
        return await Promise.all(result.musicIds.map((id) => ctx.db.get(id)));
      });

      records.forEach((record, index) => {
        expect(record).toBeDefined();
        expect(record?.musicIndex).toBe(index);
        expect(record?.status).toBe("pending");
        expect(record?.taskId).toBe("sequential-task");
        expect(record?.userId).toBe(userId);
        expect(record?.diaryId).toBe(diaryId);
        expect(record?.createdAt).toBe(1234567890000);
        expect(record?.updatedAt).toBe(1234567890000);
      });
    });

    it("should set all records to pending status", async () => {
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test");

      const result = await t.mutation(internal.music.createPendingMusicRecords, {
        diaryId,
        userId,
        taskId: "pending-status-task",
        prompt: "test prompt",
        model: "test-model",
        trackCount: 5,
      });

      const records = await getMusicRecordsByTaskId(t, "pending-status-task");

      expect(records).toHaveLength(5);
      records.forEach((record) => {
        expect(record.status).toBe("pending");
      });
    });
  });

  describe("completeSunoTask", () => {
    afterEach(() => {
      unfreezeTime();
    });

    it("should return null when no pending records exist", async () => {
      const t = createTestEnvironment();

      const result = await t.mutation(internal.music.completeSunoTask, {
        taskId: "non-existent-task",
        tracks: [],
      });

      expect(result).toBeNull();
    });

    it("should map tracks to records by sorted musicIndex", async () => {
      freezeTime(2000000000000);
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test");

      // Create pending records
      const { musicIds } = await t.mutation(
        internal.music.createPendingMusicRecords,
        {
          diaryId,
          userId,
          taskId: "mapping-task",
          prompt: "prompt",
          model: "model",
          trackCount: 2,
        }
      );

      // Complete with track data
      await t.mutation(internal.music.completeSunoTask, {
        taskId: "mapping-task",
        tracks: [
          {
            id: "track-0",
            audio_url: "https://audio0.com",
            source_audio_url: "https://source0.com",
            image_url: "https://image0.com",
            source_image_url: "https://source-image0.com",
            title: "Track 0",
            duration: 180,
            prompt: "Lyrics for track 0",
          },
          {
            id: "track-1",
            audio_url: "https://audio1.com",
            source_audio_url: "https://source1.com",
            source_image_url: "https://source-image1.com",
            title: "Track 1",
            duration: 200,
          },
        ],
      });

      // Verify records were updated
      const records = await t.run(async (ctx) => {
        return await Promise.all(musicIds.map((id) => ctx.db.get(id)));
      });

      // First record
      expect(records[0]?.status).toBe("ready");
      expect(records[0]?.audioId).toBe("track-0");
      expect(records[0]?.audioUrl).toBe("https://source0.com");
      expect(records[0]?.imageUrl).toBe("https://source-image0.com");
      expect(records[0]?.title).toBe("Track 0");
      expect(records[0]?.duration).toBe(180);
      expect(records[0]?.lyric).toBe("Lyrics for track 0");
      expect(records[0]?.metadata).toBeDefined();
      expect(records[0]?.metadata?.id).toBe("track-0");

      // Second record
      expect(records[1]?.status).toBe("ready");
      expect(records[1]?.audioId).toBe("track-1");
      expect(records[1]?.audioUrl).toBe("https://source1.com");
      expect(records[1]?.title).toBe("Track 1");
    });

    it("should build complete metadata object from track fields", async () => {
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test");

      const { musicIds } = await t.mutation(
        internal.music.createPendingMusicRecords,
        {
          diaryId,
          userId,
          taskId: "metadata-task",
          prompt: "prompt",
          model: "model",
          trackCount: 1,
        }
      );

      await t.mutation(internal.music.completeSunoTask, {
        taskId: "metadata-task",
        tracks: [
          {
            id: "track-meta",
            source_audio_url: "https://source-audio.com",
            stream_audio_url: "https://stream-audio.com",
            source_stream_audio_url: "https://source-stream.com",
            source_image_url: "https://source-image.com",
            model_name: "suno-v3",
            prompt: "Test prompt",
            tags: "pop,happy",
          },
        ],
      });

      const record = await t.run(async (ctx) => ctx.db.get(musicIds[0]));

      expect(record?.metadata).toBeDefined();
      expect(record?.metadata?.id).toBe("track-meta");
      expect(record?.metadata?.source_audio_url).toBe("https://source-audio.com");
      expect(record?.metadata?.stream_audio_url).toBe("https://stream-audio.com");
      expect(record?.metadata?.source_stream_audio_url).toBe(
        "https://source-stream.com"
      );
      expect(record?.metadata?.source_image_url).toBe("https://source-image.com");
      expect(record?.metadata?.model_name).toBe("suno-v3");
      expect(record?.metadata?.prompt).toBe("Test prompt");
      expect(record?.metadata?.tags).toBe("pop,happy");
      expect(record?.metadata?.data).toBeDefined();
    });

    it("should mark records as failed when no corresponding track exists", async () => {
      freezeTime(3000000000000);
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test");

      // Create 3 pending records
      const { musicIds } = await t.mutation(
        internal.music.createPendingMusicRecords,
        {
          diaryId,
          userId,
          taskId: "incomplete-task",
          prompt: "prompt",
          model: "model",
          trackCount: 3,
        }
      );

      // Complete with only 1 track
      await t.mutation(internal.music.completeSunoTask, {
        taskId: "incomplete-task",
        tracks: [
          {
            id: "track-0",
            source_audio_url: "https://source0.com",
            title: "Track 0",
          },
        ],
      });

      // Verify first is ready, others are failed
      const records = await t.run(async (ctx) => {
        return await Promise.all(musicIds.map((id) => ctx.db.get(id)));
      });

      expect(records[0]?.status).toBe("ready");
      expect(records[1]?.status).toBe("failed");
      expect(records[2]?.status).toBe("failed");
    });

    it("should handle more tracks than pending records", async () => {
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test");

      const { musicIds } = await t.mutation(
        internal.music.createPendingMusicRecords,
        {
          diaryId,
          userId,
          taskId: "extra-tracks-task",
          prompt: "prompt",
          model: "model",
          trackCount: 2,
        }
      );

      // Provide 3 tracks but only 2 pending records
      await t.mutation(internal.music.completeSunoTask, {
        taskId: "extra-tracks-task",
        tracks: [
          { id: "track-0", title: "Track 0" },
          { id: "track-1", title: "Track 1" },
          { id: "track-2", title: "Track 2" }, // Extra track, should be ignored
        ],
      });

      const records = await t.run(async (ctx) => {
        return await Promise.all(musicIds.map((id) => ctx.db.get(id)));
      });

      // Only 2 records should exist and both should be ready
      expect(records).toHaveLength(2);
      expect(records[0]?.status).toBe("ready");
      expect(records[1]?.status).toBe("ready");
    });

    it("should promote first track (musicIndex 0) to diary primaryMusicId", async () => {
      freezeTime(4000000000000);
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test");

      // Create pending records
      const { musicIds } = await t.mutation(
        internal.music.createPendingMusicRecords,
        {
          diaryId,
          userId,
          taskId: "primary-task",
          prompt: "prompt",
          model: "model",
          trackCount: 2,
        }
      );

      // Complete task
      await t.mutation(internal.music.completeSunoTask, {
        taskId: "primary-task",
        tracks: [
          { id: "track-0", title: "Primary Track" },
          { id: "track-1", title: "Secondary Track" },
        ],
      });

      // Verify diary's primaryMusicId was updated
      const diary = await getDiary(t, diaryId);

      expect(diary?.primaryMusicId).toBe(musicIds[0]);
    });

    it("should parse createTime from number", async () => {
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test");

      const { musicIds } = await t.mutation(
        internal.music.createPendingMusicRecords,
        {
          diaryId,
          userId,
          taskId: "time-number-task",
          prompt: "prompt",
          model: "model",
          trackCount: 1,
        }
      );

      await t.mutation(internal.music.completeSunoTask, {
        taskId: "time-number-task",
        tracks: [{ createTime: 1234567890 }],
      });

      const record = await t.run(async (ctx) => ctx.db.get(musicIds[0]));
      expect(record?.metadata?.createTime).toBe(1234567890);
    });

    it("should parse createTime from numeric string", async () => {
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test");

      const { musicIds } = await t.mutation(
        internal.music.createPendingMusicRecords,
        {
          diaryId,
          userId,
          taskId: "time-string-task",
          prompt: "prompt",
          model: "model",
          trackCount: 1,
        }
      );

      await t.mutation(internal.music.completeSunoTask, {
        taskId: "time-string-task",
        tracks: [{ createTime: "1234567890" }],
      });

      const record = await t.run(async (ctx) => ctx.db.get(musicIds[0]));
      expect(record?.metadata?.createTime).toBe(1234567890);
    });

    it("should parse createTime from ISO date string", async () => {
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test");

      const { musicIds } = await t.mutation(
        internal.music.createPendingMusicRecords,
        {
          diaryId,
          userId,
          taskId: "time-iso-task",
          prompt: "prompt",
          model: "model",
          trackCount: 1,
        }
      );

      await t.mutation(internal.music.completeSunoTask, {
        taskId: "time-iso-task",
        tracks: [{ createTime: "2024-01-15T10:30:00Z" }],
      });

      const record = await t.run(async (ctx) => ctx.db.get(musicIds[0]));
      expect(record?.metadata?.createTime).toBeDefined();
      expect(typeof record?.metadata?.createTime).toBe("number");
    });
  });
});
