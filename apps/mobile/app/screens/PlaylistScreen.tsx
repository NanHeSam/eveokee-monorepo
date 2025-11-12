import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, Text, View, Animated } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';

import { useThemeColors } from '../theme/useThemeColors';
import { api } from '@backend/convex';
import { Id } from '@backend/convex/convex/_generated/dataModel';
import { format } from 'date-fns';
import TrackPlayer from 'react-native-track-player';
import { useTrackPlayerStore } from '../store/useTrackPlayerStore';
import { useShareMusic } from '../hooks/useShareMusic';
import { useMusicGenerationStatus } from '../store/useMusicGenerationStatus';
import { PlaylistTabNavigationProp } from '../navigation/types';

export const PlaylistScreen = () => {
  const colors = useThemeColors();
  const navigation = useNavigation<PlaylistTabNavigationProp>();
  const musicDocs = useQuery(api.music.listPlaylistMusic);
  const softDeleteMusic = useMutation(api.music.softDeleteMusic);
  const { shareMusic } = useShareMusic();
  const pendingGenerations = useMusicGenerationStatus((state) => state.pendingGenerations);
  const removePendingGeneration = useMusicGenerationStatus((state) => state.removePendingGeneration);

  const items = useMemo(() => (musicDocs ? mapMusicDocsToItems(musicDocs) : []), [musicDocs]);
  const placeholderItems = useMemo(() => {
    if (!pendingGenerations.length) {
      return [];
    }
    const resolvedDiaryIds = new Set(items.map((item) => item.diaryId));
    return pendingGenerations
      .filter((entry) => !resolvedDiaryIds.has(entry.diaryId))
      .map((entry) => ({
        id: `pending-${entry.diaryId}` as const,
        diaryId: entry.diaryId,
        title: 'Generating music…',
        imageUrl: undefined,
        diaryDateLabel: undefined,
        diaryContent: undefined,
        diaryTitle: undefined,
        audioUrl: undefined,
        lyric: undefined,
        status: 'pending' as const,
        canPlay: false,
        isPlaceholder: true,
        startedAt: entry.startedAt,
        createdAt: entry.startedAt,
      }));
  }, [pendingGenerations, items]);
  const displayItems = useMemo(() => [...placeholderItems, ...items], [placeholderItems, items]);

  const isLoading = musicDocs === undefined;
  const hasDisplayItems = displayItems.length > 0;

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

  useEffect(() => {
    if (!pendingGenerations.length || !items.length) {
      return;
    }
    const resolvedDiaryIds = new Set(items.map((item) => item.diaryId));
    pendingGenerations.forEach((entry) => {
      if (resolvedDiaryIds.has(entry.diaryId)) {
        removePendingGeneration(entry.diaryId);
      }
    });
  }, [pendingGenerations, items, removePendingGeneration]);

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
        ) : !hasDisplayItems ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-base text-center" style={{ color: colors.textSecondary }}>
              No tracks yet. Generate music from your diary entries to fill this space.
            </Text>
          </View>
        ) : (
          <FlatList
            data={displayItems}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 32 }}
            ItemSeparatorComponent={() => <View className="h-px" style={{ backgroundColor: colors.border }} />}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              item.isPlaceholder || item.status === 'pending' ? (
                <GeneratingRow 
                  colors={colors} 
                  startedAt={item.isPlaceholder ? item.startedAt : (item.status === 'pending' ? item.createdAt : undefined)} 
                />
              ) : (
              <PlaylistRow
                item={item}
                colors={colors}
                navigation={navigation}
                onPress={async () => {
                  if (!item.canPlay || !item.audioUrl) {
                    return;
                  }

                  const playableItems = items.filter(isPlayable);
                  const playableIndex = playableItems.findIndex((i) => i.id === item.id);

                  const tracks = playableItems.map((i: PlayablePlaylistItem) => ({
                    id: i.id,
                    url: i.audioUrl,
                    title: i.title,
                    artist: i.diaryDateLabel ?? 'Music Diary',
                    artwork: i.imageUrl,
                    lyrics: i.lyric,
                    lyricWithTime: i.lyricWithTime,
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
                onShare={() => { void shareMusic(item.id, item.title) }}
              />
              )
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

type PlaylistItem = ReturnType<typeof mapMusicDocsToItems>[number];

type PlayablePlaylistItem = PlaylistItem & {
  canPlay: true;
  audioUrl: string;
};

function isPlayable(item: PlaylistItem): item is PlayablePlaylistItem {
  return item.canPlay === true && !!item.audioUrl;
}

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
    lyricWithTime: doc.lyricWithTime,
    status: doc.status,
    canPlay: doc.status === 'ready' && !!doc.audioUrl,
    isPlaceholder: false,
    createdAt: doc.createdAt,
  }));

const GeneratingRow = ({
  colors,
  startedAt,
}: {
  colors: ReturnType<typeof useThemeColors>;
  startedAt?: number;
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsedTime(0);
      return;
    }

    // Calculate initial elapsed time, clamped to zero
    const initialElapsed = Math.floor((Date.now() - startedAt) / 1000);
    setElapsedTime(Math.max(0, initialElapsed));

    // Update every second
    const interval = setInterval(() => {
      const calculatedElapsed = Math.floor((Date.now() - startedAt) / 1000);
      setElapsedTime(Math.max(0, calculatedElapsed));
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const clampedElapsed = Math.max(0, elapsedTime);
  const progress = Math.min((clampedElapsed / 120) * 100, 95); // 2 minutes = 120 seconds, cap at 95%

  return (
    <View className="py-3">
      <View className="flex-row items-center">
        <View
          className="h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: colors.surface }}
        >
          <ActivityIndicator size="small" color={colors.accentMint} />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
            Generating your music…
          </Text>
          <Text className="mt-0.5 text-xs" style={{ color: colors.textSecondary }}>
            We&apos;re composing a new track. This usually takes about 2 minutes.
          </Text>
        </View>
      </View>
      
      {/* Progress Bar */}
      <View className="mt-3 ml-[68px] mr-3">
        <View
          className="h-1.5 rounded-full"
          style={{ backgroundColor: colors.border || 'rgba(0,0,0,0.1)' }}
        >
          <View
            className="h-1.5 rounded-full"
            style={{
              width: `${progress}%`,
              backgroundColor: colors.accentMint,
            }}
          />
        </View>
        <Text className="mt-1.5 text-xs" style={{ color: colors.textSecondary }}>
          {formatTime(clampedElapsed)} / ~2:00
        </Text>
      </View>
    </View>
  );
};

const PlaylistRow = ({
  item,
  colors,
  navigation,
  onPress,
  onDelete,
  onShare,
}: {
  item: PlaylistItem;
  colors: ReturnType<typeof useThemeColors>;
  navigation: PlaylistTabNavigationProp;
  onPress: () => void;
  onDelete: () => void;
  onShare: () => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasContent = !!item.diaryContent;

  const handleDiaryPress = useCallback(() => {
    if (item.diaryId) {
      // Navigate to Diary tab, then to DiaryEdit screen
      navigation.navigate('Diary', {
        screen: 'DiaryEdit',
        params: {
          diaryId: item.diaryId,
        },
      });
    }
  }, [item.diaryId, navigation]);

  const handleLongPress = () => {
    if (item.canPlay) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert(
        'Share Music',
        `Share "${item.title}" with others?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Share', onPress: onShare },
        ]
      );
    }
  };

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
      onLongPress={handleLongPress}
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
          <View
            className="rounded-2xl p-4"
            style={{ backgroundColor: colors.card }}
          >
            {item.diaryTitle && (
              <Text className="text-sm font-semibold mb-2" style={{ color: colors.textPrimary }}>
                {item.diaryTitle}
              </Text>
            )}
            <Text className="text-sm leading-6" style={{ color: colors.textSecondary }} numberOfLines={5}>
              {item.diaryContent}
            </Text>
            {item.diaryId && (
              <Pressable
                onPress={handleDiaryPress}
                className="mt-3 flex-row items-center"
              >
                <Text className="text-sm font-medium" style={{ color: colors.accentMint }}>
                  Read full diary
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.accentMint} style={{ marginLeft: 4 }} />
              </Pressable>
            )}
          </View>
        </Reanimated.View>
      )}
    </View>
  );
};
