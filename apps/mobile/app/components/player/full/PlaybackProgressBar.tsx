import { useCallback, useMemo, useState } from 'react';
import { PanResponder, Text, View, type GestureResponderEvent } from 'react-native';

import { useThemeColors } from '../../../theme/useThemeColors';

/**
 * PlaybackProgressBar Component
 *
 * Interactive progress bar with time labels and drag/tap-to-seek functionality.
 *
 * Features:
 * - Visual progress indicator (accentMint fill over card background)
 * - Current position and total duration labels (MM:SS format)
 * - Drag/tap anywhere on bar to seek to that position
 *
 * Implicit Behaviors:
 * - Tracks bar width via onLayout to calculate seek percentage accurately
 * - Clamps touch position to bar boundaries (prevents seeking beyond 0-100%)
 * - Prevents seeking when duration=0 (track not loaded) or progressWidth=0 (not measured)
 * - event.stopPropagation() prevents tap-through to overlay toggle
 * - PanResponder handles both tap (onPanResponderGrant) and drag (onPanResponderMove)
 * - Negative times clamped to 0 in formatTime for safety
 */

/** Formats seconds to MM:SS format */
const formatTime = (seconds: number) => {
  const wholeSeconds = Math.floor(Math.max(0, seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remaining = wholeSeconds % 60;
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
};

/** Clamps a value between min and max */
const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

interface PlaybackProgressBarProps {
  /** Track duration in seconds */
  duration: number;
  /** Current playback position in seconds */
  position: number;
  /** Callback when user seeks to new position */
  onSeek: (newPosition: number) => void;
}

export const PlaybackProgressBar = ({ duration, position, onSeek }: PlaybackProgressBarProps) => {
  const colors = useThemeColors();
  const [progressWidth, setProgressWidth] = useState(0);

  const handleSeekFromGesture = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation?.();
    if (duration <= 0 || progressWidth <= 0) return;
    const touchX = clamp(event.nativeEvent.locationX, 0, progressWidth);
    const percentage = touchX / progressWidth;
    onSeek(percentage * duration);
  }, [duration, progressWidth, onSeek]);

  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => handleSeekFromGesture(event),
      onPanResponderMove: (event) => handleSeekFromGesture(event),
    });
  }, [handleSeekFromGesture]);

  const progressPercentage = duration > 0 ? clamp((position / duration) * 100, 0, 100) : 0;

  return (
    <View className="px-8 py-3">
      <View
        {...panResponder.panHandlers}
        onLayout={(event) => setProgressWidth(event.nativeEvent.layout.width)}
        className="mb-2 w-full justify-center"
      >
        <View className="h-3 justify-center">
          <View className="h-1 overflow-hidden rounded-full" style={{ backgroundColor: colors.card }}>
            <View
              className="h-full rounded-full"
              style={{
                width: `${progressPercentage}%`,
                backgroundColor: colors.accentMint,
              }}
            />
          </View>
        </View>
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs" style={{ color: colors.textMuted }}>
          {formatTime(position)}
        </Text>
        <Text className="text-xs" style={{ color: colors.textMuted }}>
          {formatTime(duration)}
        </Text>
      </View>
    </View>
  );
};

