// ============================================================
// Program Engine — Deterministic progression & adaptation
// ============================================================
// Pure frontend logic. No API calls needed — works offline.
// Calculates prescribed weight/sets/reps/RIR for each exercise
// based on week number, last session data, and user feedback.
// ============================================================

/**
 * Week-by-week periodization config (4-week mesocycle + 1 deload)
 * RIR = Reps In Reserve (how many reps left before failure)
 * volumeMult = multiplier on base sets (used as fallback when no volume standards)
 * intensityMult = multiplier on base weight
 */
export const WEEK_CONFIG = {
  1: { rir: 3, volumeMult: 1.0,  intensityMult: 1.0   },
  2: { rir: 2, volumeMult: 1.08, intensityMult: 1.025  },
  3: { rir: 1, volumeMult: 1.15, intensityMult: 1.05   },
  4: { rir: 0, volumeMult: 1.20, intensityMult: 1.075  },
  5: { rir: 4, volumeMult: 0.50, intensityMult: 0.90   }, // Deload
};

/** Round weight to nearest 2.5 kg increment */
export function roundWeight(weight) {
  return Math.round(weight / 2.5) * 2.5;
}

/**
 * Map exercise names to granular muscle groups for volume standard lookups.
 * Groups: Chest, Back, Quads, Hamstrings, Glutes, Shoulders, Biceps, Triceps, Calves, Abs
 */
const EXERCISE_MUSCLE_MAP = {
  // Chest
  "Bench Press": "Chest", "Incline DB Press": "Chest", "Cable Fly": "Chest",
  "Chest Dip": "Chest", "Machine Press": "Chest", "Push-ups": "Chest",
  // Back
  "Deadlift": "Back", "Pull-ups": "Back", "Barbell Row": "Back",
  "Lat Pulldown": "Back", "Cable Row": "Back", "T-Bar Row": "Back",
  // Quads
  "Back Squat": "Quads", "Leg Press": "Quads", "Walking Lunge": "Quads",
  "Leg Extension": "Quads", "Hack Squat": "Quads", "Front Squat": "Quads",
  // Hamstrings
  "Romanian DL": "Hamstrings", "Leg Curl": "Hamstrings", "Nordic Curl": "Hamstrings",
  "Good Morning": "Hamstrings", "Stiff Leg DL": "Hamstrings",
  // Glutes
  "Hip Thrust": "Glutes", "Glute Bridge": "Glutes", "Cable Kickback": "Glutes",
  "Bulgarian Split Squat": "Glutes",
  // Shoulders
  "Overhead Press": "Shoulders", "Lateral Raise": "Shoulders",
  "Face Pull": "Shoulders", "Arnold Press": "Shoulders",
  "Rear Delt Fly": "Shoulders", "Upright Row": "Shoulders",
  // Biceps
  "Barbell Curl": "Biceps", "Hammer Curl": "Biceps", "Preacher Curl": "Biceps",
  "Incline Curl": "Biceps", "Cable Curl": "Biceps",
  // Triceps
  "Tricep Pushdown": "Triceps", "Skull Crusher": "Triceps", "Overhead Tricep": "Triceps",
  "Close Grip Bench": "Triceps", "Dips": "Triceps",
  // Calves
  "Calf Raise": "Calves", "Seated Calf Raise": "Calves", "Donkey Calf Raise": "Calves",
  // Abs
  "Plank": "Abs", "Crunch": "Abs", "Cable Crunch": "Abs", "Hanging Leg Raise": "Abs",
  "Ab Wheel": "Abs", "Sit-up": "Abs",
};

export function getMuscleGroup(exerciseName) {
  return EXERCISE_MUSCLE_MAP[exerciseName] || "Other";
}

/**
 * Return all exercise names that target the same muscle group as the given exercise.
 */
export function getExercisesForMuscle(exerciseName) {
  const group = EXERCISE_MUSCLE_MAP[exerciseName];
  if (!group) return [];
  return Object.entries(EXERCISE_MUSCLE_MAP)
    .filter(([name, g]) => g === group && name !== exerciseName)
    .map(([name]) => name);
}

/**
 * Determine the volume zone label for a given set count relative to standards.
 * Returns: "MEV" | "MAV" | "MRV" | null
 */
function getVolumeZone(sets, std) {
  if (!std) return null;
  if (sets <= std.mev_high) return "MEV";
  if (sets <= std.mav_high) return "MAV";
  return "MRV";
}

/**
 * Compute target sets for a given week using MEV/MAV/MRV standards.
 * Week 1 → mev_high (least sets needed to grow)
 * Week 2 → midpoint(mev_high, mav_low)
 * Week 3 → midpoint(mav_low, mav_high)
 * Week 4 → mav_high (best growth range peak)
 * Week 5 → mev_low (deload — back to floor)
 */
