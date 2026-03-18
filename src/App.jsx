import { useState, useEffect, useRef } from "react";
import { signUp, signIn, signOut, getSession, getProfile, updateProfile, seedDummyData, callCoachAPI, getWorkouts, getWorkoutSets, getPersonalRecords, getTemplates, getVolumeTrend, supabase, getPrograms, getActiveEnrollment, enrollInProgram, abandonProgram, getScheduledWorkouts, updateScheduledWorkout, generateSchedule, savePumpRating, saveDifficultyRating, applyDifficultyToFutureWorkouts, saveSorenessRatings, getRecentFeedback, saveProgressCheckin, getProgressCheckins, applyCoachDiffToSchedule, createUserProgram } from "./lib/supabase";
import { calculatePrescription, generatePrescriptions, WEEK_CONFIG, isDeloadWeek, getWeekLabel, recommendPrograms, getMuscleGroup } from "./lib/programEngine";
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
const EX_LIB = { Chest: [{ name: "Bench Press", equipment: "Barbell", icon: "🏋️" }, { name: "Incline DB Press", equipment: "Dumbbell", icon: "📐" }, { name: "Cable Fly", equipment: "Cable", icon: "🔄" }, { name: "Chest Dip", equipment: "BW", icon: "⬇️" }, { name: "Machine Press", equipment: "Machine", icon: "🖥️" }, { name: "Push-ups", equipment: "BW", icon: "👐" }], Back: [{ name: "Deadlift", equipment: "Barbell", icon: "🔥" }, { name: "Pull-ups", equipment: "BW", icon: "⬆️" }, { name: "Barbell Row", equipment: "Barbell", icon: "🏋️" }, { name: "Lat Pulldown", equipment: "Cable", icon: "⬇️" }, { name: "Cable Row", equipment: "Cable", icon: "🔄" }, { name: "T-Bar Row", equipment: "Barbell", icon: "🅃" }], Legs: [{ name: "Back Squat", equipment: "Barbell", icon: "🦵" }, { name: "Leg Press", equipment: "Machine", icon: "🖥️" }, { name: "Romanian DL", equipment: "Barbell", icon: "🔥" }, { name: "Walking Lunge", equipment: "Dumbbell", icon: "🚶" }, { name: "Leg Curl", equipment: "Machine", icon: "🔄" }, { name: "Leg Extension", equipment: "Machine", icon: "🦿" }], Shoulders: [{ name: "Overhead Press", equipment: "Barbell", icon: "⬆️" }, { name: "Lateral Raise", equipment: "Dumbbell", icon: "↔️" }, { name: "Face Pull", equipment: "Cable", icon: "🔄" }, { name: "Arnold Press", equipment: "Dumbbell", icon: "💪" }], Arms: [{ name: "Barbell Curl", equipment: "Barbell", icon: "💪" }, { name: "Hammer Curl", equipment: "Dumbbell", icon: "🔨" }, { name: "Tricep Pushdown", equipment: "Cable", icon: "⬇️" }, { name: "Skull Crusher", equipment: "Barbell", icon: "💀" }] };
const HISTORY = [{ title: "Push Day", date: "Mar 7", duration: "65 min", volume: "14,100 kg", color: "#DFFF3C", exercises: 5 }, { title: "Legs", date: "Mar 6", duration: "71 min", volume: "18,200 kg", color: "#FF6B3C", exercises: 5 }, { title: "Pull Day", date: "Mar 4", duration: "58 min", volume: "10,880 kg", color: "#3CFFF0", exercises: 5 }, { title: "Push Day", date: "Mar 3", duration: "62 min", volume: "12,450 kg", color: "#DFFF3C", exercises: 5 }, { title: "Legs", date: "Mar 1", duration: "68 min", volume: "17,300 kg", color: "#FF6B3C", exercises: 5 }];
const CHART = [{ w: "W1", v: 42 }, { w: "W2", v: 48 }, { w: "W3", v: 44 }, { w: "W4", v: 51 }, { w: "W5", v: 47 }, { w: "W6", v: 53 }, { w: "W7", v: 50 }, { w: "W8", v: 56 }];
const PRS = [{ name: "Bench Press", weight: "120 kg", trend: "+5" }, { name: "Back Squat", weight: "180 kg", trend: "+10" }, { name: "Deadlift", weight: "200 kg", trend: "+5" }];

const AI_PROMPTS = {
  Analyze: [{ label: "Rate my week", icon: "📊", prompt: "Rate my training week out of 10. What should I improve?" }, { label: "Volume check", icon: "📈", prompt: "Is my weekly volume appropriate? Any muscle groups over/undertrained?" }, { label: "Recovery", icon: "😴", prompt: "How recovered am I? Should I rest today?" }],
  Improve: [{ label: "Fix weak points", icon: "🎯", prompt: "What are my weak points? Give specific exercises to fix them." }, { label: "Break plateau", icon: "🚀", prompt: "My bench stalled. Give me a 3-week breakthrough plan." }, { label: "Optimize split", icon: "🔧", prompt: "Is my PPL split optimal? Suggest improvements." }],
  Plan: [{ label: "Next workout", icon: "📋", prompt: "Plan my next workout with exercises, sets, reps, and weights." }, { label: "Deload week", icon: "🧘", prompt: "Design a deload week based on my current loads." }, { label: "New program", icon: "🗓️", prompt: "Create a 4-week program based on my strength levels." }],
  Learn: [{ label: "Form tips", icon: "🎓", prompt: "Top 3 form cues for my compound lifts." }, { label: "Nutrition", icon: "🥗", prompt: "Nutrition advice for my training volume and muscle growth." }, { label: "Science", icon: "🔬", prompt: "Is my approach evidence-based? What does science say?" }],
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

/* ═══ PRICING SCREEN ═══ */
function PricingScreen({ currentPlan, onSelect, onBack }) {
  const [selected, setSelected] = useState(currentPlan);
  const plans = [
    { id: "free", name: "Free", price: "$0", period: "forever", queries: "5/day", features: ["Workout tracking", "Exercise library", "Basic stats", "5 AI queries/day"], color: "rgba(255,255,255,0.4)", popular: false },
    { id: "pro", name: "Pro", price: "$4.99", period: "/month", queries: "30/day", features: ["Everything in Free", "30 AI queries/day", "Advanced analytics", "Export your data", "Priority support"], color: "#DFFF3C", popular: true },
    { id: "unlimited", name: "Unlimited", price: "$9.99", period: "/month", queries: "Unlimited", features: ["Everything in Pro", "Unlimited AI queries", "Custom templates", "Workout insights", "Early access features"], color: "#A47BFF", popular: false },
  ];

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
        <button onClick={() => onSelect(selected)} style={{
          width: "100%", padding: "16px", borderRadius: 16, border: "none", marginTop: 8,
          background: `linear-gradient(135deg, ${PLANS[selected].color}, ${PLANS[selected].color}CC)`,
          color: C.bg, fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: C.font,
        }}>
          {selected === "free" ? "Downgrade to Free" : `Upgrade to ${PLANS[selected].name}`}
        </button>
      )}

      <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
        Cancel anytime · Powered by Stripe
      </div>
    </div>
  );
}

