import { ImageBackground, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '../../../theme/useThemeColors';
import { FullPlayerHeader } from './FullPlayerHeader';
import { FullPlayerViewTabs } from './FullPlayerViewTabs';
import { FullPlayerMetadata } from './FullPlayerMetadata';
import { LyricView } from './LyricView';
import { PlaybackProgressBar } from './PlaybackProgressBar';
import { PlaybackControls } from './PlaybackControls';

/**
 * LyricsPlayerView Component
 *
 * Full-screen lyrics-focused player view with two layout modes.
 *
 * Modes:
 * 1. Overlay Mode (isOverlayVisible=true):
 *    - Full-screen scrollable lyrics with semi-transparent overlay
 *    - Header, view tabs, and progress bar visible
 *    - Tapping background or lyrics toggles overlay off
 *
 * 2. Detail Mode (isOverlayVisible=false):
 *    - Standard player layout with all UI controls
 *    - Header, tabs, metadata, artwork, video generation CTA
 *    - Playback controls and progress bar at bottom
 *
 * Background:
 * - Artwork shown as backdrop with reduced opacity (45% overlay, 28% detail)
 * - Falls back to solid surface color if no artwork
 * - Semi-transparent overlay (dark: rgba(0,0,0,0.65), light: rgba(255,255,255,0.72))
 *
 * Implicit Behaviors:
 * - event.stopPropagation() on various elements prevents unwanted overlay toggles
 * - pointerEvents="box-none" allows tap-through to children while maintaining layer structure
 * - Safe area insets applied to bottom padding
 * - Overlay mode designed for immersive lyric reading experience
 */

type PlayerView = 'lyrics' | 'video';

interface LyricsPlayerViewProps {
  artwork?: string | null;
  title: string;
  artist?: string | null;
  lyrics?: string | null;
  duration: number;
  position: number;
  isPlaying: boolean;
  disableNext: boolean;
  disablePrevious: boolean;
  headerTopInset: number;
  hasVideo: boolean;
  isOverlayVisible: boolean;
  activeView: PlayerView;
  canGenerate: boolean;
  remainingCredits: number;
  isGenerating: boolean;
  pendingElapsedSeconds: number | null;
  onToggleOverlay: () => void;
  onSeek: (newPosition: number) => void;
  onTogglePlayback: () => void;
  onSkipNext: () => void;
  onSkipPrevious: () => void;
  onClose: () => void;
  onShare: () => void;
  onGenerateVideo: () => void;
  onViewChange: (view: PlayerView) => void;
}

export const LyricsPlayerView = ({
  artwork,
  title,
  artist,
  lyrics,
  duration,
  position,
  isPlaying,
  disableNext,
  disablePrevious,
  headerTopInset,
  hasVideo,
  isOverlayVisible,
  activeView,
  canGenerate,
  remainingCredits,
  isGenerating,
  pendingElapsedSeconds,
  onToggleOverlay,
  onSeek,
  onTogglePlayback,
  onSkipNext,
  onSkipPrevious,
  onClose,
  onShare,
  onGenerateVideo,
  onViewChange,
}: LyricsPlayerViewProps) => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const overlayColor = colors.scheme === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.72)';

  return (
    <View style={styles.backdrop}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onToggleOverlay();
          }}
          style={StyleSheet.absoluteFill}
          android_disableSound
        >
          {artwork ? (
            <ImageBackground
              source={{ uri: artwork }}
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
          <View style={styles.overlayContainer} pointerEvents="box-none">
            <View
              style={[StyleSheet.absoluteFillObject, { backgroundColor: overlayColor }]}
              pointerEvents="none"
            />
            <View
              style={[
                styles.overlayContent,
                { paddingBottom: insets.bottom + 56, paddingHorizontal: 24 },
              ]}
              pointerEvents="auto"
            >
              <FullPlayerHeader onClose={onClose} onShare={onShare} topInset={headerTopInset} />
              <FullPlayerViewTabs
                activeTab={activeView}
                onChange={onViewChange}
                showVideoTab={hasVideo}
                topInset={8}
              />
              <View style={styles.lyricsWrapper}>
                <LyricView
                  artwork={artwork}
                  lyrics={lyrics}
                  onPressArtwork={onToggleOverlay}
                  showArtwork={false}
                />
              </View>
            </View>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                onToggleOverlay();
              }}
              style={[
                styles.progressContainer,
                { paddingBottom: insets.bottom + 24, paddingHorizontal: 24 },
              ]}
              pointerEvents="auto"
            >
              <PlaybackProgressBar duration={duration} position={position} onSeek={onSeek} />
            </Pressable>
          </View>
        ) : (
          <View
            style={[
              styles.detailContainer,
              { paddingBottom: insets.bottom + 32 },
            ]}
            pointerEvents="auto"
          >
            <FullPlayerHeader onClose={onClose} onShare={onShare} topInset={headerTopInset} />
            <FullPlayerViewTabs
              activeTab={activeView}
              onChange={onViewChange}
              showVideoTab={hasVideo}
              topInset={8}
            />
            <FullPlayerMetadata title={title} artist={artist} />
            <View style={styles.detailLyricWrapper}>
              <LyricView
                artwork={artwork}
                lyrics={lyrics}
                onPressArtwork={onToggleOverlay}
                hasVideo={hasVideo}
                onGenerateVideo={onGenerateVideo}
                isGenerating={isGenerating}
                canGenerate={canGenerate}
                remainingCredits={remainingCredits}
              />
            </View>
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
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  overlayContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  overlayContent: {
    flex: 1,
    justifyContent: 'flex-start',
    gap: 16,
  },
  lyricsWrapper: {
    flex: 1,
  },
  progressContainer: {
    justifyContent: 'flex-end',
  },
  detailContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    gap: 16,
  },
  detailLyricWrapper: {
    flex: 1,
  },
});

