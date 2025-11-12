import { useCallback, useMemo, useState } from 'react';
import { PanResponder, Text, View, type GestureResponderEvent } from 'react-native';

import { useThemeColors } from '../../../theme/useThemeColors';

const formatTime = (seconds: number) => {
  const wholeSeconds = Math.floor(Math.max(0, seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remaining = wholeSeconds % 60;
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
};

interface PlaybackProgressBarProps {
  duration: number;
  position: number;
  onSeek: (newPosition: number) => void;
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

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

