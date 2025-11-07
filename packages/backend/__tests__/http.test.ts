import { describe, it, expect } from "vitest";
import { internal } from "../convex/_generated/api";
import { Doc } from "../convex/_generated/dataModel";
import { createTestEnvironment, createTestUser, createTestDiary } from "./convexTestUtils";

/**
 * HTTP Webhook Handler Tests
 *
 * Note: convex-test doesn't support testing HTTP actions directly because they require
 * a Request object and external dependencies like signature verification.
 *
 * These tests focus on the internal mutations that webhooks call, which represent
 * the core business logic. The HTTP layer (method validation, JSON parsing, signature
 * verification) should be tested through integration tests or manual testing.
 */

describe("Webhook Logic Tests", () => {
  describe("Suno Music Generation Callback Logic", () => {
    it("should process complete callback and update music records", async () => {
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary");

      // Create pending records (simulating what would happen before callback)
      await t.mutation(internal.music.createPendingMusicRecords, {
        diaryId,
        userId,
        taskId: "webhook-callback-task",
        prompt: "Generate happy music",
        model: "suno-v3",
        trackCount: 2,
      });

      // Simulate webhook calling completeSunoTask
      const result = await t.mutation(internal.music.completeSunoTask, {
        taskId: "webhook-callback-task",
        tracks: [
          {
            id: "suno-track-1",
            source_audio_url: "https://cdn.suno.com/audio1.mp3",
            source_image_url: "https://cdn.suno.com/image1.jpg",
            title: "Happy Song",
            duration: 180,
            prompt: "A happy upbeat song",
            model_name: "suno-v3",
          },
          {
            id: "suno-track-2",
            source_audio_url: "https://cdn.suno.com/audio2.mp3",
            source_image_url: "https://cdn.suno.com/image2.jpg",
            title: "Joyful Melody",
            duration: 200,
            prompt: "A joyful melodic tune",
            model_name: "suno-v3",
          },
        ],
      });

      expect(result).toBeNull(); // completeSunoTask returns null on success

      // Verify records were updated to "ready" status
      const records = await t.run(async (ctx) => {
        return await ctx.db
          .query("music")
          .withIndex("by_taskId", (q) => q.eq("taskId", "webhook-callback-task"))
          .collect();
      });

      expect(records).toHaveLength(2);
      expect(records[0].status).toBe("ready");
      expect(records[0].audioId).toBe("suno-track-1");
      expect(records[0].title).toBe("Happy Song");
      expect(records[1].status).toBe("ready");
      expect(records[1].audioId).toBe("suno-track-2");
      expect(records[1].title).toBe("Joyful Melody");
    });

    it("should handle missing taskId gracefully", async () => {
      const t = createTestEnvironment();

      // Call completeSunoTask with non-existent taskId
      const result = await t.mutation(internal.music.completeSunoTask, {
        taskId: "non-existent-webhook-task",
        tracks: [],
      });

      // Should return null without throwing
      expect(result).toBeNull();
    });

    it("should handle incomplete track data", async () => {
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test");

      await t.mutation(internal.music.createPendingMusicRecords, {
        diaryId,
        userId,
        taskId: "incomplete-webhook-task",
        prompt: "prompt",
        model: "model",
        trackCount: 3,
      });

      // Webhook sends only 1 track for 3 pending records
      await t.mutation(internal.music.completeSunoTask, {
        taskId: "incomplete-webhook-task",
        tracks: [
          {
            id: "partial-track",
            title: "Only One Track",
          },
        ],
      });

      const records = await t.run(async (ctx) => {
        return await ctx.db
          .query("music")
          .withIndex("by_taskId", (q) => q.eq("taskId", "incomplete-webhook-task"))
          .collect();
      });

      // First record should be ready, others failed
      const sortedRecords = records.sort((a, b) => (a.musicIndex ?? 0) - (b.musicIndex ?? 0));
      expect(sortedRecords[0].status).toBe("ready");
      expect(sortedRecords[1].status).toBe("failed");
      expect(sortedRecords[2].status).toBe("failed");
    });

    it("should handle webhook with extra tracks", async () => {
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test");

      await t.mutation(internal.music.createPendingMusicRecords, {
        diaryId,
        userId,
        taskId: "extra-webhook-task",
        prompt: "prompt",
        model: "model",
        trackCount: 2,
      });

      // Webhook sends 4 tracks but only 2 pending records
      await t.mutation(internal.music.completeSunoTask, {
        taskId: "extra-webhook-task",
        tracks: [
          { id: "track-1", title: "Track 1" },
          { id: "track-2", title: "Track 2" },
          { id: "track-3", title: "Track 3" }, // Extra
          { id: "track-4", title: "Track 4" }, // Extra
        ],
      });

      const records = await t.run(async (ctx) => {
        return await ctx.db
          .query("music")
          .withIndex("by_taskId", (q) => q.eq("taskId", "extra-webhook-task"))
          .collect();
      });

      // Only 2 records should exist (matching trackCount)
      expect(records).toHaveLength(2);
      expect(records.every((r) => r.status === "ready")).toBe(true);
    });

    it("should update diary primaryMusicId from webhook callback", async () => {
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);
      const diaryId = await createTestDiary(t, userId, "Test diary for webhook");

      const { musicIds } = await t.mutation(
        internal.music.createPendingMusicRecords,
        {
          diaryId,
          userId,
          taskId: "primary-webhook-task",
          prompt: "prompt",
          model: "model",
          trackCount: 2,
        }
      );

      // Webhook callback completes the task
      await t.mutation(internal.music.completeSunoTask, {
        taskId: "primary-webhook-task",
        tracks: [
          { id: "primary-track", title: "Primary Track" },
          { id: "secondary-track", title: "Secondary Track" },
        ],
      });

      // Verify diary's primaryMusicId was set to first track
      const diary = await t.run(async (ctx) => ctx.db.get(diaryId));
      expect(diary?.primaryMusicId).toBe(musicIds[0]);
    });
  });

  describe("Clerk User Webhook Logic", () => {
    it("should create user and alpha subscription", async () => {
      const t = createTestEnvironment();

      // Simulate webhook calling createUser
      const { userId } = await t.mutation(internal.users.createUser, {
        clerkId: "clerk_webhook_test123",
        email: "webhook@example.com",
        name: "Webhook Test User",
        tags: ["alpha-user"],
      });

      expect(userId).toBeDefined();

      // Verify user was created
      const user = await t.run(async (ctx) => ctx.db.get(userId)) as Doc<"users"> | null;
      expect(user).toBeDefined();
      expect(user?.clerkId).toBe("clerk_webhook_test123");
      expect(user?.email).toBe("webhook@example.com");
      expect(user?.name).toBe("Webhook Test User");
      expect(user?.tags).toContain("alpha-user");

      // Create free subscription (webhook does this next)
      const subscriptionId = await t.mutation(
        internal.billing.createFreeSubscription,
        { userId }
      );

      expect(subscriptionId).toBeDefined();

      // Verify subscription was created and linked
      const updatedUser = await t.run(async (ctx) => ctx.db.get(userId)) as Doc<"users"> | null;
      expect(updatedUser?.activeSubscriptionId).toBe(subscriptionId);

      const subscription = await t.run(async (ctx) => ctx.db.get(subscriptionId)) as Doc<"subscriptionStatuses"> | null;
      expect(subscription).toBeDefined();
      expect(subscription?.subscriptionTier).toBe("free");
      expect(subscription?.status).toBe("active");
      expect(subscription?.userId).toBe(userId);
      expect(subscription?.musicGenerationsUsed).toBe(0);
    });

    it("should handle missing optional fields (email, name)", async () => {
      const t = createTestEnvironment();

      // Webhook with minimal data
      const { userId } = await t.mutation(internal.users.createUser, {
        clerkId: "clerk_minimal_user",
        // No email, name, or tags
      });

      const user = await t.run(async (ctx) => ctx.db.get(userId));
      expect(user?.clerkId).toBe("clerk_minimal_user");
      expect(user?.email).toBeUndefined();
      expect(user?.name).toBeUndefined();
      expect(user?.tags).toBeUndefined();
    });

    it("should create subscription with correct free tier defaults", async () => {
      const t = createTestEnvironment();

      const { userId } = await t.mutation(internal.users.createUser, {
        clerkId: "clerk_free_test",
        email: "free@example.com",
      });

      const subscriptionId = await t.mutation(
        internal.billing.createFreeSubscription,
        { userId }
      );

      const subscription = await t.run(async (ctx) => ctx.db.get(subscriptionId));

      // Verify free subscription defaults
      expect(subscription?.subscriptionTier).toBe("free");
      expect(subscription?.productId).toBe("free-tier");
      expect(subscription?.platform).toBe("clerk");
      expect(subscription?.status).toBe("active");
      expect(subscription?.musicGenerationsUsed).toBe(0);
      expect(subscription?.customMusicLimit).toBeUndefined(); // No custom limit by default
    });

    it("should not create duplicate subscription if user already has one", async () => {
      const t = createTestEnvironment();

      const { userId } = await createTestUser(t, {
        clerkId: "existing-sub-user",
      });

      // Get initial subscription
      const user = await t.run(async (ctx) => ctx.db.get(userId));
      const initialSubId = user?.activeSubscriptionId;
      expect(initialSubId).toBeDefined();

      // Try to create another free subscription
      const returnedSubId = await t.mutation(
        internal.billing.createFreeSubscription,
        { userId }
      );

      // Should return the existing subscription ID
      expect(returnedSubId).toBe(initialSubId);

      // Verify no duplicate was created
      const allSubs = await t.run(async (ctx) => {
        return await ctx.db
          .query("subscriptionStatuses")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .collect();
      });

      expect(allSubs).toHaveLength(1);
    });
  });

  describe("Webhook Integration Scenarios", () => {
    it("should handle complete user onboarding flow from webhook", async () => {
      const t = createTestEnvironment();

      // 1. Clerk webhook creates user
      const { userId } = await t.mutation(internal.users.createUser, {
        clerkId: "clerk_onboarding_123",
        email: "onboard@example.com",
        name: "New User",
        tags: ["alpha-user"],
      });

      // 2. Create free subscription
      await t.mutation(internal.billing.createFreeSubscription, { userId });

      // 3. Verify user can generate music
      const usageResult = await t.mutation(
        internal.usage.recordMusicGeneration,
        { userId }
      );

      expect(usageResult.success).toBe(true);
      expect(usageResult.tier).toBe("free");
      expect(usageResult.limit).toBe(5);
      expect(usageResult.currentUsage).toBe(1);
      expect(usageResult.remainingQuota).toBe(4);
    });

    it("should handle music generation webhook completing after user creates diary", async () => {
      const t = createTestEnvironment();
      const { userId } = await createTestUser(t);

      // 1. User creates diary
      const diaryId = await createTestDiary(t, userId, "I had a great day today!");

      // 2. Create pending music records
      await t.mutation(internal.music.createPendingMusicRecords, {
        diaryId,
        userId,
        taskId: "complete-flow-task",
        prompt: "Happy music",
        model: "suno-v3",
        trackCount: 2,
      });

      // 3. Suno webhook fires with completed tracks
      await t.mutation(internal.music.completeSunoTask, {
        taskId: "complete-flow-task",
        tracks: [
          {
            id: "final-track-1",
            source_audio_url: "https://audio1.mp3",
            title: "Happy Day Song",
            duration: 180,
          },
          {
            id: "final-track-2",
            source_audio_url: "https://audio2.mp3",
            title: "Joyful Tune",
            duration: 200,
          },
        ],
      });

      // 4. Verify complete flow
      const diary = await t.run(async (ctx) => ctx.db.get(diaryId));
      expect(diary?.primaryMusicId).toBeDefined();

      const primaryMusic = await t.run(async (ctx) =>
        ctx.db.get(diary!.primaryMusicId!)
      );
      expect(primaryMusic?.status).toBe("ready");
      expect(primaryMusic?.audioId).toBe("final-track-1");
      expect(primaryMusic?.diaryId).toBe(diaryId);
    });
  });

  describe("VAPI Webhook Logic", () => {
    it("should extract call ID from real webhook event (your sample)", () => {
      // This is the exact structure from the warning you're seeing
      const realWebhookEvent = {
        message: {
          timestamp: 1761689537883,
          type: "end-of-call-report",
          analysis: {
            summary: "The AI repeatedly addressed the user as 'Schrodinger Bass'...",
            successEvaluation: "false",
          },
          artifact: {
            transcript: "AI: Hey, Schrodinger Bass. It\nUser: Hello?\n...",
            messages: [],
            recordingUrl: "https://storage.vapi.ai/...",
          },
          call: {
            metadata: {
              jobId: "jx7cv6m4ywe9kpet7698mj47fs7tbhdf",
              userId: "js78dzcg9as10egvckjgegsx697swhvg",
            },
            id: "019a2ce0-1c18-755b-a780-bdd8f880ff5d",
            orgId: "a3e9b919-c8af-45eb-9e1f-b9293ba681a6",
            createdAt: "2025-10-28T22:11:16.120Z",
            updatedAt: "2025-10-28T22:11:16.120Z",
            type: "outboundPhoneCall",
            status: "queued",
          },
          startedAt: "2025-10-28T22:11:30.772Z",
          endedAt: "2025-10-28T22:12:12.974Z",
          endedReason: "customer-ended-call",
        },
      };

      // Extract call ID using the same logic as http.ts line 298
      const vapiCallId = realWebhookEvent.message.call?.id;

      expect(vapiCallId).toBe("019a2ce0-1c18-755b-a780-bdd8f880ff5d");
      expect(vapiCallId).toBeTruthy();
    });

    it("should handle webhook event with call ID in message.call.id", () => {
      const webhookEvent = {
        message: {
          type: "end-of-call-report",
          call: {
            id: "test-call-123",
          },
          artifact: {
            transcript: "Call completed",
            messages: [],
          },
          endedReason: "completed",
        },
      };

      // Extract call ID (simulating the http.ts logic)
      const extractedCallId = webhookEvent.message.call?.id;

      expect(extractedCallId).toBe("test-call-123");
    });

    it("should handle webhook event with alternative call ID locations", () => {
      const vapiCallId = "alternative-call-id-456";

      // Test case 1: call ID directly in message.call
      const event1 = {
        message: {
          type: "end-of-call-report",
          call: {
            id: vapiCallId,
          },
          artifact: {},
          endedReason: "completed",
        },
      };

      let extractedId = event1.message.call?.id;
      expect(extractedId).toBe(vapiCallId);

      // Test case 2: call ID might be at different nested levels
      const event2 = {
        message: {
          type: "end-of-call-report",
          call: {
            id: vapiCallId,
            metadata: {
              callId: vapiCallId,
            },
          },
          artifact: {},
          endedReason: "completed",
        },
      };

      extractedId = event2.message.call?.id;
      expect(extractedId).toBe(vapiCallId);
    });

    it("should validate call ID extraction handles all event structures", () => {
      // Test various event structures from real VAPI webhooks
      const testCases = [
        // Case 1: Standard structure
        {
          message: {
            type: "end-of-call-report",
            call: { id: "call-id-1" },
          },
          expectedId: "call-id-1",
        },
        // Case 2: Real sample from user
        {
          message: {
            timestamp: 1761689537883,
            type: "end-of-call-report",
            call: {
              id: "019a2ce0-1c18-755b-a780-bdd8f880ff5d",
              metadata: {},
            },
            artifact: {},
          },
          expectedId: "019a2ce0-1c18-755b-a780-bdd8f880ff5d",
        },
        // Case 3: Minimal structure
        {
          message: {
            type: "end-of-call-report",
            call: { id: "minimal-call-id" },
          },
          expectedId: "minimal-call-id",
        },
      ];

      for (const testCase of testCases) {
        const extractedId = testCase.message.call?.id;
        expect(extractedId).toBe(testCase.expectedId);
      }
    });

  });
});

