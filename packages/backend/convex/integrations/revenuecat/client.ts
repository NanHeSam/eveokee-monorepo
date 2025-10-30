/**
 * RevenueCat Client Service
 * Provides a clean interface for interacting with the RevenueCat REST API
 * with proper error handling, timeout management, and type safety
 */

import {
  REVENUECAT_API_BASE_URL,
  REVENUECAT_API_TIMEOUT_MS,
} from "../../utils/constants";

export interface RevenueCatClientConfig {
  apiKey: string;
  timeout?: number;
}

export interface RevenueCatCustomerInfo {
  subscriber?: {
    entitlements?: {
      active?: Record<string, unknown>;
    };
  };
  [key: string]: unknown;
}

/**
 * RevenueCat client for subscription management
 */
export class RevenueCatClient {
  private config: Required<RevenueCatClientConfig>;
  private readonly baseUrl = REVENUECAT_API_BASE_URL;

  constructor(config: RevenueCatClientConfig) {
    this.config = {
      apiKey: config.apiKey,
      timeout: config.timeout ?? REVENUECAT_API_TIMEOUT_MS,
    };
  }

  /**
   * Fetch customer info from RevenueCat REST API
   * @param appUserId - The app user ID (same as our userId)
   * @returns Promise resolving to customer info, or null if not found
   * @throws Error if the API call fails or times out
   */
  async getCustomerInfo(appUserId: string): Promise<RevenueCatCustomerInfo | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const encodedUserId = encodeURIComponent(appUserId);
      const response = await fetch(`${this.baseUrl}/v1/subscribers/${encodedUserId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.error(`Failed to fetch RC customer: ${response.status} ${response.statusText}`);
        return null;
      }

      return (await response.json()) as RevenueCatCustomerInfo;
    } catch (error) {
      clearTimeout(timeout);
      
      if (error instanceof Error && error.name === "AbortError") {
        console.error("Request to RevenueCat API timed out");
        return null;
      }
      
      if (error instanceof Error) {
        throw new Error(`RevenueCat API request failed: ${error.message}`);
      }
      
      throw new Error(`RevenueCat API request failed: ${String(error)}`);
    }
  }
}

/**
 * Instantiate a RevenueCatClient using REVENUECAT_API_KEY environment variable.
 *
 * @param env - Object containing RevenueCat configuration environment variables:
 *   - `REVENUECAT_API_KEY`: API key for authorization (required)
 *   - `REVENUECAT_TIMEOUT`: optional request timeout in milliseconds
 * @returns A configured RevenueCatClient instance
 * @throws Error if `REVENUECAT_API_KEY` is missing
 */
export function createRevenueCatClientFromEnv(env: {
  REVENUECAT_API_KEY?: string;
  REVENUECAT_TIMEOUT?: string;
}): RevenueCatClient {
  const apiKey = env.REVENUECAT_API_KEY;
  if (!apiKey) {
    throw new Error("REVENUECAT_API_KEY environment variable is not set");
  }

  const timeout = env.REVENUECAT_TIMEOUT ? parseInt(env.REVENUECAT_TIMEOUT, 10) : undefined;

  return new RevenueCatClient({
    apiKey,
    timeout,
  });
}

