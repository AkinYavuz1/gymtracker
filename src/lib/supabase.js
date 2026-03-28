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

// ─── Session cache ───────────────────────────────────────────
// Kept fresh by App.jsx calling setSessionCache() from its single
// onAuthStateChange listener. Zero network calls, zero Web Lock usage.
let _cachedSession = null;
export function setSessionCache(session) { _cachedSession = session; }

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

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://gainsai.uk/reset-password',
  });
  return { error };
}

export async function updatePassword(currentPassword, newPassword) {
  const session = await getSession();
  if (!session?.user?.email) throw new Error('Not authenticated');
  // Re-authenticate with current password first
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: session.user.email, password: currentPassword });
  if (authErr) throw new Error('Current password is incorrect');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getSession() {
  // Return cached session — no network call, no Web Lock.
  // Cache is kept fresh by the onAuthStateChange listener above.
  return _cachedSession;
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signInWithGoogle() {
  // Native Android/iOS: use Capacitor Google Auth plugin for native account picker
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
      await GoogleAuth.initialize();
      const googleUser = await GoogleAuth.signIn();
      const idToken = googleUser?.authentication?.idToken;
      if (!idToken) {
        return { data: null, error: { message: 'No ID token received from Google' } };
      }
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      return { data, error };
    }
  } catch (e) {
    // If user cancelled the native sign-in, return a soft error
    if (e?.message?.includes('cancel') || e?.message?.includes('Cancel') ||
        e?.code === 'SIGN_IN_CANCELLED' || e?.code === '12501') {
      return { data: null, error: null };
    }
    // If Capacitor import fails (web dev), fall through to OAuth
    if (!e?.message?.includes('import') && !e?.message?.includes('module')) {
      return { data: null, error: { message: e.message || 'Google sign-in failed' } };
    }
  }

  // Web fallback: browser-based OAuth redirect
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    },
  });
  return { data, error };
}

// ─── AI Coach API call ──────────────────────────────────────

