// ============================================================
// Nutrition Engine — pure calorie/macro logic, no API calls
// ============================================================

// ─── TDEE Calculation (Mifflin-St Jeor) ─────────────────────

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function calculateTDEE({ weight_kg, height_cm, age, gender, activityLevel = "moderate" }) {
  if (!weight_kg || !height_cm || !age) return 2000; // fallback
  // Mifflin-St Jeor
  const bmr = gender === "female"
    ? 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
    : 10 * weight_kg + 6.25 * height_cm - 5 * age + 5;
  return Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel] || 1.55));
}

// ─── Macro Goals ─────────────────────────────────────────────

const GOAL_ADJUSTMENTS = { lose: -500, maintain: 0, gain: 300 };
const PROTEIN_PER_KG = { lose: 2.2, maintain: 1.8, gain: 2.0 };
const FAT_PCT = 0.25;

export function calculateMacroGoals(tdee, goalType = "maintain", weight_kg = 75) {
  const calories = Math.max(1200, tdee + (GOAL_ADJUSTMENTS[goalType] || 0));
  const protein_g = Math.round(weight_kg * (PROTEIN_PER_KG[goalType] || 1.8));
  const fat_g = Math.round((calories * FAT_PCT) / 9);
  const proteinCals = protein_g * 4;
  const fatCals = fat_g * 9;
  const carbs_g = Math.max(50, Math.round((calories - proteinCals - fatCals) / 4));
  return { calories, protein_g, carbs_g, fat_g };
}

// ─── Auto-calculate full goals from profile ──────────────────

export function calculateGoalsFromProfile(profile, activityLevel = "moderate", goalType = "maintain") {
  const tdee = calculateTDEE({
    weight_kg: profile.weight_kg || 75,
    height_cm: profile.height_cm || 175,
    age: profile.age || 25,
    gender: profile.gender || "male",
    activityLevel,
  });
  const macros = calculateMacroGoals(tdee, goalType, profile.weight_kg || 75);
  return { ...macros, tdee };
}

// ─── Protein Timing Analysis ─────────────────────────────────
// Optimal MPS (muscle protein synthesis) = 25-45g protein per meal

export function calculateProteinTiming(mealTotals) {
  const MEALS = ["breakfast", "lunch", "dinner", "snack"];
  return MEALS.map(meal => {
    const protein = mealTotals[meal]?.protein_g || 0;
    const optimal = protein >= 25 && protein <= 45;
    const low = protein > 0 && protein < 25;
    return {
      meal,
      protein_g: Math.round(protein * 10) / 10,
      optimal,
      feedback: protein === 0 ? "No protein logged"
        : low ? `Low — aim for 25-45g (${Math.round(protein)}g)`
        : optimal ? `Optimal (${Math.round(protein)}g)`
        : `High — consider spreading across meals (${Math.round(protein)}g)`,
      color: protein === 0 ? "rgba(255,255,255,0.15)" : low ? "#FF6B3C" : optimal ? "#3CFFF0" : "#DFFF3C",
    };
  });
}

// ─── Net Calories (consumed - workout burn) ──────────────────

export function calculateNetCalories(caloriesConsumed, workoutMinutes = 0, bodyWeightKg = 75) {
  // ~6 MET for resistance training, ~8 MET for vigorous
  const MET = 6;
  const burned = Math.round((MET * 3.5 * bodyWeightKg / 200) * workoutMinutes);
  return {
    consumed: caloriesConsumed,
    burned,
    net: caloriesConsumed - burned,
  };
}

// ─── Macro Ratios ────────────────────────────────────────────

export function getMacroRatios(protein_g, carbs_g, fat_g) {
  const totalCals = protein_g * 4 + carbs_g * 4 + fat_g * 9;
  if (totalCals === 0) return { protein_pct: 33, carbs_pct: 34, fat_pct: 33 };
  return {
    protein_pct: Math.round((protein_g * 4 / totalCals) * 100),
    carbs_pct: Math.round((carbs_g * 4 / totalCals) * 100),
    fat_pct: Math.round((fat_g * 9 / totalCals) * 100),
  };
}

// ─── Progress Colors ─────────────────────────────────────────

export function getCalorieColor(consumed, target) {
  if (!target || target === 0) return "rgba(255,255,255,0.3)";
  const pct = consumed / target;
  if (pct < 0.5) return "#FF6B3C";       // under-eating
  if (pct < 0.9) return "#DFFF3C";       // approaching
  if (pct <= 1.05) return "#3CFFF0";     // on target
  if (pct <= 1.15) return "#DFFF3C";     // slightly over
  return "#FF6B3C";                       // over
}

export function getMacroColor(type) {
  return { protein: "#3CFFF0", carbs: "#DFFF3C", fat: "#FF6B3C" }[type] || "#A78BFA";
}

// ─── Open Food Facts Response Parser ─────────────────────────

export function parseFoodFromAPI(product) {
  if (!product) return null;
  const n = product.nutriments || {};
  return {
    food_name: product.product_name || product.product_name_en || "Unknown",
    brand: product.brands || null,
    barcode: product.code || null,
    serving_size: parseFloat(product.serving_quantity) || 100,
    serving_unit: product.serving_quantity_unit || "g",
    calories: Math.round(n["energy-kcal_100g"] || n["energy-kcal"] || (n["energy_100g"] || 0) / 4.184 || 0),
    protein_g: round1(n.proteins_100g || 0),
    carbs_g: round1(n.carbohydrates_100g || 0),
    fat_g: round1(n.fat_100g || 0),
    fiber_g: round1(n.fiber_100g || 0),
    sugar_g: round1(n.sugars_100g || 0),
    sodium_mg: round1((n.sodium_100g || 0) * 1000),
    off_product_id: product.code || null,
    image_url: product.image_front_small_url || product.image_url || null,
    nutriscore: product.nutriscore_grade || null,
    per_100g: true, // flag: values are per 100g, needs serving conversion
  };
}

function round1(v) { return Math.round(v * 10) / 10; }

// Scale nutrition values by serving
export function scaleNutrition(food, servingGrams, numServings = 1) {
  const factor = (servingGrams / 100) * numServings;
  return {
    calories: Math.round((food.calories || 0) * factor),
    protein_g: round1((food.protein_g || 0) * factor),
    carbs_g: round1((food.carbs_g || 0) * factor),
    fat_g: round1((food.fat_g || 0) * factor),
    fiber_g: round1((food.fiber_g || 0) * factor),
    sugar_g: round1((food.sugar_g || 0) * factor),
    sodium_mg: round1((food.sodium_mg || 0) * factor),
  };
}

// ─── Water Presets ───────────────────────────────────────────

export const WATER_PRESETS = [
  { label: "Glass", ml: 250, icon: "🥛" },
  { label: "Bottle", ml: 500, icon: "🍶" },
  { label: "Large", ml: 750, icon: "🫗" },
];

// ─── Meal Config ─────────────────────────────────────────────

export const MEALS = [
  { key: "breakfast", label: "Breakfast", icon: "🌅", time: "Morning" },
  { key: "lunch", label: "Lunch", icon: "☀️", time: "Midday" },
  { key: "dinner", label: "Dinner", icon: "🌙", time: "Evening" },
  { key: "snack", label: "Snacks", icon: "🍿", time: "Any time" },
];
