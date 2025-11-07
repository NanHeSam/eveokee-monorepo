/**
 * Example: Using RevenueCat as Single Source of Truth
 * 
 * This file shows how to update your components to read subscription status
 * directly from RevenueCat SDK instead of Convex DB.
 */

import { useEffect, useCallback } from 'react';
import { Image, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import Purchases, { PurchasesPackage } from 'react-native-purchases';

import { useRevenueCatSubscription } from '../app/hooks/useRevenueCatSubscription';
import { useRevenueCat } from '../app/hooks/useRevenueCat';
import { useThemeColors } from '../app/theme/useThemeColors';
import { useSubscriptionUIStore } from '../app/store/useSubscriptionStore';
import { PaywallModal } from '../app/components/billing/PaywallModal';
import { UsageProgress } from '../app/components/billing/UsageProgress';

// ============================================================================
// EXAMPLE 1: Settings Screen - Read from RevenueCat
// ============================================================================

export const SettingsScreenExample = () => {
  // OLD WAY: Reading from Convex DB
  // const { subscriptionStatus } = useSubscription(); // Reads from Convex
  
  // NEW WAY: Reading directly from RevenueCat (single source of truth)
  const { 
    subscriptionStatus,  // Subscription state from RevenueCat
    loading,            // Loading state
    refresh,            // Function to refresh from RevenueCat
    hasActiveSubscription // Quick check for active subscription
  } = useRevenueCatSubscription();

  // Refresh after purchase completes
  const handlePurchaseComplete = async () => {
    await refresh(); // Gets latest from RevenueCat SDK
  };

  if (loading) {
    return <Text>Loading subscription...</Text>;
  }

  return (
    <View>
      <Text>Plan: {subscriptionStatus?.tier}</Text>
      <Text>Status: {subscriptionStatus?.isActive ? 'Active' : 'Expired'}</Text>
      <Text>Expires: {new Date(subscriptionStatus?.periodEnd || 0).toLocaleDateString()}</Text>
    </View>
  );
};

// ============================================================================
// EXAMPLE 2: Purchase Flow - Refresh After Purchase
// ============================================================================

export const PurchaseFlowExample = () => {
  const { purchasePackage, loadCustomerInfo } = useRevenueCat();
  const { refresh } = useRevenueCatSubscription();

  const handlePurchase = async (packageToPurchase: PurchasesPackage) => {
    try {
      // Make purchase via RevenueCat SDK
      const result = await purchasePackage(packageToPurchase);
      
      if (result.success) {
        // RevenueCat SDK automatically updates customerInfo
        // But you can also manually refresh to be sure
        await refresh(); // Refresh subscription status
        
        // Or use the RevenueCat hook's refresh
        await loadCustomerInfo();
        
        console.log('Purchase successful! Subscription updated.');
      }
    } catch (error) {
      console.error('Purchase failed:', error);
    }
  };

  return null; // Component implementation
};

// ============================================================================
// EXAMPLE 3: Check Subscription Status Before Feature Access
// ============================================================================

export const FeatureGateExample = () => {
  const { hasActiveSubscription, subscriptionStatus } = useRevenueCatSubscription();

  const handleGenerateMusic = async () => {
    // Check subscription directly from RevenueCat
    if (!hasActiveSubscription) {
      // Show paywall
      return;
    }

    // Check usage limits
    if (subscriptionStatus?.remainingQuota === 0) {
      // Show paywall
      return;
    }

    // Proceed with music generation
    // ...
  };

  return null; // Component implementation
};

// ============================================================================
// EXAMPLE 4: Listen for Subscription Changes
// ============================================================================

export const SubscriptionListenerExample = () => {
  const { refresh } = useRevenueCatSubscription();

  useEffect(() => {
    // RevenueCat SDK automatically notifies when subscription changes
    // But you can also listen for customer info updates
    Purchases.addCustomerInfoUpdateListener((customerInfo) => {
      console.log('Subscription updated:', customerInfo);
      // Refresh your local state
      refresh();
    });

    // Note: addCustomerInfoUpdateListener doesn't return a cleanup function
    // The listener is automatically cleaned up when the component unmounts
  }, [refresh]);

  return null; // Component implementation
};

// ============================================================================
// EXAMPLE 5: Complete Settings Screen Implementation
// ============================================================================

export const SettingsScreenComplete = () => {
  const { user } = useUser();
  const { signOut } = useAuth();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  // Read subscription status directly from RevenueCat
  const { 
    subscriptionStatus, 
    loading, 
    refresh 
  } = useRevenueCatSubscription();
  
  const { showPaywall, paywallReason, setShowPaywall } = useSubscriptionUIStore();

  // Listen for subscription changes
  useEffect(() => {
    // RevenueCat SDK automatically notifies when subscription changes
    Purchases.addCustomerInfoUpdateListener(() => {
      refresh(); // Refresh when RevenueCat notifies of changes
    });

    // Note: addCustomerInfoUpdateListener doesn't return a cleanup function
    // The listener is automatically cleaned up when the component unmounts
  }, [refresh]);

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
            {/* ... avatar and name ... */}
          </View>

          {/* Subscription Status - Now from RevenueCat */}
          <View className="mt-6">
            <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
              Subscription
            </Text>
            <View className="rounded-3xl p-5" style={{ backgroundColor: colors.surface }}>
              {loading ? (
                <Text style={{ color: colors.textSecondary }}>Loading subscription...</Text>
              ) : (
                <>
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>
                      Plan
                    </Text>
                    <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                      {subscriptionStatus?.tier === 'free' && 'Free'}
                      {subscriptionStatus?.tier === 'weekly' && 'Weekly Premium'}
                      {subscriptionStatus?.tier === 'monthly' && 'Monthly Premium'}
                      {subscriptionStatus?.tier === 'yearly' && 'Yearly Premium'}
                      {!subscriptionStatus?.tier && '—'}
                    </Text>
                  </View>

                  {subscriptionStatus?.periodEnd && (
                    <View className="flex-row items-center justify-between mb-3">
                      <Text className="text-sm" style={{ color: colors.textSecondary }}>
                        {subscriptionStatus?.tier === 'free' ? 'Period Ends' : 'Renews On'}
                      </Text>
                      <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
                        {new Date(subscriptionStatus.periodEnd).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </Text>
                    </View>
                  )}

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
                        Upgrade to Premium
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>

          {/* ... rest of the screen ... */}
        </View>
      </ScrollView>

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        reason={paywallReason}
        onPurchased={refresh} // Refresh after purchase
      />
    </SafeAreaView>
  );
};

