import { useMemo } from 'react';
import { Music, Play, Pause, SkipForward, Volume2 } from 'lucide-react';
import { useAudioManager } from '@/hooks/useAudioManager';
import { MusicEntry } from '@/pages/NewDashboard';

interface MiniPlayerPanelProps {
  music: MusicEntry[];
}

export default function MiniPlayerPanel({ music }: MiniPlayerPanelProps) {
  const audioManager = useAudioManager();

  const readyMusic = useMemo(() => {
    return music.filter(m => m.status === 'ready' && m.audioUrl);
  }, [music]);

  const currentTrack = useMemo(() => {
    if (!audioManager.currentAudioId) return null;
    return readyMusic.find(m => m._id === audioManager.currentAudioId);
  }, [audioManager.currentAudioId, readyMusic]);

  const queue = useMemo(() => {
    if (!currentTrack) return readyMusic.slice(0, 5);
    const currentIndex = readyMusic.findIndex(m => m._id === currentTrack._id);
    return readyMusic.slice(currentIndex + 1, currentIndex + 6);
  }, [currentTrack, readyMusic]);

  const recentlyPlayed = useMemo(() => {
    if (!currentTrack) return [];
    const currentIndex = readyMusic.findIndex(m => m._id === currentTrack._id);
    if (currentIndex <= 0) return [];
    return readyMusic.slice(Math.max(0, currentIndex - 5), currentIndex).reverse();
  }, [currentTrack, readyMusic]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    return formatTime(seconds);
  };

  const handlePlayTrack = async (trackId: string, audioUrl: string) => {
    await audioManager.toggleAudio(trackId, audioUrl);
  };

  const handleNext = async () => {
    if (queue.length > 0 && queue[0].audioUrl) {
      await audioManager.playAudio(queue[0]._id, queue[0].audioUrl);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Mini Player */}
      <div className="bg-gradient-to-br from-purple-600 to-pink-600 p-6 text-white">
        {currentTrack ? (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Music className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wide opacity-90">
                Now Playing
              </span>
            </div>
            
            {currentTrack.imageUrl && (
              <div className="aspect-square bg-black/20 rounded-lg overflow-hidden mb-4">
                <img
                  src={currentTrack.imageUrl}
                  alt={currentTrack.title || 'Album art'}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <h3 className="font-bold text-lg mb-1 line-clamp-2">
              {currentTrack.title || 'Untitled'}
            </h3>
            
            <p className="text-sm opacity-90 mb-4 line-clamp-2">
              {currentTrack.diaryContent?.substring(0, 80) || 'No description'}
            </p>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1 opacity-90">
                <span>{formatTime(audioManager.currentTime)}</span>
                <span>{formatDuration(currentTrack.duration)}</span>
              </div>
              <div className="h-1 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-150"
                  style={{
                    width: `${audioManager.duration > 0 ? (audioManager.currentTime / audioManager.duration) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => audioManager.pauseAudio()}
                className="p-3 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              >
                <Volume2 className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => audioManager.toggleAudio(currentTrack._id, currentTrack.audioUrl!)}
                className="p-4 bg-white text-purple-600 rounded-full hover:bg-gray-100 transition-colors"
              >
                {audioManager.isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-0.5" />
                )}
              </button>
              
              <button
                onClick={handleNext}
                disabled={queue.length === 0}
                className="p-3 bg-white/20 rounded-full hover:bg-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm opacity-90">No track playing</p>
            <p className="text-xs opacity-75 mt-1">Select a song to start</p>
          </div>
        )}
      </div>

      {/* Queue Section */}
      <div className="flex-1 overflow-auto p-4">
        {queue.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Music className="w-4 h-4" />
              Next Up
            </h3>
            <div className="space-y-2">
              {queue.map((track, index) => (
                <button
                  key={track._id}
                  onClick={() => track.audioUrl && handlePlayTrack(track._id, track.audioUrl)}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {track.title || 'Untitled'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {formatDuration(track.duration)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recently Played */}
        {recentlyPlayed.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Recently Played
            </h3>
            <div className="space-y-2">
              {recentlyPlayed.map(track => (
                <button
                  key={track._id}
                  onClick={() => track.audioUrl && handlePlayTrack(track._id, track.audioUrl)}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {track.imageUrl && (
                      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0">
                        <img
                          src={track.imageUrl}
                          alt={track.title || 'Album art'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {track.title || 'Untitled'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {formatDuration(track.duration)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations Placeholder */}
        {readyMusic.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Because you wrote...
            </h3>
            <div className="space-y-2">
              {readyMusic.slice(0, 3).map(track => (
                <button
                  key={track._id}
                  onClick={() => track.audioUrl && handlePlayTrack(track._id, track.audioUrl)}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {track.imageUrl && (
                      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0">
                        <img
                          src={track.imageUrl}
                          alt={track.title || 'Album art'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {track.title || 'Untitled'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {track.diaryContent?.substring(0, 40) || 'No description'}...
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {readyMusic.length === 0 && (
          <div className="text-center py-12">
            <Music className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No music tracks yet
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Generate your first song from a journal entry
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
