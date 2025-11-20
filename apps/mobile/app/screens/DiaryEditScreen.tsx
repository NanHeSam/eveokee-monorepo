import { useMemo, useState, useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View, ScrollView, Alert, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useAction, useMutation, useQuery } from 'convex/react';

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
  const deleteDiary = useMutation(api.diaries.deleteDiary);
  const startMusicGeneration = useAction(api.music.startDiaryMusicGeneration);
  const initialBody = useMemo(() => route.params?.content ?? '', [route.params?.content]);
  const [body, setBody] = useState(initialBody);
  const [style, setStyle] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const trimmed = useMemo(() => body.trim(), [body]);
  const [isTextDirty, setIsTextDirty] = useState(false); // Tracks whether text differs from last saved value

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

  // Fetch all diaries and find the one we need (if editing existing diary)
  const allDiaries = useQuery(api.diaries.listDiaries);
  const currentDiary = route.params?.diaryId 
    ? allDiaries?.find(d => d._id === route.params.diaryId)
    : undefined;

  // Update body state when currentDiary loads (when navigating without content param)
  useEffect(() => {
    if (currentDiary?.content && !route.params?.content) {
      setBody(currentDiary.content);
    }
  }, [currentDiary?.content, route.params?.content]);

  const [savedDiaryId, setSavedDiaryId] = useState<Id<'diaries'> | null>(
    route.params?.diaryId || null
  );

  const handleDone = async () => {
    if (!trimmed) {
      navigation.goBack();
      return;
    }

    try {
      setIsSaving(true);
      if (route.params?.diaryId) {
        await updateDiary({ diaryId: route.params.diaryId, content: trimmed });
        // Update original content to reflect saved state
        originalContentRef.current = trimmed;
        setIsTextDirty(false);
        navigation.goBack();
      } else {
        const result = await createDiary({ content: trimmed });
        setSavedDiaryId(result._id);
        // Update route params so media upload can work
        navigation.setParams({ diaryId: result._id, content: trimmed });
        // Update original content to reflect saved state
        originalContentRef.current = trimmed;
        setIsTextDirty(false);
        
        // Navigate to View instead of back to List
        navigation.replace('DiaryView', { diaryId: result._id });
      }
    } catch {
      Alert.alert('Unable to save entry', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateMusic = async () => {
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
        // Update original content to reflect saved state
        originalContentRef.current = trimmed;
        setIsTextDirty(false);
      } else {
        const result = await createDiary({ content: trimmed });
        diaryId = result._id;
        // Update original content to reflect saved state
        originalContentRef.current = trimmed;
        setIsTextDirty(false);
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
            // Keep user on the edit screen so they can see/edit the diary
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

  const diaryMedia = useQuery(api.diaryMedia.getDiaryMedia,
    (route.params?.diaryId || savedDiaryId) ? { diaryId: (route.params?.diaryId || savedDiaryId)! } : "skip"
  );
  // Track whether the diaryMedia query has finished loading
  // In Convex, undefined means still loading, defined (even if empty array) means loaded
  const diaryMediaLoaded = diaryMedia !== undefined;
  const hasMedia = diaryMediaLoaded && (diaryMedia?.length ?? 0) > 0;

  const initialDiaryIdRef = useRef(route.params?.diaryId);
  const isNavigatingBackRef = useRef(false);
  // Track original content for existing diaries to detect changes
  const originalContentRef = useRef<string>('');
  
  // Update original content when diary loads or editing starts
  useEffect(() => {
    if (route.params?.diaryId && currentDiary?.content) {
      originalContentRef.current = currentDiary.content.trim();
      setIsTextDirty(false);
    } else if (route.params?.content) {
      originalContentRef.current = route.params.content.trim();
      setIsTextDirty(false);
    } else if (route.params?.diaryId && !currentDiary) {
      // Diary is loading, originalContentRef will be set when currentDiary loads
      originalContentRef.current = '';
      setIsTextDirty(false);
    } else if (!route.params?.diaryId) {
      // New diary, reset original content
      originalContentRef.current = '';
      setIsTextDirty(false);
    }
  }, [route.params?.diaryId, route.params?.content, currentDiary?.content]);

  useEffect(() => {
    setIsTextDirty(trimmed !== originalContentRef.current);
  }, [trimmed]);
  
  const currentId = route.params?.diaryId || savedDiaryId;
  
  // Show warning dialogs for new diaries that currently have media attached.
  const shouldWarnBecauseOfMedia = Boolean(
    currentId &&
    diaryMediaLoaded &&
    !initialDiaryIdRef.current &&
    hasMedia
  );

  // Silently clean up newly created diaries that have no text and no media.
  const shouldSilentlyDeleteEmptyNewDiary = Boolean(
    currentId &&
    !trimmed &&
    diaryMediaLoaded &&
    !hasMedia &&
    !initialDiaryIdRef.current
  );

  // Prevent native swipe back when we need to show the alert
  // This ensures the alert shows BEFORE the screen is removed
  // Prevent if:
  // 1. New diary with text (regardless of media or whether diary was created) - needs warning before discarding
  // 2. Existing diary with unsaved changes - needs warning before discarding
  // 3. New diary that currently has media or previously had media this session
  const shouldPreventRemove = !!(
    (trimmed && !initialDiaryIdRef.current) ||
    (initialDiaryIdRef.current && isTextDirty) ||
    shouldWarnBecauseOfMedia
  );

  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: !shouldPreventRemove,
    });
  }, [navigation, shouldPreventRemove]);

  // Handle back navigation with appropriate warnings/cleanup
  const handleBackPress = async () => {
    // If we are saving or generating, don't interrupt
    if (isSaving || isGenerating) {
      return;
    }

    // First check: If it's a NEW entry (not editing existing one passed via params initially)
    // and it has text, show discard warning (regardless of media or whether diary was created)
    if (trimmed && !initialDiaryIdRef.current) {
      Alert.alert(
        'Discard Entry?',
        currentId 
          ? 'You have written content but haven\'t saved. Going back will delete this entry.'
          : 'You have written content but haven\'t saved. Going back will discard your changes.',
        [
          { text: 'Keep Editing', style: 'cancel', onPress: () => { } },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: async () => {
              // Only delete if diary was already created
              if (currentId) {
                try {
                  await deleteDiary({ diaryId: currentId });
                } catch (err) {
                  // Handle gracefully if diary was already deleted
                  const errorMessage = err instanceof Error ? err.message : String(err);
                  if (!errorMessage.includes('Diary not found')) {
                    console.error('Failed to delete diary', err);
                  }
                }
              }
              // Mark that we're navigating back programmatically to prevent beforeRemove from handling it
              isNavigatingBackRef.current = true;
              navigation.goBack();
            },
          },
        ]
      );
    } else if (initialDiaryIdRef.current && isTextDirty) {
      // Existing diary with unsaved changes - show warning
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Going back will discard your edits.',
        [
          { text: 'Keep Editing', style: 'cancel', onPress: () => { } },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              // Mark that we're navigating back programmatically to prevent beforeRemove from handling it
              isNavigatingBackRef.current = true;
              navigation.goBack();
            },
          },
        ]
      );
    } else if (shouldWarnBecauseOfMedia) {
      Alert.alert(
        'Discard Entry?',
        'You have uploaded media but haven\'t written anything. Going back will delete this entry and its media.',
        [
          { text: 'Keep Editing', style: 'cancel', onPress: () => { } },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteDiary({ diaryId: currentId });
              } catch (err) {
                // Handle gracefully if diary was already deleted
                const errorMessage = err instanceof Error ? err.message : String(err);
                if (!errorMessage.includes('Diary not found')) {
                  console.error('Failed to delete empty diary', err);
                }
              }
              // Mark that we're navigating back programmatically to prevent beforeRemove from handling it
              isNavigatingBackRef.current = true;
              navigation.goBack();
            },
          },
        ]
      );
    } else if (shouldSilentlyDeleteEmptyNewDiary) {
      // If it was a NEW entry (not editing existing one passed via params initially)
      // and it's empty and has no media (and media query has finished loading),
      // we should delete it silently because it was likely lazily created but user changed mind.
      // However, if we just do nothing, it stays as an empty diary.
      // Let's delete it silently to keep DB clean.
      
      // Note: We can't easily await here before dispatching, so we fire and forget
      // or we preventDefault, delete, then dispatch.
      deleteDiary({ diaryId: currentId })
        .catch(err => {
          // Handle gracefully if diary was already deleted
          const errorMessage = err instanceof Error ? err.message : String(err);
          if (!errorMessage.includes('Diary not found')) {
            console.error('Failed to cleanup empty diary', err);
          }
        })
        .finally(() => {
          // Mark that we're navigating back programmatically to prevent beforeRemove from handling it
          isNavigatingBackRef.current = true;
          navigation.goBack();
        });
    } else {
      // Normal case - just go back
      // Mark that we're navigating back programmatically to prevent beforeRemove from handling it
      isNavigatingBackRef.current = true;
      navigation.goBack();
    }
  };

  // Intercept back navigation
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // If we're already handling navigation programmatically (via back button), skip
      if (isNavigatingBackRef.current) {
        // Reset the flag for next time
        isNavigatingBackRef.current = false;
        return;
      }

      // If we are saving or generating, don't interrupt (or maybe we should? but let's keep it simple)
      if (isSaving || isGenerating) {
        return;
      }

      // Variables are already hoisted above

      // First check: If it's a NEW entry (not editing existing one passed via params initially)
      // and it has text, show discard warning (regardless of media or whether diary was created)
      if (trimmed && !initialDiaryIdRef.current) {
        e.preventDefault();

        Alert.alert(
          'Discard Entry?',
          currentId 
            ? 'You have written content but haven\'t saved. Going back will delete this entry.'
            : 'You have written content but haven\'t saved. Going back will discard your changes.',
          [
            { text: 'Keep Editing', style: 'cancel', onPress: () => { } },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: async () => {
                // Only delete if diary was already created
                if (currentId) {
                  try {
                    await deleteDiary({ diaryId: currentId });
                  } catch (err) {
                    // Handle gracefully if diary was already deleted
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    if (!errorMessage.includes('Diary not found')) {
                      console.error('Failed to delete diary', err);
                    }
                  }
                }
                // Dispatch the action to go back
                navigation.dispatch(e.data.action);
              },
            },
          ]
        );
      } else if (initialDiaryIdRef.current && isTextDirty) {
        // Existing diary with unsaved changes - show warning
        e.preventDefault();

        Alert.alert(
          'Discard Changes?',
          'You have unsaved changes. Going back will discard your edits.',
          [
            { text: 'Keep Editing', style: 'cancel', onPress: () => { } },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => {
                // Dispatch the action to go back
                navigation.dispatch(e.data.action);
              },
            },
          ]
        );
      } else if (shouldWarnBecauseOfMedia) {
        e.preventDefault();

        Alert.alert(
          'Discard Entry?',
          'You have uploaded media but haven\'t written anything. Going back will delete this entry and its media.',
          [
            { text: 'Keep Editing', style: 'cancel', onPress: () => { } },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: async () => {
                try {
                  await deleteDiary({ diaryId: currentId! });
                } catch (err) {
                  // Handle gracefully if diary was already deleted
                  const errorMessage = err instanceof Error ? err.message : String(err);
                  if (!errorMessage.includes('Diary not found')) {
                    console.error('Failed to delete empty diary', err);
                  }
                }
                // Dispatch the action to go back
                navigation.dispatch(e.data.action);
              },
            },
          ]
        );
      } else if (shouldSilentlyDeleteEmptyNewDiary) {
        // If it was a NEW entry (not editing existing one passed via params initially)
        // and it's empty and has no media (and media query has finished loading),
        // we should delete it silently because it was likely lazily created but user changed mind.
        // However, if we just do nothing, it stays as an empty diary.
        // Let's delete it silently to keep DB clean.

        // Note: We can't easily await here before dispatching, so we fire and forget
        // or we preventDefault, delete, then dispatch.
        e.preventDefault();
        deleteDiary({ diaryId: currentId })
          .catch(err => {
            // Handle gracefully if diary was already deleted
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (!errorMessage.includes('Diary not found')) {
              console.error('Failed to cleanup empty diary', err);
            }
          })
          .finally(() => navigation.dispatch(e.data.action));
      }
    });

    return unsubscribe;
  }, [navigation, hasMedia, route.params?.diaryId, savedDiaryId, isSaving, isGenerating, currentId, trimmed, deleteDiary, diaryMediaLoaded, isTextDirty, shouldWarnBecauseOfMedia, shouldSilentlyDeleteEmptyNewDiary]);

  const handleEnsureDiaryId = async (): Promise<Id<'diaries'> | null> => {
    if (route.params?.diaryId) return route.params.diaryId;
    if (savedDiaryId) return savedDiaryId;

    try {
      setIsSaving(true);
      // Even if empty, we might need to create it to attach media? 
      // Or should we require some text? Let's allow empty text if they are adding media.
      // But createDiary might fail if we have validation. 
      // Let's assume empty content is allowed or default to empty string.

      const result = await createDiary({ content: trimmed });
      setSavedDiaryId(result._id);
      navigation.setParams({ diaryId: result._id, content: trimmed });
      return result._id;
    } catch (error) {
      Alert.alert('Unable to create diary', 'error: ' + error.message + ' Please try again.');
      return null;
    } finally {
      setIsSaving(false);
    }
  };

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
          <View className="mt-1 mb-6 flex-row items-center justify-between">
            <Pressable onPress={handleBackPress} testID="back-button">
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </Pressable>
            <View className="flex-1" />
          </View>

          <View className="mt-1">
            <View className="flex-row items-center">
              <Text className="text-2xl font-semibold" style={{ color: colors.textPrimary }}>
                {route.params?.diaryId ? 'Edit Entry' : 'New Entry'}
              </Text>
              {isTextDirty && (
                <View
                  testID="text-dirty-indicator"
                  accessibilityLabel="Unsaved text changes"
                  className="ml-2 h-2 w-2 rounded-full"
                  style={{ backgroundColor: colors.accentMint }}
                />
              )}
            </View>
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
          <View className="mt-4">
            <MediaUploadButton
              diaryId={route.params?.diaryId || savedDiaryId || undefined}
              onEnsureDiaryId={handleEnsureDiaryId}
              onUploadComplete={() => {
                // Media will automatically refresh via the query
              }}
            />
            <DiaryMediaGrid diaryId={route.params?.diaryId || savedDiaryId || undefined} editable={true} />
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
                {isSaving ? 'Saving...' : 'Save'}
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
