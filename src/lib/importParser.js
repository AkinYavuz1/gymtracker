/**
 * importParser.js
 * Parse Hevy, Strong, and Fitbod CSV exports into normalized workout data.
 */

// ─── CSV HELPERS ─────────────────────────────────────────────────────────────

/** Split one CSV line respecting RFC 4180 quoted fields. */
export function splitCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ("")
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Parse all lines of a CSV, returning header array and data row arrays. */
function parseLines(csvText) {
  // Strip BOM if present
  const text = csvText.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = splitCSVLine(lines[0]).map(h => h.toLowerCase().trim());
  const rows = lines.slice(1).map(l => splitCSVLine(l));
  return { headers, rows };
}

// ─── FORMAT DETECTION ────────────────────────────────────────────────────────

/**
 * Detect CSV source app from header row.
 * Hevy:   3rd col is "exercise name"
 * Strong: 3rd col is "duration"
 * Fitbod: 2nd col is "exercise" (no workout name col)
 * @param {string} csvText
 * @returns {'hevy' | 'strong' | 'fitbod' | null}
 */
export function detectFormat(csvText) {
  const { headers } = parseLines(csvText);
  if (headers.length < 2) return null;
  if (headers[1] === 'exercise') return 'fitbod';
  if (headers.length < 3) return null;
  const third = headers[2].toLowerCase();
  if (third === 'exercise name') return 'hevy';
  if (third === 'duration') return 'strong';
  return null;
}

// ─── DATE PARSING ────────────────────────────────────────────────────────────

/**
 * Parse "YYYY-MM-DD HH:MM" or "YYYY-MM-DD HH:MM:SS" as local time → ISO string.
 * Using explicit construction avoids engine-specific UTC/local ambiguity.
 */
