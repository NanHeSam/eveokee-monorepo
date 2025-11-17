import { describe, it, expect } from "vitest";
import { api, internal } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import {
  createTestEnvironment,
  createTestUser,
  withAuth,
} from "./convexTestUtils";

describe("User Songs System", () => {
  describe("linkUserToMusic", () => {
    it("should link a user to a music track with ownershipType 'owned'", async () => {
      const t = createTestEnvironment();
      const { clerkId, email, name } = await createTestUser(t);

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
          musicIndex: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const userSongId = await t.run(
        async (ctx) =>
          await ctx.runMutation(internal.userSongs.linkUserToMusic, {
            userId,
            musicId,
            musicIndex: 0,
            ownershipType: "owned",
          })
      );

      expect(userSongId).toBeTruthy();

      const userSong = await t.run(async (ctx) => {
        return await ctx.db.get(userSongId) as Doc<"userSongs"> | null;
      });

      expect(userSong).toBeTruthy();
      expect(userSong?.userId).toBe(userId);
      expect(userSong?.musicId).toBe(musicId);
      expect(userSong?.ownershipType).toBe("owned");
      expect(userSong?.linkedFromMusicIndex).toBe(0);
    });

    it("should be idempotent - return existing link if already exists", async () => {
      const t = createTestEnvironment();
      const { clerkId, email, name } = await createTestUser(t);

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
          musicIndex: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const first = await t.run(
        async (ctx) =>
          await ctx.runMutation(internal.userSongs.linkUserToMusic, {
            userId,
            musicId,
            musicIndex: 0,
            ownershipType: "owned",
          })
      );

      const second = await t.run(
        async (ctx) =>
          await ctx.runMutation(internal.userSongs.linkUserToMusic, {
            userId,
            musicId,
            musicIndex: 0,
            ownershipType: "owned",
          })
      );

      expect(first).toBe(second);
    });

    it("should reject linking musicIndex !== 0 tracks", async () => {
      const t = createTestEnvironment();
      const { clerkId, email, name } = await createTestUser(t);

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
          musicIndex: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(
        t.run(
          async (ctx) =>
            await ctx.runMutation(internal.userSongs.linkUserToMusic, {
              userId,
              musicId,
              musicIndex: 1,
              ownershipType: "owned",
            })
        )
      ).rejects.toThrow("Only musicIndex 0 tracks should be linked");
    });
  });

  describe("addFromShare", () => {
    it("should add a shared music track to user's library", async () => {
      const t = createTestEnvironment();
      const { clerkId: ownerClerkId, email: ownerEmail, name: ownerName } =
        await createTestUser(t);
      const { clerkId: userClerkId, email: userEmail, name: userName } =
        await createTestUser(t);

      const ownerAsUser = withAuth(t, ownerClerkId, ownerEmail, ownerName);
      const asUser = withAuth(t, userClerkId, userEmail, userName);

      const ownerUserId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", ownerClerkId))
          .first();
        return user!._id;
      });

      const musicId = await t.run(async (ctx) => {
        return await ctx.db.insert("music", {
          userId: ownerUserId,
          title: "Shared Track",
          status: "ready",
          musicIndex: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const shareResult = await ownerAsUser.mutation(
        api.sharing.createShareLink,
        {
          musicId,
        }
      );

      const addResult = await asUser.mutation(api.userSongs.addFromShare, {
        shareId: shareResult.shareId,
      });

      expect(addResult.success).toBe(true);
      expect(addResult.alreadyAdded).toBe(false);

      // Verify userSong was created
      const userSongs = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", userClerkId))
          .first();
        return await ctx.db
          .query("userSongs")
          .withIndex("by_userId", (q) => q.eq("userId", user!._id))
          .collect();
      });

      expect(userSongs.length).toBe(1);
      expect(userSongs[0].musicId).toBe(musicId);
      expect(userSongs[0].ownershipType).toBe("shared");
    });

    it("should prevent duplicate additions", async () => {
      const t = createTestEnvironment();
      const { clerkId: ownerClerkId, email: ownerEmail, name: ownerName } =
        await createTestUser(t);
      const { clerkId: userClerkId, email: userEmail, name: userName } =
        await createTestUser(t);

      const ownerAsUser = withAuth(t, ownerClerkId, ownerEmail, ownerName);
      const asUser = withAuth(t, userClerkId, userEmail, userName);

      const ownerUserId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", ownerClerkId))
          .first();
        return user!._id;
      });

      const musicId = await t.run(async (ctx) => {
        return await ctx.db.insert("music", {
          userId: ownerUserId,
          title: "Shared Track",
          status: "ready",
          musicIndex: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const shareResult = await ownerAsUser.mutation(
        api.sharing.createShareLink,
        {
          musicId,
        }
      );

      const first = await asUser.mutation(api.userSongs.addFromShare, {
        shareId: shareResult.shareId,
      });

      const second = await asUser.mutation(api.userSongs.addFromShare, {
        shareId: shareResult.shareId,
      });

      expect(first.success).toBe(true);
      expect(first.alreadyAdded).toBe(false);
      expect(second.success).toBe(true);
      expect(second.alreadyAdded).toBe(true);

      // Verify only one userSong exists
      const userSongs = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", userClerkId))
          .first();
        return await ctx.db
          .query("userSongs")
          .withIndex("by_userId", (q) => q.eq("userId", user!._id))
          .collect();
      });

      expect(userSongs.length).toBe(1);
    });

    it("should reject inactive share links", async () => {
      const t = createTestEnvironment();
      const { clerkId: ownerClerkId, email: ownerEmail, name: ownerName } =
        await createTestUser(t);
      const { clerkId: userClerkId, email: userEmail, name: userName } =
        await createTestUser(t);

      const ownerAsUser = withAuth(t, ownerClerkId, ownerEmail, ownerName);
      const asUser = withAuth(t, userClerkId, userEmail, userName);

      const ownerUserId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", ownerClerkId))
          .first();
        return user!._id;
      });

      const musicId = await t.run(async (ctx) => {
        return await ctx.db.insert("music", {
          userId: ownerUserId,
          title: "Shared Track",
          status: "ready",
          musicIndex: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const shareResult = await ownerAsUser.mutation(
        api.sharing.createShareLink,
        {
          musicId,
        }
      );

      // Deactivate the share
      const sharedMusic = await t.run(async (ctx) => {
        return await ctx.db
          .query("sharedMusic")
          .withIndex("by_shareId", (q) => q.eq("shareId", shareResult.shareId))
          .first();
      });

      await t.run(async (ctx) => {
        await ctx.db.patch(sharedMusic!._id, {
          isActive: false,
          updatedAt: Date.now(),
        });
      });

      await expect(
        asUser.mutation(api.userSongs.addFromShare, {
          shareId: shareResult.shareId,
        })
      ).rejects.toThrow("Share link not found or inactive");
    });
  });

  describe("listPlaylistMusic with userSongs", () => {
    it("should return owned tracks from userSongs", async () => {
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
          title: "My Track",
          status: "ready",
          musicIndex: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Link via userSongs
      await t.run(
        async (ctx) =>
          await ctx.runMutation(internal.userSongs.linkUserToMusic, {
            userId,
            musicId,
            musicIndex: 0,
            ownershipType: "owned",
          })
      );

      const playlist = await asUser.query(api.music.listPlaylistMusic, {});

      expect(playlist.length).toBe(1);
      expect(playlist[0]._id).toBe(musicId);
      expect(playlist[0].title).toBe("My Track");
      expect(playlist[0].ownershipType).toBe("owned");
    });

    it("should return shared tracks from userSongs", async () => {
      const t = createTestEnvironment();
      const { clerkId: ownerClerkId, email: ownerEmail, name: ownerName } =
        await createTestUser(t);
      const { clerkId: userClerkId, email: userEmail, name: userName } =
        await createTestUser(t);

      const ownerAsUser = withAuth(t, ownerClerkId, ownerEmail, ownerName);
      const asUser = withAuth(t, userClerkId, userEmail, userName);

      const ownerUserId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", ownerClerkId))
          .first();
        return user!._id;
      });

      const musicId = await t.run(async (ctx) => {
        return await ctx.db.insert("music", {
          userId: ownerUserId,
          title: "Shared Track",
          status: "ready",
          musicIndex: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const shareResult = await ownerAsUser.mutation(
        api.sharing.createShareLink,
        {
          musicId,
        }
      );

      await asUser.mutation(api.userSongs.addFromShare, {
        shareId: shareResult.shareId,
      });

      const playlist = await asUser.query(api.music.listPlaylistMusic, {});

      expect(playlist.length).toBe(1);
      expect(playlist[0]._id).toBe(musicId);
      expect(playlist[0].title).toBe("Shared Track");
      expect(playlist[0].ownershipType).toBe("shared");
      expect(playlist[0].addedViaShareId).toBe(shareResult.shareId);
    });

    it("should hide tracks from inactive shares", async () => {
      const t = createTestEnvironment();
      const { clerkId: ownerClerkId, email: ownerEmail, name: ownerName } =
        await createTestUser(t);
      const { clerkId: userClerkId, email: userEmail, name: userName } =
        await createTestUser(t);

      const ownerAsUser = withAuth(t, ownerClerkId, ownerEmail, ownerName);
      const asUser = withAuth(t, userClerkId, userEmail, userName);

      const ownerUserId = await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", ownerClerkId))
          .first();
        return user!._id;
      });

      const musicId = await t.run(async (ctx) => {
        return await ctx.db.insert("music", {
          userId: ownerUserId,
          title: "Shared Track",
          status: "ready",
          musicIndex: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const shareResult = await ownerAsUser.mutation(
        api.sharing.createShareLink,
        {
          musicId,
        }
      );

      await asUser.mutation(api.userSongs.addFromShare, {
        shareId: shareResult.shareId,
      });

      // Verify track is in playlist
      let playlist = await asUser.query(api.music.listPlaylistMusic, {});
      expect(playlist.length).toBe(1);

      // Deactivate the share
      const sharedMusic = await t.run(async (ctx) => {
        return await ctx.db
          .query("sharedMusic")
          .withIndex("by_shareId", (q) => q.eq("shareId", shareResult.shareId))
          .first();
      });

      await t.run(async (ctx) => {
        await ctx.db.patch(sharedMusic!._id, {
          isActive: false,
          updatedAt: Date.now(),
        });
      });

      // Verify track is hidden from playlist
      playlist = await asUser.query(api.music.listPlaylistMusic, {});
      expect(playlist.length).toBe(0);
    });

    it("should include pending tracks for loading states", async () => {
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
          musicIndex: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Link via userSongs
      await t.run(
        async (ctx) =>
          await ctx.runMutation(internal.userSongs.linkUserToMusic, {
            userId,
            musicId,
            musicIndex: 0,
            ownershipType: "owned",
          })
      );

      const playlist = await asUser.query(api.music.listPlaylistMusic, {});

      expect(playlist.length).toBe(1);
      expect(playlist[0]._id).toBe(musicId);
      expect(playlist[0].status).toBe("pending");
    });
  });
});

