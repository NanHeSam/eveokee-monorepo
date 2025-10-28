import { create } from 'zustand';
import { api } from '@backend/convex';
import { useQuery, useMutation } from 'convex/react';

export type SubscriptionTier = 'free' | 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'in_grace';

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  musicLimit: number;
  periodDays: number;
  price: number;
}

export interface SubscriptionState {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  musicGenerationsUsed: number;
  musicLimit: number;
  remainingQuota: number;
  periodStart: number;
  periodEnd: number;
  isActive: boolean;
}

export interface UsageState {
  tier: SubscriptionTier;
  musicGenerationsUsed: number;
  musicLimit: number;
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
}

export interface RecordGenerationResult {
  success: boolean;
  reason?: string;
  currentUsage: number;
  limit: number;
  remainingQuota: number;
  tier: SubscriptionTier;
}

// Hook for subscription management
export function useSubscription() {
  const subscriptionStatus = useQuery(api.billing.getCurrentUserStatus);
  const availablePlans = useQuery(api.billing.getPlans);
  const ensureCurrentUser = useMutation(api.users.ensureCurrentUser);

  return {
    subscriptionStatus,
    availablePlans,
    ensureCurrentUser,
  };
}

// Hook for usage tracking
export function useUsage() {
  const usage = useQuery(api.usage.getCurrentUserUsage);
  const recordGeneration = useMutation(api.usage.recordCurrentUserMusicGeneration);
  const canGenerate = useQuery(api.usage.canCurrentUserGenerateMusic);

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
  return usage.remainingQuota > 0;
}

export function getUsagePercentage(usage: UsageState | undefined): number {
  if (!usage) return 0;
  return Math.min(100, (usage.musicGenerationsUsed / usage.musicLimit) * 100);
}

export function formatUsageText(usage: UsageState | undefined): string {
  if (!usage) return 'Loading...';
  return `${usage.musicGenerationsUsed}/${usage.musicLimit}`;
}

export function formatRemainingQuota(usage: UsageState | undefined): string {
  if (!usage) return 'Loading...';
  return `${usage.remainingQuota} remaining`;
}

export function isSubscriptionExpired(subscription: SubscriptionState | undefined): boolean {
  if (!subscription) return false;
  return !subscription.isActive && subscription.status === 'expired';
}

export function needsUpgrade(usage: UsageState | undefined): boolean {
  if (!usage) return false;
  return usage.remainingQuota === 0;
}
