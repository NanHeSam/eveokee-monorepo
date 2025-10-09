import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, Text, View, Animated } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useThemeColors } from '../theme/useThemeColors';
import { api, Id } from 'convex-backend';
import { format } from 'date-fns';
import TrackPlayer from 'react-native-track-player';
import { useTrackPlayerStore } from '../store/useTrackPlayerStore';

export const PlaylistScreen = () => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const musicDocs = useQuery(api.music.listPlaylistMusic);
  const softDeleteMusic = useMutation(api.music.softDeleteMusic);

  const items = useMemo(() => (musicDocs ? mapMusicDocsToItems(musicDocs) : []), [musicDocs]);

  const isLoading = musicDocs === undefined;

  const handleDeleteMusic = (musicId: Id<"music">, title: string) => {
    Alert.alert(
      'Delete Track',
      `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await softDeleteMusic({ musicId });
            } catch (error) {
              console.error('Failed to delete music:', error);
              Alert.alert('Error', 'Failed to delete track. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="flex-1 px-5 pt-2">
        <View className="pt-2 pb-3 items-center">
          <Text className="text-[24px] font-semibold text-center" style={{ color: colors.textPrimary }}>
            Your Vibes
          </Text>
          <Text className="mt-1 text-sm text-center" style={{ color: colors.textSecondary }}>
            Curate sounds that match your mood.
          </Text>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.accentMint} />
            <Text className="mt-3 text-sm" style={{ color: colors.textSecondary }}>
              Loading your tracks…
            </Text>
          </View>
        ) : items.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-base text-center" style={{ color: colors.textSecondary }}>
              No tracks yet. Generate music from your diary entries to fill this space.
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 32 }}
            ItemSeparatorComponent={() => <View className="h-px" style={{ backgroundColor: colors.border }} />}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <PlaylistRow
                item={item}
                colors={colors}
                onPress={async () => {
                  if (!item.canPlay || !item.audioUrl) {
                    return;
                  }

                  const playableItems = items.filter((i: any) => i.canPlay && i.audioUrl);
                  const playableIndex = playableItems.findIndex((i: any) => i.id === item.id);

                  const tracks = playableItems.map((i: any) => ({
                    id: i.id,
                    url: i.audioUrl!,
                    title: i.title,
                    artist: i.diaryDateLabel ?? 'Music Diary',
                    artwork: i.imageUrl,
                    lyrics: i.lyric,
                  }));

                  try {
                    await TrackPlayer.reset();
                    await TrackPlayer.add(tracks);
                    await TrackPlayer.skip(playableIndex);
                    await TrackPlayer.play();

                    const loadPlaylist = useTrackPlayerStore.getState().loadPlaylist;
                    loadPlaylist(tracks, playableIndex);
                  } catch (error) {
                    console.error('Failed to start playback', error);
                  }
                }}
                onDelete={() => handleDeleteMusic(item.id, item.title)}
              />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

type PlaylistItem = ReturnType<typeof mapMusicDocsToItems>[number];

const mapMusicDocsToItems = (
  docs: NonNullable<typeof api.music.listPlaylistMusic._returnType>
) =>
  docs.map((doc: any) => ({
    id: doc._id,
    diaryId: doc.diaryId,
    title: doc.title ?? 'Untitled Track',
    imageUrl: doc.imageUrl,
    diaryDateLabel: doc.diaryDate ? format(new Date(doc.diaryDate), 'PPP') : undefined,
    diaryContent: doc.diaryContent,
    diaryTitle: doc.diaryTitle,
    audioUrl: doc.audioUrl,
    lyric: doc.lyric,
    status: doc.status,
    canPlay: doc.status === 'ready' && !!doc.audioUrl
  }));

const PlaylistRow = ({
  item,
  colors,
  onPress,
  onDelete,
}: {
  item: PlaylistItem;
  colors: ReturnType<typeof useThemeColors>;
  onPress: () => void;
  onDelete: () => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasContent = !!item.diaryContent;

  const renderRightActions = (progress: Animated.AnimatedAddition<number>, dragX: Animated.AnimatedAddition<number>) => {
    const opacity = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <View className="w-20 items-center justify-center" style={{ backgroundColor: '#FF3B30' }}>
        <Animated.View style={{ opacity }}>
          <Pressable
            onPress={onDelete}
            className="h-full w-full items-center justify-center"
          >
            <Ionicons name="trash" size={20} color="white" />
          </Pressable>
        </Animated.View>
      </View>
    );
  };

  const cardContent = (
    <Pressable
      className="flex-row items-center py-3"
      onPress={() => {
        if (item.canPlay) {
          onPress();
        }
      }}
      disabled={!item.canPlay}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} className="h-14 w-14 rounded-2xl" />
      ) : (
        <View
          className="h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: colors.surface }}
        >
          <Ionicons name="musical-note" size={20} color={colors.textSecondary} />
        </View>
      )}

      <View className="ml-3 flex-1">
        <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
          {item.title}
        </Text>
        {item.diaryDateLabel ? (
          <Text className="mt-0.5 text-xs" style={{ color: colors.textSecondary }}>
            {item.diaryDateLabel}
          </Text>
        ) : null}
      </View>

      {item.status === 'pending' && (
        <View className="mr-2 items-center justify-center" style={{ width: 36, height: 36 }}>
          <Ionicons
            name="time-outline"
            size={18}
            color={colors.textSecondary}
          />
        </View>
      )}

      {item.status === 'failed' && (
        <View className="mr-2 items-center justify-center" style={{ width: 36, height: 36 }}>
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={colors.textSecondary}
          />
        </View>
      )}

      {hasContent && (
        <Pressable 
          className="p-2" 
          onPress={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textSecondary}
          />
        </Pressable>
      )}
    </Pressable>
  );

  return (
    <View>
      <Swipeable renderRightActions={renderRightActions}>
        {cardContent}
      </Swipeable>

      {isExpanded && hasContent && (
        <Reanimated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          className="px-3 pb-4"
        >
          <View className="rounded-2xl p-4" style={{ backgroundColor: colors.card }}>
            {item.diaryTitle && (
              <Text className="text-sm font-semibold mb-2" style={{ color: colors.textPrimary }}>
                {item.diaryTitle}
              </Text>
            )}
            <Text className="text-sm leading-6" style={{ color: colors.textSecondary }} numberOfLines={5}>
              {item.diaryContent}
            </Text>
          </View>
        </Reanimated.View>
      )}
    </View>
  );
};


