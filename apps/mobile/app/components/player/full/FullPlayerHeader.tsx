import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useThemeColors } from '../../../theme/useThemeColors';

/**
 * FullPlayerHeader Component
 *
 * Top navigation bar for the full player with minimize and share actions.
 *
 * Layout:
 * - Left: Chevron-down button to minimize/dismiss player
 * - Center: "Now Playing" label
 * - Right: Share button for track/artwork sharing
 *
 * Implicit Behaviors:
 * - event.stopPropagation() prevents tap-through to underlying video/lyrics views
 * - topInset allows dynamic spacing for safe area (status bar height)
 * - HIT_SLOP expands touch target by 12px in all directions for better mobile UX
 */

interface FullPlayerHeaderProps {
  onClose: () => void;
  onShare: () => void;
  topInset?: number;
}

/** Expands touch targets for better mobile usability */
const HIT_SLOP = { top: 12, right: 12, bottom: 12, left: 12 } as const;

export const FullPlayerHeader = ({ onClose, onShare, topInset = 0 }: FullPlayerHeaderProps) => {
  const colors = useThemeColors();

  return (
    <View
      className="flex-row items-center justify-between"
      style={[styles.container, { paddingTop: topInset }]}
      accessibilityRole="header"
    >
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          onClose();
        }}
        className="items-center justify-center"
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel="Minimize player"
        hitSlop={HIT_SLOP}
      >
        <Ionicons name="chevron-down" size={28} color={colors.textPrimary} />
      </Pressable>
      <Text className="text-sm font-medium" style={{ color: colors.textSecondary }}>
        Now Playing
      </Text>
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          onShare();
        }}
        className="items-center justify-center"
        style={styles.iconButton}
        accessibilityRole="button"
        accessibilityLabel="Share track"
        hitSlop={HIT_SLOP}
      >
        <Ionicons name="share-social-outline" size={24} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 12,
  },
  iconButton: {
    height: 44,
    width: 44,
    borderRadius: 22,
  },
});

