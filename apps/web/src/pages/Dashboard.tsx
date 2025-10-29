import { useUser } from '@clerk/clerk-react';
import { useQuery } from 'convex/react';
import { api } from '@backend/convex';
import {
  Calendar,
  Music,
  Phone,
  TrendingUp,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import ConvexQueryBoundary from '@/components/ConvexQueryBoundary';
import MusicPlayer from '@/components/MusicPlayer';
import { useState, useRef, useEffect } from 'react';

/**
 * Render the dashboard page that displays a personalized welcome, key statistics, and diary entries.
 *
 * Uses the current user's profile and fetched diary and dashboard statistics to populate:
 * - a welcome header that greets by the user's first name when available,
 * - a stats overview with total calls, songs generated, diary entries, and active days,
 * - a diary entries section that shows either an empty-state or a horizontal carousel of diaries.
 *
 * @returns The dashboard page as a JSX element.
 */
export default function Dashboard() {
  const { user } = useUser();
  const diaries = useQuery(api.diaries.listDiaries);
  const dashboardStats = useQuery(api.callJobs.getDashboardStats);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome back, {user?.firstName || 'there'}! 👋
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Here's what's happening with your account today.
        </p>
      </div>

      {/* Stats Overview */}
      <ConvexQueryBoundary queries={[{ data: diaries }, { data: dashboardStats }]}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<Phone className="h-6 w-6" />}
            title="Total Calls"
            value={dashboardStats?.totalCalls || 0}
            subtitle="All time"
            color="bg-blue-500"
          />
          <StatCard
            icon={<Music className="h-6 w-6" />}
            title="Songs Generated"
            value={diaries?.filter(d => d.primaryMusic?.status === 'ready').length || 0}
            subtitle="All time"
            color="bg-purple-500"
          />
          <StatCard
            icon={<Calendar className="h-6 w-6" />}
            title="Diary Entries"
            value={diaries?.length || 0}
            subtitle="Total entries"
            color="bg-green-500"
          />
          <StatCard
            icon={<TrendingUp className="h-6 w-6" />}
            title="Active Days"
            value={dashboardStats?.activeDaysThisMonth || 0}
            subtitle="This month"
            color="bg-orange-500"
          />
        </div>

        {/* Diary Entries Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Your Diary Entries
          </h2>
          {diaries && diaries.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No diary entries yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Start documenting your thoughts and generate your first musical memory!
              </p>
            </div>
          ) : (
            <DiaryCarousel diaries={diaries || []} />
          )}
        </div>
      </ConvexQueryBoundary>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: number;
  subtitle: string;
  color: string;
}

/**
 * Renders a statistic card with an icon badge, title, numeric value, and subtitle.
 *
 * @param icon - Icon or visual element displayed inside the colored badge
 * @param title - Short label shown above the value
 * @param value - Primary numeric value displayed prominently
 * @param subtitle - Secondary descriptive text shown below the value
 * @param color - Tailwind CSS color classes applied to the icon badge container
 * @returns The rendered stat card JSX element
 */
function StatCard({ icon, title, value, subtitle, color }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`${color} text-white p-3 rounded-lg`}>
          {icon}
        </div>
      </div>
      <h3 className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-1">
        {title}
      </h3>
      <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
        {value}
      </p>
      <p className="text-gray-500 dark:text-gray-500 text-xs">
        {subtitle}
      </p>
    </div>
  );
}

interface DiaryCarouselProps {
  diaries: Array<{
    _id: string;
    content: string;
    date: number;
    primaryMusic?: {
      _id: string;
      title?: string;
      imageUrl?: string;
      audioUrl?: string;
      duration?: number;
      lyric?: string;
      status: 'pending' | 'ready' | 'failed';
    };
  }>;
}

/**
 * Render a horizontal, scrollable carousel of diary entries with optional left/right scroll controls.
 *
 * @param diaries - Array of diary objects to display; each item is rendered as a DiaryCard inside the carousel.
 * @returns A JSX element containing the horizontal carousel of diary cards and conditional left/right scroll buttons.
 */
function DiaryCarousel({ diaries }: DiaryCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    const checkScrollability = () => {
      if (!scrollContainerRef.current) return;
      
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    };

    checkScrollability();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollability);
      window.addEventListener('resize', checkScrollability);
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', checkScrollability);
      }
      window.removeEventListener('resize', checkScrollability);
    };
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    
    const scrollAmount = 400;
    const { scrollLeft } = scrollContainerRef.current;
    const newScrollLeft = direction === 'left' 
      ? scrollLeft - scrollAmount 
      : scrollLeft + scrollAmount;
    
    scrollContainerRef.current.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    });
  };

  return (
    <div className="relative">
      {/* Scroll buttons */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 p-2 rounded-full shadow-lg hover:shadow-xl transition-shadow"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-6 h-6 text-gray-900 dark:text-white" />
        </button>
      )}

      {/* Carousel container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 px-1 snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {diaries.map((diary) => (
          <div
            key={diary._id}
            className="flex-shrink-0 w-[350px] snap-start"
          >
            <DiaryCard diary={diary} />
          </div>
        ))}
      </div>

      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 p-2 rounded-full shadow-lg hover:shadow-xl transition-shadow"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-6 h-6 text-gray-900 dark:text-white" />
        </button>
      )}
    </div>
  );
}

interface DiaryCardProps {
  diary: {
    _id: string;
    content: string;
    date: number;
    primaryMusic?: {
      _id: string;
      title?: string;
      imageUrl?: string;
      audioUrl?: string;
      duration?: number;
      lyric?: string;
      status: 'pending' | 'ready' | 'failed';
    };
  };
}

/**
 * Renders a diary entry card showing the entry date, truncated content, optional music artwork or pending loader, and a linked music player when audio is ready.
 *
 * @param diary - The diary entry to display. May include an optional `primaryMusic` object with fields such as `imageUrl`, `audioUrl`, `title`, `duration`, `_id`, and `status`.
 * @returns The JSX element for the diary card.
 */
function DiaryCard({ diary }: DiaryCardProps) {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      {/* Music Image if available */}
      {diary.primaryMusic?.imageUrl ? (
        <div className="aspect-video bg-gradient-to-br from-purple-400 to-pink-400 overflow-hidden">
          <img
            src={diary.primaryMusic.imageUrl}
            alt={diary.primaryMusic.title || 'Diary music'}
            className="w-full h-full object-cover"
          />
        </div>
      ) : diary.primaryMusic?.status === 'pending' ? (
        <div className="aspect-video bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-gray-400 animate-spin" />
        </div>
      ) : null}

      {/* Content */}
      <div className="p-6">
        {/* Date */}
        <div className="mb-4 flex items-center text-sm text-gray-500 dark:text-gray-400">
          <Calendar className="w-4 h-4 mr-2" />
          {formatDate(diary.date)}
        </div>

        {/* Diary Content */}
        <p className="text-gray-800 dark:text-gray-200 mb-4 line-clamp-4">
          {truncateContent(diary.content)}
        </p>

        {/* Music Section */}
        {diary.primaryMusic?.audioUrl && diary.primaryMusic?.status === 'ready' && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-3 text-sm text-gray-600 dark:text-gray-400">
              <Music className="w-4 h-4 mr-2" />
              <span className="font-medium">Linked Music</span>
            </div>
            {diary.primaryMusic.title && (
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                {diary.primaryMusic.title}
              </h4>
            )}
            <MusicPlayer
              audioId={diary.primaryMusic._id}
              audioUrl={diary.primaryMusic.audioUrl}
              duration={formatDuration(diary.primaryMusic.duration)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
