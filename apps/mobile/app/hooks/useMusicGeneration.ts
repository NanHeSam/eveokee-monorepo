import { useState } from 'react';
import { Alert } from 'react-native';
import { useUsage, useSubscriptionUIStore, RecordGenerationResult } from '../store/useSubscriptionStore';

interface UseMusicGenerationOptions {
  onGenerationStart?: () => void;
  onGenerationComplete?: (result: RecordGenerationResult) => void;
  onGenerationError?: (error: Error) => void;
  showPaywallOnLimit?: boolean;
}

export function useMusicGeneration(options: UseMusicGenerationOptions = {}) {
  const { recordGeneration, canGenerate } = useUsage();
  const { setShowPaywall } = useSubscriptionUIStore();
  const [isGenerating, setIsGenerating] = useState(false);

  const {
    onGenerationStart,
    onGenerationComplete,
    onGenerationError,
    showPaywallOnLimit = true,
  } = options;

  const checkCanGenerate = async (): Promise<boolean> => {
    try {
      const result = await canGenerate();
      
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
      console.error('Error checking generation limit:', error);
      Alert.alert('Error', 'Failed to check generation limit. Please try again.');
      return false;
    }
  };

  const generateMusic = async (): Promise<RecordGenerationResult | null> => {
    if (isGenerating) {
      Alert.alert('Please wait', 'Music generation is already in progress');
      return null;
    }

    // Check if user can generate music
    const canGenerateMusic = await checkCanGenerate();
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

  const getUsageInfo = async () => {
    try {
      const result = await canGenerate();
      return {
        canGenerate: result.canGenerate,
        currentUsage: result.currentUsage,
        limit: result.limit,
        remainingQuota: result.remainingQuota,
        tier: result.tier,
        hasUnlimited: result.hasUnlimited,
      };
    } catch (error) {
      console.error('Error getting usage info:', error);
      return null;
    }
  };

  return {
    generateMusic,
    checkCanGenerate,
    getUsageInfo,
    isGenerating,
  };
}

