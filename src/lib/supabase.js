// ============================================================
// Supabase Client — initialized once, imported everywhere
// ============================================================
// Usage:
//   import { supabase } from '../lib/supabase';
//   const { data } = await supabase.from('workouts').select('*');
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️  Missing Supabase credentials.\n' +
    '   1. Copy .env.example to .env.local\n' +
    '   2. Add your Supabase URL and anon key\n' +
    '   3. Restart the dev server'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

// ─── Auth helpers ───────────────────────────────────────────

export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });
  return { data, error };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });
  return { data, error };
}

// ─── AI Coach API call ──────────────────────────────────────

export async function callCoachAPI(prompt, label, conversationId) {
  const session = await getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${supabaseUrl}/functions/v1/coach`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ prompt, label, conversationId }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Coach API failed');
  }

  return await response.json();
}

// ─── Data helpers ───────────────────────────────────────────

export async function getProfile() {
  const user = await getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  return data;
}

export async function updateProfile(updates) {
  const user = await getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();
  return { data, error };
}

export async function getTemplates() {
  const { data } = await supabase
    .from('templates')
    .select('*, template_exercises(*)')
    .order('sort_order');
  return data || [];
}

export async function getWorkouts(limit = 10) {
  const { data } = await supabase
    .from('workouts')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function getPersonalRecords() {
  const { data } = await supabase
    .from('personal_records')
    .select('*')
    .order('estimated_1rm', { ascending: false });
  return data || [];
}

export async function getWeeklyStats() {
  const user = await getUser();
  if (!user) return null;
  const { data } = await supabase.rpc('get_weekly_stats', {
    p_user_id: user.id,
  });
  return data;
}

export async function getVolumeTrend() {
  const user = await getUser();
  if (!user) return null;
  const { data } = await supabase.rpc('get_volume_trend', {
    p_user_id: user.id,
  });
  return data;
}

export async function checkAIQuota() {
  const user = await getUser();
  if (!user) return null;
  const { data } = await supabase.rpc('check_ai_quota', {
    p_user_id: user.id,
  });
  return data;
}

export async function seedDummyData() {
  const user = await getUser();
  if (!user) return;

  try {
    // Check if user already has workouts
    const { data: existingWorkouts } = await supabase
      .from('workouts')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (existingWorkouts && existingWorkouts.length > 0) {
      // User already has data, don't seed
      return;
    }

    const now = new Date();
    const dummyWorkouts = [
      {
        user_id: user.id,
        title: 'Push Day',
        started_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        finished_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 65 * 60 * 1000).toISOString(),
        duration_secs: 65 * 60,
        total_volume_kg: 14100,
        notes: 'Great session, felt strong'
      },
      {
        user_id: user.id,
        title: 'Pull Day',
        started_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        finished_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 + 58 * 60 * 1000).toISOString(),
        duration_secs: 58 * 60,
        total_volume_kg: 10880,
        notes: 'Good pump, deadlifts felt heavy'
      },
      {
        user_id: user.id,
        title: 'Legs',
        started_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        finished_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 71 * 60 * 1000).toISOString(),
        duration_secs: 71 * 60,
        total_volume_kg: 18200,
        notes: 'Quads are sore, good depth on squats'
      }
    ];

    // Insert dummy workouts
    const { data: insertedWorkouts } = await supabase
      .from('workouts')
      .insert(dummyWorkouts)
      .select();

    if (insertedWorkouts && insertedWorkouts.length > 0) {
      // Insert dummy workout sets and PRs
      const dummyExercises = [
        { name: 'Bench Press', weight: 120, reps: 8, muscle: 'Chest' },
        { name: 'Back Squat', weight: 180, reps: 6, muscle: 'Legs' },
        { name: 'Deadlift', weight: 200, reps: 5, muscle: 'Back' },
        { name: 'Overhead Press', weight: 80, reps: 8, muscle: 'Shoulders' },
      ];

      // Add some dummy sets to workouts
      for (const workout of insertedWorkouts) {
        const setCount = Math.floor(Math.random() * 2) + 3;
        const sets = [];
        for (let i = 0; i < setCount; i++) {
          const ex = dummyExercises[Math.floor(Math.random() * dummyExercises.length)];
          sets.push({
            workout_id: workout.id,
            exercise_name: ex.name,
            set_number: i + 1,
            weight_kg: ex.weight,
            reps: ex.reps,
            completed: true,
            rpe: Math.floor(Math.random() * 3) + 6
          });
        }
        await supabase.from('workout_sets').insert(sets);
      }

      // Insert dummy PRs
      const dummyPRs = [
        { user_id: user.id, exercise_name: 'Bench Press', weight_kg: 120, reps: 8 },
        { user_id: user.id, exercise_name: 'Back Squat', weight_kg: 180, reps: 6 },
        { user_id: user.id, exercise_name: 'Deadlift', weight_kg: 200, reps: 5 },
        { user_id: user.id, exercise_name: 'Overhead Press', weight_kg: 80, reps: 8 },
      ];
      await supabase.from('personal_records').insert(dummyPRs);
    }
  } catch (e) {
    console.error('Error seeding dummy data:', e);
  }
}
