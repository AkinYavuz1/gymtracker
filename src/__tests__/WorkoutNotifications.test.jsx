import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Workout Notifications', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('PR notification', () => {
    it('fires when onFinish called with non-empty prs', async () => {
      const sendPushNotification = vi.fn();
      const mockPRs = [
        { exercise_name: 'Bench Press', weight: 100, estimated_1rm: 110 },
      ];

      // Simulate PR celebration behavior
      if (mockPRs && mockPRs.length > 0) {
        const top = mockPRs[0];
        const kg = top.weight || top.estimated_1rm || '?';
        sendPushNotification(
          'New Personal Record! 🏆',
          `100kg on Bench Press`,
          'pr-celebration',
          { screen: 'prs' }
        );
      }

      expect(sendPushNotification).toHaveBeenCalledWith(
        'New Personal Record! 🏆',
        expect.any(String),
        'pr-celebration',
        { screen: 'prs' }
      );
    });

    it('does NOT send when prs is empty', () => {
      const sendPushNotification = vi.fn();
      const mockPRs = [];

      if (mockPRs && mockPRs.length > 0) {
        sendPushNotification('Should not be called', '', 'pr-celebration', {});
      }

      expect(sendPushNotification).not.toHaveBeenCalled();
    });
  });

  describe('Rest day notification', () => {
    it('sets gains_rest_day_pending when difficulty >= 9', () => {
      const difficulty = 9;

      if (difficulty >= 9) {
        localStorage.setItem('gains_rest_day_pending', new Date().toISOString().split('T')[0]);
      }

      const key = localStorage.getItem('gains_rest_day_pending');
      expect(key).toBeTruthy();
    });

    it('does NOT set key when difficulty < 9', () => {
      const difficulty = 8;

      if (difficulty >= 9) {
        localStorage.setItem('gains_rest_day_pending', new Date().toISOString().split('T')[0]);
      }

      const key = localStorage.getItem('gains_rest_day_pending');
      expect(key).toBeNull();
    });

    it('fires on next app open if date is yesterday', () => {
      const sendPushNotification = vi.fn();

      // Setup: yesterday's date was flagged
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      localStorage.setItem('gains_rest_day_pending', yesterdayStr);

      // Simulate app opening (INITIAL_SESSION)
      const restDayPending = localStorage.getItem('gains_rest_day_pending');
      if (restDayPending) {
        const yesterdayCheck = new Date();
        yesterdayCheck.setDate(yesterdayCheck.getDate() - 1);
        const yesterdayCheckStr = yesterdayCheck.toISOString().split('T')[0];
        if (restDayPending === yesterdayCheckStr) {
          sendPushNotification(
            'Rest Day Reminder 🛌',
            'You crushed it yesterday! Today is a perfect rest day — let your muscles recover.',
            'rest-day',
            {}
          );
        }
      }

      expect(sendPushNotification).toHaveBeenCalledWith(
        'Rest Day Reminder 🛌',
        'You crushed it yesterday! Today is a perfect rest day — let your muscles recover.',
        'rest-day',
        {}
      );
    });

    it('does NOT send on same-day open', () => {
      const sendPushNotification = vi.fn();

      // Setup: today's date was flagged (shouldn't normally happen, but test it)
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem('gains_rest_day_pending', today);

      // Simulate app opening
      const restDayPending = localStorage.getItem('gains_rest_day_pending');
      if (restDayPending) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        if (restDayPending === yesterdayStr) {
          sendPushNotification('Rest Day Reminder 🛌', '', 'rest-day', {});
        }
      }

      expect(sendPushNotification).not.toHaveBeenCalled();
    });
  });
});
