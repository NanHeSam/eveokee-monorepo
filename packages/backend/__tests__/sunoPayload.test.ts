import { describe, expect, it } from "vitest";
import { internal } from "../convex/_generated/api";
import { parseSunoPayload } from "../convex/models/webhooks/suno";
import { createTestDiary, createTestEnvironment, createTestUser } from "./convexTestUtils";

describe("Suno callback normalization", () => {
  it("accepts provider camelCase fields without forwarding extras to Convex", async () => {
    const t = createTestEnvironment();
    const { userId } = await createTestUser(t);
    const diaryId = await createTestDiary(t, userId, "A sunny afternoon");
    await t.mutation(internal.music.createPendingMusicRecords, {
      diaryId, userId, taskId: "camel-task", prompt: "A sunny afternoon",
      model: "V5", trackCount: 1,
    });
    const parsed = parseSunoPayload({
      code: 200,
      data: {
        taskId: "camel-task", callbackType: "complete",
        data: [{
          id: "track-1", title: "Sunny Afternoon", duration: 90,
          audioUrl: "https://example.com/song.mp3",
          audio_url: "https://example.com/song.mp3",
          imageUrl: "https://example.com/cover.jpg",
          modelName: "chirp-hawk", sourceAudioUrl: "",
          sourceStreamAudioUrl: "https://example.com/stream.mp3",
          createTime: "2026-09-10T00:00:00Z", providerExtra: true,
        }],
      },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error(parsed.error);
    expect(parsed.data.tracks[0]).not.toHaveProperty("audioUrl");
    expect(parsed.data.tracks[0]).not.toHaveProperty("providerExtra");
    expect(parsed.data.tracks[0].image_url).toBe("https://example.com/cover.jpg");
    await t.mutation(internal.music.completeSunoTask, {
      taskId: parsed.data.taskId, tracks: parsed.data.tracks,
    });
    const songs = await t.run((ctx) => ctx.db.query("music").collect());
    expect(songs[0].status).toBe("ready");
    expect(songs[0].audioUrl).toBe("https://example.com/song.mp3");
    expect(songs[0].imageUrl).toBe("https://example.com/cover.jpg");
    const diary = await t.run((ctx) => ctx.db.get(diaryId));
    expect(diary?.primaryMusicId).toBe(songs[0]._id);
  });

  it("preserves legacy snake_case fields and ignores invalid optional values", () => {
    const parsed = parseSunoPayload({
      data: { task_id: "legacy-task", callbackType: "complete", data: [{
        id: "legacy-track", audio_url: "https://example.com/legacy.mp3",
        audioUrl: "https://example.com/other.mp3", image_url: null,
        imageUrl: "https://example.com/image.jpg", duration: "invalid",
        model_name: "V5", createTime: 1234,
      }] },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error(parsed.error);
    expect(parsed.data.tracks).toEqual([{
      id: "legacy-track", audio_url: "https://example.com/legacy.mp3",
      image_url: "https://example.com/image.jpg", model_name: "V5", createTime: 1234,
    }]);
  });
});
