import { useMemo, useState, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View, ScrollView, Alert, Image, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useAction, useMutation, useQuery } from 'convex/react';
import TrackPlayer from 'react-native-track-player';
import { format } from 'date-fns';

import { useThemeColors } from '../theme/useThemeColors';
import { DiaryEditNavigationProp, DiaryEditRouteProp } from '../navigation/types';
import { api } from '@backend/convex';
import { Id } from '@backend/convex/convex/_generated/dataModel';
import { useTrackPlayerStore } from '../store/useTrackPlayerStore';
import { PaywallModal } from '../components/billing/PaywallModal';
import { useSubscriptionUIStore } from '../store/useSubscriptionStore';
import { useRevenueCatSubscription } from '../hooks/useRevenueCatSubscription';
import { useMusicGenerationStatus } from '../store/useMusicGenerationStatus';
import { UsageProgress } from '../components/billing/UsageProgress';
import { BUTTON_SPACING, EXTRA_PADDING, DEFAULT_BUTTON_HEIGHT } from '../utils/layoutConstants';
import { getRandomStyles } from '@backend/convex/convex/utils/musicStyles';
import { MediaUploadButton } from '../components/diary/MediaUploadButton';
import { DiaryMediaGrid } from '../components/diary/DiaryMediaGrid';

