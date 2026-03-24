import { useState, useEffect, useRef, Component } from "react";
import { signUp, signIn, signInWithGoogle, signOut, resetPassword, updatePassword, getSession, getProfile, updateProfile, seedDummyData, callCoachAPI, getWorkouts, getWorkoutSets, getPersonalRecords, getTemplates, getVolumeTrend, supabase, getPrograms, getActiveEnrollment, enrollInProgram, abandonProgram, getScheduledWorkouts, updateScheduledWorkout, generateSchedule, savePumpRating, saveDifficultyRating, applyDifficultyToFutureWorkouts, reduceSetsFutureWorkouts, saveSorenessRatings, getRecentFeedback, saveProgressCheckin, getProgressCheckins, applyCoachDiffToSchedule, createUserProgram, deleteUserProgram, deleteWorkout, getVolumeStandards, logPRShare, deleteUserAccount, createCheckoutSession, saveReadinessScore, getReadinessScore, importWorkouts, getCustomExercises, createCustomExercise, updateCustomExercise, deleteCustomExercise, logLoginEvent, logPageEvent } from "./lib/supabase";
import { detectFormat, parseCSV } from "./lib/importParser";
import { calculateReadinessScore } from "./lib/readinessScore";
import { isHealthAvailable, requestHealthPermissions, fetchSleepData, fetchHRVData } from "./lib/healthData";
import { calculatePrescription, generatePrescriptions, WEEK_CONFIG, isDeloadWeek, getWeekLabel, recommendPrograms, getMuscleGroup, getVolumeZoneLabel, getVolumeZoneColor, getExercisesForMuscle } from "./lib/programEngine";
import { queueWorkout, syncPendingWorkouts, getPendingCount } from "./lib/offlineStorage";
import { getExerciseGif } from "./lib/exerciseGifs";
import ExerciseAnimation from "./lib/exerciseAnimations";
import { getAnimalComparison, getAnimalStyle } from "./lib/animalWeights";
import { registerServiceWorker, getNotificationPermission, checkNativePermission, requestNotificationPermission, subscribeToPush, unsubscribeFromPush, getCurrentSubscription, getNotificationPreferences, updateNotificationPreferences } from "./lib/notifications";
import { Capacitor } from "@capacitor/core";

/* ═══ API CONFIG ═══ */
const PLANS = {
  free:      { name: "Free",      price: "$0",     queries: 5,   color: "rgba(255,255,255,0.4)", badge: "FREE" },
  pro:       { name: "Pro",       price: "$4.99",  queries: 30,  color: "#DFFF3C", badge: "PRO" },
  unlimited: { name: "Unlimited", price: "$9.99",  queries: 999, color: "#A47BFF", badge: "MAX" },
};

const AI_CONFIG = { model: "claude-haiku-4-5-20251001", maxTokens: 600 };

/* ═══ DATA ═══ */
const TEMPLATES = [
  { id: "push", label: "Push", color: "#DFFF3C", icon: "💪", exercises: [{ name: "Bench Press", lastWeight: 100, lastReps: 8, sets: 4, equipment: "Barbell" }, { name: "Incline DB Press", lastWeight: 36, lastReps: 10, sets: 3, equipment: "Dumbbell" }, { name: "Cable Fly", lastWeight: 20, lastReps: 12, sets: 3, equipment: "Cable" }, { name: "Overhead Press", lastWeight: 60, lastReps: 8, sets: 3, equipment: "Barbell" }, { name: "Lateral Raise", lastWeight: 12, lastReps: 15, sets: 3, equipment: "Dumbbell" }] },
  { id: "pull", label: "Pull", color: "#3CFFF0", icon: "🔄", exercises: [{ name: "Deadlift", lastWeight: 140, lastReps: 5, sets: 4, equipment: "Barbell" }, { name: "Pull-ups", lastWeight: 0, lastReps: 8, sets: 4, equipment: "BW" }, { name: "Barbell Row", lastWeight: 80, lastReps: 8, sets: 3, equipment: "Barbell" }, { name: "Face Pull", lastWeight: 25, lastReps: 15, sets: 3, equipment: "Cable" }, { name: "Hammer Curl", lastWeight: 16, lastReps: 12, sets: 3, equipment: "Dumbbell" }] },
  { id: "legs", label: "Legs", color: "#FF6B3C", icon: "🦵", exercises: [{ name: "Back Squat", lastWeight: 120, lastReps: 6, sets: 4, equipment: "Barbell" }, { name: "Leg Press", lastWeight: 200, lastReps: 10, sets: 3, equipment: "Machine" }, { name: "Romanian DL", lastWeight: 100, lastReps: 8, sets: 3, equipment: "Barbell" }, { name: "Walking Lunge", lastWeight: 24, lastReps: 12, sets: 3, equipment: "Dumbbell" }, { name: "Leg Curl", lastWeight: 45, lastReps: 12, sets: 3, equipment: "Machine" }] },
  { id: "upper", label: "Upper", color: "#B47CFF", icon: "⚡", exercises: [{ name: "Bench Press", lastWeight: 100, lastReps: 8, sets: 3, equipment: "Barbell" }, { name: "Barbell Row", lastWeight: 80, lastReps: 8, sets: 3, equipment: "Barbell" }, { name: "Overhead Press", lastWeight: 60, lastReps: 8, sets: 3, equipment: "Barbell" }, { name: "Pull-ups", lastWeight: 0, lastReps: 8, sets: 3, equipment: "BW" }, { name: "Lateral Raise", lastWeight: 12, lastReps: 15, sets: 3, equipment: "Dumbbell" }] },
];
const EX_LIB = {
  Chest: [
    { name: "Bench Press", equipment: "Barbell", icon: "🏋️", muscleGroup: "Chest", difficulty: "Intermediate" },
    { name: "Incline DB Press", equipment: "Dumbbell", icon: "📐", muscleGroup: "Chest", difficulty: "Intermediate" },
    { name: "Cable Fly", equipment: "Cable", icon: "🔄", muscleGroup: "Chest", difficulty: "Beginner" },
    { name: "Chest Dip", equipment: "Bodyweight", icon: "⬇️", muscleGroup: "Chest", difficulty: "Intermediate" },
    { name: "Machine Press", equipment: "Machine", icon: "🖥️", muscleGroup: "Chest", difficulty: "Beginner" },
    { name: "Push-ups", equipment: "Bodyweight", icon: "👐", muscleGroup: "Chest", difficulty: "Beginner" },
    { name: "Dumbbell Fly", equipment: "Dumbbell", icon: "🦋", muscleGroup: "Chest", difficulty: "Beginner" },
  ],
  Back: [
    { name: "Deadlift", equipment: "Barbell", icon: "🔥", muscleGroup: "Back", difficulty: "Advanced" },
    { name: "Pull-ups", equipment: "Bodyweight", icon: "⬆️", muscleGroup: "Back", difficulty: "Intermediate" },
    { name: "Barbell Row", equipment: "Barbell", icon: "🏋️", muscleGroup: "Back", difficulty: "Intermediate" },
    { name: "Lat Pulldown", equipment: "Cable", icon: "⬇️", muscleGroup: "Back", difficulty: "Beginner" },
    { name: "Cable Row", equipment: "Cable", icon: "🔄", muscleGroup: "Back", difficulty: "Beginner" },
    { name: "T-Bar Row", equipment: "Barbell", icon: "🅃", muscleGroup: "Back", difficulty: "Intermediate" },
    { name: "Dumbbell Row", equipment: "Dumbbell", icon: "💪", muscleGroup: "Back", difficulty: "Beginner" },
  ],
  Legs: [
    { name: "Back Squat", equipment: "Barbell", icon: "🦵", muscleGroup: "Legs", difficulty: "Intermediate" },
    { name: "Leg Press", equipment: "Machine", icon: "🖥️", muscleGroup: "Legs", difficulty: "Beginner" },
    { name: "Romanian DL", equipment: "Barbell", icon: "🔥", muscleGroup: "Legs", difficulty: "Intermediate" },
    { name: "Walking Lunge", equipment: "Dumbbell", icon: "🚶", muscleGroup: "Legs", difficulty: "Beginner" },
    { name: "Leg Curl", equipment: "Machine", icon: "🔄", muscleGroup: "Legs", difficulty: "Beginner" },
    { name: "Leg Extension", equipment: "Machine", icon: "🦿", muscleGroup: "Legs", difficulty: "Beginner" },
    { name: "Hip Thrust", equipment: "Barbell", icon: "🍑", muscleGroup: "Legs", difficulty: "Intermediate" },
    { name: "Bulgarian Split Squat", equipment: "Dumbbell", icon: "🦵", muscleGroup: "Legs", difficulty: "Advanced" },
    { name: "Calf Raise", equipment: "Machine", icon: "⬆️", muscleGroup: "Legs", difficulty: "Beginner" },
  ],
  Shoulders: [
    { name: "Overhead Press", equipment: "Barbell", icon: "⬆️", muscleGroup: "Shoulders", difficulty: "Intermediate" },
    { name: "Lateral Raise", equipment: "Dumbbell", icon: "↔️", muscleGroup: "Shoulders", difficulty: "Beginner" },
    { name: "Face Pull", equipment: "Cable", icon: "🔄", muscleGroup: "Shoulders", difficulty: "Beginner" },
    { name: "Arnold Press", equipment: "Dumbbell", icon: "💪", muscleGroup: "Shoulders", difficulty: "Intermediate" },
    { name: "Front Raise", equipment: "Dumbbell", icon: "⬆️", muscleGroup: "Shoulders", difficulty: "Beginner" },
  ],
  Arms: [
    { name: "Barbell Curl", equipment: "Barbell", icon: "💪", muscleGroup: "Arms", difficulty: "Beginner" },
    { name: "Hammer Curl", equipment: "Dumbbell", icon: "🔨", muscleGroup: "Arms", difficulty: "Beginner" },
    { name: "Tricep Pushdown", equipment: "Cable", icon: "⬇️", muscleGroup: "Arms", difficulty: "Beginner" },
    { name: "Skull Crusher", equipment: "Barbell", icon: "💀", muscleGroup: "Arms", difficulty: "Intermediate" },
    { name: "Cable Curl", equipment: "Cable", icon: "🔄", muscleGroup: "Arms", difficulty: "Beginner" },
    { name: "Overhead Tricep Ext", equipment: "Dumbbell", icon: "⬆️", muscleGroup: "Arms", difficulty: "Beginner" },
    { name: "Preacher Curl", equipment: "Barbell", icon: "🙏", muscleGroup: "Arms", difficulty: "Beginner" },
  ],
  Core: [
    { name: "Plank", equipment: "Bodyweight", icon: "🧱", muscleGroup: "Core", difficulty: "Beginner" },
    { name: "Cable Crunch", equipment: "Cable", icon: "🎯", muscleGroup: "Core", difficulty: "Intermediate" },
    { name: "Hanging Leg Raise", equipment: "Bodyweight", icon: "⬆️", muscleGroup: "Core", difficulty: "Intermediate" },
    { name: "Ab Wheel Rollout", equipment: "Bodyweight", icon: "⚙️", muscleGroup: "Core", difficulty: "Advanced" },
    { name: "Russian Twist", equipment: "Bodyweight", icon: "🔄", muscleGroup: "Core", difficulty: "Beginner" },
    { name: "Decline Sit-up", equipment: "Bodyweight", icon: "⬇️", muscleGroup: "Core", difficulty: "Beginner" },
  ],
};
const HISTORY = [{ title: "Push Day", date: "Mar 7", duration: "65 min", volume: "14,100 kg", color: "#DFFF3C", exercises: 5 }, { title: "Legs", date: "Mar 6", duration: "71 min", volume: "18,200 kg", color: "#FF6B3C", exercises: 5 }, { title: "Pull Day", date: "Mar 4", duration: "58 min", volume: "10,880 kg", color: "#3CFFF0", exercises: 5 }, { title: "Push Day", date: "Mar 3", duration: "62 min", volume: "12,450 kg", color: "#DFFF3C", exercises: 5 }, { title: "Legs", date: "Mar 1", duration: "68 min", volume: "17,300 kg", color: "#FF6B3C", exercises: 5 }];
const CHART = [{ w: "W1", v: 42 }, { w: "W2", v: 48 }, { w: "W3", v: 44 }, { w: "W4", v: 51 }, { w: "W5", v: 47 }, { w: "W6", v: 53 }, { w: "W7", v: 50 }, { w: "W8", v: 56 }];
const PRS = [{ name: "Bench Press", weight: "120 kg", trend: "+5" }, { name: "Back Squat", weight: "180 kg", trend: "+10" }, { name: "Deadlift", weight: "200 kg", trend: "+5" }];

const AI_PROMPTS = {
  Analyze: [{ label: "Rate my week", icon: "📊", prompt: "Rate my training week out of 10. What should I improve?" }, { label: "Volume check", icon: "📈", prompt: "Is my weekly volume appropriate? Any muscle groups over/undertrained?" }, { label: "Recovery", icon: "😴", prompt: "How recovered am I? Should I rest today?" }],
  Improve: [{ label: "Fix weak points", icon: "🎯", prompt: "What are my weak points? Give specific exercises to fix them." }, { label: "Break plateau", icon: "🚀", prompt: "My bench stalled. Give me a 3-week breakthrough plan." }, { label: "Optimize split", icon: "🔧", prompt: "Is my PPL split optimal? Suggest improvements." }],
  Plan: [{ label: "Next workout", icon: "📋", prompt: "Plan my next workout with exercises, sets, reps, and weights." }, { label: "Deload week", icon: "🧘", prompt: "Design a deload week based on my current loads." }, { label: "New program", icon: "🗓️", prompt: "Create a 4-week program based on my strength levels." }],
  Learn: [{ label: "Form tips", icon: "🎓", prompt: "Top 3 form cues for my compound lifts." }, { label: "Nutrition", icon: "🥗", prompt: "Nutrition advice for my training volume and muscle growth." }, { label: "Science", icon: "🔬", prompt: "Is my approach evidence-based? What does science say?" }],
  Generate: [{ label: "Quick workout", icon: "⚡", prompt: "__GENERATE_WORKOUT__" }, { label: "Full program", icon: "🗓️", prompt: "__GENERATE_PROGRAM__" }],
};

/* ═══ THEME ═══ */
const THEMES = {
  aurora: {
    accent: "#A78BFA", accent2: "#F472B6", bg: "#0E0F14",
    ai: "#A47BFF", card: "#1A1C24", border: "rgba(255,255,255,0.08)",
    dim: "#A1A1AA", font: "'Outfit', sans-serif", mono: "'JetBrains Mono', monospace",
  },
  galaxy: {
    accent: "#6C63FF", accent2: "#A78BFA", bg: "#12102A",
    ai: "#A47BFF", card: "#1E1B3A", border: "rgba(255,255,255,0.10)",
    dim: "#9B98C4", font: "'Outfit', sans-serif", mono: "'JetBrains Mono', monospace",
  },
  neon: {
    accent: "#DFFF3C", accent2: "#3CFFF0", bg: "#08080A",
    ai: "#A47BFF", card: "rgba(255,255,255,0.035)", border: "rgba(255,255,255,0.055)",
    dim: "rgba(255,255,255,0.3)", font: "'Outfit', sans-serif", mono: "'JetBrains Mono', monospace",
  },
};
const C = { ...THEMES.aurora };
const ICONS = {
  emoji: {
    home: "⌂", program: "📋", coach: "🧠", history: "☰", stats: "◈",
    push: "💪", pull: "🔄", legs: "🦵", upper: "⚡",
    fat_loss: "🔥", muscle_gain: "💪", maintenance: "⚖️", performance: "🏆",
    beginner: "🌱", intermediate: "🔥", advanced: "🏆",
    chest: "🫁", back: "🔙", legsM: "🦵", shoulders: "🤷", arms: "💪", core: "🎯",
    warning: "⚠️", trendUp: "📈", trendDown: "📉", tip: "💡", trophy: "🏆",
    target: "🎯", rocket: "🚀", wrench: "🔧", book: "🎓", food: "🥗", science: "🔬",
    sleep: "😴", calendar: "📅", calendarAlt: "📅", calendarW: "📆",
    brain: "🧠", fire: "🔥", chart: "📊",
    barbell: "🏋️",
    ratingScale: ["😊", "😐", "😣", "😖", "🤕"],
    pumpScale: ["😐", "🙂", "😊", "😄", "💪", "🔥", "🔥", "💥", "🤯", "🏆"],
    difficultyScale: ["😴", "🥱", "😌", "🙂", "😤", "💪", "🔥", "🥵", "💀", "☠️"],
    strength: "💪", intensity: "🔥", star: "⭐", check: "✓",
  },
  minimal: {
    home: "⌂", program: "≡", coach: "◉", history: "☰", stats: "◫",
    push: "↑", pull: "↓", legs: "▽", upper: "◇",
    fat_loss: "▲", muscle_gain: "↑", maintenance: "◎", performance: "★",
    beginner: "·", intermediate: "▲", advanced: "★",
    chest: "◻", back: "◼", legsM: "▽", shoulders: "△", arms: "↑", core: "◉",
    warning: "!", trendUp: "↑", trendDown: "↓", tip: "›", trophy: "★",
    target: "◎", rocket: "↑", wrench: "⊙", book: "≡", food: "◦", science: "◈",
    sleep: "◌", calendar: "▫", calendarAlt: "▫", calendarW: "▫",
    brain: "◉", fire: "▲", chart: "≡",
    barbell: "↑",
    ratingScale: ["○○○○○", "●○○○○", "●●○○○", "●●●○○", "●●●●●"],
    pumpScale:   ["○", "○○", "○○○", "○○○○", "●", "●●", "●●●", "●●●●", "●●●●●", "★"],
    difficultyScale: ["○", "○○", "▲", "▲▲", "●", "●●", "●●●", "▲▲▲", "■", "★"],
    strength: "↑", intensity: "▲", star: "★", check: "✓",
  },
};
let I = ICONS.emoji; // updated at render time from GAIns