export async function callCoachAPI(prompt, label, conversationId, options = {}) {
  // Get current session, refresh if needed
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  // If token expires within 60s, force a refresh
  const expiresAt = session.expires_at ?? 0;
  if (expiresAt - Math.floor(Date.now() / 1000) < 60) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session) session = refreshed.session;
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/coach`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ prompt, label, conversationId, ...(options.max_tokens ? { max_tokens: options.max_tokens } : {}) }),
    }
  );

  if (!response.ok) {
    let errMsg = `Coach API error (${response.status})`;
    try {
      const err = await response.json();
      errMsg = err.error || errMsg;
      console.error('Coach API error response:', response.status, err);
    } catch {
      // Response body wasn't JSON (e.g. HTML error page) — keep status-based message
      console.error('Coach API error (non-JSON):', response.status, response.statusText);
    }
    throw new Error(errMsg);
  }

  return await response.json();
}

// ─── Data helpers ───────────────────────────────────────────

export async function getProfile() {
  const session = await getSession();
  if (!session?.user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  // If profile doesn't exist (user deleted account and logged back in), recreate it
  if (error?.code === 'PGRST116') {
    const newProfile = {
      id: session.user.id,
      name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || 'Athlete',
      email: session.user.email,
      avatar_url: session.user.user_metadata?.avatar_url || null,
      plan: 'free',
      ai_queries_today: 0,
      ai_queries_reset_at: new Date().toISOString().split('T')[0],
    };
    const { data: created, error: insertError } = await supabase
      .from('profiles')
      .insert([newProfile])
      .select('*')
      .single();
    if (insertError) console.error('Error recreating profile:', insertError);
    return created || null;
  }

  return data;
}

export async function updateProfile(updates) {
  const session = await getSession();
  if (!session?.user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', session.user.id)
    .select()
    .single();
  return { data, error };
}

export async function getTemplates() {
  const { data } = await supabase
    .from('templates')
    .select('*, template_exercises(*)')
    .order('sort_order');

  // If no templates exist (e.g. DB trigger didn't fire for OAuth user),
  // seed them now via the RPC and retry once
  if (!data || data.length === 0) {
    const session = await getSession();
    if (session?.user) {
      await supabase.rpc('seed_default_templates', { p_user_id: session.user.id });
      const { data: retried } = await supabase
        .from('templates')
        .select('*, template_exercises(*)')
        .order('sort_order');
      return retried || [];
    }
  }

  return data || [];
}

export async function getWorkouts(limit = 10) {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) console.error('getWorkouts error:', error);
  return data || [];
}


export async function deleteWorkout(workoutId, startedAt) {
  const session = await getSession();
  const userId = session?.user?.id;

  // Reset by workout_id FK (data saved after the fix that stores this link)
  await supabase
    .from('scheduled_workouts')
    .update({ status: 'scheduled', workout_id: null })
    .eq('workout_id', workoutId);

  // Fallback: reset by week range for older data where workout_id was never stored.
  // Find any completed scheduled workout with no workout_id link within the same
  // calendar week as the deleted workout — these are orphaned completions.
  if (startedAt && userId) {
    const d = new Date(startedAt);
    // Get Monday of that week
    const day = d.getDay(); // 0=Sun
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    const weekStart = monday.toISOString().split('T')[0];
    const weekEnd = sunday.toISOString().split('T')[0];

    await supabase
      .from('scheduled_workouts')
      .update({ status: 'scheduled', workout_id: null })
      .eq('user_id', userId)
      .eq('status', 'completed')
      .is('workout_id', null)
      .gte('scheduled_date', weekStart)
      .lte('scheduled_date', weekEnd);
  }

  // Deactivate PRs achieved in this workout (preserve history, just hide from active view)
  const { data: affectedPRs } = await supabase
    .from('personal_records')
    .select('id, exercise_name, pr_type')
    .eq('workout_id', workoutId)
    .eq('is_active', true);

  if (affectedPRs?.length) {
    await supabase
      .from('personal_records')
      .update({ is_active: false })
      .eq('workout_id', workoutId);
  }

  const { error } = await supabase
    .from('workouts')
    .delete()
    .eq('id', workoutId);
  if (error) throw error;
}

export async function importWorkouts(workoutGroups) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Build set of existing workout keys (title::YYYY-MM-DD) for duplicate detection
  const { data: existing } = await supabase
    .from('workouts')
    .select('title, started_at')
    .eq('user_id', user.id);

  const existingKeys = new Set(
    (existing || []).map(w => `${w.title}::${w.started_at.slice(0, 10)}`)
  );

  let inserted = 0;
  let skipped = 0;
  const errors = [];

  for (const group of workoutGroups) {
    const dayKey = `${group.title}::${group.startedAt.slice(0, 10)}`;
    if (existingKeys.has(dayKey)) {
      skipped++;
      continue;
    }

    // Insert workout row
    const { data: newWorkout, error: workoutErr } = await supabase
      .from('workouts')
      .insert({
        user_id: user.id,
        title: group.title,
        started_at: group.startedAt,
        finished_at: group.finishedAt,
        duration_secs: group.durationSecs || null,
        total_volume_kg: group.totalVolumeKg,
        notes: null,
      })
      .select()
      .single();

    if (workoutErr || !newWorkout) {
      errors.push(`${group.title} (${group.startedAt.slice(0, 10)}): ${workoutErr?.message || 'insert failed'}`);
      continue;
    }

    // Insert sets in chunks to stay within payload limits
    if (group.sets.length > 0) {
      const setRows = group.sets.map(s => ({
        workout_id: newWorkout.id,
        exercise_name: s.exerciseName,
        set_number: s.setNumber,
        weight_kg: s.weightKg,
        reps: s.reps,
        completed: true,
        rpe: s.rpe,
      }));

      for (let i = 0; i < setRows.length; i += 500) {
        const chunk = setRows.slice(i, i + 500);
        const { error: setsErr } = await supabase.from('workout_sets').insert(chunk);
        if (setsErr) errors.push(`Sets for ${group.title}: ${setsErr.message}`);
      }
    }

    // Backfill PRs — find best set per exercise by estimated 1RM and by volume
    const byExercise = {};
    for (const s of group.sets) {
      if (!byExercise[s.exerciseName]) byExercise[s.exerciseName] = [];
      byExercise[s.exerciseName].push(s);
    }

    const prRows = [];
    for (const [exerciseName, sets] of Object.entries(byExercise)) {
      const best1rm = sets.reduce((best, s) => {
        const e1rm = s.weightKg * (1 + s.reps / 30);
        const bestE1rm = best.weightKg * (1 + best.reps / 30);
        return e1rm > bestE1rm ? s : best;
      });
      const bestVol = sets.reduce((best, s) =>
        s.weightKg * s.reps > best.weightKg * best.reps ? s : best
      );

      prRows.push({
        user_id: user.id,
        exercise_name: exerciseName,
        weight_kg: best1rm.weightKg,
        reps: best1rm.reps,
        pr_type: '1rm',
        achieved_at: group.startedAt,
        workout_id: newWorkout.id,
        is_active: true,
      });
      prRows.push({
        user_id: user.id,
        exercise_name: exerciseName,
        weight_kg: bestVol.weightKg,
        reps: bestVol.reps,
        pr_type: 'volume',
        achieved_at: group.startedAt,
        workout_id: newWorkout.id,
        is_active: true,
      });
    }

    if (prRows.length > 0) {
      await supabase.from('personal_records').insert(prRows);
    }

    inserted++;
  }

  return { inserted, skipped, errors };
}

// Fetch last session data for a list of exercise names.
// Returns { "Bench Press": { weight: 80, reps: 8, date: "2025-03-20", sets: [...] }, ... }
export async function getExerciseHistory(exerciseNames) {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId || !exerciseNames || exerciseNames.length === 0) return {};

  // Get the user's most recent sets for each exercise, joined with workout date
  const { data, error } = await supabase
    .from('workout_sets')
    .select('exercise_name, weight_kg, reps, set_number, workout_id, workouts!inner(started_at, user_id)')
    .eq('workouts.user_id', userId)
    .in('exercise_name', exerciseNames)
    .eq('completed', true)
    .order('set_number', { ascending: true });

  if (error) {
    console.error('getExerciseHistory error:', error);
    return {};
  }
  if (!data || data.length === 0) return {};

  // Group by exercise, then find the most recent workout for each
  const byExercise = {};
  for (const row of data) {
    const name = row.exercise_name;
    if (!byExercise[name]) byExercise[name] = [];
    byExercise[name].push(row);
  }

  const result = {};
  for (const [name, rows] of Object.entries(byExercise)) {
    // Find the most recent workout_id for this exercise
    const sorted = rows.sort((a, b) =>
      new Date(b.workouts.started_at) - new Date(a.workouts.started_at)
    );
    const latestWorkoutId = sorted[0].workout_id;
    const latestDate = sorted[0].workouts.started_at;

    // Get all sets from that workout for this exercise
    const latestSets = sorted
      .filter(r => r.workout_id === latestWorkoutId)
      .sort((a, b) => a.set_number - b.set_number)
      .map(r => ({ weight: r.weight_kg, reps: r.reps }));

    // Best set = highest weight
    const best = latestSets.reduce((b, s) => s.weight > b.weight ? s : b, latestSets[0]);

    result[name] = {
      weight: best.weight,
      reps: best.reps,
      date: latestDate,
      sets: latestSets,
    };
  }

  return result;
}

export async function getWorkoutSets(workoutIds) {
  if (!workoutIds || workoutIds.length === 0) return [];
  const { data, error } = await supabase
    .from('workout_sets')
    .select('*')
    .in('workout_id', workoutIds)
    .order('set_number', { ascending: true });
  if (error) console.error('getWorkoutSets error:', error);
  return data || [];
}

export async function getPersonalRecords() {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) return [];
  const { data, error } = await supabase
    .from('personal_records')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('estimated_1rm', { ascending: false });
  if (error) console.error('getPersonalRecords error:', error);
  return data || [];
}

export async function getWeeklyStats() {
  const session = await getSession();
  if (!session?.user) return null;
  const { data } = await supabase.rpc('get_weekly_stats', {
    p_user_id: session.user.id,
  });
  return data;
}

export async function logPRShare(pr) {
  const session = await getSession();
  if (!session?.user) return;
  await supabase.from('pr_shares').insert({
    user_id: session.user.id,
    exercise_name: pr.exercise,
    pr_type: pr.type,
    weight_kg: pr.weight,
    reps: pr.reps,
    estimated_1rm: pr.type === '1rm' ? pr.e1rm : null,
  });
}

export async function getVolumeTrend() {
  const session = await getSession();
  if (!session?.user) return null;
  const { data } = await supabase.rpc('get_volume_trend', {
    p_user_id: session.user.id,
  });
  return data;
}

export async function checkAIQuota() {
  const session = await getSession();
  if (!session?.user) return null;
  const { data } = await supabase.rpc('check_ai_quota', {
    p_user_id: session.user.id,
  });
  return data;
}

export async function seedDummyData() {
  const session = await getSession();
  if (!session?.user) return;
  const user = session.user;

  try {
    // Check if user already has workouts (quick check)
    const { data: existingWorkouts, error: checkError } = await supabase
      .from('workouts')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .limit(1);

    if (checkError || (existingWorkouts && existingWorkouts.length > 0)) {
      // User already has data, don't seed
      return;
    }

    // Run seeding in background (don't block UI)
    setTimeout(async () => {
      try {
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
          // Prepare all sets and PRs at once
          const dummyExercises = [
            { name: 'Bench Press', weight: 120, reps: 8 },
            { name: 'Back Squat', weight: 180, reps: 6 },
            { name: 'Deadlift', weight: 200, reps: 5 },
            { name: 'Overhead Press', weight: 80, reps: 8 },
          ];

          const allSets = [];
          for (const workout of insertedWorkouts) {
            const setCount = Math.floor(Math.random() * 2) + 3;
            for (let i = 0; i < setCount; i++) {
              const ex = dummyExercises[Math.floor(Math.random() * dummyExercises.length)];
              allSets.push({
                workout_id: workout.id,
                exercise_name: ex.name,
                set_number: i + 1,
                weight_kg: ex.weight,
                reps: ex.reps,
                completed: true,
                rpe: Math.floor(Math.random() * 3) + 6
              });
            }
          }

          // Batch insert sets
          if (allSets.length > 0) {
            await supabase.from('workout_sets').insert(allSets);
          }

          // Batch insert PRs (1RM and volume)
          const dummyPRs = [
            { user_id: user.id, exercise_name: 'Bench Press', weight_kg: 120, reps: 8, pr_type: '1rm' },
            { user_id: user.id, exercise_name: 'Back Squat', weight_kg: 180, reps: 6, pr_type: '1rm' },
            { user_id: user.id, exercise_name: 'Deadlift', weight_kg: 200, reps: 5, pr_type: '1rm' },
            { user_id: user.id, exercise_name: 'Overhead Press', weight_kg: 80, reps: 8, pr_type: '1rm' },
            { user_id: user.id, exercise_name: 'Bench Press', weight_kg: 100, reps: 12, pr_type: 'volume' },
            { user_id: user.id, exercise_name: 'Back Squat', weight_kg: 140, reps: 10, pr_type: 'volume' },
            { user_id: user.id, exercise_name: 'Deadlift', weight_kg: 160, reps: 8, pr_type: 'volume' },
            { user_id: user.id, exercise_name: 'Overhead Press', weight_kg: 60, reps: 12, pr_type: 'volume' },
          ];
          await supabase.from('personal_records').insert(dummyPRs);
        }
      } catch (e) {
        console.error('Error seeding dummy data in background:', e);
      }
    }, 1000); // Start seeding after 1 second so UI loads first
  } catch (e) {
    console.error('Error checking for existing data:', e);
  }
}

// ─── Program helpers ────────────────────────────────────────

export async function getPrograms() {
  const session = await getSession();
  const userId = session?.user?.id;

  let query = supabase
    .from('programs')
    .select('*, program_days(*, program_day_exercises(*))')
    .eq('is_active', true)
    .order('days_per_week');

  if (userId) {
    query = query.or(`user_id.is.null,user_id.eq.${userId}`);
  } else {
    query = query.is('user_id', null);
  }

  const { data, error } = await query;
  if (error) console.error('getPrograms error:', error);
  return data || [];
}

export async function getProgramDetails(programId) {
  const { data, error } = await supabase
    .from('programs')
    .select('*, program_days(*, program_day_exercises(*))')
    .eq('id', programId)
    .single();
  if (error) console.error('getProgramDetails error:', error);
  return data;
}

export async function getActiveEnrollment() {
  const session = await getSession();
  if (!session?.user) return null;
  const { data, error } = await supabase
    .from('program_enrollments')
    .select('*, programs(*, program_days(*, program_day_exercises(*)))')
    .eq('user_id', session.user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (error) console.error('getActiveEnrollment error:', error);
  return data;
}

export async function enrollInProgram(programId, settings = {}, startDate = null) {
  const session = await getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const row = {
    user_id: session.user.id,
    program_id: programId,
    settings,
    status: 'active',
    current_week: 1,
    current_day: 0,
    checkin_frequency: settings.checkin_frequency || 'weekly',
  };
  if (startDate) row.started_at = startDate;
  const { data, error } = await supabase
    .from('program_enrollments')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function abandonProgram(enrollmentId) {
  const { error } = await supabase
    .from('program_enrollments')
    .update({ status: 'abandoned' })
    .eq('id', enrollmentId);
  if (error) throw error;
}

export async function getScheduledWorkouts(startDate, endDate, enrollmentId, weekNumber) {
  const session = await getSession();
  if (!session?.user) return [];
  let query = supabase
    .from('scheduled_workouts')
    .select('*, program_days(name, muscle_groups)')
    .eq('user_id', session.user.id)
    .order('scheduled_date');
  if (enrollmentId) {
    query = query.eq('enrollment_id', enrollmentId);
  }
  if (weekNumber) {
    query = query.eq('week_number', weekNumber);
  } else {
    query = query.gte('scheduled_date', startDate).lte('scheduled_date', endDate);
  }
  const { data, error } = await query;
  if (error) console.error('getScheduledWorkouts error:', error);
  return data || [];
}

export async function updateScheduledWorkout(id, updates) {
  const { data, error } = await supabase
    .from('scheduled_workouts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) console.error('updateScheduledWorkout error:', error);
  return data;
}

export async function generateSchedule(enrollmentId, programDays, startDate, settings) {
  const session = await getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const trainingDays = settings.trainingDays || [1, 2, 3, 4, 5, 6]; // default Mon-Sat (1=Mon, 7=Sun)
  const startingWeights = settings.startingWeights || {};
  const rows = [];

  for (let week = 1; week <= 5; week++) {
    // Find the Monday of each week
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + (week - 1) * 7);

    let dayIdx = 0;
    for (let d = 0; d < 7 && dayIdx < programDays.length; d++) {
      const dayOfWeek = d + 1; // 1=Mon, 7=Sun
      if (!trainingDays.includes(dayOfWeek)) continue;

      const programDay = programDays[dayIdx % programDays.length];
      const schedDate = new Date(weekStart);
      schedDate.setDate(schedDate.getDate() + d);

      // Build prescribed exercises from programEngine
      const prescribed = (programDay.program_day_exercises || [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(ex => ({
          exercise_name: ex.exercise_name,
          sets: ex.base_sets,
          reps: ex.base_reps,
          weight: startingWeights[ex.exercise_name] || 20,
          is_compound: ex.is_compound,
          rir: 3,
        }));

      rows.push({
        enrollment_id: enrollmentId,
        user_id: session.user.id,
        program_day_id: programDay.id,
        scheduled_date: schedDate.toISOString().split('T')[0],
        week_number: week,
        status: 'scheduled',
        prescribed_exercises: prescribed,
      });

      dayIdx++;
    }
  }

  // Mark past days as skipped (for "This week" start option)
  const today = new Date().toISOString().split('T')[0];
  rows.forEach(r => {
    if (r.scheduled_date < today) r.status = 'skipped';
  });

  if (rows.length > 0) {
    const { error } = await supabase
      .from('scheduled_workouts')
      .insert(rows);
    if (error) throw error;
  }

  return rows.length;
}

async function saveWorkoutFeedback(scheduledWorkoutId, workoutId, feedbackType, data) {
  const session = await getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const row = {
    user_id: session.user.id,
    scheduled_workout_id: scheduledWorkoutId,
    feedback_type: feedbackType,
    ...data,
  };
  if (workoutId != null) row.workout_id = workoutId;
  const { error } = await supabase.from('workout_feedback').insert(row);
  if (error) throw error;
}

export async function savePumpRating(scheduledWorkoutId, workoutId, rating) {
  return saveWorkoutFeedback(scheduledWorkoutId, workoutId, 'pump', { overall_rating: rating });
}

export async function saveDifficultyRating(scheduledWorkoutId, workoutId, rating) {
  return saveWorkoutFeedback(scheduledWorkoutId, workoutId, 'difficulty', { overall_rating: rating });
}

async function getCurrentScheduledContext(scheduledWorkoutId) {
  const { data, error } = await supabase
    .from('scheduled_workouts')
    .select('program_day_id, enrollment_id, week_number')
    .eq('id', scheduledWorkoutId)
    .single();
  if (error || !data) return null;
  return data;
}

async function getFutureScheduledWorkouts(current) {
  const { data, error } = await supabase
    .from('scheduled_workouts')
    .select('id, prescribed_exercises, week_number')
    .eq('enrollment_id', current.enrollment_id)
    .eq('program_day_id', current.program_day_id)
    .eq('status', 'scheduled')
    .gt('week_number', current.week_number)
    .neq('week_number', 5);
  if (error) return null;
  return data;
}

export async function applyDifficultyToFutureWorkouts(scheduledWorkoutId, difficultyRating) {
  // Only adjust for too-easy (1-3) or too-hard (9-10)
  if (difficultyRating > 3 && difficultyRating < 9) return;

  const session = await getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const current = await getCurrentScheduledContext(scheduledWorkoutId);
  if (!current) return;

  // Get future scheduled workouts with same program_day_id (exclude deload week 5)
  const futureWorkouts = await getFutureScheduledWorkouts(current);
  if (!futureWorkouts?.length) return;

  const roundToQuarter = (v) => Math.round(v * 4) / 4;
  const isEasy = difficultyRating <= 3;
  const weightMult = isEasy ? 1.025 : 0.95;

  for (const fw of futureWorkouts) {
    const exercises = (fw.prescribed_exercises || []).map(ex => {
      const updated = { ...ex };
      // Adjust weight
      if (updated.weight) {
        updated.weight = roundToQuarter(updated.weight * weightMult);
      }
      // Adjust sets for compounds
      if (updated.is_compound) {
        if (isEasy && (updated.sets || 3) < 5) {
          updated.sets = (updated.sets || 3) + 1;
        } else if (!isEasy && (updated.sets || 3) > 2) {
          updated.sets = (updated.sets || 3) - 1;
        }
      }
      return updated;
    });

    await supabase
      .from('scheduled_workouts')
      .update({ prescribed_exercises: exercises })
      .eq('id', fw.id);
  }
}

export async function reduceSetsFutureWorkouts(scheduledWorkoutId, incompleteExerciseNames) {
  const session = await getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const current = await getCurrentScheduledContext(scheduledWorkoutId);
  if (!current) return;

  const futureWorkouts = await getFutureScheduledWorkouts(current);
  if (!futureWorkouts?.length) return;

  const incompleteSet = incompleteExerciseNames
    ? new Set(incompleteExerciseNames.map(n => n.toLowerCase()))
    : null;

  for (const fw of futureWorkouts) {
    const exercises = (fw.prescribed_exercises || []).map(ex => {
      if (incompleteSet && !incompleteSet.has((ex.exercise_name || ex.name || '').toLowerCase())) {
        return ex;
      }
      return { ...ex, sets: Math.max(1, (ex.sets || 3) - 1) };
    });
    await supabase
      .from('scheduled_workouts')
      .update({ prescribed_exercises: exercises })
      .eq('id', fw.id);
  }
}


export async function saveSorenessRatings(scheduledWorkoutId, muscleRatings) {
  return saveWorkoutFeedback(scheduledWorkoutId, null, 'soreness', { muscle_ratings: muscleRatings });
}

export async function getRecentFeedback(muscleGroups) {
  const session = await getSession();
  if (!session?.user) return [];
  const { data, error } = await supabase
    .from('workout_feedback')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) console.error('getRecentFeedback error:', error);
  return data || [];
}

export async function saveProgressCheckin(checkinData) {
  const session = await getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('progress_checkins')
    .insert({
      user_id: session.user.id,
      ...checkinData,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getProgressCheckins(enrollmentId) {
  const session = await getSession();
  if (!session?.user) return [];
  let query = supabase
    .from('progress_checkins')
    .select('*')
    .eq('user_id', session.user.id)
    .order('checkin_date', { ascending: false })
    .limit(30);
  if (enrollmentId) query = query.eq('enrollment_id', enrollmentId);
  const { data, error } = await query;
  if (error) console.error('getProgressCheckins error:', error);
  return data || [];
}

export async function applyCoachDiffToSchedule(enrollmentId, currentWeek, changes) {
  const session = await getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data: futureWorkouts, error } = await supabase
    .from('scheduled_workouts')
    .select('id, prescribed_exercises, week_number')
    .eq('enrollment_id', enrollmentId)
    .eq('status', 'scheduled')
    .gte('week_number', currentWeek);
  if (error) throw error;
  if (!futureWorkouts?.length) return 0;

  const roundToQuarter = (v) => Math.round(v * 4) / 4;
  let updatedCount = 0;

  for (const fw of futureWorkouts) {
    const exercises = (fw.prescribed_exercises || []).map(ex => {
      const change = changes.find(c =>
        c.exercise_name?.toLowerCase() === ex.exercise_name?.toLowerCase() &&
        (c.week_from == null || fw.week_number >= c.week_from)
      );
      if (!change) return ex;
      const updated = { ...ex };
      if (change.delta_weight_kg) updated.weight = roundToQuarter((updated.weight || 0) + change.delta_weight_kg);
      if (change.delta_sets) updated.sets = Math.max(1, (updated.sets || 3) + change.delta_sets);
      if (change.delta_reps) updated.reps = Math.max(1, (updated.reps || 8) + change.delta_reps);
      return updated;
    });

    const { error: updateErr } = await supabase
      .from('scheduled_workouts')
      .update({ prescribed_exercises: exercises })
      .eq('id', fw.id);
    if (!updateErr) updatedCount++;
  }

  return updatedCount;
}

export async function createUserProgram(programData) {
  const session = await getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data: program, error: progErr } = await supabase
    .from('programs')
    .insert({
      user_id: session.user.id,
      name: programData.name,
      description: programData.description,
      split_type: programData.split_type || 'custom',
      days_per_week: programData.days_per_week || 3,
      goal: programData.goal || 'general',
      color: programData.color || '#A47BFF',
      icon: programData.icon || '🤖',
      slug: null,
    })
    .select()
    .single();
  if (progErr) throw progErr;

  for (const day of (programData.days || [])) {
    const { data: dayRow, error: dayErr } = await supabase
      .from('program_days')
      .insert({
        program_id: program.id,
        day_index: day.day_index,
        name: day.name,
        muscle_groups: day.muscle_groups || [],
      })
      .select()
      .single();
    if (dayErr) throw dayErr;

    for (const ex of (day.exercises || [])) {
      const { error: exErr } = await supabase
        .from('program_day_exercises')
        .insert({
          program_day_id: dayRow.id,
          exercise_name: ex.exercise_name,
          base_sets: ex.base_sets || 3,
          base_reps: ex.base_reps || 8,
          is_compound: ex.is_compound ?? true,
          sort_order: ex.sort_order || 0,
        });
      if (exErr) throw exErr;
    }
  }

  return program;
}

export async function deleteUserProgram(programId) {
  const session = await getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('programs')
    .delete()
    .eq('id', programId)
    .eq('user_id', session.user.id);
  if (error) throw error;
}

/**
 * Fetch per-session volume standards for a given training frequency.
 * Returns a map: { [muscle_group]: { mev_low, mev_high, mav_low, mav_high, mrv_low, mrv_high } }
 */
export async function createCheckoutSession(priceId) {
  const session = await getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${supabaseUrl}/functions/v1/create-checkout`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ priceId }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    let msg = 'Checkout failed';
    try { msg = JSON.parse(text).error || text; } catch { msg = text; }
    throw new Error(`${response.status}: ${msg}`);
  }

  return await response.json(); // { url: "https://checkout.stripe.com/..." }
}

