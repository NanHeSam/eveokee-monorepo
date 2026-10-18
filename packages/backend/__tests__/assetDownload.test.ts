import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadAssetBounded } from "../convex/utils/assetDownload";
import { isAllowedAssetUrl, isAllowedVideoUrl } from "../convex/utils/musicAssets";

const OPTIONS = {
  isAllowedUrl: isAllowedVideoUrl,
  maxBytes: 1024,
  timeoutMs: 1000,
};

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  const spy = vi.fn(async (input: RequestInfo | URL) => handler(String(input)));
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isAllowedVideoUrl", () => {
  it("allows https Kie result hosts only", () => {
    expect(isAllowedVideoUrl("https://tempfile.aiquickdraw.com/v/abc.mp4")).toBe(true);
    expect(isAllowedVideoUrl("https://file.aiquickdraw.com/v/abc.mp4")).toBe(true);
    expect(isAllowedVideoUrl("http://tempfile.aiquickdraw.com/v/abc.mp4")).toBe(false);
    expect(isAllowedVideoUrl("https://tempfile.aiquickdraw.com:8443/v/abc.mp4")).toBe(false);
    expect(isAllowedVideoUrl("https://aiquickdraw.com.evil.example/v.mp4")).toBe(false);
    expect(isAllowedVideoUrl("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isAllowedVideoUrl("https://cdn1.suno.ai/a.mp4")).toBe(false);
  });

  it("keeps the music allowlist unchanged", () => {
    expect(isAllowedAssetUrl("https://cdn1.suno.ai/a.mp3")).toBe(true);
    expect(isAllowedAssetUrl("https://tempfile.kie.ai/a.mp3")).toBe(false);
  });
});

describe("downloadAssetBounded", () => {
  it("downloads an allowed video", async () => {
    const spy = mockFetch(() => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "video/mp4" } }));
    const result = await downloadAssetBounded("https://tempfile.aiquickdraw.com/v.mp4", "video", OPTIONS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.blob.size).toBe(3);
      expect(result.blob.type).toBe("video/mp4");
    }
    expect(spy).toHaveBeenCalledWith("https://tempfile.aiquickdraw.com/v.mp4", expect.objectContaining({ redirect: "manual" }));
  });

  it("refuses a disallowed host without fetching", async () => {
    const spy = mockFetch(() => new Response("x"));
    const result = await downloadAssetBounded("https://evil.example/v.mp4", "video", OPTIONS);
    expect(result).toEqual({ ok: false, reason: "URL host not allowed" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("refuses a declared length over the cap", async () => {
    mockFetch(() => new Response(new Uint8Array(10), { headers: { "content-type": "video/mp4", "content-length": "999999" } }));
    const result = await downloadAssetBounded("https://tempfile.aiquickdraw.com/v.mp4", "video", OPTIONS);
    expect(result).toEqual({ ok: false, reason: "Declared size exceeds limit" });
  });

  it("refuses a streamed body that exceeds the cap without a content-length", async () => {
    mockFetch(() => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (let i = 0; i < 5; i++) controller.enqueue(new Uint8Array(400));
          controller.close();
        },
      });
      return new Response(stream, { headers: { "content-type": "video/mp4" } });
    });
    const result = await downloadAssetBounded("https://tempfile.aiquickdraw.com/v.mp4", "video", OPTIONS);
    expect(result).toEqual({ ok: false, reason: "Response size exceeds limit" });
  });

  it("refuses non-video content types for video", async () => {
    mockFetch(() => new Response("<html>", { headers: { "content-type": "text/html" } }));
    expect(await downloadAssetBounded("https://tempfile.aiquickdraw.com/v.mp4", "video", OPTIONS)).toMatchObject({ ok: false });
    mockFetch(() => new Response(new Uint8Array(3), { headers: { "content-type": "image/png" } }));
    expect(await downloadAssetBounded("https://tempfile.aiquickdraw.com/v.mp4", "video", OPTIONS)).toMatchObject({ ok: false });
  });

  it("follows a redirect only to an allowed host", async () => {
    const spy = mockFetch((url) => {
      if (url.includes("/start")) {
        return new Response(null, { status: 302, headers: { location: "https://file.aiquickdraw.com/final.mp4" } });
      }
      return new Response(new Uint8Array([9]), { headers: { "content-type": "video/mp4" } });
    });
    const ok = await downloadAssetBounded("https://tempfile.aiquickdraw.com/start", "video", OPTIONS);
    expect(ok).toMatchObject({ ok: true, finalUrl: "https://file.aiquickdraw.com/final.mp4" });
    expect(spy).toHaveBeenCalledTimes(2);

    const evil = mockFetch(() => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } }));
    const refused = await downloadAssetBounded("https://tempfile.aiquickdraw.com/start", "video", OPTIONS);
    expect(refused).toEqual({ ok: false, reason: "Redirect target not allowed" });
    expect(evil).toHaveBeenCalledTimes(1);
  });

  it("stops after too many redirects", async () => {
    mockFetch(() => new Response(null, { status: 302, headers: { location: "/again" } }));
    const result = await downloadAssetBounded("https://tempfile.aiquickdraw.com/start", "video", OPTIONS);
    expect(result).toEqual({ ok: false, reason: "Too many or invalid redirects" });
  });

  it("times out", async () => {
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      }),
    );
    const result = await downloadAssetBounded("https://tempfile.aiquickdraw.com/v.mp4", "video", { ...OPTIONS, timeoutMs: 10 });
    expect(result).toEqual({ ok: false, reason: "Download timed out after 10ms" });
  });

  it("keeps accepting octet-stream audio for music", async () => {
    mockFetch(() => new Response(new Uint8Array([1]), { headers: { "content-type": "application/octet-stream" } }));
    const result = await downloadAssetBounded("https://cdn1.suno.ai/a.mp3", "audio", { ...OPTIONS, isAllowedUrl: isAllowedAssetUrl });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.blob.type).toBe("audio/mpeg");
  });
});
