import { useState, useRef, useCallback, useEffect } from 'react';

interface AudioState {
  currentAudioId: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  currentTime: number;
  duration: number;
}

interface AudioManager {
  currentAudioId: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  currentTime: number;
  duration: number;
  playAudio: (audioId: string, audioUrl: string, startTime?: number) => Promise<void>;
  pauseAudio: () => void;
  toggleAudio: (audioId: string, audioUrl: string, startTime?: number) => Promise<void>;
  seekTo: (time: number) => void;
  isCurrentAudio: (audioId: string) => boolean;
}

export function useAudioManager(): AudioManager {
  const [audioState, setAudioState] = useState<AudioState>({
    currentAudioId: null,
    isPlaying: false,
    isLoading: false,
    error: null,
    currentTime: 0,
    duration: 0,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioIdRef = useRef<string | null>(null);

  // Cleanup function to stop and reset audio
  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.removeEventListener('ended', handleAudioEnded);
      audioRef.current.removeEventListener('error', handleAudioError);
      audioRef.current.removeEventListener('loadstart', handleLoadStart);
      audioRef.current.removeEventListener('canplay', handleCanPlay);
      audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audioRef.current.pause();
      audioRef.current = null;
    }
    currentAudioIdRef.current = null;
    setAudioState(prev => ({
      ...prev,
      currentTime: 0,
      duration: 0,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAudioEnded = useCallback(() => {
    setAudioState(prev => ({
      ...prev,
      isPlaying: false,
      currentAudioId: null,
      isLoading: false,
      currentTime: 0,
    }));
    cleanup();
  }, [cleanup]);

  const handleAudioError = useCallback(() => {
    setAudioState(prev => ({
      ...prev,
      isPlaying: false,
      isLoading: false,
      error: 'Failed to load audio',
      currentTime: 0,
    }));
    cleanup();
  }, [cleanup]);

  const handleLoadStart = useCallback(() => {
    setAudioState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));
  }, []);

  const handleCanPlay = useCallback(() => {
    setAudioState(prev => ({
      ...prev,
      isLoading: false,
    }));
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setAudioState(prev => ({
        ...prev,
        currentTime: audioRef.current?.currentTime || 0,
      }));
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setAudioState(prev => ({
        ...prev,
        duration: audioRef.current?.duration || 0,
      }));
    }
  }, []);

  const playAudio = useCallback(async (audioId: string, audioUrl: string, startTime?: number) => {
    try {
      // If there's already an audio playing, stop it
      if (audioRef.current && currentAudioIdRef.current !== audioId) {
        cleanup();
      }

      // If it's the same audio and it's playing, do nothing
      if (currentAudioIdRef.current === audioId && audioState.isPlaying) {
        return;
      }

      // Create new audio element if needed
      if (!audioRef.current || currentAudioIdRef.current !== audioId) {
        cleanup();
        audioRef.current = new Audio(audioUrl);
        currentAudioIdRef.current = audioId;

        // Add event listeners
        audioRef.current.addEventListener('ended', handleAudioEnded);
        audioRef.current.addEventListener('error', handleAudioError);
        audioRef.current.addEventListener('loadstart', handleLoadStart);
        audioRef.current.addEventListener('canplay', handleCanPlay);
        audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
        audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      }

      setAudioState(prev => ({
        ...prev,
        currentAudioId: audioId,
        isLoading: true,
        error: null,
      }));

      // Set start time if provided
      if (startTime !== undefined && audioRef.current) {
        audioRef.current.currentTime = startTime;
      }

      await audioRef.current.play();
      
      setAudioState(prev => ({
        ...prev,
        isPlaying: true,
        isLoading: false,
      }));
    } catch {
      setAudioState(prev => ({
        ...prev,
        isPlaying: false,
        isLoading: false,
        error: 'Failed to play audio',
      }));
    }
  }, [audioState.isPlaying, cleanup, handleAudioEnded, handleAudioError, handleLoadStart, handleCanPlay, handleTimeUpdate, handleLoadedMetadata]);

  const pauseAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setAudioState(prev => ({
        ...prev,
        isPlaying: false,
      }));
    }
  }, []);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current && audioState.duration > 0) {
      const clampedTime = Math.max(0, Math.min(time, audioState.duration));
      audioRef.current.currentTime = clampedTime;
      setAudioState(prev => ({
        ...prev,
        currentTime: clampedTime,
      }));
    }
  }, [audioState.duration]);

  const toggleAudio = useCallback(async (audioId: string, audioUrl: string, startTime?: number) => {
    if (audioState.currentAudioId === audioId && audioState.isPlaying) {
      pauseAudio();
    } else {
      await playAudio(audioId, audioUrl, startTime);
    }
  }, [audioState.currentAudioId, audioState.isPlaying, pauseAudio, playAudio]);

  const isCurrentAudio = useCallback((audioId: string) => {
    return audioState.currentAudioId === audioId;
  }, [audioState.currentAudioId]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    currentAudioId: audioState.currentAudioId,
    isPlaying: audioState.isPlaying,
    isLoading: audioState.isLoading,
    error: audioState.error,
    currentTime: audioState.currentTime,
    duration: audioState.duration,
    playAudio,
    pauseAudio,
    toggleAudio,
    seekTo,
    isCurrentAudio,
  };
}