import { useUser } from '@clerk/clerk-react';
import { 
  LayoutDashboard, 
  Settings, 
  Calendar,
  Music,
  Phone,
  TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useUser();

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={<Phone className="h-6 w-6" />}
          title="Total Calls"
          value={0}
          subtitle="This month"
          color="bg-blue-500"
        />
        <StatCard
          icon={<Music className="h-6 w-6" />}
          title="Songs Generated"
          value={0}
          subtitle="All time"
          color="bg-purple-500"
        />
        <StatCard
          icon={<Calendar className="h-6 w-6" />}
          title="Diary Entries"
          value={0}
          subtitle="Total entries"
          color="bg-green-500"
        />
        <StatCard
          icon={<TrendingUp className="h-6 w-6" />}
          title="Active Days"
          value={0}
          subtitle="This month"
          color="bg-orange-500"
        />
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <QuickActionCard
            icon={<Settings className="h-8 w-8" />}
            title="Call Settings"
            description="Configure your daily check-in calls"
            to="/dashboard/call-settings"
            color="text-accent-mint"
          />
          <QuickActionCard
            icon={<LayoutDashboard className="h-8 w-8" />}
            title="View Diary"
            description="Browse your diary entries and songs"
            to="/"
            color="text-purple-500"
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Recent Activity
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <p className="text-gray-600 dark:text-gray-400 text-center py-8">
            No recent activity to show. Start by configuring your call settings!
          </p>
        </div>
      </div>
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

interface QuickActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  to: string;
  color: string;
}

function QuickActionCard({ icon, title, description, to, color }: QuickActionCardProps) {
  return (
    <Link
      to={to}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
    >
      <div className={`${color} mb-4`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm">
        {description}
      </p>
    </Link>
  );
}

