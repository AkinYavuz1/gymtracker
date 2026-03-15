import { useState, useEffect, useRef } from "react";
import { signUp, signIn, signOut, getSession, getProfile, updateProfile, seedDummyData, callCoachAPI, getWorkouts, getPersonalRecords, getTemplates, getVolumeTrend, supabase } from "./lib/supabase";
import { queueWorkout, syncPendingWorkouts, getPendingCount } from "./lib/offlineStorage";
import { getExerciseGif } from "./lib/exerciseGifs";

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
const C = { accent: "#DFFF3C", bg: "#08080A", ai: "#A47BFF", card: "rgba(255,255,255,0.035)", border: "rgba(255,255,255,0.055)", dim: "rgba(255,255,255,0.3)", font: "'Outfit', sans-serif", mono: "'JetBrains Mono', monospace" };

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
  return (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}><div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>Weight (kg)</div><div style={{ display: "flex", alignItems: "center", gap: 12 }}><button onClick={() => onChange(Math.max(0, value - 2.5))} style={{ width: 48, height: 48, borderRadius: 14, border: `1px solid ${C.border}`, background: C.card, color: "#fff", fontSize: 22, fontWeight: 300, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button><div style={{ fontSize: 38, fontWeight: 800, color: "#fff", fontFamily: C.font, minWidth: 80, textAlign: "center", lineHeight: 1 }}>{value}<span style={{ fontSize: 14, color: C.dim, marginLeft: 2 }}>kg</span></div><button onClick={() => onChange(value + 2.5)} style={{ width: 48, height: 48, borderRadius: 14, border: `1px solid ${color}40`, background: `${color}12`, color, fontSize: 22, fontWeight: 300, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button></div><div style={{ display: "flex", gap: 6 }}>{[2.5, 5, 10].map(j => (<button key={j} onClick={() => onChange(value + j)} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: C.mono, cursor: "pointer" }}>+{j}</button>))}</div></div>);
}
function RepBubbles({ value, onChange, color = C.accent }) {
  return (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}><div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>Reps</div><div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, width: "100%", maxWidth: 280 }}>{[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20].map(n => (<button key={n} onClick={() => onChange(n)} style={{ width: "100%", aspectRatio: "1", borderRadius: 12, border: value === n ? `2px solid ${color}` : `1px solid ${C.border}`, background: value === n ? `${color}18` : "rgba(255,255,255,0.02)", color: value === n ? color : "rgba(255,255,255,0.5)", fontSize: 15, fontWeight: 700, fontFamily: C.font, cursor: "pointer", transition: "all .15s ease", display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</button>))}</div></div>);
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
function AICoachScreen({ plan, queriesUsed, onUseQuery, onShowPricing }) {
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeCat, setActiveCat] = useState("Analyze");
  const [showPrompts, setShowPrompts] = useState(true);
  const [totalCost, setTotalCost] = useState(0);
  const scrollRef = useRef(null);

  const planData = PLANS[plan];
  const remaining = Math.max(0, planData.queries - queriesUsed);
  const limitReached = remaining <= 0;

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, loading]);

  const send = async (prompt, label) => {
    if (limitReached) return;
    setShowPrompts(false);
    setMsgs(prev => [...prev, { role: "user", content: label }]);
    setLoading(true);
    try {
      const result = await callCoachAPI(prompt, label);
      setMsgs(prev => [...prev, { role: "assistant", content: result.text }]);
      onUseQuery();
      setTotalCost(prev => prev + (result.cost_usd || 0));
    } catch (e) {
      setMsgs(prev => [...prev, { role: "assistant", content: e.message || "Connection issue. Try again." }]);
    }
    setLoading(false);
  };

  const catKeys = Object.keys(AI_PROMPTS);

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
          {msgs.length > 0 && <button onClick={() => { setMsgs([]); setShowPrompts(true); }} style={{ background: `${C.ai}15`, border: `1px solid ${C.ai}30`, borderRadius: 10, padding: "6px 12px", color: C.ai, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: C.font }}>New</button>}
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

        {msgs.length > 0 && !loading && msgs[msgs.length - 1]?.role === "assistant" && !limitReached && (
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
  { id: "hypertrophy", label: "Build Muscle",  icon: "💪", desc: "Maximize size and volume" },
  { id: "strength",    label: "Get Stronger",  icon: "🏋️", desc: "Increase max lifts" },
  { id: "endurance",   label: "Endurance",     icon: "🏃", desc: "Stamina and conditioning" },
  { id: "general",     label: "Stay Fit",      icon: "⚡", desc: "Overall health and fitness" },
];
const EXPERIENCE_LEVELS = [
  { id: "beginner",     label: "Beginner",     icon: "🌱", desc: "Less than 1 year" },
  { id: "intermediate", label: "Intermediate", icon: "🔥", desc: "1–3 years" },
  { id: "advanced",     label: "Advanced",     icon: "🏆", desc: "3+ years" },
];

function OnboardingScreen({ user, onComplete }) {
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
  });

  const totalSteps = 4;
  const progress = ((step + 1) / totalSteps) * 100;

  const set = (key, val) => setData(prev => ({ ...prev, [key]: val }));

  const canNext = () => {
    if (step === 0) return data.gender !== "";
    if (step === 1) return data.age !== "" && Number(data.age) >= 13 && Number(data.age) <= 100;
    if (step === 2) return data.weight !== "";
    if (step === 3) return data.goal !== "" && data.experience !== "";
    return true;
  };

  const finish = async () => {
    setSaving(true);
    const weightKg = data.unit === "imperial"
      ? Math.round(Number(data.weight) * 0.453592 * 10) / 10
      : Number(data.weight);
    const heightCm = data.unit === "imperial"
      ? Math.round(Number(data.height) * 2.54)
      : Number(data.height);
    await updateProfile({
      gender: data.gender,
      age: Number(data.age),
      weight_kg: weightKg || null,
      height_cm: heightCm || null,
      training_goal: data.goal,
      experience: data.experience,
      unit_system: data.unit,
      onboarding_complete: true,
    });
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
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 12, fontFamily: C.font }}>← Back</button>
          )}
        </div>
        <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)" }}>
          <div style={{ height: "100%", borderRadius: 2, background: C.accent, width: `${progress}%`, transition: "width 0.4s ease" }} />
        </div>
      </div>

      <div style={{ flex: 1 }}>

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

        {/* Step 3 — Goal + Experience */}
        {step === 3 && (
          <div>
            <div style={{ fontSize: 11, color: C.accent, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Training Profile</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: C.font, marginBottom: 6 }}>Your goals</div>
            <div style={{ fontSize: 13, color: C.dim, marginBottom: 20 }}>Personalises your AI coach sessions</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
              {GOALS.map(g => (
                <button key={g.id} onClick={() => set("goal", g.id)} style={{ padding: "16px 12px", borderRadius: 14, border: `2px solid ${data.goal === g.id ? C.accent : C.border}`, background: data.goal === g.id ? `${C.accent}12` : C.card, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{g.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: data.goal === g.id ? C.accent : "#fff", fontFamily: C.font }}>{g.label}</div>
                  <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{g.desc}</div>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Experience Level</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
          </div>
        )}
      </div>

      {/* Next / Finish button */}
      <button
        onClick={step < totalSteps - 1 ? () => setStep(s => s + 1) : finish}
        disabled={!canNext() || saving}
        style={{
          width: "100%", padding: "16px", borderRadius: 16, border: "none",
          background: canNext() ? `linear-gradient(135deg, ${C.accent}, #C8E030)` : "rgba(255,255,255,0.06)",
          color: canNext() ? C.bg : "rgba(255,255,255,0.2)",
          fontSize: 16, fontWeight: 800, fontFamily: C.font,
          cursor: canNext() && !saving ? "pointer" : "default",
          transition: "all 0.3s"
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
function HomeScreen({ onStart, onNav, plan, user, profile, onProfileClick, workouts = [], prs = [], volumeTrend = [] }) {
  const [m, setM] = useState(false);

  useEffect(() => { setM(true); }, []);

  // Calculate stats from workouts prop
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
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
    ? (totalVolume >= 1000 ? (totalVolume / 1000).toFixed(1) + "k" : Math.round(totalVolume)) + " kg"
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
    { label: "Workouts", val: weekWorkouts.length.toString(), sub: "this week" },
    { label: "Volume", val: volumeStr, sub: "this week" },
    { label: "Streak", val: streak.toString(), sub: "days" },
    { label: "Duration", val: durationStr, sub: "avg/session" }
  ];

  const userName = (profile?.full_name || profile?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Athlete").split(" ")[0];
  const userInitial = userName.charAt(0).toUpperCase();
  const wd = Array(7).fill(false);
  weekWorkouts.forEach(wo => {
    const day = new Date(wo.started_at).getDay();
    wd[day === 0 ? 6 : day - 1] = true;
  });
  const todayIdx = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();
  return (
    <div style={{ padding: "0 20px 110px", opacity: m ? 1 : 0, transform: m ? "none" : "translateY(10px)", transition: "all .5s cubic-bezier(.22,1,.36,1)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 18px" }}>
        <div><div style={{ fontSize: 12, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div><div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: C.font, marginTop: 2 }}>{(() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; })()}</div></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {plan !== "free" && <span style={{ padding: "3px 8px", borderRadius: 6, background: `${PLANS[plan].color}20`, color: PLANS[plan].color, fontSize: 9, fontWeight: 800, fontFamily: C.mono }}>{PLANS[plan].badge}</span>}
          <button onClick={onProfileClick} style={{ width: 42, height: 42, borderRadius: 14, background: `linear-gradient(135deg, ${C.accent}, #B8CC39)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: C.bg, fontFamily: C.font, border: "none", cursor: "pointer", padding: 0 }}>{userInitial}</button>
        </div>
      </div>
      <button onClick={onStart} style={{ width: "100%", padding: "20px 22px", border: "none", borderRadius: 22, background: `linear-gradient(135deg, ${C.accent} 0%, #C8E030 100%)`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, position: "relative", overflow: "hidden" }}>
        <div style={{ textAlign: "left", position: "relative", zIndex: 1 }}><div style={{ fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,0.45)", fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>Tap to begin</div><div style={{ fontSize: 21, fontWeight: 800, color: C.bg, fontFamily: C.font }}>Start Workout</div></div>
        <div style={{ width: 50, height: 50, borderRadius: 16, background: "rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, position: "relative", zIndex: 1 }}>▶</div>
      </button>
      <button onClick={() => onNav("coach")} style={{ width: "100%", padding: "14px 16px", border: `1px solid ${C.ai}25`, borderRadius: 18, background: `${C.ai}08`, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, marginBottom: 22, textAlign: "left" }}>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: `linear-gradient(135deg, ${C.ai}, #7B4CFF)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🧠</div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Ask AI Coach</div><div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>Powered by Haiku · {PLANS[plan].queries === 999 ? "Unlimited" : `${PLANS[plan].queries}/day`}</div></div>
        <div style={{ color: C.ai, fontSize: 16 }}>→</div>
      </button>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "0 8px", marginBottom: 22 }}>{["M","T","W","T","F","S","S"].map((d, i) => (<div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}><div style={{ fontSize: 10, fontFamily: C.mono, color: i === todayIdx ? C.accent : C.dim, fontWeight: 600 }}>{d}</div><div style={{ width: 28, height: 28, borderRadius: 10, background: i === todayIdx ? `${C.accent}20` : wd[i] ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)", border: i === todayIdx ? `1.5px solid ${C.accent}50` : `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: wd[i] ? C.accent : "rgba(255,255,255,0.1)" }}>{wd[i] ? "✓" : ""}</div></div>))}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>{stats.map((s, i) => (<div key={i} style={{ background: C.card, borderRadius: 16, padding: "14px 16px", border: `1px solid ${C.border}` }}><div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>{s.label}</div><div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: C.font, lineHeight: 1 }}>{s.val}</div><div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>{s.sub}</div></div>))}</div>
      <div style={{ background: C.card, borderRadius: 18, padding: "18px", border: `1px solid ${C.border}`, marginBottom: 22 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>Volume Trend</div><div style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>{chartData.length > 1 && chartData[0].v > 0 ? ((chartData[chartData.length - 1].v - chartData[0].v) / chartData[0].v * 100 >= 0 ? "↑" : "↓") + " " + Math.abs(Math.round((chartData[chartData.length - 1].v - chartData[0].v) / chartData[0].v * 100)) + "%" : ""}</div></div><MiniChart data={chartData} /></div>
      <div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>Personal Records</div><div onClick={() => onNav("prs")} style={{ fontSize: 12, color: C.accent, cursor: "pointer", fontWeight: 600 }}>See All →</div></div>{prs.slice(0, 3).map((p, i) => (<div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 15px", borderRadius: 14, marginBottom: 7, background: C.card, border: `1px solid ${C.border}` }}><div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{p.exercise_name}</div><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: C.font }}>{Math.round(p.estimated_1rm || p.weight_kg)}kg</span><span style={{ fontSize: 12, color: C.dim }}>1RM</span></div></div>))}</div>
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
      onFinish();
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
        }
      };

      await Promise.race([save(), timeout]);
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
    onFinish();
  };

  return (
    <div style={{ padding: "0 20px 110px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 6px" }}><button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, color: "#fff", borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", opacity: saving ? 0.6 : 1 }} disabled={saving}>✕</button><button onClick={saveWorkout} style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)`, border: "none", color: C.bg, borderRadius: 12, padding: "8px 18px", fontSize: 13, fontWeight: 800, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }} disabled={saving}>Finish {saving ? "..." : isOnline ? "✓" : "✓ (offline)"}</button></div>
      <div style={{ textAlign: "center", padding: "10px 0 20px" }}><div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase" }}>{template.label} Day</div><div style={{ fontSize: 42, fontWeight: 800, color: "#fff", fontFamily: C.font, letterSpacing: -2, lineHeight: 1, margin: "4px 0 10px" }}>{fmt(timer)}</div><div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}><div style={{ width: 140, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 2, background: color, width: `${(ds / ts) * 100}%`, transition: "width .4s ease" }} /></div><span style={{ fontSize: 12, color: C.dim, fontFamily: C.mono }}>{ds}/{ts}</span></div></div>
      {rest > 0 && <div style={{ background: `${color}10`, border: `1px solid ${color}30`, borderRadius: 16, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}><div><div style={{ fontSize: 10, color, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>Rest</div><div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: C.font }}>{fmt(rest)}</div></div><div style={{ display: "flex", gap: 6 }}>{[30, 60].map(s => (<button key={s} onClick={() => setRest(r => r + s)} style={{ background: `${color}18`, border: "none", color, borderRadius: 10, padding: "7px 11px", fontSize: 11, cursor: "pointer", fontFamily: C.mono }}>+{s}s</button>))}<button onClick={() => setRest(0)} style={{ background: C.card, border: "none", color: "#fff", borderRadius: 10, padding: "7px 11px", fontSize: 11, cursor: "pointer" }}>Skip</button></div></div>}
      {exs.map((ex, ei) => (
        <div key={ei} style={{ background: C.card, borderRadius: 20, border: `1px solid ${C.border}`, marginBottom: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{ex.name}</div><div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, marginTop: 2 }}>{ex.equipment}</div></div><button onClick={() => setExs(p => p.filter((_, i) => i !== ei))} style={{ background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.15)", borderRadius: 8, color: "rgba(255,80,80,0.6)", padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>✕</button></div>
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
    { l: "Volume", v: (totalVolume / 1000).toFixed(0) + "k", c: "#3CFFF0" },
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
function HistoryScreen({ workouts = [] }) {
  const [m, setM] = useState(false);

  useEffect(() => { setM(true); }, []);

  const colors = ["#DFFF3C", "#3CFFF0", "#FF6B3C", "#B47CFF", "#47B8FF"];

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
      {workouts.map((w, i) => (
        <div key={i} style={{ background: C.card, borderRadius: 18, padding: "16px", marginBottom: 10, border: `1px solid ${C.border}`, opacity: m ? 1 : 0, transform: m ? "none" : "translateY(12px)", transition: `all .45s cubic-bezier(.22,1,.36,1) ${i * .06}s` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: 5, background: colors[i % colors.length] }} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{w.title || "Workout"}</div>
                <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{new Date(w.started_at).toLocaleDateString()} · {Math.round((w.duration_secs || 0) / 60)}min</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.55)", fontFamily: C.mono }}>{Math.round((w.duration_secs || 0) / 60)}m</div>
              <div style={{ fontSize: 11, color: C.dim }}>{(w.total_volume_kg || 0) >= 1000 ? ((w.total_volume_kg || 0) / 1000).toFixed(1) + "k" : Math.round(w.total_volume_kg || 0)} kg</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══ PERSONAL RECORDS ═══ */
function PRScreen({ onBack, prs = [] }) {
  const [m, setM] = useState(false);

  useEffect(() => { setM(true); }, []);

  const colors = ["#DFFF3C", "#3CFFF0", "#FF6B3C", "#B47CFF", "#47B8FF"];

  return (
    <div style={{ padding: "0 20px 110px", opacity: m ? 1 : 0, transition: "opacity .4s" }}>
      <div style={{ padding: "14px 0 6px" }}>
        <button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, color: "#fff", borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: C.font }}>← Back</button>
      </div>
      <div style={{ padding: "8px 0 18px" }}>
        <div style={{ fontSize: 12, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>Lifting</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: C.font, marginTop: 2 }}>Personal Records</div>
      </div>
      {prs.length === 0 && (
        <div style={{ textAlign: "center", paddingTop: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🏋️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: C.font, marginBottom: 6 }}>No PRs Yet</div>
          <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.5 }}>Complete workouts to start tracking your personal records.</div>
        </div>
      )}
      {prs.map((p, i) => (
        <div key={i} style={{ background: C.card, borderRadius: 18, padding: "16px", marginBottom: 10, border: `1px solid ${C.border}`, opacity: m ? 1 : 0, transform: m ? "none" : "translateY(12px)", transition: `all .45s cubic-bezier(.22,1,.36,1) ${i * .06}s` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: 5, background: colors[i % colors.length] }} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{p.exercise_name}</div>
                <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{p.reps} reps @ {p.weight_kg}kg</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: colors[i % colors.length], fontFamily: C.font }}>{p.weight_kg}kg</div>
              {p.estimated_1rm && <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono }}>e1RM: {Math.round(p.estimated_1rm)}kg</div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══ PROFILE MODAL ═══ */
function ProfileModal({ profile, plan, user, onClose, onLogout }) {
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
          <div style={{ width: 64, height: 64, borderRadius: 20, background: `linear-gradient(135deg, ${C.accent}, #B8CC39)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: C.bg, fontFamily: C.font }}>
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
        <div style={{ background: `${planData.color}08`, borderRadius: 16, padding: "14px", border: `1px solid ${planData.color}30`, marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: planData.color, fontWeight: 700, textAlign: "center" }}>
            {plan === "free" ? "5 AI queries/day" : plan === "pro" ? "30 AI queries/day" : "Unlimited AI queries"}
          </div>
        </div>

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

/* ═══ APP SHELL ═══ */
export default function GAIns() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [screen, setScreen] = useState("home");
  const [tab, setTab] = useState("home");
  const [tpl, setTpl] = useState(null);
  const [plan, setPlan] = useState("free");
  const [queriesUsed, setQueriesUsed] = useState(0);
  const [appWorkouts, setAppWorkouts] = useState([]);
  const [appPRs, setAppPRs] = useState([]);
  const [appVolumeTrend, setAppVolumeTrend] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const scrollRef = useRef(null);

  // Shared data loader — called explicitly after auth is confirmed
  const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

  const refreshAppData = async () => {
    try { const w = await withTimeout(getWorkouts(100), 10000); setAppWorkouts(w || []); } catch (e) { console.error("Failed to load workouts:", e); }
    try { const p = await withTimeout(getPersonalRecords(), 10000); setAppPRs(p || []); } catch (e) { console.error("Failed to load PRs:", e); }
    try { const vt = await withTimeout(getVolumeTrend(), 10000); setAppVolumeTrend(vt || []); } catch (e) { console.error("Failed to load volume trend:", e); }
    setDataLoaded(true);
  };

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
          const prof = await getProfile();
          setProfile(prof);
        }} />
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

  const nav = (t, replace) => {
    setTab(["home","coach","history","stats"].includes(t) ? t : null);
    setScreen(t);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    if (replace) window.history.replaceState({ screen: t }, "");
    else window.history.pushState({ screen: t }, "");
  };

  const tabs = [{ id: "home", icon: "⌂", label: "Home" }, { id: "coach", icon: "🧠", label: "Coach" }, { id: "history", icon: "☰", label: "History" }, { id: "stats", icon: "◈", label: "Stats" }];

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
        {screen === "home" && <HomeScreen onStart={() => nav("pick")} onNav={nav} plan={plan} user={user} profile={profile} onProfileClick={() => setProfileModalOpen(true)} workouts={appWorkouts} prs={appPRs} volumeTrend={appVolumeTrend} />}
        {screen === "pick" && <TemplatePicker onSelect={(t) => { setTpl(t); nav("workout"); }} onBack={() => nav("home")} />}
        {screen === "workout" && tpl && <WorkoutScreen template={tpl} isOnline={isOnline} user={user} onFinish={() => { setPendingSync(getPendingCount()); refreshAppData(); nav("home"); }} onBack={() => nav("home")} />}
        {screen === "coach" && <AICoachScreen plan={plan} queriesUsed={queriesUsed} onUseQuery={() => setQueriesUsed(q => q + 1)} onShowPricing={() => nav("pricing")} />}
        {screen === "pricing" && <PricingScreen currentPlan={plan} onSelect={(p) => { setPlan(p); setQueriesUsed(0); nav("coach"); }} onBack={() => nav("coach")} />}
        {screen === "history" && <HistoryScreen workouts={appWorkouts} />}
        {screen === "stats" && <StatsScreen workouts={appWorkouts} prs={appPRs} volumeTrend={appVolumeTrend} />}
        {screen === "prs" && <PRScreen prs={appPRs} onBack={() => nav("home")} />}
      </div>
      {!["workout", "pricing", "prs"].includes(screen) && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "calc(72px + env(safe-area-inset-bottom, 0px))", background: `linear-gradient(to top, ${C.bg} 70%, transparent)`, display: "flex", justifyContent: "space-around", alignItems: "flex-start", paddingTop: 10 }}>
          {tabs.map(t => (<button key={t.id} onClick={() => nav(t.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: tab === t.id ? (t.id === "coach" ? C.ai : C.accent) : "rgba(255,255,255,0.2)", transition: "color .2s ease", padding: "4px 16px" }}><span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span><span style={{ fontSize: 9, fontWeight: 600, fontFamily: C.mono, letterSpacing: .5 }}>{t.label}</span></button>))}
        </div>
      )}
      <div style={{ position: "absolute", bottom: "calc(6px + env(safe-area-inset-bottom, 0px))", left: "50%", transform: "translateX(-50%)", width: 134, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />

      {profileModalOpen && (
        <ProfileModal
          profile={profile}
          user={user}
          plan={plan}
          onClose={() => setProfileModalOpen(false)}
          onLogout={() => {
            setProfileModalOpen(false);
            handleLogout();
          }}
        />
      )}
    </div>
  );
}
