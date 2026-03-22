import { describe, it, expect } from 'vitest';
import { calculateReadinessScore, getScoreBand } from '../readinessScore';

describe('calculateReadinessScore', () => {
  it('returns null when no sleep or soreness data', () => {
    const result = calculateReadinessScore({});
    expect(result).toBeNull();
  });

  it('computes high score for good sleep, low soreness, good joints', () => {
    const result = calculateReadinessScore({
      sleepHours: 8,
      avgSoreness: 2,
      jointComfort: 5,
      dreading: false,
    });
    expect(result).not.toBeNull();
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.label).toBe('Fully Ready');
    expect(result.color).toBe('#4CAF50');
  });

  it('computes low score for poor sleep and high soreness', () => {
    const result = calculateReadinessScore({
      sleepHours: 4,
      avgSoreness: 9,
      jointComfort: 1,
      dreading: true,
    });
    expect(result).not.toBeNull();
    expect(result.score).toBeLessThanOrEqual(25);
  });

  it('applies dreading penalty of -10', () => {
    const base = calculateReadinessScore({
      sleepHours: 7,
      avgSoreness: 3,
      jointComfort: 4,
      dreading: false,
    });
    const withDread = calculateReadinessScore({
      sleepHours: 7,
      avgSoreness: 3,
      jointComfort: 4,
      dreading: true,
    });
    expect(base.score - withDread.score).toBe(10);
  });

  it('handles HRV data when provided', () => {
    const withHRV = calculateReadinessScore({
      sleepHours: 7,
      hrvMs: 60,
      hrvAvgMs: 50,
      avgSoreness: 3,
      jointComfort: 4,
      dreading: false,
    });
    expect(withHRV).not.toBeNull();
    expect(withHRV.score).toBeGreaterThan(0);
  });

  it('adjusts weights when HRV is unavailable', () => {
    const noHRV = calculateReadinessScore({
      sleepHours: 7,
      avgSoreness: 5,
      jointComfort: 3,
      dreading: false,
    });
    const withHRV = calculateReadinessScore({
      sleepHours: 7,
      hrvMs: 30,
      hrvAvgMs: 50,
      avgSoreness: 5,
      jointComfort: 3,
      dreading: false,
    });
    // Both should produce valid scores but they differ
    expect(noHRV).not.toBeNull();
    expect(withHRV).not.toBeNull();
    expect(noHRV.score).not.toBe(withHRV.score);
  });

  it('clamps score between 0 and 100', () => {
    const low = calculateReadinessScore({
      sleepHours: 3,
      avgSoreness: 10,
      jointComfort: 1,
      dreading: true,
    });
    expect(low.score).toBeGreaterThanOrEqual(0);
    expect(low.score).toBeLessThanOrEqual(100);

    const high = calculateReadinessScore({
      sleepHours: 10,
      avgSoreness: 1,
      jointComfort: 5,
      dreading: false,
    });
    expect(high.score).toBeLessThanOrEqual(100);
    expect(high.score).toBeGreaterThanOrEqual(0);
  });

  it('works with only sleep data', () => {
    const result = calculateReadinessScore({ sleepHours: 8 });
    expect(result).not.toBeNull();
    expect(result.score).toBe(100);
  });

  it('works with only soreness data', () => {
    const result = calculateReadinessScore({ avgSoreness: 5 });
    expect(result).not.toBeNull();
    expect(result.score).toBeGreaterThan(0);
  });
});

describe('getScoreBand', () => {
  it('returns Fully Ready for 80+', () => {
    expect(getScoreBand(85).label).toBe('Fully Ready');
    expect(getScoreBand(100).label).toBe('Fully Ready');
  });

  it('returns Good to Go for 60-79', () => {
    expect(getScoreBand(60).label).toBe('Good to Go');
    expect(getScoreBand(79).label).toBe('Good to Go');
  });

  it('returns Moderate for 40-59', () => {
    expect(getScoreBand(40).label).toBe('Moderate');
    expect(getScoreBand(59).label).toBe('Moderate');
  });

  it('returns Low for 20-39', () => {
    expect(getScoreBand(20).label).toBe('Low');
    expect(getScoreBand(39).label).toBe('Low');
  });

  it('returns Recovery Day for 0-19', () => {
    expect(getScoreBand(0).label).toBe('Recovery Day');
    expect(getScoreBand(19).label).toBe('Recovery Day');
  });
});
