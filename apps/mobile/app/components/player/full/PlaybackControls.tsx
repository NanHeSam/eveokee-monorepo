import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '../../../theme/useThemeColors';

/**
 * PlaybackControls Component
 *
 * Standard three-button playback control bar (Previous | Play/Pause | Next).
 *
 * Layout:
 * - Previous button (32px icon, 64px touch area)
 * - Center play/pause button (40px icon, 80px touch area, accentMint background)
 * - Next button (32px icon, 64px touch area)
 *
 * Implicit Behaviors:
 * - event.stopPropagation() prevents taps from triggering overlay toggle
 * - Disabled buttons show textMuted color instead of textPrimary
 * - Play icon has 2px left margin for visual centering in circular button
 * - Skip buttons disabled when at playlist boundaries (first/last track)
 */

interface PlaybackControlsProps {
  /** Whether track is currently playing */
  isPlaying: boolean;
  /** Toggle play/pause */
  onTogglePlayback: () => void;
  /** Skip to next track */
  onSkipNext: () => void;
  /** Skip to previous track */
  onSkipPrevious: () => void;
  /** Disable next button (at end of playlist) */
  disableNext: boolean;
  /** Disable previous button (at start of playlist) */
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

