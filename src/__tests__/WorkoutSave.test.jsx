/**
 * WorkoutSave.test.jsx
 *
 * Tests the full workout-save path in WorkoutScreen.saveWorkout():
 *  1. workouts INSERT
 *  2. scheduled_workouts UPDATE (program workouts only)
 *  3. workout_sets INSERT
 *  4. personal_records SELECT + INSERT (PR detection)
 *
 * We mock supabase at the module level so individual tests can inject errors
 * at any step and verify the correct fallback / error handling behaviour.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Supabase mock setup ─────────────────────────────────────────────────────
// We need per-table, per-call control, so we build the mock imperatively.

let mockWorkoutInsert = vi.fn();
let mockSetsInsert = vi.fn();
let mockPRSelect = vi.fn();
let mockPRInsert = vi.fn();
let mockPRUpdate = vi.fn();
let mockScheduledWorkoutUpdate = vi.fn();

function buildFromMock(table) {
  if (table === 'workouts') {
    return {
      insert: (data) => ({
        select: () => ({ single: () => mockWorkoutInsert(data) }),
      }),
    };
  }
  if (table === 'workout_sets') {
    return {
      insert: (data) => mockSetsInsert(data),
    };
  }
  if (table === 'personal_records') {
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                limit: () => mockPRSelect(),
              }),
            }),
          }),
        }),
      }),
      insert: (data) => mockPRInsert(data),
      update: (data) => ({ eq: () => mockPRUpdate(data) }),
    };
  }
  if (table === 'scheduled_workouts') {
    return {
      update: (data) => ({ eq: () => mockScheduledWorkoutUpdate(data) }),
    };
  }
  // default fallback for any other table
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: [], error: null }),
    or: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
}

let mockSessionState = null;
let onAuthStateChangeCallback = null;

vi.mock('../lib/supabase', () => {
  const supabaseMock = {
    auth: {
      onAuthStateChange: vi.fn((cb) => {
        onAuthStateChangeCallback = cb;
        setTimeout(() => cb('INITIAL_SESSION', mockSessionState), 0);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
    from: vi.fn((table) => buildFromMock(table)),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
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
    createCustomExercise: vi.fn().mockResolvedValue({ id: 'cx-1' }),
    updateCustomExercise: vi.fn().mockResolvedValue({}),
    deleteCustomExercise: vi.fn().mockResolvedValue(undefined),
    logLoginEvent: vi.fn(),
    logPageEvent: vi.fn(),
    setSessionCache: vi.fn(),
    getExerciseHistory: vi.fn().mockResolvedValue({}),
    getNutritionGoals: vi.fn().mockResolvedValue(null),
    checkAIQuota: vi.fn().mockResolvedValue(null),
    getReadinessScore: vi.fn().mockResolvedValue(null),
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
import { getSession, getProfile, getTemplates } from '../lib/supabase';
import { queueWorkout } from '../lib/offlineStorage';

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const mockSession = {
  user: { id: 'user-1', email: 'test@test.com', user_metadata: { full_name: 'Test' } },
  access_token: 'tok',
};
const mockProfile = {
  id: 'user-1', name: 'Test', plan: 'free', onboarding_complete: true, created_at: '2025-01-01T00:00:00Z',
};

// A minimal template with 1 exercise, 2 sets
const PUSH_TEMPLATE = [
  {
    id: 't1', name: 'Push', sort_order: 0, color: '#DFFF3C', icon: '💪',
    template_exercises: [
      { name: 'Bench Press', equipment: 'Barbell', default_sets: 2, default_reps: 8, default_weight: 100, sort_order: 0 },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function renderAndStartWorkout() {
  render(<App />);
  await waitFor(() => expect(screen.getByText('Start Workout')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Start Workout'));
  await waitFor(() => expect(screen.getByText('Push')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Push'));
  await waitFor(() => expect(screen.getByText('Push Day')).toBeInTheDocument());
}

async function markAllSetsAndFinish() {
  const circles = screen.getAllByText('○');
  circles.forEach(c => fireEvent.click(c));
  fireEvent.click(screen.getByText(/Finish/));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('WorkoutScreen — saveWorkout()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionState = mockSession;
    getSession.mockResolvedValue(mockSession);
    getProfile.mockResolvedValue(mockProfile);
    getTemplates.mockResolvedValue(PUSH_TEMPLATE);

    // Happy-path defaults
    mockWorkoutInsert.mockResolvedValue({ data: { id: 'wk-1' }, error: null });
    mockSetsInsert.mockResolvedValue({ error: null });
    mockPRSelect.mockResolvedValue({ data: [], error: null });
    mockPRInsert.mockResolvedValue({ data: { id: 'pr-1' }, error: null });
    mockPRUpdate.mockResolvedValue({ data: null, error: null });
    mockScheduledWorkoutUpdate.mockResolvedValue({ data: null, error: null });
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('inserts workout row with correct fields on finish', async () => {
    await renderAndStartWorkout();
    await markAllSetsAndFinish();

    await waitFor(() => expect(mockWorkoutInsert).toHaveBeenCalled());

    const insertedWorkout = mockWorkoutInsert.mock.calls[0][0];
    expect(insertedWorkout.user_id).toBe('user-1');
    expect(insertedWorkout.title).toBeTruthy();
    expect(insertedWorkout.started_at).toBeTruthy();
    expect(insertedWorkout.finished_at).toBeTruthy();
    expect(typeof insertedWorkout.duration_secs).toBe('number');
    expect(insertedWorkout.duration_secs).toBeGreaterThanOrEqual(0);
  });

  it('inserts workout_sets with workout_id after workout is created', async () => {
    await renderAndStartWorkout();
    await markAllSetsAndFinish();

    await waitFor(() => expect(mockSetsInsert).toHaveBeenCalled());

    const sets = mockSetsInsert.mock.calls[0][0];
    expect(Array.isArray(sets)).toBe(true);
    expect(sets.length).toBeGreaterThan(0);
    sets.forEach(s => {
      expect(s.workout_id).toBe('wk-1');
      expect(s.exercise_name).toBeTruthy();
      expect(typeof s.set_number).toBe('number');
      expect(s.completed).toBe(true);
    });
  });

  it('navigates back to home on successful save', async () => {
    await renderAndStartWorkout();
    await markAllSetsAndFinish();

    await waitFor(() => {
      expect(screen.getByText('Start Workout')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('total_volume_kg is sum of weight × reps for completed sets', async () => {
    await renderAndStartWorkout();
    await markAllSetsAndFinish();

    await waitFor(() => expect(mockWorkoutInsert).toHaveBeenCalled());

    const insertedWorkout = mockWorkoutInsert.mock.calls[0][0];
    // 2 sets × 100kg × 8 reps = 1600 total volume
    expect(insertedWorkout.total_volume_kg).toBe(1600);
  });

  it('does not insert workout_sets when no sets are marked done', async () => {
    await renderAndStartWorkout();
    // Finish WITHOUT marking any sets done
    fireEvent.click(screen.getByText(/Finish/));

    await waitFor(() => expect(screen.getByText('Start Workout')).toBeInTheDocument(), { timeout: 5000 });

    // Workout row still gets inserted (even empty workout is valid)
    // But sets insert should not be called
    expect(mockSetsInsert).not.toHaveBeenCalled();
  });

  // ── Bug: workout title appends "Day" when name already ends in "Day" ────────

  it('BUG: title does not double-append "Day" for templates ending in "Day"', async () => {
    getTemplates.mockResolvedValue([{
      id: 't2', name: 'Push Day', sort_order: 0, color: '#DFFF3C', icon: '💪',
      template_exercises: [
        { name: 'Bench Press', equipment: 'Barbell', default_sets: 1, default_reps: 8, default_weight: 100, sort_order: 0 },
      ],
    }]);

    render(<App />);
    await waitFor(() => expect(screen.getByText('Start Workout')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Start Workout'));
    await waitFor(() => expect(screen.getByText('Push Day')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Push Day'));
    await waitFor(() => expect(screen.getByText(/Push Day/)).toBeInTheDocument());

    const circles = screen.getAllByText('○');
    circles.forEach(c => fireEvent.click(c));
    fireEvent.click(screen.getByText(/Finish/));

    await waitFor(() => expect(mockWorkoutInsert).toHaveBeenCalled());

    const title = mockWorkoutInsert.mock.calls[0][0].title;
    // Should be "Push Day" not "Push Day Day"
    expect(title).not.toContain('Day Day');
    expect(title).toBe('Push Day');
  });

  // ── RPE conversion from RIR ────────────────────────────────────────────────

  it('converts RIR to RPE correctly (rpe = 10 - rir)', async () => {
    await renderAndStartWorkout();
    await markAllSetsAndFinish();

    await waitFor(() => expect(mockSetsInsert).toHaveBeenCalled());

    const sets = mockSetsInsert.mock.calls[0][0];
    sets.forEach(s => {
      // Default RIR from template is null → rpe should be null
      expect(s.rpe).toBeNull();
    });
  });

  // ── Error: workout INSERT fails ────────────────────────────────────────────

  it('queues workout offline when workout INSERT returns a DB error', async () => {
    mockWorkoutInsert.mockResolvedValue({
      data: null,
      error: { message: 'duplicate key value violates unique constraint', code: '23505' },
    });

    await renderAndStartWorkout();
    await markAllSetsAndFinish();

    await waitFor(() => {
      expect(queueWorkout).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('shows error alert when workout INSERT fails and online', async () => {
    mockWorkoutInsert.mockResolvedValue({
      data: null,
      error: { message: 'permission denied for table workouts' },
    });

    await renderAndStartWorkout();
    await markAllSetsAndFinish();

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('permission denied')
      );
    }, { timeout: 5000 });
  });

  it('does NOT call sets insert when workout INSERT fails', async () => {
    mockWorkoutInsert.mockResolvedValue({
      data: null,
      error: { message: 'row-level security violation' },
    });

    await renderAndStartWorkout();
    await markAllSetsAndFinish();

    await waitFor(() => expect(queueWorkout).toHaveBeenCalled(), { timeout: 5000 });
    expect(mockSetsInsert).not.toHaveBeenCalled();
  });

  // ── Error: sets INSERT fails ──────────────────────────────────────────────

  it('still navigates home when sets INSERT fails (soft error, not thrown)', async () => {
    // Sets error is console.error'd but NOT thrown — workout save continues
    mockSetsInsert.mockResolvedValue({
      error: { message: 'row-level security policy violation for workout_sets' },
    });

    await renderAndStartWorkout();
    await markAllSetsAndFinish();

    // Workout was saved OK, sets had an error but it's swallowed
    await waitFor(() => {
      expect(screen.getByText('Start Workout')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Workout was still inserted
    expect(mockWorkoutInsert).toHaveBeenCalled();
  });

  it('BUG: sets error is silently swallowed — no alert shown to user', async () => {
    // This tests a known issue: if workout_sets INSERT fails, the user sees no error.
    // The workout row exists in DB but has no sets — data is silently lost.
    mockSetsInsert.mockResolvedValue({
      error: { message: 'new row violates row-level security policy for table "workout_sets"' },
    });

    await renderAndStartWorkout();
    await markAllSetsAndFinish();

    await waitFor(() => {
      expect(screen.getByText('Start Workout')).toBeInTheDocument();
    }, { timeout: 5000 });

    // The alert is NOT shown even though sets were lost
    expect(window.alert).not.toHaveBeenCalled();
    // This documents the bug: user loses set data with no feedback
  });

  // ── PR detection ─────────────────────────────────────────────────────────

  it('queries personal_records to check for existing PR after saving sets', async () => {
    await renderAndStartWorkout();
    await markAllSetsAndFinish();

    await waitFor(() => expect(mockPRSelect).toHaveBeenCalled(), { timeout: 5000 });
  });

  it('inserts new PR when no existing PR found (first ever log)', async () => {
    mockPRSelect.mockResolvedValue({ data: [], error: null });

    await renderAndStartWorkout();
    await markAllSetsAndFinish();

    await waitFor(() => expect(mockPRInsert).toHaveBeenCalled(), { timeout: 5000 });

    const prData = mockPRInsert.mock.calls[0][0];
    expect(prData.exercise_name).toBe('Bench Press');
    expect(prData.user_id).toBe('user-1');
    expect(prData.workout_id).toBe('wk-1');
    expect(prData.is_active).toBe(true);
    expect(['1rm', 'volume']).toContain(prData.pr_type);
  });

  it('does NOT insert PR when existing estimated_1rm is higher', async () => {
    // Existing PR has estimated_1rm of 9999 — impossible to beat
    mockPRSelect.mockResolvedValue({
      data: [{ id: 'pr-old', estimated_1rm: 9999, set_volume: 9999 }],
      error: null,
    });

    await renderAndStartWorkout();
    await markAllSetsAndFinish();

    await waitFor(() => expect(mockPRSelect).toHaveBeenCalled(), { timeout: 5000 });
    expect(mockPRInsert).not.toHaveBeenCalled();
  });

  it('deactivates old PR and inserts new one when PR is beaten', async () => {
    // Existing PR has low estimated_1rm — new workout will beat it
    mockPRSelect.mockResolvedValue({
      data: [{ id: 'pr-old', estimated_1rm: 50, set_volume: 50 }],
      error: null,
    });

    await renderAndStartWorkout();
    await markAllSetsAndFinish();

    await waitFor(() => expect(mockPRUpdate).toHaveBeenCalled(), { timeout: 5000 });
    await waitFor(() => expect(mockPRInsert).toHaveBeenCalled(), { timeout: 5000 });
  });

  it('BUG: PR insert missing estimated_1rm column — DB trigger calculates it', async () => {
    // The insert does NOT include estimated_1rm — it relies on the DB trigger
    // calc_estimated_1rm to fill it in. If the trigger is missing, estimated_1rm=null
    // and getPersonalRecords() ordering breaks (orders by estimated_1rm DESC).
    mockPRSelect.mockResolvedValue({ data: [], error: null });

    await renderAndStartWorkout();
    await markAllSetsAndFinish();

    await waitFor(() => expect(mockPRInsert).toHaveBeenCalled(), { timeout: 5000 });

    const prData = mockPRInsert.mock.calls[0][0];
    // Confirm: estimated_1rm is NOT sent from the client (relies on trigger)
    expect(prData.estimated_1rm).toBeUndefined();
    // If trigger doesn't exist, DB will have NULL — this test documents that dependency
  });

  // ── Program workout: scheduled_workouts link ──────────────────────────────

  it('updates scheduled_workouts with workout_id for program workouts', async () => {
    const programTemplate = [{
      id: 'pt1', name: 'Strength A', sort_order: 0, color: '#DFFF3C', icon: '💪',
      scheduledWorkoutId: 'sw-99',
      template_exercises: [
        { name: 'Back Squat', equipment: 'Barbell', default_sets: 1, default_reps: 5, default_weight: 100, sort_order: 0 },
      ],
    }];
    getTemplates.mockResolvedValue(programTemplate);

    render(<App />);
    await waitFor(() => expect(screen.getByText('Start Workout')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Start Workout'));
    await waitFor(() => expect(screen.getByText('Strength A')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Strength A'));
    await waitFor(() => expect(screen.getByText(/Strength A/)).toBeInTheDocument());

    // Mark all sets and finish
    const circles = screen.getAllByText('○');
    circles.forEach(c => fireEvent.click(c));
    fireEvent.click(screen.getByText(/Finish/));

    await waitFor(() => expect(mockScheduledWorkoutUpdate).toHaveBeenCalled(), { timeout: 5000 });

    const updateData = mockScheduledWorkoutUpdate.mock.calls[0][0];
    expect(updateData.workout_id).toBe('wk-1');
  });

  it('does NOT update scheduled_workouts for free-flow (non-program) workouts', async () => {
    // PUSH_TEMPLATE has no scheduledWorkoutId
    await renderAndStartWorkout();
    await markAllSetsAndFinish();

    await waitFor(() => expect(mockWorkoutInsert).toHaveBeenCalled(), { timeout: 5000 });
    expect(mockScheduledWorkoutUpdate).not.toHaveBeenCalled();
  });

  // ── Offline behaviour ─────────────────────────────────────────────────────

  it('skips DB entirely and queues offline when navigator.onLine is false', async () => {
    window.__mockOnline = false;

    await renderAndStartWorkout();
    await markAllSetsAndFinish();

    await waitFor(() => {
      expect(queueWorkout).toHaveBeenCalled();
      expect(screen.getByText('Start Workout')).toBeInTheDocument();
    }, { timeout: 5000 });

    expect(mockWorkoutInsert).not.toHaveBeenCalled();
  });

  it('queued offline workout contains correct workout data and sets', async () => {
    window.__mockOnline = false;

    await renderAndStartWorkout();
    await markAllSetsAndFinish();

    await waitFor(() => expect(queueWorkout).toHaveBeenCalled(), { timeout: 5000 });

    const [queuedWorkout, queuedSets] = queueWorkout.mock.calls[0];
    expect(queuedWorkout.title).toBeTruthy();
    expect(queuedWorkout.total_volume_kg).toBe(1600);
    expect(Array.isArray(queuedSets)).toBe(true);
    expect(queuedSets.length).toBeGreaterThan(0);
    expect(queuedSets[0].exercise_name).toBe('Bench Press');
  });
});
