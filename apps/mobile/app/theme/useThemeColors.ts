import { useColorScheme } from 'react-native';
import { useMemo } from 'react';

import { palette } from './colors';

export type ThemeColors = {
  scheme: 'light' | 'dark';
  background: string;
  surface: string;
  card: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentMint: string;
  accentApricot: string;
  border: string;
};

const buildThemeColors = (scheme: 'light' | 'dark'): ThemeColors => {
  if (scheme === 'dark') {
    return {
      scheme,
      background: palette.backgroundDark,
      surface: palette.surfaceDark,
      card: palette.cardDark,
      textPrimary: palette.textPrimaryDark,
      textSecondary: palette.textSecondaryDark,
      textMuted: palette.textMutedDark,
      accentMint: palette.accentMintDark,
      accentApricot: palette.accentApricotDark,
      border: '#2A2A40'
    };
  }

  return {
    scheme,
    background: palette.backgroundLight,
    surface: palette.surfaceLight,
    card: palette.cardLight,
    textPrimary: palette.textPrimaryLight,
    textSecondary: palette.textSecondaryLight,
    textMuted: palette.textMutedLight,
    accentMint: palette.accentMintLight,
    accentApricot: palette.accentApricotLight,
    border: '#E5E5EA'
  };
};

export const useThemeColors = (): ThemeColors => {
  const scheme = useColorScheme();
  return useMemo(() => buildThemeColors((scheme ?? 'light') === 'dark' ? 'dark' : 'light'), [scheme]);
};

