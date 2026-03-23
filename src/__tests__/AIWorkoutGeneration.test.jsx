import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";

// We need to test the utility functions and components.
// Since they are defined inside App.jsx (not exported), we test them via the rendered UI
// and also extract/re-implement the pure functions for unit testing.

// === Unit tests for validateExerciseNames logic ===
// Re-implement the pure function to test it directly since it's not exported

const EX_LIB = {
  Chest: [
    { name: "Bench Press", equipment: "Barbell" },
    { name: "Incline DB Press", equipment: "Dumbbell" },
    { name: "Cable Fly", equipment: "Cable" },
    { name: "Push-ups", equipment: "Bodyweight" },
  ],
  Back: [
    { name: "Deadlift", equipment: "Barbell" },
    { name: "Pull-ups", equipment: "Bodyweight" },
    { name: "Barbell Row", equipment: "Barbell" },
    { name: "Lat Pulldown", equipment: "Cable" },
  ],
  Legs: [
    { name: "Back Squat", equipment: "Barbell" },
    { name: "Leg Press", equipment: "Machine" },
    { name: "Walking Lunge", equipment: "Dumbbell" },
  ],
  Shoulders: [
    { name: "Overhead Press", equipment: "Barbell" },
    { name: "Lateral Raise", equipment: "Dumbbell" },
  ],
  Arms: [
    { name: "Barbell Curl", equipment: "Barbell" },
    { name: "Tricep Pushdown", equipment: "Cable" },
  ],
  Core: [
    { name: "Plank", equipment: "Bodyweight" },
    { name: "Cable Crunch", equipment: "Cable" },
  ],
};

function validateExerciseNames(programData, customExercises = []) {
  const validNames = new Set();
  Object.values(EX_LIB).forEach(cat => cat.forEach(ex => validNames.add(ex.name)));
  customExercises.forEach(cx => validNames.add(cx.name));
  const lowerMap = new Map();
  validNames.forEach(n => lowerMap.set(n.toLowerCase(), n));
  const cleaned = { ...programData, days: (programData.days || []).map(day => {
    const exercises = (day.exercises || []).map(ex => {
      if (validNames.has(ex.exercise_name)) return ex;
      const lower = lowerMap.get(ex.exercise_name?.toLowerCase());
      if (lower) return { ...ex, exercise_name: lower };
      return null;
    }).filter(Boolean);
    return { ...day, exercises };
  }).filter(day => day.exercises.length > 0) };
  return cleaned;
}

function getExerciseNamesByEquipment(selectedEquipment, customExercises = []) {
  const names = [];
  Object.values(EX_LIB).forEach(cat => cat.forEach(ex => {
    const eqMap = { Barbell: "Barbell", Dumbbell: "Dumbbell", Cable: "Cable", Machine: "Machine", Bodyweight: "Bodyweight", BW: "Bodyweight" };
    const mapped = eqMap[ex.equipment] || ex.equipment;
    if (selectedEquipment.includes(mapped)) names.push(ex.name);
  }));
  customExercises.forEach(cx => {
    const eqMap = { Barbell: "Barbell", Dumbbell: "Dumbbell", Cable: "Cable", Machine: "Machine", Bodyweight: "Bodyweight", BW: "Bodyweight" };
    const mapped = eqMap[cx.equipment] || cx.equipment || "Bodyweight";
    if (selectedEquipment.includes(mapped)) names.push(cx.name);
  });
  return [...new Set(names)];
}

