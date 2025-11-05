/**
 * RevenueCat webhook payload types
 * Used for subscription event processing
 */

import type { Id } from "../../_generated/dataModel";
import { REVENUECAT_SAMPLE_WEBHOOK_EXPIRATION_MS } from "../../utils/constants";

/**
 * RevenueCat webhook event structure
 * Based on fixtures: only fields we actually use
 */
export interface RevenueCatWebhookEvent {
  api_version?: string;
  event: {
    type: string;
    app_user_id: string;
    product_id: string;
    store: string;
    environment?: "SANDBOX" | "PRODUCTION"; // Receipt environment (sandbox vs production)
    expiration_at_ms?: number;
    purchased_at_ms?: number;
    is_trial_conversion?: boolean;
    entitlement_ids?: string[];
    entitlements?: Record<string, unknown>;
  };
}

/**
 * Validated RevenueCat webhook payload
 */
export interface RevenueCatWebhookPayload {
  eventType: string;
  userId: Id<"users">;
  productId: string;
  store?: "app_store" | "play_store" | "stripe";
  expirationAtMs?: number;
  purchasedAtMs?: number;
  isTrialConversion?: boolean;
  entitlementIds: string[];
  rawEvent: Record<string, unknown>;
}

/**
 * Type guard to validate RevenueCat webhook event structure
 */
export function isValidRevenueCatEvent(event: unknown): event is RevenueCatWebhookEvent {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return false;
  }
  
  const e = event as Record<string, unknown>;
  
  // Validate event field
  if (!e.event || typeof e.event !== "object" || Array.isArray(e.event)) {
    return false;
  }
  
  const evt = e.event as Record<string, unknown>;
  
  // Validate required fields
  if (typeof evt.type !== "string") {
    return false;
  }
  
  if (typeof evt.app_user_id !== "string") {
    return false;
  }
  
  if (typeof evt.product_id !== "string") {
    return false;
  }
  
  if (typeof evt.store !== "string") {
    return false;
  }
  
  return true;
}

/**
 * Parse and validate RevenueCat webhook payload
 * @returns Validated payload or error message
 */
export function parseRevenueCatPayload(
  event: unknown
): { success: true; data: RevenueCatWebhookEvent } | { success: false; error: string } {
  if (!isValidRevenueCatEvent(event)) {
    return { success: false, error: "Invalid event structure" };
  }

  // Validate required fields
  if (!event.event.app_user_id || !event.event.product_id) {
    return { success: false, error: "Missing required fields: app_user_id or product_id" };
  }

  return { success: true, data: event };
}

/**
 * Sample RevenueCat webhook event for testing
 */
export const sampleRevenueCatWebhookEvent: RevenueCatWebhookEvent = {
  event: {
    type: "INITIAL_PURCHASE",
    app_user_id: "test_user_id",
    product_id: "premium_monthly",
    store: "APP_STORE",
    expiration_at_ms: Date.now() + REVENUECAT_SAMPLE_WEBHOOK_EXPIRATION_MS,
    purchased_at_ms: Date.now(),
    is_trial_conversion: false,
    entitlements: {
      premium: {},
    },
  },
};