export async function deleteUserAccount() {
  const session = await getSession();
  if (!session?.user) throw new Error('Not authenticated');

  console.log('Starting account deletion for user:', session.user.id, 'email:', session.user.email);

  // Delete the profile (cascades to workouts, PRs, etc.)
  const { error: deleteError } = await supabase.rpc('delete_user_account', { p_user_id: session.user.id });
  if (deleteError) {
    console.error('Delete RPC error:', deleteError);
    throw deleteError;
  }

  console.log('Profile deletion successful');

  // Also sign out to clear the session
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) console.warn("Sign out error (non-fatal):", signOutError);
}

// ─── Readiness Score helpers ─────────────────────────────────

export async function saveReadinessScore(data) {
  const session = await getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const { data: result, error } = await supabase
    .from('readiness_scores')
    .upsert({
      user_id: session.user.id,
      score_date: data.score_date || new Date().toISOString().split('T')[0],
      score: data.score,
      sleep_hours: data.sleep_hours,
      hrv_ms: data.hrv_ms || null,
      avg_soreness: data.avg_soreness || null,
      joint_comfort: data.joint_comfort || null,
      dreading: data.dreading || false,
      source: data.source || 'manual',
    }, { onConflict: 'user_id,score_date' })
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function getReadinessScore(date) {
  const session = await getSession();
  if (!session?.user) return null;
  const scoreDate = date || new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('readiness_scores')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('score_date', scoreDate)
    .maybeSingle();
  if (error) console.error('getReadinessScore error:', error);
  return data;
}

export async function getReadinessHistory(days = 14) {
  const session = await getSession();
  if (!session?.user) return [];
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabase
    .from('readiness_scores')
    .select('*')
    .eq('user_id', session.user.id)
    .gte('score_date', since.toISOString().split('T')[0])
    .order('score_date', { ascending: false });
  if (error) console.error('getReadinessHistory error:', error);
  return data || [];
}

export async function getVolumeStandards(daysPerWeek) {
  const days = [3, 4, 5, 6].includes(daysPerWeek) ? daysPerWeek : 3;
  const { data, error } = await supabase
    .from('muscle_volume_standards')
    .select('muscle_group, mev_low, mev_high, mav_low, mav_high, mrv_low, mrv_high')
    .eq('days_per_week', days)
    .eq('scope', 'per_session');
  if (error) {
    console.error('getVolumeStandards error:', error);
    return {};
  }
  return Object.fromEntries((data || []).map(row => [
    row.muscle_group,
    { mev_low: row.mev_low, mev_high: row.mev_high, mav_low: row.mav_low, mav_high: row.mav_high, mrv_low: row.mrv_low, mrv_high: row.mrv_high }
  ]));
}

// ─── Custom Exercises ────────────────────────────────────────

export async function getCustomExercises() {
  const session = await getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from('custom_exercises')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });
  if (error) { console.error('getCustomExercises error:', error); return []; }
  return data || [];
}

