import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }) },
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
  },
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
  updateScheduledWorkout: vi.fn().mockResolvedValue({}),
  reduceSetsFutureWorkouts: vi.fn().mockResolvedValue(undefined),
  getCustomExercises: vi.fn().mockResolvedValue([]),
  createCustomExercise: vi.fn().mockResolvedValue({ id: 'cx-1' }),
  updateCustomExercise: vi.fn().mockResolvedValue({}),
  deleteCustomExercise: vi.fn().mockResolvedValue(undefined),
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
import { getSession, getProfile, getTemplates, supabase, reduceSetsFutureWorkouts } from '../lib/supabase';
import { queueWorkout } from '../lib/offlineStorage';

const mockSession = {
  user: { id: 'user-1', email: 'test@test.com', user_metadata: { full_name: 'Test' } },
  access_token: 'tok',
};

const mockProfileData = {
  id: 'user-1', name: 'Test', plan: 'free', onboarding_complete: true, created_at: '2025-01-01T00:00:00Z',
};

describe('Workout Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue(mockSession);
    getProfile.mockResolvedValue(mockProfileData);
    getTemplates.mockResolvedValue([]);
  });

  async function goToTemplatePicker() {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Start Workout')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Start Workout'));
    await waitFor(() => expect(screen.getByText('Pick a Template')).toBeInTheDocument());
  }

  describe('Template Picker', () => {
    it('shows template picker with defaults when no DB templates', async () => {
      await goToTemplatePicker();
      expect(screen.getByText('Push')).toBeInTheDocument();
      expect(screen.getByText('Pull')).toBeInTheDocument();
      expect(screen.getByText('Legs')).toBeInTheDocument();
      expect(screen.getByText('Upper')).toBeInTheDocument();
    });

    it('shows back button', async () => {
      await goToTemplatePicker();
      expect(screen.getByText('← Back')).toBeInTheDocument();
    });

    it('navigates back to home when back is clicked', async () => {
      await goToTemplatePicker();
      fireEvent.click(screen.getByText('← Back'));
      await waitFor(() => {
        expect(screen.getByText('Start Workout')).toBeInTheDocument();
      });
    });

    it('shows exercise count per template', async () => {
      await goToTemplatePicker();
      const exerciseCounts = screen.getAllByText(/exercises$/);
      expect(exerciseCounts.length).toBeGreaterThan(0);
    });

    it('loads templates from DB when available', async () => {
      getTemplates.mockResolvedValue([
        {
          id: 'db-1',
          name: 'Custom Push',
          sort_order: 0,
          color: '#DFFF3C',
          icon: '💪',
          template_exercises: [
            { name: 'Bench Press', equipment: 'Barbell', default_sets: 4, default_reps: 8, default_weight: 100, sort_order: 0 },
          ],
        },
      ]);

      await goToTemplatePicker();
      await waitFor(() => {
        expect(screen.getByText('Custom Push')).toBeInTheDocument();
      });
    });
  });

  describe('Workout Screen', () => {
    async function startWorkout() {
      await goToTemplatePicker();
      // Click on "Push" template
      fireEvent.click(screen.getByText('Push'));
      await waitFor(() => {
        expect(screen.getByText('Push Day')).toBeInTheDocument();
      });
    }

    it('shows workout timer', async () => {
      await startWorkout();
      // Two 00:00 elements exist: Workout Duration + Stopwatch
      const timers = screen.getAllByText('00:00');
      expect(timers.length).toBeGreaterThanOrEqual(1);
    });

    it('shows exercise list', async () => {
      await startWorkout();
      expect(screen.getByText('Bench Press')).toBeInTheDocument();
      expect(screen.getByText('Overhead Press')).toBeInTheDocument();
    });

    it('shows set/rep table for each exercise', async () => {
      await startWorkout();
      // Should show column headers
      const setHeaders = screen.getAllByText('Set');
      expect(setHeaders.length).toBeGreaterThan(0);
      const kgHeaders = screen.getAllByText('Kg');
      expect(kgHeaders.length).toBeGreaterThan(0);
    });

    it('shows progress bar', async () => {
      await startWorkout();
      // Progress indicator shows completed/total sets
      const progressText = screen.getByText(/^\d+\/\d+$/);
      expect(progressText).toBeInTheDocument();
    });

    it('shows Finish button', async () => {
      await startWorkout();
      expect(screen.getByText(/Finish/)).toBeInTheDocument();
    });

    it('shows close (back) button', async () => {
      await startWorkout();
      // Multiple ✕ buttons exist (close + exercise remove buttons)
      const closeButtons = screen.getAllByText('✕');
      expect(closeButtons.length).toBeGreaterThan(0);
    });

    it('marks set as done when checkbox clicked', async () => {
      await startWorkout();
      const checkButtons = screen.getAllByText('○');
      expect(checkButtons.length).toBeGreaterThan(0);

      fireEvent.click(checkButtons[0]);

      // Should now show checkmark
      const doneButtons = screen.getAllByText('✓');
      expect(doneButtons.length).toBeGreaterThan(0);
    });

    it('marks set as done when circle is tapped', async () => {
      await startWorkout();
      const checkButtons = screen.getAllByText('○');
      fireEvent.click(checkButtons[0]);

      // Set should now show a checkmark
      const doneButtons = screen.getAllByText('✓');
      expect(doneButtons.length).toBeGreaterThan(0);
    });

    it('shows stopwatch widget', async () => {
      await startWorkout();
      expect(screen.getByText('Stopwatch')).toBeInTheDocument();
      expect(screen.getByText('Start')).toBeInTheDocument();
      expect(screen.getByText('Reset')).toBeInTheDocument();
    });

    it('stopwatch starts when Start is clicked', async () => {
      await startWorkout();
      fireEvent.click(screen.getByText('Start'));
      // After clicking Start it becomes Stop
      await waitFor(() => expect(screen.getByText('Stop')).toBeInTheDocument());
    });

    it('can remove an exercise', async () => {
      await startWorkout();
      expect(screen.getByText('Bench Press')).toBeInTheDocument();

      // Find remove buttons (✕ for exercises, not the close button)
      const removeButtons = screen.getAllByText('✕');
      // The first ✕ is the close button, the rest are exercise remove buttons
      fireEvent.click(removeButtons[1]); // Remove first exercise

      expect(screen.queryByText('Bench Press')).not.toBeInTheDocument();
    });

    it('shows add exercise button', async () => {
      await startWorkout();
      expect(screen.getByText('+ Add Exercise')).toBeInTheDocument();
    });

    it('opens add exercise modal', async () => {
      await startWorkout();
      fireEvent.click(screen.getByText('+ Add Exercise'));

      await waitFor(() => {
        expect(screen.getByText('Add Exercise')).toBeInTheDocument();
        // Should show muscle group categories
        expect(screen.getByText('Chest')).toBeInTheDocument();
        expect(screen.getByText('Back')).toBeInTheDocument();
        expect(screen.getByText('Legs')).toBeInTheDocument();
      });
    });

    it('shows add set button for each exercise', async () => {
      await startWorkout();
      const addSetButtons = screen.getAllByText('+ Add Set');
      expect(addSetButtons.length).toBeGreaterThan(0);
    });

    it('adds a new set when + Add Set clicked', async () => {
      await startWorkout();
      const initialSetCount = screen.getAllByText('○').length;

      const addSetButtons = screen.getAllByText('+ Add Set');
      fireEvent.click(addSetButtons[0]);

      const newSetCount = screen.getAllByText('○').length;
      expect(newSetCount).toBe(initialSetCount + 1);
    });

    it('saves workout and navigates home on Finish', async () => {
      await startWorkout();

      // Don't mark any sets done — with no completed sets, onFinish([]) is called
      // and navigation goes directly to home (no PR celebration modal triggered)
      fireEvent.click(screen.getByText(/Finish/));

      await waitFor(() => {
        // Should navigate back to home
        expect(screen.getByText('Start Workout')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    describe('Incomplete sets warning (program workouts)', () => {
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

      async function startProgramWorkout() {
        getTemplates.mockResolvedValue([programTemplate]);
        render(<App />);
        await waitFor(() => expect(screen.getByText('Start Workout')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Start Workout'));
        // Wait for the DB-loaded template to appear
        await waitFor(() => expect(screen.getByText('Strength A')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Strength A'));
        await waitFor(() => expect(screen.getByText('Strength A Day')).toBeInTheDocument());
      }

      it('shows warning modal when finishing program workout with un-logged sets', async () => {
        await startProgramWorkout();

        // Do NOT mark any sets as done — tap Finish immediately
        fireEvent.click(screen.getByText(/Finish/));

        await waitFor(() => {
          expect(screen.getByText('Heads up')).toBeInTheDocument();
        });
      });

      it('modal shows correct count of un-logged sets', async () => {
        await startProgramWorkout();
        fireEvent.click(screen.getByText(/Finish/));

        await waitFor(() => {
          // 3 sets prescribed, 0 done → "3 sets still to log"
          expect(screen.getByText(/3 sets/)).toBeInTheDocument();
        });
      });

      it('"Finish anyway" closes modal without showing reduce-sets prompt', async () => {
        await startProgramWorkout();
        fireEvent.click(screen.getByText(/Finish/));
        await waitFor(() => expect(screen.getByText('Heads up')).toBeInTheDocument());

        fireEvent.click(screen.getByText('Finish anyway'));

        await waitFor(() => {
          expect(screen.queryByText('Heads up')).not.toBeInTheDocument();
          expect(screen.queryByText('Adjust future workouts?')).not.toBeInTheDocument();
        });
        expect(reduceSetsFutureWorkouts).not.toHaveBeenCalled();
      });

      it('"Yes, I couldn\'t finish" advances to reduce-sets prompt', async () => {
        await startProgramWorkout();
        fireEvent.click(screen.getByText(/Finish/));
        await waitFor(() => expect(screen.getByText('Heads up')).toBeInTheDocument());

        fireEvent.click(screen.getByText("Yes, I couldn't finish"));

        await waitFor(() => {
          expect(screen.getByText('Adjust future workouts?')).toBeInTheDocument();
        });
      });

      it('"Yes, reduce sets" closes modal and calls reduceSetsFutureWorkouts', async () => {
        await startProgramWorkout();
        fireEvent.click(screen.getByText(/Finish/));
        await waitFor(() => expect(screen.getByText('Heads up')).toBeInTheDocument());
        fireEvent.click(screen.getByText("Yes, I couldn't finish"));
        await waitFor(() => expect(screen.getByText('Adjust future workouts?')).toBeInTheDocument());

        fireEvent.click(screen.getByText('Yes, reduce sets'));

        await waitFor(() => {
          expect(screen.queryByText('Adjust future workouts?')).not.toBeInTheDocument();
        });
        expect(reduceSetsFutureWorkouts).toHaveBeenCalledWith('sw-42', expect.any(Array));
      });

      it('"No, keep as planned" closes modal without calling reduceSetsFutureWorkouts', async () => {
        await startProgramWorkout();
        fireEvent.click(screen.getByText(/Finish/));
        await waitFor(() => expect(screen.getByText('Heads up')).toBeInTheDocument());
        fireEvent.click(screen.getByText("Yes, I couldn't finish"));
        await waitFor(() => expect(screen.getByText('Adjust future workouts?')).toBeInTheDocument());

        fireEvent.click(screen.getByText('No, keep as planned'));

        await waitFor(() => {
          expect(screen.queryByText('Adjust future workouts?')).not.toBeInTheDocument();
        });
        expect(reduceSetsFutureWorkouts).not.toHaveBeenCalled();
      });

      it('does not show warning for program workouts when all sets are logged', async () => {
        await startProgramWorkout();

        // Mark all 3 sets as done
        const checkButtons = screen.getAllByText('○');
        for (const btn of checkButtons) fireEvent.click(btn);

        // Finish immediately — no warning modal should appear
        fireEvent.click(screen.getByText(/Finish/));

        // Warning modal should never show
        expect(screen.queryByText('Heads up')).not.toBeInTheDocument();
      });

      it('does not show warning for free-flow workouts with un-logged sets', async () => {
        // Free-flow workout: no scheduledWorkoutId (default TEMPLATES have none)
        await startWorkout();

        // Do NOT log any sets — tap Finish
        fireEvent.click(screen.getByText(/Finish/));

        await waitFor(() => {
          expect(screen.queryByText('Heads up')).not.toBeInTheDocument();
          expect(screen.getByText('Start Workout')).toBeInTheDocument();
        });
      });

      it('dismisses modal when tapping backdrop', async () => {
        await startProgramWorkout();
        fireEvent.click(screen.getByText(/Finish/));
        await waitFor(() => expect(screen.getByText('Heads up')).toBeInTheDocument());

        // Find the fixed overlay by walking up from the "Heads up" heading
        // The modal has: fixed overlay div > bottom sheet div > "Heads up" content
        const heading = screen.getByText('Heads up');
        const bottomSheet = heading.parentElement; // the bottom sheet
        const backdrop = bottomSheet?.parentElement; // the fixed overlay
        if (backdrop) fireEvent.click(backdrop);

        await waitFor(() => {
          expect(screen.queryByText('Heads up')).not.toBeInTheDocument();
        });
      });
    });

    it('queues workout offline when not online', async () => {
      // Simulate offline state
      window.__mockOnline = false;

      await startWorkout();

      // Complete a set
      fireEvent.click(screen.getAllByText('○')[0]);

      // Finish button should say offline - matches both banner and button
      const offlineElements = screen.getAllByText(/offline/i);
      expect(offlineElements.length).toBeGreaterThanOrEqual(1);

      // Click Finish button
      fireEvent.click(screen.getByText(/Finish/));

      await waitFor(() => {
        expect(queueWorkout).toHaveBeenCalled();
        expect(screen.getByText('Start Workout')).toBeInTheDocument();
      });
    });

    it('opens edit modal when clicking on weight/reps', async () => {
      await startWorkout();
      // Click on a weight value button (the first undone set's weight)
      const weightButtons = screen.getAllByText('100').filter(el => el.tagName === 'BUTTON');
      fireEvent.click(weightButtons[0]);

      await waitFor(() => {
        // Edit modal should show weight stepper (unique to edit modal)
        expect(screen.getByText('Weight (kg)')).toBeInTheDocument();
        // And Save button
        expect(screen.getByText('Save')).toBeInTheDocument();
      });
    });

    it('edits weight via stepper', async () => {
      await startWorkout();
      // Open edit modal
      const weightButtons = screen.getAllByText('100').filter(el => el.tagName === 'BUTTON');
      fireEvent.click(weightButtons[0]);

      await waitFor(() => expect(screen.getByText('Weight (kg)')).toBeInTheDocument());

      // Click + button to increase weight (there are two: WeightStepper and RepBubbles)
      // The first '+' button should be the weight stepper's
      const plusButtons = screen.getAllByText('+');
      fireEvent.click(plusButtons[0]);

      // Click Save
      fireEvent.click(screen.getByText('Save'));

      // Weight should be updated to 102.5
      await waitFor(() => {
        expect(screen.getByText('102.5')).toBeInTheDocument();
      });
    });
  });
});
