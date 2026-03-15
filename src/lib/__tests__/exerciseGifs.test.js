import { describe, it, expect, vi, beforeEach } from 'vitest';

const CACHE_KEY = 'gymtracker_exercise_gifs_v1';

// We need to control import.meta.env.VITE_RAPIDAPI_KEY
// Mock the module by testing behavior with/without API key

describe('exerciseGifs', () => {
  let getExerciseGif, clearGifCache;

  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  describe('with no API key', () => {
    beforeEach(async () => {
      import.meta.env.VITE_RAPIDAPI_KEY = '';
      const mod = await import('../exerciseGifs.js');
      getExerciseGif = mod.getExerciseGif;
      clearGifCache = mod.clearGifCache;
    });

    it('returns null when no API key configured', async () => {
      const result = await getExerciseGif('Bench Press');
      expect(result).toBeNull();
    });
  });

  describe('with placeholder API key', () => {
    beforeEach(async () => {
      import.meta.env.VITE_RAPIDAPI_KEY = 'your_rapidapi_key_here';
      const mod = await import('../exerciseGifs.js');
      getExerciseGif = mod.getExerciseGif;
    });

    it('returns null for placeholder key', async () => {
      const result = await getExerciseGif('Deadlift');
      expect(result).toBeNull();
    });
  });

  describe('with valid API key', () => {
    beforeEach(async () => {
      import.meta.env.VITE_RAPIDAPI_KEY = 'real-api-key-123';
      const mod = await import('../exerciseGifs.js');
      getExerciseGif = mod.getExerciseGif;
      clearGifCache = mod.clearGifCache;
    });

    it('returns cached result without fetching', async () => {
      const cache = { 'bench press': 'https://example.com/bench.gif' };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));

      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const result = await getExerciseGif('Bench Press');

      expect(result).toBe('https://example.com/bench.gif');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns null for cached empty string (previously failed lookup)', async () => {
      const cache = { 'unknown exercise': '' };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));

      const result = await getExerciseGif('Unknown Exercise');
      expect(result).toBeNull();
    });

    it('fetches from ExerciseDB API and caches result', async () => {
      const gifUrl = 'https://exercisedb.io/image/bench.gif';
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ gifUrl }]),
      });

      const result = await getExerciseGif('Bench Press');

      expect(result).toBe(gifUrl);
      expect(globalThis.fetch).toHaveBeenCalledOnce();
      // Verify URL uses mapped name
      const callUrl = globalThis.fetch.mock.calls[0][0];
      expect(callUrl).toContain('barbell%20bench%20press');

      // Check cache was set
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY));
      expect(cache['bench press']).toBe(gifUrl);
    });

    it('maps exercise names to ExerciseDB terms', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ gifUrl: 'test.gif' }]),
      });

      await getExerciseGif('Back Squat');
      const callUrl = globalThis.fetch.mock.calls[0][0];
      expect(callUrl).toContain('barbell%20squat');
    });

    it('returns null and caches empty string on API failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 429,
      });

      const result = await getExerciseGif('Deadlift');
      expect(result).toBeNull();

      const cache = JSON.parse(localStorage.getItem(CACHE_KEY));
      expect(cache['deadlift']).toBe('');
    });

    it('returns null and caches empty string on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      const result = await getExerciseGif('Pull-ups');
      expect(result).toBeNull();

      const cache = JSON.parse(localStorage.getItem(CACHE_KEY));
      expect(cache['pull-ups']).toBe('');
    });

    it('handles empty API response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await getExerciseGif('Some Exercise');
      expect(result).toBeNull();
    });

    it('sends correct headers', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await getExerciseGif('Deadlift');
      const headers = globalThis.fetch.mock.calls[0][1].headers;
      expect(headers['X-RapidAPI-Key']).toBe('real-api-key-123');
      expect(headers['X-RapidAPI-Host']).toBe('exercisedb.p.rapidapi.com');
    });
  });

  describe('clearGifCache', () => {
    beforeEach(async () => {
      import.meta.env.VITE_RAPIDAPI_KEY = 'key';
      const mod = await import('../exerciseGifs.js');
      clearGifCache = mod.clearGifCache;
    });

    it('removes the cache from localStorage', () => {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ test: 'data' }));
      clearGifCache();
      expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    });
  });
});
