import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useSubscription, SubscriptionPlan } from '../../store/useSubscriptionStore';
import { useConvexAuth } from 'convex/react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  reason?: 'limit_reached' | 'signup_prompt' | 'settings' | null;
}

export function PaywallModal({ visible, onClose, reason }: PaywallModalProps) {
  const { isLoading } = useConvexAuth();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { availablePlans } = useSubscription();
  const insets = useSafeAreaInsets();

  const getReasonTitle = (reason?: string | null) => {
    switch (reason) {
      case 'limit_reached':
        return 'You\'ve reached your limit!';
      case 'signup_prompt':
        return 'Upgrade to Pro';
      case 'settings':
        return 'Manage Subscription';
      default:
        return 'Upgrade to Pro';
    }
  };

  const getReasonDescription = (reason?: string | null) => {
    switch (reason) {
      case 'limit_reached':
        return 'You\'ve used all your free music generations. Upgrade to continue creating music.';
      case 'signup_prompt':
        return 'Unlock unlimited music generations and premium features.';
      case 'settings':
        return 'Choose a plan that works best for you.';
      default:
        return 'Unlock unlimited music generations and premium features.';
    }
  };

  const handlePlanSelect = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
  };

  const handlePurchase = async () => {
    if (!selectedPlan) return;

    setIsProcessing(true);
    
    try {
      // TODO: Implement actual purchase flow with react-native-iap
      // For now, just show a placeholder
      Alert.alert(
        'Purchase Flow',
        `This would initiate purchase of ${selectedPlan.tier} plan for $${selectedPlan.price}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'OK', 
            onPress: () => {
              // Placeholder for actual purchase logic
              console.log('Purchase initiated for:', selectedPlan);
              onClose();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert('Error', 'Failed to initiate purchase. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatPrice = (price: number) => {
    if (price === 0) return 'Free';
    return `$${price.toFixed(2)}`;
  };

  const getPlanFeatures = (plan: SubscriptionPlan) => {
    const features = [];
    
    if (plan.hasUnlimited) {
      features.push('Unlimited music generations');
    } else {
      features.push(`${plan.musicLimit} music generations per ${plan.periodDays} days`);
    }
    
    features.push('High-quality audio generation');
    features.push('Lyrics synchronization');
    features.push('Priority support');
    
    if (plan.tier !== 'free') {
      features.push('No ads');
      features.push('Premium themes');
    }
    
    return features;
  };

  const renderContent = () => (
    <SafeAreaView
      className="flex-1 bg-white"
      style={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) }}
    >
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pb-4 border-b border-gray-200">
        <View className="flex-1 pr-4">
          <Text className="text-3xl font-bold text-gray-900">
            {getReasonTitle(reason)}
          </Text>
          <Text className="text-base text-gray-600 mt-2">
            {getReasonDescription(reason)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          className="h-10 w-10 rounded-full bg-gray-100 items-center justify-center"
          accessibilityLabel="Close paywall"
        >
          <Text className="text-gray-500 text-2xl">×</Text>
        </TouchableOpacity>
      </View>

      {/* Plans */}
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingBottom: 32, paddingTop: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {availablePlans?.map((plan: any) => (
          <TouchableOpacity
            key={plan.tier}
            onPress={() => handlePlanSelect(plan)}
            className={`p-5 rounded-2xl border-2 mb-4 shadow-sm ${
              selectedPlan?.tier === plan.tier
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white'
            }`}
            activeOpacity={0.9}
          >
            <View className="flex-row justify-between items-start">
              <View className="flex-1 pr-4">
                <Text className="text-base font-semibold text-blue-600 uppercase tracking-wide">
                  {plan.tier === 'free' ? 'Starter' : `${plan.tier} Pro`}
                </Text>
                <Text className="text-3xl font-bold text-gray-900 mt-1">
                  {formatPrice(plan.price)}
                  {plan.tier !== 'free' && (
                    <Text className="text-lg text-gray-500 font-normal">
                      /{plan.periodDays === 7 ? 'week' : plan.periodDays === 30 ? 'month' : 'year'}
                    </Text>
                  )}
                </Text>
              </View>
              {selectedPlan?.tier === plan.tier && (
                <View className="w-8 h-8 bg-blue-500 rounded-full items-center justify-center">
                  <Text className="text-white text-lg font-bold">✓</Text>
                </View>
              )}
            </View>

            <View className="mt-4">
              {getPlanFeatures(plan).map((feature, index) => (
                <View key={index} className="flex-row items-center mb-2">
                  <Text className="text-blue-500 text-base mr-2">•</Text>
                  <Text className="text-gray-700 text-sm">{feature}</Text>
                </View>
              ))}
            </View>

            {plan.tier === 'yearly' && (
              <View className="mt-4 p-3 bg-green-100 rounded-xl">
                <Text className="text-green-800 text-sm font-medium text-center">
                  Best Value — Save 33%
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Purchase Button */}
      <View className="px-6 pt-4 border-t border-gray-200">
        <TouchableOpacity
          onPress={handlePurchase}
          disabled={!selectedPlan || isProcessing}
          className={`py-4 rounded-2xl ${
            selectedPlan && !isProcessing ? 'bg-blue-500' : 'bg-gray-300'
          }`}
          activeOpacity={0.9}
        >
          {isProcessing ? (
            <View className="flex-row items-center justify-center">
              <ActivityIndicator size="small" color="white" />
              <Text className="text-white font-semibold ml-2">Processing...</Text>
            </View>
          ) : (
            <Text className="text-white font-semibold text-center text-lg">
              {selectedPlan ? `Start ${selectedPlan.tier === 'free' ? 'Free' : 'Pro'} Plan` : 'Select a Plan'}
            </Text>
          )}
        </TouchableOpacity>

        <Text className="text-center text-xs text-gray-500 mt-3">
          Cancel anytime. No commitment required.
        </Text>
      </View>
    </SafeAreaView>
  );

  if (isLoading) {
    return (
      <Modal
        visible={visible}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={onClose}
      >
        <SafeAreaView className="flex-1 bg-white items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="text-center mt-4 text-gray-600">Loading...</Text>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      {renderContent()}
    </Modal>
  );
}

