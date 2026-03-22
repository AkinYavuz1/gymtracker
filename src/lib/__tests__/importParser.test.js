import { describe, it, expect } from 'vitest';
import { detectFormat, splitCSVLine, parseHevyRow, parseStrongRow, parseFitbodRow, parseCSV } from '../importParser';

// ─── FIXTURES ────────────────────────────────────────────────────────────────

const HEVY_SAMPLE = `Date,Workout Name,Exercise Name,Set Order,Weight,Reps,RPE,Notes,Duration,Distance
2024-01-15 09:30,Push Day,Bench Press,1,100,8,7,,3600,
2024-01-15 09:30,Push Day,Bench Press,2,100,6,8,,3600,
2024-01-15 09:30,Push Day,Overhead Press,1,60,10,6,,3600,
2024-01-20 10:00,Pull Day,Deadlift,1,180,5,8,,4200,
2024-01-20 10:00,Pull Day,Deadlift,2,180,4,9,,4200,`;

const STRONG_SAMPLE = `Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Notes,Warmup
2024-01-15 09:30:00,Push Day,3600,Bench Press,1,100,8,,false
2024-01-15 09:30:00,Push Day,3600,Bench Press,2,100,6,,false
2024-01-15 09:30:00,Push Day,3600,Overhead Press,1,60,10,,false
2024-01-15 09:30:00,Push Day,3600,Bench Press,0,60,5,,true
2024-01-20 10:00:00,Pull Day,4200,Deadlift,1,180,5,,false`;

const HEVY_LBS_SAMPLE = `Date,Workout Name,Exercise Name,Set Order,Weight,Reps,RPE,Notes,Duration,Distance
2024-01-15 09:30,Push Day,Bench Press,1,225,5,8,,3600,`;

// ─── detectFormat ─────────────────────────────────────────────────────────────

describe('detectFormat', () => {
  it('detects Hevy when third column is Exercise Name', () => {
    expect(detectFormat(HEVY_SAMPLE)).toBe('hevy');
  });

  it('detects Strong when third column is Duration', () => {
    expect(detectFormat(STRONG_SAMPLE)).toBe('strong');
  });

  it('returns null for unknown format', () => {
    const csv = `Col1,Col2,SomethingElse\nval,val,val`;
    expect(detectFormat(csv)).toBeNull();
  });

  it('is case-insensitive on header matching', () => {
    const csv = `DATE,WORKOUT NAME,EXERCISE NAME,SET ORDER,WEIGHT,REPS,RPE,NOTES,DURATION,DISTANCE\n2024-01-01 10:00,X,Squat,1,100,5,,,3600,`;
    expect(detectFormat(csv)).toBe('hevy');
  });

  it('returns null when fewer than 3 columns', () => {
    const csv = `Col1,Col2\nval,val`;
    expect(detectFormat(csv)).toBeNull();
  });
});

// ─── splitCSVLine ─────────────────────────────────────────────────────────────

