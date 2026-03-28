import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Store session for use by onAuthStateChange callback
let mockSessionState = null;
let onAuthStateChangeCallback = null;

vi.mock('../lib/supabase', () => {
  const supabaseMock = {
    auth: {
      onAuthStateChange: vi.fn((callback) => {
        onAuthStateChangeCallback = callback;
        // Fire INITIAL_SESSION event on next tick with the mock session
        setTimeout(() => callback('INITIAL_SESSION', mockSessionState), 0);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: null }),
  };

  return {
    supabase: supabaseMock,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    getSession: vi.fn(),
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    getTemplates: vi.fn().mockResolvedValue([]),
    getWorkouts: vi.fn().mockResolvedValue([]),
    getPersonalRecords: vi.fn().mockResolvedValue([]),
    getVolumeTrend: vi.fn().mockResolvedValue([]),
    seedDummyData: vi.fn(),
    getPrograms: vi.fn().mockResolvedValue([]),
    getActiveEnrollment: vi.fn().mockResolvedValue(null),
    getScheduledWorkouts: vi.fn().mockResolvedValue([]),
    updateScheduledWorkout: vi.fn().mockResolvedValue({}),
    callCoachAPI: vi.fn(),
    getCustomExercises: vi.fn().mockResolvedValue([]),
    createCustomExercise: vi.fn().mockResolvedValue({ id: 'cx-1' }),
    updateCustomExercise: vi.fn().mockResolvedValue({}),
    deleteCustomExercise: vi.fn().mockResolvedValue(undefined),
    logLoginEvent: vi.fn(),
    logPageEvent: vi.fn(),
    setSessionCache: vi.fn(),
    getExerciseHistory: vi.fn().mockResolvedValue({}),
  };
});

vi.mock('../lib/offlineStorage', () => ({
  getPendingCount: vi.fn().mockReturnValue(0),
  syncPendingWorkouts: vi.fn().mockResolvedValue({ synced: 0, failed: 0 }),
  queueWorkout: vi.fn(),
}));

vi.mock('../lib/exerciseGifs', () => ({
  getExerciseGif: vi.fn().mockResolvedValue(null),
}));

import App from '../App';
import { getSession, getProfile, signOut } from '../lib/supabase';

const mockSession = {
  user: { id: 'user-1', email: 'test@example.com', user_metadata: { full_name: 'Test User' } },
  access_token: 'tok',
};

describe('ProfileModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionState = mockSession;
    getSession.mockResolvedValue(mockSession);
    getProfile.mockResolvedValue({
      id: 'user-1', name: 'Test User', plan: 'pro', onboarding_complete: true, created_at: '2025-01-01T00:00:00Z',
    });
  });

  async function openProfileModal() {
    render(<App />);
    await waitFor(() => {
      // "T" appears multiple times (avatar button + weekly calendar T for Tue/Thu)
      const allT = screen.getAllByText('T');
      expect(allT.length).toBeGreaterThan(0);
    });
    // Click the avatar button specifically (first <button> element with text "T")
    const avatarButton = screen.getAllByText('T').find(el => el.tagName === 'BUTTON');
    fireEvent.click(avatarButton);
  }

  it('opens when avatar is clicked', async () => {
    await openProfileModal();
    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });

  it('shows account type', async () => {
    await openProfileModal();
    await waitFor(() => {
      expect(screen.getByText('Account Type')).toBeInTheDocument();
      expect(screen.getByText('pro')).toBeInTheDocument();
    });
  });

  it('shows member duration', async () => {
    await openProfileModal();
    await waitFor(() => {
      expect(screen.getByText('Member For')).toBeInTheDocument();
    });
  });

  it('shows plan details', async () => {
    await openProfileModal();
    await waitFor(() => {
      expect(screen.getByText('30 AI queries/day')).toBeInTheDocument();
    });
  });

  it('shows free plan details for free users', async () => {
    getProfile.mockResolvedValue({
      id: 'user-1', name: 'Test User', plan: 'free', onboarding_complete: true, created_at: '2025-01-01T00:00:00Z',
    });

    render(<App />);
    await waitFor(() => {
      const allT = screen.getAllByText('T');
      expect(allT.length).toBeGreaterThan(0);
    });
    const avatarBtn = screen.getAllByText('T').find(el => el.tagName === 'BUTTON');
    fireEvent.click(avatarBtn);

    await waitFor(() => {
      expect(screen.getByText('5 AI queries/day')).toBeInTheDocument();
    });
  });

  it('shows unlimited plan details', async () => {
    getProfile.mockResolvedValue({
      id: 'user-1', name: 'Test User', plan: 'unlimited', onboarding_complete: true, created_at: '2025-01-01T00:00:00Z',
    });

    render(<App />);
    await waitFor(() => {
      const allT = screen.getAllByText('T');
      expect(allT.length).toBeGreaterThan(0);
    });
    const avatarBtn = screen.getAllByText('T').find(el => el.tagName === 'BUTTON');
    fireEvent.click(avatarBtn);

    await waitFor(() => {
      expect(screen.getByText('Unlimited AI queries')).toBeInTheDocument();
    });
  });

  it('has logout button', async () => {
    await openProfileModal();
    await waitFor(() => {
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });
  });

  it('logs out and shows auth screen', async () => {
    await openProfileModal();
    await waitFor(() => expect(screen.getByText('Logout')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
      // Should show auth screen
      expect(screen.getByText('gAIns')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    });
  });

  it('shows user initial in large avatar', async () => {
    await openProfileModal();
    await waitFor(() => {
      // The modal avatar also shows 'T'
      const initials = screen.getAllByText('T');
      expect(initials.length).toBeGreaterThanOrEqual(2); // nav avatar + modal avatar
    });
  });

  it('uses email prefix as name when no name set', async () => {
    // Override session to have no full_name, so it falls back to email prefix
    const sessionWithNoName = {
      user: { id: 'user-1', email: 'test@example.com', user_metadata: {} },
      access_token: 'tok',
    };
    mockSessionState = sessionWithNoName;
    getSession.mockResolvedValue(sessionWithNoName);
    getProfile.mockResolvedValue({
      id: 'user-1', name: null, plan: 'free', onboarding_complete: true, created_at: '2025-01-01T00:00:00Z',
    });

    render(<App />);
    await waitFor(() => {
      // Avatar will show "t" (lowercase from email prefix "test")
      const allT = screen.getAllByText((content, el) => el.tagName === 'BUTTON' && /^[tT]$/.test(content));
      expect(allT.length).toBeGreaterThan(0);
    });
    const avatarBtn = screen.getAllByText((content, el) => el.tagName === 'BUTTON' && /^[tT]$/.test(content))[0];
    fireEvent.click(avatarBtn);

    await waitFor(() => {
      expect(screen.getByText('test')).toBeInTheDocument(); // from test@example.com
    });
  });
});
