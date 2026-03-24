import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendPushNotification, setNotificationActionHandler } from '../notifications';
import { getSession } from '../supabase';

vi.mock('../supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
  getSession: vi.fn(),
}));

describe('notifications.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendPushNotification', () => {
    it('calls supabase.functions.invoke with correct args', async () => {
      const mockSession = { user: { id: 'test-user-123' }, access_token: 'test-token' };
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const { supabase } = await import('../supabase');

      await sendPushNotification('Test Title', 'Test Body', 'test-tag', { screen: 'home' });

      expect(supabase.functions.invoke).toHaveBeenCalledWith('send-notification', {
        body: {
          user_id: 'test-user-123',
          title: 'Test Title',
          body: 'Test Body',
          tag: 'test-tag',
          data: { screen: 'home' },
        },
        headers: { Authorization: 'Bearer test-token' },
      });
    });

    it('returns silently when session is null', async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const { supabase } = await import('../supabase');

      await sendPushNotification('Test Title', 'Test Body', 'test-tag');

      expect(supabase.functions.invoke).not.toHaveBeenCalled();
    });

    it('swallows errors and never throws', async () => {
      const mockSession = { user: { id: 'test-user' }, access_token: 'token' };
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const { supabase } = await import('../supabase');
      supabase.functions.invoke.mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(
        sendPushNotification('Title', 'Body', 'tag')
      ).resolves.toBeUndefined();
    });
  });

  describe('setNotificationActionHandler', () => {
    it('does not throw on non-native platforms', () => {
      // This test verifies the function gracefully handles non-native environments
      expect(() => {
        setNotificationActionHandler(() => {});
      }).not.toThrow();
    });
  });
});
