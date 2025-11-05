import { useState } from 'react';
import { Calendar, Music, Play, Edit, Share2, Loader2 } from 'lucide-react';
import { useAudioManager } from '@/hooks/useAudioManager';
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
    };
  };
  onOpenDiary: (diaryId: Id<'diaries'>) => void;
}

export default function EntryListItem({ entry, onOpenDiary }: EntryListItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const audioManager = useAudioManager();

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

  const handleClick = () => {
    if (entry.type === 'diary' && entry.diary) {
      onOpenDiary(entry.diary._id);
    }
  };

  const handlePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    let audioUrl: string | undefined;
    let audioId: string | undefined;
    
    if (entry.type === 'diary' && entry.diary?.primaryMusic?.audioUrl) {
      audioUrl = entry.diary.primaryMusic.audioUrl;
      audioId = entry.diary.primaryMusic._id;
    } else if (entry.type === 'music' && entry.music?.audioUrl) {
      audioUrl = entry.music.audioUrl;
      audioId = entry.music._id;
    }
    
    if (audioUrl && audioId) {
      await audioManager.toggleAudio(audioId, audioUrl);
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

  const hasMusic = entry.type === 'diary' 
    ? entry.diary?.primaryMusic?.status === 'ready' && entry.diary?.primaryMusic?.audioUrl
    : entry.music?.status === 'ready' && entry.music?.audioUrl;

  const isPending = entry.type === 'diary'
    ? entry.diary?.primaryMusic?.status === 'pending'
    : entry.music?.status === 'pending';

  const displayContent = entry.type === 'diary'
    ? entry.diary?.content || ''
    : entry.music?.diaryContent || entry.music?.lyric || 'Untitled Song';

  const displayTitle = entry.type === 'diary'
    ? entry.diary?.title
    : entry.music?.title;

  const musicTitle = entry.type === 'diary'
    ? entry.diary?.primaryMusic?.title
    : entry.music?.title;

  const musicDuration = entry.type === 'diary'
    ? entry.diary?.primaryMusic?.duration
    : entry.music?.duration;

  return (
    <div
      className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all cursor-pointer group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      {/* Line 1: Date and Type Icon */}
      <div className="flex items-center gap-2 mb-2">
        <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {formatDate(entry.date)}
        </span>
        {entry.type === 'diary' && (
          <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
            Journal
          </span>
        )}
        {entry.type === 'music' && (
          <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
            Song
          </span>
        )}
        {isPending && (
          <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 rounded flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Generating
          </span>
        )}
      </div>

      {/* Line 2: Content Preview */}
      <div className="mb-2">
        {displayTitle && (
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
            {displayTitle}
          </h3>
        )}
        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
          {truncateText(displayContent)}
        </p>
      </div>

      {/* Line 3: Metadata and Music Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          {hasMusic && (
            <>
              <div className="flex items-center gap-1">
                <Music className="w-4 h-4" />
                <span>Linked: "{musicTitle || 'Untitled'}"</span>
              </div>
              <span className="text-xs">
                {formatDuration(musicDuration)}
              </span>
            </>
          )}
          {!hasMusic && !isPending && entry.type === 'diary' && (
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
