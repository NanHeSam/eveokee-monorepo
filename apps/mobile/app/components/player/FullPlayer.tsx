import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
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
import { VideoPlayerView } from './full/VideoPlayerView';
import { LyricsPlayerView } from './full/LyricsPlayerView';
import { Id } from '@backend/convex/convex/_generated/dataModel';
import { TRACK_PLAYER_OPTIONS } from '../../providers/TrackPlayerProvider';

/**
 * FullPlayer Component
 *
 * A full-screen music player with dual-view support for lyrics and video playback.
 * This component serves as the orchestrator for the complete playback experience,
 * managing state, gestures, and routing to the appropriate view based on content availability.
 *
 * Component Hierarchy:
 * ```
 * <FullPlayer>                                    // orchestrator
 *   <Animated.View>                               // drag-to-dismiss gesture, slide animations
 *     <StatusBar />                               // theme-aware
 *
 *     {hasVideo && activeView === 'video' ? (
 *       <VideoPlayerView>
 *         <VideoView>                             // video playback + artwork backdrop
 *           <Video />                             // react-native-video, looping muted
 *
 *           {isOverlayVisible && (
 *             <>
 *               <FullPlayerHeader />              // minimize, share
 *               <FullPlayerViewTabs />            // lyrics/video tabs
 *               <FullPlayerMetadata />            // title, artist
 *               {videoAction}                     // generate/regenerate CTA
 *               <PlaybackControls />              // prev, play/pause, next
 *               <PlaybackProgressBar />           // seekable
 *             </>
 *           )}
 *
 *           {!isOverlayVisible && (
 *             <PlaybackProgressBar />             // minimal progress bar
 *           )}
 *         </VideoView>
 *       </VideoPlayerView>
 *     ) : (
 *       <LyricsPlayerView>
 *         <ImageBackground />                     // artwork backdrop with opacity
 *
 *         {isOverlayVisible ? (
 *           <>                                    // Overlay Mode - immersive lyrics
 *             <FullPlayerHeader />
 *             <FullPlayerViewTabs />
 *             <LyricView showArtwork={false} />   // full-screen scrollable lyrics
 *             <PlaybackProgressBar />
 *           </>
 *         ) : (
 *           <>                                    // Detail Mode - standard layout
 *             <FullPlayerHeader />
 *             <FullPlayerViewTabs />
 *             <FullPlayerMetadata />
 *             <LyricView showArtwork={true} />    // artwork + generate CTA
 *             <PlaybackControls />
 *             <PlaybackProgressBar />
 *           </>
 *         )}
 *       </LyricsPlayerView>
 *     )}
 *   </Animated.View>
 * </FullPlayer>
 * ```
 *
 * Architecture:
 * - Delegates rendering to VideoPlayerView or LyricsPlayerView based on activeView and video availability
 * - Implements drag-to-dismiss gesture from the top header area
 * - Manages video generation flow with credit gating
 * - Handles all playback controls (play/pause/skip/seek)
 * - Provides share functionality for tracks
 *
 * View Logic:
 * - Shows VideoPlayerView when activeView='video' AND primaryVideo exists
 * - Shows LyricsPlayerView when activeView='lyrics' OR no video available
 * - Automatically switches to lyrics view if no video exists (lines 115-120)
 *
 * Gesture Handling:
 * - Drag from top area (HEADER_TOUCH_AREA_HEIGHT=96px) to dismiss
 * - Requires vertical-dominant gesture (dy > dx)
 * - Dismisses if dragged past DISMISS_THRESHOLD_PX (140px) or velocity exceeds threshold
 * - Smooth spring-back animation if gesture cancelled
 * - Only active when overlay is NOT visible (prevents conflict with UI interactions)
 *
 * Note: We evaluated community lyric overlay libraries (react-native-lyric, react-native-lrc)
 * but they are unmaintained and incompatible with Expo, so we provide a custom implementation.
 *
 * @example
 * // FullPlayer is rendered conditionally based on isFullPlayerVisible in the store
 * {isFullPlayerVisible && <FullPlayer />}
 */

type PlayerView = 'lyrics' | 'video';

