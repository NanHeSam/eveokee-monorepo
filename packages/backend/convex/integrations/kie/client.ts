/**
 * Kie.ai Client Service
 * Provides a clean interface for interacting with the Kie.ai API (Sora 2 model)
 * with proper error handling, timeout management, and type safety
 * 
 * API Documentation: https://kie.ai/sora-2
 */

import {
  KIE_API_CREATE_TASK_ENDPOINT,
  KIE_MODEL_TEXT_TO_VIDEO,
  DEFAULT_VIDEO_DURATION,
  DEFAULT_ASPECT_RATIO,
  DEFAULT_REMOVE_WATERMARK,
} from "../../utils/constants/video";
import { HTTP_STATUS_OK } from "../../utils/constants";

export interface KieClientConfig {
  apiKey: string;
  callbackUrl: string;
  timeout?: number;
}

export interface KieGenerateRequest {
  prompt: string;
  aspect_ratio?: "portrait" | "landscape";
  n_frames?: "10" | "15"; // 10s or 15s
  remove_watermark?: boolean;
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
 * Kie.ai client for video generation using Sora 2 model
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
      const payload = {
        model: KIE_MODEL_TEXT_TO_VIDEO,
        callBackUrl: this.config.callbackUrl,
        input: {
          prompt: request.prompt,
          aspect_ratio: request.aspect_ratio ?? DEFAULT_ASPECT_RATIO,
          n_frames: request.n_frames ?? DEFAULT_VIDEO_DURATION,
          remove_watermark: request.remove_watermark ?? DEFAULT_REMOVE_WATERMARK,
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
        throw new Error(`Kie.ai API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = (await response.json()) as KieGenerateResponse;

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
 * @returns A configured KieClient instance
 * @throws Error if `KIE_AI_API_KEY`, `CONVEX_SITE_URL`, or `CALLBACK_PATH` is missing
 */
export function createKieClientFromEnv(env: {
  KIE_AI_API_KEY?: string;
  CONVEX_SITE_URL?: string;
  CALLBACK_PATH?: string;
  KIE_AI_TIMEOUT?: string;
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
  const callbackUrl = `${baseUrlNormalized}${pathNormalized}`;

  const timeout = env.KIE_AI_TIMEOUT ? parseInt(env.KIE_AI_TIMEOUT, 10) : undefined;

  return new KieClient({
    apiKey,
    callbackUrl,
    timeout,
  });
}


