import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useThemeColors } from '../../theme/useThemeColors';

interface AuthFooterProps {
  showIcon?: boolean;
}

export const AuthFooter = ({ showIcon = false }: AuthFooterProps) => {
  const colors = useThemeColors();

  return (
    <View style={styles.footer}>
      {showIcon && <Text style={[styles.footerIcon, { color: colors.textSecondary }]}>♪</Text>}
      <Text style={[styles.footerText, { color: colors.accentMint }]}>eveokee</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    alignItems: 'center',
    gap: 6,
    paddingBottom: 16,
  },
  footerIcon: {
    fontSize: 16,
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
