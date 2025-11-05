import { useEffect } from 'react';
import { X, Calendar, Music, Edit, Share2, Lock } from 'lucide-react';
import { DiaryEntry } from '@/pages/NewDashboard';
import { Id } from '@backend/convex/convex/_generated/dataModel';
import MusicPlayer from '@/components/MusicPlayer';

interface DetailDrawerProps {
  diaryId: Id<'diaries'>;
  diaries: DiaryEntry[];
  onClose: () => void;
}

export default function DetailDrawer({ diaryId, diaries, onClose }: DetailDrawerProps) {
  const diary = diaries.find(d => d._id === diaryId);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!diary) {
    return null;
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-white dark:bg-gray-800 shadow-2xl z-50 overflow-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Journal Entry
          </h2>
          <div className="flex items-center gap-2">
            <button
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Edit"
            >
              <Edit className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Share"
            >
              <Share2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Toggle visibility"
            >
              <Lock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Date */}
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-4">
            <Calendar className="w-5 h-5" />
            <span className="text-sm font-medium">
              {formatDate(diary.date)}
            </span>
          </div>

          {/* Title */}
          {diary.title && (
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
              {diary.title}
            </h1>
          )}

          {/* Content */}
          <div className="prose dark:prose-invert max-w-none mb-8">
            <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
              {diary.content}
            </p>
          </div>

          {/* Linked Music Section */}
          {diary.primaryMusic && (
            <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <Music className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Linked Music
                </h3>
              </div>

              {diary.primaryMusic.status === 'pending' && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        Generating music...
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                        This usually takes 1-2 minutes
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {diary.primaryMusic.status === 'failed' && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Music generation failed
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Please try generating again
                  </p>
                </div>
              )}

              {diary.primaryMusic.status === 'ready' && diary.primaryMusic.audioUrl && (
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-6">
                  {/* Album Art */}
                  {diary.primaryMusic.imageUrl && (
                    <div className="aspect-square max-w-sm mx-auto mb-6 rounded-lg overflow-hidden shadow-lg">
                      <img
                        src={diary.primaryMusic.imageUrl}
                        alt={diary.primaryMusic.title || 'Album art'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Track Info */}
                  <div className="mb-4">
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      {diary.primaryMusic.title || 'Untitled'}
                    </h4>
                    {diary.primaryMusic.lyric && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                        "{diary.primaryMusic.lyric.substring(0, 100)}
                        {diary.primaryMusic.lyric.length > 100 ? '...' : ''}"
                      </p>
                    )}
                  </div>

                  {/* Music Player */}
                  <MusicPlayer
                    audioId={diary.primaryMusic._id}
                    audioUrl={diary.primaryMusic.audioUrl}
                    duration={formatDuration(diary.primaryMusic.duration)}
                    className="bg-white dark:bg-gray-800 rounded-lg p-4"
                  />

                  {/* Full Lyrics */}
                  {diary.primaryMusic.lyric && (
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                      <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                        Full Lyrics
                      </h5>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {diary.primaryMusic.lyric}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* No Music */}
          {!diary.primaryMusic && (
            <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
              <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <Music className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  No music generated for this entry yet
                </p>
                <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium">
                  Generate Music
                </button>
              </div>
            </div>
          )}

          {/* Metadata Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-4">
                <span>Created {formatDate(diary.date)}</span>
                <span>•</span>
                <span>Updated {formatDate(diary.updatedAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-3 h-3" />
                <span>Private</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
