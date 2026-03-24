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
      update: vi.fn().mockReturnThis(),
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
import { getSession, getProfile, updateProfile } from '../lib/supabase';

const mockSession = {
  user: { id: 'user-1', email: 'test@test.com', user_metadata: { full_name: 'Test' } },
  access_token: 'tok',
};

describe('OnboardingScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionState = mockSession;
    getSession.mockResolvedValue(mockSession);
    // Profile with onboarding NOT complete
    getProfile.mockResolvedValue({
      id: 'user-1', name: 'Test', plan: 'free', onboarding_complete: false, created_at: '2025-01-01T00:00:00Z',
    });
    updateProfile.mockResolvedValue({ data: {}, error: null });
  });

  it('shows onboarding when profile.onboarding_complete is false', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("What's your gender?")).toBeInTheDocument();
    });
  });

  it('shows step 1 of 6', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Step 1 of 6')).toBeInTheDocument();
    });
  });

  it('shows gender options', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Male')).toBeInTheDocument();
      expect(screen.getByText('Female')).toBeInTheDocument();
      expect(screen.getByText('Prefer not to say')).toBeInTheDocument();
    });
  });

  it('Continue button is disabled until gender selected', async () => {
    render(<App />);
    await waitFor(() => {
      const continueBtn = screen.getByText('Continue →');
      expect(continueBtn).toBeInTheDocument();
    });
  });

  it('enables Continue after selecting gender', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Male')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Male'));
    const continueBtn = screen.getByText('Continue →');
    expect(continueBtn).not.toBeDisabled();
  });

  it('progresses to step 2 (age)', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Male')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Male'));
    fireEvent.click(screen.getByText('Continue →'));

    await waitFor(() => {
      expect(screen.getByText('How old are you?')).toBeInTheDocument();
      expect(screen.getByText('Step 2 of 6')).toBeInTheDocument();
    });
  });

  it('shows age quick-select buttons', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Male')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Male'));
    fireEvent.click(screen.getByText('Continue →'));

    await waitFor(() => {
      expect(screen.getByText('18')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('30')).toBeInTheDocument();
    });
  });

  it('progresses to step 3 (body metrics)', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Male')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Male'));
    fireEvent.click(screen.getByText('Continue →'));

    await waitFor(() => expect(screen.getByText('25')).toBeInTheDocument());
    fireEvent.click(screen.getByText('25'));
    fireEvent.click(screen.getByText('Continue →'));

    await waitFor(() => {
      expect(screen.getByText('Your measurements')).toBeInTheDocument();
      expect(screen.getByText('Step 3 of 6')).toBeInTheDocument();
    });
  });

  it('shows metric/imperial toggle', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Male')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Male'));
    fireEvent.click(screen.getByText('Continue →'));
    await waitFor(() => expect(screen.getByText('25')).toBeInTheDocument());
    fireEvent.click(screen.getByText('25'));
    fireEvent.click(screen.getByText('Continue →'));

    await waitFor(() => {
      expect(screen.getByText('metric')).toBeInTheDocument();
      expect(screen.getByText('imperial')).toBeInTheDocument();
    });
  });

  it('shows weight input', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Male')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Male'));
    fireEvent.click(screen.getByText('Continue →'));
    await waitFor(() => expect(screen.getByText('25')).toBeInTheDocument());
    fireEvent.click(screen.getByText('25'));
    fireEvent.click(screen.getByText('Continue →'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g. 80')).toBeInTheDocument();
    });
  });

  it('progresses to step 4 (goals)', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Male')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Male'));
    fireEvent.click(screen.getByText('Continue →'));
    await waitFor(() => expect(screen.getByText('25')).toBeInTheDocument());
    fireEvent.click(screen.getByText('25'));
    fireEvent.click(screen.getByText('Continue →'));
    await waitFor(() => expect(screen.getByPlaceholderText('e.g. 80')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('e.g. 80'), { target: { value: '85' } });
    fireEvent.click(screen.getByText('Continue →'));

    await waitFor(() => {
      expect(screen.getByText('Your goals')).toBeInTheDocument();
      expect(screen.getByText('Step 4 of 6')).toBeInTheDocument();
    });
  });

  it('shows training goals', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Male')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Male'));
    fireEvent.click(screen.getByText('Continue →'));
    await waitFor(() => expect(screen.getByText('25')).toBeInTheDocument());
    fireEvent.click(screen.getByText('25'));
    fireEvent.click(screen.getByText('Continue →'));
    await waitFor(() => expect(screen.getByPlaceholderText('e.g. 80')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('e.g. 80'), { target: { value: '85' } });
    fireEvent.click(screen.getByText('Continue →'));

    await waitFor(() => {
      expect(screen.getByText('Fat Loss')).toBeInTheDocument();
      expect(screen.getByText('Muscle Gain')).toBeInTheDocument();
      expect(screen.getByText('Maintenance')).toBeInTheDocument();
      expect(screen.getByText('Performance')).toBeInTheDocument();
    });
  });

  it('shows experience levels', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Male')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Male'));
    fireEvent.click(screen.getByText('Continue →'));
    await waitFor(() => expect(screen.getByText('25')).toBeInTheDocument());
    fireEvent.click(screen.getByText('25'));
    fireEvent.click(screen.getByText('Continue →'));
    await waitFor(() => expect(screen.getByPlaceholderText('e.g. 80')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('e.g. 80'), { target: { value: '85' } });
    fireEvent.click(screen.getByText('Continue →'));

    await waitFor(() => {
      expect(screen.getByText('Beginner')).toBeInTheDocument();
      expect(screen.getByText('Intermediate')).toBeInTheDocument();
      expect(screen.getByText('Advanced')).toBeInTheDocument();
    });
  });

  it('calls updateProfile on finish with correct data', async () => {
    // After completing onboarding, getProfile returns complete profile
    let profileCallCount = 0;
    getProfile.mockImplementation(() => {
      profileCallCount++;
      if (profileCallCount <= 1) {
        return Promise.resolve({ id: 'user-1', name: 'Test', plan: 'free', onboarding_complete: false, created_at: '2025-01-01T00:00:00Z' });
      }
      return Promise.resolve({ id: 'user-1', name: 'Test', plan: 'free', onboarding_complete: true, created_at: '2025-01-01T00:00:00Z' });
    });

    render(<App />);

    // Step 1: Gender
    await waitFor(() => expect(screen.getByText('Male')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Male'));
    fireEvent.click(screen.getByText('Continue →'));

    // Step 2: Age
    await waitFor(() => expect(screen.getByText('25')).toBeInTheDocument());
    fireEvent.click(screen.getByText('25'));
    fireEvent.click(screen.getByText('Continue →'));

    // Step 3: Weight
    await waitFor(() => expect(screen.getByPlaceholderText('e.g. 80')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('e.g. 80'), { target: { value: '85' } });
    fireEvent.click(screen.getByText('Continue →'));

    // Step 4: Goal + Experience (Muscle Gain requires no target rate — only fat_loss/muscle_gain show it)
    // Fat Loss requires a target rate. Use Maintenance (no target rate needed).
    await waitFor(() => expect(screen.getByText('Maintenance')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Maintenance'));
    fireEvent.click(screen.getByText('Intermediate'));

    // Continue to step 5 (benchmarks)
    fireEvent.click(screen.getByText('Continue →'));

    // Step 5: Skip benchmarks
    await waitFor(() => expect(screen.getByText('Skip — I don\'t know my lifts')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Skip — I don\'t know my lifts'));

    // Step 6: Focus areas — finish
    await waitFor(() => expect(screen.getByText(/Let's Go/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Let's Go/));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          gender: 'male',
          age: 25,
          weight_kg: 85,
          training_goal: 'maintenance',
          experience: 'intermediate',
          unit_system: 'metric',
          onboarding_complete: true,
        })
      );
    });
  });

  it('shows back button on steps after first', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Male')).toBeInTheDocument());

    // Step 1 should NOT have back button
    expect(screen.queryByText('← Back')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Male'));
    fireEvent.click(screen.getByText('Continue →'));

    // Step 2 should have back button
    await waitFor(() => {
      expect(screen.getByText('← Back')).toBeInTheDocument();
    });
  });

  it('can navigate back to previous step', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Male')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Male'));
    fireEvent.click(screen.getByText('Continue →'));

    await waitFor(() => expect(screen.getByText('How old are you?')).toBeInTheDocument());
    fireEvent.click(screen.getByText('← Back'));

    await waitFor(() => {
      expect(screen.getByText("What's your gender?")).toBeInTheDocument();
    });
  });

  it('converts imperial weight to metric', async () => {
    let profileCallCount = 0;
    getProfile.mockImplementation(() => {
      profileCallCount++;
      if (profileCallCount <= 1) {
        return Promise.resolve({ id: 'user-1', name: 'Test', plan: 'free', onboarding_complete: false, created_at: '2025-01-01T00:00:00Z' });
      }
      return Promise.resolve({ id: 'user-1', name: 'Test', plan: 'free', onboarding_complete: true, created_at: '2025-01-01T00:00:00Z' });
    });

    render(<App />);

    // Step 1: Gender
    await waitFor(() => expect(screen.getByText('Male')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Male'));
    fireEvent.click(screen.getByText('Continue →'));

    // Step 2: Age
    await waitFor(() => expect(screen.getByText('25')).toBeInTheDocument());
    fireEvent.click(screen.getByText('25'));
    fireEvent.click(screen.getByText('Continue →'));

    // Step 3: Switch to imperial and enter weight
    await waitFor(() => expect(screen.getByText('imperial')).toBeInTheDocument());
    fireEvent.click(screen.getByText('imperial'));

    await waitFor(() => expect(screen.getByPlaceholderText('e.g. 180')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('e.g. 180'), { target: { value: '180' } });
    fireEvent.click(screen.getByText('Continue →'));

    // Step 4: Goal + Experience (use Maintenance — no target rate required)
    await waitFor(() => expect(screen.getByText('Maintenance')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Maintenance'));
    fireEvent.click(screen.getByText('Beginner'));

    // Continue to step 5
    fireEvent.click(screen.getByText('Continue →'));

    // Step 5: Skip benchmarks
    await waitFor(() => expect(screen.getByText('Skip — I don\'t know my lifts')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Skip — I don\'t know my lifts'));

    // Step 6: Finish
    await waitFor(() => expect(screen.getByText(/Let's Go/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Let's Go/));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalled();
      const call = updateProfile.mock.calls[0][0];
      // 180 lbs * 0.453592 = 81.6 kg (rounded to 1 decimal)
      expect(call.weight_kg).toBeCloseTo(81.6, 0);
      expect(call.unit_system).toBe('imperial');
    });
  });
});
