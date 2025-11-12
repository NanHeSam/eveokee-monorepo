import { type ComponentProps, type ReactNode, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, StyleSheet, View, Platform } from 'react-native';
import Video from 'react-native-video';
import TrackPlayer from 'react-native-track-player';

import { useThemeColors } from '../../../theme/useThemeColors';
import { TRACK_PLAYER_OPTIONS } from '../../../providers/TrackPlayerProvider';

/**
 * VideoView Component
 *
 * Full-screen video player with artwork fallback and overlay controls.
 *
 * Features:
 * - Auto-looping muted video playback (cover mode)
 * - Artwork backdrop shown at 25% opacity behind video
 * - Loading spinner while video buffers
 * - Tap-to-toggle overlay via onToggleOverlay
 * - Children rendered above video with pointer-events="box-none" for layering
 *
 * Implicit Behaviors:
 * - Video key changes with URL or theme to force remount on changes
 * - isBuffering tracks video load state (onLoad and onReadyForDisplay)
 * - Video always muted and looping (decorative background video)
 * - Artwork fallback: solid surface color if no artwork provided
 * - pointerEvents="box-none" allows children to receive touches while background is tappable
 * - android_disableSound prevents click sound on Android
 */

interface VideoViewProps {
  /** URL of video to play */
  videoUrl: string;
  /** Optional artwork shown behind video at 25% opacity */
  artwork?: string | null;
  /** Callback to toggle overlay visibility */
  onToggleOverlay?: () => void;
  /** Overlay UI elements (header, controls, etc) */
  children?: ReactNode;
}

export const VideoView = ({
  videoUrl,
  artwork,
  onToggleOverlay,
  children,
}: VideoViewProps) => {
  const colors = useThemeColors();
  const [isBuffering, setIsBuffering] = useState(true);
  // Force video remount when URL or theme changes
  const videoKey = useMemo(() => `${videoUrl}-${colors.scheme}`, [videoUrl, colors.scheme]);
  const disabledAudioTrack = useMemo(() => ({ type: 'disabled' } as const), []);
  const iosVideoProps = useMemo<Partial<ComponentProps<typeof Video>>>(() => {
    if (Platform.OS !== 'ios') {
      return {};
    }
    return {
      enterPictureInPictureOnLeave: false,
      ignoreSilentSwitch: 'obey' as const,
    } as Partial<ComponentProps<typeof Video>>;
  }, []);

  const handleReady = () => {
    setIsBuffering(false);

    void (async () => {
      try {
        await TrackPlayer.updateOptions(TRACK_PLAYER_OPTIONS);
        const playbackState = await TrackPlayer.getPlaybackState();
        console.log('[VideoView] TrackPlayer state after video ready', playbackState);
      } catch (error) {
        console.warn('[VideoView] Failed to refresh TrackPlayer options after video ready', error);
      }
    })();
  };

  useEffect(() => {
    let isMounted = true;

    const logPlaybackState = async () => {
      try {
        const playbackState = await TrackPlayer.getPlaybackState();
        if (!isMounted) {
          return;
        }
        console.log('[VideoView] TrackPlayer state on mount', playbackState);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        console.warn('[VideoView] Failed to read TrackPlayer state on mount', error);
      }
    };

    void logPlaybackState();

    return () => {
      isMounted = false;
    };
  }, []);

  const renderBackground = () => {
    if (!artwork) {
      return (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.surface }]} />
      );
    }

    return (
      <ImageBackground
        source={{ uri: artwork }}
        style={StyleSheet.absoluteFillObject}
        imageStyle={{ opacity: 0.25 }}
        resizeMode="cover"
      />
    );
  };

  const backgroundContent = (
    <View style={StyleSheet.absoluteFill}>
      {renderBackground()}
      <Video
        key={videoKey}
        source={{ uri: videoUrl }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        repeat
        muted
        paused={false}
        onLoad={handleReady}
        onReadyForDisplay={handleReady}
        // Ensure the decorative video never steals the system audio session
        disableFocus
        volume={0}
        controls={false}
        playInBackground={false}
        playWhenInactive={false}
        allowsExternalPlayback={false}
        selectedAudioTrack={disabledAudioTrack as unknown as ComponentProps<typeof Video>['selectedAudioTrack']}
        {...iosVideoProps}
      />
      {isBuffering ? (
        <View style={[StyleSheet.absoluteFillObject, styles.centerContent]}>
          <ActivityIndicator size="large" color={colors.accentMint} />
        </View>
      ) : null}
    </View>
  );

  const background = onToggleOverlay ? (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable
        onPress={onToggleOverlay}
        style={StyleSheet.absoluteFill}
        android_disableSound
      >
        {backgroundContent}
      </Pressable>
    </View>
  ) : (
    <View style={StyleSheet.absoluteFill}>{backgroundContent}</View>
  );

  return (
    <View style={styles.wrapper}>
      {background}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

