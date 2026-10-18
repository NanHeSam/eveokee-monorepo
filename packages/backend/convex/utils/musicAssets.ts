/**
 * Pure helpers for music asset persistence (kept free of Convex imports so
 * they are trivially unit-testable).
 */

export interface ProviderTrackLike {
  id: string;
  audioUrl?: string;
  sourceAudioUrl?: string;
  streamAudioUrl?: string;
  sourceStreamAudioUrl?: string;
  imageUrl?: string;
  sourceImageUrl?: string;
}

export interface MusicRowLike {
  audioId?: string;
  musicIndex?: number;
}

/**
 * Hosts we are willing to download generated assets from. URLs in provider
 * callbacks (and anything derived from provider records) are untrusted input,
 * so they must never be allowed to point the server at arbitrary hosts.
 * Matching is by exact host or any subdomain of these.
 */
export const ALLOWED_ASSET_HOST_SUFFIXES = [
  "suno.ai",
  "sunoapi.org",
  "api.box",
  "aiquickdraw.com",
  "removeai.ai",
  "erweima.ai",
] as const;

function isAllowedHttpsUrl(url: string, hostSuffixes: readonly string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.port && parsed.port !== "443") return false;
  const host = parsed.hostname.toLowerCase();
  return hostSuffixes.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

/** True when the URL is https and on a known provider host. */
export function isAllowedAssetUrl(url: string): boolean {
  return isAllowedHttpsUrl(url, ALLOWED_ASSET_HOST_SUFFIXES);
}

/**
 * Hosts Kie.ai serves generated videos from. Video callbacks reach us with a
 * provider-supplied URL, so the same exact-host-or-subdomain rule applies.
 */
export const ALLOWED_VIDEO_HOST_SUFFIXES = [
  "aiquickdraw.com",
  "kie.ai",
] as const;

/** True when the URL is https and on a known video provider host. */
export function isAllowedVideoUrl(url: string): boolean {
  return isAllowedHttpsUrl(url, ALLOWED_VIDEO_HOST_SUFFIXES);
}

/** True for URLs served by Convex file storage (already durable). */
export function isConvexStorageUrl(url: string): boolean {
  return /\.convex\.(cloud|site)\/api\/storage\//.test(url);
}

/** De-duplicate and drop empty/undefined entries, preserving order. */
export function uniqueNonEmpty(urls: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    if (typeof url !== "string" || url.length === 0) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/**
 * Match a stored music row to one of the provider's tracks for the same task.
 * Prefers the clip id; falls back to position (musicIndex) when the row has no
 * audioId, which is how records were paired at callback time.
 */
export function pickFreshTrackForMusic<T extends ProviderTrackLike>(
  tracks: T[],
  row: MusicRowLike,
): T | undefined {
  if (row.audioId) {
    const byId = tracks.find((track) => track.id === row.audioId);
    if (byId) return byId;
  }
  if (typeof row.musicIndex === "number" && row.musicIndex >= 0 && row.musicIndex < tracks.length) {
    return tracks[row.musicIndex];
  }
  return undefined;
}
