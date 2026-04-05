/**
 * Rich demo data for guest / browse-without-account mode.
 * Everything is computed relative to today so dates always look recent.
 */

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 50), 0, 0);
  return d.toISOString();
}

// ─── Workouts (12 sessions over ~5 weeks) ────────────────────────────────────
export const GUEST_WORKOUTS = [
  { id: "gw1",  started_at: daysAgo(1),  name: "Push Day A",  total_volume_kg: 9240,  duration_secs: 3780, exercise_count: 5, color: "#DFFF3C" },
  { id: "gw2",  started_at: daysAgo(3),  name: "Pull Day",    total_volume_kg: 7680,  duration_secs: 3480, exercise_count: 5, color: "#3CFFF0" },
  { id: "gw3",  started_at: daysAgo(5),  name: "Legs A",      total_volume_kg: 14200, duration_secs: 4200, exercise_count: 5, color: "#FF6B3C" },
  { id: "gw4",  started_at: daysAgo(7),  name: "Push Day B",  total_volume_kg: 9560,  duration_secs: 3900, exercise_count: 5, color: "#DFFF3C" },
  { id: "gw5",  started_at: daysAgo(9),  name: "Pull Day",    total_volume_kg: 7920,  duration_secs: 3540, exercise_count: 5, color: "#3CFFF0" },
  { id: "gw6",  started_at: daysAgo(11), name: "Legs B",      total_volume_kg: 13800, duration_secs: 4080, exercise_count: 5, color: "#FF6B3C" },
  { id: "gw7",  started_at: daysAgo(14), name: "Push Day A",  total_volume_kg: 8900,  duration_secs: 3720, exercise_count: 5, color: "#DFFF3C" },
  { id: "gw8",  started_at: daysAgo(16), name: "Pull Day",    total_volume_kg: 7480,  duration_secs: 3360, exercise_count: 5, color: "#3CFFF0" },
  { id: "gw9",  started_at: daysAgo(18), name: "Legs A",      total_volume_kg: 13400, duration_secs: 3960, exercise_count: 5, color: "#FF6B3C" },
  { id: "gw10", started_at: daysAgo(21), name: "Push Day B",  total_volume_kg: 8600,  duration_secs: 3600, exercise_count: 5, color: "#DFFF3C" },
  { id: "gw11", started_at: daysAgo(25), name: "Pull Day",    total_volume_kg: 7200,  duration_secs: 3240, exercise_count: 5, color: "#3CFFF0" },
  { id: "gw12", started_at: daysAgo(30), name: "Legs B",      total_volume_kg: 12800, duration_secs: 3840, exercise_count: 5, color: "#FF6B3C" },
];