// === SECTION: Shared Components ===
/* ═══ COMPONENTS ═══ */
function MiniChart({ data, color = C.accent, h = 48 }) {
  if (!data || data.length === 0) return null;
  if (data.length === 1) {
    return (<svg viewBox="0 0 100 100" style={{ width: "100%", height: h }} preserveAspectRatio="none"><line x1="0" y1="50" x2="100" y2="50" stroke={color} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" /><circle cx="50" cy="50" r="4" fill={color} vectorEffect="non-scaling-stroke" /></svg>);
  }
  const max = Math.max(...data.map(d => d.v)), min = Math.min(...data.map(d => d.v)), rng = max - min || 1, s = 100 / (data.length - 1);
  const pts = data.map((d, i) => `${i * s},${100 - ((d.v - min) / rng) * 75 - 12}`).join(" ");
  return (<svg viewBox="0 0 100 100" style={{ width: "100%", height: h }} preserveAspectRatio="none"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".25" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs><polygon points={`${pts} ${(data.length - 1) * s},100 0,100`} fill="url(#cg)" /><polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /><circle cx={(data.length - 1) * s} cy={100 - ((data[data.length - 1].v - min) / rng) * 75 - 12} r="4" fill={color} vectorEffect="non-scaling-stroke" /></svg>);
}
function Pill({ children, active, color, onClick, style = {} }) {
  return (<button onClick={onClick} style={{ padding: "8px 16px", borderRadius: 12, border: active ? `1.5px solid ${color || C.accent}` : `1px solid ${C.border}`, background: active ? `${color || C.accent}15` : C.card, color: active ? (color || C.accent) : "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 600, fontFamily: C.font, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s ease", ...style }}>{children}</button>);
}
function WeightStepper({ value, onChange, color = C.accent }) {
  return (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}><div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>Weight (kg)</div><div style={{ display: "flex", alignItems: "center", gap: 12 }}><button onClick={() => onChange(Math.max(0, value - 2.5))} style={{ width: 48, height: 48, borderRadius: 14, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 22, fontWeight: 300, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button><div style={{ fontSize: 38, fontWeight: 800, color: "#fff", fontFamily: C.font, minWidth: 80, textAlign: "center", lineHeight: 1 }}>{value}<span style={{ fontSize: 14, color: C.dim, marginLeft: 2 }}>kg</span></div><button onClick={() => onChange(value + 2.5)} style={{ width: 48, height: 48, borderRadius: 14, border: `1px solid ${color}40`, background: `${color}12`, color, fontSize: 22, fontWeight: 300, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button></div><div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>{[25, 10, 5, 2.5].map(j => (<button key={-j} onClick={() => onChange(Math.max(0, value - j))} style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: "rgba(255,80,80,0.6)", fontSize: 11, fontFamily: C.mono, cursor: "pointer" }}>−{j}</button>))}{[2.5, 5, 10, 25].map(j => (<button key={j} onClick={() => onChange(value + j)} style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: C.mono, cursor: "pointer" }}>+{j}</button>))}</div></div>);
}
function RepBubbles({ value, onChange, color = C.accent }) {
  return (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}><div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>Reps</div><div style={{ display: "flex", alignItems: "center", gap: 12 }}><button onClick={() => onChange(Math.max(1, value - 1))} style={{ width: 48, height: 48, borderRadius: 14, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 22, fontWeight: 300, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button><div style={{ fontSize: 38, fontWeight: 800, color: "#fff", fontFamily: C.font, minWidth: 60, textAlign: "center", lineHeight: 1 }}>{value}</div><button onClick={() => onChange(value + 1)} style={{ width: 48, height: 48, borderRadius: 14, border: `1px solid ${color}40`, background: `${color}12`, color, fontSize: 22, fontWeight: 300, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button></div><div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>{[1, 2, 3, 4, 5, 6, 10, 15].map(n => (<button key={n} onClick={() => onChange(n)} style={{ padding: "6px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 700, fontFamily: C.font, cursor: "pointer" }}>{n}</button>))}</div></div>);
}

function RIRSlider({ value, onChange, prescribed, color = C.accent, isPro = true, onShowPricing }) {
  const labels = ["Failure", "1 left", "2 left", "3 left", "4 left", "Easy"];
  if (!isPro) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>Reps in Reserve</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[0,1,2,3,4,5].map(n => (
            <div key={n} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.15)", fontFamily: C.font, opacity: 0.5 }}>{n}</div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.dim, textAlign: "center", maxWidth: 260, lineHeight: 1.4 }}>
          🔒 <button onClick={onShowPricing} style={{ background: "none", border: "none", color: C.ai, cursor: "pointer", fontSize: 11, padding: 0, textDecoration: "underline" }}>Upgrade to Pro</button> — logging effort lets your coach fine-tune weights based on how each set actually felt.
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>Reps in Reserve{prescribed != null ? ` (target: ${prescribed})` : ""}</div>
      <div style={{ display: "flex", gap: 8 }}>
        {[0,1,2,3,4,5].map(n => {
          const active = value === n;
          return (
            <button key={n} onClick={() => onChange(active ? null : n)} style={{ width: 36, height: 36, borderRadius: 10, border: active ? `1.5px solid ${color}` : `1px solid ${C.border}`, background: active ? `${color}20` : "rgba(255,255,255,0.02)", color: active ? color : "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: 700, fontFamily: C.font, cursor: "pointer" }}>{n}</button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono }}>
        {value == null ? "Optional — tap to log effort" : value === 0 ? "To failure" : `${value} rep${value !== 1 ? "s" : ""} left in the tank`}
      </div>
    </div>
  );
}

// Map plan IDs to Stripe price IDs (set in .env.local)
const STRIPE_PRICE_IDS = {
  pro:       import.meta.env.VITE_STRIPE_PRO_PRICE_ID || "",
  unlimited: import.meta.env.VITE_STRIPE_UNLIMITED_PRICE_ID || "",
};

// === SECTION: Pricing ===
/* ═══ PRICING SCREEN ═══ */
function PricingScreen({ currentPlan, onSelect, onBack }) {
  const [selected, setSelected] = useState(currentPlan);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const plans = [
    { id: "free", name: "Free", price: "$0", period: "forever", queries: "5/day", features: ["Workout tracking", "Exercise library", "Basic stats", "5 AI queries/day"], color: "#888", popular: false },
    { id: "pro", name: "Pro", price: "$4.99", period: "/month", queries: "30/day", features: ["Everything in Free", "30 AI queries/day", "Advanced analytics", "Export your data", "Priority support"], color: "#DFFF3C", popular: true },
    { id: "unlimited", name: "Unlimited", price: "$9.99", period: "/month", queries: "Unlimited", features: ["Everything in Pro", "Unlimited AI queries", "Custom templates", "Workout insights", "Early access features"], color: "#A47BFF", popular: false },
  ];

  const handleUpgrade = async (planId) => {
    if (planId === "free") { onSelect("free"); return; }
    const priceId = STRIPE_PRICE_IDS[planId];
    if (!priceId) {
      setCheckoutError("Stripe price not configured. Add VITE_STRIPE_PRO_PRICE_ID / VITE_STRIPE_UNLIMITED_PRICE_ID to .env.local.");
      return;
    }
    setCheckoutLoading(true);
    setCheckoutError("");
    try {
      const { url } = await createCheckoutSession(priceId);
      // Open checkout in native browser (Capacitor) or same tab (web)
      if (Capacitor.isNativePlatform()) {
        try {
          const { Browser } = await import("@capacitor/browser");
          await Browser.open({ url });
        } catch {
          window.location.href = url;
        }
      } else {
        window.location.href = url;
      }
    } catch (e) {
      setCheckoutError(e.message || "Failed to start checkout");
    }
    setCheckoutLoading(false);
  };

  return (
    <div style={{ padding: "0 20px 110px" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "14px 0 6px" }}>
        <button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, color: "#fff", borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: C.font }}>← Back</button>
      </div>
      <div style={{ textAlign: "center", padding: "16px 0 24px" }}>
        <div style={{ fontSize: 10, color: C.ai, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Upgrade your training</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: C.font }}>Choose Your Plan</div>
        <div style={{ fontSize: 13, color: C.dim, marginTop: 6 }}>Unlock the full power of AI coaching</div>
      </div>

      {plans.map((p, i) => {
        const isActive = currentPlan === p.id;
        const isSel = selected === p.id;
        return (
          <button key={p.id} onClick={() => setSelected(p.id)} style={{
            width: "100%", padding: "20px 18px", borderRadius: 20, marginBottom: 10, cursor: "pointer", textAlign: "left",
            border: isSel ? `2px solid ${p.color}` : `1px solid ${C.border}`,
            background: isSel ? `${p.color}0A` : C.card, position: "relative", overflow: "hidden",
          }}>
            {p.popular && (
              <div style={{ position: "absolute", top: 12, right: 12, padding: "3px 10px", borderRadius: 8, background: p.color, fontSize: 9, fontWeight: 800, color: C.bg, fontFamily: C.mono, letterSpacing: 1 }}>POPULAR</div>
            )}
            {isActive && (
              <div style={{ position: "absolute", top: 12, right: 12, padding: "3px 10px", borderRadius: 8, background: "rgba(255,255,255,0.1)", fontSize: 9, fontWeight: 800, color: "#fff", fontFamily: C.mono, letterSpacing: 1 }}>CURRENT</div>
            )}
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: isSel ? p.color : "#fff", fontFamily: C.font }}>{p.price}</span>
              <span style={{ fontSize: 13, color: C.dim }}>{p.period}</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", fontFamily: C.font, marginBottom: 4 }}>{p.name}</div>
            <div style={{ fontSize: 12, color: isSel ? p.color : C.dim, fontFamily: C.mono, fontWeight: 600, marginBottom: 12 }}>{p.queries} AI queries</div>
            {p.features.map((f, j) => (
              <div key={j} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <div style={{ width: 16, height: 16, borderRadius: 5, background: `${p.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: p.color, flexShrink: 0 }}>✓</div>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{f}</span>
              </div>
            ))}
          </button>
        );
      })}

      {selected !== currentPlan && (
        <button onClick={() => handleUpgrade(selected)} disabled={checkoutLoading} style={{
          width: "100%", padding: "16px", borderRadius: 16, border: "none", marginTop: 8,
          background: checkoutLoading ? "rgba(255,255,255,0.1)" : `linear-gradient(135deg, ${PLANS[selected].color}, ${PLANS[selected].color}CC)`,
          color: checkoutLoading ? C.dim : C.bg, fontSize: 16, fontWeight: 800, cursor: checkoutLoading ? "wait" : "pointer", fontFamily: C.font,
        }}>
          {checkoutLoading ? "Opening checkout..." : selected === "free" ? "Downgrade to Free" : `Upgrade to ${PLANS[selected].name}`}
        </button>
      )}

      {checkoutError && (
        <div style={{ color: "#FF6B3C", fontSize: 12, fontFamily: C.font, marginTop: 10, textAlign: "center" }}>{checkoutError}</div>
      )}

      <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
        Cancel anytime · Powered by Stripe
      </div>
    </div>
  );
}

// === SECTION: AI Coach ===
/* ═══ AI COACH ═══ */

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
  const eqMap = { Barbell: "Barbell", Dumbbell: "Dumbbell", Cable: "Cable", Machine: "Machine", Bodyweight: "Bodyweight", BW: "Bodyweight" };
  const names = [];
  Object.values(EX_LIB).forEach(cat => cat.forEach(ex => {
    const mapped = eqMap[ex.equipment] || ex.equipment;
    if (selectedEquipment.includes(mapped)) names.push(ex.name);
  }));
  customExercises.forEach(cx => {
    const mapped = eqMap[cx.equipment] || cx.equipment || "Bodyweight";
    if (selectedEquipment.includes(mapped)) names.push(cx.name);
  });
  return [...new Set(names)];
}

function GenerateWizard({ mode, onGenerate, onCancel, profile }) {
  const [goal, setGoal] = useState(profile?.training_goal || "hypertrophy");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [equipment, setEquipment] = useState(["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight"]);
  const [focus, setFocus] = useState([]);
  const [duration, setDuration] = useState(60);
  const [split, setSplit] = useState("auto");

  const goals = ["hypertrophy", "strength", "endurance", "general"];
  const equipmentOpts = ["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight"];
  const focusOpts = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core"];
  const durations = [30, 45, 60, 90];
  const splits = ["auto", "ppl", "upper_lower", "full_body"];
  const splitLabels = { auto: "Auto", ppl: "PPL", upper_lower: "Upper/Lower", full_body: "Full Body" };

  const toggleList = (list, setList, val) => setList(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: C.font }}>{mode === "program" ? "Generate Program" : "Generate Workout"}</div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>AI will create a structured {mode === "program" ? "multi-day program" : "single workout"} for you</div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Goal</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {goals.map(g => <Pill key={g} active={goal === g} color={C.ai} onClick={() => setGoal(g)} style={{ fontSize: 12, padding: "7px 14px", textTransform: "capitalize" }}>{g}</Pill>)}
        </div>
      </div>

      {mode === "program" && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Days per week</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setDaysPerWeek(Math.max(2, daysPerWeek - 1))} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: C.font, minWidth: 30, textAlign: "center" }}>{daysPerWeek}</div>
            <button onClick={() => setDaysPerWeek(Math.min(6, daysPerWeek + 1))} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.ai}40`, background: `${C.ai}12`, color: C.ai, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Equipment</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {equipmentOpts.map(e => <Pill key={e} active={equipment.includes(e)} color={C.ai} onClick={() => toggleList(equipment, setEquipment, e)} style={{ fontSize: 12, padding: "7px 14px" }}>{e}</Pill>)}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Focus areas <span style={{ opacity: 0.5 }}>(optional)</span></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {focusOpts.map(f => <Pill key={f} active={focus.includes(f)} color={C.ai} onClick={() => toggleList(focus, setFocus, f)} style={{ fontSize: 12, padding: "7px 14px" }}>{f}</Pill>)}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Session duration</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {durations.map(d => <Pill key={d} active={duration === d} color={C.ai} onClick={() => setDuration(d)} style={{ fontSize: 12, padding: "7px 14px" }}>{d} min</Pill>)}
        </div>
      </div>

      {mode === "program" && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Split preference</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {splits.map(s => <Pill key={s} active={split === s} color={C.ai} onClick={() => setSplit(s)} style={{ fontSize: 12, padding: "7px 14px" }}>{splitLabels[s]}</Pill>)}
          </div>
        </div>
      )}

      <button onClick={() => onGenerate({ goal, daysPerWeek: mode === "program" ? daysPerWeek : 1, equipment, focus, duration, split: mode === "program" ? split : "full_body", mode })} disabled={equipment.length === 0} style={{
        width: "100%", padding: "14px", borderRadius: 14, border: "none", marginTop: 8,
        background: equipment.length === 0 ? "rgba(255,255,255,0.06)" : `linear-gradient(135deg, ${C.ai}, #7B4CFF)`,
        color: equipment.length === 0 ? C.dim : "#fff", fontSize: 15, fontWeight: 800, cursor: equipment.length === 0 ? "not-allowed" : "pointer", fontFamily: C.font,
      }}>Generate {mode === "program" ? "Program" : "Workout"}</button>
      <button onClick={onCancel} style={{ width: "100%", padding: "10px", borderRadius: 12, border: "none", background: "transparent", color: C.dim, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: C.font, marginTop: 6 }}>Cancel</button>
    </div>
  );
}

function GeneratePreview({ data, mode, onCreateProgram, onRegenerate, onBack, loading }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: C.font }}>{data.name}</div>
        {data.description && <div style={{ fontSize: 12, color: C.dim, marginTop: 4, lineHeight: 1.4 }}>{data.description}</div>}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 8 }}>
          {data.goal && <span style={{ padding: "3px 10px", borderRadius: 8, background: `${C.ai}15`, color: C.ai, fontSize: 10, fontWeight: 700, fontFamily: C.mono, textTransform: "uppercase" }}>{data.goal}</span>}
          {data.split_type && <span style={{ padding: "3px 10px", borderRadius: 8, background: `${C.ai}15`, color: C.ai, fontSize: 10, fontWeight: 700, fontFamily: C.mono, textTransform: "uppercase" }}>{data.split_type.replace("_", " ")}</span>}
        </div>
      </div>

      {(data.days || []).map((day, di) => (
        <div key={di} style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: "14px", marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: C.font }}>{day.name || `Day ${di + 1}`}</div>
            {day.muscle_groups?.length > 0 && <div style={{ display: "flex", gap: 4 }}>
              {day.muscle_groups.map((mg, j) => <span key={j} style={{ padding: "2px 8px", borderRadius: 6, background: "rgba(255,255,255,0.06)", color: C.dim, fontSize: 9, fontFamily: C.mono }}>{mg}</span>)}
            </div>}
          </div>
          {(day.exercises || []).map((ex, ei) => (
            <div key={ei} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: ei > 0 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {ex.is_compound && <span style={{ padding: "1px 5px", borderRadius: 4, background: `${C.ai}20`, color: C.ai, fontSize: 8, fontWeight: 800, fontFamily: C.mono }}>C</span>}
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontFamily: C.font }}>{ex.exercise_name}</span>
              </div>
              <span style={{ fontSize: 11, color: C.dim, fontFamily: C.mono }}>{ex.base_sets}x{ex.base_reps}</span>
            </div>
          ))}
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={onCreateProgram} disabled={loading} style={{
          flex: 2, padding: "14px", borderRadius: 14, border: "none",
          background: loading ? "rgba(255,255,255,0.06)" : `linear-gradient(135deg, ${C.ai}, #7B4CFF)`,
          color: loading ? C.dim : "#fff", fontSize: 14, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", fontFamily: C.font,
        }}>{loading ? "Creating..." : "Create Program"}</button>
        <button onClick={onRegenerate} disabled={loading} style={{
          flex: 1, padding: "14px", borderRadius: 14, border: `1px solid ${C.ai}30`, background: `${C.ai}08`,
          color: C.ai, fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: C.font,
        }}>Redo</button>
      </div>
      <button onClick={onBack} disabled={loading} style={{ width: "100%", padding: "10px", borderRadius: 12, border: "none", background: "transparent", color: C.dim, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: C.font, marginTop: 6 }}>Back to settings</button>
    </div>
  );
}

function AICoachScreen({ plan, queriesUsed, onUseQuery, onShowPricing, activeEnrollment, onNavigate, onProgramCreated, customExercises, profile }) {
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeCat, setActiveCat] = useState("Analyze");
  const [showPrompts, setShowPrompts] = useState(true);
  const [totalCost, setTotalCost] = useState(0);
  const scrollRef = useRef(null);
  const [pendingMsgIdx, setPendingMsgIdx] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [generateMode, setGenerateMode] = useState(null);
  const [generatedData, setGeneratedData] = useState(null);
  const [generateStep, setGenerateStep] = useState("config");
  const [generateFormValues, setGenerateFormValues] = useState(null);

  const planData = PLANS[plan];
  const remaining = Math.max(0, planData.queries - queriesUsed);
  const limitReached = remaining <= 0;

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, loading, generateStep]);
  useEffect(() => { if (!successMsg) return; const t = setTimeout(() => setSuccessMsg(null), 4000); return () => clearTimeout(t); }, [successMsg]);

  const handleGenerate = async (formValues) => {
    if (limitReached) return;
    setGenerateFormValues(formValues);
    setGenerateStep("loading");
    setActionError(null);
    const validExercises = getExerciseNamesByEquipment(formValues.equipment, customExercises);
    const repRanges = { hypertrophy: "8-12", strength: "3-6", endurance: "15-20", general: "6-12" };
    const prompt = `Generate a ${formValues.mode === "program" ? `${formValues.daysPerWeek}-day workout program` : "single workout session"}.

Goal: ${formValues.goal}
${formValues.mode === "program" ? `Split preference: ${formValues.split === "auto" ? "choose the best split for the goal and days" : formValues.split}` : ""}
${formValues.focus.length > 0 ? `Focus areas: ${formValues.focus.join(", ")}` : "Hit all major muscle groups"}
Session duration: ~${formValues.duration} minutes
Rep range for goal: ${repRanges[formValues.goal] || "6-12"}

VALID EXERCISE NAMES (use ONLY these exact names):
${validExercises.join(", ")}

Rules:
- Compound exercises first in each day
- 4-6 exercises per day
- Each exercise needs base_sets (2-5) and base_reps matching goal rep range
- Mark compounds with is_compound: true

Return this EXACT JSON structure:
{"name":"Program Name","description":"Brief description","split_type":"${formValues.split === "auto" ? "ppl" : formValues.split}","days_per_week":${formValues.daysPerWeek},"goal":"${formValues.goal}","color":"#A47BFF","icon":"🤖","days":[{"day_index":0,"name":"Day Name","muscle_groups":["Chest","Shoulders"],"exercises":[{"exercise_name":"Bench Press","base_sets":3,"base_reps":8,"is_compound":true,"sort_order":0}]}]}

split_type must be one of: ppl, upper_lower, full_body, five_day_split, custom`;
    try {
      const maxTokens = formValues.daysPerWeek > 3 ? 2000 : 1200;
      const result = await callCoachAPI(prompt, "Generate workout", null, { max_tokens: maxTokens });
      onUseQuery();
      setTotalCost(prev => prev + (result.cost_usd || 0));
      const parsed = extractJSON(result.text);
      if (!parsed?.name || !parsed?.days?.length) {
        setActionError("AI returned invalid format. Try again.");
        setGenerateStep("config");
        return;
      }
      const cleaned = validateExerciseNames(parsed, customExercises);
      if (cleaned.days.length === 0) {
        setActionError("No valid exercises in response. Try different equipment.");
        setGenerateStep("config");
        return;
      }
      if (formValues.mode === "program" && cleaned.days.length < formValues.daysPerWeek) {
        setActionError(`AI only generated ${cleaned.days.length} of ${formValues.daysPerWeek} days. Try again.`);
        setGenerateStep("config");
        return;
      }
      setGeneratedData(cleaned);
      setGenerateStep("preview");
    } catch (e) {
      setActionError(e.message || "Generation failed. Try again.");
      setGenerateStep("config");
    }
  };

  const handleCreateFromGenerated = async () => {
    if (!generatedData) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const newProgram = await createUserProgram(generatedData);
      setSuccessMsg("Program created! Navigating...");
      setGenerateMode(null);
      setGeneratedData(null);
      setGenerateStep("config");
      if (onProgramCreated) onProgramCreated(newProgram.id);
      setTimeout(() => { if (onNavigate) onNavigate("program"); }, 1200);
    } catch (e) {
      setActionError(e.message || "Failed to create program.");
    }
    setActionLoading(false);
  };

  const send = async (prompt, label) => {
    if (limitReached) return;
    if (prompt.startsWith("__GENERATE_")) {
      setGenerateMode(prompt === "__GENERATE_PROGRAM__" ? "program" : "workout");
      setGenerateStep("config");
      setGeneratedData(null);
      setActionError(null);
      setShowPrompts(false);
      return;
    }
    setPendingMsgIdx(null);
    setActionError(null);
    setSuccessMsg(null);
    setShowPrompts(false);
    setMsgs(prev => [...prev, { role: "user", content: label }]);
    setLoading(true);
    try {
      const result = await callCoachAPI(prompt, label);
      setMsgs(prev => {
        const next = [...prev, { role: "assistant", content: result.text }];
        setPendingMsgIdx(next.length - 1);
        return next;
      });
      onUseQuery();
      setTotalCost(prev => prev + (result.cost_usd || 0));
    } catch (e) {
      setMsgs(prev => [...prev, { role: "assistant", content: e.message || "Connection issue. Try again." }]);
    }
    setLoading(false);
  };

  const extractJSON = (text) => {
    try {
      const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenced) return JSON.parse(fenced[1].trim());
      const bare = text.match(/\{[\s\S]*\}/);
      if (bare) return JSON.parse(bare[0]);
    } catch {}
    return null;
  };

  const handleAccept = async () => {
    setActionLoading(true);
    setActionError(null);
    const lastCoachMsg = msgs[pendingMsgIdx]?.content || "";
    try {
      if (activeEnrollment) {
        const diffPrompt = `Based on your previous advice: "${lastCoachMsg.slice(0, 400)}"
Return ONLY a JSON object (no explanation) in this exact format:
{"action":"modify_program","changes":[{"exercise_name":"Exercise Name","week_from":${activeEnrollment.current_week},"delta_weight_kg":0,"delta_sets":0,"delta_reps":0}]}
Include only exercises that need changes. Use negative numbers to decrease.`;
        const result = await callCoachAPI(diffPrompt, "Apply suggestion");
        onUseQuery();
        setTotalCost(prev => prev + (result.cost_usd || 0));
        const parsed = extractJSON(result.text);
        if (!parsed?.changes?.length) throw new Error("Couldn't parse changes from AI response. Try again.");
        const count = await applyCoachDiffToSchedule(activeEnrollment.id, activeEnrollment.current_week, parsed.changes);
        setSuccessMsg(count > 0 ? `Updated ${count} upcoming workout${count !== 1 ? "s" : ""}` : "No upcoming workouts to update");
        setPendingMsgIdx(null);
      } else {
        const createPrompt = `Based on your previous advice: "${lastCoachMsg.slice(0, 400)}"
Create a structured workout program. Return ONLY a JSON object (no explanation) in this exact format:
{"action":"create_program","name":"Program Name","description":"Brief description","split_type":"full_body","days_per_week":3,"goal":"general","color":"#A47BFF","icon":"🤖","days":[{"day_index":0,"name":"Day A","muscle_groups":["Chest","Shoulders"],"exercises":[{"exercise_name":"Bench Press","base_sets":3,"base_reps":8,"is_compound":true,"sort_order":0}]}]}
split_type must be one of: ppl, upper_lower, full_body, five_day_split, custom`;
        const result = await callCoachAPI(createPrompt, "Create program");
        onUseQuery();
        setTotalCost(prev => prev + (result.cost_usd || 0));
        const parsed = extractJSON(result.text);
        if (!parsed?.name || !parsed?.days?.length) throw new Error("Couldn't parse program from AI response. Try again.");
        const newProgram = await createUserProgram(parsed);
        setSuccessMsg("Program created! Navigating...");
        setPendingMsgIdx(null);
        if (onProgramCreated) onProgramCreated(newProgram.id);
        setTimeout(() => { if (onNavigate) onNavigate("program"); }, 1200);
      }
    } catch (e) {
      setActionError(e.message || "Something went wrong. Try again.");
    }
    setActionLoading(false);
  };

  const handleReject = () => {
    setPendingMsgIdx(null);
    setActionError(null);
    setMsgs(prev => [...prev, { role: "user", content: "No thanks" }]);
  };

  const catKeys = Object.keys(AI_PROMPTS);
  const lastMsgIsAssistant = msgs.length > 0 && msgs[msgs.length - 1]?.role === "assistant";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "14px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: C.ai, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>AI Coach</span>
              <span style={{ padding: "2px 8px", borderRadius: 6, background: `${planData.color}20`, color: planData.color, fontSize: 9, fontWeight: 800, fontFamily: C.mono, letterSpacing: 1 }}>{planData.badge}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: C.font, marginTop: 2 }}>Coach</div>
          </div>
          {(msgs.length > 0 || generateMode) && <button onClick={() => { setMsgs([]); setShowPrompts(true); setPendingMsgIdx(null); setActionError(null); setSuccessMsg(null); setGenerateMode(null); setGeneratedData(null); setGenerateStep("config"); }} style={{ background: `${C.ai}15`, border: `1px solid ${C.ai}30`, borderRadius: 10, padding: "6px 12px", color: C.ai, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: C.font }}>New</button>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, padding: "8px 12px", borderRadius: 12, background: C.card, border: `1px solid ${C.border}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1, textTransform: "uppercase" }}>Today</span>
              <span style={{ fontSize: 10, color: remaining <= 2 ? "#FF6B3C" : planData.color, fontFamily: C.mono, fontWeight: 700 }}>{plan === "unlimited" ? "∞" : `${remaining}/${planData.queries}`}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 2, background: remaining <= 2 ? "#FF6B3C" : planData.color, width: plan === "unlimited" ? "100%" : `${(remaining / planData.queries) * 100}%`, transition: "width .4s ease" }} />
            </div>
          </div>
          <div style={{ textAlign: "right", minWidth: 45 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#fff", fontFamily: C.font }}>${totalCost.toFixed(4)}</div>
            <div style={{ fontSize: 8, color: C.dim, fontFamily: C.mono }}>API cost</div>
          </div>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px 20px 0" }}>
        {msgs.length === 0 && showPrompts && (
          <div>
            <div style={{ textAlign: "center", padding: "10px 0 18px" }}>
              <div style={{ width: 56, height: 56, borderRadius: 20, margin: "0 auto 10px", background: `linear-gradient(135deg, ${C.ai}, #7B4CFF)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, boxShadow: `0 6px 24px ${C.ai}40` }}>🧠</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 3 }}>AI Strength Coach</div>
              <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5 }}>Haiku-powered · Tap to ask</div>
            </div>
            <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>{catKeys.map(k => (<Pill key={k} active={activeCat === k} color={C.ai} onClick={() => setActiveCat(k)} style={{ flex: 1, textAlign: "center", padding: "8px 4px", fontSize: 11 }}>{k}</Pill>))}</div>
            {AI_PROMPTS[activeCat].map((p, i) => (
              <button key={i} onClick={() => !limitReached && send(p.prompt, p.label)} disabled={limitReached} style={{
                width: "100%", padding: "13px 14px", borderRadius: 14, border: `1px solid ${C.ai}20`, background: `${C.ai}08`, cursor: limitReached ? "not-allowed" : "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 11, marginBottom: 7, opacity: limitReached ? 0.4 : 1,
              }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: `${C.ai}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{p.icon}</div>
                <div><div style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: C.font }}>{p.label}</div><div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{p.prompt.slice(0, 55)}...</div></div>
              </button>
            ))}
            {limitReached && (
              <button onClick={onShowPricing} style={{ width: "100%", textAlign: "center", padding: "16px", marginTop: 8, borderRadius: 16, background: "rgba(255,107,60,0.08)", border: "1px solid rgba(255,107,60,0.2)", cursor: "pointer" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#FF6B3C", marginBottom: 4 }}>Daily limit reached</div>
                <div style={{ fontSize: 12, color: C.ai, fontWeight: 600 }}>Tap to upgrade →</div>
              </button>
            )}
          </div>
        )}

        {generateMode && generateStep === "config" && (
          <GenerateWizard mode={generateMode} onGenerate={handleGenerate} onCancel={() => { setGenerateMode(null); setShowPrompts(true); }} profile={profile} />
        )}

        {generateMode && generateStep === "loading" && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: 20, margin: "0 auto 14px", background: `linear-gradient(135deg, ${C.ai}, #7B4CFF)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, boxShadow: `0 6px 24px ${C.ai}40` }}>🤖</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: C.font, marginBottom: 6 }}>Generating your {generateMode}...</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>{[0, 1, 2].map(i => (<div key={i} style={{ width: 7, height: 7, borderRadius: 4, background: C.ai, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />))}</div>
          </div>
        )}

        {generateMode && generateStep === "preview" && generatedData && (
          <GeneratePreview data={generatedData} mode={generateMode} onCreateProgram={handleCreateFromGenerated} onRegenerate={() => handleGenerate(generateFormValues)} onBack={() => setGenerateStep("config")} loading={actionLoading} />
        )}

        {actionError && generateMode && (
          <div style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(255,107,60,0.1)", border: "1px solid rgba(255,107,60,0.2)", color: "#FF6B3C", fontSize: 12, marginBottom: 8, fontFamily: C.font }}>{actionError}</div>
        )}

        {!generateMode && msgs.map((m, i) => (
          <div key={i} style={{ marginBottom: 10, display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "assistant" && <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}><div style={{ width: 16, height: 16, borderRadius: 5, background: `linear-gradient(135deg, ${C.ai}, #7B4CFF)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8 }}>🧠</div><span style={{ fontSize: 9, color: C.ai, fontFamily: C.mono, fontWeight: 600 }}>COACH</span></div>}
            <div style={{ maxWidth: "88%", padding: "11px 13px", borderRadius: 15, background: m.role === "user" ? `${C.ai}20` : C.card, border: m.role === "user" ? `1px solid ${C.ai}30` : `1px solid ${C.border}`, borderTopRightRadius: m.role === "user" ? 4 : 15, borderTopLeftRadius: m.role === "assistant" ? 4 : 15 }}>
              <div style={{ fontSize: 13, fontWeight: m.role === "user" ? 700 : 400, color: m.role === "user" ? C.ai : "rgba(255,255,255,0.85)", lineHeight: 1.55, fontFamily: C.font, whiteSpace: "pre-wrap" }}>{m.content}</div>
            </div>
          </div>
        ))}

        {!generateMode && loading && <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}><div style={{ width: 16, height: 16, borderRadius: 5, background: `linear-gradient(135deg, ${C.ai}, #7B4CFF)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8 }}>🧠</div><div style={{ display: "flex", gap: 4, padding: "10px 14px", background: C.card, borderRadius: 14, border: `1px solid ${C.border}` }}>{[0, 1, 2].map(i => (<div key={i} style={{ width: 7, height: 7, borderRadius: 4, background: C.ai, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />))}</div></div>}

        {successMsg && (
          <div style={{ display: "flex", justifyContent: "center", padding: "6px 0 8px" }}>
            <div style={{ padding: "7px 16px", borderRadius: 20, background: "rgba(52,199,89,0.15)", border: "1px solid rgba(52,199,89,0.3)", color: "#34C759", fontSize: 12, fontWeight: 600, fontFamily: C.font }}>✓ {successMsg}</div>
          </div>
        )}

        {!generateMode && pendingMsgIdx !== null && !loading && !limitReached && (
          <div style={{ padding: "4px 0 12px" }}>
            {actionError && <div style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(255,107,60,0.1)", border: "1px solid rgba(255,107,60,0.2)", color: "#FF6B3C", fontSize: 12, marginBottom: 8, fontFamily: C.font }}>{actionError}</div>}
            {activeEnrollment ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleAccept} disabled={actionLoading} style={{ flex: 1, padding: "10px 14px", borderRadius: 12, background: `${C.ai}20`, border: `1px solid ${C.ai}40`, color: C.ai, fontSize: 13, fontWeight: 700, cursor: actionLoading ? "not-allowed" : "pointer", fontFamily: C.font, opacity: actionLoading ? 0.6 : 1 }}>
                  {actionLoading ? "Applying..." : "Yes, apply this"}
                </button>
                <button onClick={handleReject} disabled={actionLoading} style={{ flex: 1, padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: C.dim, fontSize: 13, fontWeight: 600, cursor: actionLoading ? "not-allowed" : "pointer", fontFamily: C.font, opacity: actionLoading ? 0.6 : 1 }}>
                  No thanks
                </button>
              </div>
            ) : (
              <button onClick={handleAccept} disabled={actionLoading} style={{ width: "100%", padding: "12px 16px", borderRadius: 14, background: `linear-gradient(135deg, ${C.ai}25, #7B4CFF25)`, border: `1px solid ${C.ai}40`, color: C.ai, fontSize: 13, fontWeight: 700, cursor: actionLoading ? "not-allowed" : "pointer", fontFamily: C.font, opacity: actionLoading ? 0.6 : 1, textAlign: "center" }}>
                {actionLoading ? "Creating program..." : "Create new program with this advice"}
              </button>
            )}
          </div>
        )}

        {!generateMode && pendingMsgIdx === null && lastMsgIsAssistant && !loading && !limitReached && (
          <div style={{ padding: "6px 0 12px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {[{ label: "Go deeper", prompt: "Expand with more actionable steps." }, { label: "Make a plan", prompt: "Turn that into a day-by-day plan." }, { label: "Why?", prompt: "Explain the science behind this." }, { label: "What else?", prompt: "Most important change I should make?" }].map((f, i) => (
                <button key={i} onClick={() => send(f.prompt, f.label)} style={{ padding: "6px 11px", borderRadius: 9, border: `1px solid ${C.ai}25`, background: `${C.ai}08`, color: C.ai, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: C.font }}>{f.label}</button>
              ))}
            </div>
          </div>
        )}
        <div style={{ height: 12 }} />
      </div>
    </div>
  );
}

/* ═══ ONBOARDING ═══ */
const GOALS = [
  { id: "fat_loss",    label: "Fat Loss",       desc: "Lose body fat" },
  { id: "muscle_gain", label: "Muscle Gain",    desc: "Build size and strength" },
  { id: "maintenance", label: "Maintenance",    desc: "Maintain current physique" },
  { id: "performance", label: "Performance",    desc: "Athletic performance" },
];
const TARGET_RATES = [
  { id: "slow",       label: "Slow & Steady", desc: "Minimal muscle loss / lean gains" },
  { id: "moderate",   label: "Moderate",      desc: "Balanced approach" },
  { id: "aggressive", label: "Aggressive",    desc: "Faster results, harder effort" },
];
const EXPERIENCE_LEVELS = [
  { id: "beginner",     label: "Beginner",     desc: "Less than 1 year" },
  { id: "intermediate", label: "Intermediate", desc: "1–3 years" },
  { id: "advanced",     label: "Advanced",     desc: "3+ years" },
];
const FOCUS_MUSCLE_GROUPS = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core"];

// === SECTION: Onboarding ===
function OnboardingScreen({ user, onComplete, onBack: onExitBack }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState({
    gender: "",
    age: "",
    weight: "",
    height: "",
    unit: "metric",
    goal: "",
    experience: "",
    targetRate: "",
    yearsLifting: "",
    trainingFrequency: 3,
    benchmarks: { squat: "", bench: "", deadlift: "", ohp: "" },
    focusAreas: [],
  });

  const totalSteps = 6;
  const progress = ((step + 1) / totalSteps) * 100;

  const set = (key, val) => setData(prev => ({ ...prev, [key]: val }));
  const setBenchmark = (key, val) => setData(prev => ({ ...prev, benchmarks: { ...prev.benchmarks, [key]: val } }));
  const toggleFocus = (area) => setData(prev => ({
    ...prev,
    focusAreas: prev.focusAreas.includes(area)
      ? prev.focusAreas.filter(a => a !== area)
      : [...prev.focusAreas, area],
  }));

  const showTargetRate = data.goal === "fat_loss" || data.goal === "muscle_gain";

  const canNext = () => {
    if (step === 0) return data.gender !== "";
    if (step === 1) return data.age !== "" && Number(data.age) >= 13 && Number(data.age) <= 100;
    if (step === 2) return data.weight !== "";
    if (step === 3) return data.goal !== "" && data.experience !== "" && (!showTargetRate || data.targetRate !== "");
    if (step === 4) return true; // Benchmarks are optional
    if (step === 5) return true; // Focus areas are optional
    return true;
  };

  const finish = async () => {
    setSaving(true);
    try {
      const weightKg = data.unit === "imperial"
        ? Math.round(Number(data.weight) * 0.453592 * 10) / 10
        : Number(data.weight);
      const heightCm = data.unit === "imperial"
        ? Math.round(Number(data.height) * 2.54)
        : Number(data.height);

      // Try saving with new columns first; fall back to base columns if DB hasn't been migrated
      const fullUpdate = {
        gender: data.gender,
        age: Number(data.age),
        weight_kg: weightKg || null,
        height_cm: heightCm || null,
        training_goal: data.goal,
        experience: data.experience,
        unit_system: data.unit,
        target_rate: data.targetRate || null,
        years_lifting: data.yearsLifting !== "" ? Number(data.yearsLifting) : null,
        training_frequency: data.trainingFrequency,
        focus_areas: data.focusAreas,
        onboarding_complete: true,
      };

      const { error } = await updateProfile(fullUpdate);
      if (error) {
        console.warn("Full profile update failed, trying base columns:", error);
        // Map new goal IDs to old ones the DB constraint accepts
        const goalFallback = { fat_loss: "general", muscle_gain: "hypertrophy", maintenance: "general", performance: "strength" };
        const safeGoal = goalFallback[data.goal] || data.goal;
        await updateProfile({
          gender: data.gender,
          age: Number(data.age),
          weight_kg: weightKg || null,
          height_cm: heightCm || null,
          training_goal: safeGoal,
          experience: data.experience,
          unit_system: data.unit,
          onboarding_complete: true,
        });
      }

      // Save strength benchmarks as personal records (upsert to avoid duplicates)
      try {
        const session = await getSession();
        if (session?.user) {
          const userId = session.user.id;
          const benchmarkExercises = [
            { key: "squat", name: "Back Squat" },
            { key: "bench", name: "Bench Press" },
            { key: "deadlift", name: "Deadlift" },
            { key: "ohp", name: "Overhead Press" },
          ];
          for (const b of benchmarkExercises) {
            if (!data.benchmarks[b.key] || Number(data.benchmarks[b.key]) <= 0) continue;
            const wKg = data.unit === "imperial"
              ? Math.round(Number(data.benchmarks[b.key]) * 0.453592 * 10) / 10
              : Number(data.benchmarks[b.key]);

            // Check if an active PR already exists for this exercise
            const { data: existing } = await supabase
              .from("personal_records")
              .select("id, estimated_1rm")
              .eq("user_id", userId)
              .eq("exercise_name", b.name)
              .eq("pr_type", "1rm")
              .eq("is_active", true)
              .limit(1);

            const prevE1rm = existing?.[0]?.estimated_1rm ?? 0;
            // Only create a new PR if the benchmark beats the current best
            if (wKg > prevE1rm) {
              if (existing?.length) {
                await supabase.from("personal_records").update({ is_active: false }).eq("id", existing[0].id);
              }
              await supabase.from("personal_records").insert({
                user_id: userId, exercise_name: b.name, weight_kg: wKg, reps: 1, pr_type: "1rm", is_active: true,
              });
            }
          }
        }
      } catch (e) {
        console.error("Error saving benchmarks:", e);
      }
    } catch (e) {
      console.error("Onboarding save error:", e);
    }
    setSaving(false);
    onComplete();
  };

  const weightUnit = data.unit === "imperial" ? "lbs" : "kg";
  const heightUnit = data.unit === "imperial" ? "in" : "cm";

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "20px 24px 40px" }}>
      {/* Progress bar */}
      <div style={{ paddingTop: 8, marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: C.dim, fontFamily: C.mono }}>Step {step + 1} of {totalSteps}</span>
          {(step > 0 || onExitBack) && (
            <button onClick={step > 0 ? () => setStep(s => s - 1) : onExitBack} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 12, fontFamily: C.font }}>{step === 0 && onExitBack ? "✕ Cancel" : "← Back"}</button>
          )}
        </div>
        <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
          <div style={{ height: "100%", borderRadius: 2, background: C.accent, width: `${progress}%`, transition: "width 0.4s ease" }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* Step 0 — Gender */}
        {step === 0 && (
          <div>
            <div style={{ fontSize: 11, color: C.accent, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>About You</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 6 }}>What's your gender?</div>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 32 }}>Helps calibrate your AI coach recommendations</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[{ id: "male", label: "Male", icon: "♂" }, { id: "female", label: "Female", icon: "♀" }, { id: "other", label: "Prefer not to say", icon: "◎" }].map(g => (
                <button key={g.id} onClick={() => set("gender", g.id)} style={{
                  padding: "18px 20px", borderRadius: 16, border: `2px solid ${data.gender === g.id ? C.accent : C.border}`,
                  background: data.gender === g.id ? `${C.accent}12` : C.card,
                  color: data.gender === g.id ? C.accent : "#fff",
                  fontSize: 16, fontWeight: 700, fontFamily: C.font, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 14, textAlign: "left", transition: "all 0.2s"
                }}>
                  <span style={{ fontSize: 22 }}>{g.icon}</span>{g.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1 — Age */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 11, color: C.accent, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>About You</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 6 }}>How old are you?</div>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 32 }}>Age affects recovery time and training recommendations</div>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginBottom: 32 }}>
              <button onClick={() => set("age", String(Math.max(13, Number(data.age || 25) - 1)))} style={{ width: 52, height: 52, borderRadius: 16, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 24, cursor: "pointer" }}>−</button>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 72, fontWeight: 800, color: "#fff", fontFamily: C.font, lineHeight: 1 }}>{data.age || "—"}</div>
                <div style={{ fontSize: 13, color: C.dim, marginTop: 4 }}>years old</div>
              </div>
              <button onClick={() => set("age", String(Math.min(100, Number(data.age || 25) + 1)))} style={{ width: 52, height: 52, borderRadius: 16, border: `1px solid ${C.accent}40`, background: `${C.accent}12`, color: C.accent, fontSize: 24, cursor: "pointer" }}>+</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {[18, 22, 25, 30, 35, 40, 45, 50].map(a => (
                <button key={a} onClick={() => set("age", String(a))} style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${data.age === String(a) ? C.accent : C.border}`, background: data.age === String(a) ? `${C.accent}15` : C.card, color: data.age === String(a) ? C.accent : C.dim, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{a}</button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 — Body metrics */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 11, color: C.accent, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Body Metrics</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 6 }}>Your measurements</div>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 24 }}>Used to estimate volume targets and progress</div>
            {/* Unit toggle */}
            <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 4, marginBottom: 24 }}>
              {["metric", "imperial"].map(u => (
                <button key={u} onClick={() => set("unit", u)} style={{ flex: 1, padding: "8px", borderRadius: 9, border: "none", background: data.unit === u ? "rgba(255,255,255,0.1)" : "none", color: data.unit === u ? "#fff" : C.dim, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: C.font, textTransform: "capitalize" }}>{u}</button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Weight ({weightUnit}) *</div>
                <input type="number" value={data.weight} onChange={e => set("weight", e.target.value)} placeholder={data.unit === "imperial" ? "e.g. 180" : "e.g. 80"} style={{ width: "100%", padding: "14px", borderRadius: 12, border: `1px solid ${data.weight ? C.accent : C.border}`, background: C.card, color: "#fff", fontSize: 18, fontWeight: 700, fontFamily: C.font, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Height ({heightUnit}) <span style={{ color: "rgba(255,255,255,0.2)" }}>optional</span></div>
                <input type="number" value={data.height} onChange={e => set("height", e.target.value)} placeholder={data.unit === "imperial" ? "e.g. 71" : "e.g. 178"} style={{ width: "100%", padding: "14px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 18, fontWeight: 700, fontFamily: C.font, outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — Goal + Experience + Target Rate + Training Frequency + Years */}
        {step === 3 && (
          <div>
            <div style={{ fontSize: 11, color: C.accent, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Training Profile</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 6 }}>Your goals</div>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 20 }}>Personalises your training programs and AI coach</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {GOALS.map(g => (
                <button key={g.id} onClick={() => set("goal", g.id)} style={{ padding: "16px 12px", borderRadius: 14, border: `2px solid ${data.goal === g.id ? C.accent : C.border}`, background: data.goal === g.id ? `${C.accent}12` : C.card, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{I[g.id]}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: data.goal === g.id ? C.accent : "#fff", fontFamily: C.font }}>{g.label}</div>
                  <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{g.desc}</div>
                </button>
              ))}
            </div>
            {/* Target rate — shown for fat_loss/muscle_gain */}
            {showTargetRate && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Target Rate</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {TARGET_RATES.map(r => (
                    <button key={r.id} onClick={() => set("targetRate", r.id)} style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: `1.5px solid ${data.targetRate === r.id ? C.accent : C.border}`, background: data.targetRate === r.id ? `${C.accent}12` : C.card, cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: data.targetRate === r.id ? C.accent : "#fff", fontFamily: C.font }}>{r.label}</div>
                      <div style={{ fontSize: 9, color: C.dim, marginTop: 2 }}>{r.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Experience Level</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {EXPERIENCE_LEVELS.map(e => (
                <button key={e.id} onClick={() => set("experience", e.id)} style={{ padding: "14px 16px", borderRadius: 12, border: `2px solid ${data.experience === e.id ? C.ai : C.border}`, background: data.experience === e.id ? `${C.ai}12` : C.card, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s" }}>
                  <span style={{ fontSize: 20 }}>{I[e.id]}</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: data.experience === e.id ? C.ai : "#fff", fontFamily: C.font }}>{e.label}</div>
                    <div style={{ fontSize: 11, color: C.dim }}>{e.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            {/* Years lifting & training frequency */}
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Years Lifting</div>
                <input type="number" min="0" max="50" value={data.yearsLifting} onChange={e => set("yearsLifting", e.target.value)} placeholder="e.g. 2" style={{ width: "100%", padding: "12px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: C.font, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Days/Week</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => set("trainingFrequency", Math.max(0, data.trainingFrequency - 1))} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: C.font, minWidth: 28, textAlign: "center" }}>{data.trainingFrequency}</div>
                  <button onClick={() => set("trainingFrequency", Math.min(7, data.trainingFrequency + 1))} style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.accent}40`, background: `${C.accent}12`, color: C.accent, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4 — Strength Benchmarks */}
        {step === 4 && (
          <div>
            <div style={{ fontSize: 11, color: C.accent, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Strength Benchmarks</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 6 }}>Current lifts</div>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 24 }}>Helps set starting weights for your program. Skip if unsure.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { key: "squat", label: "Back Squat", icon: I.legsM },
                { key: "bench", label: "Bench Press", icon: I.barbell },
                { key: "deadlift", label: "Deadlift", icon: I.fire },
                { key: "ohp", label: "Overhead Press", icon: I.strength },
              ].map(b => (
                <div key={b.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20, width: 28 }}>{b.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", fontFamily: C.font, marginBottom: 4 }}>{b.label}</div>
                    <input type="number" value={data.benchmarks[b.key]} onChange={e => setBenchmark(b.key, e.target.value)} placeholder={`1RM in ${weightUnit}`} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${data.benchmarks[b.key] ? C.accent : C.border}`, background: C.card, color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: C.font, outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setStep(s => s + 1)} style={{ marginTop: 20, background: "none", border: `1px solid ${C.border}`, color: C.dim, borderRadius: 12, padding: "10px 20px", fontSize: 13, cursor: "pointer", fontFamily: C.font, width: "100%", textAlign: "center" }}>
              Skip — I don't know my lifts
            </button>
          </div>
        )}

        {/* Step 5 — Focus Areas */}
        {step === 5 && (
          <div>
            <div style={{ fontSize: 11, color: C.accent, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Weak Points</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 6 }}>Focus areas</div>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 24 }}>Select body parts you want to prioritize. Optional.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {FOCUS_MUSCLE_GROUPS.map(mg => {
                const icons = { Chest: I.chest, Back: I.back, Legs: I.legsM, Shoulders: I.shoulders, Arms: I.arms, Core: I.core };
                const selected = data.focusAreas.includes(mg);
                return (
                  <button key={mg} onClick={() => toggleFocus(mg)} style={{
                    padding: "16px 10px", borderRadius: 14, border: `2px solid ${selected ? C.accent : C.border}`,
                    background: selected ? `${C.accent}12` : C.card, cursor: "pointer", textAlign: "center", transition: "all 0.2s"
                  }}>
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{icons[mg]}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: selected ? C.accent : "#fff", fontFamily: C.font }}>{mg}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Next / Finish button */}
      <button
        onClick={step < totalSteps - 1 ? () => setStep(s => s + 1) : finish}
        disabled={!canNext() || saving}
        style={{
          width: "100%", padding: "16px", borderRadius: 16, border: "none",
          background: canNext() ? `linear-gradient(135deg, ${C.accent}, ${C.accent2})` : "rgba(255,255,255,0.06)",
          color: canNext() ? C.bg : "rgba(255,255,255,0.2)",
          fontSize: 16, fontWeight: 800, fontFamily: C.font,
          cursor: canNext() && !saving ? "pointer" : "default",
          transition: "all 0.3s",
          marginTop: 16,
        }}
      >
        {saving ? "Saving..." : step < totalSteps - 1 ? "Continue →" : "Let's Go 🚀"}
      </button>
    </div>
  );
}

// === SECTION: Auth ===
/* ═══ AUTH ═══ */
function AuthScreen({ onSignUp, onSignIn, onGoogleSignIn, onLegal }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const switchMode = (m) => { setMode(m); setError(""); setResetSent(false); setShowPw(false); };

  const isWebView = !window.Capacitor?.isNativePlatform?.() && (
    /Instagram|FBAN|FBAV|Twitter|Line|MicroMessenger|GSA/.test(navigator.userAgent) ||
    (/(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(navigator.userAgent))
  );

  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result?.error) setError(result.error.message || "Google sign-in failed");
      else if (result?.data && onGoogleSignIn) setTimeout(onGoogleSignIn, 500);
    } catch (e) {
      setError(e.message);
    }
    setGoogleLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error: err } = await resetPassword(email);
        if (err) setError(err.message || "Failed to send reset email");
        else setResetSent(true);
      } else if (mode === "signup") {
        const { error: err } = await signUp(email, password, name);
        if (err) setError(err.message || "Signup failed");
        else { setEmail(""); setPassword(""); setName(""); setTimeout(onSignUp, 500); }
      } else {
        const { error: err } = await signIn(email, password);
        if (err) setError(err.message || "Login failed");
        else { setEmail(""); setPassword(""); setTimeout(onSignIn, 500); }
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: "40px 20px", display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", textAlign: "center" }}>
      <div style={{ fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 8, fontFamily: C.font }}>gAIns</div>
      <div style={{ fontSize: 13, color: C.dim, marginBottom: 4 }}>AI-powered strength training</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginBottom: 40 }}>v1.0.1.4</div>

      {mode === "forgot" && resetSent ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
          <div style={{ fontSize: 32 }}>📧</div>
          <div style={{ color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: C.font }}>Check your email</div>
          <div style={{ color: C.dim, fontSize: 13, fontFamily: C.font, lineHeight: 1.6 }}>We've sent a password reset link to <strong style={{ color: "#fff" }}>{email}</strong></div>
          <button onClick={() => switchMode("login")} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 13, fontWeight: 700, fontFamily: C.font, textDecoration: "underline", marginTop: 8 }}>Back to Sign In</button>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {mode === "forgot" && (
              <div style={{ color: C.dim, fontSize: 13, fontFamily: C.font, marginBottom: 4, textAlign: "left" }}>Enter your email and we'll send you a reset link.</div>
            )}
            {mode === "signup" && (
              <input type="text" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} style={{ padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 13, fontFamily: C.font, outline: "none" }} />
            )}
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} style={{ padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 13, fontFamily: C.font, outline: "none" }} />
            {mode !== "forgot" && (
              <div style={{ position: "relative" }}>
                <input type={showPw ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} style={{ width: "100%", padding: "12px 44px 12px 14px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 13, fontFamily: C.font, outline: "none", boxSizing: "border-box" }} />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.dim, fontSize: 16, padding: 0, lineHeight: 1 }}>{showPw ? "🙈" : "👁"}</button>
              </div>
            )}
            {mode === "login" && (
              <div style={{ textAlign: "right", marginTop: -4 }}>
                <button type="button" onClick={() => switchMode("forgot")} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 12, fontFamily: C.font }}>Forgot password?</button>
              </div>
            )}
            {error && <div style={{ color: "#FF6B3C", fontSize: 12, fontFamily: C.font }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ padding: "13px 14px", borderRadius: 12, border: "none", background: C.accent, color: C.bg, fontSize: 14, fontWeight: 700, fontFamily: C.font, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.6 : 1 }}>
              {loading ? "..." : mode === "login" ? "Sign In" : mode === "signup" ? "Sign Up" : "Send Reset Link"}
            </button>
          </form>
          {mode !== "forgot" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
                <div style={{ flex: 1, height: 1, background: C.border }} />
                <span style={{ fontSize: 11, color: C.dim, fontFamily: C.font }}>or</span>
                <div style={{ flex: 1, height: 1, background: C.border }} />
              </div>
              {isWebView && (
                <div style={{ background: "rgba(255,107,60,0.12)", border: "1px solid rgba(255,107,60,0.4)", borderRadius: 10, padding: "10px 14px", marginBottom: 4, textAlign: "left" }}>
                  <div style={{ color: "#FF6B3C", fontSize: 12, fontWeight: 700, fontFamily: C.font, marginBottom: 3 }}>Open in your browser to use Google Sign-In</div>
                  <div style={{ color: C.dim, fontSize: 11, fontFamily: C.font, lineHeight: 1.5 }}>Google blocks sign-in inside in-app browsers. Tap the share icon and choose "Open in Safari" or "Open in Chrome".</div>
                </div>
              )}
              <button onClick={handleGoogleSignIn} disabled={googleLoading || loading} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: C.font, cursor: googleLoading ? "wait" : "pointer", opacity: googleLoading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.77.9 7.34 2.44 10.5l8.09-5.91z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                {googleLoading ? "..." : "Continue with Google"}
              </button>
            </>
          )}
          <div style={{ fontSize: 12, color: C.dim, marginTop: 24 }}>
            {mode === "forgot" ? "Remembered it? " : mode === "login" ? "No account? " : "Have an account? "}
            <button onClick={() => switchMode(mode === "signup" ? "login" : mode === "forgot" ? "login" : "signup")} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: C.font, textDecoration: "underline" }}>
              {mode === "signup" ? "Sign In" : mode === "forgot" ? "Sign In" : "Sign Up"}
            </button>
          </div>
        </>
      )}
      <div style={{ marginTop: 32, fontSize: 11, color: "rgba(255,255,255,0.2)", textAlign: "center", fontFamily: C.font }}>
        <button onClick={() => onLegal && onLegal("privacy")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 11, fontFamily: C.font, textDecoration: "underline", padding: 0 }}>Privacy Policy</button>
        <span style={{ margin: "0 8px" }}>·</span>
        <button onClick={() => onLegal && onLegal("terms")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 11, fontFamily: C.font, textDecoration: "underline", padding: 0 }}>Terms of Service</button>
      </div>
    </div>
  );
}

function useMountAnimation() {
  const [m, setM] = useState(false);
  useEffect(() => { setM(true); }, []);
  return m;
}

// === SECTION: Home / Dashboard ===
/* ═══ HOME ═══ */
function HomeScreen({ onStart, onNav, plan, user, profile, onProfileClick, onNavLibrary, workouts = [], prs = [], volumeTrend = [], onDayClick, todayWorkout, onStartScheduled, enrollment }) {
  const m = useMountAnimation();

  // Calculate stats from workouts prop
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const weekWorkouts = workouts.filter(wo => new Date(wo.started_at) >= weekStart);
  const totalVolume = weekWorkouts.reduce((sum, wo) => sum + (wo.total_volume_kg || 0), 0);
  const avgDurationMins = weekWorkouts.length > 0 ? weekWorkouts.reduce((sum, wo) => sum + (wo.duration_secs || 0), 0) / weekWorkouts.length / 60 : 0;

  // Streak: count consecutive days with workouts going backwards from today
  const streak = (() => {
    if (workouts.length === 0) return 0;
    const daySet = new Set(workouts.map(wo => new Date(wo.started_at).toDateString()));
    let count = 0;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    // If no workout today, start checking from yesterday
    if (!daySet.has(d.toDateString())) d.setDate(d.getDate() - 1);
    while (daySet.has(d.toDateString())) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  })();

  const volumeStr = totalVolume > 0
    ? Math.round(totalVolume).toLocaleString() + " kg"
    : "—";

  // Format duration: show minutes or hours
  const durationStr = avgDurationMins > 0
    ? (avgDurationMins >= 60 ? (avgDurationMins / 60).toFixed(1) + "h" : Math.round(avgDurationMins) + "m")
    : "—";

  // Map volume trend from DB format {week_start, volume} to MiniChart format {w, v}
  const chartData = volumeTrend.length > 0
    ? volumeTrend.map((t, i) => ({ w: t.w || `W${i + 1}`, v: t.v || t.volume || 0 }))
    : [{ w: "W1", v: 0 }];

  const stats = [
    { label: "Workouts", val: new Set(weekWorkouts.map(wo => new Date(wo.started_at).toDateString())).size.toString(), sub: "this week", action: () => onNav("weekDetail") },
    { label: "Volume", val: volumeStr, sub: "this week" },
    { label: "Streak", val: streak.toString(), sub: "days" },
    { label: "Duration", val: durationStr, sub: "avg/session" }
  ];

  const userName = (profile?.full_name || profile?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Athlete").split(" ")[0];
  const userInitial = userName.charAt(0).toUpperCase();
  const wd = Array(7).fill(null);
  weekWorkouts.forEach(wo => {
    const d = new Date(wo.started_at);
    const idx = d.getDay() === 0 ? 6 : d.getDay() - 1;
    if (!wd[idx]) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(dayDate.getDate() + idx);
      wd[idx] = dayDate;
    }
  });
  const todayIdx = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();
  return (
    <div style={{ padding: "0 20px 110px", opacity: m ? 1 : 0, transform: m ? "none" : "translateY(10px)", transition: "all .5s cubic-bezier(.22,1,.36,1)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 18px" }}>
        <div><div style={{ fontSize: 12, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div><div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: C.font, marginTop: 2 }}>{(() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; })()}</div></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {plan !== "free" && <span style={{ padding: "3px 8px", borderRadius: 6, background: `${PLANS[plan].color}20`, color: PLANS[plan].color, fontSize: 9, fontWeight: 800, fontFamily: C.mono }}>{PLANS[plan].badge}</span>}
          <button onClick={onNavLibrary} style={{ width: 42, height: 42, borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer", padding: 0 }}>📚</button>
          <button onClick={onProfileClick} style={{ width: 42, height: 42, borderRadius: 14, background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: C.bg, fontFamily: C.font, border: "none", cursor: "pointer", padding: 0 }}>{userInitial}</button>
        </div>
      </div>
      {/* Today's scheduled workout card */}
      {todayWorkout && (
        <button onClick={() => onStartScheduled(todayWorkout)} style={{ width: "100%", padding: "18px 18px", border: `2px solid ${enrollment?.programs?.color || C.accent}50`, borderRadius: 22, background: `${enrollment?.programs?.color || C.accent}0A`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, textAlign: "left" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: enrollment?.programs?.color || C.accent, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>Today's Program</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: C.font }}>{todayWorkout.program_days?.name || "Workout"}</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{(todayWorkout.prescribed_exercises || []).length} exercises · Week {todayWorkout.week_number}</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: `${enrollment?.programs?.color || C.accent}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: enrollment?.programs?.color || C.accent, flexShrink: 0 }}>▶</div>
        </button>
      )}
      <button onClick={onStart} style={{ width: "100%", padding: "20px 22px", border: "none", borderRadius: 22, background: `linear-gradient(135deg, ${C.accent} 0%, ${C.accent2} 100%)`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, position: "relative", overflow: "hidden" }}>
        <div style={{ textAlign: "left", position: "relative", zIndex: 1 }}><div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.45)", fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>Tap to begin</div><div style={{ fontSize: 21, fontWeight: 800, color: C.bg, fontFamily: C.font }}>{"Start Workout"}</div></div>
        <div style={{ width: 50, height: 50, borderRadius: 16, background: "rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, position: "relative", zIndex: 1 }}>▶</div>
      </button>
      <button onClick={() => onNav("coach")} style={{ width: "100%", padding: "14px 16px", border: `1px solid ${C.ai}25`, borderRadius: 18, background: `${C.ai}08`, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, marginBottom: 22, textAlign: "left" }}>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: `linear-gradient(135deg, ${C.ai}, #7B4CFF)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🧠</div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Ask AI Coach</div><div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>Powered by Haiku · {PLANS[plan].queries === 999 ? "Unlimited" : `${PLANS[plan].queries}/day`}</div></div>
        <div style={{ color: C.ai, fontSize: 16 }}>→</div>
      </button>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "0 8px", marginBottom: 22 }}>{["M","T","W","T","F","S","S"].map((d, i) => (<div key={i} onClick={() => wd[i] && onDayClick && onDayClick(wd[i])} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: wd[i] ? "pointer" : "default" }}><div style={{ fontSize: 10, fontFamily: C.mono, color: i === todayIdx ? C.accent : C.dim, fontWeight: 600 }}>{d}</div><div style={{ width: 28, height: 28, borderRadius: 10, background: i === todayIdx ? `${C.accent}20` : wd[i] ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)", border: i === todayIdx ? `1.5px solid ${C.accent}50` : `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: wd[i] ? C.accent : "rgba(255,255,255,0.1)" }}>{wd[i] ? "✓" : ""}</div></div>))}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>{stats.map((s, i) => (<div key={i} onClick={s.action} style={{ background: C.card, borderRadius: 16, padding: "14px 16px", border: s.action ? `1.5px solid ${C.accent}30` : `1px solid ${C.border}`, cursor: s.action ? "pointer" : "default", transition: "border-color .2s" }}><div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>{s.label}{s.action && <span style={{ marginLeft: 4, color: C.accent, fontSize: 9 }}>→</span>}</div><div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: C.font, lineHeight: 1 }}>{s.val}</div><div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>{s.sub}</div></div>))}</div>
      <div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>Personal Records</div><div onClick={() => onNav("prs")} style={{ fontSize: 12, color: C.accent, cursor: "pointer", fontWeight: 600 }}>See All →</div></div>{prs.filter(p => (p.pr_type || "1rm") === "1rm").slice(0, 3).map((p, i) => (<div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 15px", borderRadius: 14, marginBottom: 7, background: C.card, border: `1px solid ${C.border}` }}><div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{p.exercise_name}</div><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: C.font }}>{Math.round(p.estimated_1rm || p.weight_kg)}kg</span><span style={{ fontSize: 12, color: C.dim }}>1RM</span></div></div>))}</div>
    </div>
  );
}

// === SECTION: Template Picker ===
/* ═══ TEMPLATE PICKER ═══ */
// Normalise a DB template row into the shape WorkoutScreen expects
function normaliseTemplate(t) {
  const exercises = (t.template_exercises || [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(e => ({
      name: e.name,
      equipment: e.equipment || "Barbell",
      sets: e.default_sets || 3,
      lastReps: e.default_reps || 10,
      lastWeight: e.default_weight || 20,
    }));
  return { ...t, label: t.name, exercises };
}

function TemplatePicker({ onSelect, onBack }) {
  const [templates, setTemplates] = useState(TEMPLATES);
  const [loading, setLoading] = useState(false);
  const [pg, setPg] = useState(0);
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const tpls = await getTemplates();
        if (tpls && tpls.length > 0) {
          // Deduplicate by name in case templates were seeded more than once
          const seen = new Set();
          const unique = tpls.filter(t => seen.has(t.name) ? false : seen.add(t.name));
          setTemplates(unique.map(normaliseTemplate));
        }
      } catch (e) {
        console.error("Failed to load templates:", e);
      }
    };
    loadTemplates();
  }, []);

  const pages = [];
  for (let i = 0; i < templates.length; i += 4) pages.push(templates.slice(i, i + 4));

  if (loading) return (
    <div style={{ padding: "0 20px 40px", textAlign: "center", paddingTop: 100 }}>
      <div style={{ color: C.dim }}>Loading templates...</div>
    </div>
  );

  if (templates.length === 0) return (
    <div style={{ padding: "0 20px 40px" }}>
      <div style={{ padding: "14px 0 6px" }}>
        <button onClick={() => onBack()} style={{ background: C.card, border: `1px solid ${C.border}`, color: "#fff", borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: C.font }}>← Back</button>
      </div>
      <div style={{ textAlign: "center", paddingTop: 60 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: C.font, marginBottom: 8 }}>No Templates Yet</div>
        <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>
          Your workout templates will appear here.<br />
          Make sure the database schema has been deployed.
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: "0 20px 40px" }}>
      <div style={{ padding: "14px 0 6px" }}>
        <button onClick={() => onBack()} style={{ background: C.card, border: `1px solid ${C.border}`, color: "#fff", borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: C.font }}>← Back</button>
      </div>
      <div style={{ textAlign: "center", padding: "12px 0 16px" }}>
        <div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Choose workout</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: C.font }}>Pick a Template</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {pages[pg]?.map(t => (
          <button key={t.id} onClick={() => onSelect(t)} style={{ width: "100%", padding: "14px 16px", borderRadius: 20, border: `1px solid ${t.color}30`, background: `${t.color}08`, cursor: "pointer", textAlign: "left" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 22, marginBottom: 4 }}>{I[t.id] || t.icon}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", fontFamily: C.font }}>{t.label || t.name}</div>
                <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>{t.exercises.length} exercises</div>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: `${t.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: t.color }}>→</div>
            </div>
          </button>
        ))}
      </div>
      {pages.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          {pages.map((_, i) => (<button key={i} onClick={() => setPg(i)} style={{ width: pg === i ? 24 : 8, height: 8, borderRadius: 4, border: "none", cursor: "pointer", background: pg === i ? C.accent : "rgba(255,255,255,0.1)", transition: "all .3s ease" }} />))}
        </div>
      )}
    </div>
  );
}

// === SECTION: Workout ===
/* ═══ WORKOUT ═══ */
function WorkoutScreen({ template, onFinish, onBack, isOnline = true, user, prs = [], profile, onShowPricing, onBrowseLibrary, customExercises = [] }) {
  const [timer, setTimer] = useState(0);
  const [exs, setExs] = useState(() => template.exercises.map(e => ({ ...e, setsData: Array.from({ length: e.sets }, () => ({ weight: e.lastWeight, reps: e.lastReps, done: false, rir: e.rir ?? null })) })));
  const [edit, setEdit] = useState(null); const [ew, setEw] = useState(0); const [er, setEr] = useState(0); const [erir, setErir] = useState(null);
  const [showAdd, setShowAdd] = useState(false); const [addCat, setAddCat] = useState("Chest"); const [addPg, setAddPg] = useState(0);
  const [stopwatch, setStopwatch] = useState(0); const [swRunning, setSwRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showIncompleteWarn, setShowIncompleteWarn] = useState(false);
  const [showReduceSetsPrompt, setShowReduceSetsPrompt] = useState(false);
  const [previewEx, setPreviewEx] = useState(null); // { name, equipment, icon, gifUrl, loading }
  const [demoIdx, setDemoIdx] = useState(null); // index of exercise showing inline animation
  const [swapIdx, setSwapIdx] = useState(null); // index of exercise being swapped
  const [swapAiLoading, setSwapAiLoading] = useState(false);
  const [swapAiResults, setSwapAiResults] = useState(null); // [{ name, equipment, reason }]
  const [showSwapUpsell, setShowSwapUpsell] = useState(false);
  const color = template.color;
  const isProgramWorkout = !!template.scheduledWorkoutId;
  const getRepRange = (exName, prescribedWeight) => {
    if (!isProgramWorkout) return null;
    const pr = prs.find(p => p.exercise_name?.toLowerCase() === exName?.toLowerCase());
    if (!pr?.estimated_1rm || !prescribedWeight) return null;
    const pct = prescribedWeight / pr.estimated_1rm;
    if (pct >= 0.95) return "1–2 reps";
    if (pct >= 0.90) return "2–3 reps";
    if (pct >= 0.85) return "3–5 reps";
    if (pct >= 0.80) return "5–6 reps";
    if (pct >= 0.75) return "6–8 reps";
    if (pct >= 0.70) return "8–10 reps";
    if (pct >= 0.65) return "10–12 reps";
    if (pct >= 0.60) return "12–15 reps";
    return "15+ reps";
  };
  const isPro = profile?.plan === "pro" || profile?.plan === "unlimited";

  // Returns up to 3 same-muscle alternatives from EX_LIB, excluding current + already-in-workout exercises
  const getLocalSwapOptions = (exerciseName) => {
    const sameMuscleName = getExercisesForMuscle(exerciseName);
    const inWorkout = new Set(exs.map(e => e.name));
    const results = [];
    for (const name of sameMuscleName) {
      if (inWorkout.has(name)) continue;
      // find full entry in EX_LIB
      for (const group of Object.values(EX_LIB)) {
        const entry = group.find(e => e.name === name);
        if (entry) { results.push(entry); break; }
      }
      if (results.length >= 3) break;
    }
    return results;
  };

  // Replace exercise at swapIdx with the chosen alternative, preserving setsData
  const handleSwap = (alt) => {
    setExs(prev => prev.map((e, i) => i === swapIdx
      ? { ...e, name: alt.name, equipment: alt.equipment }
      : e
    ));
    setSwapIdx(null);
    setSwapAiResults(null);
  };

  // Ask AI Coach for personalized swap suggestions
  const handleAiSwap = async () => {
    if (swapIdx === null) return;
    const ex = exs[swapIdx];
    setSwapAiLoading(true);
    setSwapAiResults(null);
    const prompt = `I'm doing "${ex.name}" (${ex.equipment}) but the equipment is unavailable. Suggest 3 alternative exercises targeting the same muscle group. Reply with ONLY a JSON array: [{"name":"...","equipment":"...","reason":"..."}]. No other text.`;
    try {
      const res = await callCoachAPI(prompt, "swap_exercise", null);
      const text = res?.content || res?.message || "";
      const match = text.match(/\[[\s\S]*\]/);
      const parsed = match ? JSON.parse(match[0]) : [];
      setSwapAiResults(Array.isArray(parsed) ? parsed.slice(0, 3) : []);
    } catch {
      setSwapAiResults([]);
    }
    setSwapAiLoading(false);
  };

  useEffect(() => { const i = setInterval(() => setTimer(t => t + 1), 1000); return () => clearInterval(i); }, []);
  useEffect(() => { if (!swRunning) return; const i = setInterval(() => setStopwatch(t => t + 1), 1000); return () => clearInterval(i); }, [swRunning]);
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const ts = exs.reduce((a, e) => a + e.setsData.length, 0), ds = exs.reduce((a, e) => a + e.setsData.filter(s => s.done).length, 0);
  const catExs = addCat === "Custom" ? customExercises.map(cx => ({ name: cx.name, equipment: cx.equipment || "Bodyweight", icon: cx.icon || "🏋️" })) : (EX_LIB[addCat] || []); const exPgs = []; for (let i = 0; i < catExs.length; i += 4) exPgs.push(catExs.slice(i, i + 4));

  const saveWorkout = async () => {
    setSaving(true);

    let totalVolume = 0;
    const completedSets = [];
    exs.forEach(ex => {
      ex.setsData.forEach((set, si) => {
        if (set.done) {
          totalVolume += set.weight * set.reps;
          completedSets.push({
            exercise_name: ex.name,
            set_number: si + 1,
            weight_kg: set.weight,
            reps: set.reps,
            completed: true,
            rpe: set.rir != null ? (10 - set.rir) : null
          });
        }
      });
    });

    const workoutData = {
      title: (template.label || template.name || "Workout") + (template.label?.endsWith("Day") || template.name?.endsWith("Day") ? "" : " Day"),
      started_at: new Date(Date.now() - timer * 1000).toISOString(),
      finished_at: new Date().toISOString(),
      duration_secs: timer,
      total_volume_kg: totalVolume,
      notes: ""
    };

    // Fall back to offline queue if no user, no connection, or save times out
    const saveOffline = () => { queueWorkout(workoutData, completedSets); };

    if (!isOnline || !user) {
      saveOffline();
      onFinish([]);
      setSaving(false);
      return;
    }

    try {
      const userId = user.id;

      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 20000)
      );

      const save = async () => {
        const { data: workout, error: workoutError } = await supabase
          .from("workouts")
          .insert({ ...workoutData, user_id: userId })
          .select()
          .single();

        if (workoutError) throw workoutError;

        // Link the completed workout to its scheduled_workout row so deletion can reset it
        if (template.scheduledWorkoutId) {
          await supabase.from("scheduled_workouts").update({ workout_id: workout.id }).eq("id", template.scheduledWorkoutId);
        }

        if (completedSets.length > 0) {
          const { error: setsError } = await supabase
            .from("workout_sets")
            .insert(completedSets.map(s => ({ ...s, workout_id: workout.id })));
          if (setsError) console.error("Error saving sets:", setsError);

          // Detect and upsert personal records (1RM and volume)
          const byExercise = {};
          completedSets.forEach(s => {
            if (!byExercise[s.exercise_name]) byExercise[s.exercise_name] = [];
            byExercise[s.exercise_name].push(s);
          });

          const newPRs = [];

          for (const [exerciseName, sets] of Object.entries(byExercise)) {
            // Best 1RM set: highest estimated 1RM (Epley formula)
            const best1rm = sets.reduce((best, s) => {
              const e1rm = s.reps === 1 ? s.weight_kg : s.weight_kg * (1 + s.reps / 30);
              return e1rm > best.e1rm ? { s, e1rm } : best;
            }, { s: null, e1rm: 0 });

            // Best volume set: highest weight × reps
            const bestVol = sets.reduce((best, s) => {
              const vol = s.weight_kg * s.reps;
              return vol > best.vol ? { s, vol } : best;
            }, { s: null, vol: 0 });

            // Check and upsert 1RM PR (one per exercise)
            if (best1rm.s) {
              const { data: existing } = await supabase
                .from("personal_records")
                .select("id, estimated_1rm")
                .eq("user_id", userId)
                .eq("exercise_name", exerciseName)
                .eq("pr_type", "1rm")
                .eq("is_active", true)
                .limit(1);

              const prevE1rm = existing?.[0]?.estimated_1rm ?? 0;
              const isFirstLog1rm = !existing?.length;
              if (best1rm.e1rm > prevE1rm) {
                // Deactivate old PR row, insert new one
                if (existing?.length) {
                  await supabase.from("personal_records").update({ is_active: false }).eq("id", existing[0].id);
                }
                await supabase.from("personal_records").insert({
                  user_id: userId, exercise_name: exerciseName,
                  weight_kg: best1rm.s.weight_kg, reps: best1rm.s.reps,
                  pr_type: "1rm", workout_id: workout.id, is_active: true
                });
                if (!isFirstLog1rm) {
                  newPRs.push({ exercise: exerciseName, type: "1rm", weight: best1rm.s.weight_kg, reps: best1rm.s.reps, e1rm: best1rm.e1rm });
                }
              }
            }

            // Check and upsert volume PR (one per exercise)
            if (bestVol.s) {
              const { data: existing } = await supabase
                .from("personal_records")
                .select("id, set_volume")
                .eq("user_id", userId)
                .eq("exercise_name", exerciseName)
                .eq("pr_type", "volume")
                .eq("is_active", true)
                .limit(1);

              const prevVol = existing?.[0]?.set_volume ?? 0;
              const isFirstLogVol = !existing?.length;
              if (bestVol.vol > prevVol) {
                // Deactivate old PR row, insert new one
                if (existing?.length) {
                  await supabase.from("personal_records").update({ is_active: false }).eq("id", existing[0].id);
                }
                await supabase.from("personal_records").insert({
                  user_id: userId, exercise_name: exerciseName,
                  weight_kg: bestVol.s.weight_kg, reps: bestVol.s.reps,
                  pr_type: "volume", workout_id: workout.id, is_active: true
                });
                if (!isFirstLogVol) {
                  newPRs.push({ exercise: exerciseName, type: "volume", weight: bestVol.s.weight_kg, reps: bestVol.s.reps, volume: bestVol.vol });
                }
              }
            }
          }

          return newPRs;
        }
      };

      const detectedPRs = await Promise.race([save(), timeout]) || [];
      setSaving(false);
      onFinish(detectedPRs);
      return;
    } catch (e) {
      console.error("Error saving workout:", e);
      saveOffline();
      if (e.message === "timeout") {
        alert("Supabase didn't respond in 20s — workout saved locally. Check that your Supabase project is active (free-tier projects pause after inactivity).");
      } else if (navigator.onLine) {
        alert("Failed to save to database (saved locally): " + (e.message || e.details || "Unknown error"));
      }
    }

    setSaving(false);
    onFinish([]);
  };

  return (
    <div style={{ padding: "0 20px 110px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 6px" }}><button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, color: "#fff", borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", opacity: saving ? 0.6 : 1 }} disabled={saving}>✕</button><button onClick={() => { if (isProgramWorkout && ds < ts) { setShowIncompleteWarn(true); } else { saveWorkout(); } }} style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)`, border: "none", color: C.bg, borderRadius: 12, padding: "8px 18px", fontSize: 13, fontWeight: 800, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }} disabled={saving}>Finish {saving ? "..." : isOnline ? "✓" : "✓ (offline)"}</button></div>
      <div style={{ textAlign: "center", padding: "10px 0 16px" }}><div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase" }}>{template.label}{template.label?.toLowerCase().includes("day") ? "" : " Day"}</div><div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, letterSpacing: 1, textTransform: "uppercase", marginTop: 8 }}>Workout Duration</div><div style={{ fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.55)", fontFamily: C.font, letterSpacing: -1, lineHeight: 1, margin: "2px 0 10px" }}>{fmt(timer)}</div><div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}><div style={{ width: 140, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 2, background: color, width: `${(ds / ts) * 100}%`, transition: "width .4s ease" }} /></div><span style={{ fontSize: 12, color: C.dim, fontFamily: C.mono }}>{ds}/{ts}</span></div></div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}><div><div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>Stopwatch</div><div style={{ fontSize: 32, fontWeight: 800, color: swRunning ? color : "#fff", fontFamily: C.font, letterSpacing: -1 }}>{fmt(stopwatch)}</div></div><div style={{ display: "flex", gap: 8, alignItems: "center" }}><button onClick={() => setSwRunning(r => !r)} style={{ background: swRunning ? `${color}20` : `${color}`, border: "none", color: swRunning ? color : C.bg, borderRadius: 12, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: C.mono }}>{swRunning ? "Stop" : "Start"}</button><button onClick={() => { setStopwatch(0); setSwRunning(false); }} style={{ background: "rgba(255,255,255,0.06)", border: "none", color: "rgba(255,255,255,0.4)", borderRadius: 12, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontFamily: C.mono }}>Reset</button></div></div>
      {exs.map((ex, ei) => (
        <div key={ei} style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.border}`, marginBottom: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div><div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{ex.name}</div><div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, marginTop: 2 }}>{ex.equipment}</div></div>{ex.rir !== undefined && <span style={{ padding: "3px 7px", borderRadius: 6, background: `${color}15`, border: `1px solid ${color}30`, fontSize: 9, fontWeight: 700, color, fontFamily: C.mono }}>Reps in Reserve {ex.rir}</span>}{(() => { const range = getRepRange(ex.name, ex.setsData[0]?.weight ?? ex.lastWeight); return range ? (<span style={{ padding: "3px 7px", borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.5)", fontFamily: C.mono }}>{range}</span>) : null; })()}</div></div><div style={{ display: "flex", gap: 6, alignItems: "center" }}><button onClick={() => { if (!isPro) { setShowSwapUpsell(true); } else { setSwapIdx(ei); setSwapAiResults(null); } }} style={{ background: "rgba(163,230,53,0.08)", border: "1px solid rgba(163,230,53,0.2)", borderRadius: 8, color: "rgba(163,230,53,0.7)", padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>🔄</button>{!isProgramWorkout && <button onClick={() => setExs(p => p.filter((_, i) => i !== ei))} style={{ background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.15)", borderRadius: 8, color: "rgba(255,80,80,0.6)", padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✕</button>}</div></div>
          {/* Exercise demo hidden until video assets are ready */}
          <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr 44px", padding: "0 16px 4px", fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: C.mono, letterSpacing: 1, textTransform: "uppercase" }}><div>Set</div><div>Kg</div><div>Reps</div><div style={{ textAlign: "center" }}>Log</div></div>
          {ex.setsData.map((s, si) => (
            <div key={si} style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr 44px", padding: "9px 16px", alignItems: "center", background: s.done ? `${color}06` : "transparent", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: s.done ? color : "rgba(255,255,255,0.25)", fontFamily: C.mono }}>{si + 1}</div>
              {isProgramWorkout
                ? <span style={{ fontSize: 15, fontWeight: 700, color: s.done ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.4)", fontFamily: C.font }}>{s.weight}</span>
                : <button onClick={() => { if (!s.done) { setEdit({ ei, si }); setEw(s.weight); setEr(s.reps); setErir(s.rir ?? null); } }} style={{ background: "none", border: "none", cursor: s.done ? "default" : "pointer", textAlign: "left", padding: 0, fontSize: 15, fontWeight: 700, color: s.done ? "rgba(255,255,255,0.4)" : "#fff", fontFamily: C.font, textDecoration: !s.done ? "underline dashed rgba(255,255,255,0.15)" : "none", textUnderlineOffset: 3 }}>{s.weight}</button>
              }
              <button onClick={() => { if (!s.done) { setEdit({ ei, si }); setEw(s.weight); setEr(s.reps); setErir(s.rir ?? null); } }} style={{ background: "none", border: "none", cursor: s.done ? "default" : "pointer", textAlign: "left", padding: 0, fontSize: 15, fontWeight: 700, color: s.done ? "rgba(255,255,255,0.4)" : "#fff", fontFamily: C.font, textDecoration: !s.done ? "underline dashed rgba(255,255,255,0.15)" : "none", textUnderlineOffset: 3 }}>{s.reps}</button>
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}><button onClick={() => { setExs(p => p.map((e, i) => i === ei ? { ...e, setsData: e.setsData.map((ss, j) => j === si ? { ...ss, done: !ss.done } : ss) } : e)); }} style={{ width: 32, height: 32, borderRadius: 10, border: "none", cursor: "pointer", background: s.done ? color : "rgba(255,255,255,0.05)", color: s.done ? C.bg : "rgba(255,255,255,0.15)", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.done ? "✓" : "○"}</button>{s.done && s.rir != null && <span style={{ fontSize: 8, fontWeight: 700, color: color, fontFamily: C.mono, letterSpacing: 0.5 }}>RIR {s.rir}</span>}</div>
            </div>
          ))}
          {!isProgramWorkout && <div style={{ padding: "8px 16px 12px" }}><button onClick={() => setExs(p => p.map((e, i) => i === ei ? { ...e, setsData: [...e.setsData, { weight: e.lastWeight, reps: e.lastReps, done: false, rir: null }] } : e))} style={{ background: "none", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.25)", padding: "7px", width: "100%", fontSize: 12, cursor: "pointer" }}>+ Add Set</button></div>}
        </div>
      ))}
      {!isProgramWorkout && <button onClick={() => { setShowAdd(true); setAddPg(0); }} style={{ width: "100%", padding: "15px", borderRadius: 16, background: C.card, border: "1px dashed rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>+ Add Exercise</button>}

      {edit && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(16px)", zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={() => setEdit(null)}><div onClick={e => e.stopPropagation()} style={{ background: "#111113", borderRadius: "26px 26px 0 0", padding: "28px 24px 40px" }}><div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", margin: "0 auto 20px" }} /><div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: C.font, textAlign: "center", marginBottom: 4 }}>{exs[edit.ei].name}</div><div style={{ fontSize: 12, color: C.dim, textAlign: "center", marginBottom: 24, fontFamily: C.mono }}>Set {edit.si + 1}</div><div style={{ display: "flex", flexDirection: "column", gap: 24, alignItems: "center" }}>{!isProgramWorkout && <WeightStepper value={ew} onChange={setEw} color={color} />}<RepBubbles value={er} onChange={setEr} color={color} /><RIRSlider value={erir} onChange={setErir} prescribed={exs[edit.ei].rir} color={color} isPro={isPro} onShowPricing={onShowPricing} /></div><button onClick={() => { setExs(p => p.map((e, i) => i === edit.ei ? { ...e, setsData: e.setsData.map((s, j) => j === edit.si ? { ...s, weight: isProgramWorkout ? s.weight : ew, reps: er, rir: isPro ? erir : s.rir } : s) } : e)); setEdit(null); }} style={{ width: "100%", padding: "16px", borderRadius: 16, border: "none", marginTop: 28, background: `linear-gradient(135deg, ${color}, ${color}CC)`, color: C.bg, fontSize: 16, fontWeight: 800, cursor: "pointer" }}>Save</button></div></div>}

      {showAdd && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(16px)", zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={() => setShowAdd(false)}><div onClick={e => e.stopPropagation()} style={{ background: "#111113", borderRadius: "26px 26px 0 0", padding: "24px 20px 40px" }}><div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", margin: "0 auto 18px" }} /><div style={{ fontSize: 20, fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: 18 }}>Add Exercise</div><div style={{ display: "flex", gap: 6, marginBottom: 18, overflowX: "auto" }}>{[...Object.keys(EX_LIB), ...(customExercises.length > 0 ? ["Custom"] : [])].map(k => (<Pill key={k} active={addCat === k} color={k === "Custom" ? C.ai : color} onClick={() => { setAddCat(k); setAddPg(0); }}>{k}</Pill>))}</div>{onBrowseLibrary && <button onClick={() => { setShowAdd(false); onBrowseLibrary(); }} style={{ width: "100%", padding: "12px", borderRadius: 14, border: "1px dashed rgba(255,255,255,0.15)", background: "none", color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer", marginBottom: 14, fontFamily: C.font }}>Browse Full Library →</button>}<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>{(exPgs[addPg] || []).map((ex, i) => { const a = exs.some(e => e.name === ex.name); return (<button key={i} disabled={a} onClick={async () => { if (a) return; setPreviewEx({ name: ex.name, equipment: ex.equipment, icon: ex.icon, gifUrl: null, loading: true }); setShowAdd(false); const gifUrl = await getExerciseGif(ex.name); setPreviewEx(p => p ? { ...p, gifUrl, loading: false } : null); }} style={{ padding: "16px 14px", borderRadius: 16, border: a ? `1px solid ${color}30` : `1px solid ${C.border}`, background: a ? `${color}08` : C.card, cursor: a ? "default" : "pointer", textAlign: "left", opacity: a ? 0.5 : 1 }}><div style={{ fontSize: 22, marginBottom: 6 }}>{ex.icon}</div><div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{ex.name}</div><div style={{ fontSize: 10, color: C.dim, marginTop: 3, fontFamily: C.mono }}>{ex.equipment}</div></button>); })}</div>{exPgs.length > 1 && <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>{exPgs.map((_, i) => (<button key={i} onClick={() => setAddPg(i)} style={{ width: addPg === i ? 22 : 8, height: 8, borderRadius: 4, border: "none", cursor: "pointer", background: addPg === i ? color : "rgba(255,255,255,0.1)" }} />))}</div>}</div></div>}

      {showIncompleteWarn && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)", zIndex: 300, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}
          onClick={() => { setShowIncompleteWarn(false); setShowReduceSetsPrompt(false); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#111113", borderRadius: "26px 26px 0 0", padding: "28px 24px 44px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", margin: "0 auto 24px" }} />
            {!showReduceSetsPrompt && (
              <>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 8 }}>Heads up</div>
                <div style={{ fontSize: 14, color: C.dim, lineHeight: 1.5, marginBottom: 28 }}>
                  You have <span style={{ color: "#fff", fontWeight: 700 }}>{ts - ds} set{ts - ds !== 1 ? "s" : ""}</span> still to log.
                  Did you finish the workout early?
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button onClick={() => setShowReduceSetsPrompt(true)} style={{ padding: "15px", borderRadius: 16, border: "none", background: `linear-gradient(135deg, ${color}, ${color}CC)`, color: C.bg, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: C.font }}>
                    Yes, I couldn't finish
                  </button>
                  <button onClick={() => { setShowIncompleteWarn(false); saveWorkout(); }} style={{ padding: "15px", borderRadius: 16, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: C.font }}>
                    Finish anyway
                  </button>
                </div>
              </>
            )}
            {showReduceSetsPrompt && (
              <>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 8 }}>Adjust future workouts?</div>
                <div style={{ fontSize: 14, color: C.dim, lineHeight: 1.5, marginBottom: 28 }}>
                  To keep upcoming sessions achievable, we can reduce the number of sets for this workout type across your remaining weeks.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button onClick={async () => {
                    setShowIncompleteWarn(false);
                    setShowReduceSetsPrompt(false);
                    await saveWorkout();
                    const incompleteExercises = exs.filter(e => e.setsData.some(s => !s.done)).map(e => e.name);
                    try { await reduceSetsFutureWorkouts(template.scheduledWorkoutId, incompleteExercises); } catch (e) { console.error("reduceSetsFutureWorkouts error:", e); }
                  }} style={{ padding: "15px", borderRadius: 16, border: "none", background: `linear-gradient(135deg, ${color}, ${color}CC)`, color: C.bg, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: C.font }}>
                    Yes, reduce sets
                  </button>
                  <button onClick={() => { setShowIncompleteWarn(false); setShowReduceSetsPrompt(false); saveWorkout(); }} style={{ padding: "15px", borderRadius: 16, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: C.font }}>
                    No, keep as planned
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {previewEx && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)", zIndex: 210, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={() => setPreviewEx(null)}><div onClick={e => e.stopPropagation()} style={{ background: "#111113", borderRadius: "26px 26px 0 0", padding: "24px 20px 40px" }}><div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", margin: "0 auto 18px" }} /><div style={{ textAlign: "center", marginBottom: 20 }}><div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>{previewEx.equipment}</div><div style={{ fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: C.font }}>{previewEx.name}</div></div><div style={{ width: "100%", height: 220, borderRadius: 20, background: C.card, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, overflow: "hidden", position: "relative" }}>{previewEx.loading ? (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}><div style={{ fontSize: 40 }}>{previewEx.icon}</div><div style={{ fontSize: 12, color: C.dim, fontFamily: C.mono }}>Loading demo...</div></div>) : previewEx.gifUrl ? (<img src={previewEx.gifUrl} alt={previewEx.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />) : (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}><div style={{ fontSize: 48 }}>{previewEx.icon}</div><div style={{ fontSize: 12, color: C.dim, fontFamily: C.mono }}>No demo available</div></div>)}</div><div style={{ display: "flex", gap: 10 }}><button onClick={() => { setPreviewEx(null); setShowAdd(true); }} style={{ flex: 1, padding: "14px", borderRadius: 16, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: C.font }}>Back</button><button onClick={() => { setExs(p => [...p, { name: previewEx.name, equipment: previewEx.equipment, lastWeight: 20, lastReps: 10, sets: 3, setsData: [{ weight: 20, reps: 10, done: false, rir: null }, { weight: 20, reps: 10, done: false, rir: null }, { weight: 20, reps: 10, done: false, rir: null }] }]); setPreviewEx(null); }} style={{ flex: 2, padding: "14px", borderRadius: 16, border: "none", background: `linear-gradient(135deg, ${color}, ${color}CC)`, color: C.bg, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: C.font }}>Add to Workout</button></div></div></div>}

      {/* Swap Upsell — free user bottom sheet */}
      {showSwapUpsell && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(16px)", zIndex: 220, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={() => setShowSwapUpsell(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#111113", borderRadius: "26px 26px 0 0", padding: "28px 20px 44px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", margin: "0 auto 24px" }} />
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
              <div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Pro Feature</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 8 }}>Smart Exercise Swap</div>
              <div style={{ fontSize: 14, color: C.dim, lineHeight: 1.5 }}>Get AI-powered alternatives that target the same muscles, with reasons tailored to your training.</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => { setShowSwapUpsell(false); onShowPricing(); }} style={{ padding: "15px", borderRadius: 16, border: "none", background: `linear-gradient(135deg, ${color}, ${color}CC)`, color: C.bg, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: C.font }}>
                Upgrade to Pro
              </button>
              <button onClick={() => setShowSwapUpsell(false)} style={{ padding: "15px", borderRadius: 16, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: C.font }}>
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Swap Selection Modal — pro user */}
      {swapIdx !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)", zIndex: 220, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={() => { setSwapIdx(null); setSwapAiResults(null); }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#111113", borderRadius: "26px 26px 0 0", padding: "24px 20px 44px", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", margin: "0 auto 18px" }} />
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Swap Exercise</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: C.font }}>{exs[swapIdx]?.name}</div>
            </div>

            {/* Local alternatives */}
            {(() => {
              const locals = getLocalSwapOptions(exs[swapIdx]?.name);
              return locals.length > 0 ? (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Same-Muscle Alternatives</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {locals.map((alt, i) => (
                      <button key={i} onClick={() => handleSwap(alt)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 16, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer", textAlign: "left", width: "100%" }}>
                        <div style={{ fontSize: 28, flexShrink: 0 }}>{alt.icon || "💪"}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: C.font }}>{alt.name}</div>
                          <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{alt.equipment}</div>
                        </div>
                        <div style={{ fontSize: 18, color: C.dim }}>→</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {/* AI suggestions button */}
            {!swapAiResults && (
              <button onClick={handleAiSwap} disabled={swapAiLoading} style={{ width: "100%", padding: "14px", borderRadius: 16, border: `1px solid ${color}60`, background: `${color}15`, color: swapAiLoading ? C.dim : color, fontSize: 14, fontWeight: 700, cursor: swapAiLoading ? "default" : "pointer", fontFamily: C.font, marginBottom: 12 }}>
                {swapAiLoading ? "Asking AI..." : "✨ Get AI Suggestions"}
              </button>
            )}

            {/* AI results */}
            {swapAiResults && swapAiResults.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#a3e635", fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>✨ AI Suggestions</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {swapAiResults.map((alt, i) => (
                    <button key={i} onClick={() => handleSwap(alt)} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", borderRadius: 16, border: "1px solid #a3e63540", background: "#a3e63510", cursor: "pointer", textAlign: "left", width: "100%" }}>
                      <div style={{ fontSize: 28, flexShrink: 0 }}>✨</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: C.font }}>{alt.name}</div>
                        <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{alt.equipment}</div>
                        {alt.reason && <div style={{ fontSize: 12, color: "#a3e635", marginTop: 4, lineHeight: 1.4 }}>{alt.reason}</div>}
                      </div>
                      <div style={{ fontSize: 18, color: C.dim, flexShrink: 0 }}>→</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {swapAiResults && swapAiResults.length === 0 && (
              <div style={{ textAlign: "center", padding: "12px 0", color: C.dim, fontSize: 13 }}>No AI suggestions available. Try again later.</div>
            )}

            <button onClick={() => { setSwapIdx(null); setSwapAiResults(null); }} style={{ width: "100%", padding: "14px", borderRadius: 16, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: C.font }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// === SECTION: Stats ===
/* ═══ STATS ═══ */
function StatsScreen({ workouts = [], prs = [], volumeTrend = [], onNav, profile }) {
  const m = useMountAnimation();
  const [sets, setSets] = useState([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [period, setPeriod] = useState("4W");
  const [strengthSheet, setStrengthSheet] = useState(false);
  const [selectedLift, setSelectedLift] = useState("Bench Press");
  const [expandedPlateaus, setExpandedPlateaus] = useState(false);

  useEffect(() => {
    const ids = workouts.map(w => w.id).filter(Boolean);
    getWorkoutSets(ids).then(data => { setSets(data); setLoadingSets(false); });
  }, [workouts]);

  // Time filter
  const periodCutoff = { "4W": 28, "3M": 90, "All": 99999 }[period];
  const cutoffDate = new Date(Date.now() - periodCutoff * 86400000);
  const filteredWorkouts = workouts.filter(w => new Date(w.started_at) >= cutoffDate);
  const filteredWorkoutIds = new Set(filteredWorkouts.map(w => w.id));
  const filteredSets = sets.filter(s => filteredWorkoutIds.has(s.workout_id));

  // Epley helper
  const e1rm = (w, r) => (r === 1 ? w : w * (1 + r / 30));

  // Insight A — Strength per lift
  const KEY_LIFTS = ["Bench Press", "Back Squat", "Deadlift"];
  const strengthData = KEY_LIFTS.map(lift => {
    const liftSets = filteredSets.filter(s => s.exercise_name === lift);
    const sessionMap = {};
    liftSets.forEach(s => {
      const val = e1rm(s.weight_kg, s.reps);
      sessionMap[s.workout_id] = Math.max(sessionMap[s.workout_id] || 0, val);
    });
    const sessions = Object.entries(sessionMap).map(([wid, val]) => {
      const wo = filteredWorkouts.find(w => w.id === wid);
      return { date: wo?.started_at || "", val };
    }).sort((a, b) => a.date.localeCompare(b.date));
    const current = sessions.at(-1)?.val || 0;
    const oldest = sessions[0]?.val || 0;
    const delta = oldest > 0 && sessions.length > 1 ? ((current - oldest) / oldest) * 100 : null;
    const chartData = sessions.map((s, i) => ({ w: `W${i + 1}`, v: Math.round(s.val) }));
    return { lift, current: Math.round(current), delta, chartData };
  });

  // Insight B — Consistency (always last 28 days)
  const trainedDays = new Set(workouts.map(w => w.started_at?.slice(0, 10)));
  const dotGrid = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(Date.now() - (27 - i) * 86400000);
    return trainedDays.has(d.toISOString().slice(0, 10));
  });
  let streak = 0;
  for (let i = dotGrid.length - 1; i >= 0; i--) {
    if (dotGrid[i]) streak++; else if (streak > 0) break;
  }
  const trainedIn28 = dotGrid.filter(Boolean).length;
  const target = (profile?.training_frequency ?? 3) * 4;
  const completionRate = Math.min(100, Math.round(trainedIn28 / target * 100));

  // Insight C — Volume delta
  const weekStart = d => { const s = new Date(d); s.setDate(s.getDate() - s.getDay()); return s.toDateString(); };
  const thisWeek = weekStart(new Date());
  const lastWeek = weekStart(new Date(Date.now() - 7 * 86400000));
  const thisWeekVol = workouts.filter(w => weekStart(w.started_at) === thisWeek).reduce((s, w) => s + (w.total_volume_kg || 0), 0);
  const lastWeekVol = workouts.filter(w => weekStart(w.started_at) === lastWeek).reduce((s, w) => s + (w.total_volume_kg || 0), 0);
  const volumeDelta = lastWeekVol > 0 ? Math.round((thisWeekVol - lastWeekVol) / lastWeekVol * 100) : null;

  // Insight D — Muscle split (fix)
  const muscleColors = { Chest: "#DFFF3C", Back: "#3CFFF0", Legs: "#FF6B3C", Shoulders: "#B47CFF", Arms: "#47B8FF" };
  const muscleCounts = {};
  filteredSets.forEach(s => {
    const g = MUSCLE_MAP[s.exercise_name];
    if (g && muscleColors[g]) muscleCounts[g] = (muscleCounts[g] || 0) + 1;
  });
  const muscleEntries = Object.entries(muscleColors).map(([name, color]) => ({ name, color, count: muscleCounts[name] || 0 }));
  const maxMuscle = Math.max(...muscleEntries.map(e => e.count), 1);

  // Insight E — Plateau detection
  const plateaus = [];
  const exerciseNames = [...new Set(filteredSets.map(s => s.exercise_name))];
  exerciseNames.forEach(name => {
    const exSets = filteredSets.filter(s => s.exercise_name === name);
    const byWorkout = {};
    exSets.forEach(s => { byWorkout[s.workout_id] = Math.max(byWorkout[s.workout_id] || 0, e1rm(s.weight_kg, s.reps)); });
    const sessions = Object.entries(byWorkout).map(([wid, val]) => {
      const wo = filteredWorkouts.find(w => w.id === wid);
      return { date: wo?.started_at || "", val };
    }).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
    if (sessions.length >= 3) {
      const [s1, , s3] = sessions;
      if (s1.val <= s3.val * 1.01) {
        const daysSince = Math.round((Date.now() - new Date(s3.date)) / 86400000);
        plateaus.push({ exercise: name, daysSince, current: Math.round(s1.val) });
      }
    }
  });

  const cardStyle = { background: C.card, borderRadius: 18, padding: "18px", border: `1px solid ${C.border}`, marginBottom: 16 };
  const labelStyle = { fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 };

  return (
    <div style={{ padding: "0 20px 110px", opacity: m ? 1 : 0, transition: "opacity .4s" }}>
      {/* Header */}
      <div style={{ padding: "14px 0 16px" }}>
        <div style={{ fontSize: 12, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>Analytics</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: C.font, marginTop: 2 }}>Progress</div>
      </div>

      {/* Time filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["4W", "3M", "All"].map(p => (
          <Pill key={p} active={period === p} color={C.accent} onClick={() => setPeriod(p)}>{p}</Pill>
        ))}
      </div>

      {/* Empty state */}
      {workouts.length === 0 ? (
        <div style={{ textAlign: "center", paddingTop: 80 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>No data yet</div>
          <div style={{ fontSize: 14, color: C.dim, marginTop: 8 }}>Complete your first workout to see insights</div>
        </div>
      ) : (
        <>
          {/* A. Strength Hero */}
          <div style={{ ...cardStyle, border: `1px solid ${C.accent}28` }}>
            <div style={labelStyle}>Strength Trends</div>
            {loadingSets ? (
              <div style={{ color: C.dim, fontSize: 13, textAlign: "center", padding: "12px 0" }}>Loading...</div>
            ) : (
              <>
                {KEY_LIFTS.map((lift, i) => {
                  const d = strengthData[i];
                  return (
                    <div key={lift} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#fff", minWidth: 100 }}>{lift}</span>
                      {d.current > 0 ? (
                        <>
                          <span style={{ fontSize: 16, fontWeight: 800, color: C.accent, fontFamily: C.mono }}>{d.current}kg</span>
                          {d.delta !== null ? (
                            <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 8, background: d.delta >= 0 ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)", color: d.delta >= 0 ? "#4ADE80" : "#F87171" }}>
                              {d.delta >= 0 ? "+" : ""}{Math.round(d.delta)}%
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: C.dim }}>─</span>
                          )}
                        </>
                      ) : (
                        <span style={{ fontSize: 12, color: C.dim }}>No data yet</span>
                      )}
                    </div>
                  );
                })}
                <button onClick={() => setStrengthSheet(true)} style={{ marginTop: 4, width: "100%", padding: "10px", borderRadius: 12, border: `1px solid ${C.accent}40`, background: `${C.accent}10`, color: C.accent, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: C.font }}>
                  View trends →
                </button>
              </>
            )}
          </div>

          {/* B. Consistency */}
          <div style={cardStyle}>
            <div style={labelStyle}>Consistency</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{streak}</div>
                <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>day streak</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: C.accent, lineHeight: 1 }}>{completionRate}%</div>
                <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>4-week rate</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
              {dotGrid.map((hit, i) => (
                <div key={i} style={{ width: "100%", aspectRatio: "1", borderRadius: "50%", background: hit ? C.accent : C.border }} />
              ))}
            </div>
          </div>

          {/* C. Volume Trend */}
          <div style={cardStyle}>
            <div style={labelStyle}>Volume Trend</div>
            <MiniChart data={volumeTrend.length > 0 ? volumeTrend.map((t, i) => ({ w: t.w || `W${i + 1}`, v: t.v || t.volume || 0 })) : (thisWeekVol > 0 ? [{ w: "W1", v: Math.round(thisWeekVol) }] : [{ w: "W1", v: 0 }])} h={70} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
              <span style={{ fontSize: 13, color: C.dim }}>
                This week: {Math.round(thisWeekVol).toLocaleString()}kg
                {volumeDelta !== null && (
                  <span style={{ color: volumeDelta >= 0 ? "#4ADE80" : "#F87171", marginLeft: 6 }}>
                    {volumeDelta >= 0 ? "+" : ""}{volumeDelta}% vs last
                  </span>
                )}
              </span>
              {onNav && (
                <button onClick={() => onNav("weekDetail")} style={{ fontSize: 13, color: C.accent, background: "none", border: "none", cursor: "pointer", fontFamily: C.font, padding: 0 }}>
                  See week →
                </button>
              )}
            </div>
          </div>

          {/* D. Muscle Split */}
          <div style={cardStyle}>
            <div style={labelStyle}>Muscle Split</div>
            {loadingSets ? (
              <div style={{ color: C.dim, fontSize: 13, textAlign: "center", padding: "12px 0" }}>Computing...</div>
            ) : (
              <>
                {muscleEntries.every(e => e.count === 0) && (
                  <div style={{ fontSize: 12, color: C.dim, marginBottom: 10 }}>No sets logged yet</div>
                )}
                {muscleEntries.map((mg, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{mg.name}</span>
                      <span style={{ fontSize: 11, color: C.dim, fontFamily: C.mono }}>{mg.count} sets</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 3, background: mg.color, width: m ? `${(mg.count / maxMuscle) * 100}%` : "0%", transition: `width .7s cubic-bezier(.22,1,.36,1) ${.15 + i * .08}s` }} />
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* E. Plateau Alerts */}
          {!loadingSets && plateaus.length > 0 && (
            <div style={{ ...cardStyle, border: "1px solid rgba(255,180,50,0.2)" }}>
              <div style={{ ...labelStyle, color: "#FFB432" }}>Plateau Alerts</div>
              {(expandedPlateaus ? plateaus : plateaus.slice(0, 1)).map((p, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>⚠ {p.exercise}</div>
                    <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>No improvement in {p.daysSince} days · e1RM: {p.current}kg</div>
                  </div>
                </div>
              ))}
              {plateaus.length > 1 && (
                <button onClick={() => setExpandedPlateaus(e => !e)} style={{ marginTop: 4, padding: "8px 14px", borderRadius: 10, border: `1px solid rgba(255,180,50,0.3)`, background: "rgba(255,180,50,0.08)", color: "#FFB432", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: C.font }}>
                  {expandedPlateaus ? "Collapse" : `Show all ${plateaus.length}`}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Strength Drill Sheet */}
      {strengthSheet && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)", zIndex: 210, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={() => setStrengthSheet(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#111113", borderRadius: "26px 26px 0 0", padding: "24px 20px 48px", maxHeight: "75vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", margin: "0 auto 18px" }} />
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 18, textAlign: "center" }}>Strength Trends</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20, justifyContent: "center" }}>
              {KEY_LIFTS.map(lift => (
                <Pill key={lift} active={selectedLift === lift} color={C.accent} onClick={() => setSelectedLift(lift)}>{lift.split(" ")[0]}</Pill>
              ))}
            </div>
            {(() => {
              const d = strengthData.find(s => s.lift === selectedLift);
              return d ? (
                <>
                  {d.chartData.length >= 2 ? (
                    <MiniChart data={d.chartData} h={100} color={C.accent} />
                  ) : (
                    <div style={{ textAlign: "center", padding: "30px 0", color: C.dim }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>○</div>
                      <div style={{ fontSize: 13 }}>Not enough data</div>
                      <div style={{ fontSize: 11, marginTop: 4 }}>Train {selectedLift} again to see your trend</div>
                    </div>
                  )}
                  <div style={{ textAlign: "center", marginTop: 16 }}>
                    <div style={{ fontSize: 32, fontWeight: 800, color: C.accent, fontFamily: C.mono }}>{d.current > 0 ? `${d.current}kg` : "—"}</div>
                    <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>Estimated 1RM</div>
                    {d.delta !== null && (
                      <div style={{ fontSize: 14, fontWeight: 700, color: d.delta >= 0 ? "#4ADE80" : "#F87171", marginTop: 8 }}>
                        {d.delta >= 0 ? "+" : ""}{Math.round(d.delta)}% over period
                      </div>
                    )}
                  </div>
                </>
              ) : null;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// === SECTION: Export ===
/* ═══ EXPORT HELPERS ═══ */

async function triggerDownload(content, filename, mimeType) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const base64 = btoa(unescape(encodeURIComponent(content)));
    const result = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
    await Share.share({ title: filename, url: result.uri, dialogTitle: "Save file" });
    return `Exported ${filename}`;
  }
  // Desktop / web browser — standard download
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvQuote(v) {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildWorkoutCSV(workouts, sets) {
  const rows = ["Date,Workout Title,Duration (min),Total Volume (kg),Exercise,Set #,Weight (kg),Reps,RPE,Notes"];
  const setsByWorkout = {};
  sets.forEach(s => {
    if (!setsByWorkout[s.workout_id]) setsByWorkout[s.workout_id] = [];
    setsByWorkout[s.workout_id].push(s);
  });
  workouts.forEach(wo => {
    const date = new Date(wo.started_at).toLocaleDateString("en-GB");
    const dur = Math.round((wo.duration_secs || 0) / 60);
    const vol = Math.round(wo.total_volume_kg || 0);
    const woSets = setsByWorkout[wo.id] || [];
    if (woSets.length === 0) {
      rows.push([date, csvQuote(wo.title || "Workout"), dur, vol, "", "", "", "", "", csvQuote(wo.notes || "")].join(","));
    } else {
      woSets.forEach(s => {
        rows.push([date, csvQuote(wo.title || "Workout"), dur, vol, csvQuote(s.exercise_name), s.set_number || "", s.weight_kg || "", s.reps || "", s.rpe || "", csvQuote(wo.notes || "")].join(","));
      });
    }
  });
  return rows.join("\n");
}

function buildPRCSV(prs) {
  const rows = ["Exercise,PR Type,Best Weight (kg),Reps,Estimated 1RM (kg),Set Volume (kg),Date Achieved"];
  prs.forEach(p => {
    const date = new Date(p.achieved_at).toLocaleDateString("en-GB");
    rows.push([csvQuote(p.exercise_name), p.pr_type || "1rm", p.weight_kg || "", p.reps || "", Math.round(p.estimated_1rm || p.weight_kg) || "", Math.round(p.set_volume || (p.weight_kg * p.reps)) || "", date].join(","));
  });
  return rows.join("\n");
}

async function generatePDF(workouts, sets, prs, dateRangeLabel, userName) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = margin;

  const checkPage = (needed = 10) => {
    if (y + needed > 277) { doc.addPage(); y = margin; }
  };

  // Header
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, 297, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(30, 30, 30);
  doc.text("gAIns Training Report", margin, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  const genDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  doc.text(`Generated: ${genDate}  |  User: ${userName || "Athlete"}  |  Period: ${dateRangeLabel}`, margin, y);
  y += 4;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, margin + contentW, y);
  y += 8;

  // Summary
  const totalVol = workouts.reduce((sum, wo) => sum + (wo.total_volume_kg || 0), 0);
  const avgDur = workouts.length > 0 ? Math.round(workouts.reduce((sum, wo) => sum + (wo.duration_secs || 0), 0) / workouts.length / 60) : 0;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text("SUMMARY", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Total workouts: ${workouts.length}   |   Total volume: ${Math.round(totalVol).toLocaleString()} kg   |   Avg duration: ${avgDur} min`, margin, y);
  y += 10;

  // PR table
  if (prs.length > 0) {
    checkPage(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text("PERSONAL RECORDS", margin, y);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const prCols = [margin, margin + 70, margin + 110, margin + 145];
    doc.text("Exercise", prCols[0], y);
    doc.text("Best Set", prCols[1], y);
    doc.text("e1RM", prCols[2], y);
    doc.text("Date", prCols[3], y);
    y += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, margin + contentW, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    prs.filter(p => p.weight_kg > 0).forEach(p => {
      checkPage(6);
      const date = new Date(p.achieved_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      doc.text(p.exercise_name.substring(0, 28), prCols[0], y);
      doc.text(`${p.weight_kg}kg × ${p.reps}`, prCols[1], y);
      doc.text(`${Math.round(p.estimated_1rm || p.weight_kg)}kg`, prCols[2], y);
      doc.text(date, prCols[3], y);
      y += 5;
    });
    y += 4;
  }

  // Workout log
  if (workouts.length > 0) {
    checkPage(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text("WORKOUT LOG", margin, y);
    y += 8;

    const setsByWorkout = {};
    sets.forEach(s => {
      if (!setsByWorkout[s.workout_id]) setsByWorkout[s.workout_id] = {};
      if (!setsByWorkout[s.workout_id][s.exercise_name]) setsByWorkout[s.workout_id][s.exercise_name] = [];
      setsByWorkout[s.workout_id][s.exercise_name].push(s);
    });

    [...workouts].sort((a, b) => new Date(b.started_at) - new Date(a.started_at)).forEach(wo => {
      checkPage(14);
      const date = new Date(wo.started_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      const dur = Math.round((wo.duration_secs || 0) / 60);
      const vol = Math.round(wo.total_volume_kg || 0).toLocaleString();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 30, 30);
      doc.text(`${date} — ${wo.title || "Workout"}  (${dur} min · ${vol} kg)`, margin, y);
      y += 5;
      const woExercises = setsByWorkout[wo.id] || {};
      Object.entries(woExercises).forEach(([exName, exSets]) => {
        checkPage(6);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.5);
        doc.setTextColor(60, 60, 60);
        const setsStr = exSets.map((s, i) => `Set ${i + 1}: ${s.weight_kg}×${s.reps}`).join("   ");
        doc.text(`  ${exName}`, margin + 4, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        const setsX = margin + 4 + doc.getTextWidth(`  ${exName}`) + 4;
        doc.text(setsStr, setsX, y);
        y += 5;
      });
      y += 3;
    });
  }

  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const base64 = doc.output("datauristring").split(",")[1];
    const result = await Filesystem.writeFile({ path: "gains-report.pdf", data: base64, directory: Directory.Cache });
    await Share.share({ title: "gAIns Training Report", url: result.uri, dialogTitle: "Save file" });
    return "Exported gains-report.pdf";
  }
  doc.save("gains-report.pdf");
}

/* ═══ EXPORT MODAL ═══ */
function ExportModal({ plan, workouts = [], prs = [], onClose, onShowPricing, initialType = "both", userName }) {
  const isFree = plan === "free";
  const [exportType, setExportType] = useState(initialType);
  const [dateRange, setDateRange] = useState("all");
  const [format, setFormat] = useState("csv");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      let filtered = workouts;
      let dateRangeLabel = "All time";
      if (dateRange === "90d") {
        const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 90);
        filtered = workouts.filter(wo => new Date(wo.started_at) >= cutoff);
        dateRangeLabel = "Last 90 days";
      } else if (dateRange === "30d") {
        const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 30);
        filtered = workouts.filter(wo => new Date(wo.started_at) >= cutoff);
        dateRangeLabel = "Last 30 days";
      }

      const ids = filtered.map(wo => wo.id).filter(Boolean);
      const sets = ids.length > 0 ? await getWorkoutSets(ids) : [];

      const filteredPRs = dateRange === "all" ? prs : prs.filter(p => {
        const cutoffDays = dateRange === "90d" ? 90 : 30;
        const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - cutoffDays);
        return new Date(p.achieved_at) >= cutoff;
      });

      if (format === "pdf") {
        const prsForPDF = exportType === "history" ? [] : filteredPRs;
        const wosForPDF = exportType === "prs" ? [] : filtered;
        const msg = await generatePDF(wosForPDF, sets, prsForPDF, dateRangeLabel, userName);
        if (msg) { setSuccess(msg); } else { onClose(); }
        return;
      }

      // CSV
      let msg;
      if (exportType === "both") {
        const woCsv = buildWorkoutCSV(filtered, sets);
        const prCsv = buildPRCSV(filteredPRs);
        await triggerDownload(woCsv, "gains-history.csv", "text/csv");
        msg = await triggerDownload(prCsv, "gains-prs.csv", "text/csv");
      } else if (exportType === "history") {
        msg = await triggerDownload(buildWorkoutCSV(filtered, sets), "gains-history.csv", "text/csv");
      } else {
        msg = await triggerDownload(buildPRCSV(filteredPRs), "gains-prs.csv", "text/csv");
      }
      if (msg) { setSuccess(msg); } else { onClose(); }
    } catch (e) {
      console.error("Export error:", e); setError(`Export failed: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const PillGroup = ({ label, options, value, onChange }) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", gap: 8 }}>
        {options.map(o => (
          <button key={o.value} onClick={() => onChange(o.value)} style={{
            flex: 1, padding: "9px 6px", borderRadius: 12, fontSize: 12, fontWeight: 700, fontFamily: C.font, cursor: "pointer",
            background: value === o.value ? C.accent : C.card,
            color: value === o.value ? C.bg : "#fff",
            border: value === o.value ? "none" : `1px solid ${C.border}`,
            transition: "all .15s"
          }}>{o.label}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ flex: 1, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} />
      <div style={{ background: "#1a1a1f", borderRadius: "24px 24px 0 0", padding: "24px 20px 40px", borderTop: `1px solid ${C.border}` }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 20px" }} />
        <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 4 }}>Export Data</div>
        <div style={{ fontSize: 12, color: C.dim, marginBottom: 22 }}>Download your training data as a file</div>

        <PillGroup
          label="Data"
          options={[{ value: "both", label: "Both" }, { value: "history", label: "History" }, { value: "prs", label: "PRs" }]}
          value={exportType}
          onChange={setExportType}
        />
        <PillGroup
          label="Period"
          options={[{ value: "all", label: "All time" }, { value: "90d", label: "Last 90d" }, { value: "30d", label: "Last 30d" }]}
          value={dateRange}
          onChange={setDateRange}
        />
        <PillGroup
          label="Format"
          options={[{ value: "csv", label: "CSV" }, { value: "pdf", label: "PDF" }]}
          value={format}
          onChange={setFormat}
        />

        {error && <div style={{ fontSize: 12, color: "#FF6B3C", marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ fontSize: 13, color: C.accent, fontWeight: 700, marginBottom: 12, textAlign: "center" }}>{success}</div>}

        {isFree ? (
          <>
            <div style={{ fontSize: 13, color: C.dim, textAlign: "center", marginBottom: 12, lineHeight: 1.5 }}>
              Export is available on <span style={{ color: C.accent, fontWeight: 700 }}>Pro</span> and <span style={{ color: C.accent, fontWeight: 700 }}>Unlimited</span> plans
            </div>
            <button onClick={onShowPricing} style={{
              width: "100%", padding: "14px", borderRadius: 16, fontSize: 15, fontWeight: 800, fontFamily: C.font,
              background: C.accent, color: C.bg, border: "none", cursor: "pointer", marginBottom: 10
            }}>Upgrade to Export</button>
          </>
        ) : (
          <button onClick={handleExport} disabled={loading || success} style={{
            width: "100%", padding: "14px", borderRadius: 16, fontSize: 15, fontWeight: 800, fontFamily: C.font,
            background: (loading || success) ? C.border : C.accent, color: (loading || success) ? C.dim : C.bg,
            border: "none", cursor: (loading || success) ? "not-allowed" : "pointer", marginBottom: 10
          }}>
            {loading ? "Exporting…" : success ? "Done" : `Export ${format.toUpperCase()}`}
          </button>
        )}
        <button onClick={onClose} style={{
          width: "100%", padding: "12px", borderRadius: 16, fontSize: 14, fontWeight: 700, fontFamily: C.font,
          background: "transparent", color: C.dim, border: `1px solid ${C.border}`, cursor: "pointer"
        }}>{success ? "Close" : "Cancel"}</button>
      </div>
    </div>
  );
}

// === SECTION: History ===
/* ═══ HISTORY ═══ */
function HistoryScreen({ workouts = [], prs = [], onDeleteWorkout, plan, onShowPricing, userName }) {
  const m = useMountAnimation();
  const [sets, setSets] = useState([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [expandedWorkouts, setExpandedWorkouts] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null); // workout id pending delete
  const [deleting, setDeleting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const toggleWorkout = (id) => setExpandedWorkouts(p => ({ ...p, [id]: !p[id] }));

  const handleDelete = async (id) => {
    setDeleting(true);
    try {
      await onDeleteWorkout(id);
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  // Load all sets for visible workouts
  useEffect(() => {
    (async () => {
      const ids = workouts.map(w => w.id).filter(Boolean);
      if (ids.length === 0) { setLoadingSets(false); return; }
      try { setSets(await getWorkoutSets(ids)); } catch (e) { console.error("Failed to load sets:", e); }
      setLoadingSets(false);
    })();
  }, [workouts.length]);

  const setsByWorkout = {};
  sets.forEach(s => {
    if (!setsByWorkout[s.workout_id]) setsByWorkout[s.workout_id] = {};
    if (!setsByWorkout[s.workout_id][s.exercise_name]) setsByWorkout[s.workout_id][s.exercise_name] = [];
    setsByWorkout[s.workout_id][s.exercise_name].push(s);
  });

  const prByWorkout = {};
  prs.forEach(p => { if (p.workout_id) { if (!prByWorkout[p.workout_id]) prByWorkout[p.workout_id] = new Set(); prByWorkout[p.workout_id].add(p.exercise_name); } });

  // Group workouts by day (most recent first)
  const sorted = [...workouts].sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
  const dayGroups = [];
  const dayMap = {};
  sorted.forEach(wo => {
    const dayKey = new Date(wo.started_at).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    if (!(dayKey in dayMap)) {
      dayMap[dayKey] = dayGroups.length;
      dayGroups.push({ label: dayKey, workouts: [] });
    }
    dayGroups[dayMap[dayKey]].workouts.push(wo);
  });

  return (
    <div style={{ padding: "0 20px 110px", opacity: m ? 1 : 0, transition: "opacity .4s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "14px 0 18px" }}>
        <div>
          <div style={{ fontSize: 12, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>Log</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: C.font, marginTop: 2 }}>History</div>
        </div>
        <button onClick={() => setExportOpen(true)} style={{ fontSize: 12, fontWeight: 700, color: plan === "free" ? C.dim : C.bg, background: plan === "free" ? C.card : C.accent, border: plan === "free" ? `1px solid ${C.border}` : "none", borderRadius: 12, padding: "8px 14px", cursor: "pointer", fontFamily: C.font }}>{plan === "free" ? "🔒 " : "↓ "}Export</button>
      </div>
      {workouts.length === 0 && (
        <div style={{ textAlign: "center", paddingTop: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: C.font, marginBottom: 6 }}>No Workouts Yet</div>
          <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.5 }}>Complete a workout and it will appear here.</div>
        </div>
      )}
      {exportOpen && (
        <ExportModal
          plan={plan}
          workouts={workouts}
          prs={prs}
          onClose={() => setExportOpen(false)}
          onShowPricing={() => { setExportOpen(false); onShowPricing(); }}
          userName={userName}
        />
      )}
      {dayGroups.map((group, gi) => (
        <div key={gi} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, fontFamily: C.mono, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{group.label}</div>
          {group.workouts.map((wo, wi) => {
            const woSets = setsByWorkout[wo.id] || {};
            const startTime = new Date(wo.started_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            const isOpen = !!expandedWorkouts[wo.id];
            return (
              <div key={wi} style={{ background: C.card, borderRadius: 16, marginBottom: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                <div onClick={() => toggleWorkout(wo.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", cursor: "pointer" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: C.font }}>
                      {wo.title || "Workout"} <span style={{ fontSize: 11, color: C.dim, fontWeight: 400 }}>{startTime}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{Math.round((wo.duration_secs || 0) / 60)} min · {Math.round(wo.total_volume_kg || 0).toLocaleString()} kg</div>
                  </div>
                  <span style={{ fontSize: 14, color: C.dim, transition: "transform .2s", transform: isOpen ? "rotate(90deg)" : "none", flexShrink: 0, marginLeft: 8 }}>→</span>
                </div>
                {isOpen && (
                  <div style={{ padding: "0 16px 14px" }}>
                    {wo.notes && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontStyle: "italic", marginBottom: 10, paddingLeft: 2 }}>"{wo.notes}"</div>}
                    {loadingSets ? (
                      <div style={{ fontSize: 12, color: C.dim, padding: "4px 0" }}>Loading sets...</div>
                    ) : Object.keys(woSets).length === 0 ? (
                      <div style={{ fontSize: 12, color: C.dim, padding: "4px 0" }}>No set data available</div>
                    ) : (
                      Object.entries(woSets).map(([exName, exSets], ei) => {
                        const hasPR = prByWorkout[wo.id]?.has(exName);
                        const rpesForEx = exSets.filter(s => s.rpe).map(s => s.rpe);
                        const avgRPE = rpesForEx.length > 0 ? (rpesForEx.reduce((a, b) => a + b, 0) / rpesForEx.length).toFixed(1) : null;
                        const bestSet = exSets.reduce((best, s) => ((s.weight_kg || 0) * (s.reps || 0) > (best.weight_kg || 0) * (best.reps || 0) ? s : best), exSets[0]);
                        return (
                          <div key={ei} style={{ marginBottom: ei < Object.keys(woSets).length - 1 ? 10 : 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{exName}</span>
                              {hasPR && <span style={{ fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: "rgba(255,220,50,0.15)", color: "#FFD700", fontFamily: C.mono, letterSpacing: .5 }}>PR</span>}
                              {avgRPE && <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(164,123,255,0.12)", color: C.ai, fontFamily: C.mono }}>RIR {(10 - parseFloat(avgRPE)).toFixed(1)}</span>}
                            </div>
                            {exSets.map((s, si) => {
                              const isBest = s === bestSet && exSets.length > 1;
                              return (
                                <div key={si} style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 8, marginBottom: 2 }}>
                                  <span style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, width: 40 }}>Set {s.set_number || si + 1}</span>
                                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontFamily: C.mono }}>{s.weight_kg}kg × {s.reps}{s.rpe ? ` @ RIR ${10 - s.rpe}` : ""}</span>
                                  {isBest && <span style={{ fontSize: 8, fontWeight: 800, padding: "1px 5px", borderRadius: 4, background: `${C.accent}18`, color: C.accent, fontFamily: C.mono }}>Best</span>}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })
                    )}
                    {onDeleteWorkout && (
                      <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                        {confirmDelete === wo.id ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 12, color: C.dim, flex: 1 }}>Delete this workout?</span>
                            <button onClick={() => handleDelete(wo.id)} disabled={deleting} style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "#e53935", border: "none", borderRadius: 8, padding: "5px 14px", cursor: "pointer", opacity: deleting ? 0.6 : 1 }}>
                              {deleting ? "Deleting…" : "Delete"}
                            </button>
                            <button onClick={() => setConfirmDelete(null)} disabled={deleting} style={{ fontSize: 12, color: C.dim, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(wo.id)} style={{ fontSize: 12, color: "#e53935", background: "transparent", border: "none", cursor: "pointer", padding: 0, fontFamily: C.font }}>
                            Delete workout
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ═══ WEEK DETAIL ═══ */
const MUSCLE_MAP = {
  "Bench Press": "Chest", "Incline DB Press": "Chest", "Cable Fly": "Chest", "Chest Dip": "Chest", "Machine Press": "Chest", "Push-ups": "Chest",
  "Deadlift": "Back", "Pull-ups": "Back", "Barbell Row": "Back", "Lat Pulldown": "Back", "Cable Row": "Back", "T-Bar Row": "Back",
  "Back Squat": "Legs", "Leg Press": "Legs", "Romanian DL": "Legs", "Walking Lunge": "Legs", "Leg Curl": "Legs", "Leg Extension": "Legs",
  "Overhead Press": "Shoulders", "Lateral Raise": "Shoulders", "Face Pull": "Shoulders", "Arnold Press": "Shoulders",
  "Barbell Curl": "Arms", "Hammer Curl": "Arms", "Tricep Pushdown": "Arms", "Skull Crusher": "Arms",
};

// === SECTION: Week Detail ===
function WeekDetailScreen({ onBack, workouts = [], prs = [] }) {
  const m = useMountAnimation();
  const [sets, setSets] = useState([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [aiInsight, setAiInsight] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [expandedWorkouts, setExpandedWorkouts] = useState({});
  const [expandedInsightTypes, setExpandedInsightTypes] = useState({});
  const [prsExpanded, setPrsExpanded] = useState(false);

  const toggleWorkout = (id) => setExpandedWorkouts(p => ({ ...p, [id]: !p[id] }));
  const toggleInsightType = (type) => setExpandedInsightTypes(p => ({ ...p, [type]: !p[type] }));

  // Current week boundaries (Mon-Sun)
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Previous week boundaries
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekEnd = new Date(weekStart);

  const weekWorkouts = workouts.filter(wo => { const d = new Date(wo.started_at); return d >= weekStart && d < weekEnd; });
  const prevWeekWorkouts = workouts.filter(wo => { const d = new Date(wo.started_at); return d >= prevWeekStart && d < prevWeekEnd; });

  // Load sets for this week's workouts
  useEffect(() => {
    (async () => {
      const ids = weekWorkouts.map(w => w.id).filter(Boolean);
      if (ids.length === 0) { setLoadingSets(false); return; }
      try {
        const data = await getWorkoutSets(ids);
        setSets(data);
      } catch (e) { console.error("Failed to load sets:", e); }
      setLoadingSets(false);
    })();
  }, [workouts.length]);

  // Group sets by workout_id then exercise_name
  const setsByWorkout = {};
  sets.forEach(s => {
    if (!setsByWorkout[s.workout_id]) setsByWorkout[s.workout_id] = {};
    if (!setsByWorkout[s.workout_id][s.exercise_name]) setsByWorkout[s.workout_id][s.exercise_name] = [];
    setsByWorkout[s.workout_id][s.exercise_name].push(s);
  });

  // PR lookup by workout_id
  const prByWorkout = {};
  prs.forEach(p => { if (p.workout_id) { if (!prByWorkout[p.workout_id]) prByWorkout[p.workout_id] = new Set(); prByWorkout[p.workout_id].add(p.exercise_name); } });

  // Summary stats
  const totalVolume = weekWorkouts.reduce((sum, wo) => sum + (wo.total_volume_kg || 0), 0);
  const totalTime = weekWorkouts.reduce((sum, wo) => sum + (wo.duration_secs || 0), 0);
  const weekPRs = prs.filter(p => p.workout_id && weekWorkouts.some(w => w.id === p.workout_id));
  const totalSets = sets.length;
  const totalReps = sets.reduce((sum, s) => sum + (s.reps || 0), 0);

  // Previous week stats for comparison
  const prevVolume = prevWeekWorkouts.reduce((sum, wo) => sum + (wo.total_volume_kg || 0), 0);
  const prevTime = prevWeekWorkouts.reduce((sum, wo) => sum + (wo.duration_secs || 0), 0);

  const summaryPills = [
    { label: "Workouts", val: weekWorkouts.length },
    { label: "Volume", val: Math.round(totalVolume).toLocaleString() + " kg" },
    { label: "Time", val: Math.round(totalTime / 60) + " min" },
    { label: "PRs", val: weekPRs.length },
    { label: "Sets", val: totalSets },
    { label: "Reps", val: totalReps },
  ];

  // Deltas
  const deltas = [];
  const wkDiff = weekWorkouts.length - prevWeekWorkouts.length;
  if (prevWeekWorkouts.length > 0 || weekWorkouts.length > 0) deltas.push({ label: "Workouts", diff: wkDiff > 0 ? `+${wkDiff}` : `${wkDiff}`, positive: wkDiff >= 0 });
  if (prevVolume > 0) { const pct = Math.round((totalVolume - prevVolume) / prevVolume * 100); deltas.push({ label: "Volume", diff: (pct >= 0 ? "+" : "") + pct + "%", positive: pct >= 0 }); }
  if (prevTime > 0) { const diff = Math.round((totalTime - prevTime) / 60); deltas.push({ label: "Time", diff: (diff >= 0 ? "+" : "") + diff + " min", positive: diff >= 0 }); }

  // Group workouts by day
  const dayGroups = {};
  weekWorkouts.sort((a, b) => new Date(a.started_at) - new Date(b.started_at)).forEach(wo => {
    const dayKey = new Date(wo.started_at).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    if (!dayGroups[dayKey]) dayGroups[dayKey] = [];
    dayGroups[dayKey].push(wo);
  });

  // Rule-based insights
  const insights = [];

  // Muscle group set counts
  const muscleSetCounts = {};
  sets.forEach(s => {
    const group = MUSCLE_MAP[s.exercise_name] || "Other";
    muscleSetCounts[group] = (muscleSetCounts[group] || 0) + 1;
  });
  Object.entries(muscleSetCounts).forEach(([group, count]) => {
    if (count < 10 && group !== "Other") insights.push({ type: "warning", icon: I.warning, title: `Low ${group} Volume`, body: `Only ${count} sets for ${group} this week — may be below growth threshold (10+ recommended).` });
  });

  // RPE insights per exercise
  const exerciseRPEs = {};
  sets.forEach(s => { if (s.rpe) { if (!exerciseRPEs[s.exercise_name]) exerciseRPEs[s.exercise_name] = []; exerciseRPEs[s.exercise_name].push(s.rpe); } });
  Object.entries(exerciseRPEs).forEach(([ex, rpes]) => {
    const avg = rpes.reduce((a, b) => a + b, 0) / rpes.length;
    if (avg >= 9) insights.push({ type: "warning", icon: I.fire, title: `High intensity on ${ex}`, body: `Avg RIR ${(10 - avg).toFixed(1)} — risk of accumulated fatigue. Consider backing off next session.` });
    if (avg <= 5) insights.push({ type: "info", icon: I.tip, title: `Low intensity on ${ex}`, body: `Avg RIR ${(10 - avg).toFixed(1)} — you may have room to increase intensity.` });
  });

  // Volume change vs last week
  if (prevVolume > 0) {
    const volChange = (totalVolume - prevVolume) / prevVolume * 100;
    if (volChange > 20) insights.push({ type: "warning", icon: I.trendUp, title: "Volume Spike", body: `Volume jumped ${Math.round(volChange)}% this week — monitor recovery and watch for overreach signs.` });
    if (volChange < -20) insights.push({ type: "info", icon: I.trendDown, title: "Volume Drop", body: `Volume dropped ${Math.abs(Math.round(volChange))}% — planned deload or missed sessions?` });
  }

  // Frequency change
  if (prevWeekWorkouts.length > 0 && weekWorkouts.length !== prevWeekWorkouts.length) {
    const diff = weekWorkouts.length - prevWeekWorkouts.length;
    if (diff > 0) insights.push({ type: "positive", icon: I.target, title: "Frequency Up", body: `You trained ${weekWorkouts.length} days this week vs ${prevWeekWorkouts.length} last week — nice increase!` });
  }

  // PRs achieved
  weekPRs.forEach(pr => {
    insights.push({ type: "positive", icon: I.trophy, title: `New PR: ${pr.exercise_name}`, body: `${pr.weight_kg}kg × ${pr.reps} (est. 1RM: ${Math.round(pr.estimated_1rm || pr.weight_kg)}kg)` });
  });

  // Group insights by type
  const insightsByType = {};
  insights.forEach(ins => {
    if (!insightsByType[ins.type]) insightsByType[ins.type] = [];
    insightsByType[ins.type].push(ins);
  });
  const insightTypeLabels = { warning: "Warnings", positive: "Positive", info: "Info" };

  // AI analysis handler
  const handleAIAnalysis = async () => {
    setAiLoading(true);
    try {
      const exerciseSummary = Object.entries(setsByWorkout).map(([wid, exercises]) => {
        const wo = weekWorkouts.find(w => w.id === wid);
        return `${wo?.title || "Workout"} (${new Date(wo?.started_at).toLocaleDateString()}):\n` +
          Object.entries(exercises).map(([name, exSets]) =>
            `  ${name}: ${exSets.map(s => `${s.weight_kg}kg×${s.reps}${s.rpe ? ` @RIR${10 - s.rpe}` : ""}`).join(", ")}`
          ).join("\n");
      }).join("\n\n");
      const muscleStr = Object.entries(muscleSetCounts).map(([g, c]) => `${g}: ${c} sets`).join(", ");
      const prompt = `Analyze my training week:\n\n${exerciseSummary}\n\nMuscle group sets: ${muscleStr}\nTotal volume: ${Math.round(totalVolume)}kg\nWorkouts: ${weekWorkouts.length}\nPRs: ${weekPRs.length}\n\nGive brief, actionable insights on: progressive overload, weak points, recovery, and what to focus on next week.`;
      const res = await callCoachAPI(prompt, "Weekly Analysis");
      setAiInsight(res.response || res.message || "No response received.");
    } catch (e) { setAiInsight("Failed to get AI analysis: " + e.message); }
    setAiLoading(false);
  };

  const dateRange = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " – " + new Date(weekEnd.getTime() - 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const insightColors = { warning: { bg: "rgba(255,180,50,0.08)", border: "rgba(255,180,50,0.2)", color: "#FFB432" }, positive: { bg: "rgba(100,255,100,0.08)", border: "rgba(100,255,100,0.2)", color: "#6CFF6C" }, info: { bg: "rgba(100,180,255,0.08)", border: "rgba(100,180,255,0.2)", color: "#64B4FF" } };

  return (
    <div style={{ padding: "0 20px 110px", opacity: m ? 1 : 0, transform: m ? "none" : "translateY(10px)", transition: "all .5s cubic-bezier(.22,1,.36,1)" }}>
      {/* Back button */}
      <div style={{ padding: "14px 0 6px" }}>
        <button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, color: "#fff", borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: C.font }}>← Back</button>
      </div>

      {/* Header */}
      <div style={{ padding: "8px 0 18px" }}>
        <div style={{ fontSize: 12, color: C.accent, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>{dateRange}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: C.font, marginTop: 2 }}>This Week's Training</div>
      </div>

      {/* Summary Bar */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 18, WebkitOverflowScrolling: "touch" }}>
        {summaryPills.map((p, i) => (
          <div key={i} style={{ flexShrink: 0, padding: "10px 16px", borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: C.font, lineHeight: 1 }}>{p.val}</div>
            <div style={{ fontSize: 9, color: C.dim, fontFamily: C.mono, letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>{p.label}</div>
          </div>
        ))}
      </div>

      {/* Previous Week Comparison */}
      {deltas.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {deltas.map((d, i) => (
            <div key={i} style={{ padding: "6px 12px", borderRadius: 10, background: d.positive ? "rgba(100,255,100,0.06)" : "rgba(255,100,100,0.06)", border: `1px solid ${d.positive ? "rgba(100,255,100,0.15)" : "rgba(255,100,100,0.15)"}` }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: d.positive ? "#6CFF6C" : "#FF6C6C", fontFamily: C.mono }}>{d.positive ? "↑" : "↓"} {d.diff}</span>
              <span style={{ fontSize: 10, color: C.dim, marginLeft: 4 }}>{d.label}</span>
            </div>
          ))}
          <div style={{ padding: "6px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)" }}>
            <span style={{ fontSize: 10, color: C.dim }}>vs last week</span>
          </div>
        </div>
      )}

      {/* Workouts by day — collapsible */}
      {weekWorkouts.length === 0 && (
        <div style={{ textAlign: "center", paddingTop: 30, marginBottom: 22 }}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>🏋️</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", fontFamily: C.font, marginBottom: 6 }}>No Workouts Yet This Week</div>
          <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.5 }}>Start a workout and your weekly breakdown will appear here.</div>
        </div>
      )}

      {Object.entries(dayGroups).map(([day, dayWorkouts]) => (
        <div key={day} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, fontFamily: C.mono, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{day}</div>
          {dayWorkouts.map((wo, wi) => {
            const woSets = setsByWorkout[wo.id] || {};
            const startTime = new Date(wo.started_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            const isOpen = !!expandedWorkouts[wo.id];
            return (
              <div key={wi} style={{ background: C.card, borderRadius: 16, marginBottom: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                {/* Collapsed summary row */}
                <div onClick={() => toggleWorkout(wo.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", cursor: "pointer" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: C.font }}>
                      {wo.title || "Workout"} <span style={{ fontSize: 11, color: C.dim, fontWeight: 400 }}>{startTime}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{Math.round((wo.duration_secs || 0) / 60)} min · {Math.round(wo.total_volume_kg || 0).toLocaleString()} kg</div>
                  </div>
                  <span style={{ fontSize: 14, color: C.dim, transition: "transform .2s", transform: isOpen ? "rotate(90deg)" : "none", flexShrink: 0, marginLeft: 8 }}>→</span>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ padding: "0 16px 14px" }}>
                    {wo.notes && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontStyle: "italic", marginBottom: 10, paddingLeft: 2 }}>"{wo.notes}"</div>}
                    {loadingSets ? (
                      <div style={{ fontSize: 12, color: C.dim, padding: "4px 0" }}>Loading sets...</div>
                    ) : Object.keys(woSets).length === 0 ? (
                      <div style={{ fontSize: 12, color: C.dim, padding: "4px 0" }}>No set data available</div>
                    ) : (
                      Object.entries(woSets).map(([exName, exSets], ei) => {
                        const hasPR = prByWorkout[wo.id]?.has(exName);
                        const rpesForEx = exSets.filter(s => s.rpe).map(s => s.rpe);
                        const avgRPE = rpesForEx.length > 0 ? (rpesForEx.reduce((a, b) => a + b, 0) / rpesForEx.length).toFixed(1) : null;
                        const bestSet = exSets.reduce((best, s) => ((s.weight_kg || 0) * (s.reps || 0) > (best.weight_kg || 0) * (best.reps || 0) ? s : best), exSets[0]);
                        return (
                          <div key={ei} style={{ marginBottom: ei < Object.keys(woSets).length - 1 ? 10 : 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{exName}</span>
                              {hasPR && <span style={{ fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: "rgba(255,220,50,0.15)", color: "#FFD700", fontFamily: C.mono, letterSpacing: .5 }}>PR</span>}
                              {avgRPE && <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(164,123,255,0.12)", color: C.ai, fontFamily: C.mono }}>RIR {(10 - parseFloat(avgRPE)).toFixed(1)}</span>}
                            </div>
                            {exSets.map((s, si) => {
                              const isBest = s === bestSet && exSets.length > 1;
                              return (
                                <div key={si} style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 8, marginBottom: 2 }}>
                                  <span style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, width: 40 }}>Set {s.set_number || si + 1}</span>
                                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontFamily: C.mono }}>{s.weight_kg}kg × {s.reps}{s.rpe ? ` @ RIR ${10 - s.rpe}` : ""}</span>
                                  {isBest && <span style={{ fontSize: 8, fontWeight: 800, padding: "1px 5px", borderRadius: 4, background: `${C.accent}18`, color: C.accent, fontFamily: C.mono }}>Best</span>}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* AI Analysis */}
      <div style={{ marginBottom: 22 }}>
        {!aiInsight && (
          <button onClick={handleAIAnalysis} disabled={aiLoading} style={{
            width: "100%", padding: "14px 16px", borderRadius: 16, cursor: aiLoading ? "wait" : "pointer",
            border: `1px solid ${C.ai}30`, background: `${C.ai}0A`, display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: `linear-gradient(135deg, ${C.ai}, #7B4CFF)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🧠</div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{aiLoading ? "Analyzing..." : "Get AI Analysis"}</div>
              <div style={{ fontSize: 10, color: C.dim, marginTop: 1 }}>Uses 1 AI query</div>
            </div>
            {aiLoading && <div style={{ width: 16, height: 16, border: `2px solid ${C.ai}40`, borderTopColor: C.ai, borderRadius: "50%", animation: "spin 1s linear infinite" }} />}
          </button>
        )}
        {aiInsight && (
          <div style={{ padding: "16px", borderRadius: 16, background: `${C.ai}0A`, border: `1px solid ${C.ai}25` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 14 }}>🧠</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.ai, fontFamily: C.font }}>AI Analysis</span>
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{aiInsight}</div>
          </div>
        )}
      </div>

      {/* Training Insights — grouped by type, collapsible */}
      {insights.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Insights</div>
          {Object.entries(insightsByType).map(([type, items]) => {
            const ic = insightColors[type] || insightColors.info;
            const label = insightTypeLabels[type] || type;
            // Single insight of this type: show directly
            if (items.length === 1) {
              const ins = items[0];
              return (
                <div key={type} style={{ padding: "12px 14px", borderRadius: 14, background: ic.bg, border: `1px solid ${ic.border}`, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14 }}>{ins.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: ic.color, fontFamily: C.font }}>{ins.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.5, paddingLeft: 22 }}>{ins.body}</div>
                </div>
              );
            }
            // Multiple insights of this type: collapsible group
            const isOpen = !!expandedInsightTypes[type];
            return (
              <div key={type} style={{ borderRadius: 14, background: ic.bg, border: `1px solid ${ic.border}`, marginBottom: 8, overflow: "hidden" }}>
                <div onClick={() => toggleInsightType(type)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{items[0].icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: ic.color, fontFamily: C.font }}>{label}</span>
                    <span style={{ fontSize: 11, color: ic.color, opacity: 0.7, fontFamily: C.mono }}>{items.length}</span>
                  </div>
                  <span style={{ fontSize: 12, color: ic.color, transition: "transform .2s", transform: isOpen ? "rotate(90deg)" : "none" }}>→</span>
                </div>
                {isOpen && (
                  <div style={{ padding: "0 14px 10px" }}>
                    {items.map((ins, i) => (
                      <div key={i} style={{ marginBottom: i < items.length - 1 ? 8 : 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.75)", marginBottom: 2 }}>{ins.title}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{ins.body}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// === SECTION: Day Detail ===
/* ═══ DAY DETAIL ═══ */
function DayDetailScreen({ onBack, date, workouts = [], prs = [] }) {
  const m = useMountAnimation();
  const [sets, setSets] = useState([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [expandedWorkouts, setExpandedWorkouts] = useState({});

  const toggleWorkout = (id) => setExpandedWorkouts(p => ({ ...p, [id]: !p[id] }));

  // Filter workouts for this specific day
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const dayWorkouts = workouts.filter(wo => { const d = new Date(wo.started_at); return d >= dayStart && d < dayEnd; });

  useEffect(() => {
    (async () => {
      const ids = dayWorkouts.map(w => w.id).filter(Boolean);
      if (ids.length === 0) { setLoadingSets(false); return; }
      try { setSets(await getWorkoutSets(ids)); } catch (e) { console.error("Failed to load sets:", e); }
      setLoadingSets(false);
    })();
  }, [date]);

  const setsByWorkout = {};
  sets.forEach(s => {
    if (!setsByWorkout[s.workout_id]) setsByWorkout[s.workout_id] = {};
    if (!setsByWorkout[s.workout_id][s.exercise_name]) setsByWorkout[s.workout_id][s.exercise_name] = [];
    setsByWorkout[s.workout_id][s.exercise_name].push(s);
  });

  const prByWorkout = {};
  prs.forEach(p => { if (p.workout_id) { if (!prByWorkout[p.workout_id]) prByWorkout[p.workout_id] = new Set(); prByWorkout[p.workout_id].add(p.exercise_name); } });

  const totalVolume = dayWorkouts.reduce((sum, wo) => sum + (wo.total_volume_kg || 0), 0);
  const totalTime = dayWorkouts.reduce((sum, wo) => sum + (wo.duration_secs || 0), 0);
  const dayLabel = dayStart.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return (
    <div style={{ padding: "0 20px 110px", opacity: m ? 1 : 0, transform: m ? "none" : "translateY(10px)", transition: "all .5s cubic-bezier(.22,1,.36,1)" }}>
      <div style={{ padding: "14px 0 6px" }}>
        <button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, color: "#fff", borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: C.font }}>← Back</button>
      </div>
      <div style={{ padding: "8px 0 18px" }}>
        <div style={{ fontSize: 12, color: C.accent, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>{dayLabel}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: C.font, marginTop: 2 }}>Day Breakdown</div>
        <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>{dayWorkouts.length} workout{dayWorkouts.length !== 1 ? "s" : ""} · {Math.round(totalTime / 60)} min · {Math.round(totalVolume).toLocaleString()} kg</div>
      </div>

      {dayWorkouts.map((wo, wi) => {
        const woSets = setsByWorkout[wo.id] || {};
        const startTime = new Date(wo.started_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        const isOpen = !!expandedWorkouts[wo.id];
        return (
          <div key={wi} style={{ background: C.card, borderRadius: 16, marginBottom: 8, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <div onClick={() => toggleWorkout(wo.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", cursor: "pointer" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: C.font }}>
                  {wo.title || "Workout"} <span style={{ fontSize: 11, color: C.dim, fontWeight: 400 }}>{startTime}</span>
                </div>
                <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{Math.round((wo.duration_secs || 0) / 60)} min · {Math.round(wo.total_volume_kg || 0).toLocaleString()} kg</div>
              </div>
              <span style={{ fontSize: 14, color: C.dim, transition: "transform .2s", transform: isOpen ? "rotate(90deg)" : "none", flexShrink: 0, marginLeft: 8 }}>→</span>
            </div>
            {isOpen && (
              <div style={{ padding: "0 16px 14px" }}>
                {wo.notes && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontStyle: "italic", marginBottom: 10, paddingLeft: 2 }}>"{wo.notes}"</div>}
                {loadingSets ? (
                  <div style={{ fontSize: 12, color: C.dim, padding: "4px 0" }}>Loading sets...</div>
                ) : Object.keys(woSets).length === 0 ? (
                  <div style={{ fontSize: 12, color: C.dim, padding: "4px 0" }}>No set data available</div>
                ) : (
                  Object.entries(woSets).map(([exName, exSets], ei) => {
                    const hasPR = prByWorkout[wo.id]?.has(exName);
                    const rpesForEx = exSets.filter(s => s.rpe).map(s => s.rpe);
                    const avgRPE = rpesForEx.length > 0 ? (rpesForEx.reduce((a, b) => a + b, 0) / rpesForEx.length).toFixed(1) : null;
                    const bestSet = exSets.reduce((best, s) => ((s.weight_kg || 0) * (s.reps || 0) > (best.weight_kg || 0) * (best.reps || 0) ? s : best), exSets[0]);
                    return (
                      <div key={ei} style={{ marginBottom: ei < Object.keys(woSets).length - 1 ? 10 : 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{exName}</span>
                          {hasPR && <span style={{ fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: "rgba(255,220,50,0.15)", color: "#FFD700", fontFamily: C.mono, letterSpacing: .5 }}>PR</span>}
                          {avgRPE && <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(164,123,255,0.12)", color: C.ai, fontFamily: C.mono }}>RIR {(10 - parseFloat(avgRPE)).toFixed(1)}</span>}
                        </div>
                        {exSets.map((s, si) => {
                          const isBest = s === bestSet && exSets.length > 1;
                          return (
                            <div key={si} style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 8, marginBottom: 2 }}>
                              <span style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, width: 40 }}>Set {s.set_number || si + 1}</span>
                              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontFamily: C.mono }}>{s.weight_kg}kg × {s.reps}{s.rpe ? ` @ RIR ${10 - s.rpe}` : ""}</span>
                              {isBest && <span style={{ fontSize: 8, fontWeight: 800, padding: "1px 5px", borderRadius: 4, background: `${C.accent}18`, color: C.accent, fontFamily: C.mono }}>Best</span>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// === SECTION: Personal Records ===
/* ═══ PERSONAL RECORDS ═══ */
function PRScreen({ onBack, prs = [] }) {
  const m = useMountAnimation();
  const [tab, setTab] = useState("1rm");

  const GROUP_ORDER = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Other"];
  const GROUP_COLORS = { Chest: "#FF6B3C", Back: "#3CFFF0", Legs: "#A78BFA", Shoulders: "#47B8FF", Arms: "#F472B6", Other: "#9B98C4" };
  const BIG3 = ["Back Squat", "Bench Press", "Deadlift"];

  const filtered = prs
    .filter(p => (p.pr_type || "1rm") === tab)
    .filter(p => p.weight_kg > 0)
    .sort((a, b) => new Date(b.achieved_at) - new Date(a.achieved_at));

  // Build sections: Big 3 pinned first, then grouped by muscle
  const big3PRs = BIG3.map(name => filtered.find(p => p.exercise_name === name)).filter(Boolean);
  const restPRs = filtered.filter(p => !BIG3.includes(p.exercise_name));

  const MUSCLE_TO_GROUP = {
    Chest: "Chest",
    Back: "Back",
    Quads: "Legs", Hamstrings: "Legs", Glutes: "Legs", Calves: "Legs",
    Shoulders: "Shoulders",
    Biceps: "Arms", Triceps: "Arms",
    Abs: "Other",
  };
  const grouped = {};
  restPRs.forEach(p => {
    const muscle = getMuscleGroup(p.exercise_name);
    const g = MUSCLE_TO_GROUP[muscle] || "Other";
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(p);
  });
  const groupSections = GROUP_ORDER.filter(g => grouped[g]?.length > 0).map(g => ({ group: g, prs: grouped[g] }));

  const PRCard = ({ p, i, accentColor }) => (
    <div style={{ background: C.card, borderRadius: 16, padding: "14px 16px", marginBottom: 8, border: `1px solid ${C.border}`, opacity: m ? 1 : 0, transform: m ? "none" : "translateY(10px)", transition: `all .4s cubic-bezier(.22,1,.36,1) ${i * .04}s` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: C.font }}>{p.exercise_name}</div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 2, fontFamily: C.mono }}>
            {p.reps} reps @ {p.weight_kg}kg · {new Date(p.achieved_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {tab === "1rm" ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 800, color: accentColor, fontFamily: C.font }}>{Math.round(p.estimated_1rm || p.weight_kg)}kg</div>
              <div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono }}>e1RM</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 20, fontWeight: 800, color: accentColor, fontFamily: C.font }}>{Math.round(p.set_volume || p.weight_kg * p.reps).toLocaleString()}kg</div>
              <div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono }}>vol</div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  let cardIdx = 0;

  return (
    <div style={{ padding: "0 20px 110px", opacity: m ? 1 : 0, transition: "opacity .4s" }}>
      <div style={{ padding: "14px 0 6px" }}>
        <button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, color: "#fff", borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: C.font }}>← Back</button>
      </div>
      <div style={{ padding: "8px 0 18px" }}>
        <div style={{ fontSize: 12, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>Lifting</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: C.font, marginTop: 2 }}>Personal Records</div>
      </div>

      {/* Tab toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[{ key: "1rm", label: "1 Rep Max" }, { key: "volume", label: "Volume" }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: "10px 0", borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: C.font, cursor: "pointer",
            background: tab === t.key ? C.accent : C.card,
            color: tab === t.key ? C.bg : "#fff",
            border: tab === t.key ? "none" : `1px solid ${C.border}`,
            transition: "all .2s"
          }}>{t.label}</button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", paddingTop: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>{tab === "1rm" ? "🏋️" : "📊"}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: C.font, marginBottom: 6 }}>No {tab === "1rm" ? "1RM" : "Volume"} PRs Yet</div>
          <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.5 }}>Complete workouts to start tracking your {tab === "1rm" ? "strength" : "volume"} records.</div>
        </div>
      )}

      {/* Big 3 */}
      {big3PRs.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>The Big 3</div>
          {big3PRs.map(p => <PRCard key={p.id} p={p} i={cardIdx++} accentColor={C.accent} />)}
        </div>
      )}

      {/* Grouped sections */}
      {groupSections.map(({ group, prs: gPRs }) => (
        <div key={group} style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: GROUP_COLORS[group] }} />
            <div style={{ fontSize: 11, color: GROUP_COLORS[group], fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>{group}</div>
          </div>
          {gPRs.map(p => <PRCard key={p.id} p={p} i={cardIdx++} accentColor={GROUP_COLORS[group]} />)}
        </div>
      ))}
    </div>
  );
}

// === SECTION: Notifications ===
/* ═══ NOTIFICATION PREFERENCES SCREEN ═══ */
function NotificationScreen({ onBack }) {
  const [permission, setPermission] = useState("default");
  const [subscribed, setSubscribed] = useState(false);
  const [showPrePrompt, setShowPrePrompt] = useState(false);
  const [prefs, setPrefs] = useState({
    workout_reminders: true,
    rest_day_alerts: true,
    pr_celebrations: true,
    weekly_summary: true,
    ai_coach_tips: true,
    streak_alerts: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000);
    (async () => {
      const [savedPrefs, perm, sub] = await Promise.all([
        getNotificationPreferences(),
        checkNativePermission(),
        getCurrentSubscription(),
      ]);
      setPrefs(savedPrefs);
      setPermission(perm);
      setSubscribed(!!sub);
      setLoading(false);
      clearTimeout(timeout);
    })();
    return () => clearTimeout(timeout);
  }, []);

  const handleEnableNotifications = async () => {
    const currentPerm = await checkNativePermission();
    setPermission(currentPerm);
    if (currentPerm === "granted") {
      await subscribeToPush();
      setSubscribed(true);
      return;
    }
    setShowPrePrompt(true);
  };

  const handlePrePromptAccept = async () => {
    setShowPrePrompt(false);
    await requestNotificationPermission();
    const actualPerm = await checkNativePermission();
    setPermission(actualPerm);
    if (actualPerm === "granted" || actualPerm === "prompt") {
      await subscribeToPush();
      setSubscribed(true);
    }
  };

  const handleDisable = async () => {
    await unsubscribeFromPush();
    setSubscribed(false);
  };

  const togglePref = async (key) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    await updateNotificationPreferences(updated);
  };

  const NOTIF_TYPES = [
    { key: "workout_reminders", label: "Workout Reminders", desc: "Get reminded when it's time to train", icon: I.strength },
    { key: "rest_day_alerts", label: "Rest Day Alerts", desc: "Know when to take a recovery day", icon: I.sleep },
    { key: "pr_celebrations", label: "PR Celebrations", desc: "Celebrate when you hit new records", icon: I.trophy },
    { key: "weekly_summary", label: "Weekly Summary", desc: "Weekly training recap and stats", icon: I.chart },
    { key: "ai_coach_tips", label: "AI Coach Tips", desc: "Personalized training insights", icon: I.brain },
    { key: "streak_alerts", label: "Streak Alerts", desc: "Keep your training streak alive", icon: I.fire },
  ];

  return (
    <div style={{ padding: "0 20px 110px" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "14px 0 6px" }}>
        <button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, color: "#fff", borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: C.font }}>← Back</button>
      </div>

      <div style={{ textAlign: "center", padding: "16px 0 24px" }}>
        <div style={{ fontSize: 10, color: C.accent, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Stay on track</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: C.font }}>Notifications</div>
        <div style={{ fontSize: 13, color: C.dim, marginTop: 6 }}>Choose what you want to hear about</div>
      </div>

      {/* Master toggle */}
      <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}`, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: C.font }}>
              {subscribed ? "Notifications Active" : "Enable Notifications"}
            </div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
              {permission === "denied"
                ? (Capacitor.isNativePlatform() ? "Blocked in device settings" : "Blocked in browser settings")
                : subscribed
                ? "You'll receive push notifications"
                : "Turn on to get training reminders"}
            </div>
          </div>
          <button
            onClick={subscribed ? handleDisable : handleEnableNotifications}
            disabled={permission === "denied" || loading}
            style={{
              width: 52, height: 30, borderRadius: 15, border: "none", cursor: permission === "denied" ? "not-allowed" : "pointer",
              background: subscribed ? C.accent : "rgba(255,255,255,0.1)",
              position: "relative", transition: "background 0.2s ease",
              opacity: permission === "denied" ? 0.3 : 1,
            }}
          >
            <div style={{
              width: 24, height: 24, borderRadius: 12, background: "#fff",
              position: "absolute", top: 3,
              left: subscribed ? 25 : 3,
              transition: "left 0.2s ease",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }} />
          </button>
        </div>
        {permission === "denied" && (
          <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 10, background: "rgba(255,107,60,0.1)", border: "1px solid rgba(255,107,60,0.2)", fontSize: 11, color: "#FF6B3C", fontFamily: C.mono }}>
            {Capacitor.isNativePlatform()
              ? "Notifications are blocked. Enable them in your device settings, then reopen the app."
              : "Notifications are blocked in your browser. Click the lock icon in the address bar, set Notifications to Allow, then refresh."}
          </div>
        )}
      </div>

      {/* Notification type toggles */}
      <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", opacity: subscribed ? 1 : 0.4, pointerEvents: subscribed ? "auto" : "none", transition: "opacity 0.2s ease" }}>
        {NOTIF_TYPES.map((n, i) => (
          <div key={n.key} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: i < NOTIF_TYPES.length - 1 ? `1px solid ${C.border}` : "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
              <span style={{ fontSize: 20 }}>{n.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: C.font }}>{n.label}</div>
                <div style={{ fontSize: 11, color: C.dim, marginTop: 1 }}>{n.desc}</div>
              </div>
            </div>
            <button
              onClick={() => togglePref(n.key)}
              style={{
                width: 44, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
                background: prefs[n.key] ? C.accent : "rgba(255,255,255,0.1)",
                position: "relative", transition: "background 0.2s ease", flexShrink: 0,
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 10, background: "#fff",
                position: "absolute", top: 3,
                left: prefs[n.key] ? 21 : 3,
                transition: "left 0.2s ease",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }} />
            </button>
          </div>
        ))}
      </div>

      {/* Pre-prompt overlay */}
      {showPrePrompt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(16px)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setShowPrePrompt(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#111113", borderRadius: 24, padding: "32px 24px", maxWidth: 340, width: "100%" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔔</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 8 }}>Never Miss a Workout</div>
              <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.5 }}>
                Notifications help you stay consistent with your training. Get workout reminders, PR celebrations, and AI-powered tips.
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={handlePrePromptAccept}
                style={{
                  width: "100%", padding: 14, borderRadius: 14, border: "none",
                  background: C.accent, color: C.bg,
                  fontSize: 14, fontWeight: 700, fontFamily: C.font, cursor: "pointer",
                }}
              >
                Enable Notifications
              </button>
              <button
                onClick={() => setShowPrePrompt(false)}
                style={{
                  width: "100%", padding: 14, borderRadius: 14,
                  border: `1px solid ${C.border}`, background: "transparent",
                  color: C.dim, fontSize: 13, fontWeight: 600, fontFamily: C.font, cursor: "pointer",
                }}
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// === SECTION: Profile / Settings ===
function ChangePasswordSection() {
  const [open, setOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!currentPw || !newPw || !confirmPw) { setError("All fields are required"); return; }
    if (newPw.length < 6) { setError("New password must be at least 6 characters"); return; }
    if (newPw !== confirmPw) { setError("New passwords don't match"); return; }
    setLoading(true);
    try {
      await updatePassword(currentPw, newPw);
      setSuccess(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => { setSuccess(false); setOpen(false); }, 2000);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const pwInput = (value, setter, show, setShow, placeholder) => (
    <div style={{ position: "relative", marginBottom: 10 }}>
      <input type={show ? "text" : "password"} placeholder={placeholder} value={value} onChange={e => setter(e.target.value)} disabled={loading} style={{ width: "100%", padding: "11px 44px 11px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bg, color: "#fff", fontSize: 13, fontFamily: C.font, outline: "none", boxSizing: "border-box" }} />
      <button type="button" onClick={() => setShow(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.dim, fontSize: 15, padding: 0, lineHeight: 1 }}>{show ? "🙈" : "👁"}</button>
    </div>
  );

  return (
    <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, marginBottom: 12, overflow: "hidden" }}>
      <button onClick={() => { setOpen(v => !v); setError(""); setSuccess(false); }} style={{ width: "100%", padding: "14px", background: "none", border: "none", color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: C.font, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 18 }}>🔑</span> Change Password</span>
        <span style={{ fontSize: 16, color: C.dim, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>→</span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px" }}>
          {success ? (
            <div style={{ textAlign: "center", color: "#4ade80", fontSize: 14, fontFamily: C.font, padding: "8px 0" }}>✓ Password updated successfully</div>
          ) : (
            <>
              {pwInput(currentPw, setCurrentPw, showCurrent, setShowCurrent, "Current password")}
              {pwInput(newPw, setNewPw, showNew, setShowNew, "New password")}
              {pwInput(confirmPw, setConfirmPw, showConfirm, setShowConfirm, "Confirm new password")}
              {error && <div style={{ color: "#FF6B3C", fontSize: 12, fontFamily: C.font, marginBottom: 10 }}>{error}</div>}
              <button onClick={handleSubmit} disabled={loading} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: C.accent, color: C.bg, fontSize: 14, fontWeight: 700, fontFamily: C.font, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.6 : 1 }}>
                {loading ? "Updating..." : "Update Password"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ImportWorkoutModal({ onClose, onImportComplete }) {
  const [step, setStep] = useState('upload'); // 'upload' | 'confirm' | 'done'
  const [parsed, setParsed] = useState(null);
  const [unit, setUnit] = useState('kg');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const fmt = detectFormat(text);
      if (!fmt) {
        setError('Unrecognised format. Please upload a Hevy or Strong CSV export.');
        return;
      }
      const p = parseCSV(text, unit);
      setParsed(p);
      setStep('confirm');
    };
    reader.readAsText(file);
  };

  const handleUnitChange = (newUnit) => {
    setUnit(newUnit);
    // Re-parse if a file is already loaded
    if (fileRef.current && fileRef.current.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const p = parseCSV(ev.target.result, newUnit);
        setParsed(p);
      };
      reader.readAsText(fileRef.current.files[0]);
    }
  };

  const handleImport = async () => {
    if (!parsed) return;
    setLoading(true);
    try {
      const res = await importWorkouts(parsed.workouts);
      setResult(res);
      setStep('done');
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const formatCount = parsed ? ({ hevy: 'Hevy', strong: 'Strong', fitbod: 'Fitbod' }[parsed.format] || parsed.format) : '';
  const totalSets = parsed ? parsed.workouts.reduce((s, w) => s + w.sets.length, 0) : 0;
  const isFitbod = parsed?.format === 'fitbod';

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)", zIndex: 600, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ background: C.bg, borderRadius: "24px 24px 0 0", padding: "28px 24px 40px", maxHeight: "90vh", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: C.font }}>
            {step === 'done' ? 'Import Complete' : 'Import Workout History'}
          </div>
          <button onClick={step === 'done' ? onImportComplete : onClose} style={{ background: "none", border: "none", color: C.dim, fontSize: 22, cursor: "pointer", padding: 4 }}>✕</button>
        </div>

        {error && (
          <div style={{ background: "rgba(255,80,80,0.12)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#FF6B6B", fontFamily: C.font }}>
            {error}
          </div>
        )}

        {step === 'upload' && (
          <>
            <div style={{ fontSize: 13, color: C.dim, fontFamily: C.font, marginBottom: 20, lineHeight: 1.6 }}>
              Supports <strong style={{ color: "#fff" }}>Hevy</strong>, <strong style={{ color: "#fff" }}>Strong</strong>, and <strong style={{ color: "#fff" }}>Fitbod</strong> CSV exports. In those apps, go to Settings → Export Data → CSV.
            </div>

            {/* Unit selector */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: C.dim, fontFamily: C.mono, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Weight unit in your CSV</div>
              <div style={{ display: "flex", gap: 10 }}>
                {['kg', 'lbs'].map(u => (
                  <button key={u} onClick={() => handleUnitChange(u)} style={{
                    flex: 1, padding: "12px", borderRadius: 12,
                    border: `1px solid ${unit === u ? C.accent : C.border}`,
                    background: unit === u ? `${C.accent}22` : C.card,
                    color: unit === u ? C.accent : "#fff",
                    fontSize: 14, fontWeight: 700, fontFamily: C.font, cursor: "pointer",
                  }}>
                    {u.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* File picker */}
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} id="import-csv-input" />
            <label htmlFor="import-csv-input" style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              border: `2px dashed ${C.border}`, borderRadius: 16, padding: "32px 16px", cursor: "pointer",
              gap: 12, background: C.card,
            }}>
              <span style={{ fontSize: 36 }}>📂</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#fff", fontFamily: C.font }}>Choose CSV file</span>
              <span style={{ fontSize: 12, color: C.dim, fontFamily: C.font }}>Tap to browse</span>
            </label>
          </>
        )}

        {step === 'confirm' && parsed && (
          <>
            <div style={{ background: C.card, borderRadius: 16, padding: "16px", marginBottom: 20, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 13, color: C.dim, fontFamily: C.font, marginBottom: 8 }}>
                Detected from {formatCount}{isFitbod ? ' · weights always in kg' : ` · ${unit.toUpperCase()}`}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: C.font }}>{parsed.workouts.length} <span style={{ fontSize: 16, fontWeight: 500, color: C.dim }}>workouts</span></div>
              <div style={{ fontSize: 15, color: C.dim, fontFamily: C.font, marginTop: 4 }}>{totalSets} sets · {unit.toUpperCase()}</div>
              {parsed.skippedRows > 0 && (
                <div style={{ fontSize: 12, color: "#FF9500", marginTop: 8, fontFamily: C.font }}>
                  {parsed.skippedRows} row{parsed.skippedRows > 1 ? 's' : ''} skipped (unreadable)
                </div>
              )}
            </div>

            {/* Preview first 5 workouts */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: C.dim, fontFamily: C.mono, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Preview</div>
              {parsed.workouts.slice(0, 5).map((w, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", fontFamily: C.font }}>{w.title}</div>
                    <div style={{ fontSize: 12, color: C.dim, fontFamily: C.font }}>{w.startedAt.slice(0, 10)}</div>
                  </div>
                  <div style={{ fontSize: 12, color: C.dim, fontFamily: C.font }}>{w.sets.length} sets</div>
                </div>
              ))}
              {parsed.workouts.length > 5 && (
                <div style={{ fontSize: 12, color: C.dim, fontFamily: C.font, padding: "10px 0" }}>
                  +{parsed.workouts.length - 5} more workouts
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setStep('upload'); setParsed(null); setError(null); }} style={{
                flex: 1, padding: "14px", borderRadius: 14, border: `1px solid ${C.border}`,
                background: "transparent", color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: C.font, cursor: "pointer",
              }}>Back</button>
              <button onClick={handleImport} disabled={loading} style={{
                flex: 2, padding: "14px", borderRadius: 14, border: "none",
                background: loading ? C.dim : C.accent, color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: C.font, cursor: loading ? "default" : "pointer",
              }}>
                {loading ? 'Importing...' : `Import ${parsed.workouts.length} Workouts`}
              </button>
            </div>
          </>
        )}

        {step === 'done' && result && (
          <>
            <div style={{ textAlign: "center", padding: "20px 0 32px" }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 8 }}>
                {result.inserted} workout{result.inserted !== 1 ? 's' : ''} imported
              </div>
              {result.skipped > 0 && (
                <div style={{ fontSize: 14, color: C.dim, fontFamily: C.font }}>{result.skipped} skipped (already in your history)</div>
              )}
              {result.errors.length > 0 && (
                <div style={{ fontSize: 13, color: "#FF9500", marginTop: 8, fontFamily: C.font }}>{result.errors.length} error{result.errors.length > 1 ? 's' : ''} — some workouts may not have imported</div>
              )}
            </div>
            <button onClick={onImportComplete} style={{
              width: "100%", padding: "16px", borderRadius: 14, border: "none",
              background: C.accent, color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: C.font, cursor: "pointer",
            }}>Done</button>
          </>
        )}
      </div>
    </div>
  );
}

function ProfileModal({ profile, plan, user, onClose, onLogout, onNotifications, onRedoOnboarding, activeTheme, onThemeChange, iconStyle, onIconStyleChange, onLegal, onDeleteAccount, onUpgrade, healthPermission, onHealthConnect, onHealthDisconnect, onImport }) {
  if (!user) return null;

  const accountAge = profile?.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const planData = PLANS[plan];
  const userName = profile?.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Athlete";
  const userEmail = user.email || "No email";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(16px)", zIndex: 300, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#111113", borderRadius: "26px 26px 0 0", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        {/* Sticky header */}
        <div style={{ position: "sticky", top: 0, zIndex: 1, background: "#111113", borderRadius: "26px 26px 0 0", padding: "20px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", margin: "0 auto" }} />
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "rgba(255,255,255,0.6)", borderRadius: 10, width: 32, height: 32, fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 300 }}>×</button>
        </div>
        <div style={{ overflowY: "auto", padding: "16px 24px 40px" }}>

        {/* Avatar */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: C.bg, fontFamily: C.font }}>
            {userInitial}
          </div>
        </div>

        {/* Name */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 4 }}>
            {userName}
          </div>
          <div style={{ fontSize: 12, color: C.dim, fontFamily: C.mono }}>
            {userEmail}
          </div>
        </div>

        {/* Account Info */}
        <div style={{ background: C.card, borderRadius: 16, padding: "16px", border: `1px solid ${C.border}`, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Account Type</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: planData.color }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", textTransform: "capitalize" }}>{plan}</div>
              </div>
              {plan === "free" && (
                <button onClick={() => { onClose(); onUpgrade && onUpgrade(); }} style={{ marginTop: 8, padding: "5px 10px", borderRadius: 8, border: "none", background: C.accent, color: C.bg, fontSize: 11, fontWeight: 700, fontFamily: C.font, cursor: "pointer" }}>Upgrade →</button>
              )}
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Member For</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                {accountAge === 0 ? "Today" : `${accountAge}d`}
              </div>
            </div>
          </div>
        </div>

        {/* Plan Details */}
        <div style={{ background: `${planData.color}08`, borderRadius: 16, padding: "14px", border: `1px solid ${planData.color}30`, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: planData.color, fontWeight: 700, textAlign: "center" }}>
            {plan === "free" ? "5 AI queries/day" : plan === "pro" ? "30 AI queries/day" : "Unlimited AI queries"}
          </div>
        </div>

        {/* App Theme */}
        <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}`, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
            App Theme
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { id: "aurora", label: "Aurora", color: "#A78BFA" },
              { id: "galaxy", label: "Galaxy", color: "#6C63FF" },
              { id: "neon",   label: "Neon",   color: "#DFFF3C" },
            ].map(t => (
              <button key={t.id} onClick={() => onThemeChange(t.id)} style={{
                flex: 1, padding: "10px 0", borderRadius: 10, fontFamily: C.font, fontSize: 14, fontWeight: 600, cursor: "pointer",
                border: `1.5px solid ${activeTheme === t.id ? t.color : C.border}`,
                background: activeTheme === t.id ? `${t.color}18` : C.card,
                color: activeTheme === t.id ? t.color : C.dim,
              }}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 8, textAlign: "center", fontFamily: C.mono }}>
            {{ aurora: "Purple aurora — default", galaxy: "Deep indigo — bold", neon: "Neon lime — classic" }[activeTheme]}
          </div>
        </div>

        {/* Icon Style */}
        <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}`, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
            Icon Style
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { id: "emoji",   label: "Emoji",   sample: "💪🔥🏆" },
              { id: "minimal", label: "Minimal", sample: "↑ ▲ ★" },
            ].map(s => (
              <button
                key={s.id}
                onClick={() => onIconStyleChange(s.id)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 10,
                  border: `1.5px solid ${iconStyle === s.id ? C.accent : C.border}`,
                  background: iconStyle === s.id ? `${C.accent}18` : C.card,
                  color: iconStyle === s.id ? C.accent : C.dim,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  cursor: "pointer", fontFamily: C.font,
                }}>
                <span style={{ fontSize: 16 }}>{s.sample}</span>
                <span style={{ fontSize: 12 }}>{s.label}</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 8, textAlign: "center", fontFamily: C.mono }}>
            {{ emoji: "Classic emoji icons", minimal: "Clean Unicode symbols" }[iconStyle]}
          </div>
        </div>

        {/* Change Password */}
        <ChangePasswordSection />

        {/* Import Workout History */}
        <button
          onClick={onImport}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 14,
            border: `1px solid ${C.border}`,
            background: C.card,
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: C.font,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>📥</span>
            Import Workout History
          </span>
          <span style={{ fontSize: 16, color: C.dim }}>→</span>
        </button>

        {/* Notifications Button */}
        <button
          onClick={onNotifications}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 14,
            border: `1px solid ${C.border}`,
            background: C.card,
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: C.font,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>🔔</span>
            Notifications
          </span>
          <span style={{ fontSize: 16, color: C.dim }}>→</span>
        </button>

        {/* Health Data — only on native platforms */}
        {isHealthAvailable() && <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, marginBottom: 12, padding: "14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>❤️</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", fontFamily: C.font }}>Health Data</div>
              <div style={{ fontSize: 11, color: C.dim, marginTop: 1 }}>
                {plan === "free"
                  ? "Upgrade to Pro to connect"
                  : healthPermission === "granted"
                  ? "Connected"
                  : "Connect Apple Health or Google Fit"}
              </div>
            </div>
          </div>
          {plan === "free" ? (
            <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 6, background: `${C.accent}15`, color: C.accent, fontFamily: C.mono, fontWeight: 700 }}>PRO</span>
          ) : healthPermission === "granted" ? (
            <button onClick={onHealthDisconnect} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid rgba(255,80,80,0.3)`, background: "rgba(255,80,80,0.08)", color: "#FF6B3C", fontSize: 11, fontWeight: 700, fontFamily: C.font, cursor: "pointer" }}>Disconnect</button>
          ) : (
            <button onClick={onHealthConnect} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: C.accent, color: C.bg, fontSize: 11, fontWeight: 700, fontFamily: C.font, cursor: "pointer" }}>Connect</button>
          )}
        </div>}

        {/* Redo Onboarding Button */}
        <button
          onClick={onRedoOnboarding}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 14,
            border: `1px solid ${C.border}`,
            background: C.card,
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: C.font,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>🔄</span>
            Update Goals & Profile
          </span>
          <span style={{ fontSize: 16, color: C.dim }}>→</span>
        </button>

        {/* Legal Button */}
        <button
          onClick={() => onLegal && onLegal("privacy")}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 14,
            border: `1px solid ${C.border}`,
            background: C.card,
            color: C.dim,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: C.font,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>📄</span>
            Privacy Policy &amp; Terms
          </span>
          <span style={{ fontSize: 16, color: C.dim }}>→</span>
        </button>

        {/* Delete Account Button */}
        <button
          onClick={() => onDeleteAccount && onDeleteAccount()}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 14,
            border: "1px solid rgba(255,80,80,0.15)",
            background: "transparent",
            color: "rgba(255,80,80,0.5)",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: C.font,
            cursor: "pointer",
            marginBottom: 12,
          }}
        >
          Delete Account
        </button>

        {/* Logout Button */}
        <button
          onClick={onLogout}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 14,
            border: "1px solid rgba(255,80,80,0.3)",
            background: "rgba(255,80,80,0.08)",
            color: "#FF6B3C",
            fontSize: 14,
            fontWeight: 700,
            fontFamily: C.font,
            cursor: "pointer"
          }}
        >
          Logout
        </button>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
          gAIns v1.0.1.4
        </div>

        </div>{/* end scrollable */}
      </div>
    </div>
  );
}

