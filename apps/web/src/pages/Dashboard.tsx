import { useUser } from '@clerk/clerk-react';
import { useQuery } from 'convex/react';
import { api } from '@backend/convex';
import {
  Calendar,
  Music,
  Phone,
  TrendingUp,
} from 'lucide-react';
import ConvexQueryBoundary from '@/components/ConvexQueryBoundary';
import { MusicList } from '@/components/MusicList';

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

        {/* Music Library Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Your Music
          </h2>
          <MusicList />
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