describe('splitCSVLine', () => {
  it('splits a simple comma-separated line', () => {
    expect(splitCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields containing commas', () => {
    expect(splitCSVLine('"field, with comma",b,c')).toEqual(['field, with comma', 'b', 'c']);
  });

  it('handles empty fields', () => {
    expect(splitCSVLine('a,,c')).toEqual(['a', '', 'c']);
  });

  it('handles quoted fields with escaped double-quotes', () => {
    expect(splitCSVLine('"say ""hello""",b')).toEqual(['say "hello"', 'b']);
  });

  it('trims whitespace from unquoted fields', () => {
    expect(splitCSVLine(' a , b , c ')).toEqual(['a', 'b', 'c']);
  });
});

// ─── parseHevyRow ────────────────────────────────────────────────────────────

describe('parseHevyRow', () => {
  const headers = ['date', 'workout name', 'exercise name', 'set order', 'weight', 'reps', 'rpe', 'notes', 'duration', 'distance'];

  it('parses a valid row', () => {
    const fields = ['2024-01-15 09:30', 'Push Day', 'Bench Press', '1', '100', '8', '7', '', '3600', ''];
    const row = parseHevyRow(headers, fields, 'kg');
    expect(row).not.toBeNull();
    expect(row.workoutName).toBe('Push Day');
    expect(row.exerciseName).toBe('Bench Press');
    expect(row.setOrder).toBe(1);
    expect(row.weightKg).toBe(100);
    expect(row.reps).toBe(8);
    expect(row.rpe).toBe(7);
    expect(row.duration).toBe(3600);
    expect(row.isWarmup).toBe(false);
  });

  it('returns null when date is invalid', () => {
    const fields = ['not-a-date', 'Push Day', 'Bench Press', '1', '100', '8', '', '', '3600', ''];
    expect(parseHevyRow(headers, fields, 'kg')).toBeNull();
  });

  it('returns null when exercise name is empty', () => {
    const fields = ['2024-01-15 09:30', 'Push Day', '', '1', '100', '8', '', '', '3600', ''];
    expect(parseHevyRow(headers, fields, 'kg')).toBeNull();
  });

  it('handles empty weight as 0', () => {
    const fields = ['2024-01-15 09:30', 'Push Day', 'Pull-up', '1', '', '8', '', '', '3600', ''];
    const row = parseHevyRow(headers, fields, 'kg');
    expect(row.weightKg).toBe(0);
  });

  it('handles empty RPE as null', () => {
    const fields = ['2024-01-15 09:30', 'Push Day', 'Bench Press', '1', '100', '8', '', '', '3600', ''];
    const row = parseHevyRow(headers, fields, 'kg');
    expect(row.rpe).toBeNull();
  });
});

// ─── parseStrongRow ──────────────────────────────────────────────────────────

describe('parseStrongRow', () => {
  const headers = ['date', 'workout name', 'duration', 'exercise name', 'set order', 'weight', 'reps', 'notes', 'warmup'];

  it('parses a valid row', () => {
    const fields = ['2024-01-15 09:30:00', 'Push Day', '3600', 'Bench Press', '1', '100', '8', '', 'false'];
    const row = parseStrongRow(headers, fields, 'kg');
    expect(row).not.toBeNull();
    expect(row.exerciseName).toBe('Bench Press');
    expect(row.weightKg).toBe(100);
    expect(row.reps).toBe(8);
    expect(row.isWarmup).toBe(false);
    expect(row.rpe).toBeNull();
  });

  it('sets isWarmup true when warmup column is "true"', () => {
    const fields = ['2024-01-15 09:30:00', 'Push Day', '3600', 'Bench Press', '0', '60', '5', '', 'true'];
    const row = parseStrongRow(headers, fields, 'kg');
    expect(row.isWarmup).toBe(true);
  });

  it('returns null when date is invalid', () => {
    const fields = ['bad-date', 'Push Day', '3600', 'Bench Press', '1', '100', '8', '', 'false'];
    expect(parseStrongRow(headers, fields, 'kg')).toBeNull();
  });
});

// ─── parseCSV — Hevy ─────────────────────────────────────────────────────────

describe('parseCSV — Hevy', () => {
  it('detects format as hevy', () => {
    const result = parseCSV(HEVY_SAMPLE, 'kg');
    expect(result.format).toBe('hevy');
  });

  it('groups rows into workouts by date + name', () => {
    const result = parseCSV(HEVY_SAMPLE, 'kg');
    expect(result.workouts).toHaveLength(2); // Push Day + Pull Day
  });

  it('puts all sets for a session in the same workout', () => {
    const result = parseCSV(HEVY_SAMPLE, 'kg');
    const pushDay = result.workouts.find(w => w.title === 'Push Day');
    expect(pushDay.sets).toHaveLength(3); // 2 bench + 1 OHP
  });

  it('computes totalVolumeKg correctly', () => {
    const result = parseCSV(HEVY_SAMPLE, 'kg');
    const pushDay = result.workouts.find(w => w.title === 'Push Day');
    // (100*8) + (100*6) + (60*10) = 800 + 600 + 600 = 2000
    expect(pushDay.totalVolumeKg).toBe(2000);
  });

  it('converts lbs to kg when weightUnit is lbs', () => {
    const result = parseCSV(HEVY_LBS_SAMPLE, 'lbs');
    const w = result.workouts[0];
    const set = w.sets[0];
    // 225 lbs * 0.453592 = 102.1 kg (rounded to 1dp)
    expect(set.weightKg).toBeCloseTo(102.1, 0);
  });

  it('sets durationSecs from Duration column', () => {
    const result = parseCSV(HEVY_SAMPLE, 'kg');
    const pushDay = result.workouts.find(w => w.title === 'Push Day');
    expect(pushDay.durationSecs).toBe(3600);
  });

  it('sets finishedAt based on startedAt + durationSecs', () => {
    const result = parseCSV(HEVY_SAMPLE, 'kg');
    const pushDay = result.workouts.find(w => w.title === 'Push Day');
    expect(pushDay.finishedAt).not.toBeNull();
    const start = new Date(pushDay.startedAt).getTime();
    const end = new Date(pushDay.finishedAt).getTime();
    expect((end - start) / 1000).toBe(3600);
  });

  it('sorts workouts oldest-first', () => {
    const result = parseCSV(HEVY_SAMPLE, 'kg');
    expect(result.workouts[0].startedAt < result.workouts[1].startedAt).toBe(true);
  });

  it('returns zero skippedRows for a clean CSV', () => {
    const result = parseCSV(HEVY_SAMPLE, 'kg');
    expect(result.skippedRows).toBe(0);
  });
});

// ─── parseCSV — Strong ────────────────────────────────────────────────────────

describe('parseCSV — Strong', () => {
  it('detects format as strong', () => {
    expect(parseCSV(STRONG_SAMPLE, 'kg').format).toBe('strong');
  });

  it('excludes warmup sets from workout sets', () => {
    const result = parseCSV(STRONG_SAMPLE, 'kg');
    const pushDay = result.workouts.find(w => w.title === 'Push Day');
    // 2 bench + 1 OHP (warmup excluded)
    expect(pushDay.sets).toHaveLength(3);
  });

  it('excludes warmup sets from volume calculation', () => {
    const result = parseCSV(STRONG_SAMPLE, 'kg');
    const pushDay = result.workouts.find(w => w.title === 'Push Day');
    // (100*8) + (100*6) + (60*10) = 2000 — warmup (60*5=300) excluded
    expect(pushDay.totalVolumeKg).toBe(2000);
  });

  it('parses duration from Duration column', () => {
    const result = parseCSV(STRONG_SAMPLE, 'kg');
    const pushDay = result.workouts.find(w => w.title === 'Push Day');
    expect(pushDay.durationSecs).toBe(3600);
  });
});

// ─── parseCSV — edge cases ────────────────────────────────────────────────────

describe('parseCSV — edge cases', () => {
  it('returns null format and empty workouts for unknown CSV', () => {
    const result = parseCSV('Col1,Col2,Unknown\nval,val,val', 'kg');
    expect(result.format).toBeNull();
    expect(result.workouts).toHaveLength(0);
  });

  it('strips BOM character from start of file', () => {
    const withBom = '\uFEFF' + HEVY_SAMPLE;
    const result = parseCSV(withBom, 'kg');
    expect(result.format).toBe('hevy');
    expect(result.workouts.length).toBeGreaterThan(0);
  });

  it('increments skippedRows for malformed rows (bad date)', () => {
    const csv = `Date,Workout Name,Exercise Name,Set Order,Weight,Reps,RPE,Notes,Duration,Distance
2024-01-15 09:30,Push Day,Bench Press,1,100,8,7,,3600,
BAD-DATE,Push Day,Squat,1,100,5,,,3600,`;
    const result = parseCSV(csv, 'kg');
    expect(result.skippedRows).toBe(1);
    expect(result.workouts).toHaveLength(1);
  });

  it('handles an empty CSV (header only)', () => {
    const csv = `Date,Workout Name,Exercise Name,Set Order,Weight,Reps,RPE,Notes,Duration,Distance`;
    const result = parseCSV(csv, 'kg');
    expect(result.workouts).toHaveLength(0);
    expect(result.skippedRows).toBe(0);
  });

  it('total rows equals skipped + sets across all workouts', () => {
    const result = parseCSV(HEVY_SAMPLE, 'kg');
    const totalSets = result.workouts.reduce((s, w) => s + w.sets.length, 0);
    expect(result.totalRows).toBe(totalSets + result.skippedRows);
  });
});

// ─── Fitbod fixtures ──────────────────────────────────────────────────────────

const FITBOD_SAMPLE = `Date,Exercise,Reps,Weight(kg),Duration(s),Distance(m),Incline,Resistance,isWarmup,Note,multiplier
2021-12-27 10:02:51 +0000,Dumbbell Bench Press,10,25.0,0,0,0,0,false,,1.0
2021-12-27 10:08:00 +0000,Dumbbell Bench Press,8,27.5,0,0,0,0,false,,1.0
2021-12-27 10:14:00 +0000,Overhead Press,12,20.0,0,0,0,0,true,warmup set,1.0
2021-12-27 10:20:00 +0000,Overhead Press,10,40.0,0,0,0,0,false,,1.0
2022-01-03 09:00:00 +0000,Deadlift,5,100.0,0,0,0,0,false,,1.0`;

// ─── parseFitbodRow ───────────────────────────────────────────────────────────

describe('parseFitbodRow', () => {
  const headers = ['date', 'exercise', 'reps', 'weight(kg)', 'duration(s)', 'distance(m)', 'incline', 'resistance', 'iswarmup', 'note', 'multiplier'];

  it('parses a valid working set row', () => {
    const fields = ['2021-12-27 10:02:51 +0000', 'Dumbbell Bench Press', '10', '25.0', '0', '0', '0', '0', 'false', '', '1.0'];
    const row = parseFitbodRow(headers, fields);
    expect(row).not.toBeNull();
    expect(row.exerciseName).toBe('Dumbbell Bench Press');
    expect(row.weightKg).toBe(25.0);
    expect(row.reps).toBe(10);
    expect(row.isWarmup).toBe(false);
    expect(row.rpe).toBeNull();
    expect(row.workoutName).toBe('Fitbod Workout');
  });

  it('sets isWarmup true when isWarmup column is "true"', () => {
    const fields = ['2021-12-27 10:14:00 +0000', 'Overhead Press', '12', '20.0', '0', '0', '0', '0', 'true', 'warmup set', '1.0'];
    const row = parseFitbodRow(headers, fields);
    expect(row.isWarmup).toBe(true);
  });

  it('returns null for invalid date', () => {
    const fields = ['not-a-date', 'Bench Press', '10', '25.0', '0', '0', '0', '0', 'false', '', '1.0'];
    expect(parseFitbodRow(headers, fields)).toBeNull();
  });

  it('returns null for missing exercise name', () => {
    const fields = ['2021-12-27 10:02:51 +0000', '', '10', '25.0', '0', '0', '0', '0', 'false', '', '1.0'];
    expect(parseFitbodRow(headers, fields)).toBeNull();
  });

  it('handles 0 weight (bodyweight exercise)', () => {
    const fields = ['2021-12-27 10:02:51 +0000', 'Pull-up', '10', '0', '0', '0', '0', '0', 'false', '', '1.0'];
    const row = parseFitbodRow(headers, fields);
    expect(row.weightKg).toBe(0);
  });

  it('correctly applies timezone offset (+0500)', () => {
    const fields = ['2021-12-27 15:02:51 +0500', 'Bench Press', '5', '100.0', '0', '0', '0', '0', 'false', '', '1.0'];
    const row = parseFitbodRow(headers, fields);
    // 15:02:51 +0500 = 10:02:51 UTC
    expect(row.date).toBe('2021-12-27T10:02:51.000Z');
  });
});

// ─── parseCSV — Fitbod ────────────────────────────────────────────────────────

describe('parseCSV — Fitbod', () => {
  it('detects format as fitbod', () => {
    expect(parseCSV(FITBOD_SAMPLE, 'kg').format).toBe('fitbod');
  });

  it('groups rows into workouts by day', () => {
    const result = parseCSV(FITBOD_SAMPLE, 'kg');
    // 2021-12-27 and 2022-01-03 = 2 workouts
    expect(result.workouts).toHaveLength(2);
  });

  it('titles all workouts as "Fitbod Workout"', () => {
    const result = parseCSV(FITBOD_SAMPLE, 'kg');
    expect(result.workouts.every(w => w.title === 'Fitbod Workout')).toBe(true);
  });

  it('excludes warmup sets', () => {
    const result = parseCSV(FITBOD_SAMPLE, 'kg');
    const dec27 = result.workouts[0];
    // Dumbbell Bench Press x2 + Overhead Press x1 working (1 warmup excluded)
    expect(dec27.sets).toHaveLength(3);
  });

  it('assigns sequential set numbers per exercise', () => {
    const result = parseCSV(FITBOD_SAMPLE, 'kg');
    const dec27 = result.workouts[0];
    const benchSets = dec27.sets.filter(s => s.exerciseName === 'Dumbbell Bench Press');
    expect(benchSets[0].setNumber).toBe(1);
    expect(benchSets[1].setNumber).toBe(2);
  });

  it('uses weight as kg regardless of weightUnit param', () => {
    const resultKg = parseCSV(FITBOD_SAMPLE, 'kg');
    const resultLbs = parseCSV(FITBOD_SAMPLE, 'lbs');
    // Both should give same weight — Fitbod is always kg
    expect(resultKg.workouts[0].sets[0].weightKg).toBe(resultLbs.workouts[0].sets[0].weightKg);
  });

  it('computes totalVolumeKg excluding warmups', () => {
    const result = parseCSV(FITBOD_SAMPLE, 'kg');
    const dec27 = result.workouts[0];
    // (25*10) + (27.5*8) + (40*10) = 250 + 220 + 400 = 870
    expect(dec27.totalVolumeKg).toBe(870);
  });
});
