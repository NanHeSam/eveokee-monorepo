import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useThemeColors } from '../../theme/useThemeColors';

interface AuthDividerProps {
  text?: string;
}

export const AuthDivider = ({ text = "OR" }: AuthDividerProps) => {
  const colors = useThemeColors();

  return (
    <View style={styles.dividerWrapper}>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Text style={[styles.dividerText, { color: colors.textMuted }]}>{text}</Text>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  dividerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 14,
  },
});
