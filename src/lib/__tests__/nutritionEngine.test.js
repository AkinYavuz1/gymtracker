import { describe, it, expect } from "vitest";
import {
  calculateTDEE,
  calculateMacroGoals,
  calculateGoalsFromProfile,
  calculateProteinTiming,
  calculateNetCalories,
  getMacroRatios,
  getCalorieColor,
  getMacroColor,
  parseFoodFromAPI,
  scaleNutrition,
  WATER_PRESETS,
  MEALS,
} from "../nutritionEngine";

describe("calculateTDEE", () => {
  it("calculates TDEE for a male", () => {
    const tdee = calculateTDEE({ weight_kg: 80, height_cm: 180, age: 25, gender: "male", activityLevel: "moderate" });
    // BMR = 10*80 + 6.25*180 - 5*25 + 5 = 800 + 1125 - 125 + 5 = 1805
    // TDEE = 1805 * 1.55 = 2797.75 ≈ 2798
    expect(tdee).toBe(2798);
  });

  it("calculates TDEE for a female", () => {
    const tdee = calculateTDEE({ weight_kg: 60, height_cm: 165, age: 30, gender: "female", activityLevel: "light" });
    // BMR = 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25
    // TDEE = 1320.25 * 1.375 = 1815.34 ≈ 1815
    expect(tdee).toBe(1815);
  });

  it("returns 2000 as fallback for missing data", () => {
    expect(calculateTDEE({})).toBe(2000);
    expect(calculateTDEE({ weight_kg: 80 })).toBe(2000);
  });

  it("defaults to moderate activity", () => {
    const tdee = calculateTDEE({ weight_kg: 80, height_cm: 180, age: 25, gender: "male" });
    expect(tdee).toBe(2798);
  });
});

describe("calculateMacroGoals", () => {
  it("calculates maintenance macros", () => {
    const macros = calculateMacroGoals(2500, "maintain", 80);
    expect(macros.calories).toBe(2500);
    expect(macros.protein_g).toBe(144); // 80 * 1.8
    expect(macros.fat_g).toBe(69); // round(2500 * 0.25 / 9)
    expect(macros.carbs_g).toBeGreaterThan(0);
  });

  it("applies calorie deficit for lose", () => {
    const macros = calculateMacroGoals(2500, "lose", 80);
    expect(macros.calories).toBe(2000); // 2500 - 500
    expect(macros.protein_g).toBe(176); // 80 * 2.2 (higher for cut)
  });

  it("applies calorie surplus for gain", () => {
    const macros = calculateMacroGoals(2500, "gain", 80);
    expect(macros.calories).toBe(2800); // 2500 + 300
    expect(macros.protein_g).toBe(160); // 80 * 2.0
  });

  it("enforces minimum 1200 calories", () => {
    const macros = calculateMacroGoals(1400, "lose", 50);
    expect(macros.calories).toBe(1200);
  });
});

describe("calculateGoalsFromProfile", () => {
  it("combines TDEE and macro calculation", () => {
    const profile = { weight_kg: 80, height_cm: 180, age: 25, gender: "male" };
    const goals = calculateGoalsFromProfile(profile, "moderate", "maintain");
    expect(goals.tdee).toBe(2798);
    expect(goals.calories).toBe(2798);
    expect(goals.protein_g).toBeGreaterThan(0);
    expect(goals.carbs_g).toBeGreaterThan(0);
    expect(goals.fat_g).toBeGreaterThan(0);
  });
});

describe("calculateProteinTiming", () => {
  it("flags optimal protein range (25-45g)", () => {
    const meals = {
      breakfast: { protein_g: 30 },
      lunch: { protein_g: 35 },
      dinner: { protein_g: 40 },
      snack: { protein_g: 10 },
    };
    const result = calculateProteinTiming(meals);
    expect(result[0].optimal).toBe(true); // breakfast
    expect(result[1].optimal).toBe(true); // lunch
    expect(result[2].optimal).toBe(true); // dinner
    expect(result[3].optimal).toBe(false); // snack too low
  });

  it("handles empty meals", () => {
    const result = calculateProteinTiming({});
    expect(result).toHaveLength(4);
    result.forEach(r => expect(r.protein_g).toBe(0));
  });
});

