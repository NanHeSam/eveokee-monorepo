/**
 * RevenueCat Subscription Utilities
 * 
 * This module provides utilities to read subscription status directly from RevenueCat SDK,
 * making RevenueCat the single source of truth for subscription status on mobile.
 */

import { CustomerInfo } from 'react-native-purchases';
import { SubscriptionTier, SubscriptionStatus, SubscriptionState } from '../store/useSubscriptionStore';

// Map RevenueCat product IDs to our subscription tiers
const REVENUECAT_PRODUCT_TO_TIER: Record<string, SubscriptionTier> = {
  'eveokee_premium_weekly': 'weekly',
  'eveokee_premium_monthly': 'monthly',
  'eveokee_premium_annual': 'yearly',
  'eveokee_premium:eveokee-premium-annual': 'yearly', // android store identifier
  'eveokee_premium:eveokee-premium-monthly': 'monthly', // android store identifier
  'eveokee_premium:eveokee-premium-weekly': 'weekly', // android store identifier
  'free-tier': 'free',
} as const;

// Plan configuration (should match backend PLAN_CONFIG)
const PLAN_CONFIG = {
  free: { musicLimit: 5, periodDays: 30 },
  weekly: { musicLimit: 20, periodDays: 7 },
  monthly: { musicLimit: 90, periodDays: 30 },
  yearly: { musicLimit: 1000, periodDays: 365 },
} as const;

/**
 * Get subscription tier from RevenueCat product ID
 */
function getTierFromProductId(productId: string | undefined): SubscriptionTier {
  if (!productId) return 'free';
  return REVENUECAT_PRODUCT_TO_TIER[productId] || 'free';
}

/**
 * Get subscription tier from RevenueCat entitlements
 * Checks active entitlements to determine the highest tier
 */
function getTierFromEntitlements(customerInfo: CustomerInfo): SubscriptionTier {
  const activeEntitlements = customerInfo.entitlements.active;
  
  // Check for Premium entitlement (which grants access)
  if (Object.keys(activeEntitlements).length > 0) {
    // Get the active product identifier from entitlements
    const entitlement = Object.values(activeEntitlements)[0];
    const productIdentifier = entitlement.productIdentifier;
    
    // Map product identifier to tier
    return getTierFromProductId(productIdentifier);
  }
  
  return 'free';
}

/**
 * Get subscription status from RevenueCat customer info
 */
function getStatusFromCustomerInfo(customerInfo: CustomerInfo): SubscriptionStatus {
  const activeEntitlements = customerInfo.entitlements.active;
  
  // If user has active entitlements, subscription is active
  if (Object.keys(activeEntitlements).length > 0) {
    // Check if subscription is in grace period (billing issue)
    const entitlement = Object.values(activeEntitlements)[0];
    if (entitlement.willRenew === false && entitlement.isActive === true) {
      // Subscription is active but won't renew - could be in grace period
      return 'in_grace';
    }
    return 'active';
  }
  
  // Check if subscription was recently expired
  const allEntitlements = customerInfo.entitlements.all;
  if (Object.keys(allEntitlements).length > 0) {
    // User had entitlements but they're not active anymore
    return 'expired';
  }
  
  return 'expired';
}

/**
 * Get expiration date from RevenueCat customer info
 */
function getExpirationDate(customerInfo: CustomerInfo): number | null {
  const activeEntitlements = customerInfo.entitlements.active;
  
  if (Object.keys(activeEntitlements).length > 0) {
    const entitlement = Object.values(activeEntitlements)[0];
    const expirationDate = entitlement.expirationDate;
    
    if (expirationDate) {
      return new Date(expirationDate).getTime();
    }
  }
  
  return null;
}

/**
 * Get purchase date from RevenueCat customer info
 */
function getPurchaseDate(customerInfo: CustomerInfo): number | null {
  const activeEntitlements = customerInfo.entitlements.active;
  
  if (Object.keys(activeEntitlements).length > 0) {
    const entitlement = Object.values(activeEntitlements)[0];
    const purchaseDate = entitlement.latestPurchaseDate;
    
    if (purchaseDate) {
      return new Date(purchaseDate).getTime();
    }
  }
  
  return null;
}