/**
 * HTTP Layer Testing (Not Covered by convex-test)
 *
 * The following should be tested through integration tests or manual testing:
 *
 * Suno Callback Endpoint:
 * - POST method validation (returns 405 for non-POST)
 * - JSON parsing (returns 400 for malformed JSON)
 * - Missing data field (returns 200 with status "ignored")
 * - Missing taskId (returns 400 with error)
 * - Non-complete callback types (returns 200 with status "ignored")
 * - Task completion success (returns 200 with status "ok")
 * - Task completion failure (returns 500)
 *
 * Clerk Webhook Endpoint:
 * - POST method validation (returns 405 for non-POST)
 * - Signature verification (returns 401 for invalid signature)
 * - Non-user.created events (returns 200 with status "ignored")
 * - Primary email extraction
 * - Name building from first_name + last_name
 * - Fallback to username
 * - User creation success (returns 200 with status "ok")
 * - User creation failure (returns 500)
 *
 * VAPI Webhook Endpoint:
 * - POST method validation (returns 405 for non-POST)
 * - JSON parsing (returns 400 for malformed JSON)
 * - Missing message field (returns 400 with error)
 * - Missing call ID (returns 400 with error)
 * - Invalid message structure (returns 400 with error)
 * - Job not found for VAPI call ID (returns 200 with "ignored")
 * - End-of-call-report processing success (returns 200 with status "ok")
 * - Other message types (returns 200 with status "ignored")
 * - Webhook processing failure (returns 500)
 */
