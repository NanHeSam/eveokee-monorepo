/**
 * Suno Client Service
 * Provides a clean interface for interacting with the Suno API
 * with proper error handling, timeout management, and type safety
 */

import {
  SUNO_API_GENERATE_ENDPOINT,
  SUNO_DEFAULT_MODEL,
  HTTP_STATUS_OK,
} from "../../utils/constants";

export interface SunoClientConfig {
  apiKey: string;
  callbackUrl: string;
  timeout?: number;
}

export interface SunoGenerateRequest {
  prompt: string;
  style: string;
  title: string;
  callbackUrl: string;
}

export interface SunoGenerateResponse {
  code: number;
  msg: string;
  data?: {
    taskId?: string;
  };
}

export interface SunoClientResponse {
  taskId: string;
}

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Suno client for music generation
 */
export class SunoClient {
  private config: Required<Omit<SunoClientConfig, "callbackUrl">> & Pick<SunoClientConfig, "callbackUrl">;
  private readonly baseUrl = SUNO_API_GENERATE_ENDPOINT;

  constructor(config: SunoClientConfig) {
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
  async generateMusic(request: Omit<SunoGenerateRequest, "callbackUrl">): Promise<SunoClientResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const payload = {
        prompt: request.prompt,
        style: request.style,
        title: request.title,
        customMode: true,
        instrumental: false,
        model: SUNO_DEFAULT_MODEL,
        callBackUrl: this.config.callbackUrl,
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
        throw new Error(`Suno API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = (await response.json()) as SunoGenerateResponse;

      if (data.code !== HTTP_STATUS_OK) {
        throw new Error(`Suno API returned error code ${data.code}: ${data.msg}`);
      }

      const taskId = data.data?.taskId;
      if (!taskId) {
        throw new Error("Suno API response missing taskId");
      }

      return { taskId };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Suno API request timed out after ${this.config.timeout}ms`);
      }

      // Re-throw the error if it's already an Error instance
      if (error instanceof Error) {
        throw error;
      }

      // Wrap unknown errors
      throw new Error(`Suno API request failed: ${String(error)}`);
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
 * Instantiate a SunoClient using SUNO_* environment variables.
 *
 * @param env - Object containing Suno configuration environment variables:
 *   - `SUNO_API_KEY`: API key for authorization (required)
 *   - `SUNO_CALLBACK_URL`: callback URL for webhook notifications (required)
 *   - `SUNO_TIMEOUT`: optional request timeout in milliseconds
 * @returns A configured SunoClient instance
 * @throws Error if `SUNO_API_KEY` or `SUNO_CALLBACK_URL` is missing
 */
export function createSunoClientFromEnv(env: {
  SUNO_API_KEY?: string;
  SUNO_CALLBACK_URL?: string;
  SUNO_TIMEOUT?: string;
}): SunoClient {
  const apiKey = env.SUNO_API_KEY;
  if (!apiKey) {
    throw new Error("SUNO_API_KEY environment variable is not set");
  }

  const callbackUrl = env.SUNO_CALLBACK_URL;
  if (!callbackUrl) {
    throw new Error("SUNO_CALLBACK_URL environment variable is not set");
  }

  const timeout = env.SUNO_TIMEOUT ? parseInt(env.SUNO_TIMEOUT, 10) : undefined;

  return new SunoClient({
    apiKey,
    callbackUrl,
    timeout,
  });
}

