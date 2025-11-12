import { type ReactNode, useMemo, useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, StyleSheet, View } from 'react-native';
import Video from 'react-native-video';

import { useThemeColors } from '../../../theme/useThemeColors';

interface VideoViewProps {
  videoUrl: string;
  artwork?: string | null;
  onToggleOverlay?: () => void;
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
  const videoKey = useMemo(() => `${videoUrl}-${colors.scheme}`, [videoUrl, colors.scheme]);

  const handleReady = () => setIsBuffering(false);

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

