import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { GoogleIcon } from '../icons/GoogleIcon';
import { AppleIcon } from '../icons/AppleIcon';

interface SocialAuthButtonsProps {
  onGooglePress: () => void;
  onApplePress: () => void;
  isGoogleLoading?: boolean;
  isAppleLoading?: boolean;
  googleText?: string;
  appleText?: string;
}

export const SocialAuthButtons = ({
  onGooglePress,
  onApplePress,
  isGoogleLoading = false,
  isAppleLoading = false,
  googleText = "Continue with Google",
  appleText = "Continue with Apple",
}: SocialAuthButtonsProps) => {
  return (
    <>
      <TouchableOpacity
        style={[styles.googleButton, isGoogleLoading && styles.googleButtonDisabled]}
        onPress={onGooglePress}
        activeOpacity={0.9}
        disabled={isGoogleLoading}
      >
        <View style={styles.googleIconWrapper}>
          <GoogleIcon size={20} />
        </View>
        {isGoogleLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.googleButtonText}>{googleText}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.appleButton, isAppleLoading && styles.appleButtonDisabled]}
        onPress={onApplePress}
        activeOpacity={0.9}
        disabled={isAppleLoading}
      >
        <View style={styles.appleIconWrapper}>
          <AppleIcon size={20} />
        </View>
        {isAppleLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.appleButtonText}>{appleText}</Text>
        )}
      </TouchableOpacity>
    </>
  );
};

const styles = StyleSheet.create({
  googleButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4285F4',
    borderWidth: 0,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  googleButtonDisabled: {
    opacity: 0.75,
  },
  googleIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  appleButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#000',
    borderWidth: 0,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  appleButtonDisabled: {
    opacity: 0.75,
  },
  appleIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
