import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { formatUsageText, formatRemainingQuota, getUsagePercentage } from '../../store/useSubscriptionStore';
import { useRevenueCatSubscription } from '../../hooks/useRevenueCatSubscription';

interface SubscriptionStatusProps {
  onPress?: () => void;
  showUpgradeButton?: boolean;
  compact?: boolean;
}

/**
 * Renders a subscription status UI that reflects the current subscription and usage.
 *
 * Displays a compact tier pill when `compact` is true, otherwise renders a full card with tier badge,
 * optional upgrade action, usage progress for the Free tier, and the billing period end plus active state.
 * The component reads subscription state directly from RevenueCat SDK (single source of truth); while that data is loading it shows
 * a small "Loading subscription…" placeholder.
 *
 * @param onPress - Optional handler invoked when the component is pressed.
 * @param showUpgradeButton - Whether to show the "Upgrade" label for the Free tier (default: `true`).
 * @param compact - When `true`, renders a compact pill-style badge instead of the full card (default: `false`).
 * @returns The rendered SubscriptionStatus React element.
 */
export function SubscriptionStatus({ 
  onPress, 
  showUpgradeButton = true, 
  compact = false 
}: SubscriptionStatusProps) {
  const { subscriptionStatus, loading } = useRevenueCatSubscription();

  if (loading || !subscriptionStatus) {
    return (
      <View className="bg-gray-100 p-3 rounded-lg">
        <Text className="text-gray-600 text-sm">Loading subscription...</Text>
      </View>
    );
  }

  const { tier, musicGenerationsUsed, musicLimit, remainingQuota, periodEnd, periodStart, isActive } = subscriptionStatus;

  const usageData = {
    tier,
    musicGenerationsUsed,
    musicLimit,
    remainingQuota,
    periodStart,
    periodEnd,
  };

  const usageText = formatUsageText(usageData);
  const remainingText = formatRemainingQuota(usageData);
  const usagePercentage = getUsagePercentage(usageData);

  const getTierDisplayName = (tier: string) => {
    switch (tier) {
      case 'free': return 'Free';
      case 'weekly': return 'Weekly Premium';
      case 'monthly': return 'Monthly Premium';
      case 'yearly': return 'Yearly Premium';
      default: return tier;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'free': return 'bg-gray-100 text-gray-800';
      case 'weekly': return 'bg-blue-100 text-blue-800';
      case 'monthly': return 'bg-purple-100 text-purple-800';
      case 'yearly': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (compact) {
    return (
      <TouchableOpacity 
        onPress={onPress}
        className={`px-3 py-2 rounded-full ${getTierColor(tier)}`}
      >
        <Text className="text-sm font-medium">
          {getTierDisplayName(tier)}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      onPress={onPress}
      className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm"
    >
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <View className={`px-2 py-1 rounded-full ${getTierColor(tier)} mr-2`}>
            <Text className="text-xs font-medium">
              {getTierDisplayName(tier)}
            </Text>
          </View>
          {!isActive && (
            <Text className="text-xs text-red-600 font-medium">
              Expired
            </Text>
          )}
        </View>
        {showUpgradeButton && tier === 'free' && (
          <Text className="text-blue-600 text-sm font-medium">
            Upgrade
          </Text>
        )}
      </View>

      {tier === 'free' && (
        <View className="mb-2">
          <View className="flex-row justify-between items-center mb-1">
            <Text className="text-sm text-gray-600">Music Generations</Text>
            <Text className="text-sm font-medium">{usageText}</Text>
          </View>
          <View className="bg-gray-200 rounded-full h-2">
            <View
              className="bg-blue-500 h-2 rounded-full"
              style={{ width: `${usagePercentage}%` }}
            />
          </View>
          <Text className="text-xs text-gray-500 mt-1">
            {remainingText}
          </Text>
        </View>
      )}

      <Text className="text-xs text-gray-500 mt-2">
        {new Date(periodEnd).toLocaleDateString()} • {isActive ? 'Active' : 'Expired'}
      </Text>
    </TouchableOpacity>
  );
}