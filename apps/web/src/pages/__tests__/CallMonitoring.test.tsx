import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CallMonitoring from '../CallMonitoring';

// Mock Convex
vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}));

import { useQuery } from 'convex/react';

describe('CallMonitoring', () => {
  it('shows loading state when data is loading', () => {
    vi.mocked(useQuery).mockReturnValue(undefined);

    render(
      <MemoryRouter>
        <CallMonitoring />
      </MemoryRouter>
    );

    expect(screen.getByText('Loading dashboard data...')).toBeInTheDocument();
  });

  it('shows error message when call jobs query fails but others succeed', () => {
    // Simulate a scenario where callJobs fails but stays loading indefinitely
    // In real Convex, a failed query still returns undefined (same as loading)
    // So we simulate a "loaded but null" state by returning null instead
    vi.mocked(useQuery)
      .mockReturnValueOnce(null) // callJobs - explicitly null (not undefined)
      .mockReturnValueOnce({ total: 0, queued: 0, scheduled: 0, started: 0, completed: 0, failed: 0, canceled: 0 }) // callStats
      .mockReturnValueOnce([]); // callSessions

    render(
      <MemoryRouter>
        <CallMonitoring />
      </MemoryRouter>
    );

    // Component considers null as "loaded but failed"
    expect(screen.getByText('Failed to load call jobs')).toBeInTheDocument();
    expect(screen.getByText('Please check your connection and try again')).toBeInTheDocument();
  });

  it('shows error message when call sessions query fails but others succeed', () => {
    // callJobs and callStats succeed, callSessions fails
    vi.mocked(useQuery)
      .mockReturnValueOnce([]) // callJobs
      .mockReturnValueOnce({ total: 0, queued: 0, scheduled: 0, started: 0, completed: 0, failed: 0, canceled: 0 }) // callStats
      .mockReturnValueOnce(null); // callSessions - explicitly null

    render(
      <MemoryRouter>
        <CallMonitoring />
      </MemoryRouter>
    );

    expect(screen.getByText('Failed to load call sessions')).toBeInTheDocument();
  });

  it('renders successfully with data', () => {
    const mockCallJobs = [
      {
        _id: 'job1',
        scheduledForUTC: Date.now(),
        status: 'queued',
        attempts: 0,
        createdAt: Date.now(),
      },
    ];

    const mockCallStats = {
      total: 1,
      queued: 1,
      scheduled: 0,
      started: 0,
      completed: 0,
      failed: 0,
      canceled: 0,
    };

    const mockCallSessions = [
      {
        _id: 'session1',
        vapiCallId: 'vapi-123',
        startedAt: Date.now(),
        endedAt: null,
        durationSec: 120,
      },
    ];

    vi.mocked(useQuery)
      .mockReturnValueOnce(mockCallJobs) // callJobs
      .mockReturnValueOnce(mockCallStats) // callStats
      .mockReturnValueOnce(mockCallSessions); // callSessions

    render(
      <MemoryRouter>
        <CallMonitoring />
      </MemoryRouter>
    );

    expect(screen.getByText('Call Monitoring Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Call Jobs')).toBeInTheDocument();
    expect(screen.getByText('Recent Call Sessions')).toBeInTheDocument();
  });

  it('shows empty state when no data is available', () => {
    vi.mocked(useQuery)
      .mockReturnValueOnce([]) // callJobs - empty
      .mockReturnValueOnce({ total: 0, queued: 0, scheduled: 0, started: 0, completed: 0, failed: 0, canceled: 0 }) // callStats
      .mockReturnValueOnce([]); // callSessions - empty

    render(
      <MemoryRouter>
        <CallMonitoring />
      </MemoryRouter>
    );

    expect(screen.getByText('No call jobs found')).toBeInTheDocument();
    expect(screen.getByText('No call sessions found')).toBeInTheDocument();
  });
});

