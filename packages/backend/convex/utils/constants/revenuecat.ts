/**
 * RevenueCat billing integration constants
 * Configuration for RevenueCat subscription management
 */

// API Endpoints
export const REVENUECAT_API_BASE_URL = "https://api.revenuecat.com";
export const REVENUECAT_WEBHOOK_PATH = "/webhooks/revenuecat";

// Product to Tier Mapping
export const REVENUECAT_PRODUCT_TO_TIER: Record<string, string> = {
  "eveokee_premium_weekly": "weekly",
  "eveokee_premium_monthly": "monthly",
  "eveokee_premium_annual": "yearly",
  "free-tier": "free",
} as const;

// Store to Platform Mapping
export const REVENUECAT_STORE_TO_PLATFORM: Record<string, "app_store" | "play_store" | "stripe"> = {
  "APP_STORE": "app_store",
  "PLAY_STORE": "play_store",
  "STRIPE": "stripe",
} as const;

// API Configuration
export const REVENUECAT_API_TIMEOUT_MS = 10000; // 10 seconds
export const REVENUECAT_RECONCILIATION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// Event Types
export const REVENUECAT_ACTIVE_EVENT_TYPES = [
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "SUBSCRIPTION_UNPAUSED",
  "SUBSCRIPTION_RESUMED",
] as const;

export const REVENUECAT_SIGNIFICANT_EVENT_TYPES = [
  "INITIAL_PURCHASE",
  "RENEWAL",
  "CANCELLATION",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
  "EXPIRATION",
] as const;

// Sample webhook data
export const REVENUECAT_SAMPLE_WEBHOOK_EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

