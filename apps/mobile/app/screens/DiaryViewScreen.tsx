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

  // Fetch all diaries and find the one we need
  const allDiaries = useQuery(api.diaries.listDiaries);
  const currentDiary = allDiaries?.find(d => d._id === diaryId);

  // Fetch all music and find the one for this diary
  const allMusic = useQuery(api.music.listPlaylistMusic);
  const diaryMusic = allMusic?.find(m => m.diaryId === diaryId);

  const primaryMusic = currentDiary?.primaryMusic || (diaryMusic
    ? {
        _id: diaryMusic._id,
        title: diaryMusic.title,
        imageUrl: diaryMusic.imageUrl,
        audioUrl: diaryMusic.audioUrl,
        duration: diaryMusic.duration,
        lyric: diaryMusic.lyric,
        lyricWithTime: diaryMusic.lyricWithTime,
        status: diaryMusic.status,
      }
    : undefined);

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
      }
    } catch (error) {
      console.error('Failed to start playback', error);
      Alert.alert('Playback Error', 'Unable to play this track. Please try again.');
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 }}
      >
        <View className="mt-1 mb-6 flex-row items-center justify-between">
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Pressable onPress={() => navigation.navigate('DiaryEdit', { diaryId, content: currentDiary?.content, title: currentDiary?.title })}>
            <Text className="text-base font-semibold" style={{ color: colors.accentMint }}>
              Edit
            </Text>
          </Pressable>
        </View>

        {currentDiary?.date && (
          <Text className="text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
            {format(new Date(currentDiary.date), 'MMMM d, yyyy')}
          </Text>
        )}

        <Text className="text-2xl font-semibold mb-6" style={{ color: colors.textPrimary }}>
          {currentDiary?.title ?? 'A Day of Reflection'}
        </Text>

        <Text className="text-base leading-7 mb-8" style={{ color: colors.textPrimary }}>
          {currentDiary?.content}
        </Text>

        {/* Media Display */}
        <View className="mb-6">
          <DiaryMediaGrid diaryId={diaryId} editable={false} />
        </View>

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

