// Shared mock factory for Supabase client
// Used by tests that need to mock the supabase module

export function createMockSupabaseClient() {
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn(),
  };

  // Make queryBuilder thenable so await works
  queryBuilder.then = function(resolve) {
    return resolve({ data: [], error: null });
  };

  const auth = {
    signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user-id' }, access_token: 'test-token' } }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user-id', email: 'test@example.com' }, access_token: 'test-token' } } }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id', email: 'test@example.com' } } }),
    signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  };

  const client = {
    auth,
    from: vi.fn().mockReturnValue(queryBuilder),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return { client, auth, queryBuilder };
}

export const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    user_metadata: { full_name: 'Test User' },
  },
  access_token: 'test-access-token',
};

export const mockProfile = {
  id: 'test-user-id',
  name: 'Test User',
  full_name: 'Test User',
  plan: 'free',
  ai_queries_used: 0,
  onboarding_complete: true,
  created_at: '2025-01-01T00:00:00Z',
};

export const mockWorkouts = [
  {
    id: 'w1',
    user_id: 'test-user-id',
    title: 'Push Day',
    started_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    finished_at: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString(),
    duration_secs: 3600,
    total_volume_kg: 14100,
    notes: 'Great session',
  },
  {
    id: 'w2',
    user_id: 'test-user-id',
    title: 'Pull Day',
    started_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    finished_at: new Date(Date.now() - 1000 * 60 * 60 * 47).toISOString(),
    duration_secs: 3480,
    total_volume_kg: 10880,
    notes: 'Good pump',
  },
];

export const mockPRs = [
  { exercise_name: 'Bench Press', weight_kg: 120, reps: 8, estimated_1rm: 150 },
  { exercise_name: 'Back Squat', weight_kg: 180, reps: 6, estimated_1rm: 210 },
  { exercise_name: 'Deadlift', weight_kg: 200, reps: 5, estimated_1rm: 225 },
];

export const mockVolumeTrend = [
  { w: 'W1', v: 42000 },
  { w: 'W2', v: 48000 },
  { w: 'W3', v: 44000 },
  { w: 'W4', v: 51000 },
];

export const mockTemplates = [
  {
    id: 't1',
    name: 'Push',
    sort_order: 0,
    color: '#DFFF3C',
    icon: '💪',
    template_exercises: [
      { name: 'Bench Press', equipment: 'Barbell', default_sets: 4, default_reps: 8, default_weight: 100, sort_order: 0 },
      { name: 'Overhead Press', equipment: 'Barbell', default_sets: 3, default_reps: 8, default_weight: 60, sort_order: 1 },
    ],
  },
  {
    id: 't2',
    name: 'Pull',
    sort_order: 1,
    color: '#3CFFF0',
    icon: '🔄',
    template_exercises: [
      { name: 'Deadlift', equipment: 'Barbell', default_sets: 4, default_reps: 5, default_weight: 140, sort_order: 0 },
      { name: 'Barbell Row', equipment: 'Barbell', default_sets: 3, default_reps: 8, default_weight: 80, sort_order: 1 },
    ],
  },
];
