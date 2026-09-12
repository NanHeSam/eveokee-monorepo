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