function targetSetsFromStandards(weekNumber, std, baseSets) {
  if (!std) {
    // Fallback: use volumeMult on base sets
    const config = WEEK_CONFIG[weekNumber] || WEEK_CONFIG[1];
    return Math.round(baseSets * config.volumeMult);
  }
  const midpoint = (a, b) => Math.round((a + b) / 2);
  switch (weekNumber) {
    case 1: return std.mev_high;
    case 2: return midpoint(std.mev_high, std.mav_low);
    case 3: return midpoint(std.mav_low, std.mav_high);
    case 4: return std.mav_high;
    case 5: return std.mev_low; // Deload
    default: return std.mev_high;
  }
}

/**
 * Calculate prescribed exercise parameters for a given week.
 *
 * @param {Object} exercise - { exercise_name, base_sets, base_reps, is_compound }
 * @param {number} weekNumber - 1-5
 * @param {Object|null} lastSession - { weight, reps, sets_completed } from previous week
 * @param {Object|null} feedback - { soreness, pump, difficulty, joint_comfort, dreading } ratings
 * @param {Object|null} profile - { experience, training_goal } from user profile
 * @param {Object} volumeStandards - map from muscle_group to { mev_low, mev_high, mav_low, mav_high, mrv_low, mrv_high }
 * @returns {Object} { weight, sets, reps, rir, notes[], volumeZone, volumeStd }
 */
export function calculatePrescription(exercise, weekNumber, lastSession, feedback, profile, volumeStandards = {}) {
  const config = WEEK_CONFIG[weekNumber] || WEEK_CONFIG[1];
  const notes = [];

  // Base values
  let baseWeight = lastSession?.weight || 20;
  let baseReps = exercise.base_reps;

  // Look up volume standards for this exercise's muscle group
  const muscleGroup = getMuscleGroup(exercise.exercise_name);
  const std = volumeStandards[muscleGroup] || null;

  // --- Week-based set progression using MEV/MAV/MRV ---
  let sets = targetSetsFromStandards(weekNumber, std, exercise.base_sets);

  // --- Week-based weight progression ---
  let weight = roundWeight(baseWeight * config.intensityMult);
  let reps = baseReps;
  let rir = config.rir;

  // --- Performance-based auto-regulation ---
  if (lastSession && weekNumber > 1 && weekNumber < 5) {
    const lastPrescribedReps = baseReps;
    if (lastSession.reps >= lastPrescribedReps + 2) {
      const bump = roundWeight(baseWeight * 0.05);
      weight = roundWeight(weight + bump);
      notes.push(`+${bump}kg (exceeded target reps)`);
    }
  }

  // --- Feedback-based adaptation ---
  if (feedback && weekNumber < 5) {
    const mevFloor = std?.mev_low ?? 1;
    const mrvCeiling = std?.mrv_high ?? (exercise.is_compound ? 5 : 4);

    // Soreness adaptation
    if (feedback.soreness !== undefined) {
      if (feedback.soreness >= 7) {
        sets = Math.max(mevFloor, sets - 1);
        notes.push("−1 set (high soreness)");
      } else if (feedback.soreness < 3 && sets < mrvCeiling) {
        sets = Math.min(mrvCeiling, sets + 1);
        notes.push("+1 set (low soreness)");
      }
    }

    // Pump feedback — suggest exercise swap if consistently low
    if (feedback.pump !== undefined && feedback.pump < 4) {
      notes.push("Consider swapping exercise (low pump)");
    }

    // Difficulty adaptation
    if (feedback.difficulty !== undefined) {
      if (feedback.difficulty <= 3) {
        weight = roundWeight(weight * 1.025);
        if (exercise.is_compound && sets < mrvCeiling) sets = Math.min(mrvCeiling, sets + 1);
        notes.push("+2.5% weight (session too easy)");
      } else if (feedback.difficulty >= 9) {
        weight = roundWeight(weight * 0.95);
        if (exercise.is_compound) sets = Math.max(mevFloor, sets - 1);
        notes.push("-5% weight (session too hard)");
      }
    }

    // Joint comfort adaptation (1-5 scale, 5=perfect, 1=painful)
    if (feedback.joint_comfort !== undefined && feedback.joint_comfort <= 2) {
      sets = Math.max(mevFloor, sets - 1);
      notes.push("−1 set (joint discomfort)");
    }

    // Dread/readiness adaptation
    if (feedback.dreading === true) {
      sets = Math.max(mevFloor, sets - 1);
      notes.push("−1 set (low readiness)");
    }

    // MRV warning — approaching upper limit
    if (std && sets >= std.mrv_low) {
      notes.push("Near upper limit — recovery focus next week");
    }
  }

  // --- Experience-based adjustments ---
  if (profile) {
    if (profile.experience === "beginner" && weekNumber <= 2) {
      rir = Math.max(rir, 2);
    }
    if (profile.experience === "advanced" && weekNumber === 4) {
      rir = 0;
    }
  }

  // --- Deload week treatment ---
  if (weekNumber === 5) {
    notes.push("Deload week — focus on form and recovery");
  }

  // Determine volume zone
  const volumeZone = getVolumeZone(sets, std);

  return {
    weight: Math.max(0, weight),
    sets: Math.max(1, sets),
    reps,
    rir,
    notes,
    volumeZone,
    volumeStd: std || null,
  };
}

