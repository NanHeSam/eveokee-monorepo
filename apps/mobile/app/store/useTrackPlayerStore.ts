import { create } from 'zustand';

export type TrackPlayerTrack = {
  id: string;
  title: string;
  artist?: string;
  artwork?: string;
  url: string;
  lyrics?: string;
};

type TrackPlayerState = {
  currentTrack: TrackPlayerTrack | null;
  playlist: TrackPlayerTrack[];
  currentTrackIndex: number;
  isVisible: boolean;
  isPlaying: boolean;
  position: number;
  duration: number;
  isFullPlayerVisible: boolean;
  miniPlayerHeight: number | null;
  miniPlayerBottom: number | null;
  setMiniPlayerDimensions: (height: number, bottom: number) => void;
  showPlayer: (track: TrackPlayerTrack) => void;
  loadPlaylist: (tracks: TrackPlayerTrack[], startIndex: number) => void;
  setCurrentTrack: (track: TrackPlayerTrack | null) => void;
  hidePlayer: () => void;
  setPlaying: (playing: boolean) => void;
  setProgress: (position: number, duration: number) => void;
  showFullPlayer: () => void;
  hideFullPlayer: () => void;
};

export const useTrackPlayerStore = create<TrackPlayerState>((set) => ({
  currentTrack: null,
  playlist: [],
  currentTrackIndex: -1,
  isVisible: false,
  isPlaying: false,
  position: 0,
  duration: 0,
  isFullPlayerVisible: false,
  miniPlayerHeight: null,
  miniPlayerBottom: null,
  setMiniPlayerDimensions: (height, bottom) => set({ miniPlayerHeight: height, miniPlayerBottom: bottom }),
  showPlayer: (track) => set({ currentTrack: track, isVisible: true, position: 0, duration: 0 }),
  loadPlaylist: (tracks, startIndex) => set({
    playlist: tracks,
    currentTrackIndex: startIndex,
    currentTrack: tracks[startIndex] || null,
    isVisible: true,
    position: 0,
    duration: 0
  }),
  setCurrentTrack: (track) => set((state) => {
    const newIndex = state.playlist.findIndex(t => t.id === track?.id);
    return {
      currentTrack: track,
      currentTrackIndex: newIndex >= 0 ? newIndex : state.currentTrackIndex
    };
  }),
  hidePlayer: () => set({ isVisible: false, isPlaying: false, position: 0, duration: 0, isFullPlayerVisible: false }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setProgress: (position, duration) => set({ position, duration }),
  showFullPlayer: () => set({ isFullPlayerVisible: true }),
  hideFullPlayer: () => set({ isFullPlayerVisible: false }),
}));