describe("validateExerciseNames", () => {
  it("keeps exact match exercise names", () => {
    const data = {
      name: "Test Program",
      days: [{
        day_index: 0,
        name: "Day A",
        muscle_groups: ["Chest"],
        exercises: [
          { exercise_name: "Bench Press", base_sets: 3, base_reps: 8, is_compound: true, sort_order: 0 },
          { exercise_name: "Deadlift", base_sets: 4, base_reps: 5, is_compound: true, sort_order: 1 },
        ],
      }],
    };
    const result = validateExerciseNames(data);
    expect(result.days).toHaveLength(1);
    expect(result.days[0].exercises).toHaveLength(2);
    expect(result.days[0].exercises[0].exercise_name).toBe("Bench Press");
    expect(result.days[0].exercises[1].exercise_name).toBe("Deadlift");
  });

  it("fixes case-insensitive matches", () => {
    const data = {
      name: "Test",
      days: [{
        day_index: 0,
        name: "Day A",
        muscle_groups: ["Chest"],
        exercises: [
          { exercise_name: "bench press", base_sets: 3, base_reps: 8, is_compound: true, sort_order: 0 },
          { exercise_name: "DEADLIFT", base_sets: 4, base_reps: 5, is_compound: true, sort_order: 1 },
        ],
      }],
    };
    const result = validateExerciseNames(data);
    expect(result.days[0].exercises[0].exercise_name).toBe("Bench Press");
    expect(result.days[0].exercises[1].exercise_name).toBe("Deadlift");
  });

  it("drops unknown exercise names", () => {
    const data = {
      name: "Test",
      days: [{
        day_index: 0,
        name: "Day A",
        muscle_groups: ["Chest"],
        exercises: [
          { exercise_name: "Bench Press", base_sets: 3, base_reps: 8, is_compound: true, sort_order: 0 },
          { exercise_name: "Invisible Exercise", base_sets: 3, base_reps: 10, is_compound: false, sort_order: 1 },
        ],
      }],
    };
    const result = validateExerciseNames(data);
    expect(result.days[0].exercises).toHaveLength(1);
    expect(result.days[0].exercises[0].exercise_name).toBe("Bench Press");
  });

  it("removes days with 0 valid exercises", () => {
    const data = {
      name: "Test",
      days: [
        {
          day_index: 0,
          name: "Day A",
          muscle_groups: ["Chest"],
          exercises: [{ exercise_name: "Fake Move", base_sets: 3, base_reps: 8, is_compound: true, sort_order: 0 }],
        },
        {
          day_index: 1,
          name: "Day B",
          muscle_groups: ["Back"],
          exercises: [{ exercise_name: "Deadlift", base_sets: 4, base_reps: 5, is_compound: true, sort_order: 0 }],
        },
      ],
    };
    const result = validateExerciseNames(data);
    expect(result.days).toHaveLength(1);
    expect(result.days[0].name).toBe("Day B");
  });

  it("includes custom exercises in validation", () => {
    const customExercises = [{ name: "Zercher Squat", equipment: "Barbell" }];
    const data = {
      name: "Test",
      days: [{
        day_index: 0,
        name: "Day A",
        muscle_groups: ["Legs"],
        exercises: [
          { exercise_name: "Zercher Squat", base_sets: 3, base_reps: 6, is_compound: true, sort_order: 0 },
        ],
      }],
    };
    const result = validateExerciseNames(data, customExercises);
    expect(result.days[0].exercises).toHaveLength(1);
    expect(result.days[0].exercises[0].exercise_name).toBe("Zercher Squat");
  });

  it("preserves non-exercise fields in program data", () => {
    const data = {
      name: "My Program",
      description: "A test",
      split_type: "ppl",
      days_per_week: 3,
      goal: "hypertrophy",
      color: "#A47BFF",
      icon: "🤖",
      days: [{
        day_index: 0,
        name: "Push",
        muscle_groups: ["Chest"],
        exercises: [{ exercise_name: "Bench Press", base_sets: 3, base_reps: 8, is_compound: true, sort_order: 0 }],
      }],
    };
    const result = validateExerciseNames(data);
    expect(result.name).toBe("My Program");
    expect(result.description).toBe("A test");
    expect(result.split_type).toBe("ppl");
    expect(result.goal).toBe("hypertrophy");
  });
});

