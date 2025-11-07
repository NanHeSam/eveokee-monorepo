/**
 * Hook to get subscription status directly from RevenueCat SDK
 * 
 * This hook makes RevenueCat the single source of truth for subscription status.
 * It reads from Purchases.getCustomerInfo() instead of Convex DB.
 * 
 * Includes request deduplication and debouncing to prevent duplicate API calls.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { useQuery } from 'convex/react';
import { api } from '@backend/convex';
import { 
  customerInfoToSubscriptionState, 
  hasActiveSubscription 
} from '../utils/revenueCatSubscription';
import { SubscriptionState } from '../store/useSubscriptionStore';

// Shared request manager to prevent duplicate concurrent requests
// This ensures that if multiple components call getCustomerInfo simultaneously,
// only one actual API request is made
let inFlightRequest: Promise<CustomerInfo> | null = null;
let lastRequestTime = 0;
const DEBOUNCE_MS = 3000; // Minimum time between requests

/**
 * Get customer info with deduplication and debouncing
 * If a request is already in flight, returns the same promise
 * If a request was made recently, waits for debounce period (unless forceRefresh is true)
 * 
 * @param forceRefresh - If true, bypasses debounce and forces a fresh fetch from RevenueCat servers
 */
async function getCustomerInfoDeduplicated(forceRefresh = false): Promise<CustomerInfo> {
  // If forcing refresh, we want fresh data immediately, so bypass in-flight request check
  // Note: We don't cancel the in-flight request (can't cancel promises), but we'll make a new one
  // The new request will update inFlightRequest, so subsequent calls will use the fresh data
  if (forceRefresh && inFlightRequest) {
    // Clear the in-flight request reference so we can make a new one
    // The old request will complete but won't be used by new callers
    inFlightRequest = null;
  }

  // If there's already a request in flight and not forcing refresh, return the same promise
  if (inFlightRequest && !forceRefresh) {
    return inFlightRequest;
  }

  // Debounce: if a request was made recently and not forcing refresh, wait a bit
  if (!forceRefresh) {
    const timeSinceLastRequest = Date.now() - lastRequestTime;
    if (timeSinceLastRequest < DEBOUNCE_MS) {
      await new Promise(resolve => setTimeout(resolve, DEBOUNCE_MS - timeSinceLastRequest));
    }
  }

  // Create new request - Purchases.getCustomerInfo() always fetches fresh data from RevenueCat servers
  lastRequestTime = Date.now();
  inFlightRequest = Purchases.getCustomerInfo()
    .then((info) => {
      inFlightRequest = null;
      return info;
    })
    .catch((err) => {
      inFlightRequest = null;
      throw err;
    });

  return inFlightRequest;
}

/**
 * Hook that retrieves the current user's subscription status from RevenueCat, 
 * augmented with usage data from Convex.
 * 
 * ## Return properties:
 * - subscriptionStatus: SubscriptionState | null
 *     The computed app-aware subscription state (tier, expiration, usage) or null if unavailable.
 * - customerInfo: CustomerInfo | null
 *     Raw RevenueCat customer info response object or null if not loaded yet.
 * - loading: boolean
 *     True if data is being loaded (either from RevenueCat or Convex).
 * - error: string | null
 *     Error message if fetching subscription state failed, null otherwise.
 * - refresh: (forceRefresh?: boolean) => Promise<void>
 *     Function to re-fetch data; pass forceRefresh=true to bypass debounce and cache.
 * - hasActiveSubscription: boolean
 *     True if user has at least one active entitlement/subscription.
 */
export function useRevenueCatSubscription(): {
  subscriptionStatus: SubscriptionState | null;
  customerInfo: CustomerInfo | null;
  loading: boolean;
  error: string | null;
  refresh: (forceRefresh?: boolean) => Promise<void>;
  hasActiveSubscription: boolean;
} {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const usageData = useQuery(api.usage.getCurrentUserUsage);

  /**
   * Loads customer info from RevenueCat (with deduplication and optional force refresh).
   * Also handles error and loading state, set only if the hook is still mounted.
   */
  const loadCustomerInfo = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch info, possibly forcing fresh call
      const info = await getCustomerInfoDeduplicated(forceRefresh);

      // Only set state if component is still mounted
      if (isMountedRef.current) {
        setCustomerInfo(info);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load subscription status';
      if (isMountedRef.current) {
        setError(errorMessage);
      }
      console.error('Failed to load RevenueCat customer info:', err);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Track mounted status to avoid setting state after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // On mount, fetch customer info (run once)
  useEffect(() => {
    loadCustomerInfo();
  }, []);

  // Translate raw RevenueCat info plus usage data into SubscriptionState.
  // This merges data from the external billing platform and the Convex backend.
  const subscriptionState: SubscriptionState | null = customerInfo
    ? customerInfoToSubscriptionState(customerInfo, {
        musicGenerationsUsed: usageData?.musicGenerationsUsed ?? 0,
        periodStart: usageData?.periodStart ?? Date.now(),
      })
    : null;

  /**
   * Public refresh function to reload all relevant info (optionally bypassing debounce/caching).
   * Useful after successful purchase, restoration, or to manually check for changes.
   */
  const refresh = useCallback(async (forceRefresh = false) => {
    await loadCustomerInfo(forceRefresh);
  }, [loadCustomerInfo]);

  return {
    subscriptionStatus: subscriptionState,
    customerInfo,
    loading: loading || usageData === undefined,
    error,
    refresh,
    hasActiveSubscription: hasActiveSubscription(customerInfo),
  };
}

