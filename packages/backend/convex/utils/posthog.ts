"use node";

import { PostHog } from "posthog-node";

let cachedPostHogClient: PostHog | null = null;

/**
 * Get or create a PostHog client instance
 * Uses environment variables for configuration
 */
export function getPostHogClient(): PostHog | null {
  const apiKey = process.env.POSTHOG_API_KEY;
  const host = process.env.POSTHOG_HOST || "https://us.i.posthog.com";

  if (!apiKey) {
    console.warn(
      "[PostHog] POSTHOG_API_KEY missing; skipping LLM analytics instrumentation"
    );
    // PostHog is optional - return null if not configured
    return null;
  }

  if (!cachedPostHogClient) {
    cachedPostHogClient = new PostHog(apiKey, {
      host,
    });
  }

  return cachedPostHogClient;
}

/**
 * Shutdown PostHog client gracefully
 * Should be called when the process is shutting down
 */
export async function shutdownPostHog(): Promise<void> {
  if (cachedPostHogClient) {
    console.log("[PostHog] Flushing/shutting down client");
    await cachedPostHogClient.shutdown();
    cachedPostHogClient = null;
  }
}

