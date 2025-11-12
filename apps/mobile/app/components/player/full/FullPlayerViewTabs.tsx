import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '../../../theme/useThemeColors';

type ViewTab = 'lyrics' | 'video';

interface FullPlayerViewTabsProps {
  activeTab: ViewTab;
  onChange: (tab: ViewTab) => void;
  showVideoTab: boolean;
  topInset?: number;
}

const TAB_LABELS: Record<ViewTab, string> = {
  lyrics: 'Lyric',
  video: 'Video',
};

export const FullPlayerViewTabs = ({ activeTab, onChange, showVideoTab, topInset = 0 }: FullPlayerViewTabsProps) => {
  const colors = useThemeColors();
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

