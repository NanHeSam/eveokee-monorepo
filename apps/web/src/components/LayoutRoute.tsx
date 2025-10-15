import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';
import Footer from './Footer';

interface LayoutRouteProps {
  className?: string;
}

export default function LayoutRoute({ className = '' }: LayoutRouteProps) {
  return (
    <div className={`min-h-screen flex flex-col ${className}`}>
      <Navigation />
      <div className="flex-1">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}
