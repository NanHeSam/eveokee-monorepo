/**
 * Kie Suno music client
 * Provides a clean interface for interacting with the Kie music API
 * with proper error handling, timeout management, and type safety
 */

import {
  KIE_MUSIC_MODEL,
  KIE_TIMESTAMPED_LYRICS_MODEL,
  KIE_API_RECORD_INFO_ENDPOINT,
  SUNO_DEFAULT_MODEL,
  SUNO_DEFAULT_DURATION_SECONDS,
  HTTP_STATUS_OK,
} from "../../utils/constants";
import { KIE_API_CREATE_TASK_ENDPOINT } from "../../utils/constants/video";
import { extractSunoTracks } from "../../models/webhooks/suno";
import { appendWebhookToken } from "../../utils/webhookAuth";

export interface KieMusicClientConfig {
  apiKey: string;
  callbackUrl: string;
  timeout?: number;
}

export interface KieMusicGenerateRequest {
  prompt: string;
  style: string;
  title: string;
  callbackUrl: string;
}

export interface KieMusicGenerateResponse {
  code: number;
  msg: string;
  data?: {
    taskId?: string;
  };
}

export interface KieMusicClientResponse {
  taskId: string;
}

export interface KieMusicTimestampedLyricsRequest {
  taskId: string;
  audioId: string;
}

export interface KieMusicTimestampedLyricsResponse {
  code: number;
  msg: string;
  data?: {
    code: number;
    msg: string;
    data?: {
      alignedWords: Array<{
        word: string;
        success: boolean;
        startS: number;
        endS: number;
        palign: number;
      }>;
      waveformData: number[];
      hootCer: number;
      isStreamed: boolean;
    };
  };
}

export interface TimestampedLyricsData {
  alignedWords: Array<{
    word: string;
    startS: number;
    endS: number;
    palign: number;
  }>;
  waveformData: number[];
  hootCer: number;
}

export interface KieMusicRecordInfoTrack {
  id: string;
  audioUrl?: string;
  sourceAudioUrl?: string;
  streamAudioUrl?: string;
  sourceStreamAudioUrl?: string;
  imageUrl?: string;
  sourceImageUrl?: string;
  title?: string;
  duration?: number;
}

export interface KieMusicRecordInfoResponse {
  code: number;
  msg: string;
  data?: {
    taskId?: string;
    state?: string;
    status?: string;
    response?: { data?: unknown[] };
    resultJson?: string;
  } | null;
}

export interface KieMusicRecordInfo {
  status: string | undefined;
  tracks: KieMusicRecordInfoTrack[];
}

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Kie Suno client for music generation
 */
export class KieMusicClient {
  private config: Required<Omit<KieMusicClientConfig, "callbackUrl">> & Pick<KieMusicClientConfig, "callbackUrl">;
  private readonly baseUrl = KIE_API_CREATE_TASK_ENDPOINT;

  constructor(config: KieMusicClientConfig) {
    this.config = {
      apiKey: config.apiKey,
      callbackUrl: config.callbackUrl,
      timeout: config.timeout ?? DEFAULT_TIMEOUT_MS,
    };
  }

  /**
   * Generate music from song data (lyrics, style, title)
   * @param request - Generation request with prompt, style, title
   * @returns Promise resolving to task ID
   * @throws Error if the API call fails or times out
   */
  async generateMusic(request: Omit<KieMusicGenerateRequest, "callbackUrl">): Promise<KieMusicClientResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const payload = {
        model: KIE_MUSIC_MODEL,
        callBackUrl: this.config.callbackUrl,
        input: {
          custom_mode: true,
          instrumental: false,
          model: SUNO_DEFAULT_MODEL,
          lyrics: request.prompt,
          style: request.style,
          title: request.title,
          duration: SUNO_DEFAULT_DURATION_SECONDS,
        },
      };

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Kie music API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = (await response.json()) as KieMusicGenerateResponse;

      if (data.code !== HTTP_STATUS_OK) {
        throw new Error(`Kie music API returned error code ${data.code}: ${data.msg}`);
      }

      const taskId = data.data?.taskId;
      if (!taskId) {
        throw new Error("Kie music API response missing taskId");
      }

