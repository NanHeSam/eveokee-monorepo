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

  it.each([false, true])("uses populated URL aliases when legacy fields are empty (source URLs: %s)", async (includeSource) => {
    const t = createTestEnvironment();
    const { userId } = await createTestUser(t);
    const diaryId = await createTestDiary(t, userId, "An evening walk");
    await t.mutation(internal.music.createPendingMusicRecords, {
      diaryId, userId, taskId: "empty-legacy-task", prompt: "An evening walk",
      model: "V5", trackCount: 1,
    });
    const parsed = parseSunoPayload({
      data: { taskId: "empty-legacy-task", callbackType: "complete", data: [{
        id: "alias-track", audio_url: "", audioUrl: "https://example.com/audio.mp3",
        image_url: "", imageUrl: "https://example.com/image.jpg",
        source_audio_url: "", source_image_url: "",
        ...(includeSource ? {
          sourceAudioUrl: "https://example.com/source.mp3",
          sourceImageUrl: "https://example.com/source.jpg",
        } : {}),
      }] },
    });
    if (!parsed.success) throw new Error(parsed.error);
    await t.mutation(internal.music.completeSunoTask, {
      taskId: parsed.data.taskId, tracks: parsed.data.tracks,
    });
    const songs = await t.run((ctx) => ctx.db.query("music").collect());
    expect(songs[0].status).toBe("ready");
    expect(songs[0].audioUrl).toBe(includeSource
      ? "https://example.com/source.mp3" : "https://example.com/audio.mp3");
    expect(songs[0].imageUrl).toBe(includeSource
      ? "https://example.com/source.jpg" : "https://example.com/image.jpg");
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

describe("Kie Suno callbacks", () => {
  const track = { id: "kie-clip", audio_url: "https://musicfile.kie.ai/song.mp3", stream_audio_url: "https://musicfile.kie.ai/stream", image_url: "https://tempfile.aiquickdraw.com/cover.jpg" };

  it("accepts staged Kie tracks without source_* fields", () => {
    expect(parseSunoPayload({ code: 200, data: { callbackType: "complete", task_id: "kie-task", data: [track] } })).toEqual({
      success: true, data: { code: 200, callbackType: "complete", taskId: "kie-task", tracks: [track] },
    });
  });

  it.each(["text", "first"])("preserves intermediate stage %s", (callbackType) => {
    const parsed = parseSunoPayload({ code: 200, data: { callbackType, task_id: "kie-task" } });
    expect(parsed.success && parsed.data.callbackType).toBe(callbackType);
  });

  it("accepts unified jobs callbacks with resultJson", () => {
    const parsed = parseSunoPayload({ code: 200, data: { state: "success", taskId: "kie-task", resultJson: JSON.stringify({ data: [track] }) } });
    expect(parsed).toEqual({ success: true, data: { code: 200, callbackType: "complete", taskId: "kie-task", tracks: [track] } });
  });

  it.each([
    { code: 501, data: { callbackType: "complete", task_id: "kie-task" } },
    { code: 200, data: { state: "fail", taskId: "kie-task", failCode: "500", failMsg: "Failed" } },
    { code: 501, data: { taskId: "kie-task" } },
  ])("accepts failure callbacks without tracks", (payload) => {
    const parsed = parseSunoPayload(payload);
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error(parsed.error);
    expect(parsed.data.code).not.toBe(200);
    expect(parsed.data.tracks).toEqual([]);
  });

  it("handles malformed resultJson without forwarding it", () => {
    const parsed = parseSunoPayload({ code: 200, data: { state: "success", taskId: "kie-task", resultJson: "invalid" } });
    expect(parsed.success && parsed.data.tracks).toEqual([]);
  });
});