/**
 * Get isActive status from RevenueCat customer info
 * Reads directly from RevenueCat entitlement's isActive property (single source of truth)
 */
function getIsActive(customerInfo: CustomerInfo): boolean {
  const activeEntitlements = customerInfo.entitlements.active;
  
  if (Object.keys(activeEntitlements).length > 0) {
    const entitlement = Object.values(activeEntitlements)[0];
    return entitlement.isActive === true;
  }
  
  return false;
}

/**
 * Convert RevenueCat CustomerInfo to SubscriptionState
 * 
 * This function reads directly from RevenueCat SDK, making it the single source of truth.
 * Usage data (musicGenerationsUsed) still comes from Convex DB as it's app-specific.
 */
export function customerInfoToSubscriptionState(
  customerInfo: CustomerInfo | null,
  usageData?: {
    musicGenerationsUsed: number;
    periodStart: number;
  }
): SubscriptionState | null {
  if (!customerInfo) {
    return null;
  }

  // Get tier from RevenueCat entitlements
  const tier = getTierFromEntitlements(customerInfo);
  
  // Get status from RevenueCat
  const status = getStatusFromCustomerInfo(customerInfo);
  
  // Get expiration date from RevenueCat
  const expirationDate = getExpirationDate(customerInfo);
  
  // Get purchase date from RevenueCat (use as period start if available)
  const purchaseDate = getPurchaseDate(customerInfo);
  
  // Get isActive directly from RevenueCat entitlement (single source of truth)
  const isActive = getIsActive(customerInfo);
  
  // Get plan configuration
  const planConfig = PLAN_CONFIG[tier];
  
  // Safety check: if tier is not found in PLAN_CONFIG, default to free tier
  if (!planConfig) {
    console.warn(`Unknown tier "${tier}", defaulting to free tier`);
    const freeConfig = PLAN_CONFIG.free;
    return {
      tier: 'free',
      status,
      musicGenerationsUsed: usageData?.musicGenerationsUsed ?? 0,
      musicLimit: freeConfig.musicLimit,
      remainingQuota: Math.max(0, freeConfig.musicLimit - (usageData?.musicGenerationsUsed ?? 0)),
      periodStart: usageData?.periodStart ?? purchaseDate ?? Date.now(),
      periodEnd: expirationDate ?? (usageData?.periodStart ?? purchaseDate ?? Date.now()) + (freeConfig.periodDays * 24 * 60 * 60 * 1000),
      isActive,
    };
  }
  
  const musicLimit = planConfig.musicLimit;
  
  // Use provided usage data or default to 0
  const musicGenerationsUsed = usageData?.musicGenerationsUsed ?? 0;
  const periodStart = usageData?.periodStart ?? purchaseDate ?? Date.now();
  
  // Calculate period end
  const periodDurationMs = planConfig.periodDays * 24 * 60 * 60 * 1000;
  const periodEnd = expirationDate ?? (periodStart + periodDurationMs);
  
  // Calculate remaining quota
  const remainingQuota = Math.max(0, musicLimit - musicGenerationsUsed);

  return {
    tier,
    status,
    musicGenerationsUsed,
    musicLimit,
    remainingQuota,
    periodStart,
    periodEnd,
    isActive,
  };
}

/**
 * Check if user has active subscription from RevenueCat
 */
export function hasActiveSubscription(customerInfo: CustomerInfo | null): boolean {
  if (!customerInfo) return false;
  return Object.keys(customerInfo.entitlements.active).length > 0;
}

/**
 * Get active product ID from RevenueCat customer info
 */
export function getActiveProductId(customerInfo: CustomerInfo | null): string | null {
  if (!customerInfo) return null;
  
  const activeEntitlements = customerInfo.entitlements.active;
  if (Object.keys(activeEntitlements).length > 0) {
    const entitlement = Object.values(activeEntitlements)[0];
    return entitlement.productIdentifier;
  }
  
  return null;
}