// === SECTION: Pre/Post Workout Modals ===
/* ═══ PRE-WORKOUT CHECKIN MODAL ═══ */
function PreWorkoutCheckin({ muscleGroups, onSubmit, onSkip, plan, healthPermission, syncedSleep, syncedHRV }) {
  const [ratings, setRatings] = useState({});
  const [jointComfort, setJointComfort] = useState(0);
  const [dreading, setDreading] = useState(null);
  const [sleepHours, setSleepHours] = useState(syncedSleep || 7);
  const [readiness, setReadiness] = useState(null);
  const setRating = (mg, val) => setRatings(prev => ({ ...prev, [mg]: val }));
  const emojiScale = I.ratingScale;
  const getEmoji = (val) => emojiScale[Math.min(Math.floor((val - 1) / 2), 4)];
  const jointEmojis = I.ratingScale.slice(0, 5);
  const isPro = plan && plan !== "free";
  const hasHealthSync = healthPermission === "granted" && syncedSleep != null;

  // Compute readiness in real-time
  useEffect(() => {
    if (!isPro) return;
    const ratingValues = Object.values(ratings).filter(v => v > 0);
    const avgSoreness = ratingValues.length > 0 ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length : null;
    const result = calculateReadinessScore({
      sleepHours: sleepHours,
      hrvMs: syncedHRV || null,
      hrvAvgMs: null, // Would need 7-day history for this
      avgSoreness,
      jointComfort: jointComfort || null,
      dreading: dreading === true,
    });
    setReadiness(result);
  }, [sleepHours, ratings, jointComfort, dreading, isPro, syncedHRV]);

  const handleSubmit = () => {
    onSubmit({
      muscleRatings: ratings,
      joint_comfort: jointComfort || undefined,
      dreading: dreading === true ? true : undefined,
      sleepHours: isPro ? sleepHours : undefined,
      hrvMs: isPro ? syncedHRV : undefined,
      readinessScore: readiness?.score ?? undefined,
      source: hasHealthSync ? (navigator.userAgent.includes("iPhone") ? "healthkit" : "health_connect") : "manual",
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#111113", borderRadius: 24, padding: "28px 24px", maxWidth: 380, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 4 }}>Pre-Workout Check-in</div>
          <div style={{ fontSize: 13, color: C.dim }}>Rate your soreness per muscle group</div>
        </div>

        {/* Sleep / Readiness Section — Pro only */}
        {isPro ? (
          <div style={{ marginBottom: 18, padding: "16px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Last night's sleep</span>
              {hasHealthSync && (
                <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: `${C.accent}15`, color: C.accent, fontFamily: C.mono, fontWeight: 700 }}>Synced</span>
              )}
            </div>
            {hasHealthSync ? (
              <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: C.font, textAlign: "center" }}>
                {syncedSleep}h
                <span style={{ fontSize: 12, color: C.dim, fontWeight: 400, marginLeft: 6 }}>from Health</span>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="range" min="4" max="10" step="0.5" value={sleepHours}
                    onChange={e => setSleepHours(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: C.accent }}
                  />
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: C.font, minWidth: 48, textAlign: "right" }}>{sleepHours}h</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: C.dim }}>4h</span>
                  <span style={{ fontSize: 10, color: C.dim }}>10h</span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: 18, padding: "16px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, position: "relative", overflow: "hidden" }}>
            <div style={{ filter: "blur(4px)", pointerEvents: "none" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 8 }}>Readiness Score</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: C.accent, textAlign: "center" }}>72</div>
            </div>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>🔒</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: C.font }}>Pro Feature</div>
                <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>Upgrade to unlock Readiness Score</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(muscleGroups || []).map(mg => (
            <div key={mg}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{mg}</span>
                <span style={{ fontSize: 18 }}>{ratings[mg] ? getEmoji(ratings[mg]) : "—"}</span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button key={n} onClick={() => setRating(mg, n)} style={{
                    flex: 1, padding: "6px 0", borderRadius: 6,
                    border: `1px solid ${ratings[mg] === n ? (n >= 7 ? "#FF6B3C" : C.accent) : C.border}`,
                    background: ratings[mg] === n ? (n >= 7 ? "#FF6B3C20" : `${C.accent}15`) : "transparent",
                    color: ratings[mg] === n ? (n >= 7 ? "#FF6B3C" : C.accent) : C.dim,
                    fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: C.mono,
                  }}>{n}</button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Joint comfort */}
        <div style={{ marginTop: 20, padding: "16px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>How do your joints feel?</span>
            <span style={{ fontSize: 18 }}>{jointComfort > 0 ? jointEmojis[jointComfort - 1] : "—"}</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setJointComfort(n)} style={{
                flex: 1, padding: "8px 0", borderRadius: 8,
                border: `1px solid ${jointComfort === n ? (n <= 2 ? "#FF6B3C" : C.accent) : C.border}`,
                background: jointComfort === n ? (n <= 2 ? "#FF6B3C20" : `${C.accent}15`) : "transparent",
                color: jointComfort === n ? (n <= 2 ? "#FF6B3C" : C.accent) : C.dim,
                fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: C.mono,
              }}>{n}</button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 10, color: C.dim }}>Painful</span>
            <span style={{ fontSize: 10, color: C.dim }}>Perfect</span>
          </div>
        </div>

        {/* Dread question */}
        <div style={{ marginTop: 12, padding: "16px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 10 }}>Are you dreading this workout?</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setDreading(true)} style={{
              flex: 1, padding: "10px", borderRadius: 10,
              border: `1.5px solid ${dreading === true ? "#FF6B3C" : C.border}`,
              background: dreading === true ? "#FF6B3C20" : "transparent",
              color: dreading === true ? "#FF6B3C" : C.dim,
              fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: C.font,
            }}>Yeah 😩</button>
            <button onClick={() => setDreading(false)} style={{
              flex: 1, padding: "10px", borderRadius: 10,
              border: `1.5px solid ${dreading === false ? C.accent : C.border}`,
              background: dreading === false ? `${C.accent}20` : "transparent",
              color: dreading === false ? C.accent : C.dim,
              fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: C.font,
            }}>Let's go 💪</button>
          </div>
        </div>

        {/* Readiness Score Display — Pro only */}
        {isPro && readiness && (
          <div style={{ marginTop: 16, padding: "16px", borderRadius: 14, background: `${readiness.color}10`, border: `1px solid ${readiness.color}30`, textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: readiness.color, fontFamily: C.font }}>{readiness.score}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: readiness.color, marginTop: 2 }}>{readiness.label}</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 6, lineHeight: 1.4 }}>{readiness.suggestion}</div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={onSkip} style={{ flex: 1, padding: "12px", borderRadius: 14, border: `1px solid ${C.border}`, background: C.card, color: C.dim, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: C.font }}>Skip</button>
          <button onClick={handleSubmit} style={{ flex: 2, padding: "12px", borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, color: C.bg, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: C.font }}>Continue</button>
        </div>
      </div>
    </div>
  );
}

