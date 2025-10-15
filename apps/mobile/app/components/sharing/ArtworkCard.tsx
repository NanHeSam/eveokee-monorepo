import { View, Text, Image, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useThemeColors } from '../../theme/useThemeColors';

interface ArtworkCardProps {
  title: string;
  imageUrl?: string;
  lyric?: string;
  shareUrl: string;
}

export const ArtworkCard = ({ title, imageUrl, lyric, shareUrl }: ArtworkCardProps) => {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.artwork} />
      ) : (
        <View style={[styles.artwork, styles.placeholderArtwork, { backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 48 }}>🎵</Text>
        </View>
      )}
      
      <View style={[styles.infoSection, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
          {title}
        </Text>
        
        {lyric && (
          <Text style={[styles.lyric, { color: colors.textSecondary }]} numberOfLines={3}>
            {lyric}
          </Text>
        )}
        
        <View style={styles.qrSection}>
          <QRCode
            value={shareUrl}
            size={120}
            backgroundColor={colors.surface}
            color={colors.textPrimary}
          />
          <Text style={[styles.scanText, { color: colors.textMuted }]}>
            Scan to listen
          </Text>
        </View>
        
        <View style={styles.footer}>
          <Text style={[styles.branding, { color: colors.textMuted }]}>
            DiaryVibes
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 400,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  artwork: {
    width: '100%',
    height: 400,
  },
  placeholderArtwork: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoSection: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  lyric: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  qrSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  scanText: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  branding: {
    fontSize: 14,
    fontWeight: '600',
  },
});
