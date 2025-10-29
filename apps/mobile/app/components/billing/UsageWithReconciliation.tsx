import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useUsage } from '../../store/useSubscriptionStore';
import { getCustomerInfo } from '../../utils/revenueCat';

interface UsageWithReconciliationProps {
  onUpgradePress?: () => void;
  showUpgradeButton?: boolean;
}

/**
 * Usage component that reconciles with RevenueCat before displaying usage information.
 * This ensures the most accurate subscription status by comparing mobile and backend states.
 */
export function UsageWithReconciliation({
  onUpgradePress,
  showUpgradeButton = true
}: UsageWithReconciliationProps) {
  const { checkUsageWithReconciliation } = useUsage();
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconciledUsage, setReconciledUsage] = useState<any>(null);

  const handleReconcileUsage = async () => {
    setIsReconciling(true);
    try {
      // Get RevenueCat customer info for reconciliation
      const rcCustomerInfo = await getCustomerInfo();
      
      // Check usage with reconciliation
      const result = await checkUsageWithReconciliation({ 
        rcCustomerInfo: rcCustomerInfo || undefined 
      });
      
      setReconciledUsage(result);
      
      if (result.reconciled) {
        console.log('Usage reconciled with RevenueCat');
      }
    } catch (error) {
      console.error('Failed to reconcile usage:', error);
    } finally {
      setIsReconciling(false);
    }
  };

  const usage = reconciledUsage || { canGenerate: false, currentUsage: 0, limit: 0, remainingQuota: 0, tier: 'free' };

  return (
    <View className="bg-white p-4 rounded-lg border border-gray-200">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-sm font-medium text-gray-700">
          Music Generations
        </Text>
        <TouchableOpacity 
          onPress={handleReconcileUsage}
          disabled={isReconciling}
          className="flex-row items-center"
        >
          {isReconciling ? (
            <ActivityIndicator size="small" color="#3B82F6" />
          ) : (
            <Text className="text-xs text-blue-500">Refresh</Text>
          )}
        </TouchableOpacity>
      </View>

      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-sm font-medium text-gray-900">
          {usage.currentUsage}/{usage.limit}
        </Text>
        <Text className="text-xs text-gray-500">
          {usage.remainingQuota} remaining
        </Text>
      </View>

      <View className="bg-gray-200 rounded-full h-3 mb-2">
        <View 
          className={`h-3 rounded-full ${
            usage.remainingQuota === 0 ? 'bg-red-500' : 'bg-blue-500'
          }`}
          style={{ width: `${(usage.currentUsage / usage.limit) * 100}%` }}
        />
      </View>

      {usage.remainingQuota === 0 && showUpgradeButton && (
        <TouchableOpacity 
          onPress={onUpgradePress}
          className="bg-blue-500 px-3 py-2 rounded-lg mt-2"
        >
          <Text className="text-white text-sm font-medium text-center">
            Upgrade to Continue
          </Text>
        </TouchableOpacity>
      )}

      {reconciledUsage?.reconciled && (
        <View className="mt-2 p-2 bg-green-50 rounded-lg border border-green-200">
          <Text className="text-green-800 text-xs text-center">
            ✓ Synced with RevenueCat
          </Text>
        </View>
      )}
    </View>
  );
}
