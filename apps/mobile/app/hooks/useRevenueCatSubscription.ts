/**
 * Hook to get subscription status directly from RevenueCat SDK
 * 
 * This hook makes RevenueCat the single source of truth for subscription status.
 * It reads from Purchases.getCustomerInfo() instead of Convex DB.
 */

import { useState, useEffect, useCallback } from 'react';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { useQuery } from 'convex/react';
import { api } from '@backend/convex';
import { 
  customerInfoToSubscriptionState, 
  hasActiveSubscription 
} from '../utils/revenueCatSubscription';
import { SubscriptionState } from '../store/useSubscriptionStore';

/**
 * Hook that provides subscription status directly from RevenueCat
 * 
 * @returns Subscription state from RevenueCat, with usage data from Convex
 */
export function useRevenueCatSubscription() {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get usage data from Convex (musicGenerationsUsed, periodStart)
  // This is still needed as it's app-specific data
  const usageData = useQuery(api.usage.getCurrentUserUsage);

  // Load customer info from RevenueCat
  const loadCustomerInfo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load subscription status';
      setError(errorMessage);
      console.error('Failed to load RevenueCat customer info:', err);
    } finally {
      setLoading(false);
    }
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

