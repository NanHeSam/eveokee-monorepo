import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useConvexQuery } from '../useConvexQuery';

// Mock Convex
vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}));

import { useQuery } from 'convex/react';

describe('useConvexQuery', () => {
  it('returns loading state when data is undefined', () => {
    vi.mocked(useQuery).mockReturnValue(undefined);

    const { result } = renderHook(() =>
      useConvexQuery({} as any, {} as any)
    );

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('returns data when query succeeds', () => {
    const mockData = { foo: 'bar' };
    vi.mocked(useQuery).mockReturnValue(mockData);

    const { result } = renderHook(() =>
      useConvexQuery({} as any, {} as any)
    );

    expect(result.current.data).toEqual(mockData);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('handles empty array as valid data', () => {
    vi.mocked(useQuery).mockReturnValue([]);

    const { result } = renderHook(() =>
      useConvexQuery({} as any, {} as any)
    );

    expect(result.current.data).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});