export async function createCustomExercise(data) {
  const session = await getSession();
  if (!session) throw new Error('Not authenticated');
  const { data: result, error } = await supabase
    .from('custom_exercises')
    .insert({ ...data, user_id: session.user.id })
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function updateCustomExercise(id, data) {
  const session = await getSession();
  if (!session) throw new Error('Not authenticated');
  const { data: result, error } = await supabase
    .from('custom_exercises')
    .update(data)
    .eq('id', id)
    .eq('user_id', session.user.id)
    .select()
    .single();
  if (error) throw error;
  return result;
}

export async function deleteCustomExercise(id) {
  const session = await getSession();
  if (!session) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('custom_exercises')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id);
  if (error) throw error;
}

export async function logLoginEvent(userId, platform = 'web', appVersion = null) {
  try {
    const { error } = await supabase.rpc('log_login_event', {
      p_user_id: userId, p_platform: platform, p_app_version: appVersion,
    });
    if (error) console.error('[analytics] logLoginEvent error:', error);
  } catch (e) { console.error('[analytics] logLoginEvent exception:', e); }
}

export async function logPageEvent(userId, screenName, previousScreen = null, platform = 'web', appVersion = null) {
  try {
    const { error } = await supabase.from('user_page_events').insert({
      user_id: userId, screen_name: screenName, previous_screen: previousScreen,
      platform, app_version: appVersion,
    });
    if (error) console.error('[analytics] logPageEvent error:', error);
  } catch (e) { console.error('[analytics] logPageEvent exception:', e); }
}

