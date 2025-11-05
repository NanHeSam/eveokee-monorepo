import { useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useQuery } from 'convex/react';
import { api } from '@backend/convex';
import ConvexQueryBoundary from '@/components/ConvexQueryBoundary';
import EntryListFeed from '@/components/dashboard/EntryListFeed';
import DetailDrawer from '@/components/dashboard/DetailDrawer';
import { Id } from '@backend/convex/convex/_generated/dataModel';

export type FilterType = 'all' | 'journals' | 'songs' | 'drafts' | 'public' | 'private';

export interface DiaryEntry {
  _id: Id<'diaries'>;
  content: string;
  date: number;
  title?: string;
  updatedAt: number;
  primaryMusic?: {
    _id: Id<'music'>;
    title?: string;
    imageUrl?: string;
    audioUrl?: string;
    duration?: number;
    lyric?: string;
    status: 'pending' | 'ready' | 'failed';
  };
}

export interface MusicEntry {
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
}

export default function NewDashboard() {
  const { user } = useUser();
  const diaries = useQuery(api.diaries.listDiaries);
  const music = useQuery(api.music.listPlaylistMusic);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [selectedDiaryId, setSelectedDiaryId] = useState<Id<'diaries'> | null>(null);

  const handleCloseDrawer = () => {
    setSelectedDiaryId(null);
  };

  const handleOpenDiary = (diaryId: Id<'diaries'>) => {
    setSelectedDiaryId(diaryId);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.firstName || 'there'}! 👋
          </h1>
          <div className="flex items-center gap-4">
            <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium">
              + New
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <ConvexQueryBoundary queries={[{ data: diaries }, { data: music }]}>
          {/* Full Width Feed */}
          <div className="h-full overflow-auto">
            <EntryListFeed
              diaries={diaries || []}
              music={music || []}
              selectedFilter={selectedFilter}
              onFilterChange={setSelectedFilter}
              onOpenDiary={handleOpenDiary}
            />
          </div>
        </ConvexQueryBoundary>
      </div>

      {/* Detail Drawer */}
      {selectedDiaryId && (
        <DetailDrawer
          diaryId={selectedDiaryId}
          diaries={diaries || []}
          onClose={handleCloseDrawer}
        />
      )}
    </div>
  );
}