// ─── Workout Sets (for Stats + History detail views) ─────────────────────────
export const GUEST_SETS = [
  // gw1 — Push Day A (yesterday)
  { workout_id: "gw1", exercise_name: "Bench Press",      sets: 4, reps: 8,  weight_kg: 102.5 },
  { workout_id: "gw1", exercise_name: "Incline DB Press", sets: 3, reps: 10, weight_kg: 38 },
  { workout_id: "gw1", exercise_name: "Cable Fly",        sets: 3, reps: 12, weight_kg: 22 },
  { workout_id: "gw1", exercise_name: "Overhead Press",   sets: 3, reps: 8,  weight_kg: 62.5 },
  { workout_id: "gw1", exercise_name: "Lateral Raise",    sets: 4, reps: 15, weight_kg: 12 },

  // gw2 — Pull Day
  { workout_id: "gw2", exercise_name: "Deadlift",         sets: 4, reps: 5,  weight_kg: 155 },
  { workout_id: "gw2", exercise_name: "Pull-ups",         sets: 4, reps: 8,  weight_kg: 10 },
  { workout_id: "gw2", exercise_name: "Barbell Row",      sets: 3, reps: 8,  weight_kg: 85 },
  { workout_id: "gw2", exercise_name: "Face Pull",        sets: 3, reps: 15, weight_kg: 27.5 },
  { workout_id: "gw2", exercise_name: "Hammer Curl",      sets: 3, reps: 12, weight_kg: 18 },

  // gw3 — Legs A
  { workout_id: "gw3", exercise_name: "Back Squat",       sets: 4, reps: 6,  weight_kg: 125 },
  { workout_id: "gw3", exercise_name: "Leg Press",        sets: 3, reps: 10, weight_kg: 210 },
  { workout_id: "gw3", exercise_name: "Romanian DL",      sets: 3, reps: 8,  weight_kg: 105 },
  { workout_id: "gw3", exercise_name: "Walking Lunge",    sets: 3, reps: 12, weight_kg: 26 },
  { workout_id: "gw3", exercise_name: "Leg Curl",         sets: 3, reps: 12, weight_kg: 47.5 },

  // gw4 — Push Day B
  { workout_id: "gw4", exercise_name: "Bench Press",      sets: 4, reps: 8,  weight_kg: 100 },
  { workout_id: "gw4", exercise_name: "Incline DB Press", sets: 3, reps: 10, weight_kg: 36 },
  { workout_id: "gw4", exercise_name: "Overhead Press",   sets: 3, reps: 8,  weight_kg: 60 },
  { workout_id: "gw4", exercise_name: "Lateral Raise",    sets: 4, reps: 15, weight_kg: 12 },
  { workout_id: "gw4", exercise_name: "Skull Crusher",    sets: 3, reps: 10, weight_kg: 42.5 },

  // gw5 — Pull Day
  { workout_id: "gw5", exercise_name: "Deadlift",         sets: 4, reps: 5,  weight_kg: 152.5 },
  { workout_id: "gw5", exercise_name: "Pull-ups",         sets: 4, reps: 8,  weight_kg: 10 },
  { workout_id: "gw5", exercise_name: "Barbell Row",      sets: 3, reps: 8,  weight_kg: 82.5 },
  { workout_id: "gw5", exercise_name: "Face Pull",        sets: 3, reps: 15, weight_kg: 25 },
  { workout_id: "gw5", exercise_name: "Hammer Curl",      sets: 3, reps: 12, weight_kg: 18 },

  // gw6 — Legs B
  { workout_id: "gw6", exercise_name: "Back Squat",       sets: 4, reps: 6,  weight_kg: 122.5 },
  { workout_id: "gw6", exercise_name: "Leg Press",        sets: 3, reps: 10, weight_kg: 205 },
  { workout_id: "gw6", exercise_name: "Romanian DL",      sets: 3, reps: 8,  weight_kg: 102.5 },
  { workout_id: "gw6", exercise_name: "Walking Lunge",    sets: 3, reps: 12, weight_kg: 24 },
  { workout_id: "gw6", exercise_name: "Calf Raise",       sets: 4, reps: 15, weight_kg: 80 },

  // gw7 — Push Day A (week -2)
  { workout_id: "gw7", exercise_name: "Bench Press",      sets: 4, reps: 8,  weight_kg: 97.5 },
  { workout_id: "gw7", exercise_name: "Incline DB Press", sets: 3, reps: 10, weight_kg: 36 },
  { workout_id: "gw7", exercise_name: "Cable Fly",        sets: 3, reps: 12, weight_kg: 20 },
  { workout_id: "gw7", exercise_name: "Overhead Press",   sets: 3, reps: 8,  weight_kg: 57.5 },
  { workout_id: "gw7", exercise_name: "Lateral Raise",    sets: 4, reps: 15, weight_kg: 12 },

  // gw8 — Pull Day
  { workout_id: "gw8", exercise_name: "Deadlift",         sets: 4, reps: 5,  weight_kg: 150 },
  { workout_id: "gw8", exercise_name: "Pull-ups",         sets: 4, reps: 7,  weight_kg: 10 },
  { workout_id: "gw8", exercise_name: "Barbell Row",      sets: 3, reps: 8,  weight_kg: 80 },
  { workout_id: "gw8", exercise_name: "Face Pull",        sets: 3, reps: 15, weight_kg: 25 },
  { workout_id: "gw8", exercise_name: "Hammer Curl",      sets: 3, reps: 12, weight_kg: 16 },

  // gw9 — Legs A
  { workout_id: "gw9", exercise_name: "Back Squat",       sets: 4, reps: 6,  weight_kg: 120 },
  { workout_id: "gw9", exercise_name: "Leg Press",        sets: 3, reps: 10, weight_kg: 200 },
  { workout_id: "gw9", exercise_name: "Romanian DL",      sets: 3, reps: 8,  weight_kg: 100 },
  { workout_id: "gw9", exercise_name: "Walking Lunge",    sets: 3, reps: 12, weight_kg: 24 },
  { workout_id: "gw9", exercise_name: "Leg Curl",         sets: 3, reps: 12, weight_kg: 45 },

  // gw10 — Push Day B (week -3)
  { workout_id: "gw10", exercise_name: "Bench Press",      sets: 4, reps: 8,  weight_kg: 95 },
  { workout_id: "gw10", exercise_name: "Incline DB Press", sets: 3, reps: 10, weight_kg: 34 },
  { workout_id: "gw10", exercise_name: "Overhead Press",   sets: 3, reps: 8,  weight_kg: 57.5 },
  { workout_id: "gw10", exercise_name: "Lateral Raise",    sets: 4, reps: 15, weight_kg: 10 },
  { workout_id: "gw10", exercise_name: "Skull Crusher",    sets: 3, reps: 10, weight_kg: 40 },

  // gw11 — Pull Day
  { workout_id: "gw11", exercise_name: "Deadlift",         sets: 4, reps: 5,  weight_kg: 147.5 },
  { workout_id: "gw11", exercise_name: "Pull-ups",         sets: 4, reps: 7,  weight_kg: 0 },
  { workout_id: "gw11", exercise_name: "Barbell Row",      sets: 3, reps: 8,  weight_kg: 77.5 },
  { workout_id: "gw11", exercise_name: "Face Pull",        sets: 3, reps: 15, weight_kg: 22.5 },
  { workout_id: "gw11", exercise_name: "Hammer Curl",      sets: 3, reps: 12, weight_kg: 16 },

  // gw12 — Legs B (oldest)
  { workout_id: "gw12", exercise_name: "Back Squat",       sets: 4, reps: 6,  weight_kg: 117.5 },
  { workout_id: "gw12", exercise_name: "Leg Press",        sets: 3, reps: 10, weight_kg: 195 },
  { workout_id: "gw12", exercise_name: "Romanian DL",      sets: 3, reps: 8,  weight_kg: 97.5 },
  { workout_id: "gw12", exercise_name: "Walking Lunge",    sets: 3, reps: 12, weight_kg: 22 },
  { workout_id: "gw12", exercise_name: "Calf Raise",       sets: 4, reps: 15, weight_kg: 75 },
];

