import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '../../../theme/useThemeColors';

/**
 * FullPlayerViewTabs Component
 *
 * Segmented control for switching between Lyrics and Video views.
 *
 * Layout:
 * - Centered pill-shaped tab group with rounded background
 * - Active tab highlighted with accentMint background
 * - Inactive tabs have transparent background with secondary text
 *
 * Implicit Behaviors:
 * - Video tab conditionally shown based on showVideoTab prop
 * - When showVideoTab=false, only Lyrics tab displays (single tab mode)
 * - event.stopPropagation() prevents tap-through to underlying views
 * - Max width of 320px prevents tabs from becoming too wide on tablets
 * - Accessibility: Each tab has tab role and selected state
 */

type ViewTab = 'lyrics' | 'video';

interface FullPlayerViewTabsProps {
  /** Currently active tab */
  activeTab: ViewTab;
  /** Callback when tab changes */
  onChange: (tab: ViewTab) => void;
  /** Whether to show video tab (false when no video available) */
  showVideoTab: boolean;
  /** Additional top padding for spacing */
  topInset?: number;
}

const TAB_LABELS: Record<ViewTab, string> = {
  lyrics: 'Lyric',
  video: 'Video',
};

export const FullPlayerViewTabs = ({ activeTab, onChange, showVideoTab, topInset = 0 }: FullPlayerViewTabsProps) => {
  const colors = useThemeColors();
  // Conditionally include video tab only when available
  const tabs: ViewTab[] = showVideoTab ? ['lyrics', 'video'] : ['lyrics'];

  return (
    <View
      className="flex-row items-center justify-center"
      style={[styles.container, { paddingTop: topInset }]}
    >
      <View
        className="flex-row rounded-full bg-black/5 p-1"
        style={[styles.tabGroup, { backgroundColor: `${colors.card}66` }]}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={(event) => {
                event.stopPropagation();
                onChange(tab);
              }}
              className="mx-1 flex-1 items-center justify-center rounded-full px-4 py-2"
              style={{
                backgroundColor: isActive ? colors.accentMint : 'transparent',
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${TAB_LABELS[tab]} view`}
            >
              <Text
                className="text-sm font-semibold"
                style={{
                  color: isActive ? colors.background : colors.textSecondary,
                }}
              >
                {TAB_LABELS[tab]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 16,
  },
  tabGroup: {
    flex: 1,
    maxWidth: 320,
  },
});

