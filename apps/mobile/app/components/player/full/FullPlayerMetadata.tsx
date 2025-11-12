import { View, Text } from 'react-native';

import { useThemeColors } from '../../../theme/useThemeColors';

/**
 * FullPlayerMetadata Component
 *
 * Displays track title and optional artist name with centered, styled text.
 *
 * Layout:
 * - Title: Large, bold text (text-2xl font-bold)
 * - Artist: Smaller, secondary text below title (conditional)
 *
 * Implicit Behaviors:
 * - Artist only shown if provided (not null/undefined)
 * - Centered text alignment for both title and artist
 * - Uses theme colors for dynamic light/dark mode support
 */

interface FullPlayerMetadataProps {
  title: string;
  artist?: string | null;
}

export const FullPlayerMetadata = ({ title, artist }: FullPlayerMetadataProps) => {
  const colors = useThemeColors();

  return (
    <View className="px-8 py-3">
      <Text className="text-center text-2xl font-bold" style={{ color: colors.textPrimary }}>
        {title}
      </Text>
      {artist ? (
        <Text className="mt-2 text-center text-base" style={{ color: colors.textSecondary }}>
          {artist}
        </Text>
      ) : null}
    </View>
  );
};

