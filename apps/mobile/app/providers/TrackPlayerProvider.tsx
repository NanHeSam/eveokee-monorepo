import type { PropsWithChildren } from 'react';
import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import TrackPlayer, {
  Capability,
  Event,
  State,
  usePlaybackState,
  useProgress,
} from 'react-native-track-player';

import { useTrackPlayerStore } from '../store/useTrackPlayerStore';

const TRACK_PLAYER_OPTIONS = {
  waitForBuffer: true,
  capabilities: [
    Capability.Play,
    Capability.Pause,
    Capability.SeekTo,
    Capability.Stop,
    Capability.SkipToNext,
    Capability.SkipToPrevious,
  ],
  compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext, Capability.SkipToPrevious],
};

export const TrackPlayerProvider = ({ children }: PropsWithChildren) => {
  const initializingRef = useRef(false);
  const { isSignedIn } = useAuth();
  const playbackState = usePlaybackState();
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

    TrackPlayer.setupPlayer({
      autoHandleInterruptions: true,
    })
      .then(async () => {
        await TrackPlayer.updateOptions(TRACK_PLAYER_OPTIONS);
      })
      .catch((error) => {
        console.error('TrackPlayer setup failed', error);
      });

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

    return () => {
      playbackSubscription.remove();
      trackChangedSubscription.remove();
      // Note: TrackPlayer.destroy() is not available in all versions
      // The player will be cleaned up when the app unmounts
    };
  }, [setPlaying, setCurrentTrack]);

  useEffect(() => {
    if (playbackState && 'state' in playbackState && playbackState.state === State.Stopped) {
      TrackPlayer.reset().catch(() => {
        // Ignore reset errors
      });
    }
  }, [playbackState]);

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

