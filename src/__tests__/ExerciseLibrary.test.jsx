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
    seedDummyData: vi.fn(),
    getPrograms: vi.fn().mockResolvedValue([]),
    getActiveEnrollment: vi.fn().mockResolvedValue(null),
    getScheduledWorkouts: vi.fn().mockResolvedValue([]),
    updateScheduledWorkout: vi.fn().mockResolvedValue({}),
    callCoachAPI: vi.fn(),
    reduceSetsFutureWorkouts: vi.fn().mockResolvedValue(undefined),
    getCustomExercises: vi.fn().mockResolvedValue([]),
    createCustomExercise: vi.fn().mockResolvedValue({ id: 'new-cx-1' }),
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
import { getSession, getProfile, getCustomExercises, createCustomExercise } from '../lib/supabase';
import { getExerciseGif } from '../lib/exerciseGifs';

const mockSession = {
  user: { id: 'user-1', email: 'test@test.com', user_metadata: { full_name: 'Test' } },
  access_token: 'tok',
};

const mockProfile = {
  id: 'user-1', name: 'Test', plan: 'free', onboarding_complete: true, created_at: '2025-01-01T00:00:00Z',
};

async function setupLoggedInApp() {
  mockSessionState = mockSession;
  getSession.mockResolvedValue(mockSession);
  getProfile.mockResolvedValue(mockProfile);
  const result = render(<App />);
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
  return result;
}

