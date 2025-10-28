import { Outlet } from 'react-router-dom';
import DashboardNavigation from './DashboardNavigation';
import Footer from './Footer';
import ProtectedRoute from './ProtectedRoute';

export default function DashboardLayout() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <DashboardNavigation />
        <div className="flex-1">
          <Outlet />
        </div>
        <Footer />
      </div>
    </ProtectedRoute>
  );
}

