import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';

interface LayoutRouteProps {
  className?: string;
}

export default function LayoutRoute({ className = '' }: LayoutRouteProps) {
  return (
    <div className={`min-h-screen ${className}`}>
      <Navigation />
      <Outlet />
    </div>
  );
}
