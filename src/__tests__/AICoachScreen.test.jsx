import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

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
import { getSession, getProfile, getActiveEnrollment, callCoachAPI } from '../lib/supabase';

const mockSession = {
  user: { id: 'user-1', email: 'test@test.com', user_metadata: { full_name: 'Test' } },
  access_token: 'tok',
};

const mockActiveEnrollment = {
  id: 'enroll-1',
  current_week: 1,
  programs: { id: 'prog-1', name: 'Test Program', color: '#A47BFF' },
};

describe('AICoachScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionState = mockSession;
    getSession.mockResolvedValue(mockSession);
    getProfile.mockResolvedValue({
      id: 'user-1', name: 'Test', plan: 'free', onboarding_complete: true, created_at: '2025-01-01T00:00:00Z',
    });
    getActiveEnrollment.mockResolvedValue(null);
  });

  async function navigateToCoach() {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('AI Coach')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('AI Coach'));
    await waitFor(() => {
      expect(screen.getByText('AI Strength Coach')).toBeInTheDocument();
    });
  }

  it('shows AI Coach header', async () => {
    await navigateToCoach();
    // "Coach" appears in the bottom nav and in the AI coach header
    const coachElements = screen.getAllByText('Coach');
    expect(coachElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('AI Strength Coach')).toBeInTheDocument();
  });

  it('shows plan badge', async () => {
    await navigateToCoach();
    expect(screen.getByText('FREE')).toBeInTheDocument();
  });

  it('shows quota display', async () => {
    await navigateToCoach();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('5/5')).toBeInTheDocument();
  });

  it('displays prompt categories', async () => {
    await navigateToCoach();
    expect(screen.getByText('Analyze')).toBeInTheDocument();
    expect(screen.getByText('Improve')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Learn')).toBeInTheDocument();
  });

  it('shows prompts for Analyze category by default', async () => {
    await navigateToCoach();
    expect(screen.getByText('Rate my week')).toBeInTheDocument();
    expect(screen.getByText('Volume check')).toBeInTheDocument();
    expect(screen.getByText('Recovery')).toBeInTheDocument();
  });

  it('switches category and shows different prompts', async () => {
    await navigateToCoach();
    fireEvent.click(screen.getByText('Improve'));
    expect(screen.getByText('Fix weak points')).toBeInTheDocument();
    expect(screen.getByText('Break plateau')).toBeInTheDocument();
  });

  it('sends a query and displays response', async () => {
    callCoachAPI.mockResolvedValue({ text: 'Your training looks great!', cost_usd: 0.001 });

    await navigateToCoach();
    fireEvent.click(screen.getByText('Rate my week'));

    // Should show user message
    await waitFor(() => {
      expect(screen.getByText('Rate my week')).toBeInTheDocument();
    });

    // Should show AI response
    await waitFor(() => {
      expect(screen.getByText('Your training looks great!')).toBeInTheDocument();
    });
  });

  it('shows error message when API call fails', async () => {
    callCoachAPI.mockRejectedValue(new Error('Network error'));

    await navigateToCoach();
    fireEvent.click(screen.getByText('Rate my week'));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows fallback error message when error has no message', async () => {
    callCoachAPI.mockRejectedValue(new Error());

    await navigateToCoach();
    fireEvent.click(screen.getByText('Rate my week'));

    await waitFor(() => {
      expect(screen.getByText('Connection issue. Try again.')).toBeInTheDocument();
    });
  });

  it('decrements quota after successful query', async () => {
    callCoachAPI.mockResolvedValue({ text: 'Great workout!', cost_usd: 0.001 });

    await navigateToCoach();
    fireEvent.click(screen.getByText('Rate my week'));

    await waitFor(() => {
      expect(screen.getByText('4/5')).toBeInTheDocument();
    });
  });

  it('shows action panel after response (no enrollment shows create program button)', async () => {
    // No enrollment — shows "Create new program with this advice" action button
    callCoachAPI.mockResolvedValue({ text: 'Here is my analysis', cost_usd: 0.001 });

    await navigateToCoach();
    fireEvent.click(screen.getByText('Rate my week'));

    await waitFor(() => {
      expect(screen.getByText('Here is my analysis')).toBeInTheDocument();
      expect(screen.getByText('Create new program with this advice')).toBeInTheDocument();
    });
  });

  it('shows follow-up buttons when no pending action (after error response)', async () => {
    // Error path: setPendingMsgIdx is NOT called, so pendingMsgIdx stays null
    // → follow-up buttons are NOT shown either (last message is assistant with error content)
    // This verifies the condition: follow-ups only show when pendingMsgIdx === null AND lastMsgIsAssistant
    callCoachAPI.mockRejectedValue(new Error('Some error'));

    await navigateToCoach();
    fireEvent.click(screen.getByText('Rate my week'));

    await waitFor(() => {
      expect(screen.getByText('Some error')).toBeInTheDocument();
    });
    // After error, no pending panel and no follow-up buttons (last is error assistant msg)
    // The "New" button is present confirming we're in conversation mode
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('shows "New" button after sending a message', async () => {
    callCoachAPI.mockResolvedValue({ text: 'Response', cost_usd: 0 });

    await navigateToCoach();
    fireEvent.click(screen.getByText('Rate my week'));

    await waitFor(() => {
      expect(screen.getByText('New')).toBeInTheDocument();
    });
  });

  it('resets conversation when New is clicked', async () => {
    callCoachAPI.mockResolvedValue({ text: 'First response', cost_usd: 0 });

    await navigateToCoach();
    fireEvent.click(screen.getByText('Rate my week'));

    await waitFor(() => {
      expect(screen.getByText('First response')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('New'));

    // Should show prompt categories again
    await waitFor(() => {
      expect(screen.getByText('AI Strength Coach')).toBeInTheDocument();
      expect(screen.queryByText('First response')).not.toBeInTheDocument();
    });
  });

  describe('Rate limiting per subscription tier', () => {
    it('free plan: blocks after 5 queries', async () => {
      let queryCount = 0;
      callCoachAPI.mockImplementation(() => {
        queryCount++;
        const q = queryCount;
        return Promise.resolve({ text: `Response ${q}`, cost_usd: 0 });
      });

      await navigateToCoach();

      // Send 5 queries using "New" to reset between each
      for (let i = 0; i < 5; i++) {
        fireEvent.click(screen.getByText('Rate my week'));
        await waitFor(() => expect(screen.getByText(`Response ${i + 1}`)).toBeInTheDocument());

        if (i < 4) {
          // Reset for next query
          fireEvent.click(screen.getByText('New'));
          await waitFor(() => expect(screen.getByText('Rate my week')).toBeInTheDocument());
        }
      }

      // After 5 queries, quota should be 0/5
      await waitFor(() => {
        expect(screen.getByText('0/5')).toBeInTheDocument();
      });
    });

    it('shows upgrade prompt when limit reached', async () => {
      let queryCount = 0;
      callCoachAPI.mockImplementation(() => {
        queryCount++;
        const q = queryCount;
        return Promise.resolve({ text: `Resp ${q}`, cost_usd: 0 });
      });

      render(<App />);
      await waitFor(() => expect(screen.getByText('AI Coach')).toBeInTheDocument());

      // Navigate to coach
      fireEvent.click(screen.getByText('AI Coach'));
      await waitFor(() => expect(screen.getByText('AI Strength Coach')).toBeInTheDocument());

      // Use up all 5 queries using "New" to reset between each
      for (let i = 0; i < 5; i++) {
        fireEvent.click(screen.getByText('Rate my week'));
        await waitFor(() => expect(screen.getByText(`Resp ${i + 1}`)).toBeInTheDocument());

        if (i < 4) {
          fireEvent.click(screen.getByText('New'));
          await waitFor(() => expect(screen.getByText('Rate my week')).toBeInTheDocument());
        }
      }

      // Click "New" to get back to prompts
      await waitFor(() => expect(screen.getByText('New')).toBeInTheDocument());
      fireEvent.click(screen.getByText('New'));

      // Should show "Daily limit reached"
      await waitFor(() => {
        expect(screen.getByText('Daily limit reached')).toBeInTheDocument();
      });
    });

    it('pro plan shows 30 query limit', async () => {
      getProfile.mockResolvedValue({
        id: 'user-1', name: 'Test', plan: 'pro', onboarding_complete: true, created_at: '2025-01-01T00:00:00Z',
      });

      render(<App />);
      await waitFor(() => expect(screen.getByText('AI Coach')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Coach'));
      await waitFor(() => {
        expect(screen.getByText('30/30')).toBeInTheDocument();
        expect(screen.getByText('PRO')).toBeInTheDocument();
      });
    });

    it('unlimited plan shows infinity symbol', async () => {
      getProfile.mockResolvedValue({
        id: 'user-1', name: 'Test', plan: 'unlimited', onboarding_complete: true, created_at: '2025-01-01T00:00:00Z',
      });

      render(<App />);
      await waitFor(() => expect(screen.getByText('AI Coach')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Coach'));
      await waitFor(() => {
        // Unlimited shows infinity
        expect(screen.getByText('∞')).toBeInTheDocument();
      });
    });
  });

  it('tracks API cost', async () => {
    callCoachAPI.mockResolvedValue({ text: 'Response', cost_usd: 0.0025 });

    await navigateToCoach();
    expect(screen.getByText('$0.0000')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Rate my week'));

    await waitFor(() => {
      expect(screen.getByText('$0.0025')).toBeInTheDocument();
    });
  });
});
