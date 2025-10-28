import { Image, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback } from 'react';

import { useAuth, useUser } from '@clerk/clerk-expo';

import { useThemeColors } from '../theme/useThemeColors';
import { useSubscription, useSubscriptionUIStore } from '../store/useSubscriptionStore';
import { PaywallModal } from '../components/billing/PaywallModal';
import { UsageProgress } from '../components/billing/UsageProgress';

export const SettingsScreen = () => {
  const { user } = useUser();
  const { signOut } = useAuth();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  // Billing hooks
  const { subscriptionStatus } = useSubscription();
  const { showPaywall, paywallReason, setShowPaywall } = useSubscriptionUIStore();
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
              Subscription
            </Text>
            <View className="rounded-3xl p-5" style={{ backgroundColor: colors.surface }}>
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-sm" style={{ color: colors.textSecondary }}>
                  Plan
                </Text>
                <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                  {subscriptionStatus?.tier === 'free' && 'Free'}
                  {subscriptionStatus?.tier === 'monthly' && 'Monthly Pro'}
                  {subscriptionStatus?.tier === 'yearly' && 'Yearly Pro'}
                  {!subscriptionStatus?.tier && '—'}
                </Text>
              </View>

              {(() => {
                if (!subscriptionStatus?.periodEnd) return null;
                
                const date = new Date(subscriptionStatus.periodEnd);
                const isValidDate = !isNaN(date.getTime());
                
                return (
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>
                      {subscriptionStatus?.tier === 'free' ? 'Period Ends' : 'Renews On'}
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

              <View className="flex-row items-center justify-between">
                <Text className="text-sm" style={{ color: colors.textSecondary }}>
                  Status
                </Text>
                <Text
                  className="text-base font-semibold"
                  style={{ color: subscriptionStatus?.isActive ? colors.accentMint : colors.accentApricot }}
                >
                  {subscriptionStatus?.isActive ? 'Active' : 'Expired'}
                </Text>
              </View>

              {subscriptionStatus?.tier === 'free' && (
                <TouchableOpacity
                  className="mt-4 items-center rounded-[20px] py-3"
                  style={{ backgroundColor: colors.accentMint }}
                  activeOpacity={0.85}
                  onPress={() => setShowPaywall(true, 'settings')}
                >
                  <Text className="text-sm font-semibold" style={{ color: colors.background }}>
                    Upgrade to Pro
                  </Text>
                </TouchableOpacity>
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


