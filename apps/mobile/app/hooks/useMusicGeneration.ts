import { useState } from 'react';
import { Alert } from 'react-native';
import { useUsage, useSubscriptionUIStore, RecordGenerationResult } from '../store/useSubscriptionStore';
import { getCustomerInfo } from '../utils/revenueCat';

interface UseMusicGenerationOptions {
  onGenerationStart?: () => void;
  onGenerationComplete?: (result: RecordGenerationResult) => void;
  onGenerationError?: (error: Error) => void;
  showPaywallOnLimit?: boolean;
}

/**
 * Provides helpers to check generation quota, initiate a music generation, and read usage state.
 * Now includes RevenueCat reconciliation for accurate subscription status.
 *
 * @param options - Optional callbacks and behavior flags:
 *   - onGenerationStart: called when a generation begins.
 *   - onGenerationComplete: called with the generation result when recording succeeds.
 *   - onGenerationError: called with the thrown error when generation fails.
 *   - showPaywallOnLimit: when true (default), automatically opens the paywall on usage limit.
 * @returns An object with:
 *   - generateMusic: starts a music generation and returns the recording result or `null` on failure.
 *   - checkCanGenerate: returns `true` if the current usage allows a generation, `false` otherwise.
 *   - checkCanGenerateWithReconciliation: async version that reconciles with RevenueCat before checking.
 *   - getUsageInfo: returns current usage details (`canGenerate`, `currentUsage`, `limit`, optional `remainingQuota`, and `tier`) or `null` if unavailable.
 *   - isGenerating: `true` while a generation is in progress, `false` otherwise.
 */
export function useMusicGeneration(options: UseMusicGenerationOptions = {}) {
  const { recordGeneration, canGenerate, checkUsageWithReconciliation } = useUsage();
  const { setShowPaywall } = useSubscriptionUIStore();
  const [isGenerating, setIsGenerating] = useState(false);

  const {
    onGenerationStart,
    onGenerationComplete,
    onGenerationError,
    showPaywallOnLimit = true,
  } = options;

  const checkCanGenerate = (): boolean => {
    try {
      const result = canGenerate.data;
      
      if (!result?.canGenerate) {
        if (showPaywallOnLimit) {
          setShowPaywall(true, 'limit_reached');
        } else {
          Alert.alert(
            'Limit Reached',
            `You've used all your music generations (${result?.currentUsage || 0}/${result?.limit || 0}). Upgrade to continue creating music.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Upgrade', 
                onPress: () => setShowPaywall(true, 'limit_reached')
              }
            ]
          );
        }
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking generation limit:', error);
      Alert.alert('Error', 'Failed to check generation limit. Please try again.');
      return false;
    }
  };

  const checkCanGenerateWithReconciliation = async (): Promise<boolean> => {
    try {
      // Get RevenueCat customer info for reconciliation
      const rcCustomerInfo = await getCustomerInfo();
      
      // Check usage with reconciliation
      const result = await checkUsageWithReconciliation({ 
        rcCustomerInfo: rcCustomerInfo || undefined 
      });
      
      if (!result.canGenerate) {
        if (showPaywallOnLimit) {
          setShowPaywall(true, 'limit_reached');
        } else {
          Alert.alert(
            'Limit Reached',
            `You've used all your music generations (${result.currentUsage}/${result.limit}). Upgrade to continue creating music.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Upgrade', 
                onPress: () => setShowPaywall(true, 'limit_reached')
              }
            ]
          );
        }
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking generation limit with reconciliation:', error);
      Alert.alert('Error', 'Failed to check generation limit. Please try again.');
      return false;
    }
  };

  const generateMusic = async (): Promise<RecordGenerationResult | null> => {
    if (isGenerating) {
      Alert.alert('Please wait', 'Music generation is already in progress');
      return null;
    }

    // Check if user can generate music with reconciliation
    const canGenerateMusic = await checkCanGenerateWithReconciliation();
    if (!canGenerateMusic) {
      return null;
    }

    setIsGenerating(true);
    onGenerationStart?.();

    try {
      const result = await recordGeneration();
      
      if (result.success) {
        onGenerationComplete?.(result);
        return result;
      } else {
        // Handle limit reached case
        if (result.code === 'USAGE_LIMIT_REACHED') {
          if (showPaywallOnLimit) {
            setShowPaywall(true, 'limit_reached');
          } else {
            Alert.alert(
              'Limit Reached',
              `You've used all your music generations (${result.currentUsage}/${result.limit}). Upgrade to continue creating music.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Upgrade',
                  onPress: () => setShowPaywall(true, 'limit_reached')
                }
              ]
            );
          }
        } else {
          Alert.alert('Error', result.reason || 'Failed to record music generation');
        }
        return result;
      }
    } catch (error) {
      console.error('Error generating music:', error);
      onGenerationError?.(error as Error);
      Alert.alert('Error', 'Failed to generate music. Please try again.');
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const getUsageInfo = () => {
    try {
      const result = canGenerate.data;
      if (!result) {
        return null;
      }
      return {
        canGenerate: result.canGenerate,
        currentUsage: result.currentUsage,
        limit: result.limit,
        remainingQuota: result.remainingQuota,
        tier: result.tier,
      };
    } catch (error) {
      console.error('Error getting usage info:', error);
      return null;
    }
  };

  return {
    generateMusic,
    checkCanGenerate,
    checkCanGenerateWithReconciliation,
    getUsageInfo,
    isGenerating,
  };
}