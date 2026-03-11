// ============================================================
// Offline Storage — queues workouts locally when offline
// and syncs to Supabase when back online
// ============================================================

import { supabase, getUser } from './supabase';

const QUEUE_KEY = 'gymtracker_offline_queue';

// ─── Queue Management ────────────────────────────────────────

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function queueWorkout(workout, sets) {
  const queue = getQueue();
  const entry = {
    id: `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    workout,
    sets,
    queuedAt: new Date().toISOString(),
  };
  queue.push(entry);
  saveQueue(queue);
  return entry.id;
}

function removeFromQueue(id) {
  const queue = getQueue().filter(e => e.id !== id);
  saveQueue(queue);
}

export function getPendingCount() {
  return getQueue().length;
}

// ─── Sync ────────────────────────────────────────────────────

export async function syncPendingWorkouts() {
  const queue = getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  const user = await getUser();
  if (!user) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const entry of queue) {
    try {
      // Insert workout
      const { data: workout, error: workoutError } = await supabase
        .from('workouts')
        .insert({ ...entry.workout, user_id: user.id })
        .select()
        .single();

      if (workoutError) throw workoutError;

      // Insert sets with real workout_id
      if (entry.sets && entry.sets.length > 0) {
        const setsWithId = entry.sets.map(s => ({ ...s, workout_id: workout.id }));
        const { error: setsError } = await supabase
          .from('workout_sets')
          .insert(setsWithId);
        if (setsError) throw setsError;
      }

      removeFromQueue(entry.id);
      synced++;
    } catch (e) {
      console.error('Failed to sync offline workout:', e);
      failed++;
    }
  }

  return { synced, failed };
}
