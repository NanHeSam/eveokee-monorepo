import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KieClient, type KieGenerateRequest } from "../convex/integrations/kie/client";
import { KieMusicClient } from "../convex/integrations/kie/musicClient";
import { KIE_MODEL_IMAGE_TO_VIDEO, KIE_MODEL_TEXT_TO_VIDEO } from "../convex/utils/constants/video";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ code: 200, data: { taskId: "task-123" } }), {
    status: 200, headers: { "Content-Type": "application/json" },
  }));
});
afterEach(() => vi.unstubAllGlobals());

function sentBody() {
  return JSON.parse(fetchMock.mock.calls[0][1].body);
}

const callbackUrl = "https://test.convex.site/callback?token=secret";

describe("Seedance 2 Fast requests", () => {
  it("submits silent portrait text-to-video without requiring an image", async () => {
    const client = new KieClient({ apiKey: "test", callbackUrl });
    expect(await client.generateVideo({ prompt: "A quiet landscape", model: KIE_MODEL_TEXT_TO_VIDEO })).toEqual({ taskId: "task-123" });
    expect(sentBody()).toEqual({
      model: "bytedance/seedance-2-fast", callBackUrl: callbackUrl,
      input: { prompt: "A quiet landscape", duration: 10, aspect_ratio: "9:16", resolution: "720p", generate_audio: false },
    });
  });

  it("conditions image-to-video on the photo as first frame using the same model", async () => {
    await new KieClient({ apiKey: "test", callbackUrl }).generateVideo({
      prompt: "Continue the scene", model: KIE_MODEL_IMAGE_TO_VIDEO,
      image_url: "https://example.com/photo.jpg", aspect_ratio: "landscape", duration: "5", resolution: "1080p", remove_watermark: true,
    });
    expect(sentBody()).toEqual({
      model: "bytedance/seedance-2-fast", callBackUrl: callbackUrl,
      input: {
        prompt: "Continue the scene", first_frame_url: "https://example.com/photo.jpg", duration: 5,
        aspect_ratio: "16:9", resolution: "720p", generate_audio: false,
      },
    });
  });

  it.each<KieGenerateRequest["model"]>(["sora-2-text-to-video", "bytedance/v1-pro-fast-image-to-video"])("maps legacy %s callers to the supported model", async (model) => {
    await new KieClient({ apiKey: "test", callbackUrl }).generateVideo({
      prompt: "A scene", model, ...(model === "bytedance/v1-pro-fast-image-to-video" ? { image_url: "https://example.com/photo.jpg" } : {}),
    });
    expect(sentBody().model).toBe("bytedance/seedance-2-fast");
    expect(sentBody().input.generate_audio).toBe(false);
  });

  it("preserves validation for legacy image callers without a photo", async () => {
    await expect(new KieClient({ apiKey: "test", callbackUrl }).generateVideo({
      prompt: "A scene", model: "bytedance/v1-pro-fast-image-to-video",
    })).rejects.toThrow("require an image_url");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves provider failure handling", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 500, msg: "Unavailable" }), { status: 200 }));
    await expect(new KieClient({ apiKey: "test", callbackUrl }).generateVideo({ prompt: "A scene" })).rejects.toThrow("error code 500");
  });
});

describe("Suno V6 requests", () => {
  it("requests a full song rather than V6's 20-second default", async () => {
    expect(await new KieMusicClient({ apiKey: "test", callbackUrl }).generateMusic({
      prompt: "[Verse] Clear skies", style: "lo-fi", title: "Skies",
    })).toEqual({ taskId: "task-123" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.kie.ai/api/v1/jobs/createTask");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer test");
    expect(sentBody()).toEqual({
      model: "ai-music-api/generate", callBackUrl: callbackUrl,
      input: { lyrics: "[Verse] Clear skies", style: "lo-fi", title: "Skies", custom_mode: true,
        instrumental: false, model: "V6", duration: 120 },
    });
  });
});

describe("Kie music responses", () => {
  it.each([401, 402, 429])("rejects HTTP 200 with provider code %s without retrying", async (code) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code, msg: "Rejected" }), { status: 200 }));
    await expect(new KieMusicClient({ apiKey: "test", callbackUrl }).generateMusic({
      prompt: "lyrics", title: "Song", style: "folk",
    })).rejects.toThrow(`error code ${code}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["response", "resultJson"])("reads structured tracks from %s in recordInfo", async (format) => {
    const tracks = [{ id: "clip-1", audio_url: "https://musicfile.kie.ai/song.mp3", image_url: "https://tempfile.aiquickdraw.com/cover.jpg", title: "Song" }];
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 200, data: {
      state: "success", ...(format === "response" ? { response: { data: tracks } } : { resultJson: JSON.stringify({ data: tracks }) }),
    } })));
    const info = await new KieMusicClient({ apiKey: "test", callbackUrl }).getRecordInfo("task/123");
    expect(info.status).toBe("success");
    expect(info.tracks[0]).toMatchObject({ id: "clip-1", audioUrl: tracks[0].audio_url, imageUrl: tracks[0].image_url });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.kie.ai/api/v1/jobs/recordInfo?taskId=task%2F123");
  });

  it("fetches timed lyrics synchronously through Kie with snake_case identifiers", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 200, data: { code: 200, data: {
      alignedWords: [{ word: "Hello", success: true, startS: 0, endS: 1, palign: 0 }], waveformData: [0, 1], hootCer: 0,
    } } })));
    const lyrics = await new KieMusicClient({ apiKey: "test", callbackUrl }).getTimestampedLyrics({ taskId: "task", audioId: "clip" });
    expect(sentBody()).toEqual({ model: "ai-music-api/timeStamped-lyrics", input: { task_id: "task", audio_id: "clip" } });
    expect(lyrics.alignedWords).toEqual([{ word: "Hello", startS: 0, endS: 1, palign: 0 }]);
  });

  it("rejects a nested timed-lyrics error even with outer code 200", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 200, data: { code: 402, msg: "No credits" } })));
    await expect(new KieMusicClient({ apiKey: "test", callbackUrl }).getTimestampedLyrics({ taskId: "task", audioId: "clip" })).rejects.toThrow("error code 402");
  });
});
