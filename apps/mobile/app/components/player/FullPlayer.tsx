import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { Easing, FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import TrackPlayer, { State, usePlaybackState } from 'react-native-track-player';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTrackPlayerStore } from '../../store/useTrackPlayerStore';
import { useThemeColors } from '../../theme/useThemeColors';
import { useShareMusic } from '../../hooks/useShareMusic';
import { Id } from '@diary-vibes/backend/convex/_generated/dataModel';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const formatTime = (seconds: number) => {
  const wholeSeconds = Math.floor(Math.max(0, seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const remaining = wholeSeconds % 60;
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
};

export const FullPlayer = () => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { currentTrack, isFullPlayerVisible, position, duration, playlist, currentTrackIndex } = useTrackPlayerStore();
  const playbackState = usePlaybackState();
  const hideFullPlayer = useTrackPlayerStore((state) => state.hideFullPlayer);
  const setCurrentTrack = useTrackPlayerStore((state) => state.setCurrentTrack);
  const [progressBarWidth, setProgressBarWidth] = useState(0);
  const { shareMusic } = useShareMusic();

  const togglePlayback = useCallback(async () => {
    try {
      const state = await TrackPlayer.getPlaybackState();
      if (state.state === State.Playing) {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
    } catch (error) {
      console.error('Failed to toggle playback', error);
      // If track index is out of bounds, hide the player
      if (error instanceof Error && error.message.includes('out of bounds')) {
        hideFullPlayer();
      }
    }
  }, [hideFullPlayer]);

  const skipToPrevious = useCallback(async () => {
    try {
      await TrackPlayer.skipToPrevious();
      const currentIndex = await TrackPlayer.getActiveTrackIndex();
      if (currentIndex !== null && currentIndex !== undefined && playlist[currentIndex]) {
        setCurrentTrack(playlist[currentIndex]);
      }
    } catch (error) {
      console.error('Failed to skip to previous track', error);
    }
  }, [playlist, setCurrentTrack]);

  const skipToNext = useCallback(async () => {
    try {
      await TrackPlayer.skipToNext();
      const currentIndex = await TrackPlayer.getActiveTrackIndex();
      if (currentIndex !== null && currentIndex !== undefined && playlist[currentIndex]) {
        setCurrentTrack(playlist[currentIndex]);
      }
    } catch (error) {
      console.error('Failed to skip to next track', error);
    }
  }, [playlist, setCurrentTrack]);

  const handleProgressBarPress = useCallback((event: any) => {
    if (progressBarWidth > 0 && duration > 0) {
      const touchX = event.nativeEvent.locationX;
      const percentage = Math.max(0, Math.min(1, touchX / progressBarWidth));
      const newPosition = percentage * duration;
      TrackPlayer.seekTo(newPosition);
    }
  }, [duration, progressBarWidth]);

  if (!currentTrack || !isFullPlayerVisible) {
    return null;
  }

  const isPlaying = playbackState.state === State.Playing;
  const progressPercentage = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <Animated.View
      entering={SlideInDown.duration(240).easing(Easing.out(Easing.cubic))}
      exiting={SlideOutDown.duration(240).easing(Easing.in(Easing.cubic))}
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top }
      ]}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <Pressable onPress={hideFullPlayer} className="h-10 w-10 items-center justify-center">
          <Ionicons name="chevron-down" size={28} color={colors.textPrimary} />
        </Pressable>
        <Text className="text-sm font-medium" style={{ color: colors.textSecondary }}>
          Now Playing
        </Text>
        <Pressable 
          onPress={() => {
            if (!currentTrack) return;
            Alert.alert(
              'Share Music',
              'Choose how to share this music',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Share Link', onPress: () => shareMusic(currentTrack.id as Id<"music">, currentTrack.title) },
                { text: 'Share Artwork Card', onPress: () => {
                  Alert.alert('Coming Soon', 'Artwork card sharing will be available soon!');
                }},
              ]
            );
          }}
          className="h-10 w-10 items-center justify-center"
        >
          <Ionicons name="share-social-outline" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>

      {/* Artwork */}
      <View className="items-center px-8 py-4">
        {currentTrack.artwork ? (
          <Animated.Image
            entering={FadeIn}
            source={{ uri: currentTrack.artwork }}
            className="rounded-3xl"
            style={{
              width: SCREEN_HEIGHT * 0.32,
              height: SCREEN_HEIGHT * 0.32,
              shadowColor: colors.accentMint,
              shadowOpacity: 0.3,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
            }}
          />
        ) : (
          <View
            className="items-center justify-center rounded-3xl"
            style={{
              width: SCREEN_HEIGHT * 0.32,
              height: SCREEN_HEIGHT * 0.32,
              backgroundColor: colors.surface,
            }}
          >
            <Ionicons name="musical-notes" size={80} color={colors.textSecondary} />
          </View>
        )}
      </View>

      {/* Song Info */}
      <View className="px-8 py-3">
        <Text className="text-center text-2xl font-bold" style={{ color: colors.textPrimary }}>
          {currentTrack.title}
        </Text>
        {currentTrack.artist ? (
          <Text className="mt-2 text-center text-base" style={{ color: colors.textSecondary }}>
            {currentTrack.artist}
          </Text>
        ) : null}
      </View>

      {/* Progress Bar */}
      <View className="px-8 py-3">
        <Pressable
          onPress={handleProgressBarPress}
          onLayout={(event) => {
            setProgressBarWidth(event.nativeEvent.layout.width);
          }}
        >
          <View className="mb-2 h-3 justify-center">
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
        </Pressable>
        <View className="flex-row items-center justify-between">
          <Text className="text-xs" style={{ color: colors.textMuted }}>
            {formatTime(position)}
          </Text>
          <Text className="text-xs" style={{ color: colors.textMuted }}>
            {formatTime(duration)}
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View className="flex-row items-center justify-center gap-8 px-8 py-4">
        <Pressable
          onPress={skipToPrevious}
          className="h-16 w-16 items-center justify-center"
          disabled={currentTrackIndex <= 0}
        >
          <Ionicons
            name="play-skip-back"
            size={32}
            color={currentTrackIndex <= 0 ? colors.textMuted : colors.textPrimary}
          />
        </Pressable>

        <Pressable
          onPress={togglePlayback}
          className="h-20 w-20 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.accentMint }}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={40} color={colors.background} />
        </Pressable>

        <Pressable
          onPress={skipToNext}
          className="h-16 w-16 items-center justify-center"
          disabled={currentTrackIndex >= playlist.length - 1}
        >
          <Ionicons
            name="play-skip-forward"
            size={32}
            color={currentTrackIndex >= playlist.length - 1 ? colors.textMuted : colors.textPrimary}
          />
        </Pressable>
      </View>

      {/* Lyrics Section */}
      <View className="flex-1 px-8 pb-6">
        <Text className="mb-3 text-lg font-semibold" style={{ color: colors.textPrimary }}>
          Lyrics
        </Text>
        <ScrollView
          className="flex-1 rounded-2xl p-4"
          style={{ backgroundColor: colors.surface }}
          showsVerticalScrollIndicator={false}
        >
          {currentTrack.lyrics ? (
            <Text className="text-base leading-7" style={{ color: colors.textSecondary }}>
              {currentTrack.lyrics}
            </Text>
          ) : (
            <Text className="text-base text-center" style={{ color: colors.textMuted }}>
              No lyrics available
            </Text>
          )}
        </ScrollView>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
});
