import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAuth, mockQueryBuilder, mockClient } = vi.hoisted(() => {
  const mockQueryBuilder = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
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
  signUp, signIn, signOut, getSession, getUser, signInWithGoogle,
  getProfile, updateProfile, getTemplates, getWorkouts, getPersonalRecords,
  getWeeklyStats, getVolumeTrend, checkAIQuota, callCoachAPI, seedDummyData,
} from '../supabase';

// Helper to reset the chainable mock
function setupChainableMock() {
  // Each method returns the builder so chaining works
  mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.insert.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.update.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.order.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.limit.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.single.mockResolvedValue({ data: null, error: null });
  mockClient.from.mockReturnValue(mockQueryBuilder);
}

describe('supabase.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChainableMock();
    mockAuth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1', email: 'test@test.com' }, access_token: 'tok-123' } },
    });
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
  });

  describe('Auth helpers', () => {
    it('signUp calls supabase.auth.signUp with correct params', async () => {
      mockAuth.signUp.mockResolvedValue({ data: { user: { id: '1' } }, error: null });
      const result = await signUp('a@b.com', 'pass123', 'John');
      expect(mockAuth.signUp).toHaveBeenCalledWith({
        email: 'a@b.com',
        password: 'pass123',
        options: { data: { full_name: 'John' } },
      });
      expect(result.error).toBeNull();
    });

    it('signUp returns error on failure', async () => {
      mockAuth.signUp.mockResolvedValue({ data: null, error: { message: 'Email already exists' } });
      const result = await signUp('existing@test.com', 'pass', 'Name');
      expect(result.error.message).toBe('Email already exists');
    });

    it('signIn calls signInWithPassword', async () => {
      mockAuth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
      const result = await signIn('a@b.com', 'pass');
      expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pass' });
      expect(result.error).toBeNull();
    });

    it('signIn returns error for bad credentials', async () => {
      mockAuth.signInWithPassword.mockResolvedValue({ data: null, error: { message: 'Invalid login credentials' } });
      const result = await signIn('a@b.com', 'wrong');
      expect(result.error.message).toBe('Invalid login credentials');
    });

    it('signOut calls supabase.auth.signOut', async () => {
      mockAuth.signOut.mockResolvedValue({ error: null });
      const result = await signOut();
      expect(mockAuth.signOut).toHaveBeenCalled();
      expect(result.error).toBeNull();
    });

    it('getSession returns session', async () => {
      const session = await getSession();
      expect(session).toEqual({ user: { id: 'user-1', email: 'test@test.com' }, access_token: 'tok-123' });
    });

    it('getSession returns null when no session', async () => {
      mockAuth.getSession.mockResolvedValueOnce({ data: { session: null } });
      const session = await getSession();
      expect(session).toBeNull();
    });

    it('getUser returns user', async () => {
      const user = await getUser();
      expect(user).toEqual({ id: 'user-1' });
    });

    it('signInWithGoogle calls signInWithOAuth', async () => {
      mockAuth.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
      const result = await signInWithGoogle();
      expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: expect.any(String) },
      });
      expect(result.error).toBeNull();
    });
  });

  describe('Data helpers', () => {
    it('getProfile returns null when no session', async () => {
      mockAuth.getSession.mockResolvedValueOnce({ data: { session: null } });
      const result = await getProfile();
      expect(result).toBeNull();
    });

    it('getProfile queries profiles table for current user', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({ data: { id: 'user-1', name: 'Test', plan: 'pro' }, error: null });
      const result = await getProfile();
      expect(mockClient.from).toHaveBeenCalledWith('profiles');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'user-1');
      expect(result).toEqual({ id: 'user-1', name: 'Test', plan: 'pro' });
    });

    it('updateProfile returns null when no session', async () => {
      mockAuth.getSession.mockResolvedValueOnce({ data: { session: null } });
      const result = await updateProfile({ name: 'New' });
      expect(result).toBeNull();
    });

    it('updateProfile updates the profile', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({ data: { id: 'user-1', name: 'Updated' }, error: null });
      await updateProfile({ name: 'Updated' });
      expect(mockClient.from).toHaveBeenCalledWith('profiles');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ name: 'Updated' });
    });

    it('getWorkouts returns data ordered by date', async () => {
      // The full chain: from('workouts').select('*').order(...).limit(5)
      // limit is the terminal call that gets awaited
      mockQueryBuilder.limit.mockResolvedValueOnce({ data: [{ id: 'w1', title: 'Push' }], error: null });
      const result = await getWorkouts(5);
      expect(mockClient.from).toHaveBeenCalledWith('workouts');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('started_at', { ascending: false });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(5);
      expect(result).toEqual([{ id: 'w1', title: 'Push' }]);
    });

    it('getWorkouts defaults to limit 10', async () => {
      mockQueryBuilder.limit.mockResolvedValueOnce({ data: [], error: null });
      await getWorkouts();
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
    });

    it('getWorkouts returns empty array on error', async () => {
      mockQueryBuilder.limit.mockResolvedValueOnce({ data: null, error: { message: 'RLS violation' } });
      const result = await getWorkouts();
      expect(result).toEqual([]);
    });

    it('getPersonalRecords queries and orders by 1RM', async () => {
      mockQueryBuilder.order.mockResolvedValueOnce({ data: [{ exercise_name: 'Bench', estimated_1rm: 150 }], error: null });
      await getPersonalRecords();
      expect(mockClient.from).toHaveBeenCalledWith('personal_records');
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('estimated_1rm', { ascending: false });
    });

    it('getWeeklyStats returns null without session', async () => {
      mockAuth.getSession.mockResolvedValueOnce({ data: { session: null } });
      const result = await getWeeklyStats();
      expect(result).toBeNull();
    });

    it('getWeeklyStats calls RPC', async () => {
      mockClient.rpc.mockResolvedValueOnce({ data: { workouts: 3 } });
      await getWeeklyStats();
      expect(mockClient.rpc).toHaveBeenCalledWith('get_weekly_stats', { p_user_id: 'user-1' });
    });

    it('getVolumeTrend calls RPC', async () => {
      mockClient.rpc.mockResolvedValueOnce({ data: [{ w: 'W1', v: 42000 }] });
      await getVolumeTrend();
      expect(mockClient.rpc).toHaveBeenCalledWith('get_volume_trend', { p_user_id: 'user-1' });
    });

    it('checkAIQuota calls RPC', async () => {
      mockClient.rpc.mockResolvedValueOnce({ data: { allowed: true, remaining: 4 } });
      await checkAIQuota();
      expect(mockClient.rpc).toHaveBeenCalledWith('check_ai_quota', { p_user_id: 'user-1' });
    });

    it('getTemplates returns data directly when available', async () => {
      const templates = [{ id: 't1', name: 'Push', template_exercises: [] }];
      mockQueryBuilder.order.mockResolvedValueOnce({ data: templates });
      const result = await getTemplates();
      expect(result).toEqual(templates);
      expect(mockClient.rpc).not.toHaveBeenCalled();
    });

    it('getTemplates retries with RPC seed when empty', async () => {
      mockQueryBuilder.order
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [{ id: 't1', name: 'Push', template_exercises: [] }] });
      mockClient.rpc.mockResolvedValueOnce({ data: null });

      const result = await getTemplates();
      expect(mockClient.rpc).toHaveBeenCalledWith('seed_default_templates', { p_user_id: 'user-1' });
      expect(result).toEqual([{ id: 't1', name: 'Push', template_exercises: [] }]);
    });
  });

  describe('callCoachAPI', () => {
    it('throws when not authenticated', async () => {
      mockAuth.getSession.mockResolvedValueOnce({ data: { session: null } });
      await expect(callCoachAPI('test', 'test')).rejects.toThrow('Not authenticated');
    });

    it('sends POST request to coach edge function', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ text: 'Great!', cost_usd: 0.001 }),
      });

      const result = await callCoachAPI('Rate my workout', 'Rate', 'conv-1');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/functions/v1/coach'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer tok-123' }),
          body: JSON.stringify({ prompt: 'Rate my workout', label: 'Rate', conversationId: 'conv-1' }),
        })
      );
      expect(result).toEqual({ text: 'Great!', cost_usd: 0.001 });
    });

    it('throws error on non-ok response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Quota exceeded' }),
      });
      await expect(callCoachAPI('test', 'test')).rejects.toThrow('Quota exceeded');
    });

    it('throws generic error when no error field', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      });
      await expect(callCoachAPI('test', 'test')).rejects.toThrow('Coach API failed');
    });
  });

  describe('seedDummyData', () => {
    it('does nothing when no session', async () => {
      mockAuth.getSession.mockResolvedValueOnce({ data: { session: null } });
      await seedDummyData();
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it('skips seeding when user already has workouts', async () => {
      mockQueryBuilder.limit.mockResolvedValueOnce({ data: [{ id: 'existing' }], error: null });
      await seedDummyData();
      expect(mockClient.from).toHaveBeenCalledWith('workouts');
      expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
    });
  });
});
