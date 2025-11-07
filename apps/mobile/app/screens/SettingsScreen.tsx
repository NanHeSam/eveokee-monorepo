import { Image, Text, TouchableOpacity, View, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Purchases from 'react-native-purchases';

import { useAuth, useUser } from '@clerk/clerk-expo';

import { useThemeColors } from '../theme/useThemeColors';
import { useRevenueCatSubscription } from '../hooks/useRevenueCatSubscription';
import { useSubscriptionUIStore } from '../store/useSubscriptionStore';
import { PaywallModal } from '../components/billing/PaywallModal';
import { UsageProgress } from '../components/billing/UsageProgress';

export const SettingsScreen = () => {
  const { user } = useUser();
  const { signOut } = useAuth();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  // Billing hooks - Read directly from RevenueCat SDK (single source of truth)
  const { subscriptionStatus, loading: subscriptionLoading, refresh: refreshSubscription } = useRevenueCatSubscription();
  const { showPaywall, paywallReason, setShowPaywall } = useSubscriptionUIStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh subscription status when screen comes into focus
  // This ensures the UI updates when navigating back to Settings after subscription changes
  // Uses cached data if available (no force refresh)
  useFocusEffect(
    useCallback(() => {
      refreshSubscription(false);
    }, [refreshSubscription])
  );

  // Handle pull-to-refresh - forces a fresh fetch from RevenueCat servers
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshSubscription(true); // Force refresh to get latest data from RevenueCat
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshSubscription]);

  // Listen for subscription changes from RevenueCat SDK
  useEffect(() => {
    // RevenueCat SDK automatically notifies when subscription changes
    // The listener callback will be called whenever customerInfo updates
    // Deduplication in useRevenueCatSubscription prevents duplicate API calls
    Purchases.addCustomerInfoUpdateListener(() => {
      // Refresh subscription status when RevenueCat notifies of changes
      // Uses cached data if available (no force refresh)
      refreshSubscription(false);
    });

    // Note: addCustomerInfoUpdateListener doesn't return a cleanup function
    // The listener is automatically cleaned up when the component unmounts
  }, [refreshSubscription]);
  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out failed', err);
    }
  }, [signOut]);

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Friend';
  const email = user?.primaryEmailAddress?.emailAddress;
  const avatar = user?.imageUrl;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background, paddingTop: insets.top }}>
      <ScrollView 
        className="flex-1" 
        style={{ backgroundColor: colors.background }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || subscriptionLoading}
            onRefresh={handleRefresh}
            tintColor={colors.textSecondary}
            colors={[colors.accentMint]} // Android
          />
        }
      >
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
              Subscription
            </Text>
            <View className="rounded-3xl p-5" style={{ backgroundColor: colors.surface }}>
              {subscriptionLoading ? (
                <Text className="text-sm" style={{ color: colors.textSecondary }}>
                  Loading subscription...
                </Text>
              ) : (
                <>
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>
                      Plan
                    </Text>
                    <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                      {(() => {
                        const tier = subscriptionStatus?.tier;
                        if (tier === 'free') return 'Free';
                        if (tier === 'weekly') return 'Weekly Premium';
                        if (tier === 'monthly') return 'Monthly Premium';
                        if (tier === 'yearly') return 'Yearly Premium';
                        return '—';
                      })()}
                    </Text>
                  </View>

              {(() => {
                // Only show period end for paid plans (not free)
                if (subscriptionStatus?.tier === 'free' || !subscriptionStatus?.periodEnd) return null;
                
                const date = new Date(subscriptionStatus.periodEnd);
                const isValidDate = !isNaN(date.getTime());
                const willRenew = subscriptionStatus?.willRenew;
                
                return (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>
                      {willRenew === true ? 'Renews On' : willRenew === false ? 'Will Expire On' : 'Renews On'}
                    </Text>
                    <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                      {isValidDate
                        ? date.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })
                        : '—'}
                    </Text>
                  </View>
                );
              })()}

                  {subscriptionStatus?.tier === 'free' && (
                    <TouchableOpacity
                      className="mt-4 items-center rounded-[20px] py-3"
                      style={{ backgroundColor: colors.accentMint }}
                      activeOpacity={0.85}
                      onPress={() => setShowPaywall(true, 'settings')}
                    >
                      <Text className="text-sm font-semibold" style={{ color: colors.background }}>
                        Upgrade to Premium
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>

          {/* Usage Information - Only show for free tier */}
          {subscriptionStatus?.tier === 'free' && (
            <View className="mt-6">
              <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
              Free Tier Usage
              </Text>
              <View className="rounded-3xl p-5" style={{ backgroundColor: colors.surface }}>
                <UsageProgress
                  onUpgradePress={() => setShowPaywall(true, 'settings')}
                  showUpgradeButton={true}
                />
              </View>
            </View>
          )}

          {/* Logout Button */}
          <TouchableOpacity
            className="mt-8 items-center rounded-[26px] py-4"
            style={{ backgroundColor: '#FF4444' }}
            activeOpacity={0.85}
            onPress={handleSignOut}
          >
            <Text className="text-base font-semibold" style={{ color: '#FFFFFF' }}>
              Log out
            </Text>
          </TouchableOpacity>

          {/* Account Management */}
          <View className="mt-6">
            <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
              Account
            </Text>
            <TouchableOpacity
              className="rounded-3xl p-5"
              style={{ backgroundColor: colors.surface }}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Account' as never)}
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-medium" style={{ color: colors.textPrimary }}>
                  Delete Account
                </Text>
                <Text className="text-base" style={{ color: colors.textSecondary }}>
                  {'>'}
                </Text>
              </View>
              <Text className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
                Permanently delete your account and all journal entries.
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Paywall Modal */}
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onPurchased={() => refreshSubscription(true)} // Force refresh after purchase
        reason={paywallReason}
      />
    </SafeAreaView>
  );
};


