import { create } from 'zustand';
import { api } from '@backend/convex';
import { useQuery, useMutation } from 'convex/react';

export type SubscriptionTier = 'free' | 'weekly' | 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'in_grace';

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  musicLimit: number;
  periodDays: number;
  price: number;
  hasUnlimited: boolean;
}

export interface SubscriptionState {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  musicGenerationsUsed: number;
  musicLimit: number;
  hasUnlimited: boolean;
  periodStart: number;
  periodEnd: number;
  isActive: boolean;
}

export interface UsageState {
  tier: SubscriptionTier;
  musicGenerationsUsed: number;
  musicLimit: number;
  hasUnlimited: boolean;
  remainingQuota: number;
  periodStart: number;
  periodEnd: number;
}

export interface CanGenerateResult {
  canGenerate: boolean;
  tier: SubscriptionTier;
  currentUsage: number;
  limit: number;
  remainingQuota: number;
  hasUnlimited: boolean;
}

export interface RecordGenerationResult {
  success: boolean;
  reason?: string;
  currentUsage: number;
  limit: number;
  remainingQuota: number;
  tier: SubscriptionTier;
  hasUnlimited: boolean;
}

// Hook for subscription management
export function useSubscription() {
  const subscriptionStatus = useQuery(api.billing.getCurrentUserStatus);
  const availablePlans = useQuery(api.billing.getPlans);
  const ensureCurrentUser = useMutation(api.users.ensureCurrentUser);
  const resetCounters = useMutation(api.billing.resetCounters);

  return {
    subscriptionStatus,
    availablePlans,
    resetCounters,
    ensureCurrentUser,
  };
}

// Hook for usage tracking
export function useUsage() {
  const usage = useQuery(api.usage.getCurrentUserUsage);
  const recordGeneration = useMutation(api.usage.recordCurrentUserMusicGeneration);
  const canGenerate = useMutation(api.usage.canCurrentUserGenerateMusic);

  return {
    usage,
    recordGeneration,
    canGenerate,
  };
}

// Store for subscription UI state
type SubscriptionUIState = {
  showPaywall: boolean;
  paywallReason: 'limit_reached' | 'signup_prompt' | 'settings' | null;
  isLoading: boolean;
  setShowPaywall: (show: boolean, reason?: 'limit_reached' | 'signup_prompt' | 'settings') => void;
  setIsLoading: (loading: boolean) => void;
};

export const useSubscriptionUIStore = create<SubscriptionUIState>((set) => ({
  showPaywall: false,
  paywallReason: null,
  isLoading: false,
  setShowPaywall: (show, reason) => set({ 
    showPaywall: show, 
    paywallReason: show ? reason || null : null 
  }),
  setIsLoading: (loading) => set({ isLoading: loading }),
}));

// Utility functions for subscription checks
export function canUserGenerateMusic(usage: UsageState | undefined): boolean {
  if (!usage) return false;
  return usage.hasUnlimited || usage.remainingQuota > 0;
}

export function getUsagePercentage(usage: UsageState | undefined): number {
  if (!usage || usage.hasUnlimited) return 0;
  return Math.min(100, (usage.musicGenerationsUsed / usage.musicLimit) * 100);
}

export function formatUsageText(usage: UsageState | undefined): string {
  if (!usage) return 'Loading...';
  
  if (usage.hasUnlimited) {
    return 'Unlimited';
  }
  
  return `${usage.musicGenerationsUsed}/${usage.musicLimit}`;
}

export function formatRemainingQuota(usage: UsageState | undefined): string {
  if (!usage) return 'Loading...';
  
  if (usage.hasUnlimited) {
    return 'Unlimited';
  }
  
  return `${usage.remainingQuota} remaining`;
}

export function isSubscriptionExpired(subscription: SubscriptionState | undefined): boolean {
  if (!subscription) return false;
  return !subscription.isActive && subscription.status === 'expired';
}

export function needsUpgrade(usage: UsageState | undefined): boolean {
  if (!usage) return false;
  return !usage.hasUnlimited && usage.remainingQuota === 0;
}

