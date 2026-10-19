import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KieClient, type KieGenerateRequest } from "../convex/integrations/kie/client";
import { SunoClient } from "../convex/integrations/suno/client";
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
    expect(await new SunoClient({ apiKey: "test", callbackUrl }).generateMusic({
      prompt: "[Verse] Clear skies", style: "lo-fi", title: "Skies",
    })).toEqual({ taskId: "task-123" });
    expect(sentBody()).toEqual({
      prompt: "[Verse] Clear skies", style: "lo-fi", title: "Skies", customMode: true,
      instrumental: false, model: "V6", duration: 120, callBackUrl: callbackUrl,
    });
  });
});