// ─── Personal Records ─────────────────────────────────────────────────────────
export const GUEST_PRS = [
  { id: "pr1", exercise_name: "Bench Press",      weight_kg: 102.5, reps: 8,  estimated_1rm: 127.5, pr_type: "1rm",    achieved_at: daysAgo(1),  workout_id: "gw1" },
  { id: "pr2", exercise_name: "Deadlift",         weight_kg: 155,   reps: 5,  estimated_1rm: 172.8, pr_type: "1rm",    achieved_at: daysAgo(3),  workout_id: "gw2" },
  { id: "pr3", exercise_name: "Back Squat",       weight_kg: 125,   reps: 6,  estimated_1rm: 150,   pr_type: "1rm",    achieved_at: daysAgo(5),  workout_id: "gw3" },
  { id: "pr4", exercise_name: "Overhead Press",   weight_kg: 62.5,  reps: 8,  estimated_1rm: 79.2,  pr_type: "1rm",    achieved_at: daysAgo(1),  workout_id: "gw1" },
  { id: "pr5", exercise_name: "Barbell Row",      weight_kg: 85,    reps: 8,  estimated_1rm: 107.7, pr_type: "1rm",    achieved_at: daysAgo(3),  workout_id: "gw2" },
  { id: "pr6", exercise_name: "Pull-ups",         weight_kg: 10,    reps: 8,  estimated_1rm: 22.7,  pr_type: "1rm",    achieved_at: daysAgo(3),  workout_id: "gw2" },
  { id: "pr7", exercise_name: "Incline DB Press", weight_kg: 38,    reps: 10, estimated_1rm: 50.7,  pr_type: "1rm",    achieved_at: daysAgo(1),  workout_id: "gw1" },
  { id: "pr8", exercise_name: "Romanian DL",      weight_kg: 105,   reps: 8,  estimated_1rm: 133,   pr_type: "1rm",    achieved_at: daysAgo(5),  workout_id: "gw3" },
  { id: "pr9", exercise_name: "Bench Press",      weight_kg: 102.5, reps: 8,  set_volume: 820,      pr_type: "volume", achieved_at: daysAgo(1),  workout_id: "gw1" },
  { id: "pr10",exercise_name: "Back Squat",       weight_kg: 125,   reps: 6,  set_volume: 750,      pr_type: "volume", achieved_at: daysAgo(5),  workout_id: "gw3" },
  { id: "pr11",exercise_name: "Deadlift",         weight_kg: 155,   reps: 5,  set_volume: 775,      pr_type: "volume", achieved_at: daysAgo(3),  workout_id: "gw2" },
];

// ─── Volume Trend (8 weeks) ───────────────────────────────────────────────────
export const GUEST_VOLUME_TREND = [
  { w: "W1", v: 28400 },
  { w: "W2", v: 31200 },
  { w: "W3", v: 29800 },
  { w: "W4", v: 34600 },
  { w: "W5", v: 33100 },
  { w: "W6", v: 37800 },
  { w: "W7", v: 35400 },
  { w: "W8", v: 40800 },
];

// ─── Guest Profile ────────────────────────────────────────────────────────────
export const GUEST_PROFILE = {
  name: "Alex",
  plan: "pro",
  training_frequency: 3,
  training_goal: "hypertrophy",
  onboarding_complete: true,
};

