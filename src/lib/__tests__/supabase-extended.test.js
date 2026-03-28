import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAuth, mockQueryBuilder, mockClient } = vi.hoisted(() => {
  const mockQueryBuilder = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    gt: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    is: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    in: vi.fn(),
  };

  const mockAuth = {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    getUser: vi.fn(),
    signInWithOAuth: vi.fn(),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  };

  const mockClient = {
    auth: mockAuth,
    from: vi.fn(),
    rpc: vi.fn(),
  };

  return { mockAuth, mockQueryBuilder, mockClient };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient),
}));

import {
  deleteWorkout,
  getPrograms,
  getProgramDetails,
  getActiveEnrollment,
  enrollInProgram,
  abandonProgram,
  getScheduledWorkouts,
  updateScheduledWorkout,
  generateSchedule,
  savePumpRating,
  saveDifficultyRating,
  saveSorenessRatings,
  applyDifficultyToFutureWorkouts,
  getRecentFeedback,
  saveProgressCheckin,
  getProgressCheckins,
  applyCoachDiffToSchedule,
  createUserProgram,
  deleteUserProgram,
  getVolumeStandards,
  logPRShare,
  setSessionCache,
  getExerciseHistory,
} from '../supabase';

function setupChainableMock() {
  mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.insert.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.update.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.delete.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.neq.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.gt.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.gte.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.lte.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.is.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.in.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.or.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.order.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.limit.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.single.mockResolvedValue({ data: null, error: null });
  mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
  mockClient.from.mockReturnValue(mockQueryBuilder);
}

