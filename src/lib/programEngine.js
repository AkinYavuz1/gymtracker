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
 * volumeMult = multiplier on base sets
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

/** Volume ceiling per muscle group per session (sets) */
const VOLUME_CEILING = {
  compound: 5,
  isolation: 4,
};

/**
 * Calculate prescribed exercise parameters for a given week.
 *
 * @param {Object} exercise - { exercise_name, base_sets, base_reps, is_compound }
 * @param {number} weekNumber - 1-5
 * @param {Object|null} lastSession - { weight, reps, sets_completed } from previous week
 * @param {Object|null} feedback - { soreness, pump } ratings (1-10) for relevant muscle group
 * @param {Object|null} profile - { experience, training_goal } from user profile
 * @returns {Object} { weight, sets, reps, rir, notes[] }
 */
export function calculatePrescription(exercise, weekNumber, lastSession, feedback, profile) {
  const config = WEEK_CONFIG[weekNumber] || WEEK_CONFIG[1];
  const notes = [];

  // Base values
  let baseWeight = lastSession?.weight || 20;
  let baseSets = exercise.base_sets;
  let baseReps = exercise.base_reps;

  // --- Week-based progression ---
  let weight = roundWeight(baseWeight * config.intensityMult);
  let sets = Math.round(baseSets * config.volumeMult);
  let reps = baseReps;
  let rir = config.rir;

  // --- Performance-based auto-regulation ---
  if (lastSession && weekNumber > 1 && weekNumber < 5) {
    // User exceeded prescribed reps by 2+ last session → increase weight 5%
    const lastPrescribedReps = baseReps;
    if (lastSession.reps >= lastPrescribedReps + 2) {
      const bump = roundWeight(baseWeight * 0.05);
      weight = roundWeight(weight + bump);
      notes.push(`+${bump}kg (exceeded target reps)`);
    }
  }

  // --- Feedback-based adaptation ---
  if (feedback && weekNumber < 5) {
    const ceiling = exercise.is_compound ? VOLUME_CEILING.compound : VOLUME_CEILING.isolation;

    // Soreness adaptation
    if (feedback.soreness !== undefined) {
      if (feedback.soreness >= 7) {
        sets = Math.max(2, sets - 1);
        notes.push("−1 set (high soreness)");
      } else if (feedback.soreness < 3 && sets < ceiling) {
        sets = sets + 1;
        notes.push("+1 set (low soreness)");
      }
    }

    // Pump feedback — suggest exercise swap if consistently low
    if (feedback.pump !== undefined && feedback.pump < 4) {
      notes.push("Consider swapping exercise (low pump)");
    }
  }

  // --- Experience-based adjustments ---
  if (profile) {
    if (profile.experience === "beginner" && weekNumber <= 2) {
      rir = Math.max(rir, 2); // Beginners keep higher RIR early on
    }
    if (profile.experience === "advanced" && weekNumber === 4) {
      rir = 0; // Advanced lifters can push to failure on peak week
    }
  }

  // --- Deload week treatment ---
  if (weekNumber === 5) {
    notes.push("Deload week — focus on form and recovery");
  }

  return {
    weight: Math.max(0, weight),
    sets: Math.max(1, sets),
    reps,
    rir,
    notes,
  };
}

/**
 * Generate prescribed exercises for a scheduled workout.
 * Takes a program day's exercises and produces full prescriptions.
 *
 * @param {Array} dayExercises - program_day_exercises rows
 * @param {number} weekNumber - 1-5
 * @param {Object} lastSessionMap - { exerciseName: { weight, reps, sets_completed } }
 * @param {Object} feedbackMap - { muscleGroup: { soreness, pump } }
 * @param {Object} startingWeights - { exerciseName: weight } from enrollment settings
 * @param {Object|null} profile - user profile
 * @returns {Array} prescribed exercises with full details
 */
export function generatePrescriptions(dayExercises, weekNumber, lastSessionMap = {}, feedbackMap = {}, startingWeights = {}, profile = null) {
  return dayExercises.map(ex => {
    const lastSession = lastSessionMap[ex.exercise_name] || (
      startingWeights[ex.exercise_name]
        ? { weight: startingWeights[ex.exercise_name], reps: ex.base_reps, sets_completed: ex.base_sets }
        : null
    );

    // Find relevant muscle group for feedback
    const muscleGroup = getMuscleGroup(ex.exercise_name);
    const feedback = feedbackMap[muscleGroup] || null;

    const prescription = calculatePrescription(ex, weekNumber, lastSession, feedback, profile);

    return {
      exercise_name: ex.exercise_name,
      is_compound: ex.is_compound,
      sort_order: ex.sort_order,
      ...prescription,
    };
  });
}

/**
 * Map exercise names to muscle groups (mirrors MUSCLE_MAP in App.jsx)
 */
const EXERCISE_MUSCLE_MAP = {
  "Bench Press": "Chest", "Incline DB Press": "Chest", "Cable Fly": "Chest",
  "Chest Dip": "Chest", "Machine Press": "Chest", "Push-ups": "Chest",
  "Deadlift": "Back", "Pull-ups": "Back", "Barbell Row": "Back",
  "Lat Pulldown": "Back", "Cable Row": "Back", "T-Bar Row": "Back",
  "Back Squat": "Legs", "Leg Press": "Legs", "Romanian DL": "Legs",
  "Walking Lunge": "Legs", "Leg Curl": "Legs", "Leg Extension": "Legs",
  "Overhead Press": "Shoulders", "Lateral Raise": "Shoulders",
  "Face Pull": "Shoulders", "Arnold Press": "Shoulders",
  "Barbell Curl": "Arms", "Hammer Curl": "Arms",
  "Tricep Pushdown": "Arms", "Skull Crusher": "Arms",
};

export function getMuscleGroup(exerciseName) {
  return EXERCISE_MUSCLE_MAP[exerciseName] || "Other";
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
    "bro-split": 0,
  };

  // Frequency matching
  if (freq >= 6) scores["ppl"] += 3;
  else if (freq >= 5) { scores["bro-split"] += 3; scores["ppl"] += 1; }
  else if (freq >= 4) { scores["upper-lower"] += 3; scores["bro-split"] += 1; }
  else { scores["full-body"] += 3; scores["upper-lower"] += 1; }

  // Experience matching
  if (exp === "beginner") { scores["full-body"] += 2; scores["upper-lower"] += 1; }
  else if (exp === "intermediate") { scores["upper-lower"] += 2; scores["ppl"] += 1; }
  else { scores["ppl"] += 2; scores["bro-split"] += 1; }

  // Goal matching
  if (goal === "muscle_gain") { scores["ppl"] += 1; scores["bro-split"] += 1; }
  else if (goal === "performance") { scores["upper-lower"] += 1; scores["full-body"] += 1; }
  else if (goal === "fat_loss") { scores["full-body"] += 1; }

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([slug]) => slug);
}
