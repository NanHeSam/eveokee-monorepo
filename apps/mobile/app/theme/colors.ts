export const palette = {
  backgroundLight: '#FDFBF7',
  surfaceLight: '#FFFFFF',
  cardLight: 'rgba(255,255,255,0.7)',
  accentMintLight: '#52C7A0',
  accentApricotLight: '#FFB5A7',
  textPrimaryLight: '#2D3436',
  textSecondaryLight: '#636E72',
  textMutedLight: '#B2BEC3',
  backgroundDark: '#1A1A2E',
  surfaceDark: '#16213E',
  cardDark: '#0F3460',
  accentApricotDark: '#CD6155',
  accentMintDark: '#52C7A0',
  textPrimaryDark: '#F5F5F5',
  textSecondaryDark: '#B8B8B8',
  textMutedDark: 'rgba(245, 245, 245, 0.55)'
} as const;

export type Palette = typeof palette;