/* ═══ POST-WORKOUT FEEDBACK MODAL ═══ */
function PostWorkoutFeedback({ onSubmit, onSkip }) {
  const [step, setStep] = useState(1);
  const [pump, setPump] = useState(0);
  const [difficulty, setDifficulty] = useState(0);
  const pumpEmojis = I.pumpScale;
  const difficultyEmojis = I.difficultyScale;

  const isPump = step === 1;
  const rating = isPump ? pump : difficulty;
  const setRating = isPump ? setPump : setDifficulty;
  const emojis = isPump ? pumpEmojis : difficultyEmojis;
  const title = isPump ? "How was the pump?" : "How was the difficulty?";
  const subtitle = isPump ? "Rate overall pump 1-10" : "Rate overall effort 1-10";
  const defaultEmoji = isPump ? "💪" : "⚡";
  const label = isPump
    ? (rating === 0 ? "Tap a number" : rating <= 3 ? "Low pump" : rating <= 6 ? "Decent pump" : "Great pump!")
    : (rating === 0 ? "Tap a number" : rating <= 3 ? "Too easy" : rating <= 6 ? "Just right" : rating <= 8 ? "Challenging" : "Brutal");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#111113", borderRadius: 24, padding: "28px 24px", maxWidth: 380, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>Step {step} of 2</div>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{rating > 0 ? emojis[rating - 1] : defaultEmoji}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: C.dim, marginBottom: 24 }}>{subtitle}</div>
        <div style={{ display: "flex", gap: 4, justifyContent: "center", marginBottom: 8 }}>
          {[1,2,3,4,5,6,7,8,9,10].map(n => (
            <button key={n} onClick={() => setRating(n)} style={{
              width: 32, height: 40, borderRadius: 8,
              border: `1.5px solid ${rating === n ? C.accent : C.border}`,
              background: rating === n ? `${C.accent}20` : "transparent",
              color: rating === n ? C.accent : C.dim,
              fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: C.mono,
            }}>{n}</button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, marginBottom: 20 }}>{label}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onSkip} style={{ flex: 1, padding: "12px", borderRadius: 14, border: `1px solid ${C.border}`, background: C.card, color: C.dim, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: C.font }}>Skip</button>
          {isPump ? (
            <button onClick={() => { setStep(2); }} disabled={pump === 0} style={{ flex: 2, padding: "12px", borderRadius: 14, border: "none", background: pump > 0 ? `linear-gradient(135deg, ${C.accent}, ${C.accent2})` : "rgba(255,255,255,0.06)", color: pump > 0 ? C.bg : "rgba(255,255,255,0.2)", fontSize: 14, fontWeight: 800, cursor: pump > 0 ? "pointer" : "default", fontFamily: C.font }}>Next →</button>
          ) : (
            <button onClick={() => { onSubmit({ pump, difficulty }); }} disabled={difficulty === 0} style={{ flex: 2, padding: "12px", borderRadius: 14, border: "none", background: difficulty > 0 ? `linear-gradient(135deg, ${C.accent}, ${C.accent2})` : "rgba(255,255,255,0.06)", color: difficulty > 0 ? C.bg : "rgba(255,255,255,0.2)", fontSize: 14, fontWeight: 800, cursor: difficulty > 0 ? "pointer" : "default", fontFamily: C.font }}>Submit</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══ PROGRESS CHECK-IN MODAL ═══ */
function ProgressCheckinModal({ profile, enrollmentId, onSubmit, onClose }) {
  const [bodyweight, setBodyweight] = useState("");
  const [measurements, setMeasurements] = useState({ chest: "", waist: "", arms: "", legs: "" });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const unit = profile?.unit_system || "metric";
  const wUnit = unit === "imperial" ? "lbs" : "kg";

  const handleSubmit = async () => {
    setSaving(true);
    const bwKg = bodyweight ? (unit === "imperial" ? Math.round(Number(bodyweight) * 0.453592 * 10) / 10 : Number(bodyweight)) : null;
    const meas = {};
    Object.entries(measurements).forEach(([k, v]) => { if (v) meas[k] = Number(v); });
    await onSubmit({ enrollment_id: enrollmentId, bodyweight_kg: bwKg, measurements: Object.keys(meas).length > 0 ? meas : {}, performance_notes: notes || null });
    setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#111113", borderRadius: 24, padding: "28px 24px", maxWidth: 380, width: "100%", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 4 }}>Progress Check-in</div>
          <div style={{ fontSize: 13, color: C.dim }}>Track your progress over time</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Bodyweight ({wUnit})</div>
            <input type="number" value={bodyweight} onChange={e => setBodyweight(e.target.value)} placeholder={unit === "imperial" ? "e.g. 180" : "e.g. 80"} style={{ width: "100%", padding: "12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: C.font, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Measurements (cm) <span style={{ color: "rgba(255,255,255,0.2)" }}>optional</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {["chest", "waist", "arms", "legs"].map(m => (
                <div key={m}>
                  <div style={{ fontSize: 10, color: C.dim, marginBottom: 4, textTransform: "capitalize" }}>{m}</div>
                  <input type="number" value={measurements[m]} onChange={e => setMeasurements(prev => ({ ...prev, [m]: e.target.value }))} placeholder="—" style={{ width: "100%", padding: "8px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 14, fontFamily: C.font, outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Notes <span style={{ color: "rgba(255,255,255,0.2)" }}>optional</span></div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="How are you feeling?" rows={3} style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 13, fontFamily: C.font, outline: "none", resize: "none", boxSizing: "border-box" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 14, border: `1px solid ${C.border}`, background: C.card, color: C.dim, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: C.font }}>Later</button>
          <button onClick={handleSubmit} disabled={saving} style={{ flex: 2, padding: "12px", borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, color: C.bg, fontSize: 14, fontWeight: 800, cursor: saving ? "wait" : "pointer", fontFamily: C.font }}>{saving ? "Saving..." : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

// === SECTION: Program Onboarding ===
/* ═══ PROGRAM ONBOARDING ═══ */
function ProgramOnboardingScreen({ program, profile, prs, onEnroll, onBack }) {
  const [step, setStep] = useState(0);
  const [trainingDays, setTrainingDays] = useState(() => {
    // Default day selections keyed by days_per_week
    const defaults = {
      2: [1, 4],           // Mon, Thu
      3: [1, 3, 5],        // Mon, Wed, Fri
      4: [1, 2, 4, 5],     // Mon, Tue, Thu, Fri
      5: [1, 2, 3, 4, 5],  // Mon–Fri
      6: [1, 2, 3, 4, 5, 6], // Mon–Sat
      7: [0, 1, 2, 3, 4, 5, 6],
    };
    return defaults[program?.days_per_week] || defaults[3];
  });
  const [startingWeights, setStartingWeights] = useState({});
  const [checkinFreq, setCheckinFreq] = useState("weekly");
  const [startOption, setStartOption] = useState("next_monday");
  const [customDate, setCustomDate] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedProgram = program;
  const totalSteps = 4;
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Initialize starting weights from PRs
  useEffect(() => {
    if (prs && prs.length > 0 && Object.keys(startingWeights).length === 0) {
      const weights = {};
      prs.filter(p => p.pr_type === "1rm").forEach(p => {
        // Use ~75% of 1RM as working weight
        weights[p.exercise_name] = Math.round((p.estimated_1rm || p.weight_kg) * 0.75 / 2.5) * 2.5;
      });
      setStartingWeights(weights);
    }
  }, [prs]);

  const canNext = () => {
    if (step === 0) return trainingDays.length === selectedProgram?.days_per_week;
    return true;
  };

  const toggleDay = (d) => {
    setTrainingDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  };

  const getNextMonday = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
    const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
    const d = new Date(now);
    d.setDate(d.getDate() + daysUntilMonday);
    return d;
  };

  const getThisMonday = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
    const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return d;
  };

  const snapToMonday = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    const dayOfWeek = d.getDay();
    const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    d.setDate(d.getDate() + offset);
    return d;
  };

  const resolveStartDate = () => {
    if (startOption === "this_monday") return getThisMonday().toISOString().split('T')[0];
    if (startOption === "next_monday") return getNextMonday().toISOString().split('T')[0];
    // Custom date — snap to Monday
    if (customDate) return snapToMonday(customDate).toISOString().split('T')[0];
    return getNextMonday().toISOString().split('T')[0];
  };

  const formatDateLabel = (d) => {
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const nextMondayDate = getNextMonday();
  const thisMondayDate = getThisMonday();
  const isAlreadyMonday = new Date().getDay() === 1;

  const handleEnroll = async () => {
    setSaving(true);
    try {
      const settings = { trainingDays, startingWeights, checkin_frequency: checkinFreq };
      const days = (selectedProgram.program_days || []).sort((a, b) => a.sort_order - b.sort_order);
      const startDateStr = resolveStartDate();
      const enrollment = await enrollInProgram(selectedProgram.id, settings, startDateStr);
      await generateSchedule(enrollment.id, days, startDateStr, settings);
      onEnroll(enrollment);
    } catch (e) {
      console.error("Enrollment error:", e);
      alert("Failed to enroll: " + (e.message || "Unknown error"));
    }
    setSaving(false);
  };

  // Get exercises for selected program (for starting weights step)
  const allExercises = selectedProgram
    ? (selectedProgram.program_days || []).flatMap(d => d.program_day_exercises || [])
        .filter((ex, i, arr) => arr.findIndex(e => e.exercise_name === ex.exercise_name) === i)
        .filter(ex => ex.is_compound)
    : [];

  return (
    <div style={{ padding: "0 20px 110px" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "14px 0 6px" }}>
        <button onClick={step > 0 ? () => setStep(s => s - 1) : onBack} style={{ background: C.card, border: `1px solid ${C.border}`, color: "#fff", borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: C.font }}>← Back</button>
      </div>
      {/* Progress */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, marginBottom: 6 }}>Step {step + 1} of {totalSteps}</div>
        <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
          <div style={{ height: "100%", borderRadius: 2, background: C.accent, width: `${((step + 1) / totalSteps) * 100}%`, transition: "width 0.4s ease" }} />
        </div>
      </div>

      {/* Step 0 — Choose training days */}
      {step === 0 && selectedProgram && (
        <div>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Schedule</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 6 }}>Training days</div>
          <div style={{ fontSize: 13, color: C.dim, marginBottom: 20 }}>Select {selectedProgram.days_per_week} days ({trainingDays.length}/{selectedProgram.days_per_week})</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 20 }}>
            {dayNames.map((d, i) => {
              const dayNum = i + 1;
              const active = trainingDays.includes(dayNum);
              const canToggle = active || trainingDays.length < selectedProgram.days_per_week;
              return (
                <button key={d} onClick={() => canToggle && toggleDay(dayNum)} style={{
                  padding: "14px 0", borderRadius: 12,
                  border: `2px solid ${active ? C.accent : C.border}`,
                  background: active ? `${C.accent}15` : C.card,
                  color: active ? C.accent : (canToggle ? "#fff" : "rgba(255,255,255,0.15)"),
                  fontSize: 12, fontWeight: 700, cursor: canToggle ? "pointer" : "default",
                  fontFamily: C.font, transition: "all 0.2s",
                }}>{d}</button>
              );
            })}
          </div>
          {/* Show which workout goes on which day */}
          {trainingDays.length === selectedProgram.days_per_week && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {trainingDays.map((d, i) => {
                const programDay = (selectedProgram.program_days || []).sort((a, b) => a.sort_order - b.sort_order)[i];
                return programDay ? (
                  <div key={d} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 12, background: C.card, border: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 13, color: C.dim, fontFamily: C.mono }}>{dayNames[d - 1]}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{programDay.name}</span>
                  </div>
                ) : null;
              })}
            </div>
          )}

          {/* Start date selector */}
          {trainingDays.length === selectedProgram.days_per_week && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 10, fontFamily: C.font }}>When do you want to start?</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { id: "next_monday", label: isAlreadyMonday ? "Today" : "Next Monday", desc: formatDateLabel(nextMondayDate), icon: "📅" },
                  ...(!isAlreadyMonday ? [{ id: "this_monday", label: "This week", desc: `From ${formatDateLabel(thisMondayDate)} — past days skipped`, icon: "⚡" }] : []),
                  { id: "custom", label: "Pick a date", desc: customDate ? `Starts Monday of ${new Date(customDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} week` : "Choose a custom start", icon: "🗓️" },
                ].map(opt => (
                  <button key={opt.id} onClick={() => setStartOption(opt.id)} style={{
                    padding: "14px 16px", borderRadius: 14,
                    border: `2px solid ${startOption === opt.id ? C.accent : C.border}`,
                    background: startOption === opt.id ? `${C.accent}12` : C.card,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s",
                  }}>
                    <span style={{ fontSize: 20 }}>{opt.icon}</span>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: startOption === opt.id ? C.accent : "#fff", fontFamily: C.font }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: C.dim }}>{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              {startOption === "custom" && (
                <input
                  type="date"
                  value={customDate}
                  onChange={e => setCustomDate(e.target.value)}
                  style={{
                    width: "100%", marginTop: 10, padding: "12px 14px", borderRadius: 12,
                    border: `1px solid ${C.border}`, background: C.card, color: "#fff",
                    fontSize: 14, fontFamily: C.font, boxSizing: "border-box",
                  }}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 1 — Starting weights */}
      {step === 1 && (
        <div>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Starting Weights</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 6 }}>Set your weights</div>
          <div style={{ fontSize: 13, color: C.dim, marginBottom: 20 }}>Compound lifts — adjust as needed</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {allExercises.map(ex => (
              <div key={ex.exercise_name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 14, background: C.card, border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{ex.exercise_name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => setStartingWeights(prev => ({ ...prev, [ex.exercise_name]: Math.max(0, (prev[ex.exercise_name] || 20) - 2.5) }))} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: C.font, minWidth: 50, textAlign: "center" }}>{startingWeights[ex.exercise_name] || 20}<span style={{ fontSize: 11, color: C.dim }}>kg</span></span>
                  <button onClick={() => setStartingWeights(prev => ({ ...prev, [ex.exercise_name]: (prev[ex.exercise_name] || 20) + 2.5 }))} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${C.accent}40`, background: `${C.accent}12`, color: C.accent, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — Check-in frequency */}
      {step === 2 && (
        <div>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Progress Tracking</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 6 }}>Check-in frequency</div>
          <div style={{ fontSize: 13, color: C.dim, marginBottom: 24 }}>How often do you want to log bodyweight and measurements?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[{ id: "daily", label: "Daily", desc: "Track every day for maximum data", icon: "📅" }, { id: "weekly", label: "Weekly", desc: "Once a week — less hassle, still effective", icon: "📆" }].map(f => (
              <button key={f.id} onClick={() => setCheckinFreq(f.id)} style={{
                padding: "18px 16px", borderRadius: 16,
                border: `2px solid ${checkinFreq === f.id ? C.accent : C.border}`,
                background: checkinFreq === f.id ? `${C.accent}12` : C.card,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 14, transition: "all 0.2s"
              }}>
                <span style={{ fontSize: 24 }}>{f.icon}</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: checkinFreq === f.id ? C.accent : "#fff", fontFamily: C.font }}>{f.label}</div>
                  <div style={{ fontSize: 12, color: C.dim }}>{f.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3 — Summary */}
      {step === 3 && selectedProgram && (
        <div>
          <div style={{ fontSize: 11, color: C.accent, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Summary</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 20 }}>Ready to start?</div>
          <div style={{ padding: "20px", borderRadius: 20, background: `${selectedProgram.color}08`, border: `1px solid ${selectedProgram.color}30`, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 32 }}>{selectedProgram.icon}</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: C.font }}>{selectedProgram.name}</div>
                <div style={{ fontSize: 12, color: C.dim }}>{selectedProgram.days_per_week} days/week · {selectedProgram.duration_weeks} weeks</div>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {trainingDays.map(d => (
                <span key={d} style={{ padding: "4px 10px", borderRadius: 8, background: `${selectedProgram.color}18`, color: selectedProgram.color, fontSize: 11, fontWeight: 700, fontFamily: C.mono }}>{dayNames[d - 1]}</span>
              ))}
            </div>
            <div style={{ fontSize: 12, color: C.dim }}>Starts: Monday, {new Date(resolveStartDate() + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>Check-in: {checkinFreq}</div>
          </div>
          {/* Week overview */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
            {[1,2,3,4,5].map(w => (
              <div key={w} style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: w === 5 ? "rgba(164,123,255,0.1)" : `${C.accent}08`, border: `1px solid ${w === 5 ? "rgba(164,123,255,0.2)" : C.border}`, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: w === 5 ? C.ai : C.dim, fontFamily: C.mono }}>{getWeekLabel(w)}</div>
                <div style={{ fontSize: 11, color: w === 5 ? C.ai : "#fff", fontWeight: 600, marginTop: 2 }}>{w === 5 ? "Deload" : `RIR ${WEEK_CONFIG[w].rir}`}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next / Start button */}
      <button
        onClick={step < totalSteps - 1 ? () => setStep(s => s + 1) : handleEnroll}
        disabled={!canNext() || saving}
        style={{
          width: "100%", padding: "16px", borderRadius: 16, border: "none", marginTop: 20,
          background: canNext() ? `linear-gradient(135deg, ${selectedProgram?.color || C.accent}, ${selectedProgram?.color || C.accent}CC)` : "rgba(255,255,255,0.06)",
          color: canNext() ? C.bg : "rgba(255,255,255,0.2)",
          fontSize: 16, fontWeight: 800, fontFamily: C.font,
          cursor: canNext() && !saving ? "pointer" : "default",
        }}
      >
        {saving ? "Setting up..." : step < totalSteps - 1 ? "Continue →" : "Start Program 🚀"}
      </button>
    </div>
  );
}

// === SECTION: Program Builder ===
/* ═══ PROGRAM BUILDER SCREEN ═══ */
function ProgramBuilderScreen({ onBack, onCreated }) {
  const [step, setStep] = useState(0);
  const [programName, setProgramName] = useState("My Program");
  const [goal, setGoal] = useState("hypertrophy");
  const [programColor, setProgramColor] = useState("#A47BFF");
  const [programIcon, setProgramIcon] = useState("💪");
  const [activeCategory, setActiveCategory] = useState("Chest");
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [exPerSession, setExPerSession] = useState(5);
  const [durationMin, setDurationMin] = useState(60);
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const COLORS = ["#A47BFF", "#DFFF3C", "#3CFFF0", "#FF6B3C", "#FF9F3C"];
  const PROGRAM_ICONS = I === ICONS.minimal
    ? [I.strength, I.fire, I.legsM, I.upper, I.barbell, I.target]
    : ["💪", "🔥", "🦵", "⚡", "🏋️", "🎯"];
  const GOALS = ["hypertrophy", "strength", "endurance", "general"];
  const DURATIONS = [30, 45, 60, 90];
  const CATEGORIES = Object.keys(EX_LIB);

  const recommended = Math.max(3, Math.min(8, Math.floor(durationMin / 12)));

  const canNext = [
    programName.trim().length > 0,
    true,
    selectedExercises.length >= 1,
    true,
  ][step];

  function toggleExercise(ex) {
    setSelectedExercises(prev => {
      const exists = prev.find(e => e.name === ex.name);
      if (exists) return prev.filter(e => e.name !== ex.name);
      return [...prev, { ...ex, category: activeCategory }];
    });
  }

  function buildProgramData() {
    const split_type = daysPerWeek <= 3 ? "full_body" : daysPerWeek === 4 ? "upper_lower" : "ppl";
    const isCompound = (ex) => ex.equipment === "Barbell" || ["Pull-ups", "Chest Dip"].includes(ex.name);
    const baseReps = { hypertrophy: 10, strength: 5, endurance: 15, general: 8 }[goal];

    const UPPER_CATS = ["Chest", "Back", "Shoulders", "Arms"];
    const PUSH_CATS = ["Chest", "Shoulders"];
    const PULL_CATS = ["Back", "Arms"];

    // Fill a pool up to exPerSession items, never repeating within a single day
    const fillSlots = (pool) => pool.slice(0, exPerSession);

    let buckets;
    if (split_type === "full_body") {
      buckets = Array.from({ length: daysPerWeek }, (_, dayIdx) =>
        fillSlots(selectedExercises)
      );
    } else if (split_type === "upper_lower") {
      const upper = selectedExercises.filter(e => UPPER_CATS.includes(e.category));
      const lower = selectedExercises.filter(e => !UPPER_CATS.includes(e.category));
      // Fallback: if one bucket is empty, use all exercises
      const upperPool = upper.length > 0 ? upper : selectedExercises;
      const lowerPool = lower.length > 0 ? lower : selectedExercises;
      buckets = Array.from({ length: daysPerWeek }, (_, i) => fillSlots(i % 2 === 0 ? upperPool : lowerPool));
    } else {
      const push = selectedExercises.filter(e => PUSH_CATS.includes(e.category));
      const pull = selectedExercises.filter(e => PULL_CATS.includes(e.category));
      const legs = selectedExercises.filter(e => e.category === "Legs");
      // Fallback: empty buckets get all exercises
      const pushPool = push.length > 0 ? push : selectedExercises;
      const pullPool = pull.length > 0 ? pull : selectedExercises;
      const legsPool = legs.length > 0 ? legs : selectedExercises;
      const pplCycle = [pushPool, pullPool, legsPool];
      buckets = Array.from({ length: daysPerWeek }, (_, i) => fillSlots(pplCycle[i % 3]));
    }

    const dayNames = { full_body: ["Full Body A", "Full Body B", "Full Body C", "Full Body D", "Full Body E", "Full Body F"],
      upper_lower: ["Upper A", "Lower A", "Upper B", "Lower B", "Upper C", "Lower C"],
      ppl: ["Push", "Pull", "Legs", "Push", "Pull", "Legs"] };

    const days = buckets.map((exList, idx) => ({
      day_index: idx,
      name: (dayNames[split_type] || [])[idx] || `Day ${idx + 1}`,
      muscle_groups: [...new Set(exList.map(e => e.category))],
      exercises: exList.map((ex, si) => ({
        exercise_name: ex.name,
        base_sets: 3,
        base_reps: baseReps,
        is_compound: isCompound(ex),
        sort_order: si,
      })),
    }));

    return {
      name: programName,
      description: `${daysPerWeek} days/week · ${goal} · built with wizard`,
      split_type,
      days_per_week: daysPerWeek,
      goal,
      color: programColor,
      icon: programIcon,
      days,
    };
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    try {
      const data = buildProgramData();
      const newProgram = await createUserProgram(data);
      onCreated(newProgram);
    } catch (e) {
      setError(e.message || "Failed to create program");
      setSaving(false);
    }
  }

  const stepTitles = ["Name & Goal", "Session Setup", "Pick Exercises", "Review & Create"];

  return (
    <div style={{ padding: "0 20px 110px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "14px 0 6px", gap: 12 }}>
        <button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, color: "#fff", borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: C.font }}>← Back</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: C.font }}>Build Custom Program</div>
          <div style={{ fontSize: 11, color: C.dim }}>Step {step + 1} of 4 — {stepTitles[step]}</div>
        </div>
      </div>

      {/* Step indicators */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? programColor : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />
        ))}
      </div>

      {/* Step 0 — Name & Goal */}
      {step === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 8, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: 1 }}>Program Name</div>
            <input value={programName} onChange={e => setProgramName(e.target.value)}
              style={{ width: "100%", padding: "14px 16px", borderRadius: 14, background: C.card, border: `1px solid ${C.border}`, color: "#fff", fontSize: 16, fontFamily: C.font, outline: "none", boxSizing: "border-box" }} />
          </div>

          <div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 8, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: 1 }}>Goal</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {GOALS.map(g => (
                <button key={g} onClick={() => setGoal(g)} style={{
                  padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, fontFamily: C.font, cursor: "pointer",
                  background: goal === g ? programColor : C.card,
                  color: goal === g ? "#000" : C.dim,
                  border: `1px solid ${goal === g ? programColor : C.border}`,
                }}>{g.charAt(0).toUpperCase() + g.slice(1)}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 8, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: 1 }}>Color</div>
            <div style={{ display: "flex", gap: 10 }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setProgramColor(c)} style={{
                  width: 36, height: 36, borderRadius: "50%", background: c, border: programColor === c ? `3px solid #fff` : "3px solid transparent",
                  cursor: "pointer", flexShrink: 0,
                }} />
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 8, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: 1 }}>Icon</div>
            <div style={{ display: "flex", gap: 8 }}>
              {PROGRAM_ICONS.map(ic => (
                <button key={ic} onClick={() => setProgramIcon(ic)} style={{
                  width: 44, height: 44, borderRadius: 12, fontSize: 22, background: programIcon === ic ? `${programColor}30` : C.card,
                  border: `1px solid ${programIcon === ic ? programColor : C.border}`, cursor: "pointer",
                }}>{ic}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 1 — Session Preferences */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 10, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: 1 }}>Days per Week</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button onClick={() => setDaysPerWeek(d => Math.max(2, d - 1))} style={{ width: 40, height: 40, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, color: "#fff", fontSize: 20, cursor: "pointer", fontFamily: C.font }}>−</button>
              <span style={{ fontSize: 28, fontWeight: 800, color: programColor, fontFamily: C.mono, minWidth: 30, textAlign: "center" }}>{daysPerWeek}</span>
              <button onClick={() => setDaysPerWeek(d => Math.min(6, d + 1))} style={{ width: 40, height: 40, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, color: "#fff", fontSize: 20, cursor: "pointer", fontFamily: C.font }}>+</button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 10, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: 1 }}>Exercises per Session</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button onClick={() => setExPerSession(e => Math.max(3, e - 1))} style={{ width: 40, height: 40, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, color: "#fff", fontSize: 20, cursor: "pointer", fontFamily: C.font }}>−</button>
              <span style={{ fontSize: 28, fontWeight: 800, color: programColor, fontFamily: C.mono, minWidth: 30, textAlign: "center" }}>{exPerSession}</span>
              <button onClick={() => setExPerSession(e => Math.min(8, e + 1))} style={{ width: 40, height: 40, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, color: "#fff", fontSize: 20, cursor: "pointer", fontFamily: C.font }}>+</button>
            </div>
            {exPerSession !== recommended && (
              <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.08)`, fontSize: 12, color: C.dim }}>
                💡 For {durationMin} min, ~{recommended} exercises is realistic
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 10, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: 1 }}>Workout Duration</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DURATIONS.map(d => (
                <button key={d} onClick={() => setDurationMin(d)} style={{
                  padding: "10px 18px", borderRadius: 20, fontSize: 14, fontWeight: 600, fontFamily: C.font, cursor: "pointer",
                  background: durationMin === d ? programColor : C.card,
                  color: durationMin === d ? "#000" : C.dim,
                  border: `1px solid ${durationMin === d ? programColor : C.border}`,
                }}>{d} min</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2 — Select Exercises */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 13, color: C.dim }}>Pick your exercises — they'll be distributed across {daysPerWeek} days ({exPerSession}/session). Selected: <span style={{ color: programColor, fontWeight: 700 }}>{selectedExercises.length}</span></div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
            {CATEGORIES.map(cat => {
              const count = selectedExercises.filter(e => e.category === cat).length;
              return (
                <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                  padding: "8px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: C.font, cursor: "pointer", flexShrink: 0,
                  background: activeCategory === cat ? programColor : C.card,
                  color: activeCategory === cat ? "#000" : C.dim,
                  border: `1px solid ${activeCategory === cat ? programColor : C.border}`,
                }}>
                  {cat}{count > 0 ? ` (${count})` : ""}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(EX_LIB[activeCategory] || []).map(ex => {
              const selected = !!selectedExercises.find(e => e.name === ex.name);
              return (
                <button key={ex.name} onClick={() => toggleExercise(ex)} style={{
                  padding: "10px 14px", borderRadius: 14, fontSize: 13, fontWeight: 600, fontFamily: C.font, cursor: "pointer",
                  background: selected ? `${programColor}25` : C.card,
                  color: selected ? programColor : "#fff",
                  border: `1px solid ${selected ? programColor : C.border}`,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span>{ex.icon}</span> {ex.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3 — Summary */}
      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Program card preview */}
          <div style={{ padding: "18px 16px", borderRadius: 20, border: `1px solid ${programColor}40`, background: `${programColor}08` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <span style={{ fontSize: 32 }}>{programIcon}</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: C.font }}>{programName}</div>
                <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{daysPerWeek} days/week · {goal} · {durationMin} min sessions</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["Goal: " + goal, "Split: " + (daysPerWeek <= 3 ? "Full Body" : daysPerWeek === 4 ? "Upper/Lower" : "PPL"), `${selectedExercises.length} exercises`, `${exPerSession}/session`].map(tag => (
                <span key={tag} style={{ padding: "4px 10px", borderRadius: 10, background: `${programColor}20`, color: programColor, fontSize: 11, fontWeight: 600, fontFamily: C.mono }}>{tag}</span>
              ))}
            </div>
          </div>

          {/* Day breakdown */}
          <div style={{ fontSize: 12, color: C.dim, fontFamily: C.mono, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Exercise Distribution</div>
          {Array.from({ length: daysPerWeek }, (_, i) => {
            const UPPER_CATS = ["Chest", "Back", "Shoulders", "Arms"];
            const PUSH_CATS = ["Chest", "Shoulders"];
            const PULL_CATS = ["Back", "Arms"];
            const split_type = daysPerWeek <= 3 ? "full_body" : daysPerWeek === 4 ? "upper_lower" : "ppl";
            const fillSlots = (pool) => pool.slice(0, exPerSession);
            let exList;
            if (split_type === "full_body") {
              exList = fillSlots(selectedExercises);
            } else if (split_type === "upper_lower") {
              const upper = selectedExercises.filter(e => UPPER_CATS.includes(e.category));
              const lower = selectedExercises.filter(e => !UPPER_CATS.includes(e.category));
              exList = fillSlots(i % 2 === 0 ? (upper.length > 0 ? upper : selectedExercises) : (lower.length > 0 ? lower : selectedExercises));
            } else {
              const push = selectedExercises.filter(e => PUSH_CATS.includes(e.category));
              const pull = selectedExercises.filter(e => PULL_CATS.includes(e.category));
              const legs = selectedExercises.filter(e => e.category === "Legs");
              const pplCycle = [push.length > 0 ? push : selectedExercises, pull.length > 0 ? pull : selectedExercises, legs.length > 0 ? legs : selectedExercises];
              exList = fillSlots(pplCycle[i % 3]);
            }
            const dayLabel = (daysPerWeek <= 3 ? ["Full Body A","Full Body B","Full Body C"] : daysPerWeek === 4 ? ["Upper A","Lower A","Upper B","Lower B"] : ["Push","Pull","Legs","Push","Pull","Legs"])[i];
            return (
              <div key={i} style={{ padding: "12px 14px", borderRadius: 14, background: C.card, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: C.font, marginBottom: 6 }}>Day {i+1} — {dayLabel}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {exList.map((ex, si) => (
                    <span key={si} style={{ padding: "3px 8px", borderRadius: 8, background: `${programColor}15`, color: programColor, fontSize: 11, fontFamily: C.mono }}>{ex.icon} {ex.name}</span>
                  ))}
                  {exList.length === 0 && <span style={{ fontSize: 12, color: C.dim }}>No exercises assigned</span>}
                </div>
              </div>
            );
          })}

          {error && <div style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", color: "#FF6B6B", fontSize: 13 }}>{error}</div>}
        </div>
      )}

      {/* Navigation buttons */}
      <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} style={{
            flex: 1, padding: "14px", borderRadius: 16, background: C.card, border: `1px solid ${C.border}`,
            color: "#fff", fontSize: 15, fontWeight: 700, fontFamily: C.font, cursor: "pointer",
          }}>← Back</button>
        )}
        {step < 3 ? (
          <button onClick={() => canNext && setStep(s => s + 1)} style={{
            flex: 2, padding: "14px", borderRadius: 16,
            background: canNext ? programColor : "rgba(255,255,255,0.08)",
            color: canNext ? "#000" : C.dim,
            fontSize: 15, fontWeight: 700, fontFamily: C.font, cursor: canNext ? "pointer" : "not-allowed",
            border: "none",
          }}>Continue →</button>
        ) : (
          <button onClick={handleSubmit} disabled={saving} style={{
            flex: 2, padding: "14px", borderRadius: 16,
            background: saving ? "rgba(255,255,255,0.08)" : programColor,
            color: saving ? C.dim : "#000",
            fontSize: 15, fontWeight: 700, fontFamily: C.font, cursor: saving ? "not-allowed" : "pointer",
            border: "none",
          }}>{saving ? "Creating..." : "Create Program 🚀"}</button>
        )}
      </div>
    </div>
  );
}

// === SECTION: Volume Dashboard ===
/* ═══ VOLUME DASHBOARD SCREEN ═══ */
function VolumeDashboardScreen({ enrollment, volumeStandards, onBack }) {
  if (!enrollment || !enrollment.programs) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: C.dim }}>
        <div style={{ fontSize: 16, marginBottom: 8 }}>No active program</div>
        <button onClick={onBack} style={{ padding: "10px 20px", borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, color: "#fff", cursor: "pointer", fontFamily: C.font }}>Back</button>
      </div>
    );
  }

  const muscleGroups = ['Chest', 'Back', 'Quads', 'Hamstrings', 'Glutes', 'Shoulders', 'Biceps', 'Triceps', 'Calves', 'Abs'];
  const week = enrollment.current_week || 1;

  // Derive current week's sets per muscle from scheduled workout prescribed_exercises
  // We'll show standards + current week target
  const getWeekTarget = (std) => {
    if (!std) return null;
    const midpoint = (a, b) => Math.round((a + b) / 2);
    switch (week) {
      case 1: return std.mev_high;
      case 2: return midpoint(std.mev_high, std.mav_low);
      case 3: return midpoint(std.mav_low, std.mav_high);
      case 4: return std.mav_high;
      case 5: return std.mev_low;
      default: return std.mev_high;
    }
  };

  const getZoneForSets = (sets, std) => {
    if (!std) return null;
    if (sets <= std.mev_high) return { label: "least sets needed to grow", color: "#2DD4BF" };
    if (sets <= std.mav_high) return { label: "best growth range", color: "#A3E635" };
    return { label: "upper limit before burning out", color: "#F97316" };
  };

  const activeMuscles = muscleGroups.filter(mg => volumeStandards[mg]);

  return (
    <div style={{ padding: "0 20px 110px" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "14px 0 6px", gap: 12 }}>
        <button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, color: "#fff", borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: C.font }}>← Back</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: C.font }}>Volume by Muscle</div>
          <div style={{ fontSize: 11, color: C.dim }}>Week {week} targets</div>
        </div>
      </div>

      {activeMuscles.length === 0 ? (
        <div style={{ textAlign: "center", color: C.dim, padding: "40px 20px", fontSize: 14 }}>
          Volume standards not loaded. Check your program settings.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
          {activeMuscles.map(mg => {
            const std = volumeStandards[mg];
            const target = getWeekTarget(std);
            const zone = target !== null ? getZoneForSets(target, std) : null;
            const barTotal = std.mrv_high;
            const mevPct = (std.mev_high / barTotal) * 100;
            const mavEndPct = (std.mav_high / barTotal) * 100;
            const markerPct = target !== null ? Math.min((target / barTotal) * 100, 100) : 0;

            return (
              <div key={mg} style={{ padding: "16px", borderRadius: 16, background: C.card, border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: C.font }}>{mg}</span>
                  <div style={{ textAlign: "right" }}>
                    {target !== null && <span style={{ fontSize: 14, fontWeight: 800, color: zone?.color || C.accent, fontFamily: C.mono }}>{target} sets</span>}
                    {zone && <div style={{ fontSize: 10, color: zone.color, fontFamily: C.mono, marginTop: 1 }}>{zone.label}</div>}
                  </div>
                </div>
                {/* Volume bar */}
                <div style={{ position: "relative", height: 12, borderRadius: 6, background: "rgba(255,255,255,0.06)", overflow: "visible" }}>
                  {/* MEV zone (teal) */}
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${mevPct}%`, borderRadius: "6px 0 0 6px", background: "#2DD4BF30" }} />
                  {/* MAV zone (yellow-green) */}
                  <div style={{ position: "absolute", left: `${mevPct}%`, top: 0, height: "100%", width: `${mavEndPct - mevPct}%`, background: "#A3E63530" }} />
                  {/* MRV zone (orange) */}
                  <div style={{ position: "absolute", left: `${mavEndPct}%`, top: 0, height: "100%", width: `${100 - mavEndPct}%`, borderRadius: "0 6px 6px 0", background: "#F9731620" }} />
                  {/* Current week marker */}
                  {target !== null && (
                    <div style={{ position: "absolute", top: -2, height: 16, width: 3, borderRadius: 2, background: zone?.color || C.accent, left: `calc(${markerPct}% - 1.5px)`, boxShadow: `0 0 6px ${zone?.color || C.accent}` }} />
                  )}
                </div>
                {/* Legend */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontSize: 9, color: "#2DD4BF", fontFamily: C.mono }}>{std.mev_low}–{std.mev_high} least needed</span>
                  <span style={{ fontSize: 9, color: "#A3E635", fontFamily: C.mono }}>{std.mav_low}–{std.mav_high} best</span>
                  <span style={{ fontSize: 9, color: "#F97316", fontFamily: C.mono }}>{std.mrv_low}–{std.mrv_high} limit</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// === SECTION: Programs ===