      return { taskId };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Kie music API request timed out after ${this.config.timeout}ms`);
      }

      // Re-throw the error if it's already an Error instance
      if (error instanceof Error) {
        throw error;
      }

      // Wrap unknown errors
      throw new Error(`Kie music API request failed: ${String(error)}`);
    }
  }

  /**
   * Get timestamped lyrics for a generated music track
   * @param request - Request with taskId and audioId
   * @returns Promise resolving to timestamped lyrics data
   * @throws Error if the API call fails or times out
   */
  async getTimestampedLyrics(request: KieMusicTimestampedLyricsRequest): Promise<TimestampedLyricsData> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const payload = {
        model: KIE_TIMESTAMPED_LYRICS_MODEL,
        input: { task_id: request.taskId, audio_id: request.audioId },
      };

      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Kie music API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = (await response.json()) as KieMusicTimestampedLyricsResponse;

      if (data.code !== HTTP_STATUS_OK) {
        throw new Error(`Kie music API returned error code ${data.code}: ${data.msg}`);
      }

      if (data.data?.code !== HTTP_STATUS_OK || !data.data.data) {
        throw new Error(`Kie music lyrics returned error code ${data.data?.code ?? "missing"}`);
      }
      const lyrics = data.data.data;

      // Transform response to match schema format: remove `success` from alignedWords, ignore `isStreamed`
      const transformedData: TimestampedLyricsData = {
        alignedWords: lyrics.alignedWords.map((word) => ({
          word: word.word,
          startS: word.startS,
          endS: word.endS,
          palign: word.palign,
        })),
        waveformData: lyrics.waveformData,
        hootCer: lyrics.hootCer,
      };

      return transformedData;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Kie music API request timed out after ${this.config.timeout}ms`);
      }

      // Re-throw the error if it's already an Error instance
      if (error instanceof Error) {
        throw error;
      }

      // Wrap unknown errors
      throw new Error(`Kie music API request failed: ${String(error)}`);
    }
  }

  /**
   * Fetch the current record for a generation task. The provider rotates the
   * hosts its audio lives on, so this is the way to get a fresh, downloadable
   * URL for a track that was generated earlier.
   * @param taskId - Task ID returned by generateMusic
   * @returns Task status and the tracks with their current URLs (empty when the
   *   provider has no record for the task)
   * @throws Error if the API call fails or times out
   */
  async getRecordInfo(taskId: string): Promise<KieMusicRecordInfo> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const url = `${KIE_API_RECORD_INFO_ENDPOINT}?taskId=${encodeURIComponent(taskId)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Kie music API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = (await response.json()) as KieMusicRecordInfoResponse;

      if (data.code !== HTTP_STATUS_OK) {
        throw new Error(`Kie music API returned error code ${data.code}: ${data.msg}`);
      }

      const tracks = extractSunoTracks({ data: data.data ?? undefined });
      return {
        status: data.data?.state ?? data.data?.status,
        tracks: tracks.map((track) => ({
          id: track.id,
          audioUrl: track.audio_url,
          sourceAudioUrl: track.source_audio_url,
          streamAudioUrl: track.stream_audio_url,
          sourceStreamAudioUrl: track.source_stream_audio_url,
          imageUrl: track.image_url,
          sourceImageUrl: track.source_image_url,
          title: track.title,
          duration: track.duration,
        })),
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Kie music API request timed out after ${this.config.timeout}ms`);
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Kie music API request failed: ${String(error)}`);
    }
  }

  /**
   * Get the configured callback URL
   */
  getCallbackUrl(): string {
    return this.config.callbackUrl;
  }
}

/**
 * Instantiate a KieMusicClient using KIE_* environment variables.
 *
 * @param env - Object containing Kie music configuration environment variables:
 *   - `KIE_AI_API_KEY`: API key for authorization (required)
 *   - `CONVEX_SITE_URL`: site URL of the Convex deployment (provided automatically by Convex)
 *   - `CALLBACK_PATH`: callback path to append to site URL (required)
 *   - `KIE_AI_TIMEOUT`: optional request timeout in milliseconds
 *   - `WEBHOOK_SECRET`: secret appended to the callback URL so the callback
 *     handler can authenticate it. Required for anything that starts a
 *     generation; optional for clients that only read (lyrics, record info).
 * @returns A configured KieMusicClient instance
 * @throws Error if `KIE_AI_API_KEY`, `CONVEX_SITE_URL`, or `CALLBACK_PATH` is missing
 */
export function createKieMusicClientFromEnv(env: {
  KIE_AI_API_KEY?: string;
  CONVEX_SITE_URL?: string;
  CALLBACK_PATH?: string;
  KIE_AI_TIMEOUT?: string;
  WEBHOOK_SECRET?: string;
}): KieMusicClient {
  const apiKey = env.KIE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("KIE_AI_API_KEY environment variable is not set");
  }

  const convexSiteUrl = env.CONVEX_SITE_URL;
  if (!convexSiteUrl) {
    throw new Error("CONVEX_SITE_URL is not available (this should be provided automatically by Convex)");
  }

  const callbackPath = env.CALLBACK_PATH;
  if (!callbackPath) {
    throw new Error("CALLBACK_PATH is required");
  }

  // Construct full callback URL from site URL + path
  // Ensure site URL doesn't end with / and path starts with /
  const baseUrlNormalized = convexSiteUrl.replace(/\/$/, "");
  const pathNormalized = callbackPath.startsWith("/") ? callbackPath : `/${callbackPath}`;
  const baseCallbackUrl = `${baseUrlNormalized}${pathNormalized}`;
  const callbackUrl = env.WEBHOOK_SECRET
    ? appendWebhookToken(baseCallbackUrl, env.WEBHOOK_SECRET)
    : baseCallbackUrl;

  const parsedTimeout = Number(env.KIE_AI_TIMEOUT);
  const timeout = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : undefined;

  return new KieMusicClient({
    apiKey,
    callbackUrl,
    timeout,
  });
}

