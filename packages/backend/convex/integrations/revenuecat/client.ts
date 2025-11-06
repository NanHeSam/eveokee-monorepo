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
  projectId: string;
  timeout?: number;
}

export interface RevenueCatActiveEntitlement {
  entitlement_id: string;
  expires_at: number | null;
  object: "customer.active_entitlement";
  [key: string]: unknown;
}

export interface RevenueCatCustomerInfo {
  active_entitlements: {
    items: RevenueCatActiveEntitlement[];
    next_page: string | null;
    object: "list";
    url: string;
  };
  id: string;
  project_id: string;
  first_seen_at: number;
  last_seen_at: number;
  last_seen_app_version?: string;
  last_seen_country?: string;
  last_seen_platform?: string;
  last_seen_platform_version?: string;
  experiment?: unknown;
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
      projectId: config.projectId,
      timeout: config.timeout ?? REVENUECAT_API_TIMEOUT_MS,
    };
  }

  /**
   * Fetch customer info from RevenueCat REST API v2
   * @param appUserId - The app user ID (same as our userId)
   * @returns Promise resolving to customer info, or null if not found
   * @throws Error if the API call fails or times out
   */
  async getCustomerInfo(appUserId: string): Promise<RevenueCatCustomerInfo | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const encodedUserId = encodeURIComponent(appUserId);
      const encodedProjectId = encodeURIComponent(this.config.projectId);
      const response = await fetch(
        `${this.baseUrl}/v2/projects/${encodedProjectId}/customers/${encodedUserId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        }
      );

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
 * Instantiate a RevenueCatClient using RevenueCat environment variables.
 *
 * @param env - Object containing RevenueCat configuration environment variables:
 *   - `REVENUECAT_API_KEY`: API key for authorization (required)
 *   - `REVENUECAT_PROJECT_ID`: Project ID for the RevenueCat project (required)
 *   - `REVENUECAT_TIMEOUT`: optional request timeout in milliseconds
 * @returns A configured RevenueCatClient instance
 * @throws Error if `REVENUECAT_API_KEY` or `REVENUECAT_PROJECT_ID` is missing
 */
export function createRevenueCatClientFromEnv(env: {
  REVENUECAT_API_KEY?: string;
  REVENUECAT_PROJECT_ID?: string;
  REVENUECAT_TIMEOUT?: string;
}): RevenueCatClient {
  const apiKey = env.REVENUECAT_API_KEY;
  if (!apiKey) {
    throw new Error("REVENUECAT_API_KEY environment variable is not set");
  }

  const projectId = env.REVENUECAT_PROJECT_ID;
  if (!projectId) {
    throw new Error("REVENUECAT_PROJECT_ID environment variable is not set");
  }

  const timeout = env.REVENUECAT_TIMEOUT ? parseInt(env.REVENUECAT_TIMEOUT, 10) : undefined;

  return new RevenueCatClient({
    apiKey,
    projectId,
    timeout,
  });
}

