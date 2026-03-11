import { useState, useEffect, useRef } from "react";
import { signUp, signIn, signOut, getSession, getUser, getProfile, signInWithGoogle, seedDummyData, callCoachAPI, getWorkouts, getPersonalRecords, getTemplates, getVolumeTrend, supabase } from "./lib/supabase";

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
      <div style={{ fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 8, fontFamily: C.font }}>GymTracker</div>
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

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20, marginBottom: 20 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
        <span style={{ fontSize: 11, color: C.dim, fontFamily: C.mono }}>OR</span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
      </div>

      <button
        onClick={async () => {
          setError("");
          setLoading(true);
          try {
            const { error: err } = await signInWithGoogle();
            if (err) setError(err.message || "Google sign-in failed");
          } catch (e) {
            setError(e.message || "Google sign-in error");
          }
          setLoading(false);
        }}
        disabled={loading}
        style={{
          padding: "13px 14px",
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          background: C.card,
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
          fontFamily: C.font,
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.6 : 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          marginBottom: 20
        }}
      >
        <span style={{ fontSize: 18 }}>🔐</span>
        Sign in with Google
      </button>

      <div style={{ fontSize: 12, color: C.dim }}>
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
function HomeScreen({ onStart, onNav, plan, user, profile }) {
  const [m, setM] = useState(false);
  const [workouts, setWorkouts] = useState([]);
  const [prs, setPRs] = useState([]);
  const [volumeTrend, setVolumeTrend] = useState([]);
  const [stats, setStats] = useState([{ label: "Workouts", val: "—", sub: "this week" }, { label: "Volume", val: "—", sub: "kg total" }, { label: "Streak", val: "—", sub: "days" }, { label: "Duration", val: "—", sub: "avg/week" }]);

  useEffect(() => {
    // Show UI immediately
    setM(true);

    // Load data in background
    const loadData = async () => {
      try {
        const [w, p, vt] = await Promise.all([
          getWorkouts(10),
          getPersonalRecords(),
          getVolumeTrend()
        ]);
        setWorkouts(w);
        setPRs(p);
        setVolumeTrend(vt || []);

        // Calculate stats from workouts
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekWorkouts = w.filter(wo => new Date(wo.started_at) >= weekStart);
        const totalVolume = w.reduce((sum, wo) => sum + (wo.total_volume_kg || 0), 0);
        const avgDuration = weekWorkouts.length > 0 ? weekWorkouts.reduce((sum, wo) => sum + (wo.duration_secs || 0), 0) / weekWorkouts.length / 60 : 0;

        setStats([
          { label: "Workouts", val: weekWorkouts.length.toString(), sub: "this week" },
          { label: "Volume", val: totalVolume > 0 ? (totalVolume / 1000).toFixed(1) + "k" : "—", sub: "kg total" },
          { label: "Streak", val: "—", sub: "days" },
          { label: "Duration", val: avgDuration > 0 ? (avgDuration / 60).toFixed(1) + "h" : "—", sub: "avg/week" }
        ]);
      } catch (e) {
        console.error("Failed to load home data:", e);
      }
    };
    loadData();
  }, []);

  const userName = profile?.full_name ? profile.full_name.split(" ")[0] : "User";
  const userInitial = userName.charAt(0).toUpperCase();
  const wd = [true, true, false, true, true, false, false];
  return (
    <div style={{ padding: "0 20px 110px", opacity: m ? 1 : 0, transform: m ? "none" : "translateY(10px)", transition: "all .5s cubic-bezier(.22,1,.36,1)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 18px" }}>
        <div><div style={{ fontSize: 12, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div><div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: C.font, marginTop: 2 }}>Good evening</div></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {plan !== "free" && <span style={{ padding: "3px 8px", borderRadius: 6, background: `${PLANS[plan].color}20`, color: PLANS[plan].color, fontSize: 9, fontWeight: 800, fontFamily: C.mono }}>{PLANS[plan].badge}</span>}
          <div style={{ width: 42, height: 42, borderRadius: 14, background: `linear-gradient(135deg, ${C.accent}, #B8CC39)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: C.bg, fontFamily: C.font }}>{userInitial}</div>
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
      <div style={{ display: "flex", justifyContent: "space-between", padding: "0 8px", marginBottom: 22 }}>{["M","T","W","T","F","S","S"].map((d, i) => (<div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}><div style={{ fontSize: 10, fontFamily: C.mono, color: i === 6 ? C.accent : C.dim, fontWeight: 600 }}>{d}</div><div style={{ width: 28, height: 28, borderRadius: 10, background: i === 6 ? `${C.accent}20` : wd[i] ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)", border: i === 6 ? `1.5px solid ${C.accent}50` : `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: wd[i] ? C.accent : "rgba(255,255,255,0.1)" }}>{wd[i] ? "✓" : ""}</div></div>))}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>{stats.map((s, i) => (<div key={i} style={{ background: C.card, borderRadius: 16, padding: "14px 16px", border: `1px solid ${C.border}` }}><div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>{s.label}</div><div style={{ fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: C.font, lineHeight: 1 }}>{s.val}</div><div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>{s.sub}</div></div>))}</div>
      <div style={{ background: C.card, borderRadius: 18, padding: "18px", border: `1px solid ${C.border}`, marginBottom: 22 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>Volume Trend</div><div style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>↑ {volumeTrend.length > 1 ? Math.round(((volumeTrend[volumeTrend.length - 1]?.v - volumeTrend[0]?.v) / volumeTrend[0]?.v * 100 + Number.EPSILON) * 100) / 100 : 0}%</div></div><MiniChart data={volumeTrend.length > 0 ? volumeTrend : [{ w: "W1", v: 0 }]} /></div>
      <div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>Personal Records</div><div onClick={() => onNav("stats")} style={{ fontSize: 12, color: C.accent, cursor: "pointer", fontWeight: 600 }}>See All →</div></div>{prs.slice(0, 3).map((p, i) => (<div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 15px", borderRadius: 14, marginBottom: 7, background: C.card, border: `1px solid ${C.border}` }}><div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{p.exercise_name}</div><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: C.font }}>{p.weight_kg}kg</span></div></div>))}</div>
    </div>
  );
}

/* ═══ TEMPLATE PICKER ═══ */
function TemplatePicker({ onSelect, onBack }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pg, setPg] = useState(0);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const tpls = await getTemplates();
        setTemplates(tpls || []);
      } catch (e) {
        console.error("Failed to load templates:", e);
        setTemplates([]);
      }
      setLoading(false);
    };
    loadTemplates();
  }, []);

  const pages = [];
  for (let i = 0; i < templates.length; i += 2) pages.push(templates.slice(i, i + 2));

  if (loading) return <div style={{ padding: "0 20px 40px", textAlign: "center", paddingTop: 100 }}><div style={{ color: C.dim }}>Loading templates...</div></div>;

  return (<div style={{ padding: "0 20px 40px" }}><div style={{ padding: "14px 0 6px" }}><button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, color: "#fff", borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: C.font }}>← Back</button></div><div style={{ textAlign: "center", padding: "20px 0 24px" }}><div style={{ fontSize: 10, color: C.dim, fontFamily: C.mono, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Choose workout</div><div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: C.font }}>Pick a Template</div></div><div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>{pages[pg]?.map(t => { const exCount = t.template_exercises?.length || 0; return (<button key={t.id} onClick={() => onSelect(t)} style={{ width: "100%", padding: "22px 20px", borderRadius: 20, border: `1px solid ${t.color}30`, background: `${t.color}08`, cursor: "pointer", textAlign: "left" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><div style={{ fontSize: 30, marginBottom: 8 }}>{t.icon}</div><div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: C.font }}>{t.label} Day</div><div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>{exCount} exercises</div></div><div style={{ width: 44, height: 44, borderRadius: 14, background: `${t.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: t.color }}>→</div></div></button>); })}</div>{pages.length > 1 && <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>{pages.map((_, i) => (<button key={i} onClick={() => setPg(i)} style={{ width: pg === i ? 24 : 8, height: 8, borderRadius: 4, border: "none", cursor: "pointer", background: pg === i ? C.accent : "rgba(255,255,255,0.1)", transition: "all .3s ease" }} />))}</div>}</div>);
}

/* ═══ WORKOUT ═══ */
function WorkoutScreen({ template, onFinish, onBack }) {
  const [timer, setTimer] = useState(0);
  const [exs, setExs] = useState(() => template.exercises.map(e => ({ ...e, setsData: Array.from({ length: e.sets }, () => ({ weight: e.lastWeight, reps: e.lastReps, done: false })) })));
  const [edit, setEdit] = useState(null); const [ew, setEw] = useState(0); const [er, setEr] = useState(0);
  const [rest, setRest] = useState(0); const [showAdd, setShowAdd] = useState(false); const [addCat, setAddCat] = useState("Chest"); const [addPg, setAddPg] = useState(0);
  const [saving, setSaving] = useState(false);
  const color = template.color;
  useEffect(() => { const i = setInterval(() => setTimer(t => t + 1), 1000); return () => clearInterval(i); }, []);
  useEffect(() => { if (rest > 0) { const i = setInterval(() => setRest(t => t <= 1 ? 0 : t - 1), 1000); return () => clearInterval(i); } }, [rest]);
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const ts = exs.reduce((a, e) => a + e.setsData.length, 0), ds = exs.reduce((a, e) => a + e.setsData.filter(s => s.done).length, 0);
  const catExs = EX_LIB[addCat] || []; const exPgs = []; for (let i = 0; i < catExs.length; i += 4) exPgs.push(catExs.slice(i, i + 4));

  const saveWorkout = async () => {
    setSaving(true);
    try {
      const user = await getUser();
      if (!user) throw new Error("Not authenticated");

      // Calculate total volume
      let totalVolume = 0;
      exs.forEach(ex => {
        ex.setsData.forEach(set => {
          if (set.done) totalVolume += set.weight * set.reps;
        });
      });

      // Insert workout
      const { data: workout, error: workoutError } = await supabase
        .from("workouts")
        .insert({
          user_id: user.id,
          title: template.label + " Day",
          started_at: new Date(Date.now() - timer * 1000).toISOString(),
          finished_at: new Date().toISOString(),
          duration_secs: timer,
          total_volume_kg: totalVolume,
          notes: ""
        })
        .select()
        .single();

      if (workoutError) throw workoutError;

      // Insert workout sets
      for (const ex of exs) {
        for (const set of ex.setsData) {
          if (set.done) {
            const { error: setError } = await supabase.from("workout_sets").insert({
              workout_id: workout.id,
              exercise_name: ex.name,
              set_number: ex.setsData.indexOf(set) + 1,
              weight_kg: set.weight,
              reps: set.reps,
              completed: true,
              rpe: 5
            });
            if (setError) console.error("Error saving set:", setError);
          }
        }
      }

      onFinish();
    } catch (e) {
      console.error("Error saving workout:", e);
      alert("Failed to save workout: " + (e.message || "Unknown error"));
    }
    setSaving(false);
  };

  return (
    <div style={{ padding: "0 20px 110px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 6px" }}><button onClick={onBack} style={{ background: C.card, border: `1px solid ${C.border}`, color: "#fff", borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", opacity: saving ? 0.6 : 1 }} disabled={saving}>✕</button><button onClick={saveWorkout} style={{ background: `linear-gradient(135deg, ${color}, ${color}CC)`, border: "none", color: C.bg, borderRadius: 12, padding: "8px 18px", fontSize: 13, fontWeight: 800, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }} disabled={saving}>Finish {saving ? "..." : "✓"}</button></div>
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

      {showAdd && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(16px)", zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={() => setShowAdd(false)}><div onClick={e => e.stopPropagation()} style={{ background: "#111113", borderRadius: "26px 26px 0 0", padding: "24px 20px 40px" }}><div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", margin: "0 auto 18px" }} /><div style={{ fontSize: 20, fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: 18 }}>Add Exercise</div><div style={{ display: "flex", gap: 6, marginBottom: 18 }}>{Object.keys(EX_LIB).map(k => (<Pill key={k} active={addCat === k} color={color} onClick={() => { setAddCat(k); setAddPg(0); }}>{k}</Pill>))}</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>{(exPgs[addPg] || []).map((ex, i) => { const a = exs.some(e => e.name === ex.name); return (<button key={i} disabled={a} onClick={() => { setExs(p => [...p, { name: ex.name, equipment: ex.equipment, lastWeight: 20, lastReps: 10, sets: 3, setsData: [{ weight: 20, reps: 10, done: false }, { weight: 20, reps: 10, done: false }, { weight: 20, reps: 10, done: false }] }]); setShowAdd(false); }} style={{ padding: "16px 14px", borderRadius: 16, border: a ? `1px solid ${color}30` : `1px solid ${C.border}`, background: a ? `${color}08` : C.card, cursor: a ? "default" : "pointer", textAlign: "left", opacity: a ? 0.5 : 1 }}><div style={{ fontSize: 22, marginBottom: 6 }}>{ex.icon}</div><div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{ex.name}</div><div style={{ fontSize: 10, color: C.dim, marginTop: 3, fontFamily: C.mono }}>{ex.equipment}</div></button>); })}</div>{exPgs.length > 1 && <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>{exPgs.map((_, i) => (<button key={i} onClick={() => setAddPg(i)} style={{ width: addPg === i ? 22 : 8, height: 8, borderRadius: 4, border: "none", cursor: "pointer", background: addPg === i ? color : "rgba(255,255,255,0.1)" }} />))}</div>}</div></div>}
    </div>
  );
}

/* ═══ STATS ═══ */
function StatsScreen() {
  const [m, setM] = useState(false);
  const [volumeTrend, setVolumeTrend] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [prs, setPRs] = useState([]);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [vt, w, p] = await Promise.all([
          getVolumeTrend(),
          getWorkouts(100),
          getPersonalRecords()
        ]);
        setVolumeTrend(vt || []);
        setWorkouts(w || []);
        setPRs(p || []);
      } catch (e) {
        console.error("Failed to load stats:", e);
      }
      setM(true);
    };
    loadStats();
  }, []);

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
function HistoryScreen() {
  const [m, setM] = useState(false);
  const [workouts, setWorkouts] = useState([]);

  useEffect(() => {
    const loadWorkouts = async () => {
      try {
        const w = await getWorkouts(20);
        setWorkouts(w || []);
      } catch (e) {
        console.error("Failed to load workouts:", e);
      }
      setM(true);
    };
    loadWorkouts();
  }, []);

  const colors = ["#DFFF3C", "#3CFFF0", "#FF6B3C", "#B47CFF", "#47B8FF"];

  return (
    <div style={{ padding: "0 20px 110px", opacity: m ? 1 : 0, transition: "opacity .4s" }}>
      <div style={{ padding: "14px 0 18px" }}>
        <div style={{ fontSize: 12, color: C.dim, fontFamily: C.mono, letterSpacing: 1.5, textTransform: "uppercase" }}>Log</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: C.font, marginTop: 2 }}>History</div>
      </div>
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
              <div style={{ fontSize: 11, color: C.dim }}>{((w.total_volume_kg || 0) / 1000).toFixed(1)}k kg</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══ PROFILE MODAL ═══ */
function ProfileModal({ profile, plan, user, onClose, onLogout }) {
  if (!profile || !user) return null;

  const accountAge = Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const planData = PLANS[plan];
  const userName = profile.name || user.user_metadata?.full_name || "Athlete";
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
export default function GymTracker() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [screen, setScreen] = useState("home");
  const [tab, setTab] = useState("home");
  const [tpl, setTpl] = useState(null);
  const [plan, setPlan] = useState("free");
  const [queriesUsed, setQueriesUsed] = useState(0);
  const scrollRef = useRef(null);

  // Auth listener
  useEffect(() => {
    const checkAuth = async () => {
      const session = await getSession();
      if (session?.user) {
        setUser(session.user);
        const prof = await getProfile();
        setProfile(prof);
        if (prof?.plan) setPlan(prof.plan);
      }
      setAuthLoading(false);
    };
    checkAuth();

    // Listen for OAuth redirects and session changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        const prof = await getProfile();
        setProfile(prof);
        if (prof?.plan) setPlan(prof.plan);

        // Seed dummy data for new users
        if (event === 'SIGNED_IN') {
          await seedDummyData();
        }
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    setProfile(null);
    setScreen("home");
  };

  // Show loading or auth screen
  if (authLoading) {
    return (
      <div style={{ width: 390, height: 844, margin: "20px auto", background: C.bg, borderRadius: 44, overflow: "hidden", fontFamily: C.font, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 13, color: C.dim }}>Loading...</div>
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
      }
    };

    return (
      <div style={{ width: 390, height: 844, margin: "20px auto", background: C.bg, borderRadius: 44, overflow: "hidden", fontFamily: C.font, position: "relative", boxShadow: "0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)" }}>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; } ::-webkit-scrollbar { display: none; }`}</style>
        <AuthScreen onSignUp={refreshAuth} onSignIn={refreshAuth} />
      </div>
    );
  }

  const nav = (t) => { setTab(t); setScreen(t); if (scrollRef.current) scrollRef.current.scrollTop = 0; };
  const tabs = [{ id: "home", icon: "⌂", label: "Home" }, { id: "coach", icon: "🧠", label: "Coach" }, { id: "history", icon: "☰", label: "History" }, { id: "stats", icon: "◈", label: "Stats" }];

  return (
    <div style={{ width: 390, height: 844, margin: "20px auto", background: C.bg, borderRadius: 44, overflow: "hidden", fontFamily: C.font, position: "relative", boxShadow: "0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)" }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; } ::-webkit-scrollbar { display: none; } @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }`}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 28px 0", color: "#fff", fontSize: 13, fontWeight: 600 }}>
        <span style={{ fontFamily: C.mono }}>{profile?.full_name || "User"}</span>
        <button
          onClick={() => setProfileModalOpen(true)}
          style={{
            background: "none",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            fontSize: 20,
            fontWeight: 600,
            fontFamily: C.font,
            padding: "4px 8px",
            opacity: 0.8,
            transition: "opacity 0.2s"
          }}
        >
          ⚙️
        </button>
      </div>
      <div ref={scrollRef} style={{ height: "calc(100% - 40px - 72px)", overflowY: screen === "coach" ? "hidden" : "auto", overflowX: "hidden", display: "flex", flexDirection: "column" }}>
        {screen === "home" && <HomeScreen onStart={() => setScreen("pick")} onNav={nav} plan={plan} user={user} profile={profile} />}
        {screen === "pick" && <TemplatePicker onSelect={(t) => { setTpl(t); setScreen("workout"); setTab(null); }} onBack={() => nav("home")} />}
        {screen === "workout" && tpl && <WorkoutScreen template={tpl} onFinish={() => nav("home")} onBack={() => nav("home")} />}
        {screen === "coach" && <AICoachScreen plan={plan} queriesUsed={queriesUsed} onUseQuery={() => setQueriesUsed(q => q + 1)} onShowPricing={() => setScreen("pricing")} />}
        {screen === "pricing" && <PricingScreen currentPlan={plan} onSelect={(p) => { setPlan(p); setQueriesUsed(0); nav("coach"); }} onBack={() => nav("coach")} />}
        {screen === "history" && <HistoryScreen />}
        {screen === "stats" && <StatsScreen />}
      </div>
      {!["workout", "pricing"].includes(screen) && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 72, background: `linear-gradient(to top, ${C.bg} 70%, transparent)`, display: "flex", justifyContent: "space-around", alignItems: "center", paddingBottom: 8 }}>
          {tabs.map(t => (<button key={t.id} onClick={() => nav(t.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: tab === t.id ? (t.id === "coach" ? C.ai : C.accent) : "rgba(255,255,255,0.2)", transition: "color .2s ease", padding: "4px 16px" }}><span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span><span style={{ fontSize: 9, fontWeight: 600, fontFamily: C.mono, letterSpacing: .5 }}>{t.label}</span></button>))}
        </div>
      )}
      <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", width: 134, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />

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