// Gesture constants for drag-to-dismiss
const HEADER_TOUCH_AREA_HEIGHT = 96;
const DISMISS_THRESHOLD_PX = 140;
const DISMISS_VELOCITY_THRESHOLD = 1.2;
const DISMISS_ANIMATION_DURATION = 220;

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
    if (activeView !== 'video') {
      return;
    }

    const reapplyTrackPlayerOptions = async () => {
      try {
        await TrackPlayer.updateOptions(TRACK_PLAYER_OPTIONS);
      } catch (error) {
        console.warn('[FullPlayer] Failed to update TrackPlayer options while on video view', error);
      }
    };

    void reapplyTrackPlayerOptions();
  }, [activeView, currentTrack?.id, primaryVideo?._id]);

  const handleViewChange = useCallback(
    (view: PlayerView) => {
      setActiveView(view);
    },
    [],
  );

  // Auto-switch to lyrics view when no video is available
  useEffect(() => {
    if (!hasVideo) {
      setActiveView('lyrics');
      setIsOverlayVisible(false);
    }
  }, [hasVideo]);

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

  const handleSeek = useCallback(async (newPosition: number) => {
    try {
      await TrackPlayer.seekTo(newPosition);
    } catch (error) {
      console.error('Failed to seek', error);
    }
  }, []);

  const handleToggleOverlay = useCallback(() => {
    if (activeView === 'video' && !hasVideo) {
      return;
    }
    setIsOverlayVisible((prev) => !prev);
  }, [activeView, hasVideo]);

  const handleGenerateVideo = useCallback(() => {
    if (!canGenerate) {
      Alert.alert(
        'Insufficient Credits',
        `Video generation requires 3 credits. You have ${remainingCredits} remaining.`,
        [{ text: 'OK' }]
      );
      return;
    }
    void generateVideo();
  }, [canGenerate, remainingCredits, generateVideo]);

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
            void shareMusic(currentTrack.id as Id<'music'>, currentTrack.title, currentTrack.addedViaShareId);
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

  // Video generation UI - shown in VideoPlayerView overlay
  // Only show for owned music (not shared)
  const isOwned = currentTrack?.ownershipType !== 'shared';
  const videoAction = useMemo(() => {
    // Hide video generation button for shared music
    if (!isOwned) {
      return null;
    }

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
          handleGenerateVideo();
        }}
        className="flex-row items-center justify-center rounded-full px-6 py-3"
        style={{ backgroundColor: colors.accentMint }}
      >
        <Text className="text-base font-semibold" style={{ color: colors.background }}>
          {primaryVideo ? 'Regenerate Video (3 credits)' : 'Generate Video (3 credits)'}
        </Text>
      </Pressable>
    );
  }, [isOwned, isGenerating, colors.surface, colors.textSecondary, pendingElapsedSeconds, colors.accentMint, colors.background, primaryVideo, handleGenerateVideo]);

  useEffect(() => {
    translateY.value = 0;
  }, [isFullPlayerVisible, translateY]);

  // Drag-to-dismiss gesture handler - only active from top header area
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_: GestureResponderEvent, gesture: PanResponderGestureState) => {
          if (isOverlayVisible || gesture.dy <= 0) {
            return false;
          }
          const startedNearTop = gesture.y0 <= headerTopInset + HEADER_TOUCH_AREA_HEIGHT;
          const verticalDominant = Math.abs(gesture.dy) > Math.abs(gesture.dx);
          return verticalDominant && startedNearTop;
        },
        onPanResponderMove: (_: GestureResponderEvent, gesture: PanResponderGestureState) => {
          if (gesture.dy > 0) {
            translateY.value = gesture.dy;
          }
        },
        onPanResponderRelease: (_: GestureResponderEvent, gesture: PanResponderGestureState) => {
          const shouldDismiss = gesture.dy > DISMISS_THRESHOLD_PX || gesture.vy > DISMISS_VELOCITY_THRESHOLD;
          if (shouldDismiss) {
            translateY.value = withTiming(screenHeight, { duration: DISMISS_ANIMATION_DURATION }, (finished) => {
              if (finished) {
                runOnJS(hideFullPlayer)();
              }
            });
          } else {
            translateY.value = withTiming(0, { duration: DISMISS_ANIMATION_DURATION });
          }
        },
        onPanResponderTerminate: () => {
          translateY.value = withTiming(0, { duration: DISMISS_ANIMATION_DURATION });
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

  // View routing: VideoPlayerView when video available AND active, otherwise LyricsPlayerView
  return (
    <Animated.View
      {...panResponder.panHandlers}
      entering={SlideInDown.duration(240).easing(Easing.out(Easing.cubic))}
      exiting={SlideOutDown.duration(240).easing(Easing.in(Easing.cubic))}
      style={[styles.container, { backgroundColor: colors.background }, animatedStyle]}
    >
      <StatusBar style={colors.scheme === 'dark' ? 'light' : 'dark'} translucent />
      {activeView === 'video' && primaryVideo?.videoUrl ? (
        <VideoPlayerView
          videoUrl={primaryVideo.videoUrl}
          artwork={currentTrack.artwork}
          title={currentTrack.title}
          artist={currentTrack.artist}
          duration={duration}
          position={position}
          isPlaying={isPlaying}
          disableNext={disableNext}
          disablePrevious={disablePrevious}
          headerTopInset={headerTopInset}
          hasVideo={hasVideo}
          onToggleOverlay={handleToggleOverlay}
          onSeek={handleSeek}
          onTogglePlayback={togglePlayback}
          onSkipNext={skipToNext}
          onSkipPrevious={skipToPrevious}
          onClose={hideFullPlayer}
          onShare={handleShare}
          onViewChange={handleViewChange}
          videoAction={videoAction}
          isOverlayVisible={isOverlayVisible}
        />
      ) : (
        <LyricsPlayerView
          artwork={currentTrack.artwork}
          title={currentTrack.title}
          artist={currentTrack.artist}
          lyrics={currentTrack.lyrics}
          lyricWithTime={currentTrack.lyricWithTime}
          duration={duration}
          position={position}
          isPlaying={isPlaying}
          disableNext={disableNext}
          disablePrevious={disablePrevious}
          headerTopInset={headerTopInset}
          hasVideo={hasVideo}
          isOverlayVisible={isOverlayVisible}
          activeView={activeView}
          canGenerate={canGenerate}
          remainingCredits={remainingCredits}
          isGenerating={isGenerating}
          pendingElapsedSeconds={pendingElapsedSeconds}
          onToggleOverlay={handleToggleOverlay}
          onSeek={handleSeek}
          onTogglePlayback={togglePlayback}
          onSkipNext={skipToNext}
          onSkipPrevious={skipToPrevious}
          onClose={hideFullPlayer}
          onShare={handleShare}
          onGenerateVideo={isOwned ? handleGenerateVideo : undefined}
          onViewChange={handleViewChange}
        />
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
});
