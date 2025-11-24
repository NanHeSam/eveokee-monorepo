import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useUsage, formatUsageText, formatRemainingQuota, getUsagePercentage, needsUpgrade } from '../../store/useSubscriptionStore';
import { useThemeColors } from '../../theme/useThemeColors';

interface UsageProgressProps {
  onUpgradePress?: () => void;
  showUpgradeButton?: boolean;
  compact?: boolean;
}

/**
 * Render a usage progress indicator for free-tier users with an optional upgrade prompt.
 *
 * Renders nothing when usage data is unavailable or the user is not on the free tier.
 *
 * @param onUpgradePress - Optional callback invoked when the Upgrade button is pressed
 * @param showUpgradeButton - Whether to show the Upgrade button when the user needs to upgrade (default: true)
 * @param compact - When true, render a compact inline progress bar instead of the full card layout (default: false)
 * @returns The component UI as a React element, or `null` when no UI should be rendered
 */
export function UsageProgress({
  onUpgradePress,
  showUpgradeButton = true,
  compact = false
}: UsageProgressProps) {
  const { usage } = useUsage();
  const colors = useThemeColors();

  if (!usage) {
    return null;
  }

  // Only show usage information for free tier users
  if (usage.tier !== 'free') {
    return null;
  }

  const usageText = formatUsageText(usage);
  const remainingText = formatRemainingQuota(usage);
  const usagePercentage = getUsagePercentage(usage);
  const needsUpgradeNow = needsUpgrade(usage);

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
    <View style={{ padding: 0 }}>
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-base font-medium" style={{ color: colors.textPrimary }}>
          Your song moments
        </Text>
        <Text className="text-sm font-medium" style={{ color: colors.textSecondary }}>
          {usageText}
        </Text>
      </View>

      <View className="rounded-full h-3 mb-3" style={{ backgroundColor: colors.border }}>
        <View 
          className="h-3 rounded-full"
          style={{ 
            width: `${usagePercentage}%`,
            backgroundColor: needsUpgradeNow ? '#FF6B6B' : colors.accentMint
          }}
        />
      </View>

      <View className="flex-row justify-between items-center">
        <Text className="text-sm" style={{ color: colors.textSecondary }}>
          {remainingText}
        </Text>
        
        {needsUpgradeNow && showUpgradeButton && (
          <TouchableOpacity 
            onPress={onUpgradePress}
            className="px-4 py-2 rounded-full"
            style={{ backgroundColor: colors.accentMint }}
          >
            <Text className="text-sm font-medium" style={{ color: colors.background }}>
              Continue your journey
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {needsUpgradeNow && (
        <View className="mt-3 p-3 rounded-xl" style={{ backgroundColor: 'rgba(255, 107, 107, 0.15)' }}>
          <Text className="text-sm text-center" style={{ color: '#FF6B6B' }}>
            Your creative energy has been fully expressed. Continue your journey to create more melodies.
          </Text>
        </View>
      )}
    </View>
  );
}