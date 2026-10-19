/**
 * Kie.ai Client Service
 * Provides a clean interface for interacting with the Kie.ai API (Seedance 2 Fast model)
 * with proper error handling, timeout management, and type safety
 * 
 * API Documentation: https://docs.kie.ai/market/bytedance/seedance-2-fast
 */

import {
  KIE_API_CREATE_TASK_ENDPOINT,
  KIE_MODEL_TEXT_TO_VIDEO,
  DEFAULT_VIDEO_DURATION,
  DEFAULT_VIDEO_RESOLUTION,
  DEFAULT_ASPECT_RATIO,
} from "../../utils/constants/video";
import { HTTP_STATUS_OK } from "../../utils/constants";
import { appendWebhookToken } from "../../utils/webhookAuth";

export interface KieClientConfig {
  apiKey: string;
  callbackUrl: string;
  timeout?: number;
}

export interface KieGenerateRequest {
  prompt: string;
  aspect_ratio?: "portrait" | "landscape";
  duration?: "5" | "10"; // 5s or 10s
  resolution?: "720p" | "1080p"; // Legacy 1080p requests are capped at Fast's 720p limit.
  remove_watermark?: boolean; // Accepted for compatibility; Seedance has no such input.
  model?: typeof KIE_MODEL_TEXT_TO_VIDEO | "sora-2-text-to-video" | "bytedance/v1-pro-fast-image-to-video";
  image_url?: string; // Single image URL for image-to-video models
}

export interface KieGenerateResponse {
  code: number;
  msg: string;
  data?: {
    taskId?: string;
  };
}

export interface KieClientResponse {
  taskId: string;
}

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Kie.ai client for video generation using Seedance 2 Fast model
 */
export class KieClient {
  private config: Required<Omit<KieClientConfig, "callbackUrl">> & Pick<KieClientConfig, "callbackUrl">;
  private readonly baseUrl = KIE_API_CREATE_TASK_ENDPOINT;

  constructor(config: KieClientConfig) {
    this.config = {
      apiKey: config.apiKey,
      callbackUrl: config.callbackUrl,
      timeout: config.timeout ?? DEFAULT_TIMEOUT_MS,
    };
  }

  /**
   * Generate video from text prompt
   * @param request - Generation request with prompt and optional settings
   * @returns Promise resolving to task ID
   * @throws Error if the API call fails or times out
   */
  async generateVideo(request: Omit<KieGenerateRequest, "callbackUrl">): Promise<KieClientResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      // Both modes share one model. The presence of a photo selects first-frame
      // conditioning; comparing the two model constants can no longer do that.
      const model = KIE_MODEL_TEXT_TO_VIDEO;
      if (request.model === "bytedance/v1-pro-fast-image-to-video" && !request.image_url) {
        throw new Error("Kie.ai image-to-video requests require an image_url");
      }

      const payload = {
        model,
        callBackUrl: this.config.callbackUrl,
        input: {
          prompt: request.prompt,
          duration: Number(request.duration ?? DEFAULT_VIDEO_DURATION),
          aspect_ratio: (request.aspect_ratio ?? DEFAULT_ASPECT_RATIO) === "landscape" ? "16:9" : "9:16",
          resolution: DEFAULT_VIDEO_RESOLUTION, // Seedance 2 Fast supports 480p/720p only.
          generate_audio: false, // The app plays the generated song over the video.
          ...(request.image_url ? { first_frame_url: request.image_url } : {}),
        },
      };

      // The prompt is derived from the diary and lyrics; never log it.
      console.log("Kie.ai API request", {
        url: this.baseUrl,
        method: "POST",
        model,
        promptLength: request.prompt.length,
        hasImageUrl: Boolean(request.image_url),
      });

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
        console.error("Kie.ai API request failed", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        throw new Error(`Kie.ai API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = (await response.json()) as KieGenerateResponse;

      console.log("Kie.ai API response", {
        code: data.code,
        msg: data.msg,
        taskId: data.data?.taskId,
        fullResponse: JSON.stringify(data, null, 2),
      });

      if (data.code !== HTTP_STATUS_OK) {
        throw new Error(`Kie.ai API returned error code ${data.code}: ${data.msg}`);
      }

      const taskId = data.data?.taskId;
      if (!taskId) {
        throw new Error("Kie.ai API response missing taskId");
      }

      return { taskId };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Kie.ai API request timed out after ${this.config.timeout}ms`);
      }

      // Re-throw the error if it's already an Error instance
      if (error instanceof Error) {
        throw error;
      }

      // Wrap unknown errors
      throw new Error(`Kie.ai API request failed: ${String(error)}`);
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
 * Instantiate a KieClient using KIE_* environment variables.
 *
 * @param env - Object containing Kie.ai configuration environment variables:
 *   - `KIE_AI_API_KEY`: API key for authorization (required)
 *   - `CONVEX_SITE_URL`: site URL of the Convex deployment (provided automatically by Convex)
 *   - `CALLBACK_PATH`: callback path to append to site URL (required)
 *   - `KIE_AI_TIMEOUT`: optional request timeout in milliseconds
 *   - `WEBHOOK_SECRET`: secret appended to the callback URL so the callback
 *     handler can authenticate it (required by the handler)
 * @returns A configured KieClient instance
 * @throws Error if `KIE_AI_API_KEY`, `CONVEX_SITE_URL`, or `CALLBACK_PATH` is missing
 */
export function createKieClientFromEnv(env: {
  KIE_AI_API_KEY?: string;
  CONVEX_SITE_URL?: string;
  CALLBACK_PATH?: string;
  KIE_AI_TIMEOUT?: string;
  WEBHOOK_SECRET?: string;
}): KieClient {
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

  let timeout: number | undefined;
  if (env.KIE_AI_TIMEOUT) {
    const parsed = parseInt(env.KIE_AI_TIMEOUT, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      timeout = parsed;
    }
  }

  return new KieClient({
    apiKey,
    callbackUrl,
    timeout,
  });
}


