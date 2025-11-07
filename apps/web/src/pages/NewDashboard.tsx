import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useQuery } from 'convex/react';
import { api } from '@backend/convex';
import ConvexQueryBoundary from '@/components/ConvexQueryBoundary';
import EntryListFeed from '@/components/dashboard/EntryListFeed';
import DetailDrawer from '@/components/dashboard/DetailDrawer';
import { Id } from '@backend/convex/convex/_generated/dataModel';

export type FilterType = 'songs' | 'memories' | 'shared';

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
  audioId?: string;
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useUser();
  const diaries = useQuery(api.diaries.listDiaries);
  const music = useQuery(api.music.listPlaylistMusic);
  const sharedMusic = useQuery(api.sharing.listSharedMusic);
  
  // Derive selectedFilter directly from URL (single source of truth)
  const tabFromUrl = searchParams.get('tab') as FilterType | null;
  const selectedFilter: FilterType = (tabFromUrl === 'songs' || tabFromUrl === 'memories' || tabFromUrl === 'shared') ? tabFromUrl : 'songs';
  const [selectedDiaryId, setSelectedDiaryId] = useState<Id<'diaries'> | null>(null);

  // Handler to update filter - updates URL directly
  const handleFilterChange = (filter: FilterType) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', filter);
    setSearchParams(newParams, { replace: true });
  };

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
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.firstName || 'there'}! 👋
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/dashboard/memory/new?tab=${selectedFilter}`)}
              className="px-4 py-2 bg-accent-mint text-white rounded-lg hover:bg-accent-mint/90 transition-colors font-medium"
            >
              + New
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        <ConvexQueryBoundary queries={[{ data: diaries }, { data: music }, { data: sharedMusic }]}>
          {/* Full Width Feed */}
          <div className="h-full overflow-auto">
            <EntryListFeed
              diaries={diaries || []}
              music={music || []}
              sharedMusic={sharedMusic || []}
              selectedFilter={selectedFilter}
              onFilterChange={handleFilterChange}
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
          returnTab={selectedFilter}
        />
      )}
    </div>
  );
}
