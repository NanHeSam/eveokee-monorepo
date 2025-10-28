import { useState } from 'react';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';

/**
 * Top-level navigation bar component that adapts layout and available links based on viewport size, theme, and authentication state.
 *
 * Renders the site logo, anchor and route links (Demo, How it works, FAQ, Blog, Dashboard), a theme toggle, authentication controls (Log in / Sign up or user avatar), and a responsive mobile menu that mirrors desktop actions.
 *
 * @returns The navigation JSX element described above.
 */
export default function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleTheme, isDark } = useTheme();

  const handleAnchorClick = (anchor: string) => {
    if (location.pathname !== '/') {
      navigate(`/#${anchor}`);
    } else {
      // If already on home page, just scroll to the section
      const element = document.getElementById(anchor);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <nav className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-50 backdrop-blur-sm bg-white/95 dark:bg-gray-800/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center hover:opacity-80 transition-opacity cursor-pointer">
              <div className="w-10 h-10 bg-accent-mint rounded-xl flex items-center justify-center relative overflow-hidden shadow-lg">
                <span className="text-white text-lg font-bold">e</span>
              </div>
              <span className="ml-3 text-xl font-bold text-gray-900 dark:text-white">eveokee</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <button 
                onClick={() => handleAnchorClick('demo')} 
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer"
              >
                Demo
              </button>
              <button 
                onClick={() => handleAnchorClick('how-it-works')} 
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer"
              >
                How it works
              </button>
              <button 
                onClick={() => handleAnchorClick('faq')} 
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer"
              >
                FAQ
              </button>
              <Link to="/blog" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors">
                Blog
              </Link>
              <SignedIn>
                <Link to="/dashboard" className="bg-accent-mint/10 text-accent-mint dark:bg-accent-mint/20 px-3 py-2 rounded-md text-sm font-medium hover:bg-accent-mint/20 dark:hover:bg-accent-mint/30 transition-colors">
                  Dashboard
                </Link>
              </SignedIn>
            </div>
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6 space-x-3">
              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              
              <SignedOut>
                <Link
                  to="/sign-in"
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Log in
                </Link>
                <Link
                  to="/sign-up"
                  className="bg-accent-mint text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-mint/90 transition-colors"
                >
                  Sign up
                </Link>
              </SignedOut>
              <SignedIn>
                <UserButton 
                  appearance={{
                    elements: {
                      avatarBox: "w-8 h-8"
                    }
                  }}
                />
              </SignedIn>
            </div>
          </div>

          {/* Mobile menu button and theme toggle */}
          <div className="md:hidden flex items-center space-x-2">
            {/* Mobile Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="bg-gray-50 dark:bg-gray-700 inline-flex items-center justify-center p-2 rounded-md text-gray-400 dark:text-gray-300 hover:text-gray-500 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-mint"
            >
              {isMenuOpen ? (
                <X className="block h-6 w-6" />
              ) : (
                <Menu className="block h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
            <button 
              onClick={() => {
                handleAnchorClick('demo');
                setIsMenuOpen(false);
              }} 
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white block px-3 py-2 rounded-md text-base font-medium w-full text-left"
            >
              Demo
            </button>
            <button 
              onClick={() => {
                handleAnchorClick('how-it-works');
                setIsMenuOpen(false);
              }} 
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white block px-3 py-2 rounded-md text-base font-medium w-full text-left"
            >
              How it works
            </button>
            <button 
              onClick={() => {
                handleAnchorClick('faq');
                setIsMenuOpen(false);
              }} 
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white block px-3 py-2 rounded-md text-base font-medium w-full text-left"
            >
              FAQ
            </button>
            <Link 
              to="/blog" 
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white block px-3 py-2 rounded-md text-base font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Blog
            </Link>
            <SignedIn>
              <Link 
                to="/dashboard" 
                className="bg-accent-mint/10 text-accent-mint dark:bg-accent-mint/20 px-3 py-2 rounded-md text-base font-medium hover:bg-accent-mint/20 dark:hover:bg-accent-mint/30 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Dashboard
              </Link>
            </SignedIn>
            <div className="pt-4 pb-3 border-t border-gray-200 dark:border-gray-600">
              <SignedOut>
                <div className="flex items-center px-3 space-x-3">
                  <Link
                    to="/sign-in"
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white block px-3 py-2 rounded-md text-base font-medium w-full text-left"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/sign-up"
                    className="bg-accent-mint text-white px-4 py-2 rounded-lg text-base font-medium hover:bg-accent-mint/90 transition-colors w-full"
                  >
                    Sign up
                  </Link>
                </div>
              </SignedOut>
              <SignedIn>
                <div className="flex items-center px-3 space-x-3">
                  <div className="flex items-center">
                    <UserButton 
                      appearance={{
                        elements: {
                          avatarBox: "w-8 h-8"
                        }
                      }}
                    />
                  </div>
                </div>
              </SignedIn>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}