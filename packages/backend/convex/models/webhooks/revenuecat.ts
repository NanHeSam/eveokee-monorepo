/**
 * RevenueCat webhook payload types
 * Used for subscription event processing
 */

import type { Id } from "../../_generated/dataModel";
import { REVENUECAT_SAMPLE_WEBHOOK_EXPIRATION_MS } from "../../utils/constants";

export interface RevenueCatWebhookEvent {
  event: {
    type?: string;
    app_user_id?: string;
    product_id?: string;
    store?: string;
    expiration_at_ms?: number;
    purchased_at_ms?: number;
    is_trial_conversion?: boolean;
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

