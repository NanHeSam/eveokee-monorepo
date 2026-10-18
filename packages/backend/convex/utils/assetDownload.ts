/**
 * Bounded download of provider-generated assets (audio, cover art, video).
 *
 * URLs come from provider callbacks or provider records, so they are treated
 * as untrusted: the host must be on an https allowlist (re-checked on every
 * redirect hop), the request has a timeout, the content type must plausibly
 * match, and the body is streamed with a hard byte cap rather than buffered
 * blindly. Free of Convex imports so it can be shared and unit-tested.
 */

export type AssetKind = "audio" | "image" | "video";

export interface BoundedDownloadOptions {
  /** Host/protocol policy; checked for the initial URL and every redirect target. */
  isAllowedUrl: (url: string) => boolean;
  maxBytes: number;
  timeoutMs: number;
  /** Redirect hops to follow (each target re-validated). Defaults to 3. */
  maxRedirects?: number;
}

export type BoundedDownloadResult =
  | { ok: true; blob: Blob; finalUrl: string }
  | { ok: false; reason: string };

const DEFAULT_MAX_REDIRECTS = 3;

const FALLBACK_TYPES: Record<AssetKind, string> = {
  audio: "audio/mpeg",
  image: "image/jpeg",
  video: "video/mp4",
};

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/**
 * Reject content types that are clearly not the expected media. Some CDNs
 * serve media as application/octet-stream, so that (and a missing header) is
 * accepted; for video, any other non-video type is refused.
 */
function isAcceptableContentType(contentType: string, kind: AssetKind): boolean {
  if (contentType.startsWith("text/") || contentType.includes("json") || contentType.includes("xml")) {
    return false;
  }
  if (kind === "video") {
    return (
      contentType === "" ||
      contentType.startsWith("video/") ||
      contentType.startsWith("application/octet-stream") ||
      contentType.startsWith("binary/octet-stream")
    );
  }
  return true;
}

async function readWithLimit(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<{ ok: true; bytes: Uint8Array<ArrayBuffer> } | { ok: false }> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return { ok: false };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

/**
 * Download a URL into a Blob under the given bounds. Never throws; failures
 * come back as `{ ok: false, reason }` so callers can try another candidate or
 * record why the asset could not be stored.
 */
export async function downloadAssetBounded(
  url: string,
  kind: AssetKind,
  options: BoundedDownloadOptions,
): Promise<BoundedDownloadResult> {
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    let currentUrl = url;
    for (let hop = 0; ; hop++) {
      if (!options.isAllowedUrl(currentUrl)) {
        return { ok: false, reason: hop === 0 ? "URL host not allowed" : "Redirect target not allowed" };
      }

      const response = await fetch(currentUrl, { signal: controller.signal, redirect: "manual" });

      if (isRedirectStatus(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel().catch(() => {});
        if (!location || hop >= maxRedirects) {
          return { ok: false, reason: "Too many or invalid redirects" };
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      if (response.type === "opaqueredirect") {
        return { ok: false, reason: "Redirect could not be validated" };
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        return { ok: false, reason: `Download failed with status ${response.status}` };
      }

      const contentType = (response.headers.get("content-type") ?? "").toLowerCase().trim();
      if (!isAcceptableContentType(contentType, kind)) {
        await response.body?.cancel().catch(() => {});
        return { ok: false, reason: `Unexpected content type ${contentType || "(none)"}` };
      }

      const declaredLength = Number(response.headers.get("content-length") ?? "0");
      if (Number.isFinite(declaredLength) && declaredLength > options.maxBytes) {
        await response.body?.cancel().catch(() => {});
        return { ok: false, reason: "Declared size exceeds limit" };
      }

      if (!response.body) {
        return { ok: false, reason: "Empty response body" };
      }
      const read = await readWithLimit(response.body, options.maxBytes);
      if (!read.ok) {
        return { ok: false, reason: "Response size exceeds limit" };
      }
      if (read.bytes.byteLength === 0) {
        return { ok: false, reason: "Empty response body" };
      }

      const expectedPrefix = `${kind}/`;
      const type = contentType.startsWith(expectedPrefix) ? contentType.split(";")[0] : FALLBACK_TYPES[kind];
      return { ok: true, blob: new Blob([read.bytes], { type }), finalUrl: currentUrl };
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, reason: `Download timed out after ${options.timeoutMs}ms` };
    }
    return { ok: false, reason: error instanceof Error ? error.message : "Download failed" };
  } finally {
    clearTimeout(timeoutId);
  }
}
