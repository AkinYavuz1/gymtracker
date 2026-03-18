import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: null }),
  },
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
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
}));

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
  user: { id: 'user-1', email: 'test@test.com', user_metadata: { full_name: 'Test' } },
  access_token: 'tok',
};

const mockProfileData = {
  id: 'user-1', name: 'Test', plan: 'free', onboarding_complete: true, created_at: '2025-01-01T00:00:00Z',
};

describe('HistoryScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue(mockSession);
    getProfile.mockResolvedValue(mockProfileData);
    getPersonalRecords.mockResolvedValue([]);
    getVolumeTrend.mockResolvedValue([]);
  });

  async function navigateToHistory() {
    render(<App />);
    await waitFor(() => expect(screen.getByText('History')).toBeInTheDocument());
    fireEvent.click(screen.getByText('History'));
  }

  it('shows empty state when no workouts', async () => {
    getWorkouts.mockResolvedValue([]);
    await navigateToHistory();

    await waitFor(() => {
      expect(screen.getByText('No Workouts Yet')).toBeInTheDocument();
      expect(screen.getByText('Complete a workout and it will appear here.')).toBeInTheDocument();
    });
  });

  it('shows workout history entries', async () => {
    getWorkouts.mockResolvedValue([
      {
        id: 'w1', title: 'Push Day',
        started_at: '2025-03-10T10:00:00Z',
        duration_secs: 3600,
        total_volume_kg: 14100,
      },
      {
        id: 'w2', title: 'Pull Day',
        started_at: '2025-03-09T10:00:00Z',
        duration_secs: 3480,
        total_volume_kg: 10880,
      },
    ]);

    await navigateToHistory();

    await waitFor(() => {
      expect(screen.getByText('Push Day')).toBeInTheDocument();
      expect(screen.getByText('Pull Day')).toBeInTheDocument();
    });
  });

  it('shows duration and volume for each workout', async () => {
    getWorkouts.mockResolvedValue([
      {
        id: 'w1', title: 'Legs',
        started_at: '2025-03-10T10:00:00Z',
        duration_secs: 4260, // 71 min
        total_volume_kg: 18200,
      },
    ]);

    await navigateToHistory();

    await waitFor(() => {
      expect(screen.getByText('Legs')).toBeInTheDocument();
      // Duration shows "71 min" format
      expect(screen.getAllByText(/71 min/).length).toBeGreaterThan(0);
      // Volume shows locale-formatted kg
      expect(screen.getByText(/18,200 kg/)).toBeInTheDocument();
    });
  });

  it('shows header', async () => {
    getWorkouts.mockResolvedValue([]);
    await navigateToHistory();

    await waitFor(() => {
      expect(screen.getByText('Log')).toBeInTheDocument();
    });
  });
});

