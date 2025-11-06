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
 * If a request was made recently, waits for debounce period
 */
async function getCustomerInfoDeduplicated(): Promise<CustomerInfo> {
  // If there's already a request in flight, return the same promise
  if (inFlightRequest) {
    return inFlightRequest;
  }

  // Debounce: if a request was made recently, wait a bit
  const timeSinceLastRequest = Date.now() - lastRequestTime;
  if (timeSinceLastRequest < DEBOUNCE_MS) {
    await new Promise(resolve => setTimeout(resolve, DEBOUNCE_MS - timeSinceLastRequest));
  }

  // Create new request
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
  const loadCustomerInfo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const info = await getCustomerInfoDeduplicated();
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
  const refresh = useCallback(async () => {
    await loadCustomerInfo();
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

