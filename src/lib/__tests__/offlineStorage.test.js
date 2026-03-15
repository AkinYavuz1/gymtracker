import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase module before importing offlineStorage
const mockInsertWorkout = vi.fn();
const mockInsertSets = vi.fn();

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'workouts') {
        return {
          insert: mockInsertWorkout,
        };
      }
      if (table === 'workout_sets') {
        return {
          insert: mockInsertSets,
        };
      }
      return {};
    }),
  },
  getUser: vi.fn().mockResolvedValue({ id: 'test-user-id' }),
}));

import { getQueue, queueWorkout, getPendingCount, syncPendingWorkouts } from '../offlineStorage';
import { getUser, supabase } from '../supabase';

const QUEUE_KEY = 'gymtracker_offline_queue';

describe('offlineStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    mockInsertWorkout.mockClear();
    mockInsertSets.mockClear();
    getUser.mockClear();

    // Default: successful workout insert
    mockInsertWorkout.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'new-workout-id' }, error: null }),
      }),
    });

    // Default: successful sets insert
    mockInsertSets.mockResolvedValue({ error: null });
  });

  describe('getQueue', () => {
    it('returns empty array when nothing in storage', () => {
      expect(getQueue()).toEqual([]);
    });

    it('returns parsed queue from localStorage', () => {
      const queue = [{ id: 'test1', workout: {}, sets: [] }];
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      expect(getQueue()).toEqual(queue);
    });

    it('returns empty array on malformed JSON', () => {
      localStorage.setItem(QUEUE_KEY, 'not-json{{{');
      expect(getQueue()).toEqual([]);
    });
  });

  describe('queueWorkout', () => {
    it('adds a workout entry to the queue', () => {
      const workout = { title: 'Push Day', total_volume_kg: 5000 };
      const sets = [{ exercise_name: 'Bench Press', weight_kg: 100, reps: 8 }];

      const id = queueWorkout(workout, sets);

      expect(id).toMatch(/^offline_/);
      const queue = getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].workout).toEqual(workout);
      expect(queue[0].sets).toEqual(sets);
      expect(queue[0].queuedAt).toBeTruthy();
    });

    it('appends to existing queue', () => {
      queueWorkout({ title: 'Day 1' }, []);
      queueWorkout({ title: 'Day 2' }, []);

      expect(getQueue()).toHaveLength(2);
    });

    it('generates unique IDs', () => {
      const id1 = queueWorkout({}, []);
      const id2 = queueWorkout({}, []);
      expect(id1).not.toEqual(id2);
    });
  });

  describe('getPendingCount', () => {
    it('returns 0 when queue is empty', () => {
      expect(getPendingCount()).toBe(0);
    });

    it('returns correct count', () => {
      queueWorkout({}, []);
      queueWorkout({}, []);
      queueWorkout({}, []);
      expect(getPendingCount()).toBe(3);
    });
  });

  describe('syncPendingWorkouts', () => {
    it('returns { synced: 0, failed: 0 } when queue is empty', async () => {
      const result = await syncPendingWorkouts();
      expect(result).toEqual({ synced: 0, failed: 0 });
    });

    it('returns { synced: 0, failed: 0 } when user is not authenticated', async () => {
      queueWorkout({ title: 'Test' }, []);
      getUser.mockResolvedValueOnce(null);

      const result = await syncPendingWorkouts();
      expect(result).toEqual({ synced: 0, failed: 0 });
    });

    it('syncs workouts and removes from queue on success', async () => {
      queueWorkout({ title: 'Push Day' }, [{ exercise_name: 'Bench', weight_kg: 100, reps: 8 }]);

      const result = await syncPendingWorkouts();
      expect(result.synced).toBe(1);
      expect(result.failed).toBe(0);
      expect(getPendingCount()).toBe(0);
      expect(mockInsertWorkout).toHaveBeenCalled();
      expect(mockInsertSets).toHaveBeenCalled();
    });

    it('syncs workout without sets', async () => {
      queueWorkout({ title: 'Empty Workout' }, []);

      const result = await syncPendingWorkouts();
      expect(result.synced).toBe(1);
      expect(mockInsertWorkout).toHaveBeenCalled();
      // Sets insert should NOT be called when no sets
      expect(mockInsertSets).not.toHaveBeenCalled();
    });

    it('increments failed count on workout insert error', async () => {
      mockInsertWorkout.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
        }),
      });

      queueWorkout({ title: 'Failing Workout' }, []);

      const result = await syncPendingWorkouts();
      expect(result.synced).toBe(0);
      expect(result.failed).toBe(1);
      // Entry should remain in queue for retry
      expect(getPendingCount()).toBe(1);
    });

    it('increments failed count on sets insert error', async () => {
      mockInsertSets.mockResolvedValue({ error: new Error('Sets error') });

      queueWorkout({ title: 'Workout' }, [{ exercise_name: 'Bench', weight_kg: 100, reps: 8 }]);

      const result = await syncPendingWorkouts();
      expect(result.synced).toBe(0);
      expect(result.failed).toBe(1);
    });

    it('syncs multiple workouts independently', async () => {
      let callCount = 0;
      mockInsertWorkout.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 2) {
              return Promise.resolve({ data: null, error: new Error('Second fails') });
            }
            return Promise.resolve({ data: { id: `w-${callCount}` }, error: null });
          }),
        }),
      }));

      queueWorkout({ title: 'Day 1' }, []);
      queueWorkout({ title: 'Day 2' }, []);
      queueWorkout({ title: 'Day 3' }, []);

      const result = await syncPendingWorkouts();
      expect(result.synced).toBe(2);
      expect(result.failed).toBe(1);
    });

    it('adds user_id to workout on sync', async () => {
      queueWorkout({ title: 'Push Day' }, []);

      await syncPendingWorkouts();

      const insertCall = mockInsertWorkout.mock.calls[0][0];
      expect(insertCall.user_id).toBe('test-user-id');
      expect(insertCall.title).toBe('Push Day');
    });

    it('sets workout_id on sets when syncing', async () => {
      queueWorkout({ title: 'Push Day' }, [
        { exercise_name: 'Bench', weight_kg: 100, reps: 8 },
        { exercise_name: 'OHP', weight_kg: 60, reps: 8 },
      ]);

      await syncPendingWorkouts();

      const setsCall = mockInsertSets.mock.calls[0][0];
      expect(setsCall).toHaveLength(2);
      expect(setsCall[0].workout_id).toBe('new-workout-id');
      expect(setsCall[1].workout_id).toBe('new-workout-id');
    });
  });
});