describe('supabase.js — extended coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChainableMock();
    setSessionCache({ user: { id: 'user-1', email: 'test@test.com' }, access_token: 'tok-123' });
  });

  // ─── deleteWorkout ──────────────────────────────────────────────────────────

  describe('deleteWorkout', () => {
    it('resets scheduled workout by workout_id FK', async () => {
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
      // Final delete resolves with no error
      mockQueryBuilder.eq.mockImplementation(() => {
        mockQueryBuilder._lastEq = arguments;
        return mockQueryBuilder;
      });
      mockQueryBuilder.delete.mockReturnValue(mockQueryBuilder);
      // Make the final .eq after .delete resolve cleanly
      // We need the last await in the chain (delete().eq()) to resolve
      // Override: let all chains return builder, final .eq after delete resolves
      let callCount = 0;
      mockQueryBuilder.eq.mockImplementation(() => {
        callCount++;
        return mockQueryBuilder;
      });
      // The delete chain final resolution
      mockQueryBuilder.eq.mockResolvedValueOnce({ error: null });

      await deleteWorkout('w-1', null);

      expect(mockClient.from).toHaveBeenCalledWith('scheduled_workouts');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ status: 'scheduled', workout_id: null });
    });

    it('also resets by date range when startedAt is provided', async () => {
      // Provide a Monday so the week calculation is deterministic
      const startedAt = '2025-03-10T10:00:00Z'; // Monday

      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.lte.mockResolvedValue({ error: null }); // last call in the date-range update chain
      mockQueryBuilder.delete.mockReturnValue(mockQueryBuilder);
      // final delete chain
      const eqMock = vi.fn().mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.eq = eqMock;
      // Override delete chain end
      mockQueryBuilder.delete.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

      await deleteWorkout('w-1', startedAt);

      expect(mockClient.from).toHaveBeenCalledWith('scheduled_workouts');
      expect(mockQueryBuilder.gte).toHaveBeenCalledWith('scheduled_date', '2025-03-10');
      expect(mockQueryBuilder.lte).toHaveBeenCalledWith('scheduled_date', '2025-03-16');
    });

    it('deactivates PRs linked to deleted workout', async () => {
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
      // personal_records select returns PRs to deactivate
      mockQueryBuilder.eq.mockReturnValueOnce(mockQueryBuilder)  // scheduled_workouts update chain
        .mockReturnValueOnce(mockQueryBuilder);
      mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);

      // Simulate PRs found for this workout
      let fromCallIdx = 0;
      mockClient.from.mockImplementation((table) => {
        if (table === 'personal_records') {
          return {
            ...mockQueryBuilder,
            select: vi.fn().mockReturnValue({
              ...mockQueryBuilder,
              eq: vi.fn().mockReturnValue({
                ...mockQueryBuilder,
                eq: vi.fn().mockResolvedValue({
                  data: [{ id: 'pr-1', exercise_name: 'Bench Press', pr_type: '1rm' }],
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return mockQueryBuilder;
      });

      // workouts.delete final chain
      mockQueryBuilder.delete.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      await deleteWorkout('w-1', null);
      expect(mockClient.from).toHaveBeenCalledWith('personal_records');
    });

    it('throws when final workout delete fails', async () => {
      mockQueryBuilder.delete.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'delete failed' } }),
      });

      await expect(deleteWorkout('w-1', null)).rejects.toMatchObject({ message: 'delete failed' });
    });

    it('does not attempt date-range reset when startedAt is null', async () => {
      mockQueryBuilder.delete.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      await deleteWorkout('w-1', null);

      // gte / lte should NOT have been called
      expect(mockQueryBuilder.gte).not.toHaveBeenCalled();
      expect(mockQueryBuilder.lte).not.toHaveBeenCalled();
    });
  });

  // ─── Program helpers ────────────────────────────────────────────────────────

  describe('getPrograms', () => {
    it('returns programs ordered by days_per_week', async () => {
      const programs = [{ id: 'p1', name: '3-day' }, { id: 'p2', name: '5-day' }];
      mockQueryBuilder.or.mockResolvedValue({ data: programs, error: null });

      const result = await getPrograms();
      expect(mockClient.from).toHaveBeenCalledWith('programs');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('is_active', true);
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('days_per_week');
      expect(result).toEqual(programs);
    });

    it('returns empty array on error', async () => {
      mockQueryBuilder.or.mockResolvedValue({ data: null, error: { message: 'db error' } });
      const result = await getPrograms();
      expect(result).toEqual([]);
    });

    it('filters by user_id when session available', async () => {
      mockQueryBuilder.or.mockResolvedValue({ data: [], error: null });
      await getPrograms();
      expect(mockQueryBuilder.or).toHaveBeenCalledWith('user_id.is.null,user_id.eq.user-1');
    });

    it('filters to public programs only when no session', async () => {
      setSessionCache(null);
      mockQueryBuilder.is.mockResolvedValue({ data: [], error: null });
      await getPrograms();
      expect(mockQueryBuilder.is).toHaveBeenCalledWith('user_id', null);
    });
  });

  describe('getProgramDetails', () => {
    it('fetches program with nested days and exercises', async () => {
      const program = { id: 'p1', name: 'Strength', program_days: [] };
      mockQueryBuilder.single.mockResolvedValue({ data: program, error: null });

      const result = await getProgramDetails('p1');
      expect(mockClient.from).toHaveBeenCalledWith('programs');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'p1');
      expect(result).toEqual(program);
    });

    it('returns null on error', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: { message: 'not found' } });
      const result = await getProgramDetails('bad-id');
      expect(result).toBeNull();
    });
  });

  describe('getActiveEnrollment', () => {
    it('returns null when no session', async () => {
      setSessionCache(null);
      const result = await getActiveEnrollment();
      expect(result).toBeNull();
    });

    it('queries program_enrollments with active status', async () => {
      const enrollment = { id: 'e1', status: 'active', programs: {} };
      mockQueryBuilder.maybeSingle.mockResolvedValue({ data: enrollment, error: null });

      const result = await getActiveEnrollment();
      expect(mockClient.from).toHaveBeenCalledWith('program_enrollments');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('status', 'active');
      expect(result).toEqual(enrollment);
    });

    it('returns null when no active enrollment', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
      const result = await getActiveEnrollment();
      expect(result).toBeNull();
    });
  });

  describe('enrollInProgram', () => {
    it('throws when not authenticated', async () => {
      setSessionCache(null);
      await expect(enrollInProgram('prog-1')).rejects.toThrow('Not authenticated');
    });

    it('inserts enrollment with correct defaults', async () => {
      const enrollment = { id: 'e1', user_id: 'user-1', program_id: 'prog-1' };
      mockQueryBuilder.single.mockResolvedValue({ data: enrollment, error: null });

      const result = await enrollInProgram('prog-1');
      expect(mockClient.from).toHaveBeenCalledWith('program_enrollments');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-1',
        program_id: 'prog-1',
        status: 'active',
        current_week: 1,
        current_day: 0,
      }));
      expect(result).toEqual(enrollment);
    });

    it('includes startDate when provided', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: { id: 'e1' }, error: null });
      await enrollInProgram('prog-1', {}, '2025-04-01');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
        started_at: '2025-04-01',
      }));
    });

    it('uses settings.checkin_frequency when provided', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: { id: 'e1' }, error: null });
      await enrollInProgram('prog-1', { checkin_frequency: 'biweekly' });
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
        checkin_frequency: 'biweekly',
      }));
    });

    it('defaults checkin_frequency to weekly', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: { id: 'e1' }, error: null });
      await enrollInProgram('prog-1', {});
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
        checkin_frequency: 'weekly',
      }));
    });

    it('throws on DB error', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: { message: 'constraint violation' } });
      await expect(enrollInProgram('prog-1')).rejects.toMatchObject({ message: 'constraint violation' });
    });
  });

  describe('abandonProgram', () => {
    it('updates enrollment status to abandoned', async () => {
      mockQueryBuilder.eq.mockResolvedValue({ error: null });

      await abandonProgram('e-1');
      expect(mockClient.from).toHaveBeenCalledWith('program_enrollments');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ status: 'abandoned' });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'e-1');
    });

    it('throws on DB error', async () => {
      mockQueryBuilder.eq.mockResolvedValue({ error: { message: 'update failed' } });
      await expect(abandonProgram('e-1')).rejects.toMatchObject({ message: 'update failed' });
    });
  });

  // ─── Scheduled workouts ─────────────────────────────────────────────────────

  describe('getScheduledWorkouts', () => {
    it('returns empty array when no session', async () => {
      setSessionCache(null);
      const result = await getScheduledWorkouts('2025-03-10', '2025-03-16');
      expect(result).toEqual([]);
    });

    it('queries by date range when no weekNumber', async () => {
      // getScheduledWorkouts date-range path: from().select().eq().order().gte().lte()
      // lte is the terminal call
      mockQueryBuilder.lte.mockResolvedValueOnce({ data: [{ id: 'sw-1' }], error: null });

      const result = await getScheduledWorkouts('2025-03-10', '2025-03-16');
      expect(mockClient.from).toHaveBeenCalledWith('scheduled_workouts');
      expect(mockQueryBuilder.gte).toHaveBeenCalledWith('scheduled_date', '2025-03-10');
      expect(mockQueryBuilder.lte).toHaveBeenCalledWith('scheduled_date', '2025-03-16');
      expect(result).toEqual([{ id: 'sw-1' }]);
    });

    it('queries by week_number when provided', async () => {
      // week_number path: from().select().eq(user_id).order().eq(enrollment_id).eq(week_number)
      // terminal call is the last .eq which resolves
      let eqCallCount = 0;
      mockQueryBuilder.eq.mockImplementation((...args) => {
        eqCallCount++;
        if (eqCallCount === 3) {
          // third eq is week_number — return a promise
          return Promise.resolve({ data: [{ id: 'sw-1' }], error: null });
        }
        return mockQueryBuilder;
      });

      const result = await getScheduledWorkouts(null, null, 'e-1', 2);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('enrollment_id', 'e-1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('week_number', 2);
      expect(result).toEqual([{ id: 'sw-1' }]);
    });

    it('returns empty array on error', async () => {
      mockQueryBuilder.lte.mockResolvedValueOnce({ data: null, error: { message: 'error' } });
      const result = await getScheduledWorkouts('2025-03-10', '2025-03-16');
      expect(result).toEqual([]);
    });
  });

  describe('updateScheduledWorkout', () => {
    it('updates and returns updated row', async () => {
      // Chain: from().update().eq().select().single()
      const updated = { id: 'sw-1', status: 'completed' };
      mockQueryBuilder.single.mockResolvedValueOnce({ data: updated, error: null });

      const result = await updateScheduledWorkout('sw-1', { status: 'completed' });
      expect(mockClient.from).toHaveBeenCalledWith('scheduled_workouts');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ status: 'completed' });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'sw-1');
      expect(result).toEqual(updated);
    });

    it('returns null on error', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
      const result = await updateScheduledWorkout('sw-1', { status: 'completed' });
      // function logs error and returns data (null) when error present
      expect(result).toBeNull();
    });
  });

  // ─── generateSchedule ───────────────────────────────────────────────────────

  describe('generateSchedule', () => {
    const programDays = [
      {
        id: 'pd-1',
        name: 'Push',
        program_day_exercises: [
          { exercise_name: 'Bench Press', base_sets: 4, base_reps: 8, is_compound: true, sort_order: 0 },
        ],
      },
      {
        id: 'pd-2',
        name: 'Pull',
        program_day_exercises: [
          { exercise_name: 'Deadlift', base_sets: 3, base_reps: 5, is_compound: true, sort_order: 0 },
        ],
      },
    ];

    it('throws when not authenticated', async () => {
      setSessionCache(null);
      await expect(generateSchedule('e-1', programDays, '2025-03-10', {})).rejects.toThrow('Not authenticated');
    });

    it('inserts scheduled rows and returns count', async () => {
      mockQueryBuilder.insert.mockResolvedValue({ error: null });

      const count = await generateSchedule('e-1', programDays, '2025-04-07', {
        trainingDays: [1, 2, 3, 4, 5],
        startingWeights: { 'Bench Press': 100, 'Deadlift': 140 },
      });

      expect(mockClient.from).toHaveBeenCalledWith('scheduled_workouts');
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(count).toBeGreaterThan(0);
    });

    it('builds prescribed exercises with startingWeights', async () => {
      let insertedRows;
      mockQueryBuilder.insert.mockImplementation((rows) => {
        insertedRows = rows;
        return { error: null };
      });

      await generateSchedule('e-1', [programDays[0]], '2025-04-07', {
        trainingDays: [1],
        startingWeights: { 'Bench Press': 120 },
      });

      const firstRow = insertedRows[0];
      expect(firstRow.prescribed_exercises[0].weight).toBe(120);
      expect(firstRow.prescribed_exercises[0].rir).toBe(3);
    });

    it('defaults weight to 20 when no startingWeight provided', async () => {
      let insertedRows;
      mockQueryBuilder.insert.mockImplementation((rows) => {
        insertedRows = rows;
        return { error: null };
      });

      await generateSchedule('e-1', [programDays[0]], '2025-04-07', {
        trainingDays: [1],
        startingWeights: {},
      });

      expect(insertedRows[0].prescribed_exercises[0].weight).toBe(20);
    });

    it('marks past days as skipped', async () => {
      let insertedRows;
      mockQueryBuilder.insert.mockImplementation((rows) => {
        insertedRows = rows;
        return { error: null };
      });

      // Use a start date well in the past
      await generateSchedule('e-1', [programDays[0]], '2020-01-06', {
        trainingDays: [1],
      });

      expect(insertedRows.every(r => r.status === 'skipped')).toBe(true);
    });

    it('throws on DB insert error', async () => {
      mockQueryBuilder.insert.mockResolvedValue({ error: { message: 'insert failed' } });
      await expect(
        generateSchedule('e-1', programDays, '2025-04-07', { trainingDays: [1, 2] })
      ).rejects.toMatchObject({ message: 'insert failed' });
    });

    it('returns 0 when no rows generated (no training days match)', async () => {
      const count = await generateSchedule('e-1', programDays, '2025-04-07', {
        trainingDays: [], // no days
      });
      expect(count).toBe(0);
    });
  });

  // ─── Feedback helpers ────────────────────────────────────────────────────────

  describe('savePumpRating', () => {
    it('throws when not authenticated', async () => {
      setSessionCache(null);
      await expect(savePumpRating('sw-1', 'w-1', 4)).rejects.toThrow('Not authenticated');
    });

    it('inserts pump feedback with correct fields', async () => {
      mockQueryBuilder.insert.mockResolvedValue({ error: null });

      await savePumpRating('sw-1', 'w-1', 4);
      expect(mockClient.from).toHaveBeenCalledWith('workout_feedback');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        scheduled_workout_id: 'sw-1',
        workout_id: 'w-1',
        feedback_type: 'pump',
        overall_rating: 4,
      });
    });

    it('throws on DB error', async () => {
      mockQueryBuilder.insert.mockResolvedValue({ error: { message: 'insert failed' } });
      await expect(savePumpRating('sw-1', 'w-1', 4)).rejects.toMatchObject({ message: 'insert failed' });
    });
  });

  describe('saveDifficultyRating', () => {
    it('throws when not authenticated', async () => {
      setSessionCache(null);
      await expect(saveDifficultyRating('sw-1', 'w-1', 7)).rejects.toThrow('Not authenticated');
    });

    it('inserts difficulty feedback with correct fields', async () => {
      mockQueryBuilder.insert.mockResolvedValue({ error: null });

      await saveDifficultyRating('sw-1', 'w-1', 7);
      expect(mockClient.from).toHaveBeenCalledWith('workout_feedback');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        scheduled_workout_id: 'sw-1',
        workout_id: 'w-1',
        feedback_type: 'difficulty',
        overall_rating: 7,
      });
    });

    it('throws on DB error', async () => {
      mockQueryBuilder.insert.mockResolvedValue({ error: { message: 'save failed' } });
      await expect(saveDifficultyRating('sw-1', 'w-1', 7)).rejects.toMatchObject({ message: 'save failed' });
    });
  });

  describe('saveSorenessRatings', () => {
    it('throws when not authenticated', async () => {
      setSessionCache(null);
      await expect(saveSorenessRatings('sw-1', { chest: 3 })).rejects.toThrow('Not authenticated');
    });

    it('inserts soreness feedback with muscle ratings', async () => {
      mockQueryBuilder.insert.mockResolvedValue({ error: null });

      await saveSorenessRatings('sw-1', { chest: 3, quads: 4 });
      expect(mockClient.from).toHaveBeenCalledWith('workout_feedback');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        scheduled_workout_id: 'sw-1',
        feedback_type: 'soreness',
        muscle_ratings: { chest: 3, quads: 4 },
      });
    });

    it('throws on DB error', async () => {
      mockQueryBuilder.insert.mockResolvedValue({ error: { message: 'db error' } });
      await expect(saveSorenessRatings('sw-1', {})).rejects.toMatchObject({ message: 'db error' });
    });
  });

  describe('getRecentFeedback', () => {
    it('returns empty array when no session', async () => {
      setSessionCache(null);
      const result = await getRecentFeedback([]);
      expect(result).toEqual([]);
    });

    it('queries workout_feedback for current user ordered by date', async () => {
      const feedback = [{ id: 'f1', feedback_type: 'pump', overall_rating: 4 }];
      mockQueryBuilder.limit.mockResolvedValue({ data: feedback, error: null });

      const result = await getRecentFeedback(['chest', 'back']);
      expect(mockClient.from).toHaveBeenCalledWith('workout_feedback');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(20);
      expect(result).toEqual(feedback);
    });

    it('returns empty array on DB error', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: null, error: { message: 'error' } });
      const result = await getRecentFeedback([]);
      expect(result).toEqual([]);
    });
  });

  // ─── applyDifficultyToFutureWorkouts ────────────────────────────────────────

  describe('applyDifficultyToFutureWorkouts', () => {
    it('returns early for mid-range difficulty (4–8)', async () => {
      await applyDifficultyToFutureWorkouts('sw-1', 5);
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it('throws when not authenticated for easy rating', async () => {
      setSessionCache(null);
      await expect(applyDifficultyToFutureWorkouts('sw-1', 2)).rejects.toThrow('Not authenticated');
    });

    it('returns silently when current workout not found', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
      await applyDifficultyToFutureWorkouts('sw-1', 2);
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
    });

    function setupDifficultyMocks(futureWorkouts) {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { program_day_id: 'pd-1', enrollment_id: 'e-1', week_number: 2 },
        error: null,
      });
      mockQueryBuilder.neq.mockResolvedValueOnce({ data: futureWorkouts, error: null });
      // The update chain in applyDifficultyToFutureWorkouts is:
      //   supabase.from('scheduled_workouts').update(...).eq('id', fw.id)
      // The final .eq after .update needs to resolve
      const eqAfterUpdate = vi.fn().mockResolvedValue({ error: null });
      mockQueryBuilder.update.mockReturnValue({ eq: eqAfterUpdate });
    }

    it('increases weight by 2.5% for easy rating (≤3)', async () => {
      setupDifficultyMocks([{
        id: 'fw-1',
        week_number: 3,
        prescribed_exercises: [{ exercise_name: 'Bench Press', weight: 100, sets: 3, is_compound: true }],
      }]);

      await applyDifficultyToFutureWorkouts('sw-1', 2);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        prescribed_exercises: [expect.objectContaining({ weight: 102.5 })],
      });
    });

    it('decreases weight by 5% for hard rating (≥9)', async () => {
      setupDifficultyMocks([{
        id: 'fw-1',
        week_number: 3,
        prescribed_exercises: [{ exercise_name: 'Deadlift', weight: 200, sets: 4, is_compound: true }],
      }]);

      await applyDifficultyToFutureWorkouts('sw-1', 9);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        prescribed_exercises: [expect.objectContaining({ weight: 190 })],
      });
    });

    it('increments sets for easy compounds when below max (5)', async () => {
      setupDifficultyMocks([{
        id: 'fw-1',
        week_number: 3,
        prescribed_exercises: [{ exercise_name: 'Bench Press', weight: 100, sets: 3, is_compound: true }],
      }]);

      await applyDifficultyToFutureWorkouts('sw-1', 1);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        prescribed_exercises: [expect.objectContaining({ sets: 4 })],
      });
    });

    it('does not increment sets beyond 5 for easy compounds', async () => {
      setupDifficultyMocks([{
        id: 'fw-1',
        week_number: 3,
        prescribed_exercises: [{ exercise_name: 'Bench Press', weight: 100, sets: 5, is_compound: true }],
      }]);

      await applyDifficultyToFutureWorkouts('sw-1', 1);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        prescribed_exercises: [expect.objectContaining({ sets: 5 })],
      });
    });

    it('decrements sets for hard compounds when above min (2)', async () => {
      setupDifficultyMocks([{
        id: 'fw-1',
        week_number: 3,
        prescribed_exercises: [{ exercise_name: 'Deadlift', weight: 200, sets: 4, is_compound: true }],
      }]);

      await applyDifficultyToFutureWorkouts('sw-1', 10);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        prescribed_exercises: [expect.objectContaining({ sets: 3 })],
      });
    });

    it('rounds weights to nearest quarter kg', async () => {
      setupDifficultyMocks([{
        id: 'fw-1',
        week_number: 3,
        prescribed_exercises: [{ exercise_name: 'OHP', weight: 60, sets: 3, is_compound: false }],
      }]);

      await applyDifficultyToFutureWorkouts('sw-1', 2); // easy: ×1.025 = 61.5 → rounds to 61.5

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        prescribed_exercises: [expect.objectContaining({ weight: 61.5 })],
      });
    });

    it('skips deload week (week 5)', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { program_day_id: 'pd-1', enrollment_id: 'e-1', week_number: 2 },
        error: null,
      });
      mockQueryBuilder.neq.mockResolvedValueOnce({ data: [], error: null });

      await applyDifficultyToFutureWorkouts('sw-1', 2);

      expect(mockQueryBuilder.neq).toHaveBeenCalledWith('week_number', 5);
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
    });
  });

  // ─── Progress check-ins ─────────────────────────────────────────────────────

  describe('saveProgressCheckin', () => {
    it('throws when not authenticated', async () => {
      setSessionCache(null);
      await expect(saveProgressCheckin({ weight_kg: 80 })).rejects.toThrow('Not authenticated');
    });

    it('inserts checkin with user_id and returns data', async () => {
      const checkin = { id: 'c1', user_id: 'user-1', weight_kg: 80 };
      mockQueryBuilder.single.mockResolvedValue({ data: checkin, error: null });

      const result = await saveProgressCheckin({ weight_kg: 80, notes: 'Feeling good' });
      expect(mockClient.from).toHaveBeenCalledWith('progress_checkins');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        weight_kg: 80,
        notes: 'Feeling good',
      });
      expect(result).toEqual(checkin);
    });

    it('throws on DB error', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: { message: 'constraint violation' } });
      await expect(saveProgressCheckin({ weight_kg: 80 })).rejects.toMatchObject({ message: 'constraint violation' });
    });
  });

  describe('getProgressCheckins', () => {
    it('returns empty array when no session', async () => {
      setSessionCache(null);
      const result = await getProgressCheckins();
      expect(result).toEqual([]);
    });

    it('queries checkins ordered by date descending', async () => {
      const checkins = [{ id: 'c1' }, { id: 'c2' }];
      mockQueryBuilder.limit.mockResolvedValue({ data: checkins, error: null });

      const result = await getProgressCheckins();
      expect(mockClient.from).toHaveBeenCalledWith('progress_checkins');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('checkin_date', { ascending: false });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(30);
      expect(result).toEqual(checkins);
    });

    it('filters by enrollmentId when provided', async () => {
      // Chain: from().select().eq(user_id).order().limit(30).eq(enrollment_id)
      // The last .eq is terminal and resolves
      const eqAfterLimit = vi.fn().mockResolvedValue({ data: [], error: null });
      mockQueryBuilder.limit.mockReturnValueOnce({ eq: eqAfterLimit });

      await getProgressCheckins('e-1');
      expect(eqAfterLimit).toHaveBeenCalledWith('enrollment_id', 'e-1');
    });

    it('returns empty array on DB error', async () => {
      mockQueryBuilder.limit.mockResolvedValue({ data: null, error: { message: 'error' } });
      const result = await getProgressCheckins();
      expect(result).toEqual([]);
    });
  });

  // ─── applyCoachDiffToSchedule ────────────────────────────────────────────────

  describe('applyCoachDiffToSchedule', () => {
    it('throws when not authenticated', async () => {
      setSessionCache(null);
      await expect(applyCoachDiffToSchedule('e-1', 1, [])).rejects.toThrow('Not authenticated');
    });

    it('returns 0 when no future workouts found', async () => {
      mockQueryBuilder.gte.mockResolvedValue({ data: [], error: null });

      const count = await applyCoachDiffToSchedule('e-1', 2, []);
      expect(count).toBe(0);
    });

    it('throws when future workouts fetch errors', async () => {
      mockQueryBuilder.gte.mockResolvedValue({ data: null, error: { message: 'fetch failed' } });
      await expect(applyCoachDiffToSchedule('e-1', 2, [])).rejects.toMatchObject({ message: 'fetch failed' });
    });

    it('applies weight delta to matching exercises', async () => {
      mockQueryBuilder.gte.mockResolvedValue({
        data: [{
          id: 'fw-1',
          week_number: 2,
          prescribed_exercises: [{ exercise_name: 'Bench Press', weight: 100, sets: 4, reps: 8 }],
        }],
        error: null,
      });
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.update.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const count = await applyCoachDiffToSchedule('e-1', 2, [
        { exercise_name: 'Bench Press', delta_weight_kg: 5 },
      ]);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        prescribed_exercises: [expect.objectContaining({ weight: 105 })],
      });
      expect(count).toBe(1);
    });

    it('applies sets delta and clamps to minimum 1', async () => {
      mockQueryBuilder.gte.mockResolvedValue({
        data: [{
          id: 'fw-1',
          week_number: 2,
          prescribed_exercises: [{ exercise_name: 'Deadlift', weight: 150, sets: 1, reps: 5 }],
        }],
        error: null,
      });
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.update.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      await applyCoachDiffToSchedule('e-1', 2, [
        { exercise_name: 'Deadlift', delta_sets: -2 },
      ]);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        prescribed_exercises: [expect.objectContaining({ sets: 1 })],
      });
    });

    it('applies reps delta and clamps to minimum 1', async () => {
      mockQueryBuilder.gte.mockResolvedValue({
        data: [{
          id: 'fw-1',
          week_number: 2,
          prescribed_exercises: [{ exercise_name: 'OHP', weight: 60, sets: 3, reps: 1 }],
        }],
        error: null,
      });
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.update.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      await applyCoachDiffToSchedule('e-1', 2, [
        { exercise_name: 'OHP', delta_reps: -5 },
      ]);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        prescribed_exercises: [expect.objectContaining({ reps: 1 })],
      });
    });

    it('skips exercises not in changes list', async () => {
      mockQueryBuilder.gte.mockResolvedValue({
        data: [{
          id: 'fw-1',
          week_number: 2,
          prescribed_exercises: [
            { exercise_name: 'Squat', weight: 160, sets: 4, reps: 5 },
            { exercise_name: 'Leg Press', weight: 100, sets: 3, reps: 10 },
          ],
        }],
        error: null,
      });
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.update.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      await applyCoachDiffToSchedule('e-1', 2, [
        { exercise_name: 'Squat', delta_weight_kg: 10 },
      ]);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        prescribed_exercises: [
          expect.objectContaining({ exercise_name: 'Squat', weight: 170 }),
          expect.objectContaining({ exercise_name: 'Leg Press', weight: 100 }), // unchanged
        ],
      });
    });

    it('respects week_from filter (only applies from specified week)', async () => {
      mockQueryBuilder.gte.mockResolvedValue({
        data: [
          {
            id: 'fw-1',
            week_number: 2,
            prescribed_exercises: [{ exercise_name: 'Bench Press', weight: 100, sets: 3, reps: 8 }],
          },
          {
            id: 'fw-2',
            week_number: 3,
            prescribed_exercises: [{ exercise_name: 'Bench Press', weight: 100, sets: 3, reps: 8 }],
          },
        ],
        error: null,
      });
      const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      mockQueryBuilder.update = updateMock;

      await applyCoachDiffToSchedule('e-1', 2, [
        { exercise_name: 'Bench Press', delta_weight_kg: 5, week_from: 3 },
      ]);

      // Week 2 should NOT be changed (week_from = 3)
      // Week 3 SHOULD be changed
      expect(updateMock).toHaveBeenCalledTimes(2);
      // First call (week 2): exercise unchanged (weight stays 100)
      expect(updateMock.mock.calls[0][0].prescribed_exercises[0].weight).toBe(100);
      // Second call (week 3): exercise updated (weight becomes 105)
      expect(updateMock.mock.calls[1][0].prescribed_exercises[0].weight).toBe(105);
    });

    it('rounds weight delta to nearest quarter kg', async () => {
      mockQueryBuilder.gte.mockResolvedValue({
        data: [{
          id: 'fw-1',
          week_number: 2,
          prescribed_exercises: [{ exercise_name: 'Bench Press', weight: 100, sets: 3, reps: 8 }],
        }],
        error: null,
      });
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.update.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      await applyCoachDiffToSchedule('e-1', 2, [
        { exercise_name: 'Bench Press', delta_weight_kg: 2.3 }, // 100 + 2.3 = 102.3 → rounds to 102.25
      ]);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        prescribed_exercises: [expect.objectContaining({ weight: 102.25 })],
      });
    });
  });

  // ─── createUserProgram / deleteUserProgram ───────────────────────────────────

  describe('createUserProgram', () => {
    it('throws when not authenticated', async () => {
      setSessionCache(null);
      await expect(createUserProgram({ name: 'My Program', days: [] })).rejects.toThrow('Not authenticated');
    });

    it('creates program with default values', async () => {
      const program = { id: 'p-new', name: 'My Program' };
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: program, error: null }); // programs insert

      const result = await createUserProgram({ name: 'My Program', days: [] });
      expect(mockClient.from).toHaveBeenCalledWith('programs');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
        user_id: 'user-1',
        name: 'My Program',
        split_type: 'custom',
        days_per_week: 3,
        goal: 'general',
        color: '#A47BFF',
        icon: '🤖',
      }));
      expect(result).toEqual(program);
    });

    it('inserts program days and exercises', async () => {
      const program = { id: 'p-new', name: 'Custom' };
      const dayRow = { id: 'day-1' };
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: program, error: null })   // program insert
        .mockResolvedValueOnce({ data: dayRow, error: null });   // day insert

      const programData = {
        name: 'Custom',
        days: [{
          day_index: 0,
          name: 'Push',
          muscle_groups: ['chest'],
          exercises: [{ exercise_name: 'Bench Press', base_sets: 4, base_reps: 8, is_compound: true, sort_order: 0 }],
        }],
      };

      await createUserProgram(programData);

      expect(mockClient.from).toHaveBeenCalledWith('program_days');
      expect(mockClient.from).toHaveBeenCalledWith('program_day_exercises');
    });

    it('throws on program insert error', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({ data: null, error: { message: 'duplicate name' } });
      await expect(createUserProgram({ name: 'Bad', days: [] })).rejects.toMatchObject({ message: 'duplicate name' });
    });
  });

  describe('deleteUserProgram', () => {
    it('throws when not authenticated', async () => {
      setSessionCache(null);
      await expect(deleteUserProgram('p-1')).rejects.toThrow('Not authenticated');
    });

    it('deletes program matching both id and user_id', async () => {
      // Chain: from('programs').delete().eq('id', p-1).eq('user_id', user-1)
      // Second .eq is terminal
      const eq2 = vi.fn().mockResolvedValue({ error: null });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      mockQueryBuilder.delete.mockReturnValueOnce({ eq: eq1 });

      await deleteUserProgram('p-1');
      expect(mockClient.from).toHaveBeenCalledWith('programs');
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(eq1).toHaveBeenCalledWith('id', 'p-1');
      expect(eq2).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('throws on DB error', async () => {
      const eq2 = vi.fn().mockResolvedValue({ error: { message: 'delete failed' } });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      mockQueryBuilder.delete.mockReturnValueOnce({ eq: eq1 });
      await expect(deleteUserProgram('p-1')).rejects.toMatchObject({ message: 'delete failed' });
    });
  });

  // ─── getVolumeStandards ──────────────────────────────────────────────────────

  describe('getVolumeStandards', () => {
    // Chain: from().select().eq(days_per_week).eq(scope)  — second .eq is terminal
    function setupVolumeStandardsMock(resolvedValue) {
      const eq2 = vi.fn().mockResolvedValue(resolvedValue);
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      mockQueryBuilder.select.mockReturnValueOnce({ eq: eq1 });
      return { eq1, eq2 };
    }

    it('queries muscle_volume_standards for requested days', async () => {
      const rows = [
        { muscle_group: 'chest', mev_low: 6, mev_high: 8, mav_low: 10, mav_high: 14, mrv_low: 16, mrv_high: 20 },
        { muscle_group: 'back', mev_low: 8, mev_high: 10, mav_low: 12, mav_high: 16, mrv_low: 18, mrv_high: 22 },
      ];
      const { eq1, eq2 } = setupVolumeStandardsMock({ data: rows, error: null });

      const result = await getVolumeStandards(4);
      expect(mockClient.from).toHaveBeenCalledWith('muscle_volume_standards');
      expect(eq1).toHaveBeenCalledWith('days_per_week', 4);
      expect(eq2).toHaveBeenCalledWith('scope', 'per_session');
      expect(result).toEqual({
        chest: { mev_low: 6, mev_high: 8, mav_low: 10, mav_high: 14, mrv_low: 16, mrv_high: 20 },
        back: { mev_low: 8, mev_high: 10, mav_low: 12, mav_high: 16, mrv_low: 18, mrv_high: 22 },
      });
    });

    it('defaults unsupported days_per_week to 3', async () => {
      const { eq1 } = setupVolumeStandardsMock({ data: [], error: null });
      await getVolumeStandards(7); // unsupported → defaults to 3
      expect(eq1).toHaveBeenCalledWith('days_per_week', 3);
    });

    it('returns empty object on DB error', async () => {
      setupVolumeStandardsMock({ data: null, error: { message: 'error' } });
      const result = await getVolumeStandards(4);
      expect(result).toEqual({});
    });
  });

  // ─── logPRShare ──────────────────────────────────────────────────────────────

  describe('logPRShare', () => {
    it('does nothing when no session', async () => {
      setSessionCache(null);
      await logPRShare({ exercise: 'Bench Press', type: '1rm', weight: 120, reps: 1, e1rm: 120 });
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it('inserts PR share record with correct fields for 1rm type', async () => {
      mockQueryBuilder.insert.mockResolvedValue({ error: null });

      await logPRShare({ exercise: 'Bench Press', type: '1rm', weight: 120, reps: 1, e1rm: 125 });
      expect(mockClient.from).toHaveBeenCalledWith('pr_shares');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        user_id: 'user-1',
        exercise_name: 'Bench Press',
        pr_type: '1rm',
        weight_kg: 120,
        reps: 1,
        estimated_1rm: 125,
      });
    });

    it('sets estimated_1rm to null for non-1rm types', async () => {
      mockQueryBuilder.insert.mockResolvedValue({ error: null });

      await logPRShare({ exercise: 'Squat', type: 'volume', weight: 100, reps: 12, e1rm: 130 });
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
        estimated_1rm: null,
      }));
    });
  });

  // ─── getExerciseHistory ───────────────────────────────────────────────────

  describe('getExerciseHistory', () => {
    it('returns empty object when no exercise names provided', async () => {
      const result = await getExerciseHistory([]);
      expect(result).toEqual({});
    });

    it('returns empty object when no session', async () => {
      setSessionCache(null);
      const result = await getExerciseHistory(['Bench Press']);
      expect(result).toEqual({});
    });

    it('groups sets by exercise and returns most recent workout data', async () => {
      const mockData = [
        { exercise_name: 'Bench Press', weight_kg: 80, reps: 8, set_number: 1, workout_id: 'w1', workouts: { started_at: '2025-03-20T10:00:00Z', user_id: 'user-1' } },
        { exercise_name: 'Bench Press', weight_kg: 82.5, reps: 6, set_number: 2, workout_id: 'w1', workouts: { started_at: '2025-03-20T10:00:00Z', user_id: 'user-1' } },
        { exercise_name: 'Bench Press', weight_kg: 75, reps: 10, set_number: 1, workout_id: 'w0', workouts: { started_at: '2025-03-15T10:00:00Z', user_id: 'user-1' } },
        { exercise_name: 'Squat', weight_kg: 120, reps: 5, set_number: 1, workout_id: 'w1', workouts: { started_at: '2025-03-20T10:00:00Z', user_id: 'user-1' } },
      ];
      mockQueryBuilder.order.mockResolvedValue({ data: mockData, error: null });

      const result = await getExerciseHistory(['Bench Press', 'Squat']);

      expect(result['Bench Press']).toBeDefined();
      expect(result['Bench Press'].weight).toBe(82.5); // best set from latest workout
      expect(result['Bench Press'].reps).toBe(6);
      expect(result['Bench Press'].sets).toHaveLength(2); // 2 sets from latest workout w1
      expect(result['Squat']).toBeDefined();
      expect(result['Squat'].weight).toBe(120);
    });

    it('returns empty object when query returns no data', async () => {
      mockQueryBuilder.order.mockResolvedValue({ data: [], error: null });
      const result = await getExerciseHistory(['Bench Press']);
      expect(result).toEqual({});
    });

    it('returns empty object on query error', async () => {
      mockQueryBuilder.order.mockResolvedValue({ data: null, error: { message: 'fail' } });
      const result = await getExerciseHistory(['Bench Press']);
      expect(result).toEqual({});
    });
  });
});
