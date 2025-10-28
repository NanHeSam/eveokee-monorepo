import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Profile from '../Profile';

// Mock Convex
vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => {
  const toast = vi.fn() as any;
  toast.error = vi.fn();
  toast.success = vi.fn();
  return {
    default: toast,
  };
});

import { useQuery, useMutation } from 'convex/react';

const mockProfile = {
  user: {
    _id: 'user123' as unknown as ReturnType<typeof import('@backend/convex')['api']['users']['getUserProfile']>['user']['_id'],
    name: 'John Doe',
    email: 'john@example.com',
  },
  subscription: {
    tier: 'monthly',
    productId: 'eveokee_premium_monthly',
    status: 'active' as const,
    musicGenerationsUsed: 5,
    musicLimit: 100,
    periodStart: Date.now() - 10 * 24 * 60 * 60 * 1000,
    periodEnd: Date.now() + 20 * 24 * 60 * 60 * 1000,
    isActive: true,
    remainingQuota: 95,
  },
  callSettings: {
    _id: 'settings123' as unknown as ReturnType<typeof import('@backend/convex')['api']['callSettings']['getCallSettings']>['_id'],
    phoneE164: '+12125551234',
    timezone: 'America/New_York',
    timeOfDay: '09:00',
    cadence: 'daily' as const,
    daysOfWeek: undefined,
    active: true,
  },
};

const mockProfileWithoutCallSettings = {
  ...mockProfile,
  callSettings: null,
};

// Helper to create a proper mutation mock
const createMutationMock = (impl: unknown = vi.fn()) => {
  const mockFn = impl as {
    withOptimisticUpdate: ReturnType<typeof vi.fn>;
  } & ReturnType<typeof vi.fn>;
  mockFn.withOptimisticUpdate = vi.fn().mockReturnValue(mockFn);
  return mockFn;
};

