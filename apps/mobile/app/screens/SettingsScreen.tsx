import { Image, Text, TouchableOpacity, View, ScrollView, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useState } from 'react';

import { useAuth, useUser } from '@clerk/clerk-expo';
import { useMutation } from 'convex/react';

import { useThemeColors } from '../theme/useThemeColors';
import { useSubscription, useSubscriptionUIStore } from '../store/useSubscriptionStore';
import { SubscriptionStatus } from '../components/billing/SubscriptionStatus';
import { PaywallModal } from '../components/billing/PaywallModal';
import { api } from 'convex-backend';

export const SettingsScreen = () => {
  const { user } = useUser();
  const { signOut } = useAuth();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Billing hooks
  const { subscriptionStatus, ensureCurrentUser } = useSubscription();
  const { showPaywall, paywallReason, setShowPaywall } = useSubscriptionUIStore();
  
  // Test mutations for subscription simulation
  const testSubscriptionSuccess = useMutation(api.billing.testSubscriptionSuccess);
  const testSubscriptionFailure = useMutation(api.billing.testSubscriptionFailure);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out failed', err);
    }
  }, [signOut]);

  const handleTestSubscriptionSuccess = useCallback(async () => {
    setIsProcessing(true);
    try {
      const { userId } = await ensureCurrentUser();
      await testSubscriptionSuccess({ userId, tier: 'monthly' });
      Alert.alert('Success!', 'Test subscription activated successfully');
    } catch (error) {
      console.error('Test subscription success failed:', error);
      Alert.alert('Error', 'Failed to activate test subscription');
    } finally {
      setIsProcessing(false);
    }
  }, [ensureCurrentUser, testSubscriptionSuccess]);

  const handleTestSubscriptionFailure = useCallback(async () => {
    setIsProcessing(true);
    try {
      const { userId } = await ensureCurrentUser();
      await testSubscriptionFailure({ userId });
      Alert.alert('Test Complete', 'Subscription failure scenario simulated');
    } catch (error) {
      console.error('Test subscription failure failed:', error);
      Alert.alert('Error', 'Failed to simulate subscription failure');
    } finally {
      setIsProcessing(false);
    }
  }, [ensureCurrentUser, testSubscriptionFailure]);

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Friend';
  const email = user?.primaryEmailAddress?.emailAddress;
  const avatar = user?.imageUrl;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background, paddingTop: insets.top }}>
      <ScrollView className="flex-1" style={{ backgroundColor: colors.background }}>
        <View className="p-6">
          <Text className="text-[26px] font-semibold" style={{ color: colors.textPrimary }}>
            Settings
          </Text>

          {/* User Profile */}
          <View className="mt-7 flex-row items-center gap-4 rounded-3xl p-5" style={{ backgroundColor: colors.surface }}>
            {avatar ? (
              <Image source={{ uri: avatar }} className="h-18 w-18 rounded-full" />
            ) : (
              <View className="h-18 w-18 items-center justify-center rounded-full" style={{ backgroundColor: colors.card }}>
                <Text className="text-[26px] font-bold" style={{ color: colors.textPrimary }}>
                  {displayName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}

            <View className="flex-1">
              <Text className="text-xl font-semibold" style={{ color: colors.textPrimary }}>
                {displayName}
              </Text>
              {email ? (
                <Text className="mt-1 text-base" style={{ color: colors.textSecondary }}>
                  {email}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Subscription Status */}
          <View className="mt-6">
            <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
              Subscription Type:{' '}
              <Text style={{ color: colors.textPrimary, fontWeight: 'bold' }}>
                {subscriptionStatus?.tier
                  ? subscriptionStatus.tier.charAt(0).toUpperCase() + subscriptionStatus.tier.slice(1)
                  : '—'}
              </Text>
            </Text>
            <SubscriptionStatus 
              onPress={() => setShowPaywall(true, 'settings')}
              showUpgradeButton={true}
            />
          </View>

          {/* Test Buttons (only show for free tier) */}
          {subscriptionStatus?.tier === 'free' && (
            <View className="mt-6">
              <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
                Test Subscription Flow
              </Text>
              <Text className="text-sm mb-4" style={{ color: colors.textSecondary }}>
                Use these buttons to test the subscription flow without payment processing
              </Text>
              
              <View className="gap-3">
                <TouchableOpacity
                  className="items-center rounded-[26px] py-4"
                  style={{ backgroundColor: colors.accentMint, opacity: isProcessing ? 0.7 : 1 }}
                  activeOpacity={0.85}
                  onPress={handleTestSubscriptionSuccess}
                  disabled={isProcessing}
                >
                  <Text className="text-base font-semibold" style={{ color: colors.background }}>
                    {isProcessing ? 'Processing...' : 'Test: Activate Monthly Pro'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="items-center rounded-[26px] py-4"
                  style={{ backgroundColor: colors.accentApricot, opacity: isProcessing ? 0.7 : 1 }}
                  activeOpacity={0.85}
                  onPress={handleTestSubscriptionFailure}
                  disabled={isProcessing}
                >
                  <Text className="text-base font-semibold" style={{ color: colors.background }}>
                    {isProcessing ? 'Processing...' : 'Test: Simulate Payment Failure'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Logout Button */}
          <TouchableOpacity
            className="mt-8 items-center rounded-[26px] py-4"
            style={{ backgroundColor: colors.accentApricot }}
            activeOpacity={0.85}
            onPress={handleSignOut}
          >
            <Text className="text-base font-semibold" style={{ color: colors.background }}>
              Log out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Paywall Modal */}
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        reason={paywallReason}
      />
    </SafeAreaView>
  );
};


