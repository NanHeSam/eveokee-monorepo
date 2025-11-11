/**
 * useVideoGeneration Hook
 * Handles video generation workflow for mobile app
 * - Triggers video generation with credit checking
 * - Real-time status updates via Convex subscription
 * - Error handling and user feedback
 */

import { useState, useCallback, useEffect } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '@backend/convex/convex/_generated/api';
import type { Id } from '@backend/convex/convex/_generated/dataModel';
import { Alert } from 'react-native';

interface VideoGenerationState {
  isGenerating: boolean;
  error: string | null;
}

export function useVideoGeneration(musicId: Id<'music'> | null) {
  const [state, setState] = useState<VideoGenerationState>({
    isGenerating: false,
    error: null,
  });

  // Action to start video generation (actions can call external APIs)
  const startGeneration = useAction(api.videoActions.startVideoGeneration);

  // Query to get videos for this music track
  const videos = useQuery(
    api.videos.listVideosForMusic,
    musicId ? { musicId } : 'skip'
  );

  // Query to get user's current usage/quota
  const usage = useQuery(api.usage.getCurrentUserUsage);

  /**
   * Start video generation for a music track
   */
  const generateVideo = useCallback(async () => {
    if (!musicId) {
      Alert.alert('Error', 'No music selected');
      return;
    }

    // Check if user has enough credits (need 3 for video)
    if (usage && usage.remainingQuota < 3) {
      Alert.alert(
        'Insufficient Credits',
        `Video generation requires 3 credits, but you only have ${usage.remainingQuota} remaining. Upgrade your plan to continue.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setState({ isGenerating: true, error: null });

    try {
      const result = await startGeneration({ musicId });

      if (!result.success) {
        let errorMessage = result.reason ?? 'Failed to start video generation';
        
        if (result.code === 'USAGE_LIMIT_REACHED') {
          errorMessage = 'You have reached your usage limit. Please upgrade your plan to generate more videos.';
        } else if (result.code === 'ALREADY_IN_PROGRESS') {
          errorMessage = 'Video generation is already in progress for this music.';
        } else if (result.code === 'NO_LYRICS') {
          errorMessage = 'Cannot generate video: This music has no lyrics.';
        }

        Alert.alert('Video Generation Failed', errorMessage);
        setState({ isGenerating: false, error: errorMessage });
        return;
      }

      // Success!
      Alert.alert(
        'Video Generation Started',
        'Your video is being generated. This may take a few minutes. You will be notified when it\'s ready.',
        [{ text: 'OK' }]
      );
      
      // Keep isGenerating true until query confirms pending video exists
      // This will be cleared automatically by useEffect when hasPendingVideo becomes true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      Alert.alert('Error', errorMessage);
      setState({ isGenerating: false, error: errorMessage });
    }
  }, [musicId, startGeneration, usage]);

  /**
   * Delete a generated video
   */
  const deleteVideoMutation = useMutation(api.videos.deleteVideo);
  
  const deleteVideo = useCallback(async (videoId: Id<'musicVideos'>) => {
    try {
      await deleteVideoMutation({ videoId });
      Alert.alert('Success', 'Video deleted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete video';
      Alert.alert('Error', errorMessage);
    }
  }, [deleteVideoMutation]);

  /**
   * Set a video as the primary/favorite video
   */
  const setAsPrimaryMutation = useMutation(api.videos.setAsPrimaryVideo);
  
  const setAsPrimary = useCallback(async (videoId: Id<'musicVideos'>) => {
    try {
      await setAsPrimaryMutation({ videoId });
      Alert.alert('Success', 'Video set as primary');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to set primary video';
      Alert.alert('Error', errorMessage);
    }
  }, [setAsPrimaryMutation]);

  // Find primary video
  const primaryVideo = videos?.find((v) => v.isPrimary && v.status === 'ready');
  
  // Check if there's a pending video
  const pendingVideo = videos?.find((v) => v.status === 'pending') ?? null;
  const hasPendingVideo = pendingVideo !== null;

  // Check if there's any video (pending, ready, or failed)
  const presentPending = videos?.some((v) => v.status === 'pending') ?? false;
  const presentReady = videos?.some((v) => v.status === 'ready') ?? false;
  const presentFailed = videos?.some((v) => v.status === 'failed') ?? false;
  const hasAnyVideo = presentPending || presentReady || presentFailed;

  const [pendingElapsedSeconds, setPendingElapsedSeconds] = useState<number | null>(null);
  const pendingCreatedAt = pendingVideo?.createdAt ?? null;

  // Clear isGenerating state when any video appears in query (pending, ready, or failed)
  // This handles fast completions that might skip the pending state
  useEffect(() => {
    if (hasAnyVideo) {
      setState({ isGenerating: false, error: null });
    }
  }, [hasAnyVideo]);

  useEffect(() => {
    if (pendingCreatedAt === null) {
      setPendingElapsedSeconds(null);
      return;
    }

    const updateElapsed = () => {
      const elapsedMs = Date.now() - pendingCreatedAt;
      setPendingElapsedSeconds(Math.max(0, Math.floor(elapsedMs / 1000)));
    };

    updateElapsed();
    const intervalId = setInterval(updateElapsed, 1000);
    return () => {
      clearInterval(intervalId);
    };
  }, [pendingCreatedAt]);

  // Get ready videos count
  const readyVideosCount = videos?.filter((v) => v.status === 'ready').length ?? 0;

  return {
    // State
    isGenerating: state.isGenerating || hasPendingVideo,
    error: state.error,
    
    // Data
    videos: videos ?? [],
    primaryVideo,
    hasPendingVideo,
    readyVideosCount,
    pendingElapsedSeconds,
    
    // Actions
    generateVideo,
    deleteVideo,
    setAsPrimary,
    
    // Usage info
    remainingCredits: usage?.remainingQuota ?? 0,
    canGenerate: (usage?.remainingQuota ?? 0) >= 3,
  };
}


