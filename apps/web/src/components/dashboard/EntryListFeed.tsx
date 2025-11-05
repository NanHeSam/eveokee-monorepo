import { useMemo } from 'react';
import { Calendar, Music, FileText, Globe, Lock, FileEdit } from 'lucide-react';
import { FilterType, DiaryEntry, MusicEntry } from '@/pages/NewDashboard';
import EntryListItem from './EntryListItem';
import { Id } from '@backend/convex/convex/_generated/dataModel';

interface EntryListFeedProps {
  diaries: DiaryEntry[];
  music: MusicEntry[];
  selectedFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  onOpenDiary: (diaryId: Id<'diaries'>) => void;
}

type CombinedEntry = {
  id: string;
  type: 'diary' | 'music';
  date: number;
  diary?: DiaryEntry;
  music?: MusicEntry;
};

export default function EntryListFeed({
  diaries,
  music,
  selectedFilter,
  onFilterChange,
  onOpenDiary,
}: EntryListFeedProps) {
  const filteredEntries = useMemo(() => {
    let combined: CombinedEntry[] = [];

    if (selectedFilter === 'journals') {
      combined = diaries.map(diary => ({
        id: `diary-${diary._id}`,
        type: 'diary' as const,
        date: diary.date,
        diary,
      }));
      return combined.sort((a, b) => b.date - a.date);
    }

    if (selectedFilter === 'all' || selectedFilter === 'songs') {
      combined = music.map(m => ({
        id: `music-${m._id}`,
        type: 'music' as const,
        date: m.diaryDate || m.createdAt,
        music: m,
      }));
      return combined.sort((a, b) => b.date - a.date);
    }

    if (selectedFilter === 'drafts') {
      return []; // No drafts for now
    }

    if (selectedFilter === 'public' || selectedFilter === 'private') {
      return []; // No visibility filtering for now
    }

    return combined.sort((a, b) => b.date - a.date);
  }, [diaries, music, selectedFilter]);

  const filters: { key: FilterType; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'All', icon: <FileText className="w-4 h-4" /> },
    { key: 'journals', label: 'Journals', icon: <Calendar className="w-4 h-4" /> },
    { key: 'songs', label: 'Songs', icon: <Music className="w-4 h-4" /> },
    { key: 'drafts', label: 'Drafts', icon: <FileEdit className="w-4 h-4" /> },
    { key: 'public', label: 'Public', icon: <Globe className="w-4 h-4" /> },
    { key: 'private', label: 'Private', icon: <Lock className="w-4 h-4" /> },
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
                  ? 'bg-purple-600 text-white'
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
              {selectedFilter === 'journals' && <Calendar className="w-8 h-8 text-gray-400" />}
              {selectedFilter === 'songs' && <Music className="w-8 h-8 text-gray-400" />}
              {selectedFilter !== 'journals' && selectedFilter !== 'songs' && <FileText className="w-8 h-8 text-gray-400" />}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No {selectedFilter === 'all' ? 'entries' : selectedFilter} yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Start documenting your thoughts and generate your first musical memory!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEntries.map(entry => (
              <EntryListItem
                key={entry.id}
                entry={entry}
                onOpenDiary={onOpenDiary}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