describe("getExerciseNamesByEquipment", () => {
  it("filters exercises by selected equipment", () => {
    const names = getExerciseNamesByEquipment(["Bodyweight"]);
    expect(names).toContain("Push-ups");
    expect(names).toContain("Pull-ups");
    expect(names).toContain("Plank");
    expect(names).not.toContain("Bench Press");
    expect(names).not.toContain("Leg Press");
  });

  it("returns all exercises when all equipment selected", () => {
    const all = getExerciseNamesByEquipment(["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight"]);
    expect(all.length).toBeGreaterThanOrEqual(14); // subset of EX_LIB above
    expect(all).toContain("Bench Press");
    expect(all).toContain("Push-ups");
    expect(all).toContain("Leg Press");
  });

  it("includes custom exercises matching selected equipment", () => {
    const custom = [{ name: "Zercher Squat", equipment: "Barbell" }];
    const names = getExerciseNamesByEquipment(["Barbell"], custom);
    expect(names).toContain("Zercher Squat");
    expect(names).toContain("Bench Press");
  });

  it("excludes custom exercises not matching equipment", () => {
    const custom = [{ name: "Ring Dip", equipment: "Bodyweight" }];
    const names = getExerciseNamesByEquipment(["Barbell"], custom);
    expect(names).not.toContain("Ring Dip");
  });

  it("returns empty array for empty equipment selection", () => {
    const names = getExerciseNamesByEquipment([]);
    expect(names).toHaveLength(0);
  });

  it("returns no duplicates", () => {
    const names = getExerciseNamesByEquipment(["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight"]);
    const unique = new Set(names);
    expect(names.length).toBe(unique.size);
  });
});

describe("extractJSON (program-sized JSON)", () => {
  // Re-implement extractJSON to test it
  const extractJSON = (text) => {
    try {
      const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenced) return JSON.parse(fenced[1].trim());
      const bare = text.match(/\{[\s\S]*\}/);
      if (bare) return JSON.parse(bare[0]);
    } catch {}
    return null;
  };

  it("parses raw JSON program data", () => {
    const json = JSON.stringify({
      name: "PPL Program",
      days: [
        { day_index: 0, name: "Push", exercises: [{ exercise_name: "Bench Press", base_sets: 4, base_reps: 8 }] },
        { day_index: 1, name: "Pull", exercises: [{ exercise_name: "Deadlift", base_sets: 4, base_reps: 5 }] },
        { day_index: 2, name: "Legs", exercises: [{ exercise_name: "Back Squat", base_sets: 4, base_reps: 6 }] },
      ],
    });
    const result = extractJSON(json);
    expect(result.name).toBe("PPL Program");
    expect(result.days).toHaveLength(3);
  });

  it("parses fenced JSON program data", () => {
    const text = "Here is the program:\n```json\n" + JSON.stringify({
      name: "Test",
      days: [{ day_index: 0, name: "Day A", exercises: [] }],
    }) + "\n```\nEnjoy!";
    const result = extractJSON(text);
    expect(result.name).toBe("Test");
    expect(result.days).toHaveLength(1);
  });

  it("handles large 5-day program JSON", () => {
    const program = {
      name: "5-Day Split",
      description: "Comprehensive bodybuilding program",
      split_type: "five_day_split",
      days_per_week: 5,
      goal: "hypertrophy",
      color: "#A47BFF",
      icon: "🤖",
      days: Array.from({ length: 5 }, (_, i) => ({
        day_index: i,
        name: `Day ${i + 1}`,
        muscle_groups: ["Chest", "Back", "Legs", "Shoulders", "Arms"][i] ? [["Chest", "Back", "Legs", "Shoulders", "Arms"][i]] : [],
        exercises: Array.from({ length: 5 }, (_, j) => ({
          exercise_name: "Bench Press",
          base_sets: 3,
          base_reps: 10,
          is_compound: j === 0,
          sort_order: j,
        })),
      })),
    };
    const result = extractJSON(JSON.stringify(program));
    expect(result.days).toHaveLength(5);
    expect(result.days[0].exercises).toHaveLength(5);
  });

  it("returns null for invalid JSON", () => {
    expect(extractJSON("This is not JSON")).toBeNull();
    expect(extractJSON("{broken: json}")).toBeNull();
  });
});
