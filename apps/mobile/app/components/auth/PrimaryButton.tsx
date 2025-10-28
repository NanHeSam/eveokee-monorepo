import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemeColors } from '../../theme/useThemeColors';

interface PrimaryButtonProps {
  onPress: () => void;
  text: string;
  isLoading?: boolean;
  disabled?: boolean;
}

export const PrimaryButton = ({
  onPress,
  text,
  isLoading = false,
  disabled = false,
}: PrimaryButtonProps) => {
  const colors = useThemeColors();

  return (
    <TouchableOpacity
      style={[
        styles.primaryButton, 
        { backgroundColor: colors.border },
        (isLoading || disabled) && styles.primaryButtonDisabled
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={isLoading || disabled}
    >
      {isLoading ? (
        <ActivityIndicator color={colors.textPrimary} />
      ) : (
        <Text style={[styles.primaryButtonText, { color: colors.textPrimary }]}>
          {text}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  primaryButton: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
