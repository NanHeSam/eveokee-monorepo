import type { PropsWithChildren } from 'react';
import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import TrackPlayer, {
  Capability,
  Event,
  State,
  useProgress,
} from 'react-native-track-player';

import { useTrackPlayerStore } from '../store/useTrackPlayerStore';

export const TRACK_PLAYER_OPTIONS = {
  waitForBuffer: true,
  stoppingAppPausesPlayback: false,
  alwaysPauseOnInterruption: false,
  capabilities: [
    Capability.Play,
    Capability.Pause,
    Capability.SeekTo,
    Capability.Stop,
    Capability.SkipToNext,
    Capability.SkipToPrevious,
  ],
  compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext, Capability.SkipToPrevious],
  iosCategory: 'playback' as const,
  iosCategoryOptions: ['allowBluetooth', 'allowBluetoothA2DP'] as const,
};

export const TrackPlayerProvider = ({ children }: PropsWithChildren) => {
  const initializingRef = useRef(false);
  const { isSignedIn } = useAuth();
  const progress = useProgress();
  const setPlaying = useTrackPlayerStore((state) => state.setPlaying);
  const setProgress = useTrackPlayerStore((state) => state.setProgress);
  const setCurrentTrack = useTrackPlayerStore((state) => state.setCurrentTrack);
  const hidePlayer = useTrackPlayerStore((state) => state.hidePlayer);

  useEffect(() => {
    if (initializingRef.current) {
      return;
    }

    initializingRef.current = true;

    // Declare cleanup subscriptions variable before the IIFE
    let cleanupSubscriptions: { 
      playbackSubscription: ReturnType<typeof TrackPlayer.addEventListener>;
      trackChangedSubscription: ReturnType<typeof TrackPlayer.addEventListener>;
    } | null = null;

    // Use async IIFE to properly await setup before attaching subscriptions
    (async () => {
      const setupTrackPlayer = async () => {
        try {
          await TrackPlayer.setupPlayer({
            autoHandleInterruptions: false,
          });
          await TrackPlayer.updateOptions(TRACK_PLAYER_OPTIONS);

          // Clear any persisted queue from iOS audio session
          // This prevents auto-resume of tracks when the app reopens
          const queue = await TrackPlayer.getQueue();
          if (queue.length > 0) {
            await TrackPlayer.reset();
          }
        } catch (error) {
          // Ignore "already initialized" error, log others
          if (error instanceof Error && error.message.includes('already been initialized')) {
            // Still try to clear the queue on reload
            try {
              const queue = await TrackPlayer.getQueue();
              if (queue.length > 0) {
                await TrackPlayer.reset();
              }
            } catch {
              // Ignore reset errors on reload
            }
          } else {
            console.error('TrackPlayer setup failed', error);
          }
        }
      };

      // Await setup completion before attaching event listeners
      await setupTrackPlayer();

      const playbackSubscription = TrackPlayer.addEventListener(Event.PlaybackState, async ({ state }) => {
        setPlaying(state === State.Playing);
      });

      const trackChangedSubscription = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (data) => {
        if (data.index !== undefined && data.index !== null) {
          const playlist = useTrackPlayerStore.getState().playlist;
          if (playlist[data.index]) {
            setCurrentTrack(playlist[data.index]);
          }
        }
      });

      // Store subscriptions in a way that cleanup can access them
      return { playbackSubscription, trackChangedSubscription };
    })().then((subscriptions) => {
      // Store subscriptions for cleanup
      if (subscriptions) {
        cleanupSubscriptions = subscriptions;
      }
    }).catch((error) => {
      console.error('Failed to initialize TrackPlayer and subscriptions', error);
    });

    return () => {
      if (cleanupSubscriptions) {
        cleanupSubscriptions.playbackSubscription.remove();
        cleanupSubscriptions.trackChangedSubscription.remove();
      }
      // Note: TrackPlayer.destroy() is not available in all versions
      // The player will be cleaned up when the app unmounts
    };
  }, [setPlaying, setCurrentTrack]);


  useEffect(() => {
    setProgress(progress.position, progress.duration);
  }, [progress.duration, progress.position, setProgress]);

  // Stop music and hide player when user logs out
  useEffect(() => {
    if (!isSignedIn) {
      TrackPlayer.reset().then(() => {
        hidePlayer();
      }).catch((error) => {
        console.error('Failed to stop playback on logout', error);
      });
    }
  }, [isSignedIn, hidePlayer]);

  return children;
};

