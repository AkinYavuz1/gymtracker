// ============================================================
// Health Data — Unified abstraction for Apple Health / Google Fit
// ============================================================
// Native health plugin imports are constructed dynamically to prevent
// Vite's static import analysis from failing in web/test environments
// where the native plugins are not installed.
// ============================================================

import { Capacitor } from '@capacitor/core';
export { calculateReadinessScore, getScoreBand } from './readinessScore';

// Opaque module paths — prevents Vite static analysis from resolving these
const APPLE_HEALTH_MODULE = ['capacitor', 'apple', 'health'].join('-');
const HEALTH_CONNECT_MODULE = '@nicenicer/' + 'capacitor-health-connect';

// ─── Platform detection ──────────────────────────────────────

export function isHealthAvailable() {
  return Capacitor.isNativePlatform();
}

function getPlatform() {
  return Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
}

// ─── Permission helpers ──────────────────────────────────────

export async function requestHealthPermissions() {
  const platform = getPlatform();
  try {
    if (platform === 'ios') {
      const mod = await import(APPLE_HEALTH_MODULE);
      await mod.CapacitorAppleHealth.requestAuthorization({
        read: ['sleepAnalysis', 'heartRateVariabilitySDNN'],
      });
      return 'granted';
    } else if (platform === 'android') {
      const mod = await import(HEALTH_CONNECT_MODULE);
      await mod.HealthConnect.requestAuthorization({
        read: ['SleepSession', 'HeartRateVariabilityRmssd'],
      });
      return 'granted';
    }
  } catch (e) {
    console.error('Health permission error:', e);
    return 'denied';
  }
  return 'unavailable';
}

export async function getHealthPermissionStatus() {
  return localStorage.getItem('healthPermission') || 'unknown';
}

// ─── Data fetching ───────────────────────────────────────────

export async function fetchSleepData(date) {
  const platform = getPlatform();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const sleepStart = new Date(start);
  sleepStart.setDate(sleepStart.getDate() - 1);
  sleepStart.setHours(18, 0, 0, 0);
  const sleepEnd = new Date(start);
  sleepEnd.setHours(12, 0, 0, 0);

  try {
    if (platform === 'ios') {
      const mod = await import(APPLE_HEALTH_MODULE);
      const result = await mod.CapacitorAppleHealth.querySleepSamples({
        startDate: sleepStart.toISOString(),
        endDate: sleepEnd.toISOString(),
      });
      const totalMs = (result.samples || [])
        .filter(s => s.value === 'ASLEEP' || s.value === 'IN_BED')
        .reduce((sum, s) => sum + (new Date(s.endDate) - new Date(s.startDate)), 0);
      return Math.round((totalMs / 3600000) * 10) / 10;
    } else if (platform === 'android') {
      const mod = await import(HEALTH_CONNECT_MODULE);
      const result = await mod.HealthConnect.readRecords({
        type: 'SleepSession',
        timeRangeFilter: {
          startTime: sleepStart.toISOString(),
          endTime: sleepEnd.toISOString(),
        },
      });
      const totalMs = (result.records || [])
        .reduce((sum, s) => sum + (new Date(s.endTime) - new Date(s.startTime)), 0);
      return Math.round((totalMs / 3600000) * 10) / 10;
    }
  } catch (e) {
    console.error('fetchSleepData error:', e);
  }
  return null;
}

export async function fetchHRVData(date) {
  const platform = getPlatform();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  try {
    if (platform === 'ios') {
      const mod = await import(APPLE_HEALTH_MODULE);
      const result = await mod.CapacitorAppleHealth.queryQuantitySamples({
        sampleType: 'heartRateVariabilitySDNN',
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
      if (result.samples?.length > 0) {
        const sorted = result.samples.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
        return sorted[0].value;
      }
    } else if (platform === 'android') {
      const mod = await import(HEALTH_CONNECT_MODULE);
      const result = await mod.HealthConnect.readRecords({
        type: 'HeartRateVariabilityRmssd',
        timeRangeFilter: {
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      });
      if (result.records?.length > 0) {
        const sorted = result.records.sort((a, b) => new Date(b.time) - new Date(a.time));
        return sorted[0].heartRateVariabilityMillis;
      }
    }
  } catch (e) {
    console.error('fetchHRVData error:', e);
  }
  return null;
}
