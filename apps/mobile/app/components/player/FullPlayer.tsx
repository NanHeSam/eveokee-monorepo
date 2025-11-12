import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  ImageBackground,
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  SlideInDown,
  SlideOutDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import TrackPlayer, { State, usePlaybackState } from 'react-native-track-player';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useTrackPlayerStore } from '../../store/useTrackPlayerStore';
import { useThemeColors } from '../../theme/useThemeColors';
import { useShareMusic } from '../../hooks/useShareMusic';
import { useVideoGeneration } from '../../hooks/useVideoGeneration';
import { FullPlayerHeader } from './full/FullPlayerHeader';
import { FullPlayerMetadata } from './full/FullPlayerMetadata';
import { FullPlayerViewTabs } from './full/FullPlayerViewTabs';
import { PlaybackProgressBar } from './full/PlaybackProgressBar';
import { PlaybackControls } from './full/PlaybackControls';
import { LyricView } from './full/LyricView';
import { VideoView } from './full/VideoView';
import { Id } from '@backend/convex/convex/_generated/dataModel';

// Note: We evaluated community lyric overlays such as `react-native-lyric` and `react-native-lrc`,
// but they are unmaintained and not compatible with Expo, so we provide our own themed implementation.

type PlayerView = 'lyrics' | 'video';

