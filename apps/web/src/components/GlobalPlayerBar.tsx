import type { ChangeEvent } from 'react';
import { Play, Pause, SkipBack, SkipForward, Music, List } from 'lucide-react';
import { useAudio } from '@/contexts/AudioContext';

interface GlobalPlayerBarProps {
  onTogglePlaylist?: () => void;
}

export default function GlobalPlayerBar({ onTogglePlaylist }: GlobalPlayerBarProps) {
  const { currentTrack, isPlaying, currentTime, duration, toggleAudio, seekTo, pauseAudio } = useAudio();

  if (!currentTrack) {
    return null;
  }

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    seekTo(newTime);
  };

  const handleTogglePlay = async () => {
    if (isPlaying) {
      pauseAudio();
    } else {
      await toggleAudio(currentTrack.id, currentTrack.audioUrl);
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg z-50">
      <div className="max-w-screen-2xl mx-auto px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Album Art / Thumbnail */}
          <div className="flex-shrink-0">
            {currentTrack.imageUrl ? (
              <img
                src={currentTrack.imageUrl}
                alt={currentTrack.title}
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-accent-mint to-accent-apricot flex items-center justify-center">
                <Music className="w-6 h-6 text-white" />
              </div>
            )}
          </div>

          {/* Track Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {currentTrack.title}
                </h4>
                {currentTrack.diaryContent && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {currentTrack.diaryContent.substring(0, 60)}...
                  </p>
                )}
              </div>

              {/* Playback Controls */}
              <div className="flex items-center gap-2 ml-4">
                <button
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  title="Previous"
                  disabled
                >
                  <SkipBack className="w-5 h-5" />
                </button>
                <button
                  onClick={handleTogglePlay}
                  className="p-2 bg-accent-mint text-white rounded-full hover:bg-accent-mint/90 transition-colors"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </button>
                <button
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  title="Next"
                  disabled
                >
                  <SkipForward className="w-5 h-5" />
                </button>
                {onTogglePlaylist && (
                  <button
                    onClick={onTogglePlaylist}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    title="Queue"
                  >
                    <List className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 dark:text-gray-400 w-10 text-right">
                {formatTime(currentTime)}
              </span>
              <div className="flex-1 relative">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, rgb(82, 199, 160) 0%, rgb(82, 199, 160) ${progress}%, rgb(229, 231, 235) ${progress}%, rgb(229, 231, 235) 100%)`,
                  }}
                />
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400 w-10">
                {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
