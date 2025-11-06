import { useMemo } from 'react';
import { Calendar, Music, Share2 } from 'lucide-react';
import { FilterType, DiaryEntry, MusicEntry } from '@/pages/NewDashboard';
import EntryListItem from './EntryListItem';
import { Id } from '@backend/convex/convex/_generated/dataModel';

type SharedMusicEntry = {
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

interface EntryListFeedProps {
  diaries: DiaryEntry[];
  music: MusicEntry[];
  sharedMusic: SharedMusicEntry[];
  selectedFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  onOpenDiary: (diaryId: Id<'diaries'>) => void;
}

type CombinedEntry = {
  id: string;
  type: 'diary' | 'music' | 'shared';
  date: number;
  diary?: DiaryEntry;
  music?: MusicEntry;
  shared?: SharedMusicEntry;
};

export default function EntryListFeed({
  diaries,
  music,
  sharedMusic,
  selectedFilter,
  onFilterChange,
  onOpenDiary,
}: EntryListFeedProps) {
  const filteredEntries = useMemo(() => {
    let combined: CombinedEntry[] = [];

    if (selectedFilter === 'memories') {
      combined = diaries.map(diary => ({
        id: `diary-${diary._id}`,
        type: 'diary' as const,
        date: diary.date,
        diary,
      }));
      return combined.sort((a, b) => b.date - a.date);
    }

    if (selectedFilter === 'songs') {
      combined = music.map(m => ({
        id: `music-${m._id}`,
        type: 'music' as const,
        date: m.diaryDate || m.createdAt,
        music: m,
      }));
      return combined.sort((a, b) => b.date - a.date);
    }

    if (selectedFilter === 'shared') {
      combined = sharedMusic.map(sm => ({
        id: `shared-${sm._id}`,
        type: 'shared' as const,
        date: sm.music.diaryDate || sm.music.createdAt,
        shared: sm,
        music: {
          _id: sm.music._id,
          title: sm.music.title,
          imageUrl: sm.music.imageUrl,
          audioUrl: sm.music.audioUrl,
          duration: sm.music.duration,
          lyric: sm.music.lyric,
          status: sm.music.status,
          createdAt: sm.music.createdAt,
          diaryContent: sm.music.diaryContent,
          diaryId: sm.music.diaryId,
        },
      }));
      return combined.sort((a, b) => b.date - a.date);
    }

    return combined.sort((a, b) => b.date - a.date);
  }, [diaries, music, sharedMusic, selectedFilter]);

  const filters: { key: FilterType; label: string; icon: React.ReactNode }[] = [
    { key: 'songs', label: 'Songs', icon: <Music className="w-4 h-4" /> },
    { key: 'memories', label: 'Memories', icon: <Calendar className="w-4 h-4" /> },
    { key: 'shared', label: 'Shared', icon: <Share2 className="w-4 h-4" /> },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Filter Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex gap-2 overflow-x-auto">
          {filters.map(filter => (
            <button
              key={filter.key}
              onClick={() => onFilterChange(filter.key)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap
                ${selectedFilter === filter.key
                  ? 'bg-accent-mint text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }
              `}
            >
              {filter.icon}
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Entry List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              {selectedFilter === 'memories' && <Calendar className="w-8 h-8 text-gray-400" />}
              {selectedFilter === 'songs' && <Music className="w-8 h-8 text-gray-400" />}
              {selectedFilter === 'shared' && <Share2 className="w-8 h-8 text-gray-400" />}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No {selectedFilter === 'memories' ? 'memories' : selectedFilter === 'shared' ? 'shared music' : selectedFilter} yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Start documenting your thoughts and generate your first musical memory!
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {filteredEntries.map((entry, index) => (
              <div key={entry.id} className={index > 0 ? 'pt-6' : ''}>
                <EntryListItem
                  entry={entry}
                  onOpenDiary={onOpenDiary}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