/* ═══ PROGRAM SCREEN ═══ */
function ProgramScreen({ enrollment, programs, profile, prs, onStartOnboarding, onStartWorkout, onAbandon, onNav, highlightProgramId, onClearHighlight, scheduleRefreshKey, onCreateProgram, onDeleteProgram }) {
  const [weekView, setWeekView] = useState(enrollment?.current_week || 1);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewWorkout, setPreviewWorkout] = useState(null);

  // Load scheduled workouts for current week view
  useEffect(() => {
    if (!enrollment) return;
    const loadSchedule = async () => {
      setLoading(true);
      const data = await getScheduledWorkouts(null, null, enrollment.id, weekView);
      setSchedule(data || []);
      setLoading(false);
    };
    loadSchedule();
  }, [enrollment, weekView, scheduleRefreshKey]);

  // No enrollment — show program browser
  if (!enrollment) {
    return (
      <div style={{ padding: "0 20px 110px" }}>
        <div style={{ textAlign: "center", padding: "20px 0 24px" }}>
          <div style={{ fontSize: 10, color: C.accent, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Training Programs</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: C.font }}>Choose a Program</div>
          <div style={{ fontSize: 13, color: C.dim, marginTop: 6 }}>Structured 5-week mesocycles with auto-progression</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {programs.map(p => (
            <div key={p.id} onClick={() => { if (onClearHighlight) onClearHighlight(); onStartOnboarding(p); }} style={{
                width: "100%", padding: "18px 16px", borderRadius: 20, boxSizing: "border-box",
                border: p.id === highlightProgramId ? `2px solid ${p.color}` : `1px solid ${p.color}30`,
                background: p.id === highlightProgramId ? `${p.color}18` : `${p.color}08`,
                boxShadow: p.id === highlightProgramId ? `0 0 16px ${p.color}40` : "none",
                cursor: "pointer", textAlign: "left", transition: "all 0.2s"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 28 }}>{I === ICONS.minimal ? ({"💪":I.strength,"🔥":I.fire,"🦵":I.legsM,"⚡":I.upper,"🏋️":I.barbell,"🎯":I.target,"🏆":I.trophy}[p.icon] || I.program) : p.icon}</span>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", fontFamily: C.font }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{p.days_per_week} days/week · {p.duration_weeks} weeks</div>
                      <div style={{ fontSize: 11, color: C.dim, marginTop: 4, lineHeight: 1.4 }}>{p.description}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {p.user_id && <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete "${p.name}" permanently?`)) onDeleteProgram(p.id); }} style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,60,60,0.12)", border: "1px solid rgba(255,60,60,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#ff6060", cursor: "pointer" }}>✕</button>}
                    <div style={{ width: 36, height: 36, borderRadius: 12, background: `${p.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: p.color }}>→</div>
                  </div>
                </div>
            </div>
          ))}
        </div>
        <button onClick={onCreateProgram} style={{
          width: "100%", padding: "16px", borderRadius: 20,
          border: `1px solid rgba(255,255,255,0.1)`,
          background: "rgba(255,255,255,0.04)",
          cursor: "pointer", color: C.dim, fontSize: 14,
          fontFamily: C.font, fontWeight: 600, marginTop: 4
        }}>
          + Build Custom Program
        </button>
      </div>
    );
  }

  // Active enrollment — calendar view
  const program = enrollment.programs;
  const color = program?.color || C.accent;
  const deload = isDeloadWeek(weekView);
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Build week calendar
  const startedAt = new Date(enrollment.started_at);
  const weekStart = new Date(startedAt);
  weekStart.setDate(weekStart.getDate() + (weekView - 1) * 7);

  const todayStr = new Date().toISOString().split('T')[0];
  const calendarDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const workout = schedule.find(s => s.scheduled_date === dateStr);
    const isToday = dateStr === todayStr;
    const isPast = dateStr < todayStr;
    return { date, dateStr, dayName: dayNames[i], workout, isToday, isPast };
  });

  // Auto-mark past scheduled workouts as skipped (fire-and-forget DB update)
  useEffect(() => {
    const pastScheduled = calendarDays
      .filter(d => d.isPast && d.workout?.status === 'scheduled')
      .map(d => d.workout);
    if (pastScheduled.length > 0) {
      pastScheduled.forEach(w => {
        updateScheduledWorkout(w.id, { status: 'skipped' }).catch(() => {});
      });
    }
  }, [schedule]);

  return (
    <div style={{ padding: "0 20px 110px" }}>
      {/* Header */}
      <div style={{ padding: "16px 0 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 10, color: color, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase" }}>Active Program</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: C.font }}>{program?.name}</div>
          </div>
          <button onClick={() => onNav("volumeDashboard")} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, color: C.accent, padding: "6px 12px", fontSize: 11, cursor: "pointer", fontFamily: C.font }}>Volume</button>
          <button onClick={onAbandon} style={{ background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.15)", borderRadius: 10, color: "rgba(255,80,80,0.6)", padding: "6px 12px", fontSize: 11, cursor: "pointer", fontFamily: C.font }}>End</button>
        </div>
      </div>

      {/* Week navigator */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {[1,2,3,4,5].map(w => (
          <button key={w} onClick={() => setWeekView(w)} style={{
            flex: 1, padding: "10px 0", borderRadius: 10,
            border: `1.5px solid ${weekView === w ? (w === 5 ? C.ai : color) : C.border}`,
            background: weekView === w ? (w === 5 ? `${C.ai}15` : `${color}15`) : "transparent",
            color: weekView === w ? (w === 5 ? C.ai : color) : C.dim,
            fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: C.mono, textAlign: "center"
          }}>
            {getWeekLabel(w)}
          </button>
        ))}
      </div>

      {/* Deload banner */}
      {deload && (
        <div style={{ padding: "12px 16px", borderRadius: 14, background: `${C.ai}10`, border: `1px solid ${C.ai}25`, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🧘</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ai }}>Deload Week</div>
            <div style={{ fontSize: 11, color: C.dim }}>50% volume, lighter weights — focus on recovery</div>
          </div>
        </div>
      )}

      {/* Calendar */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: C.dim }}>Loading schedule...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {calendarDays.map(day => {
            const w = day.workout;
            const effectiveStatus = (w?.status === "scheduled" && day.isPast) ? "skipped" : w?.status;
            const statusColor = effectiveStatus === "completed" ? "#4CAF50" : effectiveStatus === "skipped" ? "#FF6B3C" : color;
            return (
              <div key={day.dateStr} style={{
                padding: "14px 16px", borderRadius: 16,
                border: `1px solid ${day.isToday ? `${color}50` : C.border}`,
                background: day.isToday ? `${color}08` : C.card,
                opacity: !w ? 0.5 : 1,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ textAlign: "center", minWidth: 36 }}>
                      <div style={{ fontSize: 10, color: day.isToday ? color : C.dim, fontFamily: C.mono, fontWeight: 700 }}>{day.dayName}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: day.isToday ? "#fff" : C.dim, fontFamily: C.font }}>{day.date.getDate()}</div>
                    </div>
                    {w ? (
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{w.program_days?.name || "Workout"}</div>
                        <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
                          {(w.prescribed_exercises || []).length} exercises · Reps in Reserve {WEEK_CONFIG[w.week_number]?.rir}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: C.dim }}>Rest day</div>
                    )}
                  </div>
                  {w && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {effectiveStatus === "completed" && <span style={{ fontSize: 18 }}>✅</span>}
                      {effectiveStatus === "skipped" && <span style={{ fontSize: 14, color: "#FF6B3C" }}>Skipped</span>}
                      {effectiveStatus === "scheduled" && day.isToday && (
                        <button onClick={() => onStartWorkout(w)} style={{
                          background: `linear-gradient(135deg, ${color}, ${color}CC)`, border: "none",
                          color: C.bg, borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer"
                        }}>Start</button>
                      )}
                      {effectiveStatus === "scheduled" && !day.isToday && (
                        <button onClick={() => setPreviewWorkout(w)} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 9, padding: "5px 10px", fontSize: 11, color: C.dim, cursor: "pointer", fontFamily: C.font }}>Preview</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {previewWorkout && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(16px)", zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={() => setPreviewWorkout(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#111113", borderRadius: "26px 26px 0 0", padding: "24px 20px 48px", maxHeight: "75vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", margin: "0 auto 20px" }} />
            <div style={{ fontSize: 10, color, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Week {previewWorkout.week_number} Preview</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 4 }}>{previewWorkout.program_days?.name || "Workout"}</div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 20 }}>
              {(previewWorkout.prescribed_exercises || []).length} exercises · Reps in Reserve {WEEK_CONFIG[previewWorkout.week_number]?.rir}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(previewWorkout.prescribed_exercises || []).map((ex, i) => {
                const zoneLabel = getVolumeZoneLabel(ex.volumeZone);
                const zoneColor = getVolumeZoneColor(ex.volumeZone);
                return (
                <div key={i} style={{ padding: "14px 16px", borderRadius: 14, background: C.card, border: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{ex.exercise_name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {zoneLabel && <span style={{ fontSize: 10, color: zoneColor, fontFamily: C.mono, fontWeight: 700 }}>{zoneLabel}</span>}
                      <span style={{ fontSize: 12, color: C.dim, fontFamily: C.mono }}>{ex.sets} × {ex.reps}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>{ex.weight}kg</div>
                </div>
                );
              })}
            </div>
            <button onClick={() => setPreviewWorkout(null)} style={{ width: "100%", padding: "14px", borderRadius: 16, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 20, fontFamily: C.font }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// === SECTION: Exercise Library ===
/* ═══ EXERCISE LIBRARY ═══ */

const muscleColors = {
  Chest: "#FF6B3C",
  Back: "#3CFFF0",
  Legs: "#DFFF3C",
  Shoulders: "#B47CFF",
  Arms: "#FF9F3C",
  Core: "#FF3C8E",
};

const difficultyColors = {
  Beginner: "#4ADE80",
  Intermediate: "#DFFF3C",
  Advanced: "#FF6B3C",
};

function buildCombinedLibrary(customExercises = []) {
  const builtIns = Object.entries(EX_LIB).flatMap(([cat, exs]) =>
    exs.map(ex => ({ ...ex, isCustom: false }))
  );
  const customs = customExercises.map(ex => ({
    name: ex.name,
    equipment: ex.equipment || "Bodyweight",
    icon: ex.icon || "🏋️",
    muscleGroup: ex.muscle_group,
    difficulty: ex.difficulty || "Intermediate",
    notes: ex.notes,
    id: ex.id,
    isCustom: true,
  }));
  return [...builtIns, ...customs.sort((a, b) => a.name.localeCompare(b.name))];
}

function ExerciseLibraryScreen({ onBack, context, onAddToWorkout, customExercises = [], onCustomExerciseCreated, onCustomExerciseDeleted, user }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMuscle, setFilterMuscle] = useState("All");
  const [filterEquipment, setFilterEquipment] = useState("All");
  const [filterDifficulty, setFilterDifficulty] = useState("All");
  const [detailEx, setDetailEx] = useState(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingCustom, setEditingCustom] = useState(null);
  const [gifState, setGifState] = useState({});
  const m = useMountAnimation();

  const muscles = ["All", "Chest", "Back", "Legs", "Shoulders", "Arms", "Core"];
  const equipments = ["All", "Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight"];
  const difficulties = ["All", "Beginner", "Intermediate", "Advanced"];

  const all = buildCombinedLibrary(customExercises);
  const q = searchQuery.toLowerCase().trim();
  const filtered = all.filter(ex => {
    if (filterMuscle !== "All" && ex.muscleGroup !== filterMuscle) return false;
    if (filterEquipment !== "All" && ex.equipment !== filterEquipment) return false;
    if (filterDifficulty !== "All" && ex.difficulty !== filterDifficulty) return false;
    if (q && !ex.name.toLowerCase().includes(q)) return false;
    return true;
  });

  const openDetail = async (ex) => {
    setDetailEx(ex);
    if (!gifState[ex.name]) {
      setGifState(prev => ({ ...prev, [ex.name]: { loading: true, url: null } }));
      const url = await getExerciseGif(ex.name);
      setGifState(prev => ({ ...prev, [ex.name]: { loading: false, url } }));
    }
  };

  const handleDeleteCustom = async (id) => {
    try {
      await deleteCustomExercise(id);
      setDetailEx(null);
      onCustomExerciseDeleted && onCustomExerciseDeleted();
    } catch (e) { console.error(e); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg, opacity: m ? 1 : 0, transition: "opacity .3s ease" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 8px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, color: "#fff", borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: C.font }}>← Back</button>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", fontFamily: C.font }}>Exercise Library</div>
        </div>
        <button onClick={() => { setEditingCustom(null); setShowCustomForm(true); }} style={{ background: `${C.accent}15`, border: `1px solid ${C.accent}40`, color: C.accent, borderRadius: 12, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: C.font }}>+ Create</button>
      </div>

      {/* Search */}
      <div style={{ padding: "4px 20px 8px", flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Search exercises..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 14, fontFamily: C.font, outline: "none", boxSizing: "border-box" }}
        />
      </div>

      {/* Filters */}
      <div style={{ padding: "0 20px 6px", flexShrink: 0, overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 6, paddingBottom: 2 }}>
          {muscles.map(m2 => (
            <Pill key={m2} active={filterMuscle === m2} color={m2 !== "All" ? muscleColors[m2] : C.accent} onClick={() => setFilterMuscle(m2)} style={{ fontSize: 11, padding: "5px 11px" }}>{m2}</Pill>
          ))}
        </div>
      </div>
      <div style={{ padding: "0 20px 6px", flexShrink: 0, overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 6, paddingBottom: 2 }}>
          {equipments.map(eq => (
            <Pill key={eq} active={filterEquipment === eq} color={C.accent} onClick={() => setFilterEquipment(eq)} style={{ fontSize: 11, padding: "5px 11px" }}>{eq}</Pill>
          ))}
        </div>
      </div>
      <div style={{ padding: "0 20px 10px", flexShrink: 0, overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 6, paddingBottom: 2 }}>
          {difficulties.map(d => (
            <Pill key={d} active={filterDifficulty === d} color={d !== "All" ? difficultyColors[d] : C.accent} onClick={() => setFilterDifficulty(d)} style={{ fontSize: 11, padding: "5px 11px" }}>{d}</Pill>
          ))}
        </div>
      </div>

      {/* Count */}
      <div style={{ padding: "0 20px 8px", fontSize: 11, color: C.dim, fontFamily: C.mono, flexShrink: 0 }}>
        {filtered.length} exercise{filtered.length !== 1 ? "s" : ""}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 100px" }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: C.dim, fontSize: 14 }}>No exercises found</div>
        )}
        {filtered.map((ex, i) => (
          <ExerciseCard key={`${ex.name}-${i}`} ex={ex} gifState={gifState[ex.name]} onTap={openDetail} />
        ))}
      </div>

      {/* Detail Modal */}
      {detailEx && (
        <ExerciseDetailModal
          ex={detailEx}
          gifState={gifState[detailEx.name]}
          context={context}
          onAddToWorkout={onAddToWorkout}
          onEdit={(ex) => { setDetailEx(null); setEditingCustom(ex); setShowCustomForm(true); }}
          onDelete={handleDeleteCustom}
          onClose={() => setDetailEx(null)}
        />
      )}

      {/* Custom Form */}
      {showCustomForm && (
        <CustomExerciseForm
          editing={editingCustom}
          onClose={() => { setShowCustomForm(false); setEditingCustom(null); }}
          onSaved={() => { setShowCustomForm(false); setEditingCustom(null); onCustomExerciseCreated && onCustomExerciseCreated(); }}
        />
      )}
    </div>
  );
}

