import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAuth, mockQueryBuilder, mockClient } = vi.hoisted(() => {
  const mockQueryBuilder = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    single: vi.fn(),
  };

  const mockAuth = {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
  };

  const mockClient = {
    auth: mockAuth,
    from: vi.fn(),
  };

  return { mockAuth, mockQueryBuilder, mockClient };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient),
}));

import { getCustomExercises, createCustomExercise, updateCustomExercise, deleteCustomExercise, setSessionCache } from '../supabase';

function setupChainableMock() {
  mockQueryBuilder.select.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.insert.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.update.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.delete.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.order.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.single.mockResolvedValue({ data: null, error: null });
  mockClient.from.mockReturnValue(mockQueryBuilder);
}

const mockSession = {
  data: { session: { user: { id: 'user-1' }, access_token: 'tok' } },
};

describe('Custom Exercise helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChainableMock();
    // Set up session cache with proper format for getSession() to return
    setSessionCache({ user: { id: 'user-1' }, access_token: 'tok' });
  });

  describe('getCustomExercises', () => {
    it('returns empty array when there is no session', async () => {
      setSessionCache(null);
      const result = await getCustomExercises();
      expect(result).toEqual([]);
    });

    it('returns empty array on query error', async () => {
      mockQueryBuilder.order.mockResolvedValue({ data: null, error: { message: 'DB error' } });
      const result = await getCustomExercises();
      expect(result).toEqual([]);
    });

    it('returns data when query succeeds', async () => {
      const exercises = [{ id: '1', name: 'My Exercise', muscle_group: 'Chest' }];
      mockQueryBuilder.order.mockResolvedValue({ data: exercises, error: null });
      const result = await getCustomExercises();
      expect(result).toEqual(exercises);
    });

    it('filters by user_id', async () => {
      mockQueryBuilder.order.mockResolvedValue({ data: [], error: null });
      await getCustomExercises();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });
  });

  describe('createCustomExercise', () => {
    it('throws when not authenticated', async () => {
      setSessionCache(null);
      await expect(createCustomExercise({ name: 'Test' })).rejects.toThrow('Not authenticated');
    });

    it('inserts with correct payload including user_id', async () => {
      const payload = { name: 'Test Ex', muscle_group: 'Chest', equipment: 'Barbell', difficulty: 'Beginner' };
      mockQueryBuilder.single.mockResolvedValue({ data: { id: 'new-1', ...payload, user_id: 'user-1' }, error: null });
      const result = await createCustomExercise(payload);
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ ...payload, user_id: 'user-1' }));
      expect(result).toMatchObject({ id: 'new-1' });
    });

    it('throws on insert error', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });
      await expect(createCustomExercise({ name: 'Test' })).rejects.toMatchObject({ message: 'Insert failed' });
    });
  });

  describe('updateCustomExercise', () => {
    it('scopes update to user_id', async () => {
      const updates = { name: 'Updated', muscle_group: 'Back' };
      mockQueryBuilder.single.mockResolvedValue({ data: { id: 'ex-1', ...updates }, error: null });
      await updateCustomExercise('ex-1', updates);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'ex-1');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('throws on update error', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: null, error: { message: 'Update failed' } });
      await expect(updateCustomExercise('ex-1', {})).rejects.toMatchObject({ message: 'Update failed' });
    });
  });

  describe('deleteCustomExercise', () => {
    it('throws on delete error', async () => {
      mockQueryBuilder.eq.mockReturnValueOnce(mockQueryBuilder);
      mockQueryBuilder.eq.mockResolvedValueOnce({ error: { message: 'Delete failed' } });
      // Reset and set up specific chain for delete
      mockQueryBuilder.delete.mockReturnValue(mockQueryBuilder);
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
      // Last eq in chain resolves with error
      const errorEq = vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } });
      mockQueryBuilder.eq
        .mockReturnValueOnce(mockQueryBuilder) // first eq (id)
        .mockReturnValueOnce({ then: (fn) => fn({ error: { message: 'Delete failed' } }), catch: vi.fn() }); // second eq (user_id)
      // Simpler: just make the whole chain return an error
      mockQueryBuilder.eq.mockReset();
      mockQueryBuilder.eq.mockReturnValue(mockQueryBuilder);
      // Override the last call to return error
      const chainEnd = { error: { message: 'Delete failed' } };
      let eqCallCount = 0;
      mockQueryBuilder.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount >= 2) return Promise.resolve(chainEnd);
        return mockQueryBuilder;
      });
      await expect(deleteCustomExercise('ex-1')).rejects.toMatchObject({ message: 'Delete failed' });
    });

    it('scopes delete to user_id and id', async () => {
      let eqCallCount = 0;
      mockQueryBuilder.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount >= 2) return Promise.resolve({ error: null });
        return mockQueryBuilder;
      });
      await deleteCustomExercise('ex-1');
      expect(mockClient.from).toHaveBeenCalledWith('custom_exercises');
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
    });
  });
});
