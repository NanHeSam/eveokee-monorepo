import { useMemo, useState, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View, ScrollView, Alert, Image, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { useAction, useMutation, useQuery } from 'convex/react';
import TrackPlayer from 'react-native-track-player';
import { format } from 'date-fns';

import { useThemeColors } from '../theme/useThemeColors';
import { DiaryEditNavigationProp, DiaryEditRouteProp } from '../navigation/types';
import { api } from '@backend/convex';
import { useTrackPlayerStore } from '../store/useTrackPlayerStore';
import { PaywallModal } from '../components/billing/PaywallModal';
import { useSubscriptionUIStore } from '../store/useSubscriptionStore';
import { useRevenueCatSubscription } from '../hooks/useRevenueCatSubscription';
import { useMusicGenerationStatus } from '../store/useMusicGenerationStatus';
import { UsageProgress } from '../components/billing/UsageProgress';
import { BUTTON_SPACING, EXTRA_PADDING, DEFAULT_BUTTON_HEIGHT } from '../utils/layoutConstants';

export const DiaryEditScreen = () => {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DiaryEditNavigationProp>();
  const route = useRoute<DiaryEditRouteProp>();
  const createDiary = useMutation(api.diaries.createDiary);
  const updateDiary = useMutation(api.diaries.updateDiary);
  const startMusicGeneration = useAction(api.music.startDiaryMusicGeneration);
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const initialBody = useMemo(() => route.params?.content ?? '', [route.params?.content]);
  const [body, setBody] = useState(initialBody);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(!route.params?.diaryId);
  const [mediaItems, setMediaItems] = useState<{ uri: string; type: 'image' | 'video'; storageId?: string }[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  
  // Billing integration - Read directly from RevenueCat SDK (single source of truth)
  const { showPaywall, paywallReason, setShowPaywall } = useSubscriptionUIStore();
  const { subscriptionStatus } = useRevenueCatSubscription();
  const addPendingGeneration = useMusicGenerationStatus((state) => state.addPendingGeneration);
  
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
    status: diaryMusic.status,
  } : undefined);

  // Update body state when currentDiary loads (for read mode when navigating without content param)
  useEffect(() => {
    if (currentDiary?.content && !route.params?.content && !isEditing) {
      setBody(currentDiary.content);
    }
  }, [currentDiary?.content, route.params?.content, isEditing]);

  useEffect(() => {
    if (currentDiary?.mediaUrls && currentDiary?.mediaTypes && currentDiary?.mediaStorageIds) {
      const loadedMedia = currentDiary.mediaUrls.map((url, index) => ({
        uri: url,
        type: currentDiary.mediaTypes![index],
        storageId: currentDiary.mediaStorageIds![index],
      }));
      setMediaItems(loadedMedia);
    }
  }, [currentDiary?.mediaUrls, currentDiary?.mediaTypes, currentDiary?.mediaStorageIds]);

  const handlePickMedia = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photos and videos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const mediaType = asset.type === 'video' ? 'video' : 'image';
        
        setMediaItems([...mediaItems, { uri: asset.uri, type: mediaType }]);
      }
    } catch (error) {
      console.error('Error picking media:', error);
      Alert.alert('Error', 'Failed to pick media. Please try again.');
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMediaItems(mediaItems.filter((_, i) => i !== index));
  };

  const uploadMediaToConvex = async (uri: string): Promise<string | null> => {
    try {
      const uploadUrl = await generateUploadUrl();
      
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': blob.type },
        body: blob,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const { storageId } = await uploadResponse.json();
      return storageId;
    } catch (error) {
      console.error('Error uploading media:', error);
      return null;
    }
  };

  const handleDone = async () => {
    const trimmed = body.trim();

    if (!trimmed) {
      navigation.goBack();
      return;
    }

    try {
      setIsSaving(true);
      setIsUploadingMedia(true);

      const mediaStorageIds: string[] = [];
      const mediaTypes: ('image' | 'video')[] = [];

      for (const item of mediaItems) {
        if (item.storageId) {
          mediaStorageIds.push(item.storageId);
          mediaTypes.push(item.type);
        } else {
          const storageId = await uploadMediaToConvex(item.uri);
          if (storageId) {
            mediaStorageIds.push(storageId);
            mediaTypes.push(item.type);
          }
        }
      }

      if (route.params?.diaryId) {
        await updateDiary({ 
          diaryId: route.params.diaryId, 
          content: trimmed,
          mediaStorageIds: mediaStorageIds.length > 0 ? mediaStorageIds : undefined,
          mediaTypes: mediaTypes.length > 0 ? mediaTypes : undefined,
        });
      } else {
        await createDiary({ 
          content: trimmed,
          mediaStorageIds: mediaStorageIds.length > 0 ? mediaStorageIds : undefined,
          mediaTypes: mediaTypes.length > 0 ? mediaTypes : undefined,
        });
      }
      navigation.goBack();
    } catch {
      Alert.alert('Unable to save entry', 'Please try again.');
    } finally {
      setIsSaving(false);
      setIsUploadingMedia(false);
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
      setIsUploadingMedia(true);

      const mediaStorageIds: string[] = [];
      const mediaTypes: ('image' | 'video')[] = [];

      for (const item of mediaItems) {
        if (item.storageId) {
          mediaStorageIds.push(item.storageId);
          mediaTypes.push(item.type);
        } else {
          const storageId = await uploadMediaToConvex(item.uri);
          if (storageId) {
            mediaStorageIds.push(storageId);
            mediaTypes.push(item.type);
          }
        }
      }

      if (route.params?.diaryId) {
        await updateDiary({ 
          diaryId: route.params.diaryId, 
          content: trimmed,
          mediaStorageIds: mediaStorageIds.length > 0 ? mediaStorageIds : undefined,
          mediaTypes: mediaTypes.length > 0 ? mediaTypes : undefined,
        });
      } else {
        const result = await createDiary({ 
          content: trimmed,
          mediaStorageIds: mediaStorageIds.length > 0 ? mediaStorageIds : undefined,
          mediaTypes: mediaTypes.length > 0 ? mediaTypes : undefined,
        });
        diaryId = result._id;
      }
    } catch {
      Alert.alert('Unable to save entry', 'Please try again.');
      return;
    } finally {
      setIsSaving(false);
      setIsUploadingMedia(false);
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
            {currentDiary?.content ?? body}
          </Text>

          {mediaItems.length > 0 && (
            <View className="mb-6">
              <Text className="text-lg font-semibold mb-4" style={{ color: colors.textPrimary }}>
                Photos & Videos
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-3">
                {mediaItems.map((item, index) => (
                  <View key={index} className="rounded-2xl overflow-hidden" style={{ width: 200, height: 200 }}>
                    {item.type === 'image' ? (
                      <Image source={{ uri: item.uri }} className="w-full h-full" resizeMode="cover" />
                    ) : (
                      <View className="w-full h-full items-center justify-center" style={{ backgroundColor: colors.card }}>
                        <Ionicons name="videocam" size={48} color={colors.textSecondary} />
                        <Text className="mt-2 text-sm" style={{ color: colors.textSecondary }}>Video</Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
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

          {mediaItems.length > 0 && (
            <View className="mt-4">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-3">
                {mediaItems.map((item, index) => (
                  <View key={index} className="relative rounded-2xl overflow-hidden" style={{ width: 120, height: 120 }}>
                    {item.type === 'image' ? (
                      <Image source={{ uri: item.uri }} className="w-full h-full" resizeMode="cover" />
                    ) : (
                      <View className="w-full h-full items-center justify-center" style={{ backgroundColor: colors.card }}>
                        <Ionicons name="videocam" size={32} color={colors.textSecondary} />
                      </View>
                    )}
                    <TouchableOpacity
                      className="absolute top-1 right-1 w-6 h-6 rounded-full items-center justify-center"
                      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
                      onPress={() => handleRemoveMedia(index)}
                    >
                      <Ionicons name="close" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity
            className="mt-4 flex-row items-center justify-center py-3 px-4 rounded-2xl"
            style={{ backgroundColor: colors.surface }}
            onPress={handlePickMedia}
            disabled={isUploadingMedia}
          >
            <Ionicons name="image-outline" size={20} color={colors.accentMint} />
            <Text className="ml-2 text-base font-medium" style={{ color: colors.accentMint }}>
              {isUploadingMedia ? 'Uploading...' : 'Add Photo or Video'}
            </Text>
          </TouchableOpacity>

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