export const DiaryEditScreen = () => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DiaryEditNavigationProp>();
  const route = useRoute<DiaryEditRouteProp>();
  const createDiary = useMutation(api.diaries.createDiary);
  const updateDiary = useMutation(api.diaries.updateDiary);
  const startMusicGeneration = useAction(api.music.startDiaryMusicGeneration);
  const initialBody = useMemo(() => route.params?.content ?? '', [route.params?.content]);
  const [body, setBody] = useState(initialBody);
  const [style, setStyle] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(!route.params?.diaryId);
  
  // Billing integration - Read directly from RevenueCat SDK (single source of truth)
  const { showPaywall, paywallReason, setShowPaywall } = useSubscriptionUIStore();
  const { subscriptionStatus } = useRevenueCatSubscription();
  const addPendingGeneration = useMusicGenerationStatus((state) => state.addPendingGeneration);
  const removePendingGeneration = useMusicGenerationStatus((state) => state.removePendingGeneration);
  
  // Get usage data from Convex to get effective limit (handles yearly monthly credits correctly)
  const usageData = useQuery(api.usage.getCurrentUserUsage);
  
  // Get MiniPlayer dimensions dynamically
  const { isVisible: isMiniPlayerVisible, miniPlayerHeight, miniPlayerBottom } = useTrackPlayerStore();
  
  // Measure button height dynamically
  const [buttonHeight, setButtonHeight] = useState<number | null>(null);
  
  // Calculate bottom padding to ensure buttons are above MiniPlayer
  // Uses dynamically measured MiniPlayer and button dimensions
  const bottomPadding = useMemo(() => {
    const effectiveButtonHeight = buttonHeight ?? DEFAULT_BUTTON_HEIGHT;
    
    if (isMiniPlayerVisible && miniPlayerHeight !== null && miniPlayerBottom !== null) {
      // When MiniPlayer is visible: position buttons above it with spacing
      return miniPlayerBottom + miniPlayerHeight + effectiveButtonHeight + BUTTON_SPACING + EXTRA_PADDING;
    } else {
      // When MiniPlayer is hidden: use safe area + button height
      return Math.max(insets.bottom, 20) + effectiveButtonHeight + EXTRA_PADDING;
    }
  }, [isMiniPlayerVisible, miniPlayerHeight, miniPlayerBottom, buttonHeight, insets.bottom]);

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
    lyricWithTime: diaryMusic.lyricWithTime,
    status: diaryMusic.status,
  } : undefined);

  // Update body state when currentDiary loads (for read mode when navigating without content param)
  useEffect(() => {
    if (currentDiary?.content && !route.params?.content && !isEditing) {
      setBody(currentDiary.content);
    }
  }, [currentDiary?.content, route.params?.content, isEditing]);

  const [savedDiaryId, setSavedDiaryId] = useState<Id<'diaries'> | null>(
    route.params?.diaryId || null
  );

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
        navigation.goBack();
      } else {
        const result = await createDiary({ content: trimmed });
        setSavedDiaryId(result._id);
        // Update route params so media upload can work
        navigation.setParams({ diaryId: result._id, content: trimmed });
        // Don't navigate back immediately - allow user to add media
        // navigation.goBack();
      }
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
      return;
    } finally {
      setIsSaving(false);
    }

    // Add pending generation optimistically for immediate UI feedback
    if (diaryId) {
      addPendingGeneration(diaryId);
    }

    // Start music generation (this handles usage tracking internally)
    try {
      setIsGenerating(true);
      const result = await startMusicGeneration({
        content: trimmed,
        diaryId: diaryId,
        style: style.trim() || undefined, // Pass style if provided, otherwise undefined
      });

      if (!result.success) {
        // Remove pending generation if it failed (optimistic update rollback)
        if (diaryId) {
          removePendingGeneration(diaryId);
        }
        // Handle limit reached or other errors
        if (result.code === 'USAGE_LIMIT_REACHED') {
          // Update navigation params with diaryId so user can return to edit this diary
          // This ensures the diary is properly linked even though music generation failed
          if (diaryId && !route.params?.diaryId) {
            navigation.setParams({
              diaryId: diaryId,
              content: trimmed,
            });
            // Keep editing mode enabled so user can see/edit the diary
            setIsEditing(true);
          }
          
          // Show error message with usage details before paywall
          // Use usage data from Convex to get effective limit (handles yearly monthly credits correctly)
          const effectiveLimit = usageData?.musicLimit ?? subscriptionStatus?.musicLimit ?? 0;
          const tier = subscriptionStatus?.tier ?? usageData?.tier ?? 'free';
          
          // For yearly subscriptions, show "monthly" in the message since they reset monthly
          let tierDisplayName: string;
          let periodDisplayName: string;
          if (tier === 'yearly') {
            tierDisplayName = 'yearly';
            periodDisplayName = 'monthly'; // Yearly subscriptions reset monthly
          } else {
            tierDisplayName = tier === 'free' ? 'free' : tier === 'weekly' ? 'weekly' : tier === 'monthly' ? 'monthly' : 'yearly';
            periodDisplayName = tierDisplayName;
          }
          
          // Show error message (PaywallModal handles preventing double presentation)
          if (!showPaywall) {
            Alert.alert(
              'Credits Exhausted',
              `You've used all ${effectiveLimit} of your ${periodDisplayName} music generation${effectiveLimit === 1 ? '' : 's'}.
               Your diary entry has been saved. Upgrade to generate music for this entry. or reach out to support@eveoky.com`,
              [
                {
                  text: 'OK',
                  style: 'cancel',
                },
                {
                  text: 'Upgrade',
                  onPress: () => {
                    setShowPaywall(true, 'limit_reached');
                  },
                },
              ]
            );
          }
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
        // Success - pending generation already added optimistically, just navigate
        navigation.goBack();
        navigation.getParent()?.navigate('Playlist' as never);
      }
    } catch {
      // Remove pending generation on error (optimistic update rollback)
      if (diaryId) {
        removePendingGeneration(diaryId);
      }
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
            {currentDiary?.content ?? body}
          </Text>

          {/* Media Display */}
          {route.params?.diaryId && (
            <View className="mb-6">
              <DiaryMediaGrid diaryId={route.params.diaryId} editable={false} />
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
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ 
            flexGrow: 1, 
            paddingHorizontal: 20,
            paddingBottom: bottomPadding,
          }}
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
              style={{ color: colors.textPrimary, minHeight: 280, textAlignVertical: 'top' }}
            />
          </View>

          {/* Style Input Section */}
          <View className="mt-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-medium" style={{ color: colors.textSecondary }}>
                Music Style (Optional)
              </Text>
              <TouchableOpacity
                onPress={() => {
                  const randomStyles = getRandomStyles(2);
                  setStyle(randomStyles.join(', '));
                }}
                className="px-3 py-1.5 rounded-lg"
                style={{ 
                  backgroundColor: colors.scheme === 'light' ? colors.accentMint : colors.card,
                }}
                activeOpacity={0.7}
              >
                <Text className="text-xs font-medium" style={{ color: colors.scheme === 'light' ? '#FFFFFF' : colors.textPrimary }}>
                  Random
                </Text>
              </TouchableOpacity>
            </View>
            <View className="rounded-2xl p-4" style={{ backgroundColor: colors.surface }}>
              <TextInput
                value={style}
                onChangeText={setStyle}
                placeholder="Leave empty for AI mood + random styles, or enter custom style..."
                placeholderTextColor={colors.textMuted}
                className="text-sm"
                style={{ color: colors.textPrimary }}
              />
            </View>
          </View>

          {/* Media Upload Section */}
          {(route.params?.diaryId || savedDiaryId) && (
            <View className="mt-4">
              <MediaUploadButton
                diaryId={(route.params?.diaryId || savedDiaryId)!}
                onUploadComplete={() => {
                  // Media will automatically refresh via the query
                }}
              />
              <DiaryMediaGrid diaryId={(route.params?.diaryId || savedDiaryId)!} editable={true} />
            </View>
          )}

          {/* Usage Progress - Only show for free tier */}
          {subscriptionStatus?.tier === 'free' && (
            <View className="mt-4">
              <UsageProgress
                onUpgradePress={() => setShowPaywall(true, 'limit_reached')}
                showUpgradeButton={true}
              />
            </View>
          )}

          {/* Action buttons - positioned relative to textbox */}
          <View 
            className="mt-6 flex-row gap-4"
            onLayout={(event) => {
              const { height } = event.nativeEvent.layout;
              setButtonHeight(height);
            }}
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
        </ScrollView>
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
