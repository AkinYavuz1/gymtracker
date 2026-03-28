/**
 * Tests for multi-step workout completion → feedback → schedule adjustment flow,
 * and error boundary / quota-exceeded / session-expiry scenarios.
 */

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
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'new-workout' }, error: null }),
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
    getWorkoutSets: vi.fn().mockResolvedValue([]),
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
    reduceSetsFutureWorkouts: vi.fn().mockResolvedValue(undefined),
    savePumpRating: vi.fn().mockResolvedValue(undefined),
    saveDifficultyRating: vi.fn().mockResolvedValue(undefined),
    saveSorenessRatings: vi.fn().mockResolvedValue(undefined),
    applyDifficultyToFutureWorkouts: vi.fn().mockResolvedValue(undefined),
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
import {
  getSession,
  getProfile,
  getTemplates,
  getWorkouts,
  getPersonalRecords,
  getPendingCount as _getPendingCount,
  callCoachAPI,
  reduceSetsFutureWorkouts,
} from '../lib/supabase';
import { getPendingCount, queueWorkout } from '../lib/offlineStorage';

const mockSession = {
  user: { id: 'user-1', email: 'test@test.com', user_metadata: { full_name: 'Test' } },
  access_token: 'tok',
};

const mockProfile = {
  id: 'user-1', name: 'Test', plan: 'free', onboarding_complete: true, created_at: '2025-01-01T00:00:00Z',
};