/* ═══ AI COACH ═══ */
function AICoachScreen({ plan, queriesUsed, onUseQuery, onShowPricing, activeEnrollment, onNavigate, onProgramCreated }) {
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

  const planData = PLANS[plan];
  const remaining = Math.max(0, planData.queries - queriesUsed);
  const limitReached = remaining <= 0;

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, loading]);
  useEffect(() => { if (!successMsg) return; const t = setTimeout(() => setSuccessMsg(null), 4000); return () => clearTimeout(t); }, [successMsg]);

  const send = async (prompt, label) => {
    if (limitReached) return;
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
          {msgs.length > 0 && <button onClick={() => { setMsgs([]); setShowPrompts(true); setPendingMsgIdx(null); setActionError(null); setSuccessMsg(null); }} style={{ background: `${C.ai}15`, border: `1px solid ${C.ai}30`, borderRadius: 10, padding: "6px 12px", color: C.ai, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: C.font }}>New</button>}
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

        {msgs.map((m, i) => (
          <div key={i} style={{ marginBottom: 10, display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "assistant" && <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}><div style={{ width: 16, height: 16, borderRadius: 5, background: `linear-gradient(135deg, ${C.ai}, #7B4CFF)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8 }}>🧠</div><span style={{ fontSize: 9, color: C.ai, fontFamily: C.mono, fontWeight: 600 }}>COACH</span></div>}
            <div style={{ maxWidth: "88%", padding: "11px 13px", borderRadius: 15, background: m.role === "user" ? `${C.ai}20` : C.card, border: m.role === "user" ? `1px solid ${C.ai}30` : `1px solid ${C.border}`, borderTopRightRadius: m.role === "user" ? 4 : 15, borderTopLeftRadius: m.role === "assistant" ? 4 : 15 }}>
              <div style={{ fontSize: 13, fontWeight: m.role === "user" ? 700 : 400, color: m.role === "user" ? C.ai : "rgba(255,255,255,0.85)", lineHeight: 1.55, fontFamily: C.font, whiteSpace: "pre-wrap" }}>{m.content}</div>
            </div>
          </div>
        ))}

        {loading && <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}><div style={{ width: 16, height: 16, borderRadius: 5, background: `linear-gradient(135deg, ${C.ai}, #7B4CFF)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8 }}>🧠</div><div style={{ display: "flex", gap: 4, padding: "10px 14px", background: C.card, borderRadius: 14, border: `1px solid ${C.border}` }}>{[0, 1, 2].map(i => (<div key={i} style={{ width: 7, height: 7, borderRadius: 4, background: C.ai, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />))}</div></div>}

        {successMsg && (
          <div style={{ display: "flex", justifyContent: "center", padding: "6px 0 8px" }}>
            <div style={{ padding: "7px 16px", borderRadius: 20, background: "rgba(52,199,89,0.15)", border: "1px solid rgba(52,199,89,0.3)", color: "#34C759", fontSize: 12, fontWeight: 600, fontFamily: C.font }}>✓ {successMsg}</div>
          </div>
        )}

        {pendingMsgIdx !== null && !loading && !limitReached && (
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

        {pendingMsgIdx === null && lastMsgIsAssistant && !loading && !limitReached && (
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
  { id: "fat_loss",    label: "Fat Loss",       icon: "🔥", desc: "Lose body fat" },
  { id: "muscle_gain", label: "Muscle Gain",    icon: "💪", desc: "Build size and strength" },
  { id: "maintenance", label: "Maintenance",    icon: "⚖️", desc: "Maintain current physique" },
  { id: "performance", label: "Performance",    icon: "🏆", desc: "Athletic performance" },
];
const TARGET_RATES = [
  { id: "slow",       label: "Slow & Steady", desc: "Minimal muscle loss / lean gains" },
  { id: "moderate",   label: "Moderate",      desc: "Balanced approach" },
  { id: "aggressive", label: "Aggressive",    desc: "Faster results, harder effort" },
];
const EXPERIENCE_LEVELS = [
  { id: "beginner",     label: "Beginner",     icon: "🌱", desc: "Less than 1 year" },
  { id: "intermediate", label: "Intermediate", icon: "🔥", desc: "1–3 years" },
  { id: "advanced",     label: "Advanced",     icon: "🏆", desc: "3+ years" },
];
const FOCUS_MUSCLE_GROUPS = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core"];

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

            // Check if PR already exists for this exercise
            const { data: existing } = await supabase
              .from("personal_records")
              .select("id, weight_kg")
              .eq("user_id", userId)
              .eq("exercise_name", b.name)
              .eq("pr_type", "1rm")
              .limit(1);

            if (existing?.length) {
              // Only update if new value is higher
              if (wKg > existing[0].weight_kg) {
                await supabase.from("personal_records").update({
                  weight_kg: wKg, reps: 1, achieved_at: new Date().toISOString()
                }).eq("id", existing[0].id);
              }
            } else {
              await supabase.from("personal_records").insert({
                user_id: userId, exercise_name: b.name, weight_kg: wKg, reps: 1, pr_type: "1rm",
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
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{g.icon}</div>
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
                  <span style={{ fontSize: 20 }}>{e.icon}</span>
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
                { key: "squat", label: "Back Squat", icon: "🦵" },
                { key: "bench", label: "Bench Press", icon: "🏋️" },
                { key: "deadlift", label: "Deadlift", icon: "🔥" },
                { key: "ohp", label: "Overhead Press", icon: "⬆️" },
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
                const icons = { Chest: "🫁", Back: "🔙", Legs: "🦵", Shoulders: "🤷", Arms: "💪", Core: "🎯" };
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

/* ═══ AUTH ═══ */
function AuthScreen({ onSignUp, onSignIn }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
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
      <div style={{ fontSize: 13, color: C.dim, marginBottom: 40 }}>AI-powered strength training</div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {mode === "signup" && (
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              background: C.card,
              color: "#fff",
              fontSize: 13,
              fontFamily: C.font,
              outline: "none"
            }}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: C.card,
            color: "#fff",
            fontSize: 13,
            fontFamily: C.font,
            outline: "none"
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: C.card,
            color: "#fff",
            fontSize: 13,
            fontFamily: C.font,
            outline: "none"
          }}
        />
        {error && <div style={{ color: "#FF6B3C", fontSize: 12, fontFamily: C.font }}>{error}</div>}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "13px 14px",
            borderRadius: 12,
            border: "none",
            background: C.accent,
            color: C.bg,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: C.font,
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? "..." : mode === "login" ? "Sign In" : "Sign Up"}
        </button>
      </form>

      <div style={{ fontSize: 12, color: C.dim, marginTop: 24 }}>
        {mode === "login" ? "No account? " : "Have an account? "}
        <button
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
          style={{
            background: "none",
            border: "none",
            color: C.accent,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: C.font,
            textDecoration: "underline"
          }}
        >
          {mode === "login" ? "Sign Up" : "Sign In"}
        </button>
      </div>
    </div>
  );
}

/* ═══ HOME ═══ */
function HomeScreen({ onStart, onNav, plan, user, profile, onProfileClick, workouts = [], prs = [], volumeTrend = [], onDayClick, todayWorkout, onStartScheduled, enrollment }) {
  const [m, setM] = useState(false);

  useEffect(() => { setM(true); }, []);

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
        <div style={{ textAlign: "left", position: "relative", zIndex: 1 }}><div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.45)", fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>Tap to begin</div><div style={{ fontSize: 21, fontWeight: 800, color: C.bg, fontFamily: C.font }}>{todayWorkout ? "Free Workout" : "Start Workout"}</div></div>
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
                <div style={{ fontSize: 22, marginBottom: 4 }}>{t.icon}</div>
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

/* ═══ WORKOUT ═══ */
function WorkoutScreen({ template, onFinish, onBack, isOnline = true, user }) {
  const [timer, setTimer] = useState(0);
  const [exs, setExs] = useState(() => template.exercises.map(e => ({ ...e, setsData: Array.from({ length: e.sets }, () => ({ weight: e.lastWeight, reps: e.lastReps, done: false })) })));
  const [edit, setEdit] = useState(null); const [ew, setEw] = useState(0); const [er, setEr] = useState(0);
  const [rest, setRest] = useState(0); const [showAdd, setShowAdd] = useState(false); const [addCat, setAddCat] = useState("Chest"); const [addPg, setAddPg] = useState(0);
  const [saving, setSaving] = useState(false);
  const [previewEx, setPreviewEx] = useState(null); // { name, equipment, icon, gifUrl, loading }
  const [demoIdx, setDemoIdx] = useState(null); // index of exercise showing inline animation
  const color = template.color;
  useEffect(() => { const i = setInterval(() => setTimer(t => t + 1), 1000); return () => clearInterval(i); }, []);
  useEffect(() => { if (rest > 0) { const i = setInterval(() => setRest(t => t <= 1 ? 0 : t - 1), 1000); return () => clearInterval(i); } }, [rest]);
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const ts = exs.reduce((a, e) => a + e.setsData.length, 0), ds = exs.reduce((a, e) => a + e.setsData.filter(s => s.done).length, 0);
  const catExs = EX_LIB[addCat] || []; const exPgs = []; for (let i = 0; i < catExs.length; i += 4) exPgs.push(catExs.slice(i, i + 4));

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
            rpe: 5
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
      // Use cached session (auto-refreshes) instead of getUser() which can 403
      const session = await getSession();
      const userId = session?.user?.id || user.id;

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
                newPRs.push({ exercise: exerciseName, type: "1rm", weight: best1rm.s.weight_kg, reps: best1rm.s.reps, e1rm: best1rm.e1rm });
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
                newPRs.push({ exercise: exerciseName, type: "volume", weight: bestVol.s.weight_kg, reps: bestVol.s.reps, volume: bestVol.vol });
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 6px" }}><button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, color: "#fff", borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", opacity: saving ? 0.6 : 1 }} disabled={saving}>✕</button><button onClick={saveWorkout} style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)`, border: "none", color: C.bg, borderRadius: 12, padding: "8px 18px", fontSize: 13, fontWeight: 800, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }} disabled={saving}>Finish {saving ? "..." : isOnline ? "✓" : "✓ (offline)"}</button></div>
      <div style={{ textAlign: "center", padding: "10px 0 20px" }}><div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase" }}>{template.label} Day</div><div style={{ fontSize: 42, fontWeight: 800, color: "#fff", fontFamily: C.font, letterSpacing: -2, lineHeight: 1, margin: "4px 0 10px" }}>{fmt(timer)}</div><div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}><div style={{ width: 140, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 2, background: color, width: `${(ds / ts) * 100}%`, transition: "width .4s ease" }} /></div><span style={{ fontSize: 12, color: C.dim, fontFamily: C.mono }}>{ds}/{ts}</span></div></div>
      {rest > 0 && <div style={{ background: `${color}10`, border: `1px solid ${color}30`, borderRadius: 16, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}><div><div style={{ fontSize: 10, color, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>Rest</div><div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: C.font }}>{fmt(rest)}</div></div><div style={{ display: "flex", gap: 6 }}>{[30, 60].map(s => (<button key={s} onClick={() => setRest(r => r + s)} style={{ background: `${color}18`, border: "none", color, borderRadius: 10, padding: "7px 11px", fontSize: 11, cursor: "pointer", fontFamily: C.mono }}>+{s}s</button>))}<button onClick={() => setRest(0)} style={{ background: C.card, border: "none", color: "#fff", borderRadius: 10, padding: "7px 11px", fontSize: 11, cursor: "pointer" }}>Skip</button></div></div>}
      {exs.map((ex, ei) => (
        <div key={ei} style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.border}`, marginBottom: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div><div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{ex.name}</div><div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, marginTop: 2 }}>{ex.equipment}</div></div>{ex.rir !== undefined && <span style={{ padding: "3px 7px", borderRadius: 6, background: `${color}15`, border: `1px solid ${color}30`, fontSize: 9, fontWeight: 700, color, fontFamily: C.mono }}>RIR {ex.rir}</span>}</div></div><button onClick={() => setExs(p => p.filter((_, i) => i !== ei))} style={{ background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.15)", borderRadius: 8, color: "rgba(255,80,80,0.6)", padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✕</button></div>
          {/* Exercise demo hidden until video assets are ready */}
          <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr 44px", padding: "0 16px 4px", fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: C.mono, letterSpacing: 1, textTransform: "uppercase" }}><div>Set</div><div>Kg</div><div>Reps</div><div style={{ textAlign: "center" }}>Log</div></div>
          {ex.setsData.map((s, si) => (
            <div key={si} style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr 44px", padding: "9px 16px", alignItems: "center", background: s.done ? `${color}06` : "transparent", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: s.done ? color : "rgba(255,255,255,0.25)", fontFamily: C.mono }}>{si + 1}</div>
              <button onClick={() => { if (!s.done) { setEdit({ ei, si }); setEw(s.weight); setEr(s.reps); } }} style={{ background: "none", border: "none", cursor: s.done ? "default" : "pointer", textAlign: "left", padding: 0, fontSize: 15, fontWeight: 700, color: s.done ? "rgba(255,255,255,0.4)" : "#fff", fontFamily: C.font, textDecoration: !s.done ? "underline dashed rgba(255,255,255,0.15)" : "none", textUnderlineOffset: 3 }}>{s.weight}</button>
              <button onClick={() => { if (!s.done) { setEdit({ ei, si }); setEw(s.weight); setEr(s.reps); } }} style={{ background: "none", border: "none", cursor: s.done ? "default" : "pointer", textAlign: "left", padding: 0, fontSize: 15, fontWeight: 700, color: s.done ? "rgba(255,255,255,0.4)" : "#fff", fontFamily: C.font, textDecoration: !s.done ? "underline dashed rgba(255,255,255,0.15)" : "none", textUnderlineOffset: 3 }}>{s.reps}</button>
              <div style={{ textAlign: "center" }}><button onClick={() => { setExs(p => p.map((e, i) => i === ei ? { ...e, setsData: e.setsData.map((ss, j) => j === si ? { ...ss, done: !ss.done } : ss) } : e)); if (!s.done) setRest(90); }} style={{ width: 32, height: 32, borderRadius: 10, border: "none", cursor: "pointer", background: s.done ? color : "rgba(255,255,255,0.05)", color: s.done ? C.bg : "rgba(255,255,255,0.15)", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.done ? "✓" : "○"}</button></div>
            </div>
          ))}
          <div style={{ padding: "8px 16px 12px" }}><button onClick={() => setExs(p => p.map((e, i) => i === ei ? { ...e, setsData: [...e.setsData, { weight: e.lastWeight, reps: e.lastReps, done: false }] } : e))} style={{ background: "none", border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 10, color: "rgba(255,255,255,0.25)", padding: "7px", width: "100%", fontSize: 12, cursor: "pointer" }}>+ Add Set</button></div>
        </div>
      ))}
      <button onClick={() => { setShowAdd(true); setAddPg(0); }} style={{ width: "100%", padding: "15px", borderRadius: 16, background: C.card, border: "1px dashed rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>+ Add Exercise</button>

      {edit && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(16px)", zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={() => setEdit(null)}><div onClick={e => e.stopPropagation()} style={{ background: "#111113", borderRadius: "26px 26px 0 0", padding: "28px 24px 40px" }}><div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", margin: "0 auto 20px" }} /><div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: C.font, textAlign: "center", marginBottom: 4 }}>{exs[edit.ei].name}</div><div style={{ fontSize: 12, color: C.dim, textAlign: "center", marginBottom: 24, fontFamily: C.mono }}>Set {edit.si + 1}</div><div style={{ display: "flex", flexDirection: "column", gap: 24, alignItems: "center" }}><WeightStepper value={ew} onChange={setEw} color={color} /><RepBubbles value={er} onChange={setEr} color={color} /></div><button onClick={() => { setExs(p => p.map((e, i) => i === edit.ei ? { ...e, setsData: e.setsData.map((s, j) => j === edit.si ? { ...s, weight: ew, reps: er } : s) } : e)); setEdit(null); }} style={{ width: "100%", padding: "16px", borderRadius: 16, border: "none", marginTop: 28, background: `linear-gradient(135deg, ${color}, ${color}CC)`, color: C.bg, fontSize: 16, fontWeight: 800, cursor: "pointer" }}>Save</button></div></div>}

      {showAdd && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(16px)", zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={() => setShowAdd(false)}><div onClick={e => e.stopPropagation()} style={{ background: "#111113", borderRadius: "26px 26px 0 0", padding: "24px 20px 40px" }}><div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", margin: "0 auto 18px" }} /><div style={{ fontSize: 20, fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: 18 }}>Add Exercise</div><div style={{ display: "flex", gap: 6, marginBottom: 18 }}>{Object.keys(EX_LIB).map(k => (<Pill key={k} active={addCat === k} color={color} onClick={() => { setAddCat(k); setAddPg(0); }}>{k}</Pill>))}</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>{(exPgs[addPg] || []).map((ex, i) => { const a = exs.some(e => e.name === ex.name); return (<button key={i} disabled={a} onClick={async () => { if (a) return; setPreviewEx({ name: ex.name, equipment: ex.equipment, icon: ex.icon, gifUrl: null, loading: true }); setShowAdd(false); const gifUrl = await getExerciseGif(ex.name); setPreviewEx(p => p ? { ...p, gifUrl, loading: false } : null); }} style={{ padding: "16px 14px", borderRadius: 16, border: a ? `1px solid ${color}30` : `1px solid ${C.border}`, background: a ? `${color}08` : C.card, cursor: a ? "default" : "pointer", textAlign: "left", opacity: a ? 0.5 : 1 }}><div style={{ fontSize: 22, marginBottom: 6 }}>{ex.icon}</div><div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{ex.name}</div><div style={{ fontSize: 10, color: C.dim, marginTop: 3, fontFamily: C.mono }}>{ex.equipment}</div></button>); })}</div>{exPgs.length > 1 && <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>{exPgs.map((_, i) => (<button key={i} onClick={() => setAddPg(i)} style={{ width: addPg === i ? 22 : 8, height: 8, borderRadius: 4, border: "none", cursor: "pointer", background: addPg === i ? color : "rgba(255,255,255,0.1)" }} />))}</div>}</div></div>}

      {previewEx && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)", zIndex: 210, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={() => setPreviewEx(null)}><div onClick={e => e.stopPropagation()} style={{ background: "#111113", borderRadius: "26px 26px 0 0", padding: "24px 20px 40px" }}><div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", margin: "0 auto 18px" }} /><div style={{ textAlign: "center", marginBottom: 20 }}><div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>{previewEx.equipment}</div><div style={{ fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: C.font }}>{previewEx.name}</div></div><div style={{ width: "100%", height: 220, borderRadius: 20, background: C.card, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, overflow: "hidden", position: "relative" }}>{previewEx.loading ? (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}><div style={{ fontSize: 40 }}>{previewEx.icon}</div><div style={{ fontSize: 12, color: C.dim, fontFamily: C.mono }}>Loading demo...</div></div>) : previewEx.gifUrl ? (<img src={previewEx.gifUrl} alt={previewEx.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />) : (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}><div style={{ fontSize: 48 }}>{previewEx.icon}</div><div style={{ fontSize: 12, color: C.dim, fontFamily: C.mono }}>No demo available</div></div>)}</div><div style={{ display: "flex", gap: 10 }}><button onClick={() => { setPreviewEx(null); setShowAdd(true); }} style={{ flex: 1, padding: "14px", borderRadius: 16, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: C.font }}>Back</button><button onClick={() => { setExs(p => [...p, { name: previewEx.name, equipment: previewEx.equipment, lastWeight: 20, lastReps: 10, sets: 3, setsData: [{ weight: 20, reps: 10, done: false }, { weight: 20, reps: 10, done: false }, { weight: 20, reps: 10, done: false }] }]); setPreviewEx(null); }} style={{ flex: 2, padding: "14px", borderRadius: 16, border: "none", background: `linear-gradient(135deg, ${color}, ${color}CC)`, color: C.bg, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: C.font }}>Add to Workout</button></div></div></div>}
    </div>
  );
}

/* ═══ STATS ═══ */
function StatsScreen({ workouts = [], prs = [], volumeTrend = [] }) {
  const [m, setM] = useState(false);

  useEffect(() => { setM(true); }, []);

  // Calculate muscle split from workouts
  const muscleCounts = { "Chest": 0, "Back": 0, "Legs": 0, "Shoulders": 0, "Arms": 0 };
  const muscleColors = { "Chest": "#DFFF3C", "Back": "#3CFFF0", "Legs": "#FF6B3C", "Shoulders": "#B47CFF", "Arms": "#47B8FF" };

  const totalVolume = workouts.reduce((sum, w) => sum + (w.total_volume_kg || 0), 0);
  const avgDuration = workouts.length > 0 ? workouts.reduce((sum, w) => sum + (w.duration_secs || 0), 0) / workouts.length / 60 : 0;
  const ms = Object.entries(muscleCounts).map(([name, count]) => ({ name, s: count, color: muscleColors[name] }));
  const mx = Math.max(...ms.map(m => m.s), 1);

  const stats = [
    { l: "Workouts", v: workouts.length.toString(), c: "#DFFF3C" },
    { l: "Volume", v: Math.round(totalVolume).toLocaleString(), c: "#3CFFF0" },
    { l: "Avg Time", v: Math.round(avgDuration) + "m", c: "#FF6B3C" },
    { l: "PRs", v: prs.length.toString(), c: "#B47CFF" }
  ];

  return (
    <div style={{ padding: "0 20px 110px", opacity: m ? 1 : 0, transition: "opacity .4s" }}>
      <div style={{ padding: "14px 0 18px" }}>
        <div style={{ fontSize: 12, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>Analytics</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: C.font, marginTop: 2 }}>Progress</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
        {stats.map((s, i) => (
          <div key={i} style={{ background: C.card, borderRadius: 16, padding: "16px", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>{s.l}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.c, fontFamily: C.font, lineHeight: 1 }}>{s.v}</div>
          </div>
        ))}
      </div>
      <div style={{ background: C.card, borderRadius: 18, padding: "18px", border: `1px solid ${C.border}`, marginBottom: 22 }}>
        <div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>8-Week Volume</div>
        <MiniChart data={volumeTrend.length > 0 ? volumeTrend : [{ w: "W1", v: 0 }]} h={70} />
      </div>
      <div style={{ background: C.card, borderRadius: 18, padding: "18px", border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>Muscle Split</div>
        {ms.map((mg, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{mg.name}</span>
              <span style={{ fontSize: 11, color: C.dim, fontFamily: C.mono }}>{mg.s}</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 3, background: mg.color, width: m ? `${(mg.s / mx) * 100}%` : "0%", transition: `width .7s cubic-bezier(.22,1,.36,1) ${.15 + i * .08}s` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ HISTORY ═══ */
function HistoryScreen({ workouts = [], prs = [] }) {
  const [m, setM] = useState(false);
  const [sets, setSets] = useState([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [expandedWorkouts, setExpandedWorkouts] = useState({});

  const toggleWorkout = (id) => setExpandedWorkouts(p => ({ ...p, [id]: !p[id] }));

  useEffect(() => { setM(true); }, []);

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
      <div style={{ padding: "14px 0 18px" }}>
        <div style={{ fontSize: 12, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>Log</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: C.font, marginTop: 2 }}>History</div>
      </div>
      {workouts.length === 0 && (
        <div style={{ textAlign: "center", paddingTop: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: C.font, marginBottom: 6 }}>No Workouts Yet</div>
          <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.5 }}>Complete a workout and it will appear here.</div>
        </div>
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
                              {avgRPE && <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(164,123,255,0.12)", color: C.ai, fontFamily: C.mono }}>RPE {avgRPE}</span>}
                            </div>
                            {exSets.map((s, si) => {
                              const isBest = s === bestSet && exSets.length > 1;
                              return (
                                <div key={si} style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 8, marginBottom: 2 }}>
                                  <span style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, width: 40 }}>Set {s.set_number || si + 1}</span>
                                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontFamily: C.mono }}>{s.weight_kg}kg × {s.reps}{s.rpe ? ` @ RPE ${s.rpe}` : ""}</span>
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

function WeekDetailScreen({ onBack, workouts = [], prs = [] }) {
  const [m, setM] = useState(false);
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

  useEffect(() => { setM(true); }, []);

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
    if (count < 10 && group !== "Other") insights.push({ type: "warning", icon: "⚠️", title: `Low ${group} Volume`, body: `Only ${count} sets for ${group} this week — may be below growth threshold (10+ recommended).` });
  });

  // RPE insights per exercise
  const exerciseRPEs = {};
  sets.forEach(s => { if (s.rpe) { if (!exerciseRPEs[s.exercise_name]) exerciseRPEs[s.exercise_name] = []; exerciseRPEs[s.exercise_name].push(s.rpe); } });
  Object.entries(exerciseRPEs).forEach(([ex, rpes]) => {
    const avg = rpes.reduce((a, b) => a + b, 0) / rpes.length;
    if (avg >= 9) insights.push({ type: "warning", icon: "🔥", title: `High RPE on ${ex}`, body: `Avg RPE ${avg.toFixed(1)} — risk of accumulated fatigue. Consider backing off next session.` });
    if (avg <= 5) insights.push({ type: "info", icon: "💡", title: `Low RPE on ${ex}`, body: `Avg RPE ${avg.toFixed(1)} — you may have room to increase intensity.` });
  });

  // Volume change vs last week
  if (prevVolume > 0) {
    const volChange = (totalVolume - prevVolume) / prevVolume * 100;
    if (volChange > 20) insights.push({ type: "warning", icon: "📈", title: "Volume Spike", body: `Volume jumped ${Math.round(volChange)}% this week — monitor recovery and watch for overreach signs.` });
    if (volChange < -20) insights.push({ type: "info", icon: "📉", title: "Volume Drop", body: `Volume dropped ${Math.abs(Math.round(volChange))}% — planned deload or missed sessions?` });
  }

  // Frequency change
  if (prevWeekWorkouts.length > 0 && weekWorkouts.length !== prevWeekWorkouts.length) {
    const diff = weekWorkouts.length - prevWeekWorkouts.length;
    if (diff > 0) insights.push({ type: "positive", icon: "🎯", title: "Frequency Up", body: `You trained ${weekWorkouts.length} days this week vs ${prevWeekWorkouts.length} last week — nice increase!` });
  }

  // PRs achieved
  weekPRs.forEach(pr => {
    insights.push({ type: "positive", icon: "🏆", title: `New PR: ${pr.exercise_name}`, body: `${pr.weight_kg}kg × ${pr.reps} (est. 1RM: ${Math.round(pr.estimated_1rm || pr.weight_kg)}kg)` });
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
            `  ${name}: ${exSets.map(s => `${s.weight_kg}kg×${s.reps}${s.rpe ? ` @RPE${s.rpe}` : ""}`).join(", ")}`
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
                              {avgRPE && <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(164,123,255,0.12)", color: C.ai, fontFamily: C.mono }}>RPE {avgRPE}</span>}
                            </div>
                            {exSets.map((s, si) => {
                              const isBest = s === bestSet && exSets.length > 1;
                              return (
                                <div key={si} style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 8, marginBottom: 2 }}>
                                  <span style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, width: 40 }}>Set {s.set_number || si + 1}</span>
                                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontFamily: C.mono }}>{s.weight_kg}kg × {s.reps}{s.rpe ? ` @ RPE ${s.rpe}` : ""}</span>
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

/* ═══ DAY DETAIL ═══ */
function DayDetailScreen({ onBack, date, workouts = [], prs = [] }) {
  const [m, setM] = useState(false);
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

  useEffect(() => { setM(true); }, []);

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
                          {avgRPE && <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(164,123,255,0.12)", color: C.ai, fontFamily: C.mono }}>RPE {avgRPE}</span>}
                        </div>
                        {exSets.map((s, si) => {
                          const isBest = s === bestSet && exSets.length > 1;
                          return (
                            <div key={si} style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 8, marginBottom: 2 }}>
                              <span style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, width: 40 }}>Set {s.set_number || si + 1}</span>
                              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontFamily: C.mono }}>{s.weight_kg}kg × {s.reps}{s.rpe ? ` @ RPE ${s.rpe}` : ""}</span>
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

/* ═══ PERSONAL RECORDS ═══ */
function PRScreen({ onBack, prs = [] }) {
  const [m, setM] = useState(false);
  const [tab, setTab] = useState("1rm");

  useEffect(() => { setM(true); }, []);

  const GROUP_ORDER = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Other"];
  const GROUP_COLORS = { Chest: "#FF6B3C", Back: "#3CFFF0", Legs: "#A78BFA", Shoulders: "#47B8FF", Arms: "#F472B6", Other: "#9B98C4" };
  const BIG3 = ["Back Squat", "Bench Press", "Deadlift"];

  const filtered = prs
    .filter(p => (p.pr_type || "1rm") === tab)
    .sort((a, b) => new Date(b.achieved_at) - new Date(a.achieved_at));

  // Build sections: Big 3 pinned first, then grouped by muscle
  const big3PRs = BIG3.map(name => filtered.find(p => p.exercise_name === name)).filter(Boolean);
  const restPRs = filtered.filter(p => !BIG3.includes(p.exercise_name));

  const grouped = {};
  restPRs.forEach(p => {
    const g = getMuscleGroup(p.exercise_name);
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
          {big3PRs.map(p => <PRCard key={p.exercise_name} p={p} i={cardIdx++} accentColor={C.accent} />)}
        </div>
      )}

      {/* Grouped sections */}
      {groupSections.map(({ group, prs: gPRs }) => (
        <div key={group} style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: GROUP_COLORS[group] }} />
            <div style={{ fontSize: 11, color: GROUP_COLORS[group], fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>{group}</div>
          </div>
          {gPRs.map(p => <PRCard key={p.exercise_name} p={p} i={cardIdx++} accentColor={GROUP_COLORS[group]} />)}
        </div>
      ))}
    </div>
  );
}

/* ═══ PROFILE MODAL ═══ */
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
    })();
  }, []);

  const handleEnableNotifications = async () => {
    const currentPerm = await checkNativePermission();
    setPermission(currentPerm);
    if (currentPerm === "default") {
      setShowPrePrompt(true);
      return;
    }
    if (currentPerm === "granted") {
      const sub = await subscribeToPush();
      // Even without push subscription (e.g. no VAPID key), mark as enabled if permission granted
      setSubscribed(!!sub || currentPerm === "granted");
    }
  };

  const handlePrePromptAccept = async () => {
    setShowPrePrompt(false);
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === "granted") {
      const sub = await subscribeToPush();
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
    { key: "workout_reminders", label: "Workout Reminders", desc: "Get reminded when it's time to train", icon: "💪" },
    { key: "rest_day_alerts", label: "Rest Day Alerts", desc: "Know when to take a recovery day", icon: "😴" },
    { key: "pr_celebrations", label: "PR Celebrations", desc: "Celebrate when you hit new records", icon: "🏆" },
    { key: "weekly_summary", label: "Weekly Summary", desc: "Weekly training recap and stats", icon: "📊" },
    { key: "ai_coach_tips", label: "AI Coach Tips", desc: "Personalized training insights", icon: "🧠" },
    { key: "streak_alerts", label: "Streak Alerts", desc: "Keep your training streak alive", icon: "🔥" },
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
                ? "Blocked in device settings"
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
            Notifications are blocked. Enable them in your device settings, then reopen the app.
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

function ProfileModal({ profile, plan, user, onClose, onLogout, onNotifications, onRedoOnboarding, activeTheme, onThemeChange }) {
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
      <div onClick={e => e.stopPropagation()} style={{ background: "#111113", borderRadius: "26px 26px 0 0", padding: "28px 24px 40px" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", margin: "0 auto 20px" }} />

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
      </div>
    </div>
  );
}

/* ═══ PRE-WORKOUT CHECKIN MODAL ═══ */
function PreWorkoutCheckin({ muscleGroups, onSubmit, onSkip }) {
  const [ratings, setRatings] = useState({});
  const setRating = (mg, val) => setRatings(prev => ({ ...prev, [mg]: val }));
  const emojiScale = ["😊", "😐", "😣", "😖", "🤕"];
  const getEmoji = (val) => emojiScale[Math.min(Math.floor((val - 1) / 2), 4)];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#111113", borderRadius: 24, padding: "28px 24px", maxWidth: 380, width: "100%", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 4 }}>Pre-Workout Check-in</div>
          <div style={{ fontSize: 13, color: C.dim }}>Rate your soreness per muscle group</div>
        </div>
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
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onSkip} style={{ flex: 1, padding: "12px", borderRadius: 14, border: `1px solid ${C.border}`, background: C.card, color: C.dim, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: C.font }}>Skip</button>
          <button onClick={() => onSubmit(ratings)} style={{ flex: 2, padding: "12px", borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, color: C.bg, fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: C.font }}>Continue</button>
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
  const pumpEmojis = ["😐", "🙂", "😊", "😄", "💪", "🔥", "🔥", "💥", "🤯", "🏆"];
  const difficultyEmojis = ["😴", "🥱", "😌", "🙂", "😤", "💪", "🔥", "🥵", "💀", "☠️"];

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

/* ═══ PROGRAM SCREEN ═══ */
function ProgramScreen({ enrollment, programs, profile, prs, onStartOnboarding, onStartWorkout, onAbandon, onNav, highlightProgramId, onClearHighlight }) {
  const [weekView, setWeekView] = useState(enrollment?.current_week || 1);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(false);

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
  }, [enrollment, weekView]);

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
            <button key={p.id} onClick={() => { if (onClearHighlight) onClearHighlight(); onStartOnboarding(p); }} style={{
              width: "100%", padding: "18px 16px", borderRadius: 20,
              border: p.id === highlightProgramId ? `2px solid ${p.color}` : `1px solid ${p.color}30`,
              background: p.id === highlightProgramId ? `${p.color}18` : `${p.color}08`,
              boxShadow: p.id === highlightProgramId ? `0 0 16px ${p.color}40` : "none",
              cursor: "pointer", textAlign: "left", transition: "all 0.2s"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 28 }}>{p.icon}</span>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", fontFamily: C.font }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>{p.days_per_week} days/week · {p.duration_weeks} weeks</div>
                    <div style={{ fontSize: 11, color: C.dim, marginTop: 4, lineHeight: 1.4 }}>{p.description}</div>
                  </div>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 12, background: `${p.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: p.color, flexShrink: 0 }}>→</div>
              </div>
            </button>
          ))}
        </div>
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

  const calendarDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    const workout = schedule.find(s => s.scheduled_date === dateStr);
    const isToday = dateStr === new Date().toISOString().split('T')[0];
    return { date, dateStr, dayName: dayNames[i], workout, isToday };
  });

  return (
    <div style={{ padding: "0 20px 110px" }}>
      {/* Header */}
      <div style={{ padding: "16px 0 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 10, color: color, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase" }}>Active Program</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: C.font }}>{program?.name}</div>
          </div>
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
            const statusColor = w?.status === "completed" ? "#4CAF50" : w?.status === "skipped" ? "#FF6B3C" : color;
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
                          {(w.prescribed_exercises || []).length} exercises · RIR {WEEK_CONFIG[w.week_number]?.rir}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: C.dim }}>Rest day</div>
                    )}
                  </div>
                  {w && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {w.status === "completed" && <span style={{ fontSize: 18 }}>✅</span>}
                      {w.status === "skipped" && <span style={{ fontSize: 14, color: "#FF6B3C" }}>Skipped</span>}
                      {w.status === "scheduled" && day.isToday && (
                        <button onClick={() => onStartWorkout(w)} style={{
                          background: `linear-gradient(135deg, ${color}, ${color}CC)`, border: "none",
                          color: C.bg, borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer"
                        }}>Start</button>
                      )}
                      {w.status === "scheduled" && !day.isToday && (
                        <div style={{ width: 10, height: 10, borderRadius: 5, border: `2px solid ${statusColor}40` }} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══ APP SHELL ═══ */
export default function GAIns() {
  const [activeTheme, setActiveTheme] = useState(
    () => localStorage.getItem("theme") || "aurora"
  );
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
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
  const [scheduledWorkoutForToday, setScheduledWorkoutForToday] = useState(null);
  const [showPreCheckin, setShowPreCheckin] = useState(null); // scheduled workout obj
  const [showPostFeedback, setShowPostFeedback] = useState(null); // { scheduledWorkoutId, workoutId }
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [programOnboardingProgram, setProgramOnboardingProgram] = useState(null); // program to enroll in
  const [redoingOnboarding, setRedoingOnboarding] = useState(false);
  const [highlightProgramId, setHighlightProgramId] = useState(null);
  useEffect(() => { if (screen !== "program") setHighlightProgramId(null); }, [screen]);

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
    setDataLoaded(true);
  };

  // Register service worker for push notifications
  useEffect(() => { registerServiceWorker(); }, []);

  // Auth listener
  useEffect(() => {
    // Fallback timeout — never stay stuck on "Loading..."
    const timeout = setTimeout(() => setAuthLoading(false), 5000);

    const checkAuth = async () => {
      try {
        const session = await getSession();
        if (session?.user) {
          try {
            const prof = await getProfile();
            if (!prof) {
              // Session exists but no profile — account was deleted, sign out
              await signOut();
            } else {
              setUser(session.user);
              setProfile(prof);
              if (prof.plan) setPlan(prof.plan);
              // Session is fresh, load data now
              refreshAppData();
            }
          } catch {
            // Profile fetch failed due to network — still let user in
            setUser(session.user);
          }
        }
      } catch {
        // Session fetch failed — treat as logged out
      } finally {
        clearTimeout(timeout);
        setAuthLoading(false);
      }
    };
    checkAuth();

    // Listen for OAuth redirects and session changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        if (event === 'SIGNED_IN') seedDummyData();
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

  const handleLogout = async () => {
    setUser(null);
    setProfile(null);
    setScreen("home");
    window.history.replaceState({ screen: "home" }, "");
    setDataLoaded(false);
    setAppWorkouts([]);
    setAppPRs([]);
    setAppVolumeTrend([]);
    try { await signOut(); } catch (e) { console.error("Sign out error:", e); }
  };

  const needsOnboarding = user && profile && profile.onboarding_complete === false;

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
        <AuthScreen onSignUp={refreshAuth} onSignIn={refreshAuth} />
      </div>
    );
  }

  Object.assign(C, THEMES[activeTheme]);

  const handleThemeChange = (name) => {
    localStorage.setItem("theme", name);
    setActiveTheme(name);
  };

  const nav = (t, replace) => {
    setTab(["home","coach","program","history","stats"].includes(t) ? t : null);
    setScreen(t);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    if (replace) window.history.replaceState({ screen: t }, "");
    else window.history.pushState({ screen: t }, "");
  };

  const tabs = [{ id: "home", icon: "⌂", label: "Home" }, { id: "program", icon: "📋", label: "Program" }, { id: "coach", icon: "🧠", label: "Coach" }, { id: "history", icon: "☰", label: "History" }, { id: "stats", icon: "◈", label: "Stats" }];

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

  const handlePreCheckinSubmit = async (ratings) => {
    if (showPreCheckin && Object.keys(ratings).length > 0) {
      try { await saveSorenessRatings(showPreCheckin.id, ratings); } catch (e) { console.error("Error saving soreness:", e); }
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
    } catch (e) { console.error("Abandon error:", e); }
  };

  return (
    <div className="app-shell" style={{ background: C.bg, overflow: "hidden", fontFamily: C.font, position: "relative", display: "flex", flexDirection: "column" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { display: none; }
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }
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
        {screen === "home" && <HomeScreen onStart={() => nav("pick")} onNav={nav} plan={plan} user={user} profile={profile} onProfileClick={() => setProfileModalOpen(true)} workouts={appWorkouts} prs={appPRs} volumeTrend={appVolumeTrend} onDayClick={(d) => { setDayDetailDate(d); nav("dayDetail"); }} todayWorkout={scheduledWorkoutForToday} onStartScheduled={startScheduledWorkout} enrollment={activeEnrollment} />}
        {screen === "pick" && <TemplatePicker onSelect={(t) => { setTpl(t); nav("workout"); }} onBack={() => nav("home")} />}
        {screen === "workout" && tpl && <WorkoutScreen template={tpl} isOnline={isOnline} user={user} onFinish={(prs) => {
          setPendingSync(getPendingCount());
          // If this was a scheduled workout, mark it completed and show post-feedback
          if (tpl.scheduledWorkoutId) {
            updateScheduledWorkout(tpl.scheduledWorkoutId, { status: "completed" }).catch(e => console.error(e));
            setShowPostFeedback({ scheduledWorkoutId: tpl.scheduledWorkoutId, workoutId: null });
          }
          refreshAppData();
          if (prs && prs.length > 0) { setCelebrationPRs(prs); }
          else if (!tpl.scheduledWorkoutId) { nav("home"); }
        }} onBack={() => nav("home")} />}
        {screen === "program" && !programOnboardingProgram && <ProgramScreen enrollment={activeEnrollment} programs={appPrograms} profile={profile} prs={appPRs} onStartOnboarding={(p) => setProgramOnboardingProgram(p)} onStartWorkout={startScheduledWorkout} onAbandon={handleAbandonProgram} onNav={nav} highlightProgramId={highlightProgramId} onClearHighlight={() => setHighlightProgramId(null)} />}
        {screen === "program" && programOnboardingProgram && <ProgramOnboardingScreen program={programOnboardingProgram} profile={profile} prs={appPRs} onEnroll={(enr) => { setActiveEnrollment(enr); setProgramOnboardingProgram(null); refreshAppData(); }} onBack={() => setProgramOnboardingProgram(null)} />}
        {screen === "coach" && <AICoachScreen plan={plan} queriesUsed={queriesUsed} onUseQuery={() => setQueriesUsed(q => q + 1)} onShowPricing={() => nav("pricing")} activeEnrollment={activeEnrollment} onNavigate={nav} onProgramCreated={(programId) => { setHighlightProgramId(programId); refreshAppData(); }} />}
        {screen === "pricing" && <PricingScreen currentPlan={plan} onSelect={(p) => { setPlan(p); setQueriesUsed(0); nav("coach"); }} onBack={() => nav("coach")} />}
        {screen === "history" && <HistoryScreen workouts={appWorkouts} prs={appPRs} />}
        {screen === "stats" && <StatsScreen workouts={appWorkouts} prs={appPRs} volumeTrend={appVolumeTrend} />}
        {screen === "weekDetail" && <WeekDetailScreen workouts={appWorkouts} prs={appPRs} onBack={() => nav("home")} />}
        {screen === "dayDetail" && dayDetailDate && <DayDetailScreen date={dayDetailDate} workouts={appWorkouts} prs={appPRs} onBack={() => nav("home")} />}
        {screen === "prs" && <PRScreen prs={appPRs} onBack={() => nav("home")} />}
        {screen === "notifications" && <NotificationScreen onBack={() => nav("home")} />}
      </div>
      {!["workout", "pricing", "prs", "notifications", "weekDetail", "dayDetail"].includes(screen) && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "calc(72px + env(safe-area-inset-bottom, 0px))", background: `linear-gradient(to top, ${C.bg} 70%, transparent)`, display: "flex", justifyContent: "space-around", alignItems: "flex-start", paddingTop: 10 }}>
          {tabs.map(t => (<button key={t.id} onClick={() => nav(t.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: tab === t.id ? (t.id === "coach" ? C.ai : t.id === "program" ? (activeEnrollment ? C.accent : C.dim) : C.accent) : "rgba(255,255,255,0.2)", transition: "color .2s ease", padding: "4px 12px" }}><span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span><span style={{ fontSize: 9, fontWeight: 600, fontFamily: C.mono, letterSpacing: .5 }}>{t.label}</span></button>))}
        </div>
      )}
      <div style={{ position: "absolute", bottom: "calc(6px + env(safe-area-inset-bottom, 0px))", left: "50%", transform: "translateX(-50%)", width: 134, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />

      {celebrationPRs && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#111113", borderRadius: 24, padding: "32px 24px", maxWidth: 380, width: "100%", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.accent, fontFamily: C.font, marginBottom: 4 }}>New Personal Record{celebrationPRs.length > 1 ? "s" : ""}!</div>
              <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.5 }}>Congratulations on crushing it!</div>
            </div>
            {celebrationPRs.map((pr, i) => {
              const compWeight = pr.type === "1rm" ? pr.e1rm : pr.weight;
              const animal = getAnimalComparison(compWeight);
              const animalStyle = getAnimalStyle(animal.row, animal.col);
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
                  <div style={{ fontSize: 13, color: C.dim, fontFamily: C.mono, marginBottom: 12 }}>
                    {pr.weight}kg × {pr.reps} rep{pr.reps !== 1 ? "s" : ""}
                    {pr.type === "1rm" && <span> (e1RM: {Math.round(pr.e1rm)}kg)</span>}
                    {pr.type === "volume" && <span> (vol: {pr.volume}kg)</span>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ ...animalStyle, borderRadius: 16, backgroundRepeat: "no-repeat" }} />
                    <div style={{ fontSize: 13, color: C.accent, fontWeight: 600, fontFamily: C.font, marginTop: 8 }}>
                      That's like lifting a {animal.name}!
                    </div>
                  </div>
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
        />
      )}

      {/* Pre-workout soreness check-in modal */}
      {showPreCheckin && (
        <PreWorkoutCheckin
          muscleGroups={showPreCheckin.program_days?.muscle_groups || ["Chest", "Back", "Legs"]}
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