describe('StatsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue(mockSession);
    getProfile.mockResolvedValue(mockProfileData);
    getWorkouts.mockResolvedValue([]);
    getPersonalRecords.mockResolvedValue([]);
    getVolumeTrend.mockResolvedValue([]);
  });

  async function navigateToStats() {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Stats')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Stats'));
  }

  it('shows stats header', async () => {
    await navigateToStats();
    await waitFor(() => {
      expect(screen.getByText('Progress')).toBeInTheDocument();
      expect(screen.getByText('Analytics')).toBeInTheDocument();
    });
  });

  it('shows stats cards', async () => {
    getWorkouts.mockResolvedValue([
      { id: 'w1', title: 'Push', started_at: '2025-03-10T10:00:00Z', duration_secs: 3600, total_volume_kg: 14100 },
    ]);
    getPersonalRecords.mockResolvedValue([
      { exercise_name: 'Bench', weight_kg: 120, reps: 8, estimated_1rm: 150 },
    ]);

    await navigateToStats();

    await waitFor(() => {
      // Should show Workouts, Volume, Avg Time, PRs labels
      expect(screen.getByText('Workouts')).toBeInTheDocument();
      expect(screen.getByText('Volume')).toBeInTheDocument();
      expect(screen.getByText('Avg Time')).toBeInTheDocument();
      expect(screen.getByText('PRs')).toBeInTheDocument();
    });
  });

  it('shows 8-Week Volume chart section', async () => {
    await navigateToStats();

    await waitFor(() => {
      expect(screen.getByText('8-Week Volume')).toBeInTheDocument();
    });
  });

  it('shows Muscle Split section', async () => {
    await navigateToStats();

    await waitFor(() => {
      expect(screen.getByText('Muscle Split')).toBeInTheDocument();
      expect(screen.getByText('Chest')).toBeInTheDocument();
      expect(screen.getByText('Back')).toBeInTheDocument();
      expect(screen.getByText('Legs')).toBeInTheDocument();
      expect(screen.getByText('Shoulders')).toBeInTheDocument();
      expect(screen.getByText('Arms')).toBeInTheDocument();
    });
  });

  it('calculates correct workout count', async () => {
    getWorkouts.mockResolvedValue([
      { id: 'w1', title: 'A', started_at: '2025-03-10T10:00:00Z', duration_secs: 3600, total_volume_kg: 5000 },
      { id: 'w2', title: 'B', started_at: '2025-03-11T10:00:00Z', duration_secs: 3600, total_volume_kg: 5000 },
      { id: 'w3', title: 'C', started_at: '2025-03-12T10:00:00Z', duration_secs: 3600, total_volume_kg: 5000 },
    ]);

    await navigateToStats();

    await waitFor(() => {
      // Workouts stat should show 3
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('shows zero stats when no data', async () => {
    await navigateToStats();

    await waitFor(() => {
      // Multiple "0" elements exist (Workouts, PRs, chart data points, etc.)
      const workoutsLabel = screen.getByText('Workouts');
      const workoutsCard = workoutsLabel.closest('div').parentElement;
      expect(workoutsCard).toHaveTextContent('0');
    });
  });
});

describe('PRScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue(mockSession);
    getProfile.mockResolvedValue(mockProfileData);
    getWorkouts.mockResolvedValue([]);
    getVolumeTrend.mockResolvedValue([]);
  });

  it('shows PR screen when navigated from home', async () => {
    getPersonalRecords.mockResolvedValue([
      { exercise_name: 'Bench Press', weight_kg: 120, reps: 8, estimated_1rm: 150 },
      { exercise_name: 'Back Squat', weight_kg: 180, reps: 6, estimated_1rm: 210 },
    ]);

    render(<App />);
    await waitFor(() => expect(screen.getByText('See All →')).toBeInTheDocument());
    fireEvent.click(screen.getByText('See All →'));

    await waitFor(() => {
      expect(screen.getByText('Personal Records')).toBeInTheDocument();
      expect(screen.getByText('Bench Press')).toBeInTheDocument();
      expect(screen.getByText('Back Squat')).toBeInTheDocument();
    });
  });

  it('shows empty state when no PRs', async () => {
    getPersonalRecords.mockResolvedValue([]);

    render(<App />);
    await waitFor(() => expect(screen.getByText('See All →')).toBeInTheDocument());
    fireEvent.click(screen.getByText('See All →'));

    await waitFor(() => {
      expect(screen.getByText('No 1RM PRs Yet')).toBeInTheDocument();
    });
  });

  it('shows PR details', async () => {
    getPersonalRecords.mockResolvedValue([
      { exercise_name: 'Deadlift', weight_kg: 200, reps: 5, estimated_1rm: 225 },
    ]);

    render(<App />);
    await waitFor(() => expect(screen.getByText('See All →')).toBeInTheDocument());
    fireEvent.click(screen.getByText('See All →'));

    await waitFor(() => {
      expect(screen.getByText('Deadlift')).toBeInTheDocument();
      // e1RM shown as big number + separate "e1RM" label
      expect(screen.getByText('225kg')).toBeInTheDocument();
      expect(screen.getByText('e1RM')).toBeInTheDocument();
      // Subtitle shows "reps @ weight"
      expect(screen.getByText(/5 reps @ 200kg/)).toBeInTheDocument();
    });
  });

  it('has back button that navigates home', async () => {
    getPersonalRecords.mockResolvedValue([{ exercise_name: 'Bench', weight_kg: 100, reps: 8, estimated_1rm: 120 }]);

    render(<App />);
    await waitFor(() => expect(screen.getByText('See All →')).toBeInTheDocument());
    fireEvent.click(screen.getByText('See All →'));

    await waitFor(() => expect(screen.getByText('← Back')).toBeInTheDocument());
    fireEvent.click(screen.getByText('← Back'));

    await waitFor(() => {
      expect(screen.getByText('Start Workout')).toBeInTheDocument();
    });
  });
});