/**
 * Generate prescribed exercises for a scheduled workout.
 *
 * @param {Array} dayExercises - program_day_exercises rows
 * @param {number} weekNumber - 1-5
 * @param {Object} lastSessionMap - { exerciseName: { weight, reps, sets_completed } }
 * @param {Object} feedbackMap - { muscleGroup: { soreness, pump, difficulty, joint_comfort, dreading } }
 * @param {Object} startingWeights - { exerciseName: weight } from enrollment settings
 * @param {Object|null} profile - user profile
 * @param {Object} volumeStandards - map from muscle_group to volume standards
 * @returns {Array} prescribed exercises with full details
 */
export function generatePrescriptions(dayExercises, weekNumber, lastSessionMap = {}, feedbackMap = {}, startingWeights = {}, profile = null, volumeStandards = {}) {
  return dayExercises.map(ex => {
    const lastSession = lastSessionMap[ex.exercise_name] || (
      startingWeights[ex.exercise_name]
        ? { weight: startingWeights[ex.exercise_name], reps: ex.base_reps, sets_completed: ex.base_sets }
        : null
    );

    const muscleGroup = getMuscleGroup(ex.exercise_name);
    const feedback = feedbackMap[muscleGroup] || null;

    const prescription = calculatePrescription(ex, weekNumber, lastSession, feedback, profile, volumeStandards);

    return {
      exercise_name: ex.exercise_name,
      is_compound: ex.is_compound,
      sort_order: ex.sort_order,
      ...prescription,
    };
  });
}

/**
 * Check if a week is a deload week
 */
export function isDeloadWeek(weekNumber) {
  return weekNumber === 5;
}

/**
 * Get a friendly label for the week
 */
export function getWeekLabel(weekNumber) {
  if (weekNumber === 5) return "Deload";
  return `Week ${weekNumber}`;
}

/**
 * Map old training goals to new ones (for backward compatibility)
 */
export function mapGoalToNew(goal) {
  const map = {
    hypertrophy: "muscle_gain",
    strength: "performance",
    endurance: "performance",
    general: "maintenance",
  };
  return map[goal] || goal;
}

/**
 * Recommend a program based on user profile
 * Returns program slugs sorted by relevance
 */
export function recommendPrograms(profile) {
  const freq = profile?.training_frequency || 3;
  const exp = profile?.experience || "beginner";
  const goal = mapGoalToNew(profile?.training_goal || "general");

  const scores = {
    "ppl": 0,
    "upper-lower": 0,
    "full-body": 0,
    "5-day-split": 0,
  };

  if (freq >= 6) scores["ppl"] += 3;
  else if (freq >= 5) { scores["5-day-split"] += 3; scores["ppl"] += 1; }
  else if (freq >= 4) { scores["upper-lower"] += 3; scores["5-day-split"] += 1; }
  else { scores["full-body"] += 3; scores["upper-lower"] += 1; }

  if (exp === "beginner") { scores["full-body"] += 2; scores["upper-lower"] += 1; }
  else if (exp === "intermediate") { scores["upper-lower"] += 2; scores["ppl"] += 1; }
  else { scores["ppl"] += 2; scores["5-day-split"] += 1; }

  if (goal === "muscle_gain") { scores["ppl"] += 1; scores["5-day-split"] += 1; }
  else if (goal === "performance") { scores["upper-lower"] += 1; scores["full-body"] += 1; }
  else if (goal === "fat_loss") { scores["full-body"] += 1; }

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([slug]) => slug);
}

/**
 * Get plain-language label for a volume zone (no MEV/MAV/MRV jargon)
 */
export function getVolumeZoneLabel(volumeZone) {
  switch (volumeZone) {
    case "MEV": return "least sets needed to grow";
    case "MAV": return "best growth range";
    case "MRV": return "upper limit before burning out";
    default: return null;
  }
}

/**
 * Get color for a volume zone badge
 */
export function getVolumeZoneColor(volumeZone) {
  switch (volumeZone) {
    case "MEV": return "#2DD4BF"; // teal
    case "MAV": return "#A3E635"; // yellow-green
    case "MRV": return "#F97316"; // orange-red
    default: return null;
  }
}
