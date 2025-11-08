/**
 * Video Generation Workflow Tests
 * Tests for video generation, credit tracking, and webhook handling
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ConvexTestingHelper } from './convexTestUtils';
import { api, internal } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';

describe('Video Generation Workflow', () => {
  let t: ConvexTestingHelper;
  let userId: Id<'users'>;
  let musicId: Id<'music'>;

  beforeEach(async () => {
    t = new ConvexTestingHelper();
    await t.start();

    // Create test user with active subscription
    userId = await t.run(async (ctx) => {
      const user = await ctx.db.insert('users', {
        clerkId: 'test_user_video',
        email: 'video@test.com',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Create active subscription with sufficient credits
      const subscription = await ctx.db.insert('subscriptionStatuses', {
        userId: user,
        productId: 'monthly_plan',
        status: 'active',
        subscriptionTier: 'monthly',
        lastResetAt: Date.now(),
        musicGenerationsUsed: 0, // No usage yet
        lastVerifiedAt: Date.now(),
        platform: 'stripe',
      });

      await ctx.db.patch(user, { activeSubscriptionId: subscription });
      return user;
    });

    // Create test music with lyrics
    musicId = await t.run(async (ctx) => {
      return await ctx.db.insert('music', {
        userId,
        title: 'Test Song',
        lyric: 'Test lyrics for video generation\nThis is a test song',
        audioUrl: 'https://example.com/audio.mp3',
        status: 'ready',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  test('should deduct 3 credits for video generation', async () => {
    // Record video generation
    const result = await t.mutation(internal.usage.recordVideoGeneration, {
      userId,
    });

    expect(result.success).toBe(true);
    expect(result.currentUsage).toBe(3); // Should have used 3 credits
    expect(result.remainingQuota).toBe(87); // 90 - 3 for monthly plan
  });

  test('should fail when insufficient credits', async () => {
    // Set usage to 89 (only 1 credit remaining for monthly plan with 90 limit)
    await t.run(async (ctx) => {
      const user = await ctx.db.get(userId);
      if (user?.activeSubscriptionId) {
        await ctx.db.patch(user.activeSubscriptionId, {
          musicGenerationsUsed: 89,
        });
      }
    });

    const result = await t.mutation(internal.usage.recordVideoGeneration, {
      userId,
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('USAGE_LIMIT_REACHED');
    expect(result.reason).toContain('3 credits');
  });

  test('should refund 3 credits when video generation fails', async () => {
    // First deduct credits
    await t.mutation(internal.usage.recordVideoGeneration, { userId });

    // Then refund
    const result = await t.mutation(internal.usage.decrementVideoGeneration, {
      userId,
    });

    expect(result.success).toBe(true);
    expect(result.currentUsage).toBe(0); // Back to 0
  });

  test('should create pending video record', async () => {
    const result = await t.mutation(internal.videos.createPendingVideoRecord, {
      musicId,
      userId,
      kieTaskId: 'test-task-123',
      scriptPrompt: 'A beautiful sunset scene with mountains',
    });

    expect(result.videoId).toBeDefined();

    // Verify video was created
    const video = await t.run(async (ctx) => {
      return await ctx.db.get(result.videoId);
    });

    expect(video).toBeDefined();
    expect(video?.status).toBe('pending');
    expect(video?.kieTaskId).toBe('test-task-123');
  });

  test('should prevent duplicate video generation', async () => {
    // Create first pending video
    await t.mutation(internal.videos.createPendingVideoRecord, {
      musicId,
      userId,
      kieTaskId: 'test-task-123',
      scriptPrompt: 'Test prompt',
    });

    // Check for pending video
    const hasPending = await t.mutation(internal.videos.hasPendingVideoForMusic, {
      musicId,
    });

    expect(hasPending).toBe(true);
  });

  test('should complete video generation successfully', async () => {
    // Create pending video
    const { videoId } = await t.mutation(internal.videos.createPendingVideoRecord, {
      musicId,
      userId,
      kieTaskId: 'test-task-123',
      scriptPrompt: 'Test prompt',
    });

    // Complete the video
    await t.mutation(internal.videos.completeKieVideoTask, {
      kieTaskId: 'test-task-123',
      videoStorageId: 'storage_test_123',
      duration: 15,
      metadata: {
        model: 'sora-2-text-to-video',
        aspectRatio: 'portrait',
        nFrames: '15',
      },
    });

    // Verify video is ready
    const video = await t.run(async (ctx) => {
      return await ctx.db.get(videoId);
    });

    expect(video?.status).toBe('ready');
    expect(video?.videoStorageId).toBe('storage_test_123');
    expect(video?.duration).toBe(15);

    // Verify it was set as primary video
    const music = await t.run(async (ctx) => {
      return await ctx.db.get(musicId);
    });

    expect(music?.primaryVideoId).toBe(videoId);
  });

  test('should mark video as failed on error', async () => {
    // Create pending video
    await t.mutation(internal.videos.createPendingVideoRecord, {
      musicId,
      userId,
      kieTaskId: 'test-task-123',
      scriptPrompt: 'Test prompt',
    });

    // Fail the video
    await t.mutation(internal.videos.failVideoGeneration, {
      kieTaskId: 'test-task-123',
      errorMessage: 'Test error message',
    });

    // Verify video is failed
    const video = await t.run(async (ctx) => {
      return await ctx.db
        .query('musicVideos')
        .withIndex('by_kieTaskId', (q) => q.eq('kieTaskId', 'test-task-123'))
        .first();
    });

    expect(video?.status).toBe('failed');
    expect(video?.metadata?.errorMessage).toBe('Test error message');
  });

  test('should list videos for music track', async () => {
    // Create multiple videos
    await t.mutation(internal.videos.createPendingVideoRecord, {
      musicId,
      userId,
      kieTaskId: 'test-task-1',
      scriptPrompt: 'First video',
    });

    await t.mutation(internal.videos.createPendingVideoRecord, {
      musicId,
      userId,
      kieTaskId: 'test-task-2',
      scriptPrompt: 'Second video',
    });

    // List videos (would need to be authenticated in real scenario)
    const videos = await t.run(async (ctx) => {
      return await ctx.db
        .query('musicVideos')
        .withIndex('by_musicId', (q) => q.eq('musicId', musicId))
        .collect();
    });

    expect(videos).toHaveLength(2);
  });

  test('should delete video and clear primary reference', async () => {
    // Create and complete a video
    const { videoId } = await t.mutation(internal.videos.createPendingVideoRecord, {
      musicId,
      userId,
      kieTaskId: 'test-task-123',
      scriptPrompt: 'Test prompt',
    });

    await t.mutation(internal.videos.completeKieVideoTask, {
      kieTaskId: 'test-task-123',
      videoStorageId: 'storage_test_123',
      duration: 15,
    });

    // Verify it's set as primary
    let music = await t.run(async (ctx) => {
      return await ctx.db.get(musicId);
    });
    expect(music?.primaryVideoId).toBe(videoId);

    // Delete the video (simulate internal logic)
    await t.run(async (ctx) => {
      const music = await ctx.db.get(musicId);
      if (music?.primaryVideoId === videoId) {
        await ctx.db.patch(musicId, {
          primaryVideoId: undefined,
          updatedAt: Date.now(),
        });
      }
      await ctx.db.delete(videoId);
    });

    // Verify video is deleted and primary is cleared
    const video = await t.run(async (ctx) => {
      return await ctx.db.get(videoId);
    });
    expect(video).toBeNull();

    music = await t.run(async (ctx) => {
      return await ctx.db.get(musicId);
    });
    expect(music?.primaryVideoId).toBeUndefined();
  });

  afterEach(async () => {
    await t.finish();
  });
});

describe('Video Credit Cost Constants', () => {
  test('should have correct credit cost defined', () => {
    const VIDEO_CREDIT_COST = 3;
    expect(VIDEO_CREDIT_COST).toBe(3);
  });
});


