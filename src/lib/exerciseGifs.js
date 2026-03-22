// ============================================================
// Exercise GIF Service — fetches animated demos from ExerciseDB
// via RapidAPI. Results are cached in localStorage so each
// exercise is only fetched once per device.
//
// Setup:
//   1. Sign up at rapidapi.com (free)
//   2. Subscribe to "ExerciseDB" (free tier — 10 req/day)
//   3. Add VITE_RAPIDAPI_KEY=your_key to .env.local
// ============================================================

const API_KEY  = import.meta.env.VITE_RAPIDAPI_KEY;
const API_HOST = 'exercisedb.p.rapidapi.com';
const CACHE_KEY = 'gymtracker_exercise_gifs_v1';

// Some exercises need a tweaked search term to match ExerciseDB naming
const NAME_MAP = {
  'bench press':      'barbell bench press',
  'back squat':       'barbell squat',
  'romanian dl':      'romanian deadlift',
  'barbell row':      'bent over barbell row',
  'overhead press':   'barbell overhead press',
  'hammer curl':      'hammer curl (with cable)',
  'tricep pushdown':  'cable pushdown',
  'skull crusher':    'ez barbell skull crusher',
  'lat pulldown':     'cable lat pulldown',
  'cable row':        'seated cable row',
  'leg curl':         'lying leg curls',
  'leg extension':    'leg extension',
  'walking lunge':    'dumbbell walking lunge',
  'machine press':    'chest press machine',
  'chest dip':        'chest dip',
  'pull-ups':         'pull-up',
  't-bar row':        't bar row',
  'arnold press':     'arnold press',
  'face pull':        'cable face pull',
  'lateral raise':    'cable lateral raise',
  'hip thrust':       'barbell hip thrust',
  'bulgarian split squat': 'dumbbell bulgarian split squat',
  'calf raise':       'standing calf raise',
  'cable curl':       'cable curl',
  'overhead tricep ext': 'dumbbell one arm overhead extension',
  'incline db press': 'dumbbell incline bench press',
  'cable fly':        'cable crossover',
  'push-ups':         'push-up',
  'plank':            'plank',
  'hanging leg raise':'hanging leg hip raise',
  'ab wheel rollout': 'ab wheel roller',
  'cable crunch':     'cable crunch',
};

function getCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
  catch { return {}; }
}

function setCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }
  catch { /* storage full — ignore */ }
}

/**
 * Returns an animated GIF URL for the given exercise name.
 * Returns null if no API key is configured or the fetch fails.
 */
export async function getExerciseGif(exerciseName) {
  if (!API_KEY || API_KEY === 'your_rapidapi_key_here') return null;

  const key = exerciseName.toLowerCase().trim();
  const searchTerm = NAME_MAP[key] || key;

  // Return cached result immediately
  const cache = getCache();
  if (key in cache) return cache[key] || null;

  try {
    const res = await fetch(
      `https://${API_HOST}/exercises/name/${encodeURIComponent(searchTerm)}?limit=1&offset=0`,
      {
        headers: {
          'X-RapidAPI-Key':  API_KEY,
          'X-RapidAPI-Host': API_HOST,
        },
      }
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const gifUrl = data?.[0]?.gifUrl || null;

    // Cache the result (null stored as empty string to avoid re-fetching)
    setCache({ ...getCache(), [key]: gifUrl ?? '' });
    return gifUrl;
  } catch (e) {
    console.warn(`ExerciseDB: could not fetch GIF for "${exerciseName}"`, e.message);
    setCache({ ...getCache(), [key]: '' });
    return null;
  }
}

/** Clears the GIF cache (useful for debugging) */
export function clearGifCache() {
  localStorage.removeItem(CACHE_KEY);
}
