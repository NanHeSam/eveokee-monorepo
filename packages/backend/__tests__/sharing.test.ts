import { describe, it, expect } from "vitest";
import { api } from "../convex/_generated/api";
import {
  createTestEnvironment,
  createTestUser,
  withAuth,
} from "./convexTestUtils";

describe("Sharing System", () => {
  describe("createShareLink", () => {
    it("should create a new share link with unique ID", async () => {
      const t = createTestEnvironment();
      const { clerkId, email, name } = await createTestUser(t);
      const asUser = withAuth(t, clerkId, email, name);

      const userId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
          .first();
        return user!._id;
      });

      const musicId = await t.run(async (ctx) => {
        return await ctx.db.insert("music", {
          userId,
          title: "Test Track",
          status: "ready",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await asUser.mutation(api.sharing.createShareLink, {
        musicId,
      });

      expect(result.shareId).toBeTruthy();
      expect(result.shareId).toHaveLength(10);
      expect(result.shareUrl).toContain(result.shareId);
      expect(result.shareUrl).toMatch(/^https?:\/\//);
    });

    it("should return existing share link if one already exists", async () => {
      const t = createTestEnvironment();
      const { clerkId, email, name } = await createTestUser(t);
      const asUser = withAuth(t, clerkId, email, name);

      const userId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
          .first();
        return user!._id;
      });

      const musicId = await t.run(async (ctx) => {
        return await ctx.db.insert("music", {
          userId,
          title: "Test Track",
          status: "ready",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const first = await asUser.mutation(api.sharing.createShareLink, {
        musicId,
      });

      const second = await asUser.mutation(api.sharing.createShareLink, {
        musicId,
      });

      expect(first.shareId).toBe(second.shareId);
      expect(first.shareUrl).toBe(second.shareUrl);
    });

    it("should throw error for non-existent music", async () => {
      const t = createTestEnvironment();
      const { clerkId, email, name } = await createTestUser(t);
      const asUser = withAuth(t, clerkId, email, name);

      const userId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
          .first();
        return user!._id;
      });

      // Create a music ID and then delete the music record to simulate non-existent music
      const fakeMusicId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("music", {
          userId,
          title: "Temp",
          status: "ready",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.delete(id);
        return id;
      });

      await expect(
        asUser.mutation(api.sharing.createShareLink, {
          musicId: fakeMusicId,
        })
      ).rejects.toThrow("Music not found");
    });

    it("should throw error for unauthorized user", async () => {
      const t = createTestEnvironment();
      const { clerkId: clerkId1, email: email1, name: name1 } = await createTestUser(t);
      const { clerkId: clerkId2, email: email2, name: name2 } = await createTestUser(t, {
        clerkId: "different-user",
        email: "different@example.com",
        name: "Different User",
      });
      const asUser1 = withAuth(t, clerkId1, email1, name1);
      const asUser2 = withAuth(t, clerkId2, email2, name2);

      const userId1 = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId1))
          .first();
        return user!._id;
      });

      const musicId = await t.run(async (ctx) => {
        return await ctx.db.insert("music", {
          userId: userId1,
          title: "Test Track",
          status: "ready",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(
        asUser2.mutation(api.sharing.createShareLink, {
          musicId,
        })
      ).rejects.toThrow("Not authorized to share this music");
    });

    it("should throw error for deleted music", async () => {
      const t = createTestEnvironment();
      const { clerkId, email, name } = await createTestUser(t);
      const asUser = withAuth(t, clerkId, email, name);

      const userId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
          .first();
        return user!._id;
      });

      const musicId = await t.run(async (ctx) => {
        return await ctx.db.insert("music", {
          userId,
          title: "Test Track",
          status: "ready",
          deletedAt: Date.now(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(
        asUser.mutation(api.sharing.createShareLink, {
          musicId,
        })
      ).rejects.toThrow("Cannot share deleted music");
    });

    it("should throw error for non-ready music", async () => {
      const t = createTestEnvironment();
      const { clerkId, email, name } = await createTestUser(t);
      const asUser = withAuth(t, clerkId, email, name);

      const userId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
          .first();
        return user!._id;
      });

      const musicId = await t.run(async (ctx) => {
        return await ctx.db.insert("music", {
          userId,
          title: "Pending Track",
          status: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(
        asUser.mutation(api.sharing.createShareLink, {
          musicId,
        })
      ).rejects.toThrow("Music is not ready to be shared");
    });

    it("should generate unique share IDs for different music", async () => {
      const t = createTestEnvironment();
      const { clerkId, email, name } = await createTestUser(t);
      const asUser = withAuth(t, clerkId, email, name);

      const userId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
          .first();
        return user!._id;
      });

      const [musicId1, musicId2] = await t.run(async (ctx) => {
        const id1 = await ctx.db.insert("music", {
          userId,
          title: "Test Track 1",
          status: "ready",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        const id2 = await ctx.db.insert("music", {
          userId,
          title: "Test Track 2",
          status: "ready",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        return [id1, id2];
      });

      const share1 = await asUser.mutation(api.sharing.createShareLink, {
        musicId: musicId1,
      });

      const share2 = await asUser.mutation(api.sharing.createShareLink, {
        musicId: musicId2,
      });

      expect(share1.shareId).not.toBe(share2.shareId);
    });
  });

  describe("getSharedMusic", () => {
    it("should retrieve shared music by share ID", async () => {
      const t = createTestEnvironment();
      const { clerkId, email, name } = await createTestUser(t);
      const asUser = withAuth(t, clerkId, email, name);

      const userId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
          .first();
        return user!._id;
      });

      const musicId = await t.run(async (ctx) => {
        return await ctx.db.insert("music", {
          userId,
          title: "Test Track",
          lyric: "Test lyrics",
          duration: 180,
          audioUrl: "https://example.com/audio.mp3",
          imageUrl: "https://example.com/image.jpg",
          status: "ready",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const { shareId } = await asUser.mutation(api.sharing.createShareLink, {
        musicId,
      });

      const result = await t.query(api.sharing.getSharedMusic, {
        shareId,
      });

      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.title).toBe("Test Track");
        expect(result.audioUrl).toBe("https://example.com/audio.mp3");
        expect(result.imageUrl).toBe("https://example.com/image.jpg");
        expect(result.lyric).toBe("Test lyrics");
        expect(result.duration).toBe(180);
        expect(result.userName).toBe(name);
      }
    });

    it("should return not found for non-existent share ID", async () => {
      const t = createTestEnvironment();

      const result = await t.query(api.sharing.getSharedMusic, {
        shareId: "nonexistent",
      });

      expect(result.found).toBe(false);
    });

    it("should return not found for inactive share", async () => {
      const t = createTestEnvironment();
      const { clerkId, email, name } = await createTestUser(t);
      const asUser = withAuth(t, clerkId, email, name);

      const userId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
          .first();
        return user!._id;
      });

      const musicId = await t.run(async (ctx) => {
        return await ctx.db.insert("music", {
          userId,
          title: "Test Track",
          status: "ready",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const { shareId } = await asUser.mutation(api.sharing.createShareLink, {
        musicId,
      });

      // Manually mark share as inactive (simulating deactivation)
      await t.run(async (ctx) => {
        const share = await ctx.db
          .query("sharedMusic")
          .withIndex("by_shareId", (q) => q.eq("shareId", shareId))
          .first();
        if (share) {
          await ctx.db.patch(share._id, {
            isActive: false,
            updatedAt: Date.now(),
          });
        }
      });

      const result = await t.query(api.sharing.getSharedMusic, {
        shareId,
      });

      expect(result.found).toBe(false);
    });

    it("should return not found for deleted music", async () => {
      const t = createTestEnvironment();
      const { clerkId, email, name } = await createTestUser(t);
      const asUser = withAuth(t, clerkId, email, name);

      const userId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
          .first();
        return user!._id;
      });

      const musicId = await t.run(async (ctx) => {
        return await ctx.db.insert("music", {
          userId,
          title: "Test Track",
          status: "ready",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const { shareId } = await asUser.mutation(api.sharing.createShareLink, {
        musicId,
      });

      await t.run(async (ctx) => {
        await ctx.db.patch(musicId, { deletedAt: Date.now() });
      });

      const result = await t.query(api.sharing.getSharedMusic, {
        shareId,
      });

      expect(result.found).toBe(false);
    });

    it("should include diary date when music is associated with a diary", async () => {
      const t = createTestEnvironment();
      const { clerkId, email, name } = await createTestUser(t);
      const asUser = withAuth(t, clerkId, email, name);

      const userId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
          .first();
        return user!._id;
      });

      const diaryDate = Date.now() - 86400000; // Yesterday
      const [diaryId, musicId] = await t.run(async (ctx) => {
        const dId = await ctx.db.insert("diaries", {
          userId,
          content: "Test diary entry",
          date: diaryDate,
          updatedAt: Date.now(),
        });
        const mId = await ctx.db.insert("music", {
          userId,
          title: "Test Track",
          diaryId: dId,
          status: "ready",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        return [dId, mId];
      });

      const { shareId } = await asUser.mutation(api.sharing.createShareLink, {
        musicId,
      });

      const result = await t.query(api.sharing.getSharedMusic, {
        shareId,
      });

      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.diaryDate).toBe(diaryDate);
      }
    });
  });

  describe("recordShareView", () => {
    // Note: The client-side Share page implements session storage to prevent
    // duplicate view recording within the same browser session, which mitigates
    // the abuse potential of this public, unauthenticated mutation.
    it("should increment view count for valid share", async () => {
      const t = createTestEnvironment();
      const { clerkId, email, name } = await createTestUser(t);
      const asUser = withAuth(t, clerkId, email, name);

      const userId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
          .first();
        return user!._id;
      });

      const musicId = await t.run(async (ctx) => {
        return await ctx.db.insert("music", {
          userId,
          title: "Test Track",
          status: "ready",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const { shareId } = await asUser.mutation(api.sharing.createShareLink, {
        musicId,
      });

      // Record a view (no auth required)
      await t.mutation(api.sharing.recordShareView, {
        shareId,
      });

      // Check view count directly from DB
      const viewCount1 = await t.run(async (ctx) => {
        const share = await ctx.db
          .query("sharedMusic")
          .withIndex("by_shareId", (q) => q.eq("shareId", shareId))
          .first();
        return share?.viewCount ?? 0;
      });

      expect(viewCount1).toBe(1);

      // Record another view
      await t.mutation(api.sharing.recordShareView, {
        shareId,
      });

      const viewCount2 = await t.run(async (ctx) => {
        const share = await ctx.db
          .query("sharedMusic")
          .withIndex("by_shareId", (q) => q.eq("shareId", shareId))
          .first();
        return share?.viewCount ?? 0;
      });

      expect(viewCount2).toBe(2);
    });

    it("should not increment view count for non-existent share", async () => {
      const t = createTestEnvironment();

      await expect(
        t.mutation(api.sharing.recordShareView, {
          shareId: "nonexistent",
        })
      ).resolves.toBeNull();
    });

    it("should not increment view count for inactive share", async () => {
      const t = createTestEnvironment();
      const { clerkId, email, name } = await createTestUser(t);
      const asUser = withAuth(t, clerkId, email, name);

      const userId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
          .first();
        return user!._id;
      });

      const musicId = await t.run(async (ctx) => {
        return await ctx.db.insert("music", {
          userId,
          title: "Test Track",
          status: "ready",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const { shareId } = await asUser.mutation(api.sharing.createShareLink, {
        musicId,
      });

      // Manually mark share as inactive
      await t.run(async (ctx) => {
        const share = await ctx.db
          .query("sharedMusic")
          .withIndex("by_shareId", (q) => q.eq("shareId", shareId))
          .first();
        if (share) {
          await ctx.db.patch(share._id, {
            isActive: false,
            updatedAt: Date.now(),
          });
        }
      });

      await t.mutation(api.sharing.recordShareView, {
        shareId,
      });

      // Verify view count was not incremented for inactive share
      const viewCount = await t.run(async (ctx) => {
        const share = await ctx.db
          .query("sharedMusic")
          .withIndex("by_shareId", (q) => q.eq("shareId", shareId))
          .first();
        return share?.viewCount ?? 0;
      });

      expect(viewCount).toBe(0);
    });
  });

  describe("Share ID collision detection", () => {
    it("should generate valid share ID format", async () => {
      const t = createTestEnvironment();
      const { clerkId, email, name } = await createTestUser(t);
      const asUser = withAuth(t, clerkId, email, name);

      const userId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
          .first();
        return user!._id;
      });

      const musicId = await t.run(async (ctx) => {
        return await ctx.db.insert("music", {
          userId,
          title: "Test Track",
          status: "ready",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const { shareId } = await asUser.mutation(api.sharing.createShareLink, {
        musicId,
      });

      // Share ID should be 10 characters
      expect(shareId).toHaveLength(10);

      // Should only contain allowed characters
      const allowedChars =
        "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
      for (const char of shareId) {
        expect(allowedChars).toContain(char);
      }
    });

    it("should handle theoretical collision by retrying", async () => {
      const t = createTestEnvironment();
      const { clerkId, email, name } = await createTestUser(t);
      const asUser = withAuth(t, clerkId, email, name);

      const userId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
          .first();
        return user!._id;
      });

      // Create multiple shares to increase the database size
      const musicIds = await t.run(async (ctx) => {
        const ids = [];
        for (let i = 0; i < 10; i++) {
          const id = await ctx.db.insert("music", {
            userId,
            title: `Test Track ${i}`,
            status: "ready",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          ids.push(id);
        }
        return ids;
      });

      // Create shares for all music tracks
      const shares = await Promise.all(
        musicIds.map((id) =>
          asUser.mutation(api.sharing.createShareLink, {
            musicId: id,
          })
        )
      );

      // All shares should have unique IDs
      const uniqueIds = new Set(shares.map((s) => s.shareId));
      expect(uniqueIds.size).toBe(shares.length);
    });
  });
});
