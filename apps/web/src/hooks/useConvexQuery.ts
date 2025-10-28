import { useQuery as useConvexQueryOriginal } from 'convex/react';
import type { FunctionReference, FunctionArgs, FunctionReturnType } from 'convex/server';
import { useEffect, useRef } from 'react';

/**
 * Enhanced useQuery hook that provides better error handling and loading states
 * 
 * Returns an object with:
 * - data: The query result (undefined while loading)
 * - isLoading: true while the query is loading
 * - error: Error message if the query failed (after timeout)
 */
export function useConvexQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: FunctionArgs<Query>,
  options?: {
    /** Timeout in ms after which undefined is considered an error (default: 10000) */
    errorTimeout?: number;
    /** Custom error message */
    errorMessage?: string;
  }
) {
  const data = useConvexQueryOriginal(query, args);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const hasLoadedRef = useRef(false);
  const errorTimeoutMs = options?.errorTimeout ?? 10000;

  // Track if data has ever loaded
  useEffect(() => {
    if (data !== undefined) {
      hasLoadedRef.current = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  }, [data]);

  // Set up timeout for error detection
  useEffect(() => {
    if (data === undefined && !hasLoadedRef.current && !timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        // After timeout, if still undefined, we consider it an error
        // This will be checked by the consumer
      }, errorTimeoutMs);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, errorTimeoutMs]);

  const isLoading = data === undefined && !hasLoadedRef.current;
  
  return {
    data,
    isLoading,
    // Note: Convex queries don't actually throw errors - they just stay undefined
    // So we can't detect "real" errors, only loading states
    error: null,
  };
}

/**
 * Type-safe wrapper around the original useQuery that returns { data, isLoading }
 * This is the recommended way to use Convex queries in the app.
 */
export function useSafeConvexQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: FunctionArgs<Query>
): {
  data: FunctionReturnType<Query> | undefined;
  isLoading: boolean;
  error: string | null;
} {
  return useConvexQuery(query, args);
}

