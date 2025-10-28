import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View, ScrollView, Alert, Image, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useMutation, useQuery } from 'convex/react';
import TrackPlayer from 'react-native-track-player';
import { format } from 'date-fns';

import { useThemeColors } from '../theme/useThemeColors';
import { DiaryEditNavigationProp, DiaryEditRouteProp } from '../navigation/types';
import { api } from '@backend/convex';
import { useTrackPlayerStore } from '../store/useTrackPlayerStore';
import { PaywallModal } from '../components/billing/PaywallModal';
import { useSubscriptionUIStore, useSubscription } from '../store/useSubscriptionStore';
import { useMusicGenerationStatus } from '../store/useMusicGenerationStatus';
import { UsageProgress } from '../components/billing/UsageProgress';

export const DiaryEditScreen = () => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DiaryEditNavigationProp>();
  const route = useRoute<DiaryEditRouteProp>();
  const createDiary = useMutation(api.diaries.createDiary);
  const updateDiary = useMutation(api.diaries.updateDiary);
  const startMusicGeneration = useMutation(api.music.startDiaryMusicGeneration);
  const initialBody = useMemo(() => route.params?.content ?? '', [route.params?.content]);
  const [body, setBody] = useState(initialBody);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(!route.params?.diaryId);
  
  // Billing integration
  const { showPaywall, paywallReason, setShowPaywall } = useSubscriptionUIStore();
  const { subscriptionStatus } = useSubscription();
  const addPendingGeneration = useMusicGenerationStatus((state) => state.addPendingGeneration);

  const diaryDocs = useQuery(api.diaries.listDiaries);
  const currentDiary = useMemo(
    () => diaryDocs?.find((d: any) => d._id === route.params?.diaryId),
    [diaryDocs, route.params?.diaryId]
  );
  const allMusic = useQuery(api.music.listPlaylistMusic);
  const diaryMusic = useMemo(
    () => allMusic?.find((m: any) => m.diaryId === route.params?.diaryId),
    [allMusic, route.params?.diaryId]
  );
  const primaryMusic = currentDiary?.primaryMusic || (diaryMusic ? {
    _id: diaryMusic._id,
    title: diaryMusic.title,
    imageUrl: diaryMusic.imageUrl,
    audioUrl: diaryMusic.audioUrl,
    duration: diaryMusic.duration,
    lyric: diaryMusic.lyric,
    status: diaryMusic.status,
  } : undefined);

  const handleDone = async () => {
    const trimmed = body.trim();

    if (!trimmed) {
      navigation.goBack();
      return;
    }

    try {
      setIsSaving(true);
      if (route.params?.diaryId) {
        await updateDiary({ diaryId: route.params.diaryId, content: trimmed });
      } else {
        await createDiary({ content: trimmed });
      }
      navigation.goBack();
    } catch {
      Alert.alert('Unable to save entry', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateMusic = async () => {
    const trimmed = body.trim();

    if (!trimmed) {
      Alert.alert('Add some words first', 'Write a diary entry before generating music.');
      return;
    }

    // First save the diary entry and capture the diaryId
    let diaryId = route.params?.diaryId;
    try {
      setIsSaving(true);
      if (route.params?.diaryId) {
        await updateDiary({ diaryId: route.params.diaryId, content: trimmed });
      } else {
        const result = await createDiary({ content: trimmed });
        diaryId = result._id;
      }
    } catch {
      Alert.alert('Unable to save entry', 'Please try again.');
      setIsSaving(false);
      return;
    }

    // Start music generation (this handles usage tracking internally)
    try {
      setIsGenerating(true);
      const result = await startMusicGeneration({
        content: trimmed,
        diaryId: diaryId,
      });

      if (!result.success) {
        // Handle limit reached or other errors
        if (result.code === 'USAGE_LIMIT_REACHED') {
          setShowPaywall(true, 'limit_reached');
        } else if (result.code === 'ALREADY_IN_PROGRESS') {
          // Navigate to Playlist - music generation is already in progress
          // Use a 1-button alert so it's less intrusive than the error alert
          Alert.alert(
            'Music Generation in Progress',
            'Your music is already being generated. Check the Playlist to see the status.',
            [
              {
                text: 'View Playlist',
                onPress: () => {
                  navigation.goBack();
                  navigation.getParent()?.navigate('Playlist' as never);
                }
              }
            ]
          );
        } else {
          Alert.alert('Unable to start music generation', result.reason || 'Please try again.');
        }
      } else {
        // Success - navigate back and go to playlist
        if (diaryId) {
          addPendingGeneration(diaryId);
        }
        navigation.goBack();
        navigation.getParent()?.navigate('Playlist' as never);
      }
    } catch {
      Alert.alert('Unable to start music generation', 'Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

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

  if (!isEditing && route.params?.diaryId) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 }}
        >
          <View className="mt-1 mb-6 flex-row items-center justify-between">
            <Pressable onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </Pressable>
            <Pressable onPress={() => setIsEditing(true)}>
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
            {body}
          </Text>

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
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mt-1">
            <Text className="text-2xl font-semibold" style={{ color: colors.textPrimary }}>
              {route.params?.diaryId ? 'Edit Entry' : 'New Entry'}
            </Text>
            <Text className="mt-1 text-sm" style={{ color: colors.textSecondary }}>
              Capture your thoughts and transform them into music.
            </Text>
          </View>

          <View className="mt-8 rounded-3xl p-5" style={{ backgroundColor: colors.surface }}>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Write your story..."
              placeholderTextColor={colors.textMuted}
              multiline
              className="text-base leading-6"
              style={{ color: colors.textPrimary, minHeight: 180, textAlignVertical: 'top' }}
            />
          </View>

          {/* Usage Progress - Only show for free tier */}
          {subscriptionStatus?.tier === 'free' && (
            <View className="mt-4">
              <UsageProgress
                onUpgradePress={() => setShowPaywall(true, 'limit_reached')}
                showUpgradeButton={true}
              />
            </View>
          )}
        </ScrollView>

        <View
          className="flex-row gap-4 px-5 pb-5"
          style={{ paddingBottom: Math.max(insets.bottom, 20), backgroundColor: colors.background }}
        >
          <TouchableOpacity
            className="flex-1 items-center justify-center rounded-[26px] py-4"
            style={{ backgroundColor: colors.card, opacity: (isSaving || isGenerating) ? 0.7 : 1 }}
            activeOpacity={0.85}
            onPress={handleDone}
            disabled={isSaving || isGenerating}
          >
            <Text className="text-base font-semibold" style={{ color: colors.textPrimary }}>
              {isSaving ? 'Saving...' : 'Done'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 items-center justify-center rounded-[26px] py-4"
            style={{ backgroundColor: colors.accentMint, opacity: (isSaving || isGenerating) ? 0.7 : 1 }}
            activeOpacity={0.85}
            onPress={handleGenerateMusic}
            disabled={isSaving || isGenerating}
          >
            <Text className="text-base font-semibold" style={{ color: colors.background }}>
              {isGenerating ? 'Generating...' : 'Generate Music'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      
      {/* Paywall Modal */}
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        reason={paywallReason}
      />
    </SafeAreaView>
  );
};