export const FullPlayer = () => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { currentTrack, isFullPlayerVisible, position, duration, playlist, currentTrackIndex } = useTrackPlayerStore();
  const playbackState = usePlaybackState();
  const hideFullPlayer = useTrackPlayerStore((state) => state.hideFullPlayer);
  const setCurrentTrack = useTrackPlayerStore((state) => state.setCurrentTrack);
  const [activeView, setActiveView] = useState<PlayerView>('video');
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const { shareMusic } = useShareMusic();
  const { height: screenHeight } = useWindowDimensions();
  const translateY = useSharedValue(0);

  const musicId = currentTrack?.id as Id<'music'> | null;
  const {
    isGenerating,
    primaryVideo,
    generateVideo,
    canGenerate,
    remainingCredits,
    pendingElapsedSeconds,
  } = useVideoGeneration(musicId);

  const hasVideo = Boolean(primaryVideo?.videoUrl);
  const headerTopInset = insets.top + 16;

  useEffect(() => {
    if (!hasVideo && activeView === 'video') {
      setActiveView('lyrics');
    }
    if (!hasVideo) {
      setIsOverlayVisible(true);
    }
  }, [hasVideo, activeView]);

  useEffect(() => {
    if (activeView === 'lyrics') {
      setIsOverlayVisible(true);
    }
  }, [activeView]);

  const overlayColor = useMemo(
    () => (colors.scheme === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.72)'),
    [colors.scheme]
  );

  const togglePlayback = useCallback(async () => {
    try {
      const state = await TrackPlayer.getPlaybackState();
      if (state.state === State.Playing) {
        await TrackPlayer.pause();
      } else {
        if (duration > 0 && position >= duration - 0.5) {
          await TrackPlayer.seekTo(0);
        }
        await TrackPlayer.play();
      }
    } catch (error) {
      console.error('Failed to toggle playback', error);
      if (error instanceof Error && error.message.includes('out of bounds')) {
        hideFullPlayer();
      }
    }
  }, [hideFullPlayer, position, duration]);

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

  const handleSeek = useCallback((newPosition: number) => {
    void TrackPlayer.seekTo(newPosition);
  }, []);

  const handleToggleOverlay = useCallback(() => {
    if (activeView === 'video' && !hasVideo) {
      return;
    }
    setIsOverlayVisible((prev) => !prev);
  }, [activeView, hasVideo]);

  const handleShare = useCallback(() => {
    if (!currentTrack) return;

    Alert.alert(
      'Share Music',
      'Choose how to share this music',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share Link',
          onPress: () => {
            void shareMusic(currentTrack.id as Id<'music'>, currentTrack.title);
          },
        },
        {
          text: 'Share Artwork Card',
          onPress: () => {
            Alert.alert('Coming Soon', 'Artwork card sharing will be available soon!');
          },
        },
      ]
    );
  }, [currentTrack, shareMusic]);

  const videoAction = useMemo(() => {
    if (isGenerating) {
      return (
        <View
          className="flex-row items-center justify-center rounded-full px-6 py-3"
          style={{ backgroundColor: colors.surface }}
        >
          <ActivityIndicator size="small" color={colors.accentMint} />
          <Text className="ml-2 text-sm font-medium" style={{ color: colors.textSecondary }}>
            Generating video
            {pendingElapsedSeconds !== null ? ` • ${pendingElapsedSeconds}s elapsed` : '...'}
          </Text>
        </View>
      );
    }

    return (
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          if (!canGenerate) {
            Alert.alert(
              'Insufficient Credits',
              `Video generation requires 3 credits. You have ${remainingCredits} remaining.`,
              [{ text: 'OK' }]
            );
            return;
          }
          void generateVideo();
        }}
        className="flex-row items-center justify-center rounded-full px-6 py-3"
        style={{ backgroundColor: colors.accentMint }}
      >
        <Text className="text-base font-semibold" style={{ color: colors.background }}>
          {primaryVideo ? 'Regenerate Video (3 credits)' : 'Generate Video (3 credits)'}
        </Text>
      </Pressable>
    );
  }, [isGenerating, colors.surface, colors.textSecondary, pendingElapsedSeconds, colors.accentMint, canGenerate, remainingCredits, generateVideo, colors.background, primaryVideo]);

  useEffect(() => {
    translateY.value = 0;
  }, [isFullPlayerVisible, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_: GestureResponderEvent, gesture: PanResponderGestureState) => {
          if (isOverlayVisible || gesture.dy <= 0) {
            return false;
          }
          const startedNearTop = gesture.y0 <= headerTopInset + 96;
          const verticalDominant = Math.abs(gesture.dy) > Math.abs(gesture.dx);
          return verticalDominant && startedNearTop;
        },
        onPanResponderMove: (_: GestureResponderEvent, gesture: PanResponderGestureState) => {
          if (gesture.dy > 0) {
            translateY.value = gesture.dy;
          }
        },
        onPanResponderRelease: (_: GestureResponderEvent, gesture: PanResponderGestureState) => {
          const shouldDismiss = gesture.dy > 140 || gesture.vy > 1.2;
          if (shouldDismiss) {
            translateY.value = withTiming(screenHeight, { duration: 220 }, (finished) => {
              if (finished) {
                runOnJS(hideFullPlayer)();
              }
            });
          } else {
            translateY.value = withTiming(0, { duration: 220 });
          }
        },
        onPanResponderTerminate: () => {
          translateY.value = withTiming(0, { duration: 220 });
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [headerTopInset, hideFullPlayer, isOverlayVisible, screenHeight, translateY]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!currentTrack || !isFullPlayerVisible) {
    return null;
  }

  const isPlaying = playbackState.state === State.Playing;
  const disablePrevious = currentTrackIndex <= 0;
  const disableNext = currentTrackIndex >= playlist.length - 1;

  const renderProgressBar = () => (
    <PlaybackProgressBar duration={duration} position={position} onSeek={handleSeek} />
  );

  const renderControls = () => (
    <PlaybackControls
      isPlaying={isPlaying}
      onTogglePlayback={togglePlayback}
      onSkipNext={skipToNext}
      onSkipPrevious={skipToPrevious}
      disableNext={disableNext}
      disablePrevious={disablePrevious}
    />
  );

  const renderHeaderAndTabs = () => (
    <>
      <FullPlayerHeader onClose={hideFullPlayer} onShare={handleShare} topInset={headerTopInset} />
      <FullPlayerViewTabs
        activeTab={activeView}
        onChange={setActiveView}
        showVideoTab={hasVideo}
        topInset={8}
      />
    </>
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      entering={SlideInDown.duration(240).easing(Easing.out(Easing.cubic))}
      exiting={SlideOutDown.duration(240).easing(Easing.in(Easing.cubic))}
      style={[styles.container, { backgroundColor: colors.background }, animatedStyle]}
    >
      <StatusBar style={colors.scheme === 'dark' ? 'light' : 'dark'} translucent />
      {activeView === 'video' && primaryVideo?.videoUrl ? (
        <VideoView
          videoUrl={primaryVideo.videoUrl}
          artwork={currentTrack.artwork}
          onToggleOverlay={handleToggleOverlay}
        >
          {isOverlayVisible ? (
            <>
              <View
                style={[StyleSheet.absoluteFillObject, { backgroundColor: overlayColor }]}
                pointerEvents="none"
              />
              <View
                style={[
                  styles.videoOverlayContainer,
                  { paddingBottom: insets.bottom + 32 },
                ]}
                pointerEvents="box-none"
              >
                <View style={styles.videoOverlayTop} pointerEvents="auto">
                  {renderHeaderAndTabs()}
                  <View style={styles.videoMetadataWrapper}>
                    <FullPlayerMetadata title={currentTrack.title} artist={currentTrack.artist} />
                  </View>
                  <View style={styles.videoActionWrapper}>{videoAction}</View>
                </View>
                <View style={styles.videoOverlayBottom} pointerEvents="auto">
                  {renderControls()}
                  {renderProgressBar()}
                </View>
              </View>
            </>
          ) : (
            <View
              style={[
                styles.minimalProgressContainer,
                { paddingBottom: insets.bottom + 32 },
              ]}
              pointerEvents="box-none"
            >
              {renderProgressBar()}
            </View>
          )}
        </VideoView>
      ) : (
        <View style={styles.lyricBackdrop}>
          <View style={StyleSheet.absoluteFill}>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                handleToggleOverlay();
              }}
              style={StyleSheet.absoluteFill}
              android_disableSound
            >
              {currentTrack.artwork ? (
                <ImageBackground
                  source={{ uri: currentTrack.artwork }}
                  style={StyleSheet.absoluteFill}
                  imageStyle={{ opacity: isOverlayVisible ? 0.45 : 0.28 }}
                  resizeMode="cover"
                />
              ) : (
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.surface }]} />
              )}
            </Pressable>
          </View>
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {isOverlayVisible ? (
              <View style={styles.lyricOverlayContainer} pointerEvents="box-none">
                <View
                  style={[StyleSheet.absoluteFillObject, { backgroundColor: overlayColor }]}
                  pointerEvents="none"
                />
                <View
                  style={[
                    styles.lyricOverlayContent,
                    { paddingBottom: insets.bottom + 56, paddingHorizontal: 24 },
                  ]}
                  pointerEvents="auto"
                >
                  {renderHeaderAndTabs()}
                  <View style={styles.lyricOverlayLyrics}>
                    <LyricView
                      artwork={currentTrack.artwork}
                      lyrics={currentTrack.lyrics}
                      onPressArtwork={handleToggleOverlay}
                      showArtwork={false}
                    />
                  </View>
                </View>
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();
                    handleToggleOverlay();
                  }}
                  style={[
                    styles.lyricOverlayProgress,
                    { paddingBottom: insets.bottom + 24, paddingHorizontal: 24 },
                  ]}
                  pointerEvents="auto"
                >
                  {renderProgressBar()}
                </Pressable>
              </View>
            ) : (
              <View
                style={[
                  styles.lyricDetailContainer,
                  { paddingBottom: insets.bottom + 32 },
                ]}
                pointerEvents="auto"
              >
                {renderHeaderAndTabs()}
                <FullPlayerMetadata title={currentTrack.title} artist={currentTrack.artist} />
                <View style={styles.detailLyricWrapper}>
                  <LyricView
                    artwork={currentTrack.artwork}
                    lyrics={currentTrack.lyrics}
                    onPressArtwork={handleToggleOverlay}
                    hasVideo={hasVideo}
                    onGenerateVideo={() => {
                      if (!canGenerate) {
                        Alert.alert(
                          'Insufficient Credits',
                          `Video generation requires 3 credits. You have ${remainingCredits} remaining.`,
                          [{ text: 'OK' }]
                        );
                        return;
                      }
                      void generateVideo();
                    }}
                    isGenerating={isGenerating}
                    canGenerate={canGenerate}
                    remainingCredits={remainingCredits}
                  />
                </View>
                {renderControls()}
                {renderProgressBar()}
              </View>
            )}
          </View>
        </View>
      )}
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
  videoOverlayContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  videoOverlayTop: {
    gap: 12,
  },
  videoOverlayBottom: {
    gap: 12,
  },
  videoActionWrapper: {
    marginTop: 12,
  },
  videoMetadataWrapper: {
    marginTop: 8,
  },
  lyricBackdrop: {
    flex: 1,
  },
  lyricOverlayContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  lyricOverlayContent: {
    flex: 1,
    justifyContent: 'flex-start',
    gap: 16,
  },
  lyricOverlayLyrics: {
    flex: 1,
  },
  lyricOverlayProgress: {
    justifyContent: 'flex-end',
  },
  lyricDetailContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    gap: 16,
  },
  detailLyricWrapper: {
    flex: 1,
  },
  minimalProgressContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
  },
});
