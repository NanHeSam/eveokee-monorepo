import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

/**
 * Renders a full-page 404 "Not Found" UI with primary actions and helpful links.
 *
 * @returns A JSX element containing a gradient-backed 404 layout with a large "404" heading, a "Page Not Found" message, a "Go Home" link, a "Go Back" button (calls window.history.back()), quick links to Dashboard/Profile/Blog, and a decorative SVG.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full text-center">
        {/* 404 Large Text */}
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-mint to-blue-600 dark:from-accent-mint dark:to-blue-400">
            404
          </h1>
          <div className="mt-4 text-6xl font-bold text-gray-900 dark:text-white">
            Page Not Found
          </div>
        </div>

        {/* Description */}
        <p className="mt-6 text-xl text-gray-600 dark:text-gray-300 max-w-lg mx-auto">
          Oops! The page you're looking for doesn't exist. It might have been moved or deleted.
        </p>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/"
            className="inline-flex items-center space-x-2 px-6 py-3 bg-accent-mint text-white rounded-lg font-semibold hover:bg-accent-mint/90 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105 transition-transform"
          >
            <Home className="h-5 w-5" />
            <span>Go Home</span>
          </Link>
          
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-gray-600 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105 transition-transform"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Go Back</span>
          </button>
        </div>

        {/* Helpful Links */}
        <div className="mt-16">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            You might be looking for:
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/dashboard"
              className="text-accent-mint hover:text-accent-mint/80 dark:text-accent-mint dark:hover:text-accent-mint/80 font-medium transition-colors"
            >
              Dashboard
            </Link>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <Link
              to="/dashboard/profile"
              className="text-accent-mint hover:text-accent-mint/80 dark:text-accent-mint dark:hover:text-accent-mint/80 font-medium transition-colors"
            >
              Profile
            </Link>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <Link
              to="/blog"
              className="text-accent-mint hover:text-accent-mint/80 dark:text-accent-mint dark:hover:text-accent-mint/80 font-medium transition-colors"
            >
              Blog
            </Link>
          </div>
        </div>

        {/* Decorative Element */}
        <div className="mt-16 opacity-50">
          <svg
            className="mx-auto h-24 w-24 text-gray-400 dark:text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
