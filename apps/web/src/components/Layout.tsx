import { ReactNode } from 'react';
import Navigation from './Navigation';
import Footer from './Footer';

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

export default function Layout({ children, className = '' }: LayoutProps) {
  return (
    <div className={`min-h-screen flex flex-col ${className}`}>
      <Navigation />
      <div className="flex-1">
        {children}
      </div>
      <Footer />
    </div>
  );
}