// ─── Guest AI Coach conversation (read-only, pre-populated) ──────────────────
export const GUEST_AI_MESSAGES = [
  {
    role: "user",
    content: "Rate my training week out of 10. What should I improve?",
    timestamp: daysAgo(2),
  },
  {
    role: "assistant",
    content: `**Training Week Rating: 8.5/10** 🏆

Your week looks really solid! Here's the breakdown:

**What's working well:**
- Consistent Push/Pull/Legs split with good frequency (3 sessions)
- Progressive overload is clear — Bench went from 97.5kg → 102.5kg over the past 2 weeks
- Volume is in a good range: ~31,000kg this week

**Areas to improve:**
1. **Core work** — I don't see any direct ab training. Add cable crunches or hanging leg raises to your pull day.
2. **Rest between sessions** — 48h between Push and Pull is fine, but try to get a full rest day before Legs for maximum output.
3. **Rear delt work** — Face pulls are great, but consider adding a rear delt fly on your pull days to balance the heavy pressing volume.

Overall, you're progressing consistently. Keep it up! 💪`,
    timestamp: daysAgo(2),
  },
  {
    role: "user",
    content: "Is my weekly volume appropriate for hypertrophy?",
    timestamp: daysAgo(2),
  },
  {
    role: "assistant",
    content: `Yes — your volume is well within the hypertrophy sweet spot for most muscle groups.

**Current weekly sets (estimated):**
- Chest: ~13 sets ✅ (target: 10–20)
- Back: ~14 sets ✅ (target: 10–20)
- Legs: ~15 sets ✅ (target: 12–20)
- Shoulders: ~10 sets ✅ (target: 8–16)
- Arms: ~9 sets — slightly low, consider +2 sets of curls 💡

**Recommendation:** You're in a good place. Don't add more — maintain this volume for 4–6 more weeks and focus on progressive overload (adding 2.5kg when you can complete all sets with 1–2 RIR).`,
    timestamp: daysAgo(2),
  },
];

// ─── Guest Nutrition Data ────────────────────────────────────────────────────
export const GUEST_NUTRITION_GOALS = {
  calories: 2650,
  protein_g: 175,
  carbs_g: 300,
  fat_g: 75,
  activity_level: "moderate",
  goal_type: "muscle_gain",
  weight_kg: 82,
  height_cm: 180,
  age: 27,
  sex: "male",
};

export const GUEST_FOOD_LOGS = [
  { id: "fl1", meal_type: "breakfast", food_name: "Greek Yoghurt (0% fat)",  calories: 130, protein_g: 22,  carbs_g: 8,   fat_g: 0.5, amount_g: 200, logged_at: new Date().toISOString() },
  { id: "fl2", meal_type: "breakfast", food_name: "Oats with Banana",        calories: 340, protein_g: 9,   carbs_g: 65,  fat_g: 5,   amount_g: 100, logged_at: new Date().toISOString() },
  { id: "fl3", meal_type: "lunch",     food_name: "Chicken Breast (grilled)", calories: 310, protein_g: 58,  carbs_g: 0,   fat_g: 7,   amount_g: 200, logged_at: new Date().toISOString() },
  { id: "fl4", meal_type: "lunch",     food_name: "Brown Rice",               calories: 215, protein_g: 4.5, carbs_g: 45,  fat_g: 1.5, amount_g: 150, logged_at: new Date().toISOString() },
  { id: "fl5", meal_type: "lunch",     food_name: "Broccoli (steamed)",       calories: 55,  protein_g: 4,   carbs_g: 10,  fat_g: 0.5, amount_g: 150, logged_at: new Date().toISOString() },
  { id: "fl6", meal_type: "snack",     food_name: "Whey Protein Shake",      calories: 130, protein_g: 25,  carbs_g: 5,   fat_g: 2,   amount_g: 35,  logged_at: new Date().toISOString() },
  { id: "fl7", meal_type: "dinner",    food_name: "Salmon Fillet",           calories: 370, protein_g: 40,  carbs_g: 0,   fat_g: 22,  amount_g: 200, logged_at: new Date().toISOString() },
  { id: "fl8", meal_type: "dinner",    food_name: "Sweet Potato",            calories: 180, protein_g: 3,   carbs_g: 42,  fat_g: 0.5, amount_g: 200, logged_at: new Date().toISOString() },
];

export const GUEST_WATER_TOTAL = 2200; // ml

// ─── Mock getWorkoutSets for guest mode ───────────────────────────────────────
export function getGuestWorkoutSets(workoutIds) {
  const ids = new Set(workoutIds);
  return Promise.resolve(GUEST_SETS.filter(s => ids.has(s.workout_id)));
}
