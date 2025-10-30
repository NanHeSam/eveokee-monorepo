/**
 * VAPI Client Service
 * Provides a clean interface for interacting with the VAPI API
 * with proper error handling, timeout management, and type safety
 */

import { VAPI_API_BASE_URL, VAPI_DEFAULT_TIMEOUT_MS } from "../../utils/constants";

export interface VapiCallRequest {
  phoneNumberId: string;
  customer: {
    number: string;
  };
  assistant: object;
  metadata: {
    jobId: string;
    userId: string;
  };
}

export interface VapiCallResponse {
  id?: string;
  callId?: string;
  status?: string;
  [key: string]: unknown;
}

export interface VapiClientConfig {
  apiKey: string;
  webhookUrl: string;
  phoneNumberId: string;
  timeout?: number;
}

export class VapiClient {
  private config: Required<VapiClientConfig>;
  private readonly baseUrl = VAPI_API_BASE_URL;

  constructor(config: VapiClientConfig) {
    this.config = {
      apiKey: config.apiKey,
      webhookUrl: config.webhookUrl,
      phoneNumberId: config.phoneNumberId,
      timeout: config.timeout ?? VAPI_DEFAULT_TIMEOUT_MS,
    };
  }

  /**
   * Create a call with VAPI
   * @param request - Call request parameters
   * @returns Promise resolving to the call response
   * @throws Error if the API call fails or times out
   */
  async createCall(request: Omit<VapiCallRequest, "phoneNumberId">): Promise<VapiCallResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/call`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumberId: this.config.phoneNumberId,
          ...request,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`VAPI API error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as VapiCallResponse;

      // Validate that we have a call ID
      const callId = data.id || data.callId;
      if (!callId) {
        throw new Error("VAPI API did not return a call ID");
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`VAPI API request timed out after ${this.config.timeout}ms`);
      }
      
      // Re-throw the error if it's already an Error instance
      if (error instanceof Error) {
        throw error;
      }
      
      // Wrap unknown errors
      throw new Error(`VAPI API request failed: ${String(error)}`);
    }
  }

  /**
   * Get the configured phone number ID
   */
  getPhoneNumberId(): string {
    return this.config.phoneNumberId;
  }
}

/**
 * Instantiate a VapiClient using VAPI_* environment variables.
 *
 * @param env - Object containing VAPI configuration environment variables:
 *   - `VAPI_API_KEY`: API key for authorization (required)
 *   - `VAPI_WEBHOOK_URL`: webhook callback URL (required)
 *   - `VAPI_PHONE_NUMBER_ID`: phone number identifier to use for calls (required)
 *   - `VAPI_TIMEOUT`: optional request timeout in milliseconds
 * @returns A configured VapiClient instance
 * @throws Error if `VAPI_API_KEY`, `VAPI_WEBHOOK_URL`, or `VAPI_PHONE_NUMBER_ID` is missing
 */
export function createVapiClientFromEnv(env: {
  VAPI_API_KEY?: string;
  VAPI_WEBHOOK_URL?: string;
  VAPI_PHONE_NUMBER_ID?: string;
  VAPI_TIMEOUT?: string;
}): VapiClient {
  const apiKey = env.VAPI_API_KEY;
  if (!apiKey) {
    throw new Error("VAPI_API_KEY environment variable is not set");
  }

  const webhookUrl = env.VAPI_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("VAPI_WEBHOOK_URL environment variable is not set");
  }

  const phoneNumberId = env.VAPI_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    throw new Error("VAPI_PHONE_NUMBER_ID environment variable is not set");
  }

  const timeout = env.VAPI_TIMEOUT ? parseInt(env.VAPI_TIMEOUT, 10) : undefined;

  return new VapiClient({
    apiKey,
    webhookUrl,
    phoneNumberId,
    timeout,
  });
}

