import { useState, useRef, useEffect } from "react";
import { PlayIcon, PauseIcon, SkipBackIcon, SkipForwardIcon, XIcon } from "lucide-react";
import { usePlaylist } from "../hooks/usePlaylist";
import { useAudioManager } from "../hooks/useAudioManager";

export function MiniPlayer() {
  const { currentTrack, playNext, playPrevious, clearPlaylist } = usePlaylist();
  const audioManager = useAudioManager();

  const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 150 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const playerRef = useRef<HTMLDivElement>(null);

  // Don't render if no track is loaded
  if (!currentTrack) {
    return null;
  }

  const isPlaying = audioManager.isPlaying && audioManager.isCurrentAudio(currentTrack._id);
  const currentTime = audioManager.currentTime;
  const duration = audioManager.duration;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!playerRef.current) return;

    const rect = playerRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Keep player within viewport bounds
      const maxX = window.innerWidth - (playerRef.current?.offsetWidth || 320);
      const maxY = window.innerHeight - (playerRef.current?.offsetHeight || 120);

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handlePlayPause = () => {
    if (isPlaying) {
      audioManager.pauseAudio();
    } else if (currentTrack.audioUrl) {
      audioManager.playAudio(currentTrack._id, currentTrack.audioUrl);
    }
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={playerRef}
      style={{
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
      }}
      className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 w-80 select-none"
    >
      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        className="cursor-move bg-slate-100 dark:bg-slate-700 px-4 py-2 rounded-t-lg flex items-center justify-between"
      >
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Now Playing
        </span>
        <button
          onClick={clearPlaylist}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          aria-label="Close player"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Track info */}
        <div className="flex items-center space-x-3">
          {currentTrack.imageUrl ? (
            <img
              src={currentTrack.imageUrl}
              alt={currentTrack.title || "Track cover"}
              className="w-12 h-12 rounded object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
              <span className="text-slate-400 dark:text-slate-500 text-xs">No image</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {currentTrack.title || "Untitled"}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatTime(currentTime)} / {formatTime(duration)}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-blue-600 dark:bg-blue-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={playPrevious}
            className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            aria-label="Previous track"
          >
            <SkipBackIcon className="w-5 h-5" />
          </button>

          <button
            onClick={handlePlayPause}
            disabled={audioManager.isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {audioManager.isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            ) : isPlaying ? (
              <PauseIcon className="w-5 h-5" fill="currentColor" />
            ) : (
              <PlayIcon className="w-5 h-5" fill="currentColor" />
            )}
          </button>

          <button
            onClick={playNext}
            className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            aria-label="Next track"
          >
            <SkipForwardIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