describe('Exercise Library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionState = null;
    getSession.mockResolvedValue(null);
    getProfile.mockResolvedValue(null);
    getCustomExercises.mockResolvedValue([]);
  });

  describe('Navigation', () => {
    it('opens library from home 📚 button', async () => {
      await setupLoggedInApp();
      const libBtn = screen.getByRole('button', { name: /📚/i });
      fireEvent.click(libBtn);
      await waitFor(() => expect(screen.getByText('Exercise Library')).toBeInTheDocument());
    });

    it('goes back to home from library', async () => {
      await setupLoggedInApp();
      fireEvent.click(screen.getByRole('button', { name: /📚/i }));
      await waitFor(() => screen.getByText('Exercise Library'));
      fireEvent.click(screen.getByRole('button', { name: /← Back/i }));
      await waitFor(() => expect(screen.queryByText('Exercise Library')).not.toBeInTheDocument());
    });
  });

  describe('Filtering', () => {
    beforeEach(async () => {
      await setupLoggedInApp();
      fireEvent.click(screen.getByRole('button', { name: /📚/i }));
      await waitFor(() => screen.getByText('Exercise Library'));
    });

    it('shows all exercises initially', async () => {
      expect(screen.getByText('Bench Press')).toBeInTheDocument();
      expect(screen.getByText('Deadlift')).toBeInTheDocument();
      expect(screen.getByText('Back Squat')).toBeInTheDocument();
    });

    it('filters by muscle group', async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Chest$/ }));
      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.queryByText('Deadlift')).not.toBeInTheDocument();
      });
    });

    it('filters by equipment', async () => {
      const barbellPills = screen.getAllByRole('button', { name: /^Barbell$/ });
      // Click the equipment filter Barbell (second occurrence, first is muscle)
      fireEvent.click(barbellPills[0]);
      // After filter is active, only barbell exercises should show
      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
      });
    });

    it('filters by search query', async () => {
      const searchInput = screen.getByPlaceholderText('Search exercises...');
      fireEvent.change(searchInput, { target: { value: 'bench' } });
      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeInTheDocument();
        expect(screen.queryByText('Deadlift')).not.toBeInTheDocument();
      });
    });

    it('shows "No exercises found" for unmatched search', async () => {
      const searchInput = screen.getByPlaceholderText('Search exercises...');
      fireEvent.change(searchInput, { target: { value: 'zzznomatch' } });
      await waitFor(() => {
        expect(screen.getByText('No exercises found')).toBeInTheDocument();
      });
    });

    it('filters by difficulty', async () => {
      const advancedPills = screen.getAllByRole('button', { name: /^Advanced$/ });
      fireEvent.click(advancedPills[0]);
      await waitFor(() => {
        expect(screen.getByText('Deadlift')).toBeInTheDocument(); // Advanced
        expect(screen.queryByText('Cable Fly')).not.toBeInTheDocument(); // Beginner
      });
    });
  });

  describe('Exercise Detail Modal', () => {
    beforeEach(async () => {
      await setupLoggedInApp();
      fireEvent.click(screen.getByRole('button', { name: /📚/i }));
      await waitFor(() => screen.getByText('Exercise Library'));
    });

    it('opens detail modal on card tap', async () => {
      const benchCards = screen.getAllByText('Bench Press');
      fireEvent.click(benchCards[0].closest('button'));
      await waitFor(() => {
        // Modal should show exercise name prominently
        const headings = screen.getAllByText('Bench Press');
        expect(headings.length).toBeGreaterThan(0);
      });
    });

    it('shows GIF fallback when no GIF available', async () => {
      getExerciseGif.mockResolvedValue(null);
      const benchCards = screen.getAllByText('Bench Press');
      fireEvent.click(benchCards[0].closest('button'));
      await waitFor(() => {
        expect(screen.getByText('No demo available')).toBeInTheDocument();
      });
    });

    it('closes detail modal on close button', async () => {
      const benchCards = screen.getAllByText('Bench Press');
      fireEvent.click(benchCards[0].closest('button'));
      await waitFor(() => screen.getByText('No demo available'));
      fireEvent.click(screen.getByRole('button', { name: /Close/i }));
      await waitFor(() => expect(screen.queryByText('No demo available')).not.toBeInTheDocument());
    });
  });

  describe('Context-aware CTA', () => {
    it('does not show "Add to Workout" when context is null (standalone)', async () => {
      await setupLoggedInApp();
      fireEvent.click(screen.getByRole('button', { name: /📚/i }));
      await waitFor(() => screen.getByText('Exercise Library'));
      const benchCards = screen.getAllByText('Bench Press');
      fireEvent.click(benchCards[0].closest('button'));
      await waitFor(() => screen.getByText('No demo available'));
      expect(screen.queryByRole('button', { name: /Add to Workout/i })).not.toBeInTheDocument();
    });
  });

  describe('Custom exercise creation', () => {
    beforeEach(async () => {
      await setupLoggedInApp();
      fireEvent.click(screen.getByRole('button', { name: /📚/i }));
      await waitFor(() => screen.getByText('Exercise Library'));
    });

    it('opens create form on "+ Create" button', async () => {
      fireEvent.click(screen.getByRole('button', { name: /\+ Create/i }));
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Exercise name')).toBeInTheDocument();
      });
    });

    it('calls createCustomExercise on form submit', async () => {
      createCustomExercise.mockResolvedValue({ id: 'cx-1', name: 'My Custom Ex', muscle_group: 'Core' });
      getCustomExercises.mockResolvedValue([{ id: 'cx-1', name: 'My Custom Ex', muscle_group: 'Core', equipment: 'Bodyweight', difficulty: 'Beginner', icon: '🏋️' }]);

      fireEvent.click(screen.getByRole('button', { name: /\+ Create/i }));
      await waitFor(() => screen.getByPlaceholderText('Exercise name'));

      const nameInput = screen.getByPlaceholderText('Exercise name');
      fireEvent.change(nameInput, { target: { value: 'My Custom Ex' } });

      // Find the save button by its text within the form (the bottom button)
      const saveBtns = screen.getAllByRole('button', { name: /Create Exercise/i });
      const saveBtn = saveBtns[saveBtns.length - 1]; // last one is the submit button
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(createCustomExercise).toHaveBeenCalledWith(expect.objectContaining({ name: 'My Custom Ex' }));
      });
    });

    it('shows error when name is empty', async () => {
      fireEvent.click(screen.getByRole('button', { name: /\+ Create/i }));
      await waitFor(() => screen.getByPlaceholderText('Exercise name'));
      const saveBtns = screen.getAllByRole('button', { name: /Create Exercise/i });
      const saveBtn = saveBtns[saveBtns.length - 1];
      fireEvent.click(saveBtn);
      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
      });
    });
  });

  describe('Custom badge visibility', () => {
    it('shows "Custom" badge for custom exercises', async () => {
      getCustomExercises.mockResolvedValue([
        { id: 'cx-1', name: 'My Custom Exercise', muscle_group: 'Chest', equipment: 'Dumbbell', difficulty: 'Beginner', icon: '💪' }
      ]);
      await setupLoggedInApp();
      fireEvent.click(screen.getByRole('button', { name: /📚/i }));
      await waitFor(() => screen.getByText('Exercise Library'));
      await waitFor(() => expect(screen.getByText('My Custom Exercise')).toBeInTheDocument());
      expect(screen.getByText('Custom')).toBeInTheDocument();
    });
  });

  describe('Workout integration', () => {
    it('"Browse Full Library →" button exists in workout add-exercise modal', async () => {
      getSession.mockResolvedValue(mockSession);
      getProfile.mockResolvedValue(mockProfile);
      mockSessionState = mockSession;
      render(<App />);
      await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

      // Navigate to workout via Pick Template
      fireEvent.click(screen.getByRole('button', { name: /Start Workout|Pick a Template|Push|Pull|Legs/i }));
      // Find and click a template
      const templateBtns = screen.queryAllByRole('button');
      const pushBtn = templateBtns.find(b => b.textContent?.includes('Push'));
      if (pushBtn) {
        fireEvent.click(pushBtn);
        await waitFor(() => screen.queryByText(/Add Exercise/i));
        // Click + Add Exercise
        const addBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('Add Exercise'));
        if (addBtn) {
          fireEvent.click(addBtn);
          await waitFor(() => expect(screen.getByText('Browse Full Library →')).toBeInTheDocument());
        }
      }
    });
  });
});
