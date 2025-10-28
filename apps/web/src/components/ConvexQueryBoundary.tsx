import { ReactNode } from 'react';

interface ConvexQueryBoundaryProps {
  /**
   * Array of query results from useQuery hooks
   */
  queries: Array<{
    data: unknown;
    isLoading?: boolean;
    error?: string | null;
  }>;
  /**
   * Content to show while loading
   */
  loadingFallback?: ReactNode;
  /**
   * Content to show on error
   */
  errorFallback?: ReactNode;
  /**
   * Children to render when all queries are loaded successfully
   */
  children: ReactNode;
}

/**
 * Renders children when a set of Convex queries have loaded successfully and shows loading or error UI otherwise.
 *
 * @param queries - Array of query results to monitor; each item should include `data`, and may include `isLoading` and `error`.
 * @param loadingFallback - Optional node to render while any query's `data` is `undefined`.
 * @param errorFallback - Optional node to render when any query has a truthy `error` or any query's `data` is `null`.
 * @param children - Content to render once all queries have non-`undefined`, non-`null` `data` and no errors are present.
 * @returns The `children` when all queries loaded without error; otherwise a loading view or an error view (or the provided fallbacks).
 */
export default function ConvexQueryBoundary({
  queries,
  loadingFallback,
  errorFallback,
  children,
}: ConvexQueryBoundaryProps) {
  // Check if any query is still loading (undefined)
  const isLoading = queries.some((q) => q.data === undefined);
  
  // Check if any query explicitly has an error
  const hasError = queries.some((q) => q.error);
  
  // Check if any query is explicitly null (loaded but failed)
  const hasNullData = queries.some((q) => q.data === null);

  if (isLoading) {
    return (
      <>
        {loadingFallback || (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading...</span>
          </div>
        )}
      </>
    );
  }

  if (hasError || hasNullData) {
    return (
      <>
        {errorFallback || (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="text-red-600 dark:text-red-400 mb-4">
              <svg className="h-16 w-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Failed to load data
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
              We couldn't load the data you requested. Please check your connection and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Reload Page
            </button>
          </div>
        )}
      </>
    );
  }

  return <>{children}</>;
}
