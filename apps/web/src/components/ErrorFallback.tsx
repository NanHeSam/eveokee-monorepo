/**
 * Render a user-friendly error fallback UI for Sentry's ErrorBoundary.
 *
 * Displays an error message, optional stack trace in development, a retry action when provided,
 * and a button to navigate home.
 *
 * @param error - The error value or object to display; non-Error values are converted to an Error.
 * @param resetError - Optional callback invoked to retry or reset the error boundary.
 * @param componentStack - Optional component stack information provided by ErrorBoundary (not used).
 * @param eventId - Optional Sentry event identifier associated with the error (not used).
 * @returns The rendered React element for the fallback UI.
 */
export default function ErrorFallback({ 
  error, 
  resetError
}: { 
  error: unknown; 
  componentStack: string;
  eventId: string;
  resetError: () => void;
}) {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
          <svg
            className="w-8 h-8 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-2">
          Something went wrong
        </h1>

        <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
          We encountered an error while loading this page. Our team has been notified.
        </p>

        {errorObj && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-400 mb-2">
              Error Details:
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 font-mono break-all">
              {errorObj.message}
            </p>
            {process.env.NODE_ENV === 'development' && errorObj.stack && (
              <details className="mt-3">
                <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer hover:underline">
                  Stack Trace
                </summary>
                <pre className="mt-2 text-xs text-red-700 dark:text-red-300 overflow-auto p-2 bg-red-100 dark:bg-red-900/30 rounded max-h-48">
                  {errorObj.stack}
                </pre>
              </details>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {resetError && (
            <button
              onClick={resetError}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Try Again
            </button>
          )}
          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
          >
            Go Home
          </button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-6">
          If this problem persists, please contact support.
        </p>
      </div>
    </div>
  );
}