function parseLocalDate(str) {
  if (!str) return null;
  const s = str.trim();
  // Match: 2024-01-15 09:30 or 2024-01-15 09:30:00
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [, yr, mo, dy, hr, min, sec = '0'] = m;
  const d = new Date(+yr, +mo - 1, +dy, +hr, +min, +sec);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Parse Fitbod date: "YYYY-MM-DD HH:MM:SS ±HHMM" → ISO string.
 * The timezone offset is explicit so we parse it as UTC-adjusted.
 */
function parseFitbodDate(str) {
  if (!str) return null;
  const s = str.trim();
  // Match: 2021-12-27 10:02:51 +0000 or -0500
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/);
  if (!m) return null;
  const [, yr, mo, dy, hr, min, sec, sign, offH, offM] = m;
  const offsetMins = (sign === '+' ? 1 : -1) * (+offH * 60 + +offM);
  const utcMs = Date.UTC(+yr, +mo - 1, +dy, +hr, +min, +sec) - offsetMins * 60000;
  const d = new Date(utcMs);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ─── WEIGHT CONVERSION ───────────────────────────────────────────────────────

const toKg = (val, unit) => {
  const n = parseFloat(val) || 0;
  return unit === 'lbs' ? Math.round(n * 0.453592 * 10) / 10 : Math.round(n * 10) / 10;
};

// ─── HEVY ROW PARSING ────────────────────────────────────────────────────────

/**
 * @param {string[]} headers - lowercased
 * @param {string[]} fields
 * @param {'kg'|'lbs'} weightUnit
 * @returns {object|null}
 */
export function parseHevyRow(headers, fields, weightUnit = 'kg') {
  const get = (name) => {
    const i = headers.indexOf(name);
    return i >= 0 ? (fields[i] || '').trim() : '';
  };

  const date = parseLocalDate(get('date'));
  if (!date) return null;

  const workoutName = get('workout name') || 'Imported Workout';
  const exerciseName = get('exercise name');
  if (!exerciseName) return null;

  const setOrder = parseInt(get('set order')) || 1;
  const weightKg = toKg(get('weight'), weightUnit);
  const reps = parseInt(get('reps')) || 0;
  const rpe = get('rpe') ? (parseInt(get('rpe')) || null) : null;
  const duration = parseInt(get('duration')) || 0;

  return { date, workoutName, exerciseName, setOrder, weightKg, reps, rpe, duration, isWarmup: false };
}

// ─── STRONG ROW PARSING ──────────────────────────────────────────────────────

/**
 * @param {string[]} headers - lowercased
 * @param {string[]} fields
 * @param {'kg'|'lbs'} weightUnit
 * @returns {object|null}
 */
export function parseStrongRow(headers, fields, weightUnit = 'kg') {
  const get = (name) => {
    const i = headers.indexOf(name);
    return i >= 0 ? (fields[i] || '').trim() : '';
  };

  const date = parseLocalDate(get('date'));
  if (!date) return null;

  const workoutName = get('workout name') || 'Imported Workout';
  const exerciseName = get('exercise name');
  if (!exerciseName) return null;

  const setOrder = parseInt(get('set order')) || 1;
  const weightKg = toKg(get('weight'), weightUnit);
  const reps = parseInt(get('reps')) || 0;
  const duration = parseInt(get('duration')) || 0;
  const isWarmup = get('warmup').toLowerCase() === 'true';

  return { date, workoutName, exerciseName, setOrder, weightKg, reps, rpe: null, duration, isWarmup };
}

// ─── FITBOD ROW PARSING ──────────────────────────────────────────────────────

/**
 * Fitbod headers: Date,Exercise,Reps,Weight(kg),Duration(s),Distance(m),
 *                 Incline,Resistance,isWarmup,Note,multiplier
 * Weight is always kg — weightUnit param is ignored.
 * No workout name column — caller assigns title from date.
 * @param {string[]} headers - lowercased
 * @param {string[]} fields
 * @returns {object|null}
 */
export function parseFitbodRow(headers, fields) {
  const get = (name) => {
    const i = headers.indexOf(name);
    return i >= 0 ? (fields[i] || '').trim() : '';
  };

  const date = parseFitbodDate(get('date'));
  if (!date) return null;

  const exerciseName = get('exercise');
  if (!exerciseName) return null;

  const reps = parseInt(get('reps')) || 0;
  // Header is "weight(kg)" — already in kg
  const weightKg = Math.round((parseFloat(get('weight(kg)')) || 0) * 10) / 10;
  const duration = parseInt(get('duration(s)')) || 0;
  const isWarmup = get('iswarmup').toLowerCase() === 'true';

  return {
    date,
    workoutName: 'Fitbod Workout',
    exerciseName,
    setOrder: 1, // Fitbod has no set order — grouping reconstructs sequence
    weightKg,
    reps,
    rpe: null,
    duration,
    isWarmup,
  };
}

// ─── GROUPING ────────────────────────────────────────────────────────────────

/**
 * Group raw rows into WorkoutGroup objects.
 * Key = workout name + day (YYYY-MM-DD). Multiple sessions on the same day
 * with the same name are merged (edge case but safe).
 */
function groupIntoWorkouts(rawRows) {
  const map = new Map();

  for (const row of rawRows) {
    const day = row.date.slice(0, 10); // YYYY-MM-DD
    const key = `${row.workoutName}::${day}`;

    if (!map.has(key)) {
      map.set(key, {
        title: row.workoutName,
        startedAt: row.date,
        durationSecs: row.duration,
        sets: [],
      });
    }

    const group = map.get(key);

    // Keep earliest timestamp as startedAt
    if (row.date < group.startedAt) group.startedAt = row.date;
    // Keep largest duration seen (first row for Hevy, any row for Strong)
    if (row.duration > group.durationSecs) group.durationSecs = row.duration;

    if (!row.isWarmup) {
      group.sets.push({
        exerciseName: row.exerciseName,
        setNumber: row.setOrder, // may be 1 for all Fitbod rows — renumbered below
        weightKg: row.weightKg,
        reps: row.reps,
        rpe: row.rpe,
        completed: true,
      });
    }
  }

  // Renumber sets per exercise within each workout (fixes Fitbod's missing set order)
  for (const group of map.values()) {
    const counters = {};
    for (const s of group.sets) {
      counters[s.exerciseName] = (counters[s.exerciseName] || 0) + 1;
      s.setNumber = counters[s.exerciseName];
    }
  }

  // Sort oldest-first so PRs are built chronologically during import
  const workouts = Array.from(map.values()).sort((a, b) =>
    a.startedAt.localeCompare(b.startedAt)
  );

  // Compute derived fields
  for (const w of workouts) {
    w.finishedAt = w.durationSecs
      ? new Date(new Date(w.startedAt).getTime() + w.durationSecs * 1000).toISOString()
      : null;
    w.totalVolumeKg = w.sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);
    w.totalVolumeKg = Math.round(w.totalVolumeKg * 10) / 10;
  }

  return workouts;
}

// ─── PUBLIC API ──────────────────────────────────────────────────────────────

/**
 * Parse a Hevy, Strong, or Fitbod CSV export.
 * @param {string} csvText - raw file contents
 * @param {'kg'|'lbs'} weightUnit - used for Hevy/Strong; Fitbod is always kg
 * @returns {{ format: string, workouts: object[], skippedRows: number, totalRows: number }}
 */
export function parseCSV(csvText, weightUnit = 'kg') {
  const { headers, rows } = parseLines(csvText);
  const format = detectFormat(csvText);

  if (!format) {
    return { format: null, workouts: [], skippedRows: rows.length, totalRows: rows.length };
  }

  const rawRows = [];
  let skippedRows = 0;

  for (const fields of rows) {
    let row;
    if (format === 'hevy') row = parseHevyRow(headers, fields, weightUnit);
    else if (format === 'strong') row = parseStrongRow(headers, fields, weightUnit);
    else row = parseFitbodRow(headers, fields);

    if (row) {
      rawRows.push(row);
    } else {
      skippedRows++;
    }
  }

  const workouts = groupIntoWorkouts(rawRows);

  return { format, workouts, skippedRows, totalRows: rows.length };
}
