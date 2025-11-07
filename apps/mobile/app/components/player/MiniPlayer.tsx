import { useCallback } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { Easing, SlideInUp, SlideOutDown } from 'react-native-reanimated';
import TrackPlayer, { State, usePlaybackState } from 'react-native-track-player';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTrackPlayerStore } from '../../store/useTrackPlayerStore';
import { useThemeColors } from '../../theme/useThemeColors';
import { TAB_BAR_BASE_HEIGHT } from '../../utils/layoutConstants';

const formatTime = (seconds: number) => {
  const wholeSeconds = Math.floor(Math.max(0, seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remaining = wholeSeconds % 60;
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
};

export const MiniPlayer = () => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { currentTrack, isVisible, position, duration, setMiniPlayerDimensions } = useTrackPlayerStore();
  const playbackState = usePlaybackState();
  const hidePlayer = useTrackPlayerStore((state) => state.hidePlayer);
  const showFullPlayer = useTrackPlayerStore((state) => state.showFullPlayer);
  
  // Calculate MiniPlayer bottom position dynamically
  // Uses design constant for tab bar height + safe area insets for proper positioning
  const miniPlayerBottom = TAB_BAR_BASE_HEIGHT + insets.bottom;

  const togglePlayback = useCallback(async () => {
    try {
      const state = await TrackPlayer.getPlaybackState();
      if (state.state === State.Playing) {
        await TrackPlayer.pause();
      } else {
        const { position, duration } = useTrackPlayerStore.getState();
        // If track has finished (position at or near the end), seek to beginning before playing
        if (duration > 0 && position >= duration - 0.5) {
          await TrackPlayer.seekTo(0);
        }
        await TrackPlayer.play();
      }
    } catch (error) {
      console.error('Failed to toggle playback', error);
      // If track index is out of bounds, hide the player
      if (error instanceof Error && error.message.includes('out of bounds')) {
        hidePlayer();
      }
    }
  }, [hidePlayer]);

  if (!currentTrack || !isVisible) {
    return null;
  }

  const isPlaying = playbackState.state === State.Playing;

  return (
    <Animated.View
      entering={SlideInUp.duration(220).easing(Easing.out(Easing.quad))}
      exiting={SlideOutDown.duration(220).easing(Easing.in(Easing.quad))}
      onLayout={(event) => {
        const { height } = event.nativeEvent.layout;
        setMiniPlayerDimensions(height, miniPlayerBottom);
      }}
      style={[
        styles.container,
        { 
          backgroundColor: colors.surface, 
          shadowColor: colors.accentMint,
          bottom: miniPlayerBottom,
        }
      ]}
      className="mx-4 rounded-3xl"
    >
      <Pressable className="flex-row items-center p-3" onPress={showFullPlayer}>
        {currentTrack.artwork ? (
          <Image source={{ uri: currentTrack.artwork }} className="h-12 w-12 rounded-2xl" />
        ) : (
          <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: colors.card }}>
            <Ionicons name="musical-notes" size={18} color={colors.textSecondary} />
          </View>
        )}

        <View className="ml-3 flex-1">
          <Text className="text-sm font-semibold" style={{ color: colors.textPrimary }} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          {currentTrack.artist ? (
            <Text className="mt-0.5 text-xs" style={{ color: colors.textSecondary }} numberOfLines={1}>
              {currentTrack.artist}
            </Text>
          ) : null}

          <View className="mt-2 flex-row items-center">
            <Text className="text-[10px]" style={{ color: colors.textMuted }}>
              {formatTime(position)}
            </Text>
            <View className="mx-2 flex-1">
              <View className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: colors.card }}>
                <View
                  className="h-full"
                  style={{
                    width: `${duration > 0 ? Math.min(100, (position / duration) * 100) : 0}%`,
                    backgroundColor: colors.accentMint,
                  }}
                />
              </View>
            </View>
            <Text className="text-[10px]" style={{ color: colors.textMuted }}>
              {formatTime(duration)}
            </Text>
          </View>
        </View>

        <Pressable
          className="ml-2 h-8 w-8 items-center justify-center"
          onPress={(e) => {
            e.stopPropagation();
            togglePlayback();
          }}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color={colors.accentMint} />
        </Pressable>

        <Pressable
          className="ml-2 h-8 w-8 items-center justify-center"
          onPress={async (e) => {
            e.stopPropagation();
            try {
              await TrackPlayer.stop();
            } catch (error) {
              console.error('Failed to stop TrackPlayer:', error);
            } finally {
              hidePlayer();
            }
          }}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 5,
  },
});
