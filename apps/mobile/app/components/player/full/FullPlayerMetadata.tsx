import { View, Text } from 'react-native';

import { useThemeColors } from '../../../theme/useThemeColors';

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