function ExerciseCard({ ex, gifState, onTap }) {
  const mColor = muscleColors[ex.muscleGroup] || C.accent;
  const dColor = difficultyColors[ex.difficulty] || C.dim;
  return (
    <button
      onClick={() => onTap(ex)}
      style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 14px", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${mColor}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{ex.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: C.font, marginBottom: 2 }}>{ex.name}</div>
        <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono }}>{ex.equipment}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <span style={{ padding: "3px 8px", borderRadius: 6, background: `${mColor}20`, color: mColor, fontSize: 10, fontWeight: 700, fontFamily: C.mono }}>{ex.muscleGroup}</span>
        <span style={{ padding: "2px 7px", borderRadius: 6, background: `${dColor}15`, color: dColor, fontSize: 10, fontWeight: 600, fontFamily: C.mono }}>{ex.difficulty}</span>
        {ex.isCustom && <span style={{ padding: "2px 6px", borderRadius: 5, background: `${C.ai}15`, color: C.ai, fontSize: 9, fontWeight: 700, fontFamily: C.mono }}>Custom</span>}
      </div>
    </button>
  );
}

function ExerciseDetailModal({ ex, gifState, context, onAddToWorkout, onEdit, onDelete, onClose }) {
  const mColor = muscleColors[ex.muscleGroup] || C.accent;
  const dColor = difficultyColors[ex.difficulty] || C.dim;
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)", zIndex: 210, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#111113", borderRadius: "26px 26px 0 0", padding: "24px 20px 40px", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", margin: "0 auto 18px" }} />
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ padding: "4px 10px", borderRadius: 8, background: `${mColor}20`, color: mColor, fontSize: 12, fontWeight: 700, fontFamily: C.mono }}>{ex.muscleGroup}</span>
            <span style={{ padding: "4px 10px", borderRadius: 8, background: `${dColor}15`, color: dColor, fontSize: 12, fontWeight: 600, fontFamily: C.mono }}>{ex.difficulty}</span>
            {ex.isCustom && <span style={{ padding: "4px 9px", borderRadius: 8, background: `${C.ai}15`, color: C.ai, fontSize: 11, fontWeight: 700, fontFamily: C.mono }}>Custom</span>}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: C.font }}>{ex.name}</div>
          <div style={{ fontSize: 12, color: C.dim, marginTop: 4, fontFamily: C.mono }}>{ex.equipment}</div>
        </div>
        {/* GIF area */}
        <div style={{ width: "100%", height: 220, borderRadius: 20, background: C.card, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, overflow: "hidden" }}>
          {gifState?.loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 40 }}>{ex.icon}</div>
              <div style={{ fontSize: 12, color: C.dim, fontFamily: C.mono }}>Loading demo...</div>
            </div>
          ) : gifState?.url ? (
            <img src={gifState.url} alt={ex.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 48 }}>{ex.icon}</div>
              <div style={{ fontSize: 12, color: C.dim, fontFamily: C.mono }}>No demo available</div>
            </div>
          )}
        </div>
        {/* Notes */}
        {ex.notes && (
          <div style={{ padding: "12px 14px", borderRadius: 12, background: C.card, border: `1px solid ${C.border}`, fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 16, lineHeight: 1.5, fontFamily: C.font }}>
            {ex.notes}
          </div>
        )}
        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {context === "workout" && (
            <button onClick={() => { onAddToWorkout(ex); onClose(); }} style={{ width: "100%", padding: "15px", borderRadius: 16, border: "none", background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, color: C.bg, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: C.font }}>
              Add to Workout
            </button>
          )}
          {ex.isCustom && !confirmDelete && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => onEdit(ex)} style={{ flex: 1, padding: "13px", borderRadius: 16, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: C.font }}>Edit</button>
              <button onClick={() => setConfirmDelete(true)} style={{ padding: "13px 16px", borderRadius: 16, border: "1px solid rgba(255,80,80,0.3)", background: "rgba(255,80,80,0.08)", color: "rgba(255,80,80,0.8)", fontSize: 14, cursor: "pointer" }}>🗑</button>
            </div>
          )}
          {ex.isCustom && confirmDelete && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => onDelete(ex.id)} style={{ flex: 1, padding: "13px", borderRadius: 16, border: "none", background: "rgba(255,80,80,0.8)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: C.font }}>Confirm Delete</button>
              <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: "13px", borderRadius: 16, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 14, cursor: "pointer", fontFamily: C.font }}>Cancel</button>
            </div>
          )}
          <button onClick={onClose} style={{ width: "100%", padding: "13px", borderRadius: 16, border: `1px solid ${C.border}`, background: C.card, color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: C.font }}>Close</button>
        </div>
      </div>
    </div>
  );
}

