import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useThemeColors } from '../../theme/useThemeColors';

interface AuthNavigationLinkProps {
  hint: string;
  linkText: string;
  onPress: () => void;
}

export const AuthNavigationLink = ({ hint, linkText, onPress }: AuthNavigationLinkProps) => {
  const colors = useThemeColors();

  return (
    <View style={styles.navigationWrapper}>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>{hint}</Text>
      <TouchableOpacity onPress={onPress} hitSlop={8}>
        <Text style={[styles.link, { color: colors.accentMint }]}>{linkText}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  navigationWrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  hint: {
    fontSize: 14,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
  },
});
