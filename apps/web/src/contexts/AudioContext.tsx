import { createContext, useContext, ReactNode, useState } from 'react';
import { useAudioManager } from '@/hooks/useAudioManager';

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
  currentTrack: TrackMetadata | null;
  setCurrentTrack: (track: TrackMetadata | null) => void;
}

export interface TrackMetadata {
  id: string;
  title: string;
  imageUrl?: string;
  duration?: number;
  diaryContent?: string;
  audioUrl: string;
}

export const AudioContext = createContext<AudioManager | null>(null);

/**
 * Provides AudioManager state and actions to descendant components via React context.
 *
 * The provider supplies a combined AudioManager object (including current track state and a setter)
 * to any component within its tree through AudioContext.
 *
 * @param children - The React nodes to render within the provider
 * @returns A React element that provides the AudioManager value to descendant components
 */
export function AudioProvider({ children }: { children: ReactNode }) {
  const audioManager = useAudioManager();
  const [currentTrack, setCurrentTrack] = useState<TrackMetadata | null>(null);

  const value: AudioManager = {
    ...audioManager,
    currentTrack,
    setCurrentTrack,
  };

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}