describe('Profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    vi.mocked(useMutation).mockReturnValue(createMutationMock());

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    );

    expect(screen.getByText(/loading profile/i)).toBeInTheDocument();
  });

  it('renders user information', async () => {
    vi.mocked(useQuery).mockReturnValue(mockProfile);
    vi.mocked(useMutation).mockReturnValue(createMutationMock());

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Profile & Settings')).toBeInTheDocument();
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('renders subscription information', async () => {
    vi.mocked(useQuery).mockReturnValue(mockProfile);
    vi.mocked(useMutation).mockReturnValue(createMutationMock());

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Subscription Status')).toBeInTheDocument();
    });

    // Check Plan shows the tier
    expect(screen.getByText('Premium Monthly')).toBeInTheDocument();
    // Check Product shows formatted productId and status
    expect(screen.getByText(/Eveokee Premium Monthly/i)).toBeInTheDocument();
    // There will be multiple "Active" elements (subscription and call settings)
    expect(screen.getAllByText(/Active/i).length).toBeGreaterThanOrEqual(1);
    // Music generations should NOT be shown for paid plans
    expect(screen.queryByText(/Music Generations/i)).not.toBeInTheDocument();
  });

  it('renders subscription information for free tier with limit', async () => {
    const mockFreeProfile = {
      ...mockProfile,
      subscription: {
        tier: 'free',
        productId: 'free-tier',
        status: 'active' as const,
        musicGenerationsUsed: 4,
        musicLimit: 10,
        periodStart: Date.now() - 10 * 24 * 60 * 60 * 1000,
        periodEnd: Date.now() + 20 * 24 * 60 * 60 * 1000,
        isActive: true,
        remainingQuota: 6,
      },
    };
    
    vi.mocked(useQuery).mockReturnValue(mockFreeProfile);
    vi.mocked(useMutation).mockReturnValue(createMutationMock());

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Subscription Status')).toBeInTheDocument();
    });

    // Check Plan shows the tier
    expect(screen.getByText('Free')).toBeInTheDocument();
    // Check Product shows formatted productId and status
    expect(screen.getByText(/Free Tier/i)).toBeInTheDocument();
    // There will be multiple "Active" elements (subscription and call settings)
    expect(screen.getAllByText(/Active/i).length).toBeGreaterThanOrEqual(1);
    // Music generations SHOULD be shown for free tier
    expect(screen.getByText(/Music Generations/i)).toBeInTheDocument();
    expect(screen.getByText(/4 \/ 10/)).toBeInTheDocument();
    expect(screen.getByText(/6 remaining/)).toBeInTheDocument();
  });

  it('renders call settings in view mode', async () => {
    vi.mocked(useQuery).mockReturnValue(mockProfile);
    vi.mocked(useMutation).mockReturnValue(createMutationMock());

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Call Settings')).toBeInTheDocument();
    });

    expect(screen.getByText('+12125551234')).toBeInTheDocument();
    expect(screen.getByText('America/New_York')).toBeInTheDocument();
    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(screen.getByText('Every day')).toBeInTheDocument();
    // Check Active status - there will be two (subscription and call settings)
    const activeStatuses = screen.getAllByText('Active');
    expect(activeStatuses.length).toBeGreaterThanOrEqual(1);
  });

  it('shows edit button and switches to edit mode', async () => {
    const user = userEvent.setup();
    vi.mocked(useQuery).mockReturnValue(mockProfile);
    vi.mocked(useMutation).mockReturnValue(createMutationMock());

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Call Settings')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit settings/i });
    await user.click(editButton);

    // Should show form inputs
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/timezone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/time of day/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cadence/i)).toBeInTheDocument();
  });

  it('shows setup button when no call settings exist', async () => {
    const user = userEvent.setup();
    vi.mocked(useQuery).mockReturnValue(mockProfileWithoutCallSettings);
    vi.mocked(useMutation).mockReturnValue(createMutationMock());

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Call Settings')).toBeInTheDocument();
    });

    expect(screen.getByText(/no call settings configured/i)).toBeInTheDocument();
    
    const setupButton = screen.getByRole('button', { name: /set up call settings/i });
    await user.click(setupButton);

    // Should show form inputs
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
  });

  it('saves call settings successfully', async () => {
    const user = userEvent.setup();
    const mockUpsert = vi.fn().mockResolvedValue({ settingsId: 'settings123', updated: true });
    
    vi.mocked(useQuery).mockReturnValue(mockProfile);
    vi.mocked(useMutation).mockReturnValue(createMutationMock(mockUpsert));

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Call Settings')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit settings/i });
    await user.click(editButton);

    // Modify phone number
    const phoneInput = screen.getByLabelText(/phone number/i);
    await user.clear(phoneInput);
    await user.type(phoneInput, '+14155551234');

    // Save
    const saveButton = screen.getByRole('button', { name: /save settings/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          phoneE164: '+14155551234',
        })
      );
    });
  });

  it('handles custom cadence with day selection', async () => {
    const user = userEvent.setup();
    vi.mocked(useQuery).mockReturnValue(mockProfile);
    vi.mocked(useMutation).mockReturnValue(createMutationMock());

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Call Settings')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit settings/i });
    await user.click(editButton);

    // Change to custom cadence
    const cadenceSelect = screen.getByLabelText(/cadence/i);
    await user.selectOptions(cadenceSelect, 'custom');

    // Should show day selector
    await waitFor(() => {
      expect(screen.getByText('Select Days')).toBeInTheDocument();
    });

    // Select Monday and Wednesday
    const mondayButton = screen.getByRole('button', { name: /mon/i });
    const wednesdayButton = screen.getByRole('button', { name: /wed/i });
    
    await user.click(mondayButton);
    await user.click(wednesdayButton);

    // Buttons should be highlighted (in the actual UI, check via classes)
    expect(mondayButton).toHaveClass('bg-blue-600');
    expect(wednesdayButton).toHaveClass('bg-blue-600');
  });

  it('cancels editing and reverts changes', async () => {
    const user = userEvent.setup();
    vi.mocked(useQuery).mockReturnValue(mockProfile);
    vi.mocked(useMutation).mockReturnValue(createMutationMock());

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Call Settings')).toBeInTheDocument();
    });

    const editButton = screen.getByRole('button', { name: /edit settings/i });
    await user.click(editButton);

    // Modify phone number
    const phoneInput = screen.getByLabelText(/phone number/i);
    await user.clear(phoneInput);
    await user.type(phoneInput, '+14155551234');

    // Cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    // Should revert to view mode with original value
    await waitFor(() => {
      expect(screen.getByText('+12125551234')).toBeInTheDocument();
    });
  });

  it('displays browser timezone hint', async () => {
    vi.mocked(useQuery).mockReturnValue(mockProfileWithoutCallSettings);
    vi.mocked(useMutation).mockReturnValue(createMutationMock());

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Call Settings')).toBeInTheDocument();
    });

    const setupButton = screen.getByRole('button', { name: /set up call settings/i });
    await userEvent.setup().click(setupButton);

    // Should show browser detected timezone
    expect(screen.getByText(/browser detected:/i)).toBeInTheDocument();
  });
});

