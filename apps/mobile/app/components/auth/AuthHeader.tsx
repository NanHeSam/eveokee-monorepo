import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useThemeColors } from '../../theme/useThemeColors';

interface AuthHeaderProps {
  subtitle?: string;
  title?: string;
  titleColor?: string;
  subtitleColor?: string;
}

export const AuthHeader = ({ 
  subtitle, 
  title = "eveokee", 
  titleColor,
  subtitleColor 
}: AuthHeaderProps) => {
  const colors = useThemeColors();
  
  const defaultTitleColor = titleColor || colors.accentMint;
  const defaultSubtitleColor = subtitleColor || colors.textSecondary;

  return (
    <View style={styles.logoWrapper}>
      {subtitle && (
        <Text style={[styles.subtitle, { color: defaultSubtitleColor }]}>
          {subtitle}
        </Text>
      )}
      <Text style={[styles.logoText, { color: defaultTitleColor }]}>
        {title}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  logoWrapper: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
});
