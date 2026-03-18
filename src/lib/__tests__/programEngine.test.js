import { describe, it, expect } from 'vitest';
import {
  calculatePrescription,
  generatePrescriptions,
  getMuscleGroup,
  getVolumeZoneLabel,
  getVolumeZoneColor,
} from '../programEngine';

const mockExercise = {
  exercise_name: 'Bench Press',
  base_sets: 3,
  base_reps: 8,
  is_compound: true,
};

const mockStd = {
  mev_low: 2, mev_high: 3,
  mav_low: 3, mav_high: 4,
  mrv_low: 5, mrv_high: 6,
};

const mockVolumeStandards = {
  Chest: mockStd,
};

describe('programEngine', () => {
  describe('getMuscleGroup()', () => {
    it('maps Bench Press to Chest', () => {
      expect(getMuscleGroup('Bench Press')).toBe('Chest');
    });

    it('maps Back Squat to Quads', () => {
      expect(getMuscleGroup('Back Squat')).toBe('Quads');
    });

    it('maps Romanian DL to Hamstrings', () => {
      expect(getMuscleGroup('Romanian DL')).toBe('Hamstrings');
    });

    it('maps Deadlift to Back', () => {
      expect(getMuscleGroup('Deadlift')).toBe('Back');
    });

    it('maps Overhead Press to Shoulders', () => {
      expect(getMuscleGroup('Overhead Press')).toBe('Shoulders');
    });

    it('maps Barbell Curl to Biceps', () => {
      expect(getMuscleGroup('Barbell Curl')).toBe('Biceps');
    });

    it('maps Tricep Pushdown to Triceps', () => {
      expect(getMuscleGroup('Tricep Pushdown')).toBe('Triceps');
    });

    it('returns Other for unknown exercise', () => {
      expect(getMuscleGroup('Unknown Exercise')).toBe('Other');
    });
  });

  describe('getVolumeZoneLabel()', () => {
    it('returns plain language for MEV', () => {
      expect(getVolumeZoneLabel('MEV')).toBe('least sets needed to grow');
    });

    it('returns plain language for MAV', () => {
      expect(getVolumeZoneLabel('MAV')).toBe('best growth range');
    });

    it('returns plain language for MRV', () => {
      expect(getVolumeZoneLabel('MRV')).toBe('upper limit before burning out');
    });

    it('returns null for unknown zone', () => {
      expect(getVolumeZoneLabel(null)).toBeNull();
    });
  });

  describe('getVolumeZoneColor()', () => {
    it('returns teal for MEV', () => {
      expect(getVolumeZoneColor('MEV')).toBe('#2DD4BF');
    });

    it('returns yellow-green for MAV', () => {
      expect(getVolumeZoneColor('MAV')).toBe('#A3E635');
    });

    it('returns orange-red for MRV', () => {
      expect(getVolumeZoneColor('MRV')).toBe('#F97316');
    });
  });

  describe('calculatePrescription() — volume standards', () => {
    it('Week 1 sets equal mev_high when standards provided', () => {
      const result = calculatePrescription(mockExercise, 1, null, null, null, mockVolumeStandards);
      expect(result.sets).toBe(mockStd.mev_high); // 3
    });

    it('Week 2 sets are midpoint(mev_high, mav_low)', () => {
      const result = calculatePrescription(mockExercise, 2, null, null, null, mockVolumeStandards);
      const expected = Math.round((mockStd.mev_high + mockStd.mav_low) / 2); // midpoint(3,3)=3
      expect(result.sets).toBe(expected);
    });

    it('Week 4 sets equal mav_high (best growth range peak)', () => {
      const result = calculatePrescription(mockExercise, 4, null, null, null, mockVolumeStandards);
      expect(result.sets).toBe(mockStd.mav_high); // 4
    });

    it('Week 5 (deload) sets equal mev_low regardless of feedback', () => {
      const feedback = { soreness: 1, difficulty: 1 }; // would normally increase sets
      const result = calculatePrescription(mockExercise, 5, null, feedback, null, mockVolumeStandards);
      expect(result.sets).toBe(mockStd.mev_low); // 2
    });

    it('high soreness decreases sets but never below mev_low', () => {
      // Week 1 → mev_high=3, soreness=8 → -1 → 2 (= mev_low)
      const result = calculatePrescription(mockExercise, 1, null, { soreness: 8 }, null, mockVolumeStandards);
      expect(result.sets).toBe(mockStd.mev_low); // clamped at 2
    });

    it('MRV clamp: sets never exceed mrv_high', () => {
      // Week 4 → mav_high=4; difficulty=1 (too easy) → +1 set → 5, within mrv_high=6
      const result = calculatePrescription(mockExercise, 4, null, { difficulty: 1 }, null, mockVolumeStandards);
      expect(result.sets).toBeLessThanOrEqual(mockStd.mrv_high);
    });

    it('joint comfort <= 2 reduces sets by 1', () => {
      const result1 = calculatePrescription(mockExercise, 1, null, { joint_comfort: 2 }, null, mockVolumeStandards);
      const result2 = calculatePrescription(mockExercise, 1, null, { joint_comfort: 3 }, null, mockVolumeStandards);
      expect(result1.sets).toBeLessThan(result2.sets + 1); // reduced or clamped
    });

    it('dreading=true reduces sets by 1', () => {
      const resultDread = calculatePrescription(mockExercise, 2, null, { dreading: true }, null, mockVolumeStandards);
      const resultNoDread = calculatePrescription(mockExercise, 2, null, { dreading: false }, null, mockVolumeStandards);
      expect(resultDread.sets).toBeLessThanOrEqual(resultNoDread.sets);
    });

    it('returns volumeZone field', () => {
      const result = calculatePrescription(mockExercise, 1, null, null, null, mockVolumeStandards);
      expect(['MEV', 'MAV', 'MRV']).toContain(result.volumeZone);
    });

    it('returns volumeStd field', () => {
      const result = calculatePrescription(mockExercise, 1, null, null, null, mockVolumeStandards);
      expect(result.volumeStd).toEqual(mockStd);
    });

    it('does not crash when no volumeStandards provided', () => {
      expect(() => calculatePrescription(mockExercise, 1, null, null, null, {})).not.toThrow();
    });

    it('does not crash when volumeStandards is undefined', () => {
      expect(() => calculatePrescription(mockExercise, 1, null, null, null, undefined)).not.toThrow();
    });

    it('volumeZone is null when no standards', () => {
      const result = calculatePrescription(mockExercise, 1, null, null, null, {});
      expect(result.volumeZone).toBeNull();
    });
  });

  describe('generatePrescriptions()', () => {
    const dayExercises = [
      { exercise_name: 'Bench Press', base_sets: 3, base_reps: 8, is_compound: true, sort_order: 0 },
      { exercise_name: 'Romanian DL', base_sets: 3, base_reps: 10, is_compound: true, sort_order: 1 },
    ];

    it('returns one prescription per exercise', () => {
      const result = generatePrescriptions(dayExercises, 1);
      expect(result).toHaveLength(2);
    });

    it('passes volumeStandards through to each prescription', () => {
      const vs = { Chest: mockStd };
      const result = generatePrescriptions(dayExercises, 1, {}, {}, {}, null, vs);
      const benchResult = result.find(r => r.exercise_name === 'Bench Press');
      expect(benchResult.volumeStd).toEqual(mockStd);
    });

    it('uses startingWeights as fallback weight', () => {
      const sw = { 'Bench Press': 80 };
      const result = generatePrescriptions(dayExercises, 1, {}, {}, sw, null, {});
      const bench = result.find(r => r.exercise_name === 'Bench Press');
      expect(bench.weight).toBeGreaterThan(0);
    });

    it('does not crash with empty input', () => {
      expect(() => generatePrescriptions([], 1)).not.toThrow();
    });
  });
});
