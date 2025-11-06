import { useNavigate, useSearchParams } from 'react-router-dom';
import { Music, Play, Pause, Edit, Share2, Loader2, BookOpen, Trash2, EyeOff } from 'lucide-react';
import { useMutation } from 'convex/react';
import { api } from '@backend/convex';
import { useAudio } from '@/contexts/AudioContext';
import { Id } from '@backend/convex/convex/_generated/dataModel';
import { FilterType } from '@/pages/NewDashboard';
import toast from 'react-hot-toast';

interface EntryListItemProps {
  entry: {
    id: string;
    type: 'diary' | 'music' | 'shared';
    date: number;
    diary?: {
      _id: Id<'diaries'>;
      content: string;
      title?: string;
      primaryMusic?: {
        _id: Id<'music'>;
        title?: string;
        audioUrl?: string;
        duration?: number;
        status: 'pending' | 'ready' | 'failed';
      };
    };
    music?: {
      _id: Id<'music'>;
      title?: string;
      audioUrl?: string;
      duration?: number;
      lyric?: string;
      status: 'pending' | 'ready' | 'failed';
      diaryContent?: string;
      diaryId?: Id<'diaries'>;
      imageUrl?: string;
    };
    shared?: {
      _id: Id<'sharedMusic'>;
      musicId: Id<'music'>;
      shareId: string;
      viewCount: number;
      isPrivate?: boolean;
      createdAt: number;
      updatedAt: number;
      music: {
        _id: Id<'music'>;
        title?: string;
        imageUrl?: string;
        audioUrl?: string;
        duration?: number;
        lyric?: string;
        status: 'pending' | 'ready' | 'failed';
        createdAt: number;
        diaryId?: Id<'diaries'>;
        diaryContent?: string;
        diaryDate?: number;
      };
    };
  };
  onOpenDiary: (diaryId: Id<'diaries'>) => void;
}

