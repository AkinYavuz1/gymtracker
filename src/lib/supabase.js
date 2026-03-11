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
