import { useMemo } from 'react';
import { Music, X, Play, Pause } from 'lucide-react';
import { useAudio } from '@/contexts/AudioContext';
import { useQuery } from 'convex/react';
import { api } from '@backend/convex';

interface FloatingPlaylistProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FloatingPlaylist({ isOpen, onClose }: FloatingPlaylistProps) {
  const audioManager = useAudio();
  const music = useQuery(api.music.listPlaylistMusic);

  const readyMusic = useMemo(() => {
    if (!music) return [];
    return music.filter(m => m.status === 'ready' && m.audioUrl);
  }, [music]);

  const currentTrack = useMemo(() => {
    if (!audioManager.currentAudioId) return null;
    return readyMusic.find(m => m._id === audioManager.currentAudioId);
  }, [audioManager.currentAudioId, readyMusic]);

  const queue = useMemo(() => {
    if (!currentTrack) return readyMusic.slice(0, 10);
    const currentIndex = readyMusic.findIndex(m => m._id === currentTrack._id);
    return readyMusic.slice(currentIndex + 1, currentIndex + 11);
  }, [currentTrack, readyMusic]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayTrack = async (trackId: string, audioUrl: string) => {
    const track = readyMusic.find(m => m._id === trackId);
    if (track) {
      audioManager.setCurrentTrack({
        id: track._id,
        title: track.title || 'Untitled Song',
        imageUrl: track.imageUrl,
        duration: track.duration,
        diaryContent: track.diaryContent,
        audioUrl: track.audioUrl!,
      });
    }
    await audioManager.toggleAudio(trackId, audioUrl);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Floating Panel */}
      <div className="fixed bottom-20 right-4 w-96 max-h-[600px] bg-white dark:bg-gray-800 rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Queue
            </h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {queue.length} tracks
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Queue List */}
        <div className="flex-1 overflow-auto p-4">
          {queue.length > 0 ? (
            <div className="space-y-2">
              {queue.map((track, index) => {
                const isCurrentTrack = audioManager.currentAudioId === track._id;
                return (
                  <button
                    key={track._id}
                    onClick={() => track.audioUrl && handlePlayTrack(track._id, track.audioUrl)}
                    className={`w-full text-left p-3 rounded-lg transition-colors group ${
                      isCurrentTrack
                        ? 'bg-purple-50 dark:bg-purple-900/20'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Track Number / Play Icon */}
                      <div className={`w-8 h-8 rounded flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                        isCurrentTrack
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 group-hover:bg-purple-600 group-hover:text-white'
                      }`}>
                        {isCurrentTrack && audioManager.isPlaying ? (
                          <Pause className="w-4 h-4" />
                        ) : isCurrentTrack ? (
                          <Play className="w-4 h-4" />
                        ) : (
                          index + 1
                        )}
                      </div>

                      {/* Track Image */}
                      {track.imageUrl && (
                        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0">
                          <img
                            src={track.imageUrl}
                            alt={track.title || 'Album art'}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      {/* Track Info */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${
                          isCurrentTrack
                            ? 'text-purple-600 dark:text-purple-400'
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {track.title || 'Untitled'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {track.diaryContent?.substring(0, 40) || formatDuration(track.duration)}
                        </p>
                      </div>

                      {/* Duration */}
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                        {formatDuration(track.duration)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Music className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No tracks in queue
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Play a song to see your queue
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
