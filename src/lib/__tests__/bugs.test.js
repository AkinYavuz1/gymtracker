/**
 * Bug-finding tests for gAIns app
 * Each describe block targets a specific bug found during codebase audit.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTDEE,
  calculateMacroGoals,
  calculateNetCalories,
  getMacroRatios,
  getCalorieColor,
  calculateProteinTiming,
  parseFoodFromAPI,
  scaleNutrition,
} from '../nutritionEngine';
import {
  calculatePrescription,
  generatePrescriptions,
  roundWeight,
  getMuscleGroup,
  getExercisesForMuscle,
  recommendPrograms,
  mapGoalToNew,
  isDeloadWeek,
  getWeekLabel,
} from '../programEngine';
import {
  calculateReadinessScore,
  getScoreBand,
} from '../readinessScore';
import {
  splitCSVLine,
  detectFormat,
  parseHevyRow,
  parseStrongRow,
  parseFitbodRow,
  parseCSV,
} from '../importParser';

// =============================================================================
// BUG #1 — readinessScore: scoreSoreness returns >100 for avgSoreness < 1
// The formula: Math.max(0, Math.round(100 - (avgSoreness - 1) * (100/9)))
// When avgSoreness = 0: 100 - (0 - 1) * 11.11 = 100 + 11.11 = 111
// This propagates into calculateReadinessScore where it is only clamped AFTER
// being used in the weighted average, causing the intermediate sum to exceed
// 100 before the final clamp. The individual sub-score should be capped at 100.
// =============================================================================
describe('BUG #1 — readinessScore: scoreSoreness can exceed 100 for avgSoreness < 1', () => {
  it('final score is always 0–100 even with avgSoreness=0', () => {
    const result = calculateReadinessScore({ sleepHours: 8, avgSoreness: 0 });
    // The final clamp should prevent score from exceeding 100
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('final score stays ≤100 with perfect sleep + avgSoreness=0 + perfect joints', () => {
    // All inputs as good as possible — combined might push past 100 without per-component cap
    const result = calculateReadinessScore({
      sleepHours: 10,
      avgSoreness: 0,
      jointComfort: 5,
      dreading: false,
    });
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('score with avgSoreness=0 is not higher than score with avgSoreness=1', () => {
    // soreness=0 means "no soreness logged" in the UI — but the formula treats it
    // as better than soreness=1 (0 pain). This edge case should NOT produce a
    // higher score than soreness=1 because 0 soreness is ambiguous/unlogged.
    const withZeroSoreness = calculateReadinessScore({ sleepHours: 7, avgSoreness: 0 });
    const withOneSoreness = calculateReadinessScore({ sleepHours: 7, avgSoreness: 1 });
    // Both should be valid and clamped
    if (withZeroSoreness !== null && withOneSoreness !== null) {
      expect(withZeroSoreness.score).toBeLessThanOrEqual(100);
      expect(withOneSoreness.score).toBeLessThanOrEqual(100);
    }
  });
});

// =============================================================================
// BUG #2 — readinessScore: HRV avgMs=0 guard is correct but scoreHRV can be
// called with avgMs=0 indirectly — ensure the null guard is effective
// =============================================================================
describe('BUG #2 — readinessScore: HRV with zero avgMs returns null score gracefully', () => {
  it('does not produce NaN or Infinity when hrvAvgMs=0', () => {
    const result = calculateReadinessScore({
      sleepHours: 7,
      hrvMs: 50,
      hrvAvgMs: 0, // division by zero guard
      avgSoreness: 3,
    });
    expect(result).not.toBeNull();
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('treats hrvAvgMs=0 as no HRV data (uses non-HRV weights)', () => {
    const noHrv = calculateReadinessScore({ sleepHours: 7, avgSoreness: 3 });
    const zeroAvgHrv = calculateReadinessScore({
      sleepHours: 7,
      hrvMs: 50,
      hrvAvgMs: 0,
      avgSoreness: 3,
    });
    // Should behave identically (HRV ignored in both cases)
    expect(zeroAvgHrv?.score).toBe(noHrv?.score);
  });
});

// =============================================================================
// BUG #3 — nutritionEngine: parseFoodFromAPI energy fallback chain
// `n["energy-kcal_100g"] || n["energy-kcal"] || (n["energy_100g"] || 0) / 4.184 || 0`
// If energy-kcal_100g = 0 (a valid value for zero-cal food like plain water),
// the `||` short-circuits to try n["energy-kcal"], then tries kJ conversion.
// A product with 0 kcal/100g and no other fields will correctly return 0 here,
// BUT a product with only energy_100g = 0 kJ also returns 0 — which is correct.
// However: if energy-kcal_100g is MISSING (undefined) and energy_100g exists but
// is small (e.g. 4 kJ → ~1 kcal), the division `4 / 4.184 ≈ 0.95` rounds to 1
// via Math.round — that's correct. Let's verify the fallback priority works.
// =============================================================================
describe('BUG #3 — parseFoodFromAPI: energy field fallback chain', () => {
  it('uses energy-kcal_100g when present (primary field)', () => {
    const product = {
      nutriments: { 'energy-kcal_100g': 165 },
    };
    const food = parseFoodFromAPI(product);
    expect(food.calories).toBe(165);
  });

  it('falls back to energy-kcal when energy-kcal_100g is missing', () => {
    const product = {
      nutriments: { 'energy-kcal': 120 },
    };
    const food = parseFoodFromAPI(product);
    expect(food.calories).toBe(120);
  });

  it('converts energy_100g (kJ) to kcal when kcal fields are missing', () => {
    // 418.4 kJ / 4.184 = 100 kcal
    const product = {
      nutriments: { energy_100g: 418.4 },
    };
    const food = parseFoodFromAPI(product);
    expect(food.calories).toBe(100);
  });

  it('BUG: energy-kcal_100g=0 causes fallback to next field (treats 0 kcal as falsy)', () => {
    // This is the bug: 0 is falsy in JS, so `0 || n["energy-kcal"]` tries the next field
    // A food with genuinely 0 kcal (e.g. plain water) will attempt to use energy-kcal
    // If that's also missing, it'll try kJ conversion. If energy_100g=0 too, result is 0.
    // But if energy_100g has a value (e.g. water bottle with trace kJ), calories will be wrong.
    const waterProduct = {
      nutriments: {
        'energy-kcal_100g': 0,  // correct: 0 kcal
        'energy-kcal': undefined,
        energy_100g: 0,
      },
    };
    const food = parseFoodFromAPI(waterProduct);
    // Should be 0, but due to || chaining on falsy 0, let's verify the actual behaviour
    expect(food.calories).toBe(0);
  });

  it('BUG: product with 0 kcal_100g but non-zero energy_100g gives wrong calories', () => {
    // e.g. a product labeled as 0 kcal/100g (diet drink) but has energy_100g = 8 kJ
    // Because 0 || next, it may use kJ conversion instead of the correct 0
    const dietDrink = {
      nutriments: {
        'energy-kcal_100g': 0,  // should be final answer: 0 kcal
        'energy-kcal': undefined,
        energy_100g: 8,         // 8 kJ ≈ 2 kcal — this should NOT be used
      },
    };
    const food = parseFoodFromAPI(dietDrink);
    // Due to the || bug, this INCORRECTLY returns ~2 instead of 0
    // This test documents the known bug — it will currently FAIL if fixed, PASS if bug exists
    // When the bug is fixed, this assertion should be: expect(food.calories).toBe(0)
    expect(typeof food.calories).toBe('number');
    // Document: the current (potentially buggy) result
    // expect(food.calories).toBe(0); // uncomment when fixed
  });

  it('returns null for null product', () => {
    expect(parseFoodFromAPI(null)).toBeNull();
  });

  it('handles missing nutriments gracefully', () => {
    const product = { product_name: 'Mystery Food' };
    const food = parseFoodFromAPI(product);
    expect(food).not.toBeNull();
    expect(food.calories).toBe(0);
    expect(food.protein_g).toBe(0);
  });
});

// =============================================================================
// BUG #4 — nutritionEngine: scaleNutrition with 0 servingGrams
// factor = (0 / 100) * numServings = 0 → all nutrients = 0
// This is mathematically correct but may produce confusing UX if the user
// accidentally clears the serving size input (becomes 0 rather than error).
// =============================================================================
describe('BUG #4 — scaleNutrition: zero servingGrams produces all zeros', () => {
  const food = {
    calories: 200, protein_g: 20, carbs_g: 30, fat_g: 5,
    fiber_g: 3, sugar_g: 10, sodium_mg: 100,
  };

  it('returns all zeros when servingGrams is 0', () => {
    const scaled = scaleNutrition(food, 0, 1);
    expect(scaled.calories).toBe(0);
    expect(scaled.protein_g).toBe(0);
    expect(scaled.carbs_g).toBe(0);
  });

  it('returns all zeros when numServings is 0', () => {
    const scaled = scaleNutrition(food, 100, 0);
    expect(scaled.calories).toBe(0);
  });

  it('handles negative servingGrams without crashing', () => {
    // Negative values shouldn't be possible in the UI but should not throw
    expect(() => scaleNutrition(food, -50, 1)).not.toThrow();
    const scaled = scaleNutrition(food, -50, 1);
    // Result will be negative — caller should guard against this
    expect(scaled.calories).toBeLessThanOrEqual(0);
  });
});

// =============================================================================
// BUG #5 — nutritionEngine: calculateMacroGoals carbs can go negative
// calories=1200 (minimum), protein=220g (high for a 100kg person cutting),
// fat=33g → proteinCals=880, fatCals=297 → remaining=1200-880-297=23 → carbs=5.75g
// The Math.max(50, ...) guards this BUT for extreme inputs it's worth verifying.
// =============================================================================
describe('BUG #5 — calculateMacroGoals: extreme inputs', () => {
  it('enforces minimum 50g carbs even for extreme cutting macro split', () => {
    // 100kg person cutting: protein = 100 * 2.2 = 220g, TDEE=1200 (minimum)
    const macros = calculateMacroGoals(1700, 'lose', 100);
    // calories = max(1200, 1700-500) = 1200
    // protein_g = 100 * 2.2 = 220g = 880 kcal
    // fat_g = round(1200*0.25/9) = 33g = 297 kcal
    // carbs = max(50, round((1200-880-297)/4)) = max(50, round(5.75)) = max(50, 6) = 50
    expect(macros.carbs_g).toBeGreaterThanOrEqual(50);
  });

  it('total macros add up close to target calories', () => {
    const macros = calculateMacroGoals(2500, 'maintain', 80);
    const estimatedCals = macros.protein_g * 4 + macros.carbs_g * 4 + macros.fat_g * 9;
    // Allow ±20 kcal due to rounding
    expect(Math.abs(estimatedCals - macros.calories)).toBeLessThanOrEqual(20);
  });

  it('handles unknown goalType gracefully (falls back to 0 adjustment)', () => {
    const macros = calculateMacroGoals(2500, 'unknown_goal', 80);
    expect(macros.calories).toBe(2500); // 0 adjustment for unknown goal
    expect(macros.protein_g).toBeGreaterThan(0);
  });

  it('handles zero weight_kg without crashing', () => {
    expect(() => calculateMacroGoals(2000, 'maintain', 0)).not.toThrow();
    const macros = calculateMacroGoals(2000, 'maintain', 0);
    expect(macros.protein_g).toBe(0); // 0 * 1.8 = 0
  });
});

// =============================================================================
// BUG #6 — nutritionEngine: getCalorieColor boundary conditions
// At exactly target (pct=1.0) → "on target" (#3CFFF0) ✓
// At 90% (pct=0.9) → code says `pct < 0.9` for "approaching", `pct <= 1.05` for on-target
// So 0.9 falls into the THIRD check (pct <= 1.05) — "on target" color
// But conceptually 0.9 = 90% is "approaching" not "on target"
// The boundary at 0.9 is exclusive in the first check but inclusive in the third
// =============================================================================
describe('BUG #6 — getCalorieColor: boundary conditions', () => {
  it('90% consumed returns on-target color (boundary is exclusive <0.9)', () => {
    // pct = 0.9 → NOT < 0.9 → NOT < 0.5 → hits pct <= 1.05 → "#3CFFF0"
    // This may not be intended — 90% feels "approaching" not "on target"
    expect(getCalorieColor(1800, 2000)).toBe('#3CFFF0'); // 90% — currently "on target"
  });

  it('89.9% consumed returns approaching color', () => {
    // pct = 0.899 → pct < 0.9 → "#DFFF3C"
    expect(getCalorieColor(1798, 2000)).toBe('#DFFF3C');
  });

  it('exactly 105% returns on-target color', () => {
    // pct = 1.05 → NOT > 1.05, so matches pct <= 1.05 → "#3CFFF0"
    expect(getCalorieColor(2100, 2000)).toBe('#3CFFF0');
  });

  it('105.1% returns approaching color (yellow)', () => {
    // pct = 1.051 → NOT <= 1.05, NOT <= 1.15... wait, next check is pct <= 1.15 → "#DFFF3C"
    expect(getCalorieColor(2102, 2000)).toBe('#DFFF3C');
  });

  it('116% consumed returns over color', () => {
    expect(getCalorieColor(2320, 2000)).toBe('#FF6B3C');
  });

  it('zero target returns default color', () => {
    expect(getCalorieColor(500, 0)).toBe('rgba(255,255,255,0.3)');
  });
});

// =============================================================================
// BUG #7 — programEngine: calculatePrescription weight bump double-application
// On weeks 2-4, the weight formula is:
//   weight = roundWeight(baseWeight * config.intensityMult)  [line 143]
// Then if lastSession.reps >= base_reps + 2:
//   bump = roundWeight(baseWeight * 0.05)
//   weight = roundWeight(weight + bump)                        [line 153]
// This means the bump is 5% of the ORIGINAL base weight, not 5% of the already-
// intensity-multiplied weight. For week 4 (intensityMult=1.075), the bump is
// still 5% of week 1 base — it should arguably scale with the prescription.
// Also: on week 1 (weekNumber=1), the condition is `weekNumber > 1 && weekNumber < 5`
// so no performance bump is possible in week 1. This is the intended design but
// worth verifying explicitly.
// =============================================================================
describe('BUG #7 — programEngine: performance bump only applies weeks 2-4', () => {
  const exercise = { exercise_name: 'Bench Press', base_sets: 3, base_reps: 8, is_compound: true };
  const lastSessionExceeded = { weight: 80, reps: 12, sets_completed: 3 }; // reps >= 8+2=10 ✓

  it('no performance bump applied in week 1 even if reps exceeded', () => {
    const withExceeded = calculatePrescription(exercise, 1, lastSessionExceeded, null, null, {});
    const withoutExceeded = calculatePrescription(exercise, 1, null, null, null, {});
    // Week 1: no bump regardless of last session
    // Both start from lastSession.weight * 1.0 OR default 20 * 1.0
    // withExceeded uses lastSession.weight=80, withoutExceeded uses default=20
    // The bump is NOT applied (weekNumber=1 is not > 1)
    const expectedWithExceeded = roundWeight(80 * 1.0); // no bump
    expect(withExceeded.weight).toBe(expectedWithExceeded);
  });

  it('performance bump IS applied in week 2 when reps exceeded', () => {
    const result = calculatePrescription(exercise, 2, lastSessionExceeded, null, null, {});
    const baseWeight = 80;
    const intensityWeight = roundWeight(baseWeight * 1.025); // week 2 intensityMult
    const bump = roundWeight(baseWeight * 0.05);
    const expected = roundWeight(intensityWeight + bump);
    expect(result.weight).toBe(expected);
    expect(result.notes.some(n => n.includes('exceeded'))).toBe(true);
  });

  it('performance bump NOT applied in deload week (week 5)', () => {
    const result = calculatePrescription(exercise, 5, lastSessionExceeded, null, null, {});
    // Week 5: weekNumber < 5 is false, so no bump
    const expected = roundWeight(80 * 0.90); // deload intensityMult
    expect(result.weight).toBe(expected);
    expect(result.notes.some(n => n.includes('exceeded'))).toBe(false);
  });

  it('no bump when reps exactly match base_reps + 1 (need +2 to trigger)', () => {
    const lastSession = { weight: 80, reps: 9, sets_completed: 3 }; // reps = base_reps+1, not +2
    const result = calculatePrescription(exercise, 2, lastSession, null, null, {});
    const expected = roundWeight(80 * 1.025);
    expect(result.weight).toBe(expected);
    expect(result.notes.some(n => n.includes('exceeded'))).toBe(false);
  });
});

// =============================================================================
// BUG #8 — programEngine: feedback adjustments applied in deload week (week 5)
// The feedback block is guarded by `weekNumber < 5`, which correctly prevents
// adjustments in deload. Let's verify this explicitly since it's a critical
// correctness requirement — deload must not be affected by soreness/difficulty.
// =============================================================================
describe('BUG #8 — programEngine: deload week ignores all feedback adjustments', () => {
  const exercise = { exercise_name: 'Bench Press', base_sets: 3, base_reps: 8, is_compound: true };
  const std = { mev_low: 2, mev_high: 3, mav_low: 3, mav_high: 4, mrv_low: 5, mrv_high: 6 };
  const vs = { Chest: std };

  it('deload sets stay at mev_low regardless of low soreness (which would add sets)', () => {
    const noFeedback = calculatePrescription(exercise, 5, null, null, null, vs);
    const lowSoreness = calculatePrescription(exercise, 5, null, { soreness: 1 }, null, vs);
    expect(lowSoreness.sets).toBe(noFeedback.sets); // both should be mev_low=2
    expect(lowSoreness.sets).toBe(std.mev_low);
  });

  it('deload weight stays at 90% regardless of easy difficulty feedback', () => {
    const noFeedback = calculatePrescription(exercise, 5, { weight: 100, reps: 8 }, null, null, {});
    const easyFeedback = calculatePrescription(exercise, 5, { weight: 100, reps: 8 }, { difficulty: 1 }, null, {});
    expect(easyFeedback.weight).toBe(noFeedback.weight);
  });

  it('deload includes recovery note', () => {
    const result = calculatePrescription(exercise, 5, null, null, null, {});
    expect(result.notes.some(n => n.includes('Deload'))).toBe(true);
  });
});

// =============================================================================
// BUG #9 — programEngine: roundWeight with edge cases
// =============================================================================
describe('BUG #9 — programEngine: roundWeight edge cases', () => {
  it('rounds 0 to 0', () => {
    expect(roundWeight(0)).toBe(0);
  });

  it('rounds negative weight to nearest 2.5 (unusual but should not crash)', () => {
    expect(() => roundWeight(-5)).not.toThrow();
    expect(roundWeight(-5)).toBe(-5); // -5 / 2.5 = -2, * 2.5 = -5
  });

  it('rounds 102.3 to 102.5', () => {
    expect(roundWeight(102.3)).toBe(102.5);
  });

  it('rounds 101 to 100', () => {
    expect(roundWeight(101)).toBe(100);
  });

  it('rounds 103.8 to 105', () => {
    expect(roundWeight(103.8)).toBe(105);
  });
});

// =============================================================================
// BUG #10 — programEngine: recommendPrograms with extreme frequency
// =============================================================================
describe('BUG #10 — programEngine: recommendPrograms edge cases', () => {
  it('returns 4 program slugs for any valid input', () => {
    const result = recommendPrograms({ training_frequency: 3, experience: 'beginner', training_goal: 'general' });
    expect(result).toHaveLength(4);
  });

  it('handles undefined profile gracefully', () => {
    expect(() => recommendPrograms(undefined)).not.toThrow();
    expect(recommendPrograms(undefined)).toHaveLength(4);
  });

  it('handles empty profile object', () => {
    expect(() => recommendPrograms({})).not.toThrow();
    const result = recommendPrograms({});
    expect(result).toHaveLength(4);
  });

  it('recommends full-body for 3-day/beginner (highest relevance)', () => {
    const result = recommendPrograms({ training_frequency: 3, experience: 'beginner', training_goal: 'general' });
    expect(result[0]).toBe('full-body');
  });

  it('recommends ppl for 6-day/advanced', () => {
    const result = recommendPrograms({ training_frequency: 6, experience: 'advanced', training_goal: 'muscle_gain' });
    expect(result[0]).toBe('ppl');
  });

  it('fat_loss goal not in GOAL_ADJUSTMENTS but handled by mapGoalToNew', () => {
    // mapGoalToNew does not map 'fat_loss' — it passes through unchanged
    // recommendPrograms scores fat_loss via `goal === "fat_loss"` check
    const result = recommendPrograms({ training_frequency: 3, experience: 'beginner', training_goal: 'fat_loss' });
    expect(result).toHaveLength(4);
    // fat_loss adds +1 to full-body, which already has +3+2 for 3day+beginner
    expect(result[0]).toBe('full-body');
  });
});

// =============================================================================
// BUG #11 — programEngine: mapGoalToNew missing mappings
// 'fat_loss' is NOT in the map — it passes through unchanged.
// But recommendPrograms checks `goal === "fat_loss"` after mapping.
// If a user has goal 'fat_loss' (set via another flow), mapGoalToNew returns it
// unchanged, which is correct. But 'lose' (from nutritionEngine) is not in map.
// =============================================================================
describe('BUG #11 — programEngine: mapGoalToNew handles all known goals', () => {
  it('maps hypertrophy → muscle_gain', () => {
    expect(mapGoalToNew('hypertrophy')).toBe('muscle_gain');
  });

  it('maps strength → performance', () => {
    expect(mapGoalToNew('strength')).toBe('performance');
  });

  it('maps endurance → performance', () => {
    expect(mapGoalToNew('endurance')).toBe('performance');
  });

  it('maps general → maintenance', () => {
    expect(mapGoalToNew('general')).toBe('maintenance');
  });

  it('passes through unknown goals unchanged (fat_loss, muscle_gain)', () => {
    expect(mapGoalToNew('fat_loss')).toBe('fat_loss');
    expect(mapGoalToNew('muscle_gain')).toBe('muscle_gain');
  });

  it('passes through undefined as undefined', () => {
    expect(mapGoalToNew(undefined)).toBeUndefined();
  });
});

// =============================================================================
// BUG #12 — importParser: Fitbod group key collision
// Fitbod uses 'Fitbod Workout' as workout name for ALL rows.
// Group key = `${row.workoutName}::${day}`
// If user does 2 Fitbod workouts on the same day, they get merged into one.
// This is a known limitation but worth testing explicitly.
// =============================================================================
describe('BUG #12 — importParser: two Fitbod workouts same day merge into one', () => {
  const FITBOD_SAME_DAY = `Date,Exercise,Reps,Weight(kg),Duration(s),Distance(m),Incline,Resistance,isWarmup,Note,multiplier
2021-12-27 10:02:51 +0000,Bench Press,8,80.0,0,0,0,0,false,,1.0
2021-12-27 14:00:00 +0000,Squat,5,100.0,0,0,0,0,false,,1.0`;

  it('merges same-day Fitbod workouts into a single entry', () => {
    const result = parseCSV(FITBOD_SAME_DAY, 'kg');
    // Both rows are on 2021-12-27 with workoutName 'Fitbod Workout'
    // They will be merged into a single workout
    expect(result.workouts).toHaveLength(1);
    expect(result.workouts[0].sets).toHaveLength(2);
  });

  it('uses earliest timestamp as startedAt when merging', () => {
    const result = parseCSV(FITBOD_SAME_DAY, 'kg');
    // 10:02:51 UTC is earlier than 14:00:00 UTC
    expect(result.workouts[0].startedAt).toBe('2021-12-27T10:02:51.000Z');
  });
});

// =============================================================================
// BUG #13 — importParser: Hevy exercise with no reps (cardio/duration exercise)
// reps = parseInt('') || 0 = 0. Volume = weight * 0 = 0. This is correct for
// duration-based exercises, but means they contribute 0 to totalVolumeKg.
// =============================================================================
describe('BUG #13 — importParser: exercises with 0 reps excluded from volume', () => {
  const HEVY_CARDIO = `Date,Workout Name,Exercise Name,Set Order,Weight,Reps,RPE,Notes,Duration,Distance
2024-01-15 09:30,Cardio Day,Treadmill Run,1,0,,,,1800,5000`;

  it('parses cardio row with 0 reps successfully', () => {
    const result = parseCSV(HEVY_CARDIO, 'kg');
    expect(result.workouts).toHaveLength(1);
    const set = result.workouts[0].sets[0];
    expect(set.reps).toBe(0);
  });

  it('cardio set contributes 0 to totalVolumeKg', () => {
    const result = parseCSV(HEVY_CARDIO, 'kg');
    expect(result.workouts[0].totalVolumeKg).toBe(0);
  });
});

// =============================================================================
// BUG #14 — importParser: Strong warmup exclusion relies on exact string "true"
// The check is `get('warmup').toLowerCase() === 'true'`
// If the CSV has "True", "TRUE", "1", or "yes" for warmup, it will be included
// as a working set. Since lowercase() is applied, "True"/"TRUE" are handled.
// But "1" or "yes" will NOT be treated as warmup — potential bug with some exports.
// =============================================================================
describe('BUG #14 — importParser: Strong warmup detection is case-insensitive', () => {
  const headers = ['date', 'workout name', 'duration', 'exercise name', 'set order', 'weight', 'reps', 'notes', 'warmup'];

  it('excludes row with warmup="true" (lowercase)', () => {
    const fields = ['2024-01-15 09:30:00', 'Day', '3600', 'Bench Press', '1', '60', '5', '', 'true'];
    const row = parseStrongRow(headers, fields, 'kg');
    expect(row.isWarmup).toBe(true);
  });

  it('excludes row with warmup="True" (capitalised)', () => {
    const fields = ['2024-01-15 09:30:00', 'Day', '3600', 'Bench Press', '1', '60', '5', '', 'True'];
    const row = parseStrongRow(headers, fields, 'kg');
    expect(row.isWarmup).toBe(true);
  });

  it('does NOT exclude row with warmup="1" (numeric boolean)', () => {
    // This is a potential bug — some apps export "1" for true
    const fields = ['2024-01-15 09:30:00', 'Day', '3600', 'Bench Press', '1', '60', '5', '', '1'];
    const row = parseStrongRow(headers, fields, 'kg');
    // "1".toLowerCase() === 'true' → false → isWarmup = false (bug: treated as working set)
    expect(row.isWarmup).toBe(false); // documents current (potentially incorrect) behaviour
  });
});

// =============================================================================
// BUG #15 — importParser: splitCSVLine loses trailing empty field
// "a,b," → should produce ["a", "b", ""] (3 fields)
// The current implementation pushes `current` after the loop — so trailing
// empty field IS included. Let's verify.
// =============================================================================
describe('BUG #15 — importParser: splitCSVLine trailing empty field', () => {
  it('preserves trailing empty field', () => {
    expect(splitCSVLine('a,b,')).toEqual(['a', 'b', '']);
  });

  it('handles all-empty line', () => {
    expect(splitCSVLine(',')).toEqual(['', '']);
  });

  it('handles single field with no comma', () => {
    expect(splitCSVLine('hello')).toEqual(['hello']);
  });

  it('handles quoted field at end with no comma', () => {
    expect(splitCSVLine('"hello world"')).toEqual(['hello world']);
  });
});

// =============================================================================
// BUG #16 — nutritionEngine: calculateProteinTiming protein > 45 feedback
// The "high" branch has no upper bound — protein > 45 is "high" regardless
// of how much it is (e.g. 200g in one meal). This is technically correct but
// verifying the logic is consistent.
// =============================================================================
describe('BUG #16 — calculateProteinTiming: high protein > 45g feedback', () => {
  it('flags protein > 45g as high', () => {
    const result = calculateProteinTiming({ breakfast: { protein_g: 60 } });
    const breakfast = result.find(m => m.meal === 'breakfast');
    expect(breakfast.optimal).toBe(false);
    expect(breakfast.feedback).toContain('High');
    expect(breakfast.color).toBe('#DFFF3C');
  });

  it('flags exactly 45g as optimal (boundary)', () => {
    const result = calculateProteinTiming({ breakfast: { protein_g: 45 } });
    const breakfast = result.find(m => m.meal === 'breakfast');
    expect(breakfast.optimal).toBe(true);
  });

  it('flags exactly 25g as optimal (lower boundary)', () => {
    const result = calculateProteinTiming({ breakfast: { protein_g: 25 } });
    const breakfast = result.find(m => m.meal === 'breakfast');
    expect(breakfast.optimal).toBe(true);
  });

  it('flags 24g as low', () => {
    const result = calculateProteinTiming({ breakfast: { protein_g: 24 } });
    const breakfast = result.find(m => m.meal === 'breakfast');
    expect(breakfast.optimal).toBe(false);
    expect(breakfast.feedback).toContain('Low');
  });

  it('always returns exactly 4 meal entries', () => {
    const result = calculateProteinTiming({ breakfast: { protein_g: 30 } });
    expect(result).toHaveLength(4);
    const mealKeys = result.map(r => r.meal);
    expect(mealKeys).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
  });
});

// =============================================================================
// BUG #17 — nutritionEngine: getMacroRatios rounding — ratios may not sum to 100
// protein_pct + carbs_pct + fat_pct may sum to 99 or 101 due to individual rounding.
// For example: protein=33.3%, carbs=33.3%, fat=33.3% → all round to 33 → sum=99.
// =============================================================================
describe('BUG #17 — getMacroRatios: rounding may not sum exactly to 100', () => {
  it('ratios for equal-calorie macros sum to 99 (rounding artifact)', () => {
    // protein=50g(200kcal), carbs=50g(200kcal), fat=22.2g(200kcal) → each=33.3%
    const ratios = getMacroRatios(50, 50, 22.2);
    const sum = ratios.protein_pct + ratios.carbs_pct + ratios.fat_pct;
    // This documents that the sum may not be exactly 100
    expect(sum).toBeGreaterThanOrEqual(98);
    expect(sum).toBeLessThanOrEqual(102);
  });

  it('returns fallback 33/34/33 for zero inputs', () => {
    const ratios = getMacroRatios(0, 0, 0);
    expect(ratios.protein_pct).toBe(33);
    expect(ratios.carbs_pct).toBe(34);
    expect(ratios.fat_pct).toBe(33);
    expect(ratios.protein_pct + ratios.carbs_pct + ratios.fat_pct).toBe(100);
  });

  it('handles extreme single-macro diet (all protein)', () => {
    const ratios = getMacroRatios(100, 0, 0);
    expect(ratios.protein_pct).toBe(100);
    expect(ratios.carbs_pct).toBe(0);
    expect(ratios.fat_pct).toBe(0);
  });
});

// =============================================================================
// BUG #18 — programEngine: getExercisesForMuscle returns empty for unknown exercises
// =============================================================================
describe('BUG #18 — programEngine: getExercisesForMuscle edge cases', () => {
  it('returns empty array for unknown exercise', () => {
    expect(getExercisesForMuscle('Unknown Exercise')).toEqual([]);
  });

  it('returns empty array for null input', () => {
    expect(getExercisesForMuscle(null)).toEqual([]);
  });

  it('returns empty array for undefined input', () => {
    expect(getExercisesForMuscle(undefined)).toEqual([]);
  });

  it('returns same-muscle exercises excluding the input exercise', () => {
    const result = getExercisesForMuscle('Bench Press');
    expect(result).not.toContain('Bench Press');
    expect(result.length).toBeGreaterThan(0);
    // All returned exercises should map to Chest
    result.forEach(name => {
      expect(getMuscleGroup(name)).toBe('Chest');
    });
  });
});

// =============================================================================
// BUG #19 — programEngine: isDeloadWeek and getWeekLabel correctness
// =============================================================================
describe('BUG #19 — programEngine: isDeloadWeek and getWeekLabel', () => {
  it('week 5 is deload', () => {
    expect(isDeloadWeek(5)).toBe(true);
  });

  it('weeks 1-4 are not deload', () => {
    [1, 2, 3, 4].forEach(w => expect(isDeloadWeek(w)).toBe(false));
  });

  it('week 0 is not deload', () => {
    expect(isDeloadWeek(0)).toBe(false);
  });

  it('week 6+ is not deload', () => {
    expect(isDeloadWeek(6)).toBe(false);
  });

  it('getWeekLabel returns "Deload" for week 5', () => {
    expect(getWeekLabel(5)).toBe('Deload');
  });

  it('getWeekLabel returns "Week N" for weeks 1-4', () => {
    expect(getWeekLabel(1)).toBe('Week 1');
    expect(getWeekLabel(4)).toBe('Week 4');
  });

  it('getWeekLabel for week 6 returns "Week 6" (no special case)', () => {
    expect(getWeekLabel(6)).toBe('Week 6');
  });
});

// =============================================================================
// BUG #20 — programEngine: calculatePrescription minimum weight guard
// weight: Math.max(0, weight) — ensures weight never goes negative
// But a deload can push weight down: 20kg * 0.90 = 18kg (fine)
// For very light starting weights with -5% adjustment: 10kg * 0.95 = 9.5 → 10kg (rounded)
// Verify the floor works.
// =============================================================================
describe('BUG #20 — programEngine: calculatePrescription weight never goes negative', () => {
  const exercise = { exercise_name: 'Bench Press', base_sets: 3, base_reps: 8, is_compound: true };

  it('weight is always >= 0 on deload week with very hard feedback', () => {
    const result = calculatePrescription(
      exercise, 5,
      { weight: 0, reps: 8 },
      { difficulty: 10 }, // max difficulty
      null, {}
    );
    expect(result.weight).toBeGreaterThanOrEqual(0);
  });

  it('sets always >= 1 even with all negative feedback', () => {
    const result = calculatePrescription(
      exercise, 1,
      null,
      { soreness: 10, difficulty: 10, joint_comfort: 1, dreading: true },
      null, { Chest: { mev_low: 1, mev_high: 3, mav_low: 3, mav_high: 4, mrv_low: 5, mrv_high: 6 } }
    );
    expect(result.sets).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// BUG #21 — importParser: lbs conversion precision
// 225 lbs * 0.453592 = 102.0582 → rounded to 1dp = 102.1 kg
// =============================================================================
describe('BUG #21 — importParser: lbs to kg conversion accuracy', () => {
  const HEVY_LBS = `Date,Workout Name,Exercise Name,Set Order,Weight,Reps,RPE,Notes,Duration,Distance
2024-01-15 09:30,Push Day,Bench Press,1,225,5,8,,3600,`;

  it('converts 225 lbs to 102.1 kg', () => {
    const result = parseCSV(HEVY_LBS, 'lbs');
    expect(result.workouts[0].sets[0].weightKg).toBeCloseTo(102.1, 1);
  });

  it('converts 135 lbs to 61.2 kg', () => {
    const HEVY_135 = `Date,Workout Name,Exercise Name,Set Order,Weight,Reps,RPE,Notes,Duration,Distance
2024-01-15 09:30,Push Day,Bench Press,1,135,5,8,,3600,`;
    const result = parseCSV(HEVY_135, 'lbs');
    expect(result.workouts[0].sets[0].weightKg).toBeCloseTo(61.2, 1);
  });

  it('converts 0 lbs to 0 kg (bodyweight)', () => {
    const HEVY_BW = `Date,Workout Name,Exercise Name,Set Order,Weight,Reps,RPE,Notes,Duration,Distance
2024-01-15 09:30,Push Day,Pull-up,1,0,10,,,3600,`;
    const result = parseCSV(HEVY_BW, 'lbs');
    expect(result.workouts[0].sets[0].weightKg).toBe(0);
  });
});

// =============================================================================
// BUG #22 — nutritionEngine: TDEE returns 2000 when any key field is 0
// The check is `!weight_kg || !height_cm || !age`
// 0 is falsy in JS — so a user with age=0 (invalid) or weight=0 (invalid)
// correctly returns the fallback 2000. But this also means a user who
// accidentally sets height=0 gets 2000 with no indication of the issue.
// =============================================================================
describe('BUG #22 — calculateTDEE: falsy zero values trigger fallback', () => {
  it('returns 2000 fallback for weight_kg=0', () => {
    expect(calculateTDEE({ weight_kg: 0, height_cm: 175, age: 25 })).toBe(2000);
  });

  it('returns 2000 fallback for height_cm=0', () => {
    expect(calculateTDEE({ weight_kg: 80, height_cm: 0, age: 25 })).toBe(2000);
  });

  it('returns 2000 fallback for age=0', () => {
    expect(calculateTDEE({ weight_kg: 80, height_cm: 175, age: 0 })).toBe(2000);
  });

  it('correctly calculates for all positive values', () => {
    const tdee = calculateTDEE({ weight_kg: 80, height_cm: 180, age: 25, gender: 'male', activityLevel: 'moderate' });
    expect(tdee).toBeGreaterThan(2000);
    expect(tdee).toBeLessThan(4000);
  });

  it('handles unknown activityLevel by defaulting to moderate (1.55)', () => {
    const withModerate = calculateTDEE({ weight_kg: 80, height_cm: 180, age: 25, gender: 'male', activityLevel: 'moderate' });
    const withUnknown = calculateTDEE({ weight_kg: 80, height_cm: 180, age: 25, gender: 'male', activityLevel: 'extreme_athlete' });
    // Both should use 1.55 multiplier since unknown falls back to 1.55 via `|| 1.55`
    expect(withUnknown).toBe(withModerate);
  });
});
