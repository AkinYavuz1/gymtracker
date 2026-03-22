// ============================================================
// Readiness Score — Pure calculation functions (no native deps)
// ============================================================

function scoreSleep(hours) {
  if (hours == null) return null;
  if (hours >= 8) return 100;
  if (hours >= 7) return 85;
  if (hours >= 6) return 60;
  if (hours >= 5) return 35;
  if (hours >= 4) return 15;
  return 0;
}

function scoreHRV(currentMs, avgMs) {
  if (currentMs == null || avgMs == null || avgMs <= 0) return null;
  const ratio = currentMs / avgMs;
  if (ratio >= 1.1) return 100;
  if (ratio >= 1.0) return 80;
  if (ratio >= 0.9) return 60;
  if (ratio >= 0.8) return 40;
  return 20;
}

function scoreSoreness(avgSoreness) {
  if (avgSoreness == null) return null;
  return Math.max(0, Math.round(100 - (avgSoreness - 1) * (100 / 9)));
}

function scoreJointComfort(comfort) {
  if (comfort == null || comfort === 0) return null;
  const map = { 1: 10, 2: 30, 3: 55, 4: 80, 5: 100 };
  return map[comfort] ?? null;
}

const SCORE_BANDS = [
  { min: 80, label: "Fully Ready", color: "#4CAF50", suggestion: "Go hard — you're primed for a great session." },
  { min: 60, label: "Good to Go", color: "#8BC34A", suggestion: "Normal training — push when it feels right." },
  { min: 40, label: "Moderate", color: "#FFC107", suggestion: "Consider lighter loads or fewer sets today." },
  { min: 20, label: "Low", color: "#FF9800", suggestion: "Deload recommended — reduce weight 20-30%, drop 1-2 sets." },
  { min: 0, label: "Recovery Day", color: "#F44336", suggestion: "Rest or active recovery — your body needs time to rebuild." },
];

export function getScoreBand(score) {
  return SCORE_BANDS.find(b => score >= b.min) || SCORE_BANDS[SCORE_BANDS.length - 1];
}

export function calculateReadinessScore({ sleepHours, hrvMs, hrvAvgMs, avgSoreness, jointComfort, dreading }) {
  const hasHRV = hrvMs != null && hrvAvgMs != null && hrvAvgMs > 0;

  const weights = hasHRV
    ? { sleep: 0.35, hrv: 0.25, soreness: 0.25, joints: 0.15 }
    : { sleep: 0.50, hrv: 0, soreness: 0.30, joints: 0.20 };

  const sleepScore = scoreSleep(sleepHours);
  const hrvScore = hasHRV ? scoreHRV(hrvMs, hrvAvgMs) : null;
  const sorenessScore = scoreSoreness(avgSoreness);
  const jointScore = scoreJointComfort(jointComfort);

  if (sleepScore == null && sorenessScore == null) return null;

  let totalWeight = 0;
  let weightedSum = 0;

  if (sleepScore != null) { weightedSum += weights.sleep * sleepScore; totalWeight += weights.sleep; }
  if (hrvScore != null) { weightedSum += weights.hrv * hrvScore; totalWeight += weights.hrv; }
  if (sorenessScore != null) { weightedSum += weights.soreness * sorenessScore; totalWeight += weights.soreness; }
  if (jointScore != null) { weightedSum += weights.joints * jointScore; totalWeight += weights.joints; }

  let score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  if (dreading) score = Math.max(0, score - 10);
  score = Math.min(100, Math.max(0, score));

  const band = getScoreBand(score);
  return { score, label: band.label, color: band.color, suggestion: band.suggestion };
}