export default function EntryListItem({ entry, onOpenDiary }: EntryListItemProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const audioManager = useAudio();
  const deleteMusic = useMutation(api.music.softDeleteMusic);
  const deleteDiary = useMutation(api.diaries.deleteDiary);
  const toggleSharePrivacy = useMutation(api.sharing.toggleSharePrivacy);
  const createShareLink = useMutation(api.sharing.createShareLink);
  
  // Get current tab from URL to preserve it when navigating
  const currentTab = (searchParams.get('tab') as FilterType) || 'songs';

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
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

  const truncateText = (text: string, maxLength: number = 120) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (entry.type === 'music' && entry.music) {
    const music = entry.music;
    const isReady = music.status === 'ready' && music.audioUrl;
    const isPending = music.status === 'pending';
    const isCurrentlyPlaying = audioManager.isCurrentAudio(music._id) && audioManager.isPlaying;
    const hasDiary = !!music.diaryId && !!music.diaryContent;

    const handleRowClick = async () => {
      if (isReady && music.audioUrl) {
        audioManager.setCurrentTrack({
          id: music._id,
          title: music.title || 'Untitled Song',
          imageUrl: music.imageUrl,
          duration: music.duration,
          diaryContent: music.diaryContent,
          audioUrl: music.audioUrl,
        });
        await audioManager.toggleAudio(music._id, music.audioUrl);
      }
    };

    const handleViewJournal = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (music.diaryId) {
        onOpenDiary(music.diaryId);
      }
    };

    const handleEdit = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (music.diaryId) {
        navigate(`/dashboard/memory/${music.diaryId}/edit?tab=${currentTab}`);
      }
    };

    const handleShare = async (e: React.MouseEvent) => {
      e.stopPropagation();
      
      if (!music._id) {
        toast.error('No music available to share');
        return;
      }

      if (music.status !== 'ready') {
        toast.error('Music is not ready to be shared yet');
        return;
      }

      try {
        const { shareUrl } = await createShareLink({
          musicId: music._id,
        });

        // Try Web Share API first, fallback to clipboard
        if (navigator.share) {
          try {
            await navigator.share({
              title: music.title || 'Check out this music from eveokee',
              text: `Check out this music from eveokee: ${music.title || 'Untitled'}`,
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

    const handleDelete = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm('Are you sure you want to delete this song? This action cannot be undone.')) {
        try {
          await deleteMusic({ musicId: music._id });
        } catch (error) {
          console.error('Failed to delete music:', error);
          alert('Failed to delete song. Please try again.');
        }
      }
    };

    return (
      <div
        className={`relative group pt-6 pb-6 border-b border-gray-200 dark:border-gray-700 ${isReady ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex gap-4">
          {/* Thumbnail */}
          <div className="flex-shrink-0 relative group/thumbnail">
            {music.imageUrl ? (
              <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                <img
                  src={music.imageUrl}
                  alt={music.title || 'Album art'}
                  className="w-full h-full object-cover"
                />
                {isReady && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRowClick();
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover/thumbnail:opacity-100 transition-opacity"
                    title={isCurrentlyPlaying ? 'Pause' : 'Play'}
                  >
                    {isCurrentlyPlaying ? (
                      <Pause className="w-6 h-6 text-white" />
                    ) : (
                      <Play className="w-6 h-6 text-white ml-0.5" />
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="relative w-20 h-20 rounded-lg bg-gradient-to-br from-accent-mint to-accent-apricot flex items-center justify-center">
                <Music className="w-8 h-8 text-white" />
                {isReady && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRowClick();
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover/thumbnail:opacity-100 transition-opacity"
                    title={isCurrentlyPlaying ? 'Pause' : 'Play'}
                  >
                    {isCurrentlyPlaying ? (
                      <Pause className="w-6 h-6 text-white" />
                    ) : (
                      <Play className="w-6 h-6 text-white ml-0.5" />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <button
              onClick={handleRowClick}
              className="w-full text-left"
              disabled={!isReady}
            >
              <h4 className={`text-lg font-bold leading-tight mb-2 ${
                isCurrentlyPlaying
                  ? 'text-accent-mint'
                  : 'text-gray-900 dark:text-white'
              }`}>
                {music.title || 'Untitled Song'}
              </h4>
            </button>

            {/* Description */}
            {music.diaryContent && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed line-clamp-2">
                {truncateText(music.diaryContent, 120)}
              </p>
            )}

            {/* Status Badge */}
            {(isPending || hasDiary || (!hasDiary && isReady)) && (
              <div className="flex items-center gap-2 mb-3">
                {isPending && (
                  <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Generating
                  </span>
                )}
                {!hasDiary && isReady && (
                  <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                    No journal
                  </span>
                )}
              </div>
            )}

            {/* Metadata Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span>{formatDate(entry.date)}</span>
                {music.duration && (
                  <span>{formatDuration(music.duration)}</span>
                )}
                {isCurrentlyPlaying && (
                  <span className="flex items-center gap-1">
                    {audioManager.isPlaying ? (
                      <>
                        <Pause className="w-3 h-3" />
                        <span>Playing</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3" />
                        <span>Paused</span>
                      </>
                    )}
                  </span>
                )}
              </div>

              {/* Action Icons */}
              <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                {hasDiary && (
                  <button
                    onClick={handleViewJournal}
                    className="p-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    title="View Journal"
                  >
                    <BookOpen className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleEdit}
                  className="p-1 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={handleShare}
                  className="p-1 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                  title="Share"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-1 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (entry.type === 'diary' && entry.diary) {
    const diary = entry.diary;
    const hasMusic = diary.primaryMusic?.status === 'ready' && diary.primaryMusic?.audioUrl;
    const isPending = diary.primaryMusic?.status === 'pending';

    const handleClick = () => {
      onOpenDiary(diary._id);
    };

    const handlePlay = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (hasMusic && diary.primaryMusic?.audioUrl) {
        audioManager.setCurrentTrack({
          id: diary.primaryMusic._id,
          title: diary.primaryMusic.title || 'Untitled Song',
          imageUrl: undefined,
          duration: diary.primaryMusic.duration,
          diaryContent: diary.content,
          audioUrl: diary.primaryMusic.audioUrl,
        });
        await audioManager.toggleAudio(diary.primaryMusic._id, diary.primaryMusic.audioUrl);
      }
    };

    const handleEdit = (e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(`/dashboard/memory/${diary._id}/edit?tab=${currentTab}`);
    };

    const handleDelete = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm('Are you sure you want to delete this memory entry? This will also delete any associated music. This action cannot be undone.')) {
        try {
          await deleteDiary({ diaryId: diary._id });
        } catch (error) {
          console.error('Failed to delete diary:', error);
          alert('Failed to delete memory entry. Please try again.');
        }
      }
    };

    return (
      <div
        className="relative group cursor-pointer pt-6 pb-6 border-b border-gray-200 dark:border-gray-700"
      >
        {/* Title */}
        <button
          onClick={handleClick}
          className="w-full text-left"
        >
          <h4 className="text-lg font-bold leading-tight mb-2 text-gray-900 dark:text-white">
            {diary.title || formatDate(entry.date)}
          </h4>
        </button>

        {/* Description */}
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed line-clamp-2">
          {truncateText(diary.content, 120)}
        </p>

        {/* Status Badge */}
        <div className="flex items-center gap-2 mb-3">
          {isPending && (
            <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Generating
            </span>
          )}
        </div>

        {/* Metadata Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>{formatDate(entry.date)}</span>
            {hasMusic && diary.primaryMusic && (
              <>
                <span className="flex items-center gap-1">
                  <Music className="w-3 h-3" />
                  <span>{diary.primaryMusic.title || 'Untitled'}</span>
                </span>
                <span>{formatDuration(diary.primaryMusic.duration)}</span>
              </>
            )}
            {!hasMusic && !isPending && (
              <span>No music generated</span>
            )}
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
            {hasMusic && (
              <button
                onClick={handlePlay}
                className="p-1 hover:text-accent-mint transition-colors"
                title="Play"
              >
                <Play className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleEdit}
              className="p-1 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </button>

            <button
              onClick={handleDelete}
              className="p-1 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (entry.type === 'shared' && entry.shared && entry.music) {
    const shared = entry.shared;
    const music = entry.music;
    const isReady = music.status === 'ready' && music.audioUrl;
    const isPending = music.status === 'pending';
    const isCurrentlyPlaying = audioManager.isCurrentAudio(music._id) && audioManager.isPlaying;
    const hasDiary = !!music.diaryId && !!music.diaryContent;
    const isPrivate = shared.isPrivate ?? false;

    const handleRowClick = async () => {
      if (isReady && music.audioUrl) {
        audioManager.setCurrentTrack({
          id: music._id,
          title: music.title || 'Untitled Song',
          imageUrl: music.imageUrl,
          duration: music.duration,
          diaryContent: music.diaryContent,
          audioUrl: music.audioUrl,
        });
        await audioManager.toggleAudio(music._id, music.audioUrl);
      }
    };

    const handleTogglePrivacy = async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await toggleSharePrivacy({ sharedMusicId: shared._id });
      } catch (error) {
        console.error('Failed to toggle share privacy:', error);
        alert('Failed to update share status. Please try again.');
      }
    };

    return (
      <div
        className={`relative group pt-6 pb-6 border-b border-gray-200 dark:border-gray-700 ${isReady ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex gap-4">
          {/* Thumbnail */}
          <div className="flex-shrink-0 relative group/thumbnail">
            {music.imageUrl ? (
              <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                <img
                  src={music.imageUrl}
                  alt={music.title || 'Album art'}
                  className="w-full h-full object-cover"
                />
                {isReady && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRowClick();
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover/thumbnail:opacity-100 transition-opacity"
                    title={isCurrentlyPlaying ? 'Pause' : 'Play'}
                  >
                    {isCurrentlyPlaying ? (
                      <Pause className="w-6 h-6 text-white" />
                    ) : (
                      <Play className="w-6 h-6 text-white ml-0.5" />
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="relative w-20 h-20 rounded-lg bg-gradient-to-br from-accent-mint to-accent-apricot flex items-center justify-center">
                <Music className="w-8 h-8 text-white" />
                {isReady && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRowClick();
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover/thumbnail:opacity-100 transition-opacity"
                    title={isCurrentlyPlaying ? 'Pause' : 'Play'}
                  >
                    {isCurrentlyPlaying ? (
                      <Pause className="w-6 h-6 text-white" />
                    ) : (
                      <Play className="w-6 h-6 text-white ml-0.5" />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => navigate(`/share/${shared.shareId}`)}
                className="text-left flex-1"
              >
                <h4 className={`text-lg font-bold leading-tight ${
                  isCurrentlyPlaying
                    ? 'text-accent-mint'
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {music.title || 'Untitled Song'}
                </h4>
              </button>
              {/* Privacy Icon */}
              <button
                onClick={handleTogglePrivacy}
                className="p-1 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                title={isPrivate ? 'Unshare (Make public)' : 'Share (Currently public)'}
              >
                {isPrivate ? (
                  <EyeOff className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                ) : (
                  <Share2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                )}
              </button>
            </div>

            {/* Description */}
            {music.diaryContent && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed line-clamp-2">
                {truncateText(music.diaryContent, 120)}
              </p>
            )}

            {/* Status Badge */}
            {(isPending || hasDiary || (!hasDiary && isReady)) && (
              <div className="flex items-center gap-2 mb-3">
                {isPending && (
                  <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Generating
                  </span>
                )}
                {isPrivate && (
                  <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded flex items-center gap-1">
                    <EyeOff className="w-3 h-3" />
                    Private
                  </span>
                )}
                {!hasDiary && isReady && !isPrivate && (
                  <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                    No journal
                  </span>
                )}
              </div>
            )}

            {/* Metadata Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span>{formatDate(entry.date)}</span>
                {music.duration && (
                  <span>{formatDuration(music.duration)}</span>
                )}
                <span>{shared.viewCount} {shared.viewCount === 1 ? 'view' : 'views'}</span>
                {isCurrentlyPlaying && (
                  <span className="flex items-center gap-1">
                    {audioManager.isPlaying ? (
                      <>
                        <Pause className="w-3 h-3" />
                        <span>Playing</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3" />
                        <span>Paused</span>
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
