import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '../../../theme/useThemeColors';

interface PlaybackControlsProps {
  isPlaying: boolean;
  onTogglePlayback: () => void;
  onSkipNext: () => void;
  onSkipPrevious: () => void;
  disableNext: boolean;
  disablePrevious: boolean;
}

export const PlaybackControls = ({
  isPlaying,
  onTogglePlayback,
  onSkipNext,
  onSkipPrevious,
  disableNext,
  disablePrevious,
}: PlaybackControlsProps) => {
  const colors = useThemeColors();

  return (
    <View className="flex-row items-center justify-center gap-8 px-8 py-4">
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          onSkipPrevious();
        }}
        className="h-16 w-16 items-center justify-center"
        disabled={disablePrevious}
      >
        <Ionicons
          name="play-skip-back"
          size={32}
          color={disablePrevious ? colors.textMuted : colors.textPrimary}
        />
      </Pressable>

      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          onTogglePlayback();
        }}
        className="h-20 w-20 items-center justify-center rounded-full"
        style={{ backgroundColor: colors.accentMint }}
      >
        <View style={{ marginLeft: isPlaying ? 0 : 2 }}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={40} color={colors.background} />
        </View>
      </Pressable>

      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          onSkipNext();
        }}
        className="h-16 w-16 items-center justify-center"
        disabled={disableNext}
      >
        <Ionicons
          name="play-skip-forward"
          size={32}
          color={disableNext ? colors.textMuted : colors.textPrimary}
        />
      </Pressable>
    </View>
  );
};

