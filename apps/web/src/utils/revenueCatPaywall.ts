/**
 * Gets the RevenueCat paywall base URL from environment variables.
 * The URL should be in the format: https://pay.rev.cat/{sandbox}/paywallId or https://pay.rev.cat/paywallId
 * The userId will be appended to this base URL.
 */
const getPaywallBaseUrl = (): string | null => {
  return import.meta.env.VITE_REVENUECAT_PAYWALL_BASE_URL ?? null;
};

export type BillingCycle = "weekly" | "monthly" | "yearly";

/**
 * Builds the hosted RevenueCat paywall URL for the authenticated user.
 * Requires VITE_REVENUECAT_PAYWALL_BASE_URL to be set in environment variables.
 * 
 * @param appUserId - The user ID to append to the paywall URL
 * @param billingCycle - Optional billing cycle (weekly/monthly/yearly) to pass as a query parameter
 */
export const getRevenueCatPaywallUrl = (
  appUserId: string | null | undefined,
  billingCycle?: BillingCycle,
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
  const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
  let url = `${cleanBaseUrl}/${encodeURIComponent(appUserId)}`;
  
  // Append billing cycle as query parameter if provided
  if (billingCycle) {
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.set("billing_cycle", billingCycle);
      url = urlObj.toString();
    } catch {
      // If URL construction fails, fall back to appending query string manually
      // This handles edge cases where base URL might not be a full URL
      const separator = url.includes("?") ? "&" : "?";
      url = `${url}${separator}billing_cycle=${encodeURIComponent(billingCycle)}`;
    }
  }
  
  return url;
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

