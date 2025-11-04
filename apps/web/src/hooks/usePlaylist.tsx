import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { useAudioManager } from "./useAudioManager";
import type { Id } from "@backend/convex/convex/_generated/dataModel";

interface PlaylistTrack {
  _id: Id<"music">;
  title?: string;
  imageUrl?: string;
  audioUrl?: string;
  duration?: number;
  lyric?: string;
  status: "pending" | "ready" | "failed";
  diaryDate?: number;
  diaryContent?: string;
  diaryTitle?: string;
}

interface PlaylistContextValue {
  playlist: PlaylistTrack[];
  currentTrackIndex: number | null;
  currentTrack: PlaylistTrack | null;
  setPlaylist: (tracks: PlaylistTrack[]) => void;
  playTrack: (index: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  clearPlaylist: () => void;
}

const PlaylistContext = createContext<PlaylistContextValue | null>(null);

export function PlaylistProvider({ children }: { children: ReactNode }) {
  const [playlist, setPlaylistState] = useState<PlaylistTrack[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const audioManager = useAudioManager();

  const currentTrack = currentTrackIndex !== null ? playlist[currentTrackIndex] : null;

  const setPlaylist = useCallback((tracks: PlaylistTrack[]) => {
    setPlaylistState(tracks);
  }, []);

  const playTrack = useCallback(
    (index: number) => {
      if (index < 0 || index >= playlist.length) {
        return;
      }

      const track = playlist[index];
      if (!track.audioUrl || track.status !== "ready") {
        return;
      }

      setCurrentTrackIndex(index);
      audioManager.playAudio(track._id, track.audioUrl);
    },
    [playlist, audioManager]
  );

  const playNext = useCallback(() => {
    if (currentTrackIndex === null || playlist.length === 0) {
      return;
    }

    const nextIndex = (currentTrackIndex + 1) % playlist.length;
    playTrack(nextIndex);
  }, [currentTrackIndex, playlist.length, playTrack]);

  const playPrevious = useCallback(() => {
    if (currentTrackIndex === null || playlist.length === 0) {
      return;
    }

    const prevIndex = currentTrackIndex === 0 ? playlist.length - 1 : currentTrackIndex - 1;
    playTrack(prevIndex);
  }, [currentTrackIndex, playlist.length, playTrack]);

  const clearPlaylist = useCallback(() => {
    setPlaylistState([]);
    setCurrentTrackIndex(null);
    audioManager.pauseAudio();
  }, [audioManager]);

  const value: PlaylistContextValue = {
    playlist,
    currentTrackIndex,
    currentTrack,
    setPlaylist,
    playTrack,
    playNext,
    playPrevious,
    clearPlaylist,
  };

  return <PlaylistContext.Provider value={value}>{children}</PlaylistContext.Provider>;
}

export function usePlaylist() {
  const context = useContext(PlaylistContext);
  if (!context) {
    throw new Error("usePlaylist must be used within a PlaylistProvider");
  }
  return context;
}