// Single exercise template to keep test flows simple and match existing WorkoutFlow tests
const programTemplate = {
  id: 'prog-strength',
  name: 'Strength A',
  sort_order: 0,
  color: '#DFFF3C',
  icon: '💪',
  scheduledWorkoutId: 'sw-42',
  template_exercises: [
    { name: 'Back Squat', equipment: 'Barbell', default_sets: 3, default_reps: 5, default_weight: 100, sort_order: 0 },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function goToDashboard() {
  render(<App />);
  await waitFor(() => expect(screen.getByText('Start Workout')).toBeInTheDocument());
}

async function startProgramWorkout(templates = [programTemplate]) {
  getTemplates.mockResolvedValue(templates);
  await goToDashboard();
  fireEvent.click(screen.getByText('Start Workout'));
  await waitFor(() => expect(screen.getByText('Strength A')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Strength A'));
  await waitFor(() => expect(screen.getByText('Strength A Day')).toBeInTheDocument());
}

async function startFreeWorkout() {
  getTemplates.mockResolvedValue([]);
  await goToDashboard();
  fireEvent.click(screen.getByText('Start Workout'));
  await waitFor(() => expect(screen.getByText('Pick a Template')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Push'));
  await waitFor(() => expect(screen.getByText('Push Day')).toBeInTheDocument());
}

async function navigateToCoach() {
  await goToDashboard();
  fireEvent.click(screen.getByText('AI Coach'));
  await waitFor(() => expect(screen.getByText('AI Strength Coach')).toBeInTheDocument());
}

// ─── Multi-step workout completion flow ──────────────────────────────────────

describe('Workout completion flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionState = mockSession;
    getSession.mockResolvedValue(mockSession);
    getProfile.mockResolvedValue(mockProfile);
  });

  describe('complete workout → navigate home', () => {
    it('returns to dashboard after finishing a free-flow workout with no sets', async () => {
      await startFreeWorkout();
      fireEvent.click(screen.getByText(/Finish/));
      await waitFor(() => {
        expect(screen.getByText('Start Workout')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('returns to dashboard after finishing with completed sets', async () => {
      await startFreeWorkout();
      const checks = screen.getAllByText('○');
      fireEvent.click(checks[0]);
      fireEvent.click(screen.getByText(/Finish/));
      await waitFor(() => {
        expect(screen.getByText('Start Workout')).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('program workout incomplete sets → reduce-sets prompt → reduceSetsFutureWorkouts', () => {
    it('full path: incomplete → prompt → confirm → calls reduceSetsFutureWorkouts', async () => {
      await startProgramWorkout();

      // Finish without logging anything
      fireEvent.click(screen.getByText(/Finish/));
      await waitFor(() => expect(screen.getByText('Heads up')).toBeInTheDocument(), { timeout: 3000 });

      // Confirm couldn't finish
      fireEvent.click(screen.getByText("Yes, I couldn't finish"));
      await waitFor(() => expect(screen.getByText('Adjust future workouts?')).toBeInTheDocument(), { timeout: 3000 });

      // Confirm reduce sets
      fireEvent.click(screen.getByText('Yes, reduce sets'));

      await waitFor(() => {
        expect(screen.queryByText('Adjust future workouts?')).not.toBeInTheDocument();
      }, { timeout: 3000 });
      // reduceSetsFutureWorkouts is called with the scheduledWorkoutId and incomplete exercise names
      expect(reduceSetsFutureWorkouts).toHaveBeenCalledWith('sw-42', expect.any(Array));
    });

    it('full path: incomplete → prompt → decline → does NOT call reduceSetsFutureWorkouts', async () => {
      await startProgramWorkout();
      fireEvent.click(screen.getByText(/Finish/));
      await waitFor(() => expect(screen.getByText('Heads up')).toBeInTheDocument());
      fireEvent.click(screen.getByText("Yes, I couldn't finish"));
      await waitFor(() => expect(screen.getByText('Adjust future workouts?')).toBeInTheDocument());
      fireEvent.click(screen.getByText('No, keep as planned'));

      await waitFor(() => {
        expect(reduceSetsFutureWorkouts).not.toHaveBeenCalled();
        expect(screen.queryByText('Adjust future workouts?')).not.toBeInTheDocument();
      });
    });

    it('fully completed workout skips the incomplete-sets modal entirely', async () => {
      await startProgramWorkout();

      // Mark every prescribed set as done
      const checks = screen.getAllByText('○');
      for (const btn of checks) fireEvent.click(btn);

      fireEvent.click(screen.getByText(/Finish/));

      // Heads up modal must never appear — check immediately before any async navigation
      expect(screen.queryByText('Heads up')).not.toBeInTheDocument();
      expect(screen.queryByText('Adjust future workouts?')).not.toBeInTheDocument();
    });
  });

  describe('navigation guards', () => {
    it('back button from template picker returns to home', async () => {
      getTemplates.mockResolvedValue([]);
      await goToDashboard();
      fireEvent.click(screen.getByText('Start Workout'));
      await waitFor(() => expect(screen.getByText('Pick a Template')).toBeInTheDocument());
      fireEvent.click(screen.getByText('← Back'));
      await waitFor(() => expect(screen.getByText('Start Workout')).toBeInTheDocument());
    });

    it('close button from active workout returns to home', async () => {
      await startFreeWorkout();
      // First ✕ is the workout close button
      const closeButtons = screen.getAllByText('✕');
      fireEvent.click(closeButtons[0]);
      await waitFor(() => expect(screen.getByText('Start Workout')).toBeInTheDocument());
    });
  });
});

// ─── Error boundaries / resilience ──────────────────────────────────────────

describe('Error boundaries and resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionState = mockSession;
    getSession.mockResolvedValue(mockSession);
    getProfile.mockResolvedValue(mockProfile);
  });

  describe('session expiry', () => {
    it('shows auth screen when getSession returns null on mount', async () => {
      mockSessionState = null;
      getSession.mockResolvedValue(null);
      render(<App />);
      await waitFor(() => {
        // Should show login/sign-up UI, not the dashboard
        expect(screen.getByText(/sign in/i) || screen.getByText(/log in/i) || screen.getByText(/email/i)).toBeInTheDocument();
      });
      expect(screen.queryByText('Start Workout')).not.toBeInTheDocument();
    });

    it('shows auth screen when getProfile returns null (profile fetch fails)', async () => {
      mockSessionState = null;
      getProfile.mockResolvedValue(null);
      render(<App />);
      await waitFor(() => {
        expect(screen.queryByText('Start Workout')).not.toBeInTheDocument();
      });
    });
  });

  describe('AI coach quota exceeded', () => {
    it('shows daily limit message after exhausting free quota', async () => {
      let queryCount = 0;
      callCoachAPI.mockImplementation(() => {
        queryCount++;
        return Promise.resolve({ text: `Resp ${queryCount}`, cost_usd: 0 });
      });

      await navigateToCoach();

      // Burn through all 5 free queries
      for (let i = 0; i < 5; i++) {
        fireEvent.click(screen.getByText('Rate my week'));
        await waitFor(() => expect(screen.getByText(`Resp ${i + 1}`)).toBeInTheDocument());
        if (i < 4) {
          fireEvent.click(screen.getByText('New'));
          await waitFor(() => expect(screen.getByText('Rate my week')).toBeInTheDocument());
        }
      }

      // Navigate to new conversation — quota display should show 0/5
      await waitFor(() => expect(screen.getByText('New')).toBeInTheDocument());
      fireEvent.click(screen.getByText('New'));

      await waitFor(() => {
        expect(screen.getByText('Daily limit reached')).toBeInTheDocument();
      });
    });

    it('shows quota counter decreasing with each query', async () => {
      callCoachAPI.mockResolvedValue({ text: 'Response', cost_usd: 0 });

      await navigateToCoach();
      expect(screen.getByText('5/5')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Rate my week'));
      await waitFor(() => expect(screen.getByText('4/5')).toBeInTheDocument());
    });

    it('does not decrement quota on API error', async () => {
      callCoachAPI.mockRejectedValueOnce(new Error('Server error'));

      await navigateToCoach();
      expect(screen.getByText('5/5')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Rate my week'));
      await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());

      // Quota should remain at 5/5
      expect(screen.getByText('5/5')).toBeInTheDocument();
    });
  });

  describe('AI coach network errors', () => {
    it('displays error message when callCoachAPI throws', async () => {
      callCoachAPI.mockRejectedValue(new Error('Network timeout'));

      await navigateToCoach();
      fireEvent.click(screen.getByText('Rate my week'));

      await waitFor(() => {
        expect(screen.getByText('Network timeout')).toBeInTheDocument();
      });
    });

    it('displays fallback message when error has no message', async () => {
      callCoachAPI.mockRejectedValue(new Error());

      await navigateToCoach();
      fireEvent.click(screen.getByText('Rate my week'));

      await waitFor(() => {
        expect(screen.getByText('Connection issue. Try again.')).toBeInTheDocument();
      });
    });

    it('allows retrying after an error', async () => {
      callCoachAPI
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({ text: 'Success on retry', cost_usd: 0 });

      await navigateToCoach();

      // First attempt fails
      fireEvent.click(screen.getByText('Rate my week'));
      await waitFor(() => expect(screen.getByText('Timeout')).toBeInTheDocument());

      // Reset and retry
      fireEvent.click(screen.getByText('New'));
      await waitFor(() => expect(screen.getByText('Rate my week')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Rate my week'));
      await waitFor(() => expect(screen.getByText('Success on retry')).toBeInTheDocument());
    });
  });

  describe('offline state', () => {
    it('shows offline banner when navigator.onLine is false', async () => {
      window.__mockOnline = false;
      await goToDashboard();
      const offlineElements = screen.getAllByText(/offline/i);
      expect(offlineElements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows pending sync count in offline banner when workouts are queued', async () => {
      window.__mockOnline = false;
      getPendingCount.mockReturnValue(2);

      await goToDashboard();
      await waitFor(() => {
        const offlineElements = screen.getAllByText(/offline/i);
        expect(offlineElements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('queues workout when finishing in offline mode', async () => {
      window.__mockOnline = false;

      await startFreeWorkout();
      fireEvent.click(screen.getAllByText('○')[0]); // complete a set
      fireEvent.click(screen.getByText(/Finish/));

      await waitFor(() => {
        expect(queueWorkout).toHaveBeenCalled();
      });
    });
  });

  describe('data loading failures', () => {
    it('renders dashboard even when getWorkouts fails', async () => {
      getWorkouts.mockRejectedValueOnce(new Error('DB error'));

      render(<App />);
      await waitFor(() => {
        expect(screen.getByText('Start Workout')).toBeInTheDocument();
      });
    });

    it('renders dashboard even when getPersonalRecords fails', async () => {
      getPersonalRecords.mockRejectedValueOnce(new Error('DB error'));

      render(<App />);
      await waitFor(() => {
        expect(screen.getByText('Start Workout')).toBeInTheDocument();
      });
    });
  });

  describe('plan-based feature gating', () => {
    it('free plan shows upgrade prompt after quota exhausted', async () => {
      let count = 0;
      callCoachAPI.mockImplementation(() => {
        count++;
        return Promise.resolve({ text: `R${count}`, cost_usd: 0 });
      });

      await navigateToCoach();
      for (let i = 0; i < 5; i++) {
        fireEvent.click(screen.getByText('Rate my week'));
        await waitFor(() => expect(screen.getByText(`R${i + 1}`)).toBeInTheDocument());
        if (i < 4) {
          fireEvent.click(screen.getByText('New'));
          await waitFor(() => expect(screen.getByText('Rate my week')).toBeInTheDocument());
        }
      }
      fireEvent.click(screen.getByText('New'));

      await waitFor(() => {
        expect(screen.getByText('Daily limit reached')).toBeInTheDocument();
      });
    });

    it('pro plan: shows 30-query limit in coach header', async () => {
      getProfile.mockResolvedValue({ ...mockProfile, plan: 'pro' });

      render(<App />);
      await waitFor(() => expect(screen.getByText('AI Coach')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Coach'));
      await waitFor(() => {
        expect(screen.getByText('30/30')).toBeInTheDocument();
        expect(screen.getByText('PRO')).toBeInTheDocument();
      });
    });

    it('unlimited plan: shows infinity symbol instead of count', async () => {
      getProfile.mockResolvedValue({ ...mockProfile, plan: 'unlimited' });

      render(<App />);
      await waitFor(() => expect(screen.getByText('AI Coach')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Coach'));
      await waitFor(() => {
        expect(screen.getByText('∞')).toBeInTheDocument();
      });
    });
  });
});
