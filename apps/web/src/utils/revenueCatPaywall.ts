/**
 * Gets the RevenueCat paywall base URL from environment variables.
 * The URL should be in the format: https://pay.rev.cat/{sandbox}/paywallId or https://pay.rev.cat/paywallId
 * The userId will be appended to this base URL.
 */
const getPaywallBaseUrl = (): string | null => {
  return import.meta.env.VITE_REVENUECAT_PAYWALL_BASE_URL ?? null;
};

/**
 * Builds the hosted RevenueCat paywall URL for the authenticated user.
 * Requires VITE_REVENUECAT_PAYWALL_BASE_URL to be set in environment variables.
 */
export const getRevenueCatPaywallUrl = (
  appUserId: string | null | undefined,
): string | null => {
  if (!appUserId) {
    return null;
  }

  const baseUrl = getPaywallBaseUrl();
  if (!baseUrl) {
    console.warn("VITE_REVENUECAT_PAYWALL_BASE_URL is not set");
    return null;
  }

  // Ensure base URL doesn't end with a slash
  const cleanBaseUrl = baseUrl.replace(/\/$/, "");
  return `${cleanBaseUrl}/${encodeURIComponent(appUserId)}`;
};

/**
 * Gets a human-readable label for the RevenueCat environment.
 * Detects sandbox vs production based on the base URL.
 */
export const getRevenueCatEnvironmentLabel = (): string => {
  const baseUrl = getPaywallBaseUrl();
  if (!baseUrl) {
    return "Checkout";
  }
  
  // Check if URL contains "/sandbox/" to determine environment
  return baseUrl.includes("/sandbox/") ? "Sandbox checkout" : "Checkout";
};