function CustomExerciseForm({ editing, onClose, onSaved }) {
  const ICON_OPTIONS = ["🏋️", "💪", "🔥", "🦵", "⬆️", "⬇️", "🔄", "🎯", "⚡", "🧱"];
  const muscles = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core"];
  const equipments = ["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight"];
  const difficulties = ["Beginner", "Intermediate", "Advanced"];

  const [name, setName] = useState(editing?.name || "");
  const [muscleGroup, setMuscleGroup] = useState(editing?.muscleGroup || editing?.muscle_group || "Chest");
  const [equipment, setEquipment] = useState(editing?.equipment || "Bodyweight");
  const [difficulty, setDifficulty] = useState(editing?.difficulty || "Intermediate");
  const [icon, setIcon] = useState(editing?.icon || "🏋️");
  const [notes, setNotes] = useState(editing?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = { name: name.trim(), muscle_group: muscleGroup, equipment, difficulty, icon, notes: notes.trim() || null };
      if (editing?.id) {
        await updateCustomExercise(editing.id, payload);
      } else {
        await createCustomExercise(payload);
      }
      onSaved();
    } catch (e) {
      setError(e.message || "Failed to save");
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)", zIndex: 220, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#111113", borderRadius: "26px 26px 0 0", padding: "24px 20px 40px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", margin: "0 auto 18px" }} />
        <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: C.font, textAlign: "center", marginBottom: 20 }}>
          {editing ? "Edit Exercise" : "Create Exercise"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Name</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Exercise name" style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 14, fontFamily: C.font, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Muscle Group</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {muscles.map(m2 => (
                <Pill key={m2} active={muscleGroup === m2} color={muscleColors[m2]} onClick={() => setMuscleGroup(m2)} style={{ fontSize: 12, padding: "6px 12px" }}>{m2}</Pill>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Equipment</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {equipments.map(eq => (
                <Pill key={eq} active={equipment === eq} color={C.accent} onClick={() => setEquipment(eq)} style={{ fontSize: 12, padding: "6px 12px" }}>{eq}</Pill>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Difficulty</div>
            <div style={{ display: "flex", gap: 6 }}>
              {difficulties.map(d => (
                <Pill key={d} active={difficulty === d} color={difficultyColors[d]} onClick={() => setDifficulty(d)} style={{ fontSize: 12, padding: "6px 12px" }}>{d}</Pill>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Icon</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ICON_OPTIONS.map(ic => (
                <button key={ic} onClick={() => setIcon(ic)} style={{ width: 44, height: 44, borderRadius: 12, border: icon === ic ? `2px solid ${C.accent}` : `1px solid ${C.border}`, background: icon === ic ? `${C.accent}15` : C.card, fontSize: 20, cursor: "pointer" }}>{ic}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>Notes (optional)</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Form tips, cues..." rows={3} style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 13, fontFamily: C.font, outline: "none", resize: "none", boxSizing: "border-box" }} />
          </div>
          {error && <div style={{ color: "#FF6B3C", fontSize: 12, fontFamily: C.font }}>{error}</div>}
          <button onClick={handleSave} disabled={saving} style={{ padding: "15px", borderRadius: 16, border: "none", background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, color: C.bg, fontSize: 15, fontWeight: 800, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1, fontFamily: C.font }}>
            {saving ? "Saving..." : editing ? "Save Changes" : "Create Exercise"}
          </button>
        </div>
      </div>
    </div>
  );
}

// === SECTION: Legal ===
/* ═══ LEGAL SCREEN ═══ */
function LegalScreen({ onBack, initialTab = "privacy" }) {
  const [tab, setTab] = useState(initialTab);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg }}>
      <div style={{ display: "flex", alignItems: "center", padding: "16px 20px 8px", gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, color: "#fff", borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: C.font }}>← Back</button>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", fontFamily: C.font }}>Legal</div>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "0 20px 12px", flexShrink: 0 }}>
        <button onClick={() => setTab("privacy")} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: `1.5px solid ${tab === "privacy" ? C.accent : C.border}`, background: tab === "privacy" ? `${C.accent}15` : C.card, color: tab === "privacy" ? C.accent : C.dim, fontSize: 13, fontWeight: 600, fontFamily: C.font, cursor: "pointer" }}>Privacy Policy</button>
        <button onClick={() => setTab("terms")} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: `1.5px solid ${tab === "terms" ? C.accent : C.border}`, background: tab === "terms" ? `${C.accent}15` : C.card, color: tab === "terms" ? C.accent : C.dim, fontSize: 13, fontWeight: 600, fontFamily: C.font, cursor: "pointer" }}>Terms of Service</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 40px" }}>
        {tab === "privacy" ? (
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: C.font, lineHeight: 1.75 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 16 }}>Privacy Policy</div>
            <div style={{ color: C.dim, fontSize: 11, marginBottom: 20 }}>Last updated: March 2026</div>

            <div style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>1. Information We Collect</div>
            <p style={{ marginBottom: 16 }}>We collect information you provide when creating an account (name, email address), health and fitness data you enter (body weight, workout history, personal records, goals), device information, and app usage data to improve the service.</p>

            <div style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>2. How We Use Your Information</div>
            <p style={{ marginBottom: 16 }}>We use your data to provide and personalise the gAIns service, power AI coaching features, process subscription payments via Stripe, send you important account notifications, and improve app features and performance.</p>

            <div style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>3. Data Sharing</div>
            <p style={{ marginBottom: 16 }}>We do not sell your personal data. We share data only with service providers necessary to operate gAIns: Supabase (database and authentication), Anthropic (AI coaching — prompts and workout context), and Stripe (payment processing). Each provider is bound by their own privacy policy.</p>

            <div style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>4. Health Data</div>
            <p style={{ marginBottom: 16 }}>Workout, body composition, and performance data you enter is used solely to provide the service. It is not shared with advertisers or third-party analytics platforms.</p>

            <div style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>5. Data Retention</div>
            <p style={{ marginBottom: 16 }}>Your data is retained while your account is active. You may delete your account at any time from the Profile screen, which permanently removes all your data from our servers.</p>

            <div style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>6. Security</div>
            <p style={{ marginBottom: 16 }}>We use industry-standard encryption and Supabase Row Level Security to protect your data. Passwords are hashed and never stored in plain text.</p>

            <div style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>7. Children</div>
            <p style={{ marginBottom: 16 }}>gAIns is not intended for users under 13. We do not knowingly collect data from children.</p>

            <div style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>8. Contact</div>
            <p style={{ marginBottom: 4 }}>For privacy questions or data requests, contact us at: hello@gainsai.uk</p>
          </div>
        ) : (
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: C.font, lineHeight: 1.75 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 16 }}>Terms of Service</div>
            <div style={{ color: C.dim, fontSize: 11, marginBottom: 20 }}>Last updated: March 2026</div>

            <div style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>1. Acceptance</div>
            <p style={{ marginBottom: 16 }}>By creating an account or using gAIns, you agree to these Terms of Service. If you do not agree, do not use the app.</p>

            <div style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>2. Use of Service</div>
            <p style={{ marginBottom: 16 }}>gAIns is a fitness tracking and AI coaching app for personal, non-commercial use. You must be at least 13 years old to use the service. You are responsible for maintaining the security of your account credentials.</p>

            <div style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>3. AI Coaching</div>
            <p style={{ marginBottom: 16 }}>AI coaching suggestions are informational only and do not constitute professional medical or fitness advice. Consult a qualified professional before starting any exercise programme. Use AI recommendations at your own risk.</p>

            <div style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>4. Subscriptions & Payments</div>
            <p style={{ marginBottom: 16 }}>Paid plans are billed monthly via Stripe. You may cancel anytime; cancellation takes effect at the end of the current billing period. Refunds are handled on a case-by-case basis — contact us within 7 days of a charge if you believe it was in error.</p>

            <div style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>5. Prohibited Conduct</div>
            <p style={{ marginBottom: 16 }}>You may not reverse-engineer, scrape, or abuse the service; share your account; or use gAIns for any unlawful purpose.</p>

            <div style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>6. Disclaimer of Warranties</div>
            <p style={{ marginBottom: 16 }}>gAIns is provided "as is" without warranties of any kind. We do not guarantee uninterrupted availability or that AI suggestions will be accurate.</p>

            <div style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>7. Limitation of Liability</div>
            <p style={{ marginBottom: 16 }}>To the maximum extent permitted by law, gAIns and its developers shall not be liable for any indirect, incidental, or consequential damages arising from use of the app.</p>

            <div style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>8. Changes</div>
            <p style={{ marginBottom: 16 }}>We may update these terms. Continued use of the app after changes constitutes acceptance of the revised terms.</p>

            <div style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>9. Contact</div>
            <p style={{ marginBottom: 4 }}>For questions about these terms: hello@gainsai.uk</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ ERROR BOUNDARY ═══ */
