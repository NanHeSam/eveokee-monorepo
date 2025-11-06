import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Music, Edit, Share2, Lock, FileText, Trash2, Loader2 } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from '@backend/convex';
import { DiaryEntry, FilterType } from '@/pages/NewDashboard';
import { Id } from '@backend/convex/convex/_generated/dataModel';
import MusicPlayer from '@/components/MusicPlayer';
import toast from 'react-hot-toast';

interface DetailDrawerProps {
  diaryId: Id<'diaries'>;
  diaries: DiaryEntry[];
  onClose: () => void;
  returnTab?: FilterType;
}

export default function DetailDrawer({ diaryId, diaries, onClose, returnTab }: DetailDrawerProps) {
  const navigate = useNavigate();
  const diary = diaries.find(d => d._id === diaryId);
  const [isGenerating, setIsGenerating] = useState(false);
  const deleteDiary = useMutation(api.diaries.deleteDiary);
  const createShareLink = useMutation(api.sharing.createShareLink);
  const startMusicGeneration = useMutation(api.music.startDiaryMusicGeneration);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Reset generating state when music status changes
  useEffect(() => {
    if (diary?.primaryMusic) {
      if (diary.primaryMusic.status === 'pending' || diary.primaryMusic.status === 'ready') {
        setIsGenerating(false);
      }
    }
  }, [diary?.primaryMusic?.status]);

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this memory entry? This will also delete any associated music. This action cannot be undone.')) {
      try {
        await deleteDiary({ diaryId });
        onClose();
      } catch (error) {
        console.error('Failed to delete diary:', error);
        alert('Failed to delete memory entry. Please try again.');
      }
    }
  };

  const handleEdit = () => {
    const tab = returnTab || 'songs';
    navigate(`/dashboard/memory/${diaryId}/edit?tab=${tab}`);
    onClose();
  };

  const handleShare = async () => {
    if (!diary?.primaryMusic?._id) {
      toast.error('No music available to share');
      return;
    }

    if (diary.primaryMusic.status !== 'ready') {
      toast.error('Music is not ready to be shared yet');
      return;
    }

    try {
      const { shareUrl } = await createShareLink({
        musicId: diary.primaryMusic._id,
      });

      // Try Web Share API first, fallback to clipboard
      if (navigator.share) {
        try {
          await navigator.share({
            title: diary.primaryMusic.title || 'Check out this music from eveokee',
            text: `Check out this music from eveokee: ${diary.primaryMusic.title || 'Untitled'}`,
            url: shareUrl,
          });
          toast.success('Shared!');
        } catch (error) {
          // User cancelled the share dialog - this is normal behavior
          if (error instanceof Error && error.name !== 'AbortError') {
            console.error('Error sharing:', error);
            // Fall through to clipboard fallback
            await navigator.clipboard.writeText(shareUrl);
            toast.success('Link copied to clipboard!');
          }
        }
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error creating share link:', error);
      toast.error('Failed to create share link. Please try again.');
    }
  };

  const handleGenerateMusic = async () => {
    if (!diary || isGenerating) return;

    setIsGenerating(true);
    try {
      const result = await startMusicGeneration({
        content: diary.content,
        diaryId: diary._id,
      });

      if (!result.success) {
        toast.error(result.reason || 'Failed to start music generation');
        setIsGenerating(false);
        return;
      }

      toast.success('Music generation started! This usually takes 1-2 minutes.');
      // Keep isGenerating true - the component will update when music status changes
      // The diary will refresh with new primaryMusic status via the query
    } catch (error) {
      console.error('Failed to start music generation:', error);
      toast.error('Failed to start music generation. Please try again.');
      setIsGenerating(false);
    }
  };

  const canShare = diary?.primaryMusic?.status === 'ready' && diary?.primaryMusic?._id;

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
            {diary.primaryMusic?.title || 'Music'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleEdit}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Edit"
            >
              <Edit className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={handleShare}
              disabled={!canShare}
              className={`p-2 rounded-lg transition-colors ${
                canShare
                  ? 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  : 'opacity-50 cursor-not-allowed'
              }`}
              title={canShare ? 'Share' : 'No music available to share'}
            >
              <Share2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={handleDelete}
              className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
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
          {/* Music Section - Top Priority */}
          {diary.primaryMusic && (
            <div className="mb-8">
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
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 mb-3">
                    Please try generating again
                  </p>
                  <button
                    onClick={handleGenerateMusic}
                    disabled={isGenerating}
                    className={`px-4 py-2 bg-purple-600 text-white rounded-lg transition-colors font-medium text-sm flex items-center gap-2 ${
                      isGenerating
                        ? 'opacity-75 cursor-not-allowed'
                        : 'hover:bg-purple-700'
                    }`}
                  >
                    {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isGenerating ? 'Generating...' : 'Retry Generation'}
                  </button>
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
                  </div>

                  {/* Music Player */}
                  <MusicPlayer
                    audioId={diary.primaryMusic._id}
                    audioUrl={diary.primaryMusic.audioUrl}
                    title={diary.primaryMusic.title}
                    imageUrl={diary.primaryMusic.imageUrl}
                    diaryContent={diary.content}
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
            <div className="mb-8">
              <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <Music className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  No music generated for this entry yet
                </p>
                <button
                  onClick={handleGenerateMusic}
                  disabled={isGenerating}
                  className={`px-4 py-2 bg-purple-600 text-white rounded-lg transition-colors font-medium flex items-center gap-2 mx-auto ${
                    isGenerating
                      ? 'opacity-75 cursor-not-allowed'
                      : 'hover:bg-purple-700'
                  }`}
                >
                  {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isGenerating ? 'Generating...' : 'Generate Music'}
                </button>
              </div>
            </div>
          )}

          {/* Journal Entry as Attachment */}
          <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Memory Entry
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatDate(diary.date)}
              </span>
            </div>

            {/* Content */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                  {diary.content}
                </p>
              </div>
            </div>
          </div>

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
