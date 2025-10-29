import React, { useCallback, useState } from 'react';
import { Alert, Text, TouchableOpacity, View, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation } from 'convex/react';
import { api } from '@backend/convex';
import { useThemeColors } from '../theme/useThemeColors';

export const AccountScreen = () => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  // Cast to any to avoid transient type mismatch if Convex codegen is stale
  const deleteAccountMutation = useMutation((api as any).users.deleteAccount);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmAndDelete = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all journal entries. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteAccountMutation();
              Alert.alert('Account deleted', 'Your account and data have been permanently deleted.');
              // Sign out to clear authentication and local session
              await signOut();
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Something went wrong';
              // If account is already deleted or unauthorized, force logout
              if (message.includes('Unauthorized') || message.includes('User not found')) {
                await signOut();
                return;
              }
              Alert.alert(
                'Deletion failed',
                'We could not delete your account. Please check your connection and try again.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Retry', onPress: () => confirmAndDelete() },
                ],
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  }, [deleteAccountMutation, signOut]);

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background, paddingTop: insets.top }}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        <Text className="text-[26px] font-semibold" style={{ color: colors.textPrimary, marginBottom: 16 }}>
          Account
        </Text>

        <View className="rounded-3xl p-5" style={{ backgroundColor: colors.surface }}>
          <Text className="text-base" style={{ color: colors.textSecondary }}>
            Permanently delete your account and all associated data. This action cannot be undone.
          </Text>

          <TouchableOpacity
            className="mt-6 items-center rounded-[26px] py-4"
            style={{ backgroundColor: '#FF3B30', opacity: isDeleting ? 0.7 : 1 }}
            activeOpacity={0.85}
            disabled={isDeleting}
            onPress={confirmAndDelete}
          >
            {isDeleting ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator color="#FFFFFF" />
                <Text className="text-base font-semibold" style={{ color: '#FFFFFF' }}>Deleting…</Text>
              </View>
            ) : (
              <Text className="text-base font-semibold" style={{ color: '#FFFFFF' }}>Delete Account</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
