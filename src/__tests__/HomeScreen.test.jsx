import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

let mockSessionState = null;
let onAuthStateChangeCallback = null;

// Full mock setup for App import
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
    signOut: vi.fn(),
    getSession: vi.fn(),
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    getTemplates: vi.fn().mockResolvedValue([]),
    getWorkouts: vi.fn().mockResolvedValue([]),
    getWorkoutSets: vi.fn().mockResolvedValue([]),
    getPersonalRecords: vi.fn().mockResolvedValue([]),
    getVolumeTrend: vi.fn().mockResolvedValue([]),
    getWeeklyStats: vi.fn().mockResolvedValue(null),
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
import { getSession, getProfile, getWorkouts, getPersonalRecords, getVolumeTrend } from '../lib/supabase';

const mockSession = {
  user: {
    id: 'user-1',
    email: 'test@example.com',
    user_metadata: { full_name: 'Test User' },
  },
  access_token: 'tok',
};

const mockProfileData = {
  id: 'user-1',
  name: 'Test User',
  full_name: 'Test User',
  plan: 'free',
  onboarding_complete: true,
  created_at: '2025-01-01T00:00:00Z',
};

describe('HomeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionState = mockSession;
    getSession.mockResolvedValue(mockSession);
    getProfile.mockResolvedValue(mockProfileData);
    getWorkouts.mockResolvedValue([]);
    getPersonalRecords.mockResolvedValue([]);
    getVolumeTrend.mockResolvedValue([]);
  });

  it('shows time-based greeting', async () => {
    render(<App />);
    await waitFor(() => {
      const h = new Date().getHours();
      const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
      expect(screen.getByText(greeting)).toBeInTheDocument();
    });
  });

  it('displays Start Workout button', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Start Workout')).toBeInTheDocument();
    });
  });

  it('displays AI Coach button', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('AI Coach')).toBeInTheDocument();
    });
  });

  it('shows user initial in avatar', async () => {
    render(<App />);
    await waitFor(() => {
      // "T" appears multiple times (avatar + weekly calendar Tuesday/Thursday)
      const allT = screen.getAllByText('T');
      // The avatar button is the one that is a <button> element
      const avatarButton = allT.find(el => el.tagName === 'BUTTON');
      expect(avatarButton).toBeInTheDocument();
    });
  });

  it('displays weekly calendar', async () => {
    render(<App />);
    await waitFor(() => {
      // "M" is unique but "S" appears twice (Sat/Sun), "T" appears twice (Tue/Thu)
      expect(screen.getByText('M')).toBeInTheDocument();
      const allS = screen.getAllByText('S');
      expect(allS.length).toBe(2); // Saturday and Sunday
    });
  });

  it('shows stats cards', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Workouts')).toBeInTheDocument();
      expect(screen.getByText('Volume')).toBeInTheDocument();
      expect(screen.getByText('Streak')).toBeInTheDocument();
      expect(screen.getByText('Duration')).toBeInTheDocument();
    });
  });

  it('shows zero stats when no workouts', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Workouts')).toBeInTheDocument();
    });
    // Workouts count should be 0 - use closest div container to scope the search
    const workoutsLabel = screen.getByText('Workouts');
    const workoutsCard = workoutsLabel.closest('div').parentElement;
    expect(workoutsCard).toHaveTextContent('0');
  });

  it('shows AI Coach button', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('AI Coach')).toBeInTheDocument();
    });
  });

  it('shows Personal Records section', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Personal Records')).toBeInTheDocument();
    });
  });

  it('displays PRs when available', async () => {
    getPersonalRecords.mockResolvedValue([
      { exercise_name: 'Bench Press', weight_kg: 120, reps: 8, estimated_1rm: 150 },
      { exercise_name: 'Back Squat', weight_kg: 180, reps: 6, estimated_1rm: 210 },
    ]);

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Bench Press')).toBeInTheDocument();
      expect(screen.getByText('Back Squat')).toBeInTheDocument();
    });
  });

  it('shows PRO badge for pro users', async () => {
    getProfile.mockResolvedValue({ ...mockProfileData, plan: 'pro' });

    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('PRO')).toBeInTheDocument();
    });
  });

  it('does not show badge for free users', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Start Workout')).toBeInTheDocument();
    });
    expect(screen.queryByText('FREE')).not.toBeInTheDocument();
  });

  it('navigates to template picker when Start Workout clicked', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Start Workout')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Start Workout'));
    await waitFor(() => {
      expect(screen.getByText('Pick a Template')).toBeInTheDocument();
    });
  });

  it('navigates to AI Coach when AI Coach clicked', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('AI Coach')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('AI Coach'));
    await waitFor(() => {
      expect(screen.getByText('AI Strength Coach')).toBeInTheDocument();
    });
  });

  it('shows bottom nav tabs', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Coach')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Stats')).toBeInTheDocument();
    });
  });

  it('navigates to History tab', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('History')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('History'));
    await waitFor(() => {
      // HistoryScreen shows "Log" label
      expect(screen.getByText('Log')).toBeInTheDocument();
    });
  });

  it('navigates to Stats tab', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Stats')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Stats'));
    await waitFor(() => {
      expect(screen.getByText('Progress')).toBeInTheDocument();
    });
  });

  it('calculates workouts this week correctly', async () => {
    const now = new Date();
    const todayWorkout = {
      id: 'w-today',
      title: 'Today',
      started_at: now.toISOString(),
      duration_secs: 3600,
      total_volume_kg: 10000,
    };
    getWorkouts.mockResolvedValue([todayWorkout]);

    render(<App />);
    await waitFor(() => {
      const workoutsLabel = screen.getByText('Workouts');
      const workoutsCard = workoutsLabel.closest('div').parentElement;
      expect(workoutsCard).toHaveTextContent('1');
    });
  });
});
