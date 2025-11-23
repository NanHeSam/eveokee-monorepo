import { View, Text, ScrollView, Pressable, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import TrackPlayer from 'react-native-track-player';
import { format } from 'date-fns';

import { useThemeColors } from '../theme/useThemeColors';
import { DiaryViewNavigationProp, DiaryViewRouteProp } from '../navigation/types';
import { api } from '@backend/convex';
import { DiaryMediaGrid } from '../components/diary/DiaryMediaGrid';
import { useTrackPlayerStore } from '../store/useTrackPlayerStore';

export const DiaryViewScreen = () => {
  const colors = useThemeColors();
  const navigation = useNavigation<DiaryViewNavigationProp>();
  const route = useRoute<DiaryViewRouteProp>();

  const { diaryId } = route.params;

  // Fetch the specific diary by ID
  const currentDiary = useQuery(api.diaries.getDiary, { diaryId });

  const primaryMusic = currentDiary?.primaryMusic;

  const handlePlayMusic = async () => {
    if (!primaryMusic?.audioUrl) return;

    try {
      const track = {
        id: primaryMusic._id,
        url: primaryMusic.audioUrl,
        title: primaryMusic.title ?? 'Untitled Track',
        artist: currentDiary?.date ? format(new Date(currentDiary.date), 'PPP') : 'Music Diary',
        artwork: primaryMusic.imageUrl,
        lyrics: primaryMusic.lyric,
        lyricWithTime: primaryMusic.lyricWithTime || currentDiary?.primaryMusic?.lyricWithTime,
      };

      // Reset queue and add track
      await TrackPlayer.reset();
      await TrackPlayer.add(track);

      // Verify the track was added before playing
      const queue = await TrackPlayer.getQueue();
      if (queue.length > 0) {
        await TrackPlayer.skip(0);
        await TrackPlayer.play();

        const loadPlaylist = useTrackPlayerStore.getState().loadPlaylist;
        loadPlaylist([track], 0);
      } else {
        console.error('Failed to add track to queue');
        Alert.alert('Playback Error', 'Unable to play this track. Please try again.');
      }
    } catch (error) {
      console.error('Failed to start playback', error);
      Alert.alert('Playback Error', 'Unable to play this track. Please try again.');
    }
  };

  // Show loading state while query is in progress
  if (currentDiary === undefined) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <View className="flex-1 items-center justify-center">
          <Text className="text-base" style={{ color: colors.textSecondary }}>
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show not-found state when diary doesn't exist
  if (currentDiary === null) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="document-text-outline" size={64} color={colors.textSecondary} style={{ marginBottom: 16 }} />
          <Text className="text-xl font-semibold mb-2" style={{ color: colors.textPrimary }}>
            Diary Not Found
          </Text>
          <Text className="text-base text-center mb-6" style={{ color: colors.textSecondary }}>
            This diary entry could not be found or you don&apos;t have permission to view it.
          </Text>
          <Pressable
            onPress={() => navigation.goBack()}
            className="px-6 py-3 rounded-full"
            style={{ backgroundColor: colors.accentMint }}
          >
            <Text className="text-base font-semibold" style={{ color: colors.background }}>
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 }}
      >
        <View className="mt-1 mb-6 flex-row items-center justify-between">
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Pressable onPress={() => navigation.navigate('DiaryEdit', { diaryId, content: currentDiary.content, title: currentDiary.title })}>
            <Text className="text-base font-semibold" style={{ color: colors.accentMint }}>
              Edit
            </Text>
          </Pressable>
        </View>

        {currentDiary.date && (
          <Text className="text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
            {format(new Date(currentDiary.date), 'MMMM d, yyyy')}
          </Text>
        )}

        <Text className="text-2xl font-semibold mb-6" style={{ color: colors.textPrimary }}>
          {currentDiary.title ?? 'A Day of Reflection'}
        </Text>

        <Text className="text-base leading-7 mb-8" style={{ color: colors.textPrimary }}>
          {currentDiary.content}
        </Text>

        {/* Media Display */}
        <View className="mb-6">
          <DiaryMediaGrid diaryId={diaryId} editable={false} />
        </View>

        {/* Events Summary */}
        {currentDiary.events && currentDiary.events.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
              Events summary
            </Text>
            {currentDiary.events.map((event) => (
              <Pressable
                key={event._id}
                onPress={() => navigation.navigate('EventDetails', { eventId: event._id })}
                className="p-4 rounded-2xl mb-3"
                style={{ backgroundColor: colors.surface }}
              >
                <View className="flex-row justify-between items-start mb-2">
                  <Text className="text-base font-semibold flex-1 mr-2" style={{ color: colors.textPrimary }}>
                    {event.title}
                  </Text>
                  {/* Placeholder for "Needs review" or other status if needed */}
                </View>

                {event.mood !== undefined && (
                  <View className="flex-row items-center mb-3">
                    <View className={`w-3 h-3 rounded-full mr-2 ${event.mood > 0 ? 'bg-green-500' : event.mood < 0 ? 'bg-red-500' : 'bg-gray-400'}`} />
                    <Text className="text-sm" style={{ color: colors.textSecondary }}>
                      Mood ({event.mood > 0 ? 'positive' : event.mood < 0 ? 'negative' : 'neutral'})
                    </Text>
                  </View>
                )}

                {/* People */}
                {event.people && event.people.length > 0 && (
                  <View className="flex-row flex-wrap mb-2">
                    <Text className="text-sm mr-2 mb-1" style={{ color: colors.textSecondary }}>People</Text>
                    {event.people.map((person) => (
                      <Pressable
                        key={person._id}
                        onPress={() => {
                          // TODO: Navigate to person detail page
                        }}
                      >
                        <View className="px-2 py-1 rounded-full mr-2 mb-1" style={{ backgroundColor: colors.card }}>
                          <Text className="text-xs" style={{ color: colors.textPrimary }}>{person.name}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}

                {/* Tags */}
                {event.tags && event.tags.length > 0 && (
                  <View className="flex-row flex-wrap">
                    <Text className="text-sm mr-2 mb-1" style={{ color: colors.textSecondary }}>Tags</Text>
                    {event.tags.map((tag) => (
                      <Pressable
                        key={tag._id}
                        onPress={() => {
                          // TODO: Navigate to tag detail page
                        }}
                      >
                        <View className="px-2 py-1 rounded-full mr-2 mb-1" style={{ backgroundColor: colors.card }}>
                          <Text className="text-xs" style={{ color: colors.textPrimary }}>{tag.name}</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {primaryMusic && (
          <View className="mb-6">
            <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
              My Vibe
            </Text>
            <View className="rounded-3xl overflow-hidden" style={{ backgroundColor: colors.surface }}>
              <Pressable
                className="flex-row items-center p-4"
                onPress={handlePlayMusic}
                disabled={primaryMusic.status !== 'ready' || !primaryMusic.audioUrl}
              >
                {primaryMusic.imageUrl ? (
                  <Image source={{ uri: primaryMusic.imageUrl }} className="h-16 w-16 rounded-2xl" />
                ) : (
                  <View
                    className="h-16 w-16 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: colors.card }}
                  >
                    <Ionicons name="musical-note" size={24} color={colors.textSecondary} />
                  </View>
                )}

                <View className="ml-4 flex-1">
                  <Text className="text-base font-semibold mb-1" style={{ color: colors.textPrimary }}>
                    {primaryMusic.title ?? 'Untitled Track'}
                  </Text>
                  <Text className="text-xs" style={{ color: colors.textSecondary }}>
                    JournalSounds
                  </Text>
                </View>

                <View
                  className="h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: primaryMusic.status === 'ready' ? colors.accentMint : colors.card }}
                >
                  <Ionicons
                    name={primaryMusic.status === 'ready' ? 'play' : primaryMusic.status === 'pending' ? 'time-outline' : 'alert-circle-outline'}
                    size={20}
                    color={primaryMusic.status === 'ready' ? colors.background : colors.textSecondary}
                  />
                </View>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

