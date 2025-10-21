import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSubscription, formatUsageText, formatRemainingQuota, getUsagePercentage } from '../../store/useSubscriptionStore';

interface SubscriptionStatusProps {
  onPress?: () => void;
  showUpgradeButton?: boolean;
  compact?: boolean;
}

export function SubscriptionStatus({ 
  onPress, 
  showUpgradeButton = true, 
  compact = false 
}: SubscriptionStatusProps) {
  const { subscriptionStatus, availablePlans } = useSubscription();

  if (!subscriptionStatus) {
    return (
      <View className="bg-gray-100 p-3 rounded-lg">
        <Text className="text-gray-600 text-sm">Loading subscription...</Text>
      </View>
    );
  }

  const { tier, musicGenerationsUsed, musicLimit, hasUnlimited, periodEnd, isActive } = subscriptionStatus;
  const usageText = formatUsageText({ 
    tier, 
    musicGenerationsUsed, 
    musicLimit, 
    hasUnlimited, 
    remainingQuota: hasUnlimited ? Infinity : musicLimit - musicGenerationsUsed,
    periodStart: subscriptionStatus.periodStart,
    periodEnd: subscriptionStatus.periodEnd
  });
  const remainingText = formatRemainingQuota({ 
    tier, 
    musicGenerationsUsed, 
    musicLimit, 
    hasUnlimited, 
    remainingQuota: hasUnlimited ? Infinity : musicLimit - musicGenerationsUsed,
    periodStart: subscriptionStatus.periodStart,
    periodEnd: subscriptionStatus.periodEnd
  });
  const usagePercentage = getUsagePercentage({ 
    tier, 
    musicGenerationsUsed, 
    musicLimit, 
    hasUnlimited, 
    remainingQuota: hasUnlimited ? Infinity : musicLimit - musicGenerationsUsed,
    periodStart: subscriptionStatus.periodStart,
    periodEnd: subscriptionStatus.periodEnd
  });

  const getTierDisplayName = (tier: string) => {
    switch (tier) {
      case 'free': return 'Free';
      case 'monthly': return 'Monthly Pro';
      case 'yearly': return 'Yearly Pro';
      default: return tier;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'free': return 'bg-gray-100 text-gray-800';
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

      {!hasUnlimited && (
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

      {hasUnlimited && (
        <Text className="text-sm text-gray-600">
          Unlimited music generations
        </Text>
      )}

      <Text className="text-xs text-gray-500 mt-2">
        {new Date(periodEnd).toLocaleDateString()} • {isActive ? 'Active' : 'Expired'}
      </Text>
    </TouchableOpacity>
  );
}

