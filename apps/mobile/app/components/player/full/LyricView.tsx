import { ActivityIndicator, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '../../../theme/useThemeColors';

interface LyricViewProps {
  artwork?: string | null;
  lyrics?: string | null;
  onPressArtwork?: () => void;
  showArtwork?: boolean;
  hasVideo?: boolean;
  onGenerateVideo?: () => void;
  isGenerating?: boolean;
  canGenerate?: boolean;
  remainingCredits?: number;
}

export const LyricView = ({
  artwork,
  lyrics,
  onPressArtwork,
  showArtwork = true,
  hasVideo = false,
  onGenerateVideo,
  isGenerating = false,
  canGenerate = false,
  remainingCredits = 0,
}: LyricViewProps) => {
  const colors = useThemeColors();
  const { height: screenHeight } = useWindowDimensions();
  const overlayText = (
    <Text
      className="text-center"
      style={[
        styles.overlayText,
        {
          color: colors.scheme === 'dark' ? 'rgba(255,255,255,0.96)' : 'rgba(12,12,12,0.88)',
        },
      ]}
    >
      {lyrics}
    </Text>
  );

  if (!showArtwork) {
    return (
      <View style={styles.overlayContainer}>
        {lyrics ? (
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16 }}
          >
            <Pressable onPress={onPressArtwork}>{overlayText}</Pressable>
          </ScrollView>
        ) : (
          <View className="flex-1 items-center justify-center p-6">
            <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
            <Text className="mt-3 text-base" style={{ color: colors.textMuted }}>
              No lyrics available
            </Text>
          </View>
        )}
      </View>
    );
  }

  const renderArtwork = () => {
    const artworkSize = screenHeight * 0.32;

    if (!artwork) {
      return (
        <View
          className="items-center justify-center rounded-3xl"
          style={{
            width: artworkSize,
            height: artworkSize,
            backgroundColor: colors.surface,
          }}
        >
          <Ionicons name="musical-notes" size={80} color={colors.textSecondary} />
        </View>
      );
    }

    const artworkContent = (
      <ImageBackground
        source={{ uri: artwork }}
        style={[styles.artwork, { width: artworkSize, height: artworkSize }]}
        imageStyle={styles.artworkImage}
        resizeMode="cover"
      />
    );

    if (!onPressArtwork) {
      return artworkContent;
    }

    return (
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          onPressArtwork();
        }}
        className="rounded-3xl"
      >
        {artworkContent}
      </Pressable>
    );
  };

  const renderGenerateVideoButton = () => {
    if (hasVideo || !onGenerateVideo) {
      return null;
    }

    if (isGenerating) {
      return (
        <View
          className="flex-row items-center justify-center rounded-full px-6 py-3 mt-4"
          style={{ backgroundColor: colors.surface }}
        >
          <ActivityIndicator size="small" color={colors.accentMint} />
          <Text className="ml-2 text-sm font-medium" style={{ color: colors.textSecondary }}>
            Generating video...
          </Text>
        </View>
      );
    }

    return (
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          onGenerateVideo();
        }}
        className="flex-row items-center justify-center rounded-full px-6 py-3 mt-4"
        style={{ backgroundColor: colors.accentMint }}
      >
        <Ionicons name="videocam" size={20} color={colors.background} style={{ marginRight: 8 }} />
        <Text className="text-base font-semibold" style={{ color: colors.background }}>
          Generate Video (3 credits)
        </Text>
      </Pressable>
    );
  };

  return (
    <View className="flex-1" style={styles.container}>
      <View className="items-center" style={styles.artworkWrapper}>
        {renderArtwork()}
        {renderGenerateVideoButton()}
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  artwork: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  artworkImage: {
    borderRadius: 24,
  },
  container: {
    gap: 24,
  },
  artworkWrapper: {
    paddingTop: 16,
  },
  overlayContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  overlayText: {
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

