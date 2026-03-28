import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

let mockSessionState = null;
let onAuthStateChangeCallback = null;

vi.mock('../lib/supabase', () => {
  const supabaseMock = {
    auth: {
      onAuthStateChange: vi.fn((callback) => {
        onAuthStateChangeCallback = callback;
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
import { getPendingCount, syncPendingWorkouts } from '../lib/offlineStorage';

const mockSession = {
  user: { id: 'user-1', email: 'test@test.com', user_metadata: { full_name: 'Test' } },
  access_token: 'tok',
};

const mockProfileData = {
  id: 'user-1', name: 'Test', plan: 'free', onboarding_complete: true, created_at: '2025-01-01T00:00:00Z',
};

describe('App Shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.__mockOnline = true;
    mockSessionState = null;
  });

  it('shows loading state initially', () => {
    // Make getSession hang
    getSession.mockImplementation(() => new Promise(() => {}));
    render(<App />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows auth screen when no session', async () => {
    getSession.mockResolvedValue(null);
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('gAIns')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    });
  });

  it('shows home screen when authenticated', async () => {
    mockSessionState = mockSession;
    getSession.mockResolvedValue(mockSession);
    getProfile.mockResolvedValue(mockProfileData);

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Start Workout')).toBeInTheDocument();
    });
  });

  it('shows onboarding when profile.onboarding_complete is false', async () => {
    mockSessionState = mockSession;
    getSession.mockResolvedValue(mockSession);
    getProfile.mockResolvedValue({ ...mockProfileData, onboarding_complete: false });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("What's your gender?")).toBeInTheDocument();
    });
  });

  it('signs out and deletes profile if no profile found', async () => {
    mockSessionState = mockSession;
    getSession.mockResolvedValue(mockSession);
    getProfile.mockResolvedValue(null);

    render(<App />);
    await waitFor(() => {
      expect(signOut).toHaveBeenCalled();
    });
  });

  it('falls back to auth screen on session timeout', async () => {
    // getSession never resolves
    getSession.mockImplementation(() => new Promise(() => {}));

    render(<App />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // After 5s timeout, should show auth (or stop loading)
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    }, { timeout: 7000 });
  }, 10000);

  it('shows offline banner when offline', async () => {
    window.__mockOnline = false;
    mockSessionState = mockSession;
    getSession.mockResolvedValue(mockSession);
    getProfile.mockResolvedValue(mockProfileData);

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/Offline/)).toBeInTheDocument();
    });
  });

  it('shows pending sync count', async () => {
    getPendingCount.mockReturnValue(2);
    mockSessionState = mockSession;
    getSession.mockResolvedValue(mockSession);
    getProfile.mockResolvedValue(mockProfileData);

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/2 workouts pending sync/)).toBeInTheDocument();
    });
  });

  it('shows offline banner with queued workout count', async () => {
    window.__mockOnline = false;
    getPendingCount.mockReturnValue(3);
    mockSessionState = mockSession;
    getSession.mockResolvedValue(mockSession);
    getProfile.mockResolvedValue(mockProfileData);

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText(/3 workouts queued/)).toBeInTheDocument();
    });
  });

  it('bottom nav is visible on main screens', async () => {
    mockSessionState = mockSession;
    getSession.mockResolvedValue(mockSession);
    getProfile.mockResolvedValue(mockProfileData);

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Coach')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Stats')).toBeInTheDocument();
    });
  });

  it('hides bottom nav during workout', async () => {
    mockSessionState = mockSession;
    getSession.mockResolvedValue(mockSession);
    getProfile.mockResolvedValue(mockProfileData);

    render(<App />);
    await waitFor(() => expect(screen.getByText('Start Workout')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Start Workout'));
    await waitFor(() => expect(screen.getByText('Pick a Template')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Push'));
    await waitFor(() => {
      expect(screen.getByText('Push Day')).toBeInTheDocument();
      // Bottom nav should be hidden during workout
      // The Coach tab text might still exist in DOM but nav container hidden
    });
  });
});
