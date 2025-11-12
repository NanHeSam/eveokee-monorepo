import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '../../../theme/useThemeColors';
import { VideoView } from './VideoView';
import { FullPlayerHeader } from './FullPlayerHeader';
import { FullPlayerViewTabs } from './FullPlayerViewTabs';
import { FullPlayerMetadata } from './FullPlayerMetadata';
import { PlaybackProgressBar } from './PlaybackProgressBar';
import { PlaybackControls } from './PlaybackControls';

/**
 * VideoPlayerView Component
 *
 * Full-screen video player view with toggle-able overlay controls.
 *
 * Modes:
 * 1. Overlay Visible (isOverlayVisible=true):
 *    - Semi-transparent overlay with all controls
 *    - Header, view tabs, metadata, video action (generate status)
 *    - Playback controls and progress bar at bottom
 *    - Tapping video toggles overlay off
 *
 * 2. Overlay Hidden (isOverlayVisible=false):
 *    - Clean video playback with minimal progress bar at bottom
 *    - Only progress bar shown for scrubbing
 *    - Tapping video toggles overlay on
 *
 * Background:
 * - VideoView handles video playback with artwork backdrop
 * - Semi-transparent overlay (dark: rgba(0,0,0,0.65), light: rgba(255,255,255,0.72))
 *
 * Implicit Behaviors:
 * - pointerEvents="box-none" allows tap-through for overlay toggle
 * - pointerEvents="auto" on overlay elements to prevent tap-through
 * - Safe area insets applied to bottom padding
 * - videoAction slot for generate video UI (passed from parent)
 */

type PlayerView = 'lyrics' | 'video';

interface VideoPlayerViewProps {
  videoUrl: string;
  artwork?: string | null;
  title: string;
  artist?: string | null;
  duration: number;
  position: number;
  isPlaying: boolean;
  disableNext: boolean;
  disablePrevious: boolean;
  headerTopInset: number;
  hasVideo: boolean;
  onToggleOverlay: () => void;
  onSeek: (newPosition: number) => void;
  onTogglePlayback: () => void;
  onSkipNext: () => void;
  onSkipPrevious: () => void;
  onClose: () => void;
  onShare: () => void;
  onViewChange: (view: PlayerView) => void;
  videoAction: React.ReactNode;
  isOverlayVisible: boolean;
}

export const VideoPlayerView = ({
  videoUrl,
  artwork,
  title,
  artist,
  duration,
  position,
  isPlaying,
  disableNext,
  disablePrevious,
  headerTopInset,
  hasVideo,
  onToggleOverlay,
  onSeek,
  onTogglePlayback,
  onSkipNext,
  onSkipPrevious,
  onClose,
  onShare,
  onViewChange,
  videoAction,
  isOverlayVisible,
}: VideoPlayerViewProps) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const overlayColor = colors.scheme === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.72)';

  return (
    <VideoView videoUrl={videoUrl} artwork={artwork} onToggleOverlay={onToggleOverlay}>
      {isOverlayVisible ? (
        <>
          <View
            style={[StyleSheet.absoluteFillObject, { backgroundColor: overlayColor }]}
            pointerEvents="none"
          />
          <View
            style={[
              styles.overlayContainer,
              { paddingBottom: insets.bottom + 32 },
            ]}
            pointerEvents="box-none"
          >
            <View style={styles.overlayTop} pointerEvents="auto">
              <FullPlayerHeader onClose={onClose} onShare={onShare} topInset={headerTopInset} />
              <FullPlayerViewTabs
                activeTab="video"
                onChange={onViewChange}
                showVideoTab={hasVideo}
                topInset={8}
              />
              <View style={styles.metadataWrapper}>
                <FullPlayerMetadata title={title} artist={artist} />
              </View>
              <View style={styles.actionWrapper}>{videoAction}</View>
            </View>
            <View style={styles.overlayBottom} pointerEvents="auto">
              <PlaybackControls
                isPlaying={isPlaying}
                onTogglePlayback={onTogglePlayback}
                onSkipNext={onSkipNext}
                onSkipPrevious={onSkipPrevious}
                disableNext={disableNext}
                disablePrevious={disablePrevious}
              />
              <PlaybackProgressBar duration={duration} position={position} onSeek={onSeek} />
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
          <PlaybackProgressBar duration={duration} position={position} onSeek={onSeek} />
        </View>
      )}
    </VideoView>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  overlayTop: {
    gap: 12,
  },
  overlayBottom: {
    gap: 12,
  },
  actionWrapper: {
    marginTop: 12,
  },
  metadataWrapper: {
    marginTop: 8,
  },
  minimalProgressContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
  },
});

