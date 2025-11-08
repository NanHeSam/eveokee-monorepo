/**
 * VAPI Client Service
 * Provides a clean interface for interacting with the VAPI API
 * with proper error handling, timeout management, and type safety
 * Uses the official @vapi-ai/server-sdk for type-safe API interactions
 */

import { VapiClient as VapiSdkClient, Vapi, VapiError } from "@vapi-ai/server-sdk";
import { VAPI_DEFAULT_TIMEOUT_MS } from "../../utils/constants";

export interface VapiCallRequest {
  customer: {
    number: string;
  };
  assistant: Vapi.CreateAssistantDto;
  metadata?: {
    jobId: string;
    userId: string;
  };
}

export interface VapiClientConfig {
  apiKey: string;
  webhookUrl: string;
  phoneNumberId: string;
  timeout?: number;
}

export class VapiClient {
  private sdkClient: VapiSdkClient;
  private config: Required<VapiClientConfig>;

  constructor(config: VapiClientConfig) {
    this.config = {
      apiKey: config.apiKey,
      webhookUrl: config.webhookUrl,
      phoneNumberId: config.phoneNumberId,
      timeout: config.timeout ?? VAPI_DEFAULT_TIMEOUT_MS,
    };
    
    // Initialize the VAPI SDK client
    this.sdkClient = new VapiSdkClient({
      token: this.config.apiKey,
    });
  }

  /**
   * Create a call with VAPI
   * @param request - Call request parameters
   * @returns Promise resolving to the call response
   * @throws Error if the API call fails or times out
   */
  async createCall(request: VapiCallRequest): Promise<Vapi.Call> {
    try {
      // Convert timeout from milliseconds to seconds for SDK
      const timeoutInSeconds = Math.floor(this.config.timeout / 1000);
      
      // Build the SDK request object
      const createCallDto: Vapi.CreateCallDto = {
        phoneNumberId: this.config.phoneNumberId,
        customer: {
          number: request.customer.number,
        },
        assistant: request.assistant,
      };

      // Make the API call using the SDK
      // HttpResponsePromise resolves directly to the response type
      const response = await this.sdkClient.calls.create(createCallDto, {
        timeoutInSeconds,
      });

      // Handle batch response (if multiple calls were created)
      if ("results" in response) {
        // This is a CallBatchResponse - extract the first call
        const batchResponse = response as Vapi.CallBatchResponse;
        if (batchResponse.results.length === 0) {
          throw new Error("VAPI API returned batch response with no calls");
        }
        // Return the first call from the batch
        const firstCall = batchResponse.results[0];
        if (!firstCall.id) {
          throw new Error("VAPI API returned batch call with no ID");
        }
        return firstCall;
      }

      // Regular single call response
      const call = response as Vapi.Call;
      
      // Validate that we have a call ID
      if (!call.id) {
        throw new Error("VAPI API did not return a call ID");
      }

      return call;
    } catch (error) {
      // Handle SDK-specific errors
      if (error instanceof VapiError) {
        throw new Error(`VAPI API error: ${error.statusCode} - ${error.message}`);
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

  /**
   * Get the configured webhook URL
   */
  getWebhookUrl(): string {
    return this.config.webhookUrl;
  }
}

/**
 * Instantiate a VapiClient using VAPI_* environment variables.
 *
 * @param env - Object containing VAPI configuration environment variables:
 *   - `VAPI_API_KEY`: API key for authorization (required)
 *   - `CONVEX_SITE_URL`: site URL of the Convex deployment (provided automatically by Convex)
 *   - `WEBHOOK_PATH`: webhook path to append to site URL (required)
 *   - `VAPI_PHONE_NUMBER_ID`: phone number identifier to use for calls (required)
 *   - `VAPI_TIMEOUT`: optional request timeout in milliseconds
 * @returns A configured VapiClient instance
 * @throws Error if `VAPI_API_KEY`, `CONVEX_SITE_URL`, `WEBHOOK_PATH`, or `VAPI_PHONE_NUMBER_ID` is missing
 */
export function createVapiClientFromEnv(env: {
  VAPI_API_KEY?: string;
  CONVEX_SITE_URL?: string;
  WEBHOOK_PATH?: string;
  VAPI_PHONE_NUMBER_ID?: string;
  VAPI_TIMEOUT?: string;
}): VapiClient {
  const apiKey = env.VAPI_API_KEY;
  if (!apiKey) {
    throw new Error("VAPI_API_KEY environment variable is not set");
  }

  const convexSiteUrl = env.CONVEX_SITE_URL;
  if (!convexSiteUrl) {
    throw new Error("CONVEX_SITE_URL is not available (this should be provided automatically by Convex)");
  }

  const webhookPath = env.WEBHOOK_PATH;
  if (!webhookPath) {
    throw new Error("WEBHOOK_PATH is required");
  }

  // Construct full webhook URL from site URL + path
  // Ensure site URL doesn't end with / and path starts with /
  const baseUrlNormalized = convexSiteUrl.replace(/\/$/, "");
  const pathNormalized = webhookPath.startsWith("/") ? webhookPath : `/${webhookPath}`;
  const webhookUrl = `${baseUrlNormalized}${pathNormalized}`;

  const phoneNumberId = env.VAPI_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    throw new Error("VAPI_PHONE_NUMBER_ID environment variable is not set");
  }

  const timeout = env.VAPI_TIMEOUT ? parseInt(env.VAPI_TIMEOUT, 10) || undefined : undefined;

  return new VapiClient({
    apiKey,
    webhookUrl,
    phoneNumberId,
    timeout,
  });
}

