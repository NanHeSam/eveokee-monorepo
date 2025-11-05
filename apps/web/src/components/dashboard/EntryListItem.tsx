import { useState } from 'react';
import { Calendar, Music, Play, Pause, Edit, Share2, Loader2, BookOpen } from 'lucide-react';
import { useAudio } from '@/contexts/AudioContext';
import { Id } from '@backend/convex/convex/_generated/dataModel';

interface EntryListItemProps {
  entry: {
    id: string;
    type: 'diary' | 'music';
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
  };
  onOpenDiary: (diaryId: Id<'diaries'>) => void;
}

export default function EntryListItem({ entry, onOpenDiary }: EntryListItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const audioManager = useAudio();

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
      console.log('Edit clicked');
    };

    const handleShare = (e: React.MouseEvent) => {
      e.stopPropagation();
      console.log('Share clicked');
    };

    return (
      <div
        className={`relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all group ${isReady ? 'cursor-pointer' : 'cursor-default'}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleRowClick}
      >
        <div className="flex items-center gap-4">
          {/* Image Thumbnail */}
          <div className="flex-shrink-0">
            {music.imageUrl ? (
              <img
                src={music.imageUrl}
                alt={music.title || 'Album art'}
                className="w-14 h-14 rounded-lg object-cover"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                <Music className="w-6 h-6 text-white" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Line 1: Song Title and Status */}
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                {music.title || 'Untitled Song'}
              </h3>
              {isPending && (
                <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded flex items-center gap-1 flex-shrink-0">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Generating
                </span>
              )}
              {hasDiary && (
                <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded flex-shrink-0">
                  From journal
                </span>
              )}
              {!hasDiary && isReady && (
                <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded flex-shrink-0">
                  No journal
                </span>
              )}
            </div>

            {/* Line 2: Diary Content Preview (if exists) */}
            {music.diaryContent && (
              <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-1 mb-1">
                {truncateText(music.diaryContent, 100)}
              </p>
            )}

            {/* Line 3: Metadata */}
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(entry.date)}</span>
              </div>
              {music.duration && (
                <span>{formatDuration(music.duration)}</span>
              )}
            </div>
          </div>

          {/* Hover Actions */}
          {isHovered && isReady && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleRowClick}
                className="p-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors"
                title={isCurrentlyPlaying ? 'Pause' : 'Play'}
              >
                {isCurrentlyPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>
              {hasDiary && (
                <button
                  onClick={handleViewJournal}
                  className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                  title="View Journal"
                >
                  <BookOpen className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleEdit}
                className="p-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                title="Edit"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={handleShare}
                className="p-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                title="Share"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          )}
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
      console.log('Edit clicked');
    };

    const handleShare = (e: React.MouseEvent) => {
      e.stopPropagation();
      console.log('Share clicked');
    };

    return (
      <div
        className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all cursor-pointer group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
      >
        {/* Line 1: Date and Status */}
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {formatDate(entry.date)}
          </span>
          <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
            Journal
          </span>
          {isPending && (
            <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Generating
            </span>
          )}
        </div>

        {/* Line 2: Content Preview */}
        <div className="mb-2">
          {diary.title && (
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
              {diary.title}
            </h3>
          )}
          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
            {truncateText(diary.content)}
          </p>
        </div>

        {/* Line 3: Metadata and Music Info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            {hasMusic && diary.primaryMusic && (
              <>
                <div className="flex items-center gap-1">
                  <Music className="w-4 h-4" />
                  <span>Linked: "{diary.primaryMusic.title || 'Untitled'}"</span>
                </div>
                <span className="text-xs">
                  {formatDuration(diary.primaryMusic.duration)}
                </span>
              </>
            )}
            {!hasMusic && !isPending && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                No music generated
              </span>
            )}
          </div>

          {/* Hover Actions */}
          {isHovered && (
            <div className="flex items-center gap-2">
              {hasMusic && (
                <button
                  onClick={handlePlay}
                  className="p-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors"
                  title="Play"
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleEdit}
                className="p-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                title="Edit"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={handleShare}
                className="p-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                title="Share"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