// ─── Nutrition helpers ──────────────────────────────────────

export async function getNutritionGoals() {
  const session = await getSession();
  if (!session?.user) return null;
  const { data, error } = await supabase
    .from('nutrition_goals')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (error) console.error('getNutritionGoals error:', error);
  return data;
}

export async function upsertNutritionGoals(goals) {
  const session = await getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('nutrition_goals')
    .upsert({ ...goals, user_id: session.user.id }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getFoodLogs(date) {
  const session = await getSession();
  if (!session?.user) return [];
  const { data, error } = await supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('log_date', date)
    .order('created_at', { ascending: true });
  if (error) console.error('getFoodLogs error:', error);
  return data || [];
}

export async function addFoodLog(entry) {
  const session = await getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('food_logs')
    .insert({ ...entry, user_id: session.user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFoodLog(id, updates) {
  const session = await getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('food_logs')
    .update(updates)
    .eq('id', id)
    .eq('user_id', session.user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFoodLog(id) {
  const session = await getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('food_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id);
  if (error) throw error;
}

export async function getFoodFavorites() {
  const session = await getSession();
  if (!session?.user) return [];
  const { data, error } = await supabase
    .from('food_favorites')
    .select('*')
    .eq('user_id', session.user.id)
    .order('use_count', { ascending: false });
  if (error) console.error('getFoodFavorites error:', error);
  return data || [];
}

export async function addFoodFavorite(food) {
  const session = await getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('food_favorites')
    .upsert({
      user_id: session.user.id,
      food_name: food.food_name,
      brand: food.brand || '',
      barcode: food.barcode,
      serving_size: food.serving_size,
      serving_unit: food.serving_unit || 'g',
      calories: food.calories,
      protein_g: food.protein_g,
      carbs_g: food.carbs_g,
      fat_g: food.fat_g,
      fiber_g: food.fiber_g || 0,
      sugar_g: food.sugar_g || 0,
      sodium_mg: food.sodium_mg || 0,
      off_product_id: food.off_product_id,
      use_count: (food.use_count || 0) + 1,
    }, { onConflict: 'user_id,food_name,brand' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeFoodFavorite(id) {
  const session = await getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('food_favorites')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id);
  if (error) throw error;
}

export async function getRecentFoods(limit = 20) {
  const session = await getSession();
  if (!session?.user) return [];
  const { data, error } = await supabase
    .from('food_logs')
    .select('food_name, brand, barcode, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, off_product_id')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) { console.error('getRecentFoods error:', error); return []; }
  // Deduplicate by food_name+brand
  const seen = new Set();
  const unique = [];
  for (const f of (data || [])) {
    const key = `${f.food_name}|${f.brand || ''}`;
    if (!seen.has(key)) { seen.add(key); unique.push(f); }
    if (unique.length >= limit) break;
  }
  return unique;
}

export async function addWaterLog(date, amount_ml) {
  const session = await getSession();
  if (!session?.user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('water_logs')
    .insert({ user_id: session.user.id, log_date: date, amount_ml })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getWaterTotal(date) {
  const session = await getSession();
  if (!session?.user) return 0;
  const { data, error } = await supabase
    .from('water_logs')
    .select('amount_ml')
    .eq('user_id', session.user.id)
    .eq('log_date', date);
  if (error) { console.error('getWaterTotal error:', error); return 0; }
  return (data || []).reduce((sum, w) => sum + w.amount_ml, 0);
}

export async function getDailyNutritionSummary(date) {
  const session = await getSession();
  if (!session?.user) return null;
  const { data, error } = await supabase.rpc('get_daily_nutrition', {
    p_user_id: session.user.id,
    p_date: date,
  });
  if (error) { console.error('getDailyNutritionSummary error:', error); return null; }
  return data;
}

export async function getNutritionTrend(days = 7) {
  const session = await getSession();
  if (!session?.user) return [];
  const { data, error } = await supabase.rpc('get_nutrition_trend', {
    p_user_id: session.user.id,
    p_days: days,
  });
  if (error) { console.error('getNutritionTrend error:', error); return []; }
  return data || [];
}

export async function searchFoodsAPI(query) {
  if (!query || query.length < 2) return [];
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=20&fields=product_name,product_name_en,brands,code,nutriments,serving_quantity,serving_quantity_unit,image_front_small_url,image_url,nutriscore_grade`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  return json.products || [];
}

export async function lookupBarcode(barcode) {
  const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  if (json.status !== 1) return null;
  return json.product || null;
}