describe("calculateNetCalories", () => {
  it("calculates burn and net", () => {
    const result = calculateNetCalories(2000, 60, 80);
    expect(result.consumed).toBe(2000);
    expect(result.burned).toBeGreaterThan(0);
    expect(result.net).toBe(result.consumed - result.burned);
  });

  it("returns zero burn with no workout", () => {
    const result = calculateNetCalories(2000, 0, 80);
    expect(result.burned).toBe(0);
    expect(result.net).toBe(2000);
  });
});

describe("getMacroRatios", () => {
  it("calculates percentage split", () => {
    const ratios = getMacroRatios(150, 200, 60);
    // protein: 150*4=600, carbs: 200*4=800, fat: 60*9=540 → total 1940
    expect(ratios.protein_pct).toBe(31);
    expect(ratios.carbs_pct).toBe(41);
    expect(ratios.fat_pct).toBe(28);
    expect(ratios.protein_pct + ratios.carbs_pct + ratios.fat_pct).toBeCloseTo(100, 0);
  });

  it("returns 33/34/33 for zero input", () => {
    const ratios = getMacroRatios(0, 0, 0);
    expect(ratios.protein_pct).toBe(33);
  });
});

describe("getCalorieColor", () => {
  it("returns green for on-target", () => {
    expect(getCalorieColor(2000, 2000)).toBe("#3CFFF0");
    expect(getCalorieColor(1950, 2000)).toBe("#3CFFF0");
  });

  it("returns red for over-eating", () => {
    expect(getCalorieColor(2400, 2000)).toBe("#FF6B3C");
  });

  it("returns red for under-eating", () => {
    expect(getCalorieColor(800, 2000)).toBe("#FF6B3C");
  });
});

describe("getMacroColor", () => {
  it("returns correct colors", () => {
    expect(getMacroColor("protein")).toBe("#3CFFF0");
    expect(getMacroColor("carbs")).toBe("#DFFF3C");
    expect(getMacroColor("fat")).toBe("#FF6B3C");
  });
});

describe("parseFoodFromAPI", () => {
  it("parses Open Food Facts product", () => {
    const product = {
      product_name: "Chicken Breast",
      brands: "Generic",
      code: "1234567890",
      nutriments: {
        "energy-kcal_100g": 165,
        proteins_100g: 31,
        carbohydrates_100g: 0,
        fat_100g: 3.6,
        fiber_100g: 0,
        sugars_100g: 0,
        sodium_100g: 0.074,
      },
      serving_quantity: 100,
    };
    const food = parseFoodFromAPI(product);
    expect(food.food_name).toBe("Chicken Breast");
    expect(food.brand).toBe("Generic");
    expect(food.calories).toBe(165);
    expect(food.protein_g).toBe(31);
    expect(food.fat_g).toBe(3.6);
    expect(food.sodium_mg).toBe(74);
    expect(food.per_100g).toBe(true);
  });

  it("returns null for null input", () => {
    expect(parseFoodFromAPI(null)).toBeNull();
  });
});

describe("scaleNutrition", () => {
  it("scales by serving size", () => {
    const food = { calories: 100, protein_g: 10, carbs_g: 20, fat_g: 5, fiber_g: 2, sugar_g: 3, sodium_mg: 50 };
    const scaled = scaleNutrition(food, 200, 1);
    expect(scaled.calories).toBe(200);
    expect(scaled.protein_g).toBe(20);
  });

  it("scales by multiple servings", () => {
    const food = { calories: 100, protein_g: 10, carbs_g: 20, fat_g: 5, fiber_g: 0, sugar_g: 0, sodium_mg: 0 };
    const scaled = scaleNutrition(food, 100, 2);
    expect(scaled.calories).toBe(200);
    expect(scaled.protein_g).toBe(20);
  });
});

describe("constants", () => {
  it("has water presets", () => {
    expect(WATER_PRESETS).toHaveLength(3);
    expect(WATER_PRESETS[0].ml).toBe(250);
  });

  it("has meal config", () => {
    expect(MEALS).toHaveLength(4);
    expect(MEALS.map(m => m.key)).toEqual(["breakfast", "lunch", "dinner", "snack"]);
  });
});
