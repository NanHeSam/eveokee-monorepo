/**
 * VideoPlayerModal Component
 * Fullscreen video playback modal for music videos
 *
 * Features:
 * - Fullscreen video playback with controls
 * - Looping support
 * - Share functionality
 * - Close button
 *
 * Requires react-native-video native module. Install with:
 * pnpm --filter mobile add react-native-video
 */

import { useState, useRef, useCallback, useEffect, type ComponentRef } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Video from 'react-native-video';
import TrackPlayer, { State } from 'react-native-track-player';
import { useThemeColors } from '../../theme/useThemeColors';

interface VideoPlayerModalProps {
  visible: boolean;
  videoUrl: string | null;
  title?: string;
  onClose: () => void;
}

export function VideoPlayerModal({ visible, videoUrl, title, onClose }: VideoPlayerModalProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const videoRef = useRef<ComponentRef<typeof Video>>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wasTrackPlayerPlayingRef = useRef<boolean>(false);

  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
    setError(null);
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleBuffer = useCallback((data: any) => {
    if (typeof data?.isBuffering === 'boolean') {
      setIsLoading(data.isBuffering);
    }
  }, []);

  const handleError = useCallback((event: any) => {
    const message = typeof event?.errorString === 'string' ? event.errorString : 'Unknown playback error';
    setIsLoading(false);
    setIsPlaying(false);
    setError(message);
    Alert.alert('Video Error', message);
  }, []);

  const togglePlayback = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  // Pause TrackPlayer when video opens, resume when it closes
  useEffect(() => {
    if (visible) {
      // Pause TrackPlayer when video opens
      TrackPlayer.getPlaybackState().then(async (state) => {
        wasTrackPlayerPlayingRef.current = state.state === State.Playing;
        if (state.state === State.Playing) {
          try {
            await TrackPlayer.pause();
          } catch (error) {
            console.error('Failed to pause TrackPlayer when opening video', error);
          }
        }
      }).catch(() => {
        wasTrackPlayerPlayingRef.current = false;
      });
    }
  }, [visible]);

  const handleClose = useCallback(async () => {
    if (videoRef.current) {
      videoRef.current.seek?.(0);
    }
    setIsLoading(true);
    setIsPlaying(true);
    setError(null);
    
    // Resume TrackPlayer if it was playing before the video opened
    if (wasTrackPlayerPlayingRef.current) {
      try {
        await TrackPlayer.play();
      } catch (error) {
        console.error('Failed to resume TrackPlayer after closing video', error);
      }
    }
    
    onClose();
  }, [onClose]);

  if (!visible || !videoUrl) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4">
          <Pressable onPress={handleClose} className="h-10 w-10 items-center justify-center">
            <Ionicons name="close" size={28} color={colors.textPrimary} />
          </Pressable>
          {title && (
            <Text className="flex-1 px-4 text-center text-base font-medium" style={{ color: colors.textPrimary }}>
              {title}
            </Text>
          )}
          <View className="h-10 w-10" />
        </View>

        {/* Video Player */}
        <View className="flex-1 items-center justify-center">
          {error ? (
            <View className="items-center px-8">
              <Ionicons name="alert-circle-outline" size={64} color={colors.textSecondary} />
              <Text className="mt-4 text-center text-base" style={{ color: colors.textPrimary }}>
                Failed to load video
              </Text>
              <Text className="mt-2 text-center text-sm" style={{ color: colors.textSecondary }}>
                {error}
              </Text>
            </View>
          ) : (
            <>
              <Video
                ref={videoRef}
                source={{ uri: videoUrl }}
                style={styles.video}
                resizeMode="contain"
                repeat
                paused={!isPlaying}
                onLoadStart={handleLoadStart}
                onLoad={handleLoad}
                onBuffer={handleBuffer}
                onError={handleError}
                muted={false}
              />

              {/* Loading indicator */}
              {isLoading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color={colors.accentMint} />
                </View>
              )}

              {/* Custom play/pause button */}
              {!isLoading && (
                <Pressable
                  onPress={togglePlayback}
                  style={styles.playPauseButton}
                  className="items-center justify-center rounded-full"
                >
                  <View
                    className="h-16 w-16 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${colors.background}CC` }}
                  >
                    <Ionicons
                      name={isPlaying ? 'pause' : 'play'}
                      size={32}
                      color={colors.textPrimary}
                      style={{ marginLeft: isPlaying ? 0 : 4 }}
                    />
                  </View>
                </Pressable>
              )}
            </>
          )}
        </View>

        {/* Bottom info */}
        <View className="px-6 py-4">
          <Text className="text-center text-sm" style={{ color: colors.textSecondary }}>
            Video will loop automatically while music plays
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseButton: {
    position: 'absolute',
    alignSelf: 'center',
  },
});


