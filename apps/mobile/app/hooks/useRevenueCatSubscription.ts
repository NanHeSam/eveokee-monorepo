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
 * Hook that provides subscription status directly from RevenueCat
 * 
 * @returns Subscription state from RevenueCat, with usage data from Convex
 */
export function useRevenueCatSubscription() {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  
  // Get usage data from Convex (musicGenerationsUsed, periodStart)
  // This is still needed as it's app-specific data
  const usageData = useQuery(api.usage.getCurrentUserUsage);

  // Load customer info from RevenueCat with deduplication
  const loadCustomerInfo = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      const info = await getCustomerInfoDeduplicated(forceRefresh);
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setCustomerInfo(info);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load subscription status';
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setError(errorMessage);
      }
      console.error('Failed to load RevenueCat customer info:', err);
    } finally {
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Track mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load customer info on mount and when usage data changes
  useEffect(() => {
    loadCustomerInfo();
  }, [loadCustomerInfo]);

  // Convert RevenueCat customer info to subscription state
  const subscriptionState: SubscriptionState | null = customerInfo
    ? customerInfoToSubscriptionState(customerInfo, {
        musicGenerationsUsed: usageData?.musicGenerationsUsed ?? 0,
        periodStart: usageData?.periodStart ?? Date.now(),
      })
    : null;

  // Refresh subscription status
  // By default, uses cached data if available (respects debounce)
  // Pass forceRefresh=true to bypass cache and force a fresh fetch from RevenueCat servers
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

