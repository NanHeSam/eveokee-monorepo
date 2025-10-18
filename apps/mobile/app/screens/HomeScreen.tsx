import { useCallback } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth, useUser } from '@clerk/clerk-expo';
import { useEffect } from 'react';
import { useMutation } from 'convex/react';

import { api } from '@backend/convex';
import { SubscriptionStatus } from '../components/billing/SubscriptionStatus';
import { PaywallModal } from '../components/billing/PaywallModal';
import { useSubscriptionUIStore } from '../store/useSubscriptionStore';

export const HomeScreen = () => {
  const { user } = useUser();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const ensureCurrentUser = useMutation(api.users.ensureCurrentUser);
  const { showPaywall, paywallReason, setShowPaywall } = useSubscriptionUIStore();

  useEffect(() => {
    ensureCurrentUser().catch((err) => {
      console.error('Failed to ensure Convex user document', err);
    });
  }, [ensureCurrentUser]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out failed', err);
    }
  }, [signOut]);

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Friend';

  return (
    <SafeAreaView className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      <View className="flex-1 justify-between px-6 py-8">
        <View className="gap-2">
          <Text className="text-[28px] font-semibold text-white">Welcome back</Text>
          <Text className="text-[22px] font-medium text-[#32D74B]">{displayName}</Text>
          <Text className="mt-3 text-base text-[#8E8E93]">You are signed in to Music Diary.</Text>
          
          {/* Subscription Status */}
          <View className="mt-6">
            <SubscriptionStatus 
              onPress={() => setShowPaywall(true, 'settings')}
              showUpgradeButton={true}
            />
          </View>
        </View>

        <TouchableOpacity onPress={handleSignOut} className="h-13 items-center justify-center rounded-[26px] bg-[#E5E5EA]" activeOpacity={0.85}>
          <Text className="text-base font-semibold text-black">Log out</Text>
        </TouchableOpacity>
      </View>
      
      {/* Paywall Modal */}
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        reason={paywallReason}
      />
    </SafeAreaView>
  );
};

