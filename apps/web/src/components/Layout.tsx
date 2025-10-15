import { ReactNode } from 'react';
import Navigation from './Navigation';

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

export default function Layout({ children, className = '' }: LayoutProps) {
  return (
    <div className={`min-h-screen ${className}`}>
      <Navigation />
      {children}
    </div>
  );
}