export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("ErrorBoundary caught:", error, info); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0E0F14", padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "'Outfit', sans-serif", marginBottom: 8 }}>Something went wrong</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", fontFamily: "'Outfit', sans-serif", marginBottom: 32, maxWidth: 280, lineHeight: 1.6 }}>
          The app ran into an unexpected error. Tap below to restart.
        </div>
        <button
          onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
          style={{ padding: "14px 32px", borderRadius: 14, border: "none", background: "#A78BFA", color: "#0E0F14", fontSize: 15, fontWeight: 700, fontFamily: "'Outfit', sans-serif", cursor: "pointer" }}
        >
          Restart App
        </button>
        {this.state.error && (
          <div style={{ marginTop: 24, fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "monospace", maxWidth: 320, wordBreak: "break-word" }}>
            {this.state.error.message}
          </div>
        )}
      </div>
    );
  }
}

// === SECTION: App Root (GAIns) ===
/* ═══ APP SHELL ═══ */
export default function GAIns() {
  const ANALYTICS_PLATFORM = Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web';
  const ANALYTICS_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

  const [activeTheme, setActiveTheme] = useState(
    () => localStorage.getItem("theme") || "aurora"
  );
  const [iconStyle, setIconStyle] = useState(
    () => localStorage.getItem("iconStyle") || "emoji"
  );
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [deleteAccountModal, setDeleteAccountModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [legalScreen, setLegalScreen] = useState(null); // null | "privacy" | "terms"
  const [celebrationPRs, setCelebrationPRs] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [screen, setScreen] = useState("home");
  const [tab, setTab] = useState("home");
  const [dayDetailDate, setDayDetailDate] = useState(null);
  const [tpl, setTpl] = useState(null);
  const [plan, setPlan] = useState("free");
  const [queriesUsed, setQueriesUsed] = useState(0);
  const [appWorkouts, setAppWorkouts] = useState([]);
  const [appPRs, setAppPRs] = useState([]);
  const [appVolumeTrend, setAppVolumeTrend] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const scrollRef = useRef(null);

  // Program state
  const [appPrograms, setAppPrograms] = useState([]);
  const [activeEnrollment, setActiveEnrollment] = useState(null);
  const [volumeStandards, setVolumeStandards] = useState({});
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);
  const [scheduledWorkoutForToday, setScheduledWorkoutForToday] = useState(null);
  const [showPreCheckin, setShowPreCheckin] = useState(null); // scheduled workout obj
  const [showPostFeedback, setShowPostFeedback] = useState(null); // { scheduledWorkoutId, workoutId }
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [programOnboardingProgram, setProgramOnboardingProgram] = useState(null); // program to enroll in
  const [redoingOnboarding, setRedoingOnboarding] = useState(false);
  const [highlightProgramId, setHighlightProgramId] = useState(null);
  const [showProgramBuilder, setShowProgramBuilder] = useState(false);
  const [readinessScore, setReadinessScore] = useState(null);
  const [customExercises, setCustomExercises] = useState([]);
  const [libContext, setLibContext] = useState(null); // null | "workout"
  const [healthPermission, setHealthPermission] = useState(() => localStorage.getItem("healthPermission") || null);
  const [syncedSleep, setSyncedSleep] = useState(null);
  const [syncedHRV, setSyncedHRV] = useState(null);
  useEffect(() => { if (screen !== "program") setHighlightProgramId(null); }, [screen]);

  const handleDeleteWorkout = async (id) => {
    const workout = appWorkouts.find(w => w.id === id);
    await deleteWorkout(id, workout?.started_at);
    setAppWorkouts(prev => prev.filter(w => w.id !== id));
    setScheduleRefreshKey(k => k + 1);
    // Refresh enrollment/scheduled state in case the deleted workout was a program workout
    refreshAppData();
  };

  // Shared data loader — called explicitly after auth is confirmed
  const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

  const refreshAppData = async () => {
    try { const w = await withTimeout(getWorkouts(100), 10000); setAppWorkouts(w || []); } catch (e) { console.error("Failed to load workouts:", e); }
    try { const p = await withTimeout(getPersonalRecords(), 10000); setAppPRs(p || []); } catch (e) { console.error("Failed to load PRs:", e); }
    try { const vt = await withTimeout(getVolumeTrend(), 10000); setAppVolumeTrend(vt || []); } catch (e) { console.error("Failed to load volume trend:", e); }
    // Load programs & enrollment
    try { const progs = await withTimeout(getPrograms(), 10000); setAppPrograms(progs || []); } catch (e) { console.error("Failed to load programs:", e); }
    try {
      const enr = await withTimeout(getActiveEnrollment(), 10000);
      setActiveEnrollment(enr);
      // Load volume standards if enrolled in a program
      if (enr?.programs?.days_per_week) {
        try {
          const vs = await getVolumeStandards(enr.programs.days_per_week);
          setVolumeStandards(vs);
        } catch (e) { console.error("Failed to load volume standards:", e); }
      }
      // Check for today's scheduled workout
      if (enr) {
        const today = new Date().toISOString().split('T')[0];
        const todayWorkouts = await getScheduledWorkouts(today, today, enr.id);
        const todayScheduled = todayWorkouts.find(w => w.status === 'scheduled');
        setScheduledWorkoutForToday(todayScheduled || null);
      } else {
        setScheduledWorkoutForToday(null);
      }
    } catch (e) { console.error("Failed to load enrollment:", e); }
    // Fetch health data for Pro+ users with permission
    const savedHealthPerm = localStorage.getItem("healthPermission");
    if (savedHealthPerm === "granted" && isHealthAvailable()) {
      try {
        const today = new Date();
        const [sleep, hrv] = await Promise.all([fetchSleepData(today), fetchHRVData(today)]);
        if (sleep != null) setSyncedSleep(sleep);
        if (hrv != null) setSyncedHRV(hrv);
      } catch (e) { console.error("Health data fetch error:", e); }
    }
    try { const cx = await withTimeout(getCustomExercises(), 10000); setCustomExercises(cx || []); } catch (e) { console.error("Failed to load custom exercises:", e); }
    setDataLoaded(true);
  };

  // Register service worker for push notifications
  useEffect(() => { registerServiceWorker(); }, []);

  // Auth listener
  useEffect(() => {
    // Fallback timeout — never stay stuck on "Loading..."
    const timeout = setTimeout(() => setAuthLoading(false), 5000);

    // Single auth source of truth — onAuthStateChange fires INITIAL_SESSION on
    // mount for returning users, and SIGNED_IN for fresh logins. No separate
    // getSession() call to avoid lock contention with gotrue-js.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        // Returning user: app opened with existing session
        if (session?.user) {
          logLoginEvent(session.user.id, ANALYTICS_PLATFORM, ANALYTICS_VERSION);
          try {
            const prof = await getProfile();
            if (!prof) {
              // Session exists but no profile — account was deleted, sign out
              await signOut();
            } else {
              setUser(session.user);
              setProfile(prof);
              if (prof.plan) setPlan(prof.plan);
              refreshAppData();
            }
          } catch {
            // Profile fetch failed due to network — still let user in
            setUser(session.user);
          }
        }
        clearTimeout(timeout);
        setAuthLoading(false);
      } else if (event === 'SIGNED_IN') {
        setUser(session.user);
        setTimeout(() => seedDummyData(), 1000);
        try {
          const prof = await getProfile();
          if (prof) {
            setProfile(prof);
            if (prof.plan) setPlan(prof.plan);
          }
        } catch { /* profile load failed, continue */ }
        refreshAppData();
        logLoginEvent(session.user.id, ANALYTICS_PLATFORM, ANALYTICS_VERSION);
      } else if (event === 'SIGNED_OUT') {
        // Only clear user on explicit sign-out, not transient token failures
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  // Online/offline detection + auto-sync
  const syncOfflineWorkouts = async () => {
    const pending = getPendingCount();
    if (pending > 0 && navigator.onLine) {
      setSyncing(true);
      try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("sync timeout")), 15000));
        const { synced } = await Promise.race([syncPendingWorkouts(), timeout]);
        if (synced > 0) setDataLoaded(false);
      } catch (e) {
        console.error("Sync failed:", e);
      }
      setPendingSync(getPendingCount());
      setSyncing(false);
    }
  };

  useEffect(() => {
    setPendingSync(getPendingCount());

    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineWorkouts();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync pending workouts on load when online and authenticated
  useEffect(() => {
    if (user && !authLoading) syncOfflineWorkouts();
  }, [user, authLoading]);

  // No useEffect for data loading — refreshAppData is called explicitly
  // from checkAuth (page load) and refreshAuth (sign-in) after JWT is confirmed fresh.

  // Seed initial history state & listen for back button
  useEffect(() => {
    window.history.replaceState({ screen: screen }, "");
    let skipNext = false;
    const onPopState = (e) => {
      if (skipNext) { skipNext = false; return; }
      const s = e.state?.screen;
      if (!s) return; // ignore popstate events without our state
      setTab(["home","coach","history","stats"].includes(s) ? s : null);
      setScreen(s);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Android hardware back button — navigate within app instead of exiting
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let listener = null;
    (async () => {
      const { App: CapApp } = await import("@capacitor/app");
      listener = await CapApp.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back(); // triggers popstate → screen change
        } else {
          CapApp.minimizeApp(); // at root screen, minimize instead of exit
        }
      });
    })();
    return () => { if (listener) listener.remove(); };
  }, []);

  // Handle deep links — email confirmation, password reset, OAuth returns
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let listener = null;
    (async () => {
      const { App: CapApp } = await import("@capacitor/app");
      listener = await CapApp.addListener("appUrlOpen", async ({ url }) => {
        if (!url) return;
        // Supabase puts tokens in the URL fragment or query string
        // e.g. app.gainsai://auth/callback#access_token=...&type=signup
        //      app.gainsai://auth/callback?token_hash=...&type=recovery
        const urlObj = new URL(url);
        const fragment = urlObj.hash ? new URLSearchParams(urlObj.hash.slice(1)) : null;
        const query = urlObj.searchParams;

        const accessToken = fragment?.get("access_token") || query.get("access_token");
        const refreshToken = fragment?.get("refresh_token") || query.get("refresh_token");
        const type = fragment?.get("type") || query.get("type");
        const tokenHash = query.get("token_hash");

        if (accessToken && refreshToken) {
          // Email confirmation or OAuth — set the session directly
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (!error) {
            const prof = await getProfile();
            if (prof) {
              setProfile(prof);
              if (prof.plan) setPlan(prof.plan);
              refreshAppData();
            }
            if (type === "recovery") {
              setScreen("resetPassword");
            }
          }
        } else if (tokenHash && type === "recovery") {
          // Password reset link
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
          if (!error) setScreen("resetPassword");
        } else if (tokenHash) {
          // Email confirmation via token hash
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
          if (!error) {
            const session = await getSession();
            if (session?.user) {
              setUser(session.user);
              const prof = await getProfile();
              if (prof) { setProfile(prof); if (prof.plan) setPlan(prof.plan); refreshAppData(); }
            }
          }
        }
      });
    })();
    return () => { if (listener) listener.remove(); };
  }, []);

  const handleLogout = async () => {
    setUser(null);
    setProfile(null);
    setScreen("home");
    window.history.replaceState({ screen: "home" }, "");
    setDataLoaded(false);
    setAppWorkouts([]);
    setAppPRs([]);
    setAppVolumeTrend([]);
    setCustomExercises([]);
    try { await signOut(); } catch (e) { console.error("Sign out error:", e); }
  };

  const handleDeleteAccountConfirm = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeleteAccountLoading(true);
    try {
      await deleteUserAccount();
      setDeleteAccountModal(false);
      setDeleteConfirmText("");
      handleLogout();
    } catch (e) {
      console.error("Delete account error:", e);
      alert("Failed to delete account: " + (e.message || "Unknown error"));
    }
    setDeleteAccountLoading(false);
  };

  const needsOnboarding = user && profile && profile.onboarding_complete === false;
  const userName = (profile?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Athlete").split(" ")[0];

  // Show loading or auth screen
  if (authLoading) {
    return (
      <div className="app-shell" style={{ background: C.bg, overflow: "hidden", fontFamily: C.font, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`
          .app-shell { width: 100vw; height: 100dvh; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
          @media (min-width: 500px) { .app-shell { width: 390px; height: 844px; margin: 20px auto; border-radius: 44px; box-shadow: 0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06); padding-top: 0; padding-bottom: 0; } }
        `}</style>
        <div style={{ fontSize: 13, color: C.dim }}>Loading...</div>
      </div>
    );
  }

  if (needsOnboarding) {
    return (
      <div className="app-shell" style={{ background: C.bg, overflow: "hidden", fontFamily: C.font, position: "relative" }}>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; } ::-webkit-scrollbar { display: none; }
          .app-shell { width: 100vw; height: 100dvh; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
          @media (min-width: 500px) { .app-shell { width: 390px; height: 844px; margin: 20px auto; border-radius: 44px; box-shadow: 0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06); padding-top: 0; padding-bottom: 0; } }
        `}</style>
        <OnboardingScreen user={user} onComplete={async () => {
          setRedoingOnboarding(false);
          const prof = await getProfile();
          setProfile(prof);
        }} onBack={redoingOnboarding ? async () => {
          await updateProfile({ onboarding_complete: true });
          setRedoingOnboarding(false);
          const prof = await getProfile();
          setProfile(prof);
        } : undefined} />
      </div>
    );
  }

  if (!user) {
    const refreshAuth = async () => {
      const session = await getSession();
      if (session?.user) {
        setUser(session.user);
        const prof = await getProfile();
        setProfile(prof);
        if (prof?.plan) setPlan(prof.plan);
        // Profile is set and JWT is fresh — load data explicitly
        // rather than relying on useEffect timing
        refreshAppData();
      }
    };

    return (
      <div className="app-shell" style={{ background: C.bg, overflow: "hidden", fontFamily: C.font, position: "relative" }}>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; } ::-webkit-scrollbar { display: none; }
          .app-shell { width: 100vw; height: 100dvh; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
          @media (min-width: 500px) { .app-shell { width: 390px; height: 844px; margin: 20px auto; border-radius: 44px; box-shadow: 0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06); padding-top: 0; padding-bottom: 0; } }
        `}</style>
        {legalScreen ? (
          <LegalScreen onBack={() => setLegalScreen(null)} initialTab={legalScreen} />
        ) : (
          <AuthScreen onSignUp={refreshAuth} onSignIn={refreshAuth} onGoogleSignIn={refreshAuth} onLegal={(tab) => setLegalScreen(tab)} />
        )}
      </div>
    );
  }

  Object.assign(C, THEMES[activeTheme]);
  I = ICONS[iconStyle];

  const handleThemeChange = (name) => {
    localStorage.setItem("theme", name);
    setActiveTheme(name);
  };

  const handleIconStyleChange = (style) => {
    localStorage.setItem("iconStyle", style);
    setIconStyle(style);
  };

  const nav = (t, replace) => {
    if (user) {
      logPageEvent(user.id, t, screen, ANALYTICS_PLATFORM, ANALYTICS_VERSION);
    }
    setTab(["home","coach","program","history","stats"].includes(t) ? t : null);
    setScreen(t);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    if (replace) window.history.replaceState({ screen: t }, "");
    else window.history.pushState({ screen: t }, "");
  };

  const tabs = [{ id: "home", icon: I.home, label: "Home" }, { id: "program", icon: I.program, label: "Program" }, { id: "coach", icon: I.coach, label: "Coach" }, { id: "history", icon: I.history, label: "History" }, { id: "stats", icon: I.stats, label: "Stats" }];

  // Program helpers
  const startScheduledWorkout = async (scheduledWorkout) => {
    // Build a template-like object from prescribed exercises
    const prescribed = scheduledWorkout.prescribed_exercises || [];
    const tplFromSchedule = {
      id: scheduledWorkout.id,
      label: scheduledWorkout.program_days?.name || "Workout",
      name: scheduledWorkout.program_days?.name || "Workout",
      color: activeEnrollment?.programs?.color || C.accent,
      icon: activeEnrollment?.programs?.icon || "💪",
      scheduledWorkoutId: scheduledWorkout.id,
      exercises: prescribed.map(ex => ({
        name: ex.exercise_name,
        equipment: "Barbell",
        sets: ex.sets,
        lastReps: ex.reps,
        lastWeight: ex.weight,
        rir: ex.rir,
        is_compound: ex.is_compound,
      })),
    };
    setTpl(tplFromSchedule);

    // Only show soreness check-in if there's a prior completed workout in this enrollment
    const { count } = await supabase
      .from('scheduled_workouts')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', scheduledWorkout.enrollment_id)
      .eq('status', 'completed')
      .lt('scheduled_date', scheduledWorkout.scheduled_date);
    if (count > 0) {
      setShowPreCheckin(scheduledWorkout);
    } else {
      nav("workout");
    }
  };

  const handlePreCheckinSubmit = async ({ muscleRatings, joint_comfort, dreading, sleepHours, hrvMs, readinessScore: score, source } = {}) => {
    const ratings = muscleRatings || {};
    if (showPreCheckin && Object.keys(ratings).length > 0) {
      try { await saveSorenessRatings(showPreCheckin.id, ratings); } catch (e) { console.error("Error saving soreness:", e); }
    }
    // Save readiness score if Pro+ and score available
    if (plan !== "free" && score != null) {
      const ratingValues = Object.values(ratings).filter(v => v > 0);
      const avgSoreness = ratingValues.length > 0 ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length : null;
      try {
        await saveReadinessScore({
          score,
          sleep_hours: sleepHours,
          hrv_ms: hrvMs,
          avg_soreness: avgSoreness,
          joint_comfort: joint_comfort,
          dreading: dreading || false,
          source: source || "manual",
        });
        setReadinessScore(score);
      } catch (e) { console.error("Error saving readiness:", e); }
    }
    setShowPreCheckin(null);
    nav("workout");
  };

  const handlePostFeedbackSubmit = async ({ pump, difficulty }) => {
    if (showPostFeedback) {
      const { scheduledWorkoutId, workoutId } = showPostFeedback;
      if (pump > 0) {
        try { await savePumpRating(scheduledWorkoutId, workoutId, pump); } catch (e) { console.error("Error saving pump:", e); }
      }
      if (difficulty > 0) {
        try { await saveDifficultyRating(scheduledWorkoutId, workoutId, difficulty); } catch (e) { console.error("Error saving difficulty:", e); }
        try { await applyDifficultyToFutureWorkouts(scheduledWorkoutId, difficulty); } catch (e) { console.error("Error applying difficulty adjustments:", e); }
      }
    }
    setShowPostFeedback(null);
    nav("home");
  };

  const handleAbandonProgram = async () => {
    if (!activeEnrollment) return;
    if (!confirm("Are you sure you want to end this program? This cannot be undone.")) return;
    try {
      await abandonProgram(activeEnrollment.id);
      setActiveEnrollment(null);
      setScheduledWorkoutForToday(null);
      refreshAppData();
    } catch (e) { console.error("Abandon error:", e); }
  };

  return (
    <div className="app-shell" style={{ background: C.bg, overflow: "hidden", fontFamily: C.font, position: "relative", display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { display: none; }
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }
        @keyframes confetti-fall { 0% { transform: translateY(-10px) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0; } }
        @keyframes glow-pulse { 0%, 100% { box-shadow: 0 0 0px 0px rgba(255,220,50,0); } 50% { box-shadow: 0 0 18px 6px var(--glow-color, rgba(255,220,50,0.3)); } }
        @keyframes trophy-bounce { 0% { transform: scale(0.5); opacity: 0; } 60% { transform: scale(1.2); opacity: 1; } 80% { transform: scale(0.95); } 100% { transform: scale(1); } }
        .app-shell {
          width: 100vw; height: 100dvh;
          padding-top: env(safe-area-inset-top, 0px);
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        @media (min-width: 500px) {
          .app-shell {
            width: 390px; height: 844px; margin: 20px auto;
            border-radius: 44px;
            box-shadow: 0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06);
            padding-top: 0; padding-bottom: 0;
          }
        }
      `}</style>
      {/* Offline / syncing banner */}
      {(!isOnline || syncing || pendingSync > 0) && (
        <div style={{
          background: syncing ? `${C.ai}20` : isOnline && pendingSync > 0 ? `${C.accent}20` : "rgba(255,107,60,0.15)",
          borderBottom: `1px solid ${syncing ? C.ai : isOnline && pendingSync > 0 ? C.accent : "#FF6B3C"}30`,
          padding: "6px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          fontSize: 11,
          fontFamily: C.mono,
          color: syncing ? C.ai : isOnline && pendingSync > 0 ? C.accent : "#FF6B3C",
          fontWeight: 600
        }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: "currentColor", animation: (syncing || !isOnline) ? "pulse 1.2s infinite" : "none" }} />
          {syncing
            ? "Syncing workouts..."
            : !isOnline
            ? `Offline${pendingSync > 0 ? ` · ${pendingSync} workout${pendingSync > 1 ? "s" : ""} queued` : " · workouts will save locally"}`
            : `${pendingSync} workout${pendingSync > 1 ? "s" : ""} pending sync`
          }
        </div>
      )}

      <div ref={scrollRef} style={{ flex: 1, overflowY: screen === "coach" ? "hidden" : "auto", overflowX: "hidden", display: "flex", flexDirection: "column" }}>
        {screen === "home" && <HomeScreen onStart={() => nav("pick")} onNav={nav} plan={plan} user={user} profile={profile} onProfileClick={() => setProfileModalOpen(true)} onNavLibrary={() => { setLibContext(null); nav("exercise_library"); }} workouts={appWorkouts} prs={appPRs} volumeTrend={appVolumeTrend} onDayClick={(d) => { setDayDetailDate(d); nav("dayDetail"); }} todayWorkout={scheduledWorkoutForToday} onStartScheduled={startScheduledWorkout} enrollment={activeEnrollment} />}
        {screen === "pick" && <TemplatePicker onSelect={(t) => { setTpl(t); nav("workout"); }} onBack={() => nav("home")} />}
        {screen === "workout" && tpl && <WorkoutScreen template={tpl} isOnline={isOnline} user={user} prs={appPRs} profile={profile} onShowPricing={() => nav("pricing")} onBrowseLibrary={() => { setLibContext("workout"); nav("exercise_library"); }} customExercises={customExercises} onFinish={(prs) => {
          setPendingSync(getPendingCount());
          // If this was a scheduled workout, mark it completed and show post-feedback
          if (tpl.scheduledWorkoutId) {
            updateScheduledWorkout(tpl.scheduledWorkoutId, { status: "completed" }).catch(e => console.error(e));
            setShowPostFeedback({ scheduledWorkoutId: tpl.scheduledWorkoutId, workoutId: null });
          }
          refreshAppData();
          if (prs && prs.length > 0) { navigator.vibrate?.([50, 30, 100]); setCelebrationPRs(prs); }
          else if (!tpl.scheduledWorkoutId) { nav("home"); }
        }} onBack={() => nav("home")} />}
        {screen === "program" && !programOnboardingProgram && !showProgramBuilder && <ProgramScreen enrollment={activeEnrollment} programs={appPrograms} profile={profile} prs={appPRs} onStartOnboarding={(p) => setProgramOnboardingProgram(p)} onStartWorkout={startScheduledWorkout} onAbandon={handleAbandonProgram} onNav={nav} highlightProgramId={highlightProgramId} onClearHighlight={() => setHighlightProgramId(null)} scheduleRefreshKey={scheduleRefreshKey} onCreateProgram={() => setShowProgramBuilder(true)} onDeleteProgram={async (id) => { try { await deleteUserProgram(id); refreshAppData(); } catch (e) { console.error(e); } }} />}
        {screen === "program" && !programOnboardingProgram && showProgramBuilder && <ProgramBuilderScreen onBack={() => setShowProgramBuilder(false)} onCreated={(newProgram) => { setShowProgramBuilder(false); setHighlightProgramId(newProgram.id); refreshAppData(); }} />}
        {screen === "program" && programOnboardingProgram && <ProgramOnboardingScreen program={programOnboardingProgram} profile={profile} prs={appPRs} onEnroll={(enr) => { setActiveEnrollment(enr); setProgramOnboardingProgram(null); refreshAppData(); }} onBack={() => setProgramOnboardingProgram(null)} />}
        {screen === "coach" && <AICoachScreen plan={plan} queriesUsed={queriesUsed} onUseQuery={() => setQueriesUsed(q => q + 1)} onShowPricing={() => nav("pricing")} activeEnrollment={activeEnrollment} onNavigate={nav} onProgramCreated={(programId) => { setHighlightProgramId(programId); refreshAppData(); }} customExercises={customExercises} profile={profile} />}
        {screen === "pricing" && <PricingScreen currentPlan={plan} onSelect={(p) => { setPlan(p); setQueriesUsed(0); nav("coach"); }} onBack={() => nav("coach")} />}
        {screen === "history" && <HistoryScreen workouts={appWorkouts} prs={appPRs} onDeleteWorkout={handleDeleteWorkout} plan={plan} onShowPricing={() => nav("pricing")} userName={userName} />}
        {screen === "stats" && <StatsScreen workouts={appWorkouts} prs={appPRs} volumeTrend={appVolumeTrend} onNav={nav} profile={profile} />}
        {screen === "volumeDashboard" && <VolumeDashboardScreen enrollment={activeEnrollment} volumeStandards={volumeStandards} onBack={() => nav("program")} />}
        {screen === "weekDetail" && <WeekDetailScreen workouts={appWorkouts} prs={appPRs} onBack={() => nav("home")} />}
        {screen === "dayDetail" && dayDetailDate && <DayDetailScreen date={dayDetailDate} workouts={appWorkouts} prs={appPRs} onBack={() => nav("home")} />}
        {screen === "prs" && <PRScreen prs={appPRs} onBack={() => nav("home")} />}
        {screen === "notifications" && <NotificationScreen onBack={() => nav("home")} />}
        {screen === "exercise_library" && (
          <ExerciseLibraryScreen
            onBack={() => nav(libContext === "workout" ? "workout" : "home")}
            context={libContext}
            customExercises={customExercises}
            onAddToWorkout={(ex) => {
              setTpl(prev => ({
                ...prev,
                exercises: [...(prev?.exercises || []), { name: ex.name, equipment: ex.equipment, lastWeight: 20, lastReps: 10, sets: 3 }],
              }));
              nav("workout");
            }}
            onCustomExerciseCreated={async () => { const cx = await getCustomExercises(); setCustomExercises(cx || []); }}
            onCustomExerciseDeleted={async () => { const cx = await getCustomExercises(); setCustomExercises(cx || []); }}
            user={user}
          />
        )}
      </div>
      {!["workout", "pricing", "prs", "notifications", "weekDetail", "dayDetail", "volumeDashboard", "exercise_library"].includes(screen) && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "calc(72px + env(safe-area-inset-bottom, 0px))", background: `linear-gradient(to top, ${C.bg} 70%, transparent)`, display: "flex", justifyContent: "space-around", alignItems: "flex-start", paddingTop: 10 }}>
          {tabs.map(t => (<button key={t.id} onClick={() => nav(t.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: tab === t.id ? (t.id === "coach" ? C.ai : t.id === "program" ? (activeEnrollment ? C.accent : C.dim) : C.accent) : "rgba(255,255,255,0.2)", transition: "color .2s ease", padding: "4px 12px" }}><span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span><span style={{ fontSize: 9, fontWeight: 600, fontFamily: C.mono, letterSpacing: .5 }}>{t.label}</span></button>))}
        </div>
      )}
      <div style={{ position: "absolute", bottom: "calc(6px + env(safe-area-inset-bottom, 0px))", left: "50%", transform: "translateX(-50%)", width: 134, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />

      {legalScreen && (
        <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 550, display: "flex", flexDirection: "column" }}>
          <LegalScreen onBack={() => setLegalScreen(null)} initialTab={legalScreen} />
        </div>
      )}

      {celebrationPRs && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          {/* Confetti particles */}
          {Array.from({ length: 20 }, (_, i) => {
            const colors = ["#FFD700", "#C8FF00", "#FF69B4", "#3DDDC4", "#FF6B3C"];
            const size = 6 + (i % 3) * 2;
            return (
              <div key={i} style={{
                position: "absolute", top: 0,
                left: `${(i * 5 + 3) % 100}%`,
                width: size, height: size,
                borderRadius: i % 2 === 0 ? "50%" : 2,
                background: colors[i % colors.length],
                animation: `confetti-fall ${1.5 + (i % 4) * 0.4}s ease-in ${(i % 7) * 0.28}s forwards`,
                pointerEvents: "none", zIndex: 501,
              }} />
            );
          })}
          <div style={{ background: "#111113", borderRadius: 24, padding: "32px 24px", maxWidth: 380, width: "100%", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 8, animation: "trophy-bounce 0.6s cubic-bezier(0.36,0.07,0.19,0.97) both" }}>🏆</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.accent, fontFamily: C.font, marginBottom: 4 }}>New Personal Record{celebrationPRs.length > 1 ? "s" : ""}!</div>
              <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.5 }}>Congratulations on crushing it!</div>
            </div>
            {celebrationPRs.map((pr, i) => {
              const BIG_3 = ["Bench Press", "Back Squat", "Deadlift"];
              const isBig3 = BIG_3.includes(pr.exercise);
              const compWeight = pr.type === "1rm" ? pr.e1rm : pr.weight;
              const animal = isBig3 ? getAnimalComparison(compWeight) : null;
              const shareText = pr.type === "1rm"
                ? `🏆 New PR! ${pr.exercise} — ${pr.weight}kg × ${pr.reps} rep${pr.reps !== 1 ? "s" : ""} (est. 1RM: ${Math.round(pr.e1rm)}kg)${animal ? ` That's like lifting a ${animal.name}!` : ""} #gAIns #PersonalRecord`
                : `🏆 New PR! ${pr.exercise} — ${pr.weight}kg × ${pr.reps} rep${pr.reps !== 1 ? "s" : ""} (vol: ${pr.volume}kg) #gAIns #PersonalRecord`;
              const handleShare = async () => {
                if (navigator.share) {
                  try {
                    await navigator.share({ title: "New Personal Record!", text: shareText });
                    await logPRShare(pr);
                  } catch (e) {
                    if (e.name !== "AbortError") console.error("Share failed:", e);
                  }
                } else {
                  await navigator.clipboard.writeText(shareText);
                  await logPRShare(pr);
                  alert("Copied to clipboard!");
                }
              };
              return (
                <div key={i} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 16, marginBottom: 12, border: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: C.font }}>{pr.exercise}</div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, fontFamily: C.mono, letterSpacing: 1, textTransform: "uppercase",
                      padding: "3px 8px", borderRadius: 6,
                      background: pr.type === "1rm" ? "rgba(255,220,50,0.15)" : "rgba(50,220,200,0.15)",
                      color: pr.type === "1rm" ? "#FFD700" : "#3DDDC4",
                    }}>{pr.type === "1rm" ? "1RM" : "VOLUME"}</span>
                  </div>
                  <div style={{ fontSize: 13, color: C.dim, fontFamily: C.mono, marginBottom: animal ? 8 : 12 }}>
                    {pr.weight}kg × {pr.reps} rep{pr.reps !== 1 ? "s" : ""}
                    {pr.type === "1rm" && <span> (e1RM: {Math.round(pr.e1rm)}kg)</span>}
                    {pr.type === "volume" && <span> (vol: {pr.volume}kg)</span>}
                  </div>
                  {animal && (
                    <div style={{ fontSize: 13, color: C.accent, fontWeight: 600, fontFamily: C.font, marginBottom: 12 }}>
                      That's like lifting a {animal.name}!
                    </div>
                  )}
                  <button onClick={handleShare} style={{
                    width: "100%", padding: "10px", borderRadius: 10, border: `1px solid ${C.border}`,
                    background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 13, fontWeight: 600,
                    fontFamily: C.font, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}>
                    <span style={{ fontSize: 16 }}>↗</span> Share
                  </button>
                </div>
              );
            })}
            <button
              onClick={() => { setCelebrationPRs(null); nav("home"); }}
              style={{
                width: "100%", padding: 14, borderRadius: 14, border: "none",
                background: C.accent, color: C.bg, marginTop: 8,
                fontSize: 15, fontWeight: 800, fontFamily: C.font, cursor: "pointer",
              }}
            >
              Let's Go
            </button>
          </div>
        </div>
      )}

      {profileModalOpen && (
        <ProfileModal
          profile={profile}
          user={user}
          plan={plan}
          activeTheme={activeTheme}
          onThemeChange={handleThemeChange}
          iconStyle={iconStyle}
          onIconStyleChange={handleIconStyleChange}
          onClose={() => setProfileModalOpen(false)}
          onNotifications={() => {
            setProfileModalOpen(false);
            nav("notifications");
          }}
          onRedoOnboarding={async () => {
            setProfileModalOpen(false);
            setRedoingOnboarding(true);
            await updateProfile({ onboarding_complete: false });
            const prof = await getProfile();
            setProfile(prof);
          }}
          onLogout={() => {
            setProfileModalOpen(false);
            handleLogout();
          }}
          onLegal={(tab) => {
            setProfileModalOpen(false);
            setLegalScreen(tab);
          }}
          onDeleteAccount={() => {
            setProfileModalOpen(false);
            setDeleteAccountModal(true);
            setDeleteConfirmText("");
          }}
          onUpgrade={() => {
            setProfileModalOpen(false);
            nav("pricing");
          }}
          healthPermission={healthPermission}
          onHealthConnect={async () => {
            const result = await requestHealthPermissions();
            setHealthPermission(result);
            localStorage.setItem("healthPermission", result);
            if (result === "granted") {
              // Fetch initial data
              const today = new Date();
              const sleep = await fetchSleepData(today);
              const hrv = await fetchHRVData(today);
              if (sleep != null) setSyncedSleep(sleep);
              if (hrv != null) setSyncedHRV(hrv);
            }
          }}
          onHealthDisconnect={() => {
            setHealthPermission(null);
            localStorage.removeItem("healthPermission");
            setSyncedSleep(null);
            setSyncedHRV(null);
          }}
          onImport={() => {
            setProfileModalOpen(false);
            setImportModalOpen(true);
          }}
        />
      )}

      {importModalOpen && (
        <ImportWorkoutModal
          onClose={() => setImportModalOpen(false)}
          onImportComplete={() => {
            setImportModalOpen(false);
            refreshAppData();
          }}
        />
      )}

      {/* Delete Account Confirmation Modal */}
      {deleteAccountModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: C.card, borderRadius: 24, padding: "28px 24px", maxWidth: 360, width: "100%" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#FF6B3C", fontFamily: C.font, marginBottom: 8 }}>Delete Account</div>
              <div style={{ fontSize: 13, color: C.dim, fontFamily: C.font, lineHeight: 1.6 }}>
                This will permanently delete your account and all your data including workouts, PRs, and subscription. This cannot be undone.
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: C.dim, fontFamily: C.font, marginBottom: 8 }}>Type <strong style={{ color: "#fff" }}>DELETE</strong> to confirm</div>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${deleteConfirmText === "DELETE" ? "#FF6B3C" : C.border}`, background: C.bg, color: "#fff", fontSize: 14, fontFamily: C.font, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setDeleteAccountModal(false); setDeleteConfirmText(""); }}
                style={{ flex: 1, padding: "13px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: C.font, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccountConfirm}
                disabled={deleteConfirmText !== "DELETE" || deleteAccountLoading}
                style={{ flex: 1, padding: "13px", borderRadius: 12, border: "none", background: deleteConfirmText === "DELETE" ? "#FF6B3C" : "rgba(255,80,80,0.2)", color: deleteConfirmText === "DELETE" ? "#fff" : "rgba(255,80,80,0.4)", fontSize: 14, fontWeight: 700, fontFamily: C.font, cursor: deleteConfirmText === "DELETE" ? "pointer" : "not-allowed" }}
              >
                {deleteAccountLoading ? "Deleting..." : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-workout soreness check-in modal */}
      {showPreCheckin && (
        <PreWorkoutCheckin
          muscleGroups={showPreCheckin.program_days?.muscle_groups || ["Chest", "Back", "Legs"]}
          plan={plan}
          healthPermission={healthPermission}
          syncedSleep={syncedSleep}
          syncedHRV={syncedHRV}
          onSubmit={handlePreCheckinSubmit}
          onSkip={() => { setShowPreCheckin(null); nav("workout"); }}
        />
      )}

      {/* Post-workout pump feedback modal */}
      {showPostFeedback && (
        <PostWorkoutFeedback
          onSubmit={handlePostFeedbackSubmit}
          onSkip={() => { setShowPostFeedback(null); nav("home"); }}
        />
      )}

      {/* Progress check-in modal */}
      {showCheckinModal && (
        <ProgressCheckinModal
          profile={profile}
          enrollmentId={activeEnrollment?.id}
          onSubmit={async (data) => { await saveProgressCheckin(data); setShowCheckinModal(false); }}
          onClose={() => setShowCheckinModal(false)}
        />
      )}
    </div>
  );
}
