import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useUsage, formatUsageText, formatRemainingQuota, getUsagePercentage, needsUpgrade } from '../../store/useSubscriptionStore';

interface UsageProgressProps {
  onUpgradePress?: () => void;
  showUpgradeButton?: boolean;
  compact?: boolean;
}

export function UsageProgress({ 
  onUpgradePress, 
  showUpgradeButton = true, 
  compact = false 
}: UsageProgressProps) {
  const { usage } = useUsage();

  if (!usage) {
    return (
      <View className="bg-gray-100 p-3 rounded-lg">
        <Text className="text-gray-600 text-sm">Loading usage...</Text>
      </View>
    );
  }

  const { tier, musicGenerationsUsed, musicLimit, hasUnlimited, remainingQuota } = usage;
  const usageText = formatUsageText(usage);
  const remainingText = formatRemainingQuota(usage);
  const usagePercentage = getUsagePercentage(usage);
  const needsUpgradeNow = needsUpgrade(usage);

  // Don't show progress for unlimited plans
  if (hasUnlimited) {
    return (
      <View className="bg-green-50 p-3 rounded-lg border border-green-200">
        <View className="flex-row items-center">
          <Text className="text-green-600 text-sm font-medium">✓</Text>
          <Text className="text-green-800 text-sm font-medium ml-2">
            Unlimited music generations
          </Text>
        </View>
      </View>
    );
  }

  if (compact) {
    return (
      <View className="flex-row items-center">
        <View className="flex-1 mr-3">
          <View className="bg-gray-200 rounded-full h-2">
            <View 
              className={`h-2 rounded-full ${
                needsUpgradeNow ? 'bg-red-500' : 'bg-blue-500'
              }`}
              style={{ width: `${usagePercentage}%` }}
            />
          </View>
        </View>
        <Text className="text-sm text-gray-600 min-w-[60px] text-right">
          {usageText}
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-white p-4 rounded-lg border border-gray-200">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-sm font-medium text-gray-700">
          Music Generations
        </Text>
        <Text className="text-sm font-medium text-gray-900">
          {usageText}
        </Text>
      </View>

      <View className="bg-gray-200 rounded-full h-3 mb-2">
        <View 
          className={`h-3 rounded-full ${
            needsUpgradeNow ? 'bg-red-500' : 'bg-blue-500'
          }`}
          style={{ width: `${usagePercentage}%` }}
        />
      </View>

      <View className="flex-row justify-between items-center">
        <Text className="text-xs text-gray-500">
          {remainingText}
        </Text>
        
        {needsUpgradeNow && showUpgradeButton && (
          <TouchableOpacity 
            onPress={onUpgradePress}
            className="bg-blue-500 px-3 py-1 rounded-full"
          >
            <Text className="text-white text-xs font-medium">
              Upgrade
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {needsUpgradeNow && (
        <View className="mt-3 p-2 bg-red-50 rounded-lg border border-red-200">
          <Text className="text-red-800 text-xs text-center">
            You&apos;ve reached your limit. Upgrade to continue creating music.
          </Text>
        </View>
      )}
    </View>
  );
}

