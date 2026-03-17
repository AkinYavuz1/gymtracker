// ============================================================
// Exercise Animations — SVG puppet figure with joint animations
// ============================================================
// Flat-illustration style: proportional body, tank top, shorts.
// Each exercise animates joint angles via CSS keyframes.
// Zero external dependencies, works offline.
// ============================================================

import { useEffect } from 'react';

// Color palette (matching flat illustration style)
const SKIN = '#B07D62';
const SKIN_SHADOW = '#966A52';
const SHIRT = '#1A1A2E';
const SHORTS = '#FF6B5B';
const SHORTS_SHADOW = '#E55A4B';
const SHOE = '#2D2D3D';
const HAIR = '#2D3A6E';
const METAL = '#8899AA';
const PLATE = '#555566';

// Inject all exercise keyframes once
let injected = false;
function injectKeyframes() {
  if (injected) return;
  injected = true;
  const s = document.createElement('style');
  s.textContent = `
/* === BENCH PRESS === */
@keyframes bp-arms{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(-75deg)}}
/* === SQUAT === */
@keyframes sq-body{0%,100%{transform:translateY(0)}50%{transform:translateY(18px)}}
@keyframes sq-hip{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-80deg)}}
@keyframes sq-knee{0%,100%{transform:rotate(0deg)}50%{transform:rotate(100deg)}}
@keyframes sq-torso{0%,100%{transform:rotate(0deg)}50%{transform:rotate(20deg)}}
/* === DEADLIFT === */
@keyframes dl-torso{0%,100%{transform:rotate(0deg)}50%{transform:rotate(60deg)}}
@keyframes dl-hip{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-30deg)}}
@keyframes dl-knee{0%,100%{transform:rotate(0deg)}50%{transform:rotate(30deg)}}
/* === OVERHEAD PRESS === */
@keyframes ohp-ua{0%,100%{transform:rotate(-170deg)}50%{transform:rotate(-90deg)}}
@keyframes ohp-fa{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-40deg)}}
/* === INCLINE DB PRESS === */
@keyframes idp-ua{0%,100%{transform:rotate(-150deg)}50%{transform:rotate(-70deg)}}
@keyframes idp-fa{0%,100%{transform:rotate(-10deg)}50%{transform:rotate(-50deg)}}
/* === CABLE FLY === */
@keyframes cf-ua{0%,100%{transform:rotate(-85deg)}50%{transform:rotate(-20deg)}}
@keyframes cf-fa{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(-15deg)}}
/* === LATERAL RAISE === */
@keyframes lr-ua{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-80deg)}}
/* === PULL-UPS === */
@keyframes pu-body{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}}
@keyframes pu-ua{0%,100%{transform:rotate(-160deg)}50%{transform:rotate(-130deg)}}
@keyframes pu-fa{0%,100%{transform:rotate(-30deg)}50%{transform:rotate(-70deg)}}
/* === BARBELL ROW === */
@keyframes br-ua{0%,100%{transform:rotate(10deg)}50%{transform:rotate(-60deg)}}
@keyframes br-fa{0%,100%{transform:rotate(-20deg)}50%{transform:rotate(-90deg)}}
/* === FACE PULL === */
@keyframes fp-ua{0%,100%{transform:rotate(-50deg)}50%{transform:rotate(-90deg)}}
@keyframes fp-fa{0%,100%{transform:rotate(-30deg)}50%{transform:rotate(-120deg)}}
/* === HAMMER CURL === */
@keyframes hc-fa{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-130deg)}}
/* === LEG PRESS === */
@keyframes lp-hip{0%,100%{transform:rotate(-90deg)}50%{transform:rotate(-40deg)}}
@keyframes lp-knee{0%,100%{transform:rotate(100deg)}50%{transform:rotate(20deg)}}
/* === ROMANIAN DL === */
@keyframes rdl-torso{0%,100%{transform:rotate(0deg)}50%{transform:rotate(55deg)}}
@keyframes rdl-hip{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-10deg)}}
/* === WALKING LUNGE === */
@keyframes wl-body{0%,100%{transform:translateY(0)}50%{transform:translateY(14px)}}
@keyframes wl-hipF{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-60deg)}}
@keyframes wl-kneeF{0%,100%{transform:rotate(0deg)}50%{transform:rotate(80deg)}}
@keyframes wl-hipB{0%,100%{transform:rotate(0deg)}50%{transform:rotate(30deg)}}
@keyframes wl-kneeB{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-20deg)}}
/* === LEG CURL === */
@keyframes lc-knee{0%,100%{transform:rotate(0deg)}50%{transform:rotate(-120deg)}}
/* === GENERIC === */
@keyframes gen-pulse{0%,100%{opacity:0.5;transform:scale(1)}50%{opacity:1;transform:scale(1.05)}}
  `;
  document.head.appendChild(s);
}

// ─── SVG Body Parts ──────────────────────────────────────────

function Head({ x, y }) {
  return (
    <g>
      {/* Hair */}
      <ellipse cx={x} cy={y - 1} rx={8.5} ry={9} fill={HAIR} />
      {/* Face */}
      <circle cx={x} cy={y} r={8} fill={SKIN} />
      {/* Ear */}
      <ellipse cx={x + 7.5} cy={y + 1} rx={2} ry={3} fill={SKIN_SHADOW} />
    </g>
  );
}

function Torso({ shirt = true }) {
  return (
    <g>
      {/* Neck */}
      <rect x={-3} y={0} width={6} height={6} rx={2} fill={SKIN} />
      {/* Body shape — wider at shoulders, narrower at waist */}
      <path d="M-14,6 Q-15,4 -13,2 L13,2 Q15,4 14,6 L14,34 Q14,36 12,36 L-12,36 Q-14,36 -14,34 Z"
        fill={shirt ? SHIRT : SKIN} />
      {shirt && <>
        {/* Tank top neckline */}
        <path d="M-6,2 Q0,8 6,2" fill="none" stroke={SKIN} strokeWidth={2.5} />
        {/* Arm holes showing skin */}
        <ellipse cx={-13} cy={8} rx={4} ry={6} fill={SKIN} />
        <ellipse cx={13} cy={8} rx={4} ry={6} fill={SKIN} />
      </>}
    </g>
  );
}

function Shorts() {
  return (
    <g>
      <path d="M-12,0 L12,0 L12,4 Q12,6 10,6 L5,6 L4,18 Q4,20 2,20 L-2,20 Q-4,20 -4,18 L-5,6 L-10,6 Q-12,6 -12,4 Z"
        fill={SHORTS} />
      {/* Right leg of shorts */}
      <path d="M5,6 L12,6 L11,18 Q11,20 9,20 L5,20 Q3,20 4,18 Z"
        fill={SHORTS_SHADOW} />
    </g>
  );
}

function UpperArm() {
  return <rect x={-4} y={0} width={8} height={20} rx={4} fill={SKIN} />;
}

function Forearm() {
  return (
    <g>
      <rect x={-3.5} y={0} width={7} height={18} rx={3.5} fill={SKIN} />
      {/* Hand */}
      <circle cx={0} cy={19} r={4} fill={SKIN_SHADOW} />
    </g>
  );
}

function UpperLeg() {
  return <rect x={-5} y={0} width={10} height={24} rx={5} fill={SKIN} />;
}

function LowerLeg() {
  return (
    <g>
      <rect x={-4.5} y={0} width={9} height={22} rx={4.5} fill={SKIN_SHADOW} />
      {/* Shoe */}
      <path d="M-5,19 Q-5,24 0,24 L6,24 Q10,24 10,21 L10,19 Q10,17 5,17 L-1,17 Q-5,17 -5,19Z"
        fill={SHOE} />
    </g>
  );
}

function Barbell({ width = 60, y = 0 }) {
  return (
    <g transform={`translate(0,${y})`}>
      <rect x={-width / 2} y={-2} width={width} height={4} rx={2} fill={METAL} />
      {/* Left plate */}
      <rect x={-width / 2 - 3} y={-8} width={6} height={16} rx={2} fill={PLATE} />
      {/* Right plate */}
      <rect x={width / 2 - 3} y={-8} width={6} height={16} rx={2} fill={PLATE} />
    </g>
  );
}

function Dumbbell({ x = 0, y = 0, vertical = false }) {
  const r = vertical ? 90 : 0;
  return (
    <g transform={`translate(${x},${y}) rotate(${r})`}>
      <rect x={-8} y={-2} width={16} height={4} rx={1.5} fill={METAL} />
      <rect x={-11} y={-4} width={5} height={8} rx={1.5} fill={PLATE} />
      <rect x={6} y={-4} width={5} height={8} rx={1.5} fill={PLATE} />
    </g>
  );
}

// ─── Standing Figure (reusable base) ─────────────────────────
// Joint hierarchy: body → torso → shoulder → upperArm → forearm
//                  body → hip → upperLeg → lowerLeg

function Figure({
  bodyTransform = '',
  torsoAngle = 0,
  lShoulderAnim, rShoulderAnim,
  lElbowAnim, rElbowAnim,
  lHipAnim, rHipAnim,
  lKneeAnim, rKneeAnim,
  duration = '2s',
  equipment,
  flip = false,
}) {
  const ease = `${duration} ease-in-out infinite`;
  const mkAnim = (name) => name ? `${name} ${ease}` : 'none';

  return (
    <g transform={`${flip ? 'scale(-1,1)' : ''} ${bodyTransform}`}>
      {/* === LEGS (behind torso) === */}
      {/* Left leg */}
      <g transform="translate(-7, 78)" style={{ animation: mkAnim(lHipAnim), transformOrigin: '0px 0px' }}>
        <UpperLeg />
        <g transform="translate(0, 22)" style={{ animation: mkAnim(lKneeAnim), transformOrigin: '0px 0px' }}>
          <LowerLeg />
        </g>
      </g>
      {/* Right leg */}
      <g transform="translate(7, 78)" style={{ animation: mkAnim(rHipAnim), transformOrigin: '0px 0px' }}>
        <UpperLeg />
        <g transform="translate(0, 22)" style={{ animation: mkAnim(rKneeAnim), transformOrigin: '0px 0px' }}>
          <LowerLeg />
        </g>
      </g>

      {/* === TORSO === */}
      <g transform="translate(0, 42)" style={{ animation: torsoAngle ? undefined : 'none', transformOrigin: '0px 36px' }}>
        {typeof torsoAngle === 'string'
          ? <g style={{ animation: `${torsoAngle} ${ease}`, transformOrigin: '0px 36px' }}><Torso /></g>
          : <g transform={`rotate(${torsoAngle})`} style={{ transformOrigin: '0px 36px' }}><Torso /></g>
        }

        {/* Shorts */}
        <g transform={typeof torsoAngle === 'string' ? '' : `translate(0, 36)`}>
          {typeof torsoAngle === 'string'
            ? <g style={{ animation: `${torsoAngle} ${ease}`, transformOrigin: '0px 0px' }}><g transform="translate(0,36)"><Shorts /></g></g>
            : <Shorts />
          }
        </g>

        {/* Head */}
        {typeof torsoAngle === 'string'
          ? <g style={{ animation: `${torsoAngle} ${ease}`, transformOrigin: '0px 36px' }}><Head x={0} y={-10} /></g>
          : <g transform={`rotate(${torsoAngle})`} style={{ transformOrigin: '0px 36px' }}><Head x={0} y={-10} /></g>
        }

        {/* Left arm */}
        <g transform={typeof torsoAngle === 'string' ? '' : `rotate(${torsoAngle})`}
           style={typeof torsoAngle === 'string' ? { animation: `${torsoAngle} ${ease}`, transformOrigin: '0px 36px' } : { transformOrigin: '0px 36px' }}>
          <g transform="translate(-14, 6)" style={{ animation: mkAnim(lShoulderAnim), transformOrigin: '0px 0px' }}>
            <UpperArm />
            <g transform="translate(0, 18)" style={{ animation: mkAnim(lElbowAnim), transformOrigin: '0px 0px' }}>
              <Forearm />
            </g>
          </g>
        </g>

        {/* Right arm */}
        <g transform={typeof torsoAngle === 'string' ? '' : `rotate(${torsoAngle})`}
           style={typeof torsoAngle === 'string' ? { animation: `${torsoAngle} ${ease}`, transformOrigin: '0px 36px' } : { transformOrigin: '0px 36px' }}>
          <g transform="translate(14, 6)" style={{ animation: mkAnim(rShoulderAnim), transformOrigin: '0px 0px' }}>
            <UpperArm />
            <g transform="translate(0, 18)" style={{ animation: mkAnim(rElbowAnim), transformOrigin: '0px 0px' }}>
              <Forearm />
            </g>
          </g>
        </g>
      </g>

      {/* Equipment layer */}
      {equipment}
    </g>
  );
}

// ─── Exercise Components ─────────────────────────────────────

function BenchPressAnim() {
  return (
    <svg viewBox="-60 -10 120 80" style={{ width: '100%', height: '100%' }}>
      {/* Bench */}
      <rect x={-25} y={30} width={50} height={6} rx={3} fill="#444455" />
      <rect x={-20} y={36} width={4} height={12} rx={1} fill="#333344" />
      <rect x={16} y={36} width={4} height={12} rx={1} fill="#333344" />
      {/* Person lying on bench — simplified side view */}
      <g transform="translate(0, 12)">
        {/* Legs hanging off bench */}
        <g transform="translate(22, 16) rotate(-50)" style={{ transformOrigin: '0 0' }}>
          <rect x={-4} y={0} width={8} height={18} rx={4} fill={SKIN} />
          <g transform="translate(0, 16) rotate(70)" style={{ transformOrigin: '0 0' }}>
            <rect x={-3.5} y={0} width={7} height={16} rx={3.5} fill={SKIN_SHADOW} />
            <path d="M-4,13 Q-4,18 1,18 L5,18 Q8,18 8,15 L8,13 Q8,12 4,12 L0,12 Q-4,12 -4,13Z" fill={SHOE} />
          </g>
        </g>
        {/* Torso on bench */}
        <rect x={-14} y={12} width={28} height={16} rx={6} fill={SHIRT} />
        {/* Head */}
        <g transform="translate(-18, 14)">
          <ellipse cx={0} cy={0} rx={7} ry={7} fill={SKIN} />
          <ellipse cx={-2} cy={-2} rx={7.5} ry={7} fill={HAIR} />
        </g>
        {/* Arms + bar animated */}
        <g style={{ animation: 'bp-arms 2s ease-in-out infinite', transformOrigin: '-8px 12px' }}>
          <rect x={-12} y={8} width={7} height={16} rx={3.5} fill={SKIN} />
          <rect x={5} y={8} width={7} height={16} rx={3.5} fill={SKIN} />
          {/* Forearms */}
          <rect x={-10} y={-4} width={6} height={14} rx={3} fill={SKIN_SHADOW} />
          <rect x={4} y={-4} width={6} height={14} rx={3} fill={SKIN_SHADOW} />
          {/* Bar */}
          <Barbell width={54} y={-5} />
        </g>
      </g>
    </svg>
  );
}

function SquatAnim() {
  return (
    <svg viewBox="-50 -20 100 145" style={{ width: '100%', height: '100%' }}>
      <g style={{ animation: 'sq-body 2.2s ease-in-out infinite', transformOrigin: '0px 60px' }}>
        {/* Legs */}
        <g transform="translate(-7, 78)" style={{ animation: 'sq-hip 2.2s ease-in-out infinite', transformOrigin: '0 0' }}>
          <UpperLeg />
          <g transform="translate(0, 22)" style={{ animation: 'sq-knee 2.2s ease-in-out infinite', transformOrigin: '0 0' }}>
            <LowerLeg />
          </g>
        </g>
        <g transform="translate(7, 78)" style={{ animation: 'sq-hip 2.2s ease-in-out infinite', transformOrigin: '0 0' }}>
          <UpperLeg />
          <g transform="translate(0, 22)" style={{ animation: 'sq-knee 2.2s ease-in-out infinite', transformOrigin: '0 0' }}>
            <LowerLeg />
          </g>
        </g>
        {/* Torso tilts forward slightly */}
        <g transform="translate(0, 42)" style={{ animation: 'sq-torso 2.2s ease-in-out infinite', transformOrigin: '0px 36px' }}>
          <Torso />
          <Head x={0} y={-10} />
          {/* Arms holding bar */}
          <g transform="translate(-14, 6) rotate(-60)" style={{ transformOrigin: '0 0' }}><UpperArm /><g transform="translate(0,18) rotate(-30)"><Forearm /></g></g>
          <g transform="translate(14, 6) rotate(-60)" style={{ transformOrigin: '0 0' }}><UpperArm /><g transform="translate(0,18) rotate(-30)"><Forearm /></g></g>
          {/* Barbell on shoulders */}
          <Barbell width={56} y={-4} />
        </g>
      </g>
      <rect x={-35} y={120} width={70} height={3} rx={1.5} fill="rgba(255,255,255,0.06)" />
    </svg>
  );
}

function DeadliftAnim() {
  return (
    <svg viewBox="-50 -20 100 145" style={{ width: '100%', height: '100%' }}>
      {/* Legs */}
      <g transform="translate(-7, 78)" style={{ animation: 'dl-hip 2.4s ease-in-out infinite', transformOrigin: '0 0' }}>
        <UpperLeg />
        <g transform="translate(0, 22)" style={{ animation: 'dl-knee 2.4s ease-in-out infinite', transformOrigin: '0 0' }}>
          <LowerLeg />
        </g>
      </g>
      <g transform="translate(7, 78)" style={{ animation: 'dl-hip 2.4s ease-in-out infinite', transformOrigin: '0 0' }}>
        <UpperLeg />
        <g transform="translate(0, 22)" style={{ animation: 'dl-knee 2.4s ease-in-out infinite', transformOrigin: '0 0' }}>
          <LowerLeg />
        </g>
      </g>
      {/* Torso hinges at hip */}
      <g transform="translate(0, 42)" style={{ animation: 'dl-torso 2.4s ease-in-out infinite', transformOrigin: '0px 36px' }}>
        <Torso />
        <Head x={0} y={-10} />
        {/* Arms hanging straight with bar */}
        <g transform="translate(-14, 6) rotate(10)" style={{ transformOrigin: '0 0' }}>
          <UpperArm />
          <g transform="translate(0,18)"><Forearm /></g>
        </g>
        <g transform="translate(14, 6) rotate(-10)" style={{ transformOrigin: '0 0' }}>
          <UpperArm />
          <g transform="translate(0,18)"><Forearm /></g>
        </g>
        <Barbell width={52} y={48} />
      </g>
      <rect x={-35} y={120} width={70} height={3} rx={1.5} fill="rgba(255,255,255,0.06)" />
    </svg>
  );
}

function OHPAnim() {
  return (
    <svg viewBox="-50 -30 100 155" style={{ width: '100%', height: '100%' }}>
      {/* Static legs */}
      <g transform="translate(-7, 78)"><UpperLeg /><g transform="translate(0, 22)"><LowerLeg /></g></g>
      <g transform="translate(7, 78)"><UpperLeg /><g transform="translate(0, 22)"><LowerLeg /></g></g>
      {/* Torso */}
      <g transform="translate(0, 42)">
        <Torso />
        <Head x={0} y={-10} />
        <g transform="translate(0, 36)"><Shorts /></g>
        {/* Left arm pressing */}
        <g transform="translate(-14, 6)" style={{ animation: 'ohp-ua 2s ease-in-out infinite', transformOrigin: '0 0' }}>
          <UpperArm />
          <g transform="translate(0,18)" style={{ animation: 'ohp-fa 2s ease-in-out infinite', transformOrigin: '0 0' }}>
            <Forearm />
          </g>
        </g>
        {/* Right arm pressing */}
        <g transform="translate(14, 6)" style={{ animation: 'ohp-ua 2s ease-in-out infinite', transformOrigin: '0 0' }}>
          <UpperArm />
          <g transform="translate(0,18)" style={{ animation: 'ohp-fa 2s ease-in-out infinite', transformOrigin: '0 0' }}>
            <Forearm />
          </g>
        </g>
        {/* Barbell — follows hands (approximate by animating with arms) */}
        <g style={{ animation: 'ohp-ua 2s ease-in-out infinite', transformOrigin: '-14px 6px' }}>
          <Barbell width={50} y={-14} />
        </g>
      </g>
      <rect x={-35} y={120} width={70} height={3} rx={1.5} fill="rgba(255,255,255,0.06)" />
    </svg>
  );
}

function InclineDBPressAnim() {
  return (
    <svg viewBox="-50 -30 100 155" style={{ width: '100%', height: '100%' }}>
      {/* Incline bench */}
      <g transform="translate(0, 50)">
        <rect x={-12} y={10} width={24} height={50} rx={4} fill="#444455" transform="rotate(-25)" />
        <rect x={-6} y={50} width={12} height={8} rx={2} fill="#333344" />
      </g>
      {/* Static legs */}
      <g transform="translate(-7, 85) rotate(-15)" style={{ transformOrigin: '0 0' }}><UpperLeg /><g transform="translate(0, 22)"><LowerLeg /></g></g>
      <g transform="translate(7, 85) rotate(-15)" style={{ transformOrigin: '0 0' }}><UpperLeg /><g transform="translate(0, 22)"><LowerLeg /></g></g>
      {/* Torso on incline */}
      <g transform="translate(-3, 40) rotate(-25)" style={{ transformOrigin: '0 36px' }}>
        <Torso />
        <Head x={0} y={-10} />
        {/* Arms pressing dumbbells */}
        <g transform="translate(-14, 6)" style={{ animation: 'idp-ua 2s ease-in-out infinite', transformOrigin: '0 0' }}>
          <UpperArm />
          <g transform="translate(0,18)" style={{ animation: 'idp-fa 2s ease-in-out infinite', transformOrigin: '0 0' }}>
            <Forearm />
            <Dumbbell x={0} y={22} />
          </g>
        </g>
        <g transform="translate(14, 6)" style={{ animation: 'idp-ua 2s ease-in-out infinite', transformOrigin: '0 0' }}>
          <UpperArm />
          <g transform="translate(0,18)" style={{ animation: 'idp-fa 2s ease-in-out infinite', transformOrigin: '0 0' }}>
            <Forearm />
            <Dumbbell x={0} y={22} />
          </g>
        </g>
      </g>
    </svg>
  );
}

function CableFlyAnim() {
  return (
    <svg viewBox="-50 -20 100 145" style={{ width: '100%', height: '100%' }}>
      {/* Cable lines */}
      <line x1={-45} y1={-15} x2={-14} y2={48} stroke={METAL} strokeWidth={1} strokeDasharray="3,2" opacity={0.4} />
      <line x1={45} y1={-15} x2={14} y2={48} stroke={METAL} strokeWidth={1} strokeDasharray="3,2" opacity={0.4} />
      {/* Static legs */}
      <g transform="translate(-7, 78)"><UpperLeg /><g transform="translate(0, 22)"><LowerLeg /></g></g>
      <g transform="translate(7, 78)"><UpperLeg /><g transform="translate(0, 22)"><LowerLeg /></g></g>
      <g transform="translate(0, 42)">
        <Torso />
        <Head x={0} y={-10} />
        <g transform="translate(0, 36)"><Shorts /></g>
        {/* Left arm fly */}
        <g transform="translate(-14, 6)" style={{ animation: 'cf-ua 2.2s ease-in-out infinite', transformOrigin: '0 0' }}>
          <UpperArm />
          <g transform="translate(0,18)" style={{ animation: 'cf-fa 2.2s ease-in-out infinite', transformOrigin: '0 0' }}>
            <Forearm />
          </g>
        </g>
        {/* Right arm — mirror */}
        <g transform="translate(14, 6) scale(-1,1)" style={{ animation: 'cf-ua 2.2s ease-in-out infinite', transformOrigin: '0 0' }}>
          <UpperArm />
          <g transform="translate(0,18)" style={{ animation: 'cf-fa 2.2s ease-in-out infinite', transformOrigin: '0 0' }}>
            <Forearm />
          </g>
        </g>
      </g>
      <rect x={-35} y={120} width={70} height={3} rx={1.5} fill="rgba(255,255,255,0.06)" />
    </svg>
  );
}

function LateralRaiseAnim() {
  return (
    <svg viewBox="-55 -20 110 145" style={{ width: '100%', height: '100%' }}>
      <g transform="translate(-7, 78)"><UpperLeg /><g transform="translate(0, 22)"><LowerLeg /></g></g>
      <g transform="translate(7, 78)"><UpperLeg /><g transform="translate(0, 22)"><LowerLeg /></g></g>
      <g transform="translate(0, 42)">
        <Torso />
        <Head x={0} y={-10} />
        <g transform="translate(0, 36)"><Shorts /></g>
        {/* Left arm raising with dumbbell */}
        <g transform="translate(-14, 6)" style={{ animation: 'lr-ua 1.8s ease-in-out infinite', transformOrigin: '0 0' }}>
          <UpperArm />
          <g transform="translate(0,18)">
            <Forearm />
            <Dumbbell x={0} y={22} vertical />
          </g>
        </g>
        {/* Right arm — mirror */}
        <g transform="translate(14, 6) scale(-1,1)" style={{ animation: 'lr-ua 1.8s ease-in-out infinite', transformOrigin: '0 0' }}>
          <UpperArm />
          <g transform="translate(0,18)">
            <Forearm />
            <Dumbbell x={0} y={22} vertical />
          </g>
        </g>
      </g>
      <rect x={-40} y={120} width={80} height={3} rx={1.5} fill="rgba(255,255,255,0.06)" />
    </svg>
  );
}

function PullupsAnim() {
  return (
    <svg viewBox="-45 -15 90 140" style={{ width: '100%', height: '100%' }}>
      {/* Pull-up bar */}
      <rect x={-40} y={-10} width={80} height={5} rx={2.5} fill={METAL} />
      <rect x={-38} y={-5} width={4} height={8} rx={1} fill="#444455" />
      <rect x={34} y={-5} width={4} height={8} rx={1} fill="#444455" />
      <g style={{ animation: 'pu-body 2.2s ease-in-out infinite', transformOrigin: '0 0' }}>
        {/* Legs hanging */}
        <g transform="translate(-7, 78)"><UpperLeg /><g transform="translate(0, 22)"><LowerLeg /></g></g>
        <g transform="translate(7, 78)"><UpperLeg /><g transform="translate(0, 22)"><LowerLeg /></g></g>
        <g transform="translate(0, 42)">
          <Torso />
          <Head x={0} y={-10} />
          <g transform="translate(0, 36)"><Shorts /></g>
          {/* Arms reaching up */}
          <g transform="translate(-14, 6)" style={{ animation: 'pu-ua 2.2s ease-in-out infinite', transformOrigin: '0 0' }}>
            <UpperArm />
            <g transform="translate(0,18)" style={{ animation: 'pu-fa 2.2s ease-in-out infinite', transformOrigin: '0 0' }}>
              <Forearm />
            </g>
          </g>
          <g transform="translate(14, 6)" style={{ animation: 'pu-ua 2.2s ease-in-out infinite', transformOrigin: '0 0' }}>
            <UpperArm />
            <g transform="translate(0,18)" style={{ animation: 'pu-fa 2.2s ease-in-out infinite', transformOrigin: '0 0' }}>
              <Forearm />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

function BarbellRowAnim() {
  return (
    <svg viewBox="-50 -10 100 135" style={{ width: '100%', height: '100%' }}>
      {/* Legs — slightly bent */}
      <g transform="translate(-7, 78) rotate(-15)" style={{ transformOrigin: '0 0' }}>
        <UpperLeg />
        <g transform="translate(0, 22) rotate(15)" style={{ transformOrigin: '0 0' }}><LowerLeg /></g>
      </g>
      <g transform="translate(7, 78) rotate(-15)" style={{ transformOrigin: '0 0' }}>
        <UpperLeg />
        <g transform="translate(0, 22) rotate(15)" style={{ transformOrigin: '0 0' }}><LowerLeg /></g>
      </g>
      {/* Torso bent forward ~50deg */}
      <g transform="translate(0, 42) rotate(50)" style={{ transformOrigin: '0px 36px' }}>
        <Torso />
        <Head x={0} y={-10} />
        {/* Arms rowing */}
        <g transform="translate(-14, 6)" style={{ animation: 'br-ua 1.8s ease-in-out infinite', transformOrigin: '0 0' }}>
          <UpperArm />
          <g transform="translate(0,18)" style={{ animation: 'br-fa 1.8s ease-in-out infinite', transformOrigin: '0 0' }}>
            <Forearm />
          </g>
        </g>
        <g transform="translate(14, 6)" style={{ animation: 'br-ua 1.8s ease-in-out infinite', transformOrigin: '0 0' }}>
          <UpperArm />
          <g transform="translate(0,18)" style={{ animation: 'br-fa 1.8s ease-in-out infinite', transformOrigin: '0 0' }}>
            <Forearm />
          </g>
        </g>
        <Barbell width={48} y={46} />
      </g>
      <rect x={-35} y={120} width={70} height={3} rx={1.5} fill="rgba(255,255,255,0.06)" />
    </svg>
  );
}

function FacePullAnim() {
  return (
    <svg viewBox="-50 -20 100 145" style={{ width: '100%', height: '100%' }}>
      {/* Cable anchor */}
      <rect x={38} y={20} width={6} height={50} rx={2} fill="#444455" />
      <line x1={40} y1={45} x2={14} y2={48} stroke={METAL} strokeWidth={1.5} strokeDasharray="3,2" opacity={0.5} />
      <g transform="translate(-7, 78)"><UpperLeg /><g transform="translate(0, 22)"><LowerLeg /></g></g>
      <g transform="translate(7, 78)"><UpperLeg /><g transform="translate(0, 22)"><LowerLeg /></g></g>
      <g transform="translate(0, 42)">
        <Torso />
        <Head x={0} y={-10} />
        <g transform="translate(0, 36)"><Shorts /></g>
        <g transform="translate(-14, 6)" style={{ animation: 'fp-ua 1.8s ease-in-out infinite', transformOrigin: '0 0' }}>
          <UpperArm />
          <g transform="translate(0,18)" style={{ animation: 'fp-fa 1.8s ease-in-out infinite', transformOrigin: '0 0' }}>
            <Forearm />
          </g>
        </g>
        <g transform="translate(14, 6)" style={{ animation: 'fp-ua 1.8s ease-in-out infinite', transformOrigin: '0 0' }}>
          <UpperArm />
          <g transform="translate(0,18)" style={{ animation: 'fp-fa 1.8s ease-in-out infinite', transformOrigin: '0 0' }}>
            <Forearm />
          </g>
        </g>
      </g>
      <rect x={-35} y={120} width={70} height={3} rx={1.5} fill="rgba(255,255,255,0.06)" />
    </svg>
  );
}

function HammerCurlAnim() {
  return (
    <svg viewBox="-50 -20 100 145" style={{ width: '100%', height: '100%' }}>
      <g transform="translate(-7, 78)"><UpperLeg /><g transform="translate(0, 22)"><LowerLeg /></g></g>
      <g transform="translate(7, 78)"><UpperLeg /><g transform="translate(0, 22)"><LowerLeg /></g></g>
      <g transform="translate(0, 42)">
        <Torso />
        <Head x={0} y={-10} />
        <g transform="translate(0, 36)"><Shorts /></g>
        {/* Left arm curling */}
        <g transform="translate(-14, 6)">
          <UpperArm />
          <g transform="translate(0,18)" style={{ animation: 'hc-fa 1.6s ease-in-out infinite', transformOrigin: '0 0' }}>
            <Forearm />
            <Dumbbell x={0} y={20} vertical />
          </g>
        </g>
        {/* Right arm — delayed */}
        <g transform="translate(14, 6)">
          <UpperArm />
          <g transform="translate(0,18)" style={{ animation: 'hc-fa 1.6s ease-in-out infinite 0.8s', transformOrigin: '0 0' }}>
            <Forearm />
            <Dumbbell x={0} y={20} vertical />
          </g>
        </g>
      </g>
      <rect x={-35} y={120} width={70} height={3} rx={1.5} fill="rgba(255,255,255,0.06)" />
    </svg>
  );
}

function LegPressAnim() {
  return (
    <svg viewBox="-50 -10 100 110" style={{ width: '100%', height: '100%' }}>
      {/* Machine frame */}
      <rect x={15} y={0} width={4} height={90} rx={2} fill="#444455" />
      <rect x={-35} y={65} width={55} height={5} rx={2} fill="#444455" />
      {/* Sled */}
      <rect x={12} y={20} width={20} height={4} rx={2} fill={METAL}
        style={{ animation: 'lp-knee 2s ease-in-out infinite', transformOrigin: '22px 22px' }} />
      {/* Torso reclined */}
      <g transform="translate(-20, 20) rotate(-40)" style={{ transformOrigin: '0 36px' }}>
        <Torso />
        <Head x={0} y={-10} />
      </g>
      {/* Legs pressing */}
      <g transform="translate(-5, 55)" style={{ animation: 'lp-hip 2s ease-in-out infinite', transformOrigin: '0 0' }}>
        <UpperLeg />
        <g transform="translate(0, 22)" style={{ animation: 'lp-knee 2s ease-in-out infinite', transformOrigin: '0 0' }}>
          <LowerLeg />
        </g>
      </g>
      <g transform="translate(5, 55)" style={{ animation: 'lp-hip 2s ease-in-out infinite', transformOrigin: '0 0' }}>
        <UpperLeg />
        <g transform="translate(0, 22)" style={{ animation: 'lp-knee 2s ease-in-out infinite', transformOrigin: '0 0' }}>
          <LowerLeg />
        </g>
      </g>
    </svg>
  );
}

function RomanianDLAnim() {
  return (
    <svg viewBox="-50 -20 100 145" style={{ width: '100%', height: '100%' }}>
      {/* Legs — mostly straight */}
      <g transform="translate(-7, 78)" style={{ animation: 'rdl-hip 2.4s ease-in-out infinite', transformOrigin: '0 0' }}>
        <UpperLeg />
        <g transform="translate(0, 22)"><LowerLeg /></g>
      </g>
      <g transform="translate(7, 78)" style={{ animation: 'rdl-hip 2.4s ease-in-out infinite', transformOrigin: '0 0' }}>
        <UpperLeg />
        <g transform="translate(0, 22)"><LowerLeg /></g>
      </g>
      {/* Torso hinging */}
      <g transform="translate(0, 42)" style={{ animation: 'rdl-torso 2.4s ease-in-out infinite', transformOrigin: '0px 36px' }}>
        <Torso />
        <Head x={0} y={-10} />
        <g transform="translate(-14, 6) rotate(10)" style={{ transformOrigin: '0 0' }}>
          <UpperArm />
          <g transform="translate(0,18)"><Forearm /></g>
        </g>
        <g transform="translate(14, 6) rotate(-10)" style={{ transformOrigin: '0 0' }}>
          <UpperArm />
          <g transform="translate(0,18)"><Forearm /></g>
        </g>
        <Barbell width={48} y={48} />
      </g>
      <rect x={-35} y={120} width={70} height={3} rx={1.5} fill="rgba(255,255,255,0.06)" />
    </svg>
  );
}

function WalkingLungeAnim() {
  return (
    <svg viewBox="-50 -20 100 145" style={{ width: '100%', height: '100%' }}>
      <g style={{ animation: 'wl-body 2.2s ease-in-out infinite', transformOrigin: '0 80px' }}>
        {/* Front leg */}
        <g transform="translate(-5, 78)" style={{ animation: 'wl-hipF 2.2s ease-in-out infinite', transformOrigin: '0 0' }}>
          <UpperLeg />
          <g transform="translate(0, 22)" style={{ animation: 'wl-kneeF 2.2s ease-in-out infinite', transformOrigin: '0 0' }}>
            <LowerLeg />
          </g>
        </g>
        {/* Back leg */}
        <g transform="translate(5, 78)" style={{ animation: 'wl-hipB 2.2s ease-in-out infinite', transformOrigin: '0 0' }}>
          <UpperLeg />
          <g transform="translate(0, 22)" style={{ animation: 'wl-kneeB 2.2s ease-in-out infinite', transformOrigin: '0 0' }}>
            <LowerLeg />
          </g>
        </g>
        <g transform="translate(0, 42)">
          <Torso />
          <Head x={0} y={-10} />
          <g transform="translate(0, 36)"><Shorts /></g>
          {/* Arms holding dumbbells at sides */}
          <g transform="translate(-14, 6)">
            <UpperArm />
            <g transform="translate(0,18)"><Forearm /><Dumbbell x={0} y={22} vertical /></g>
          </g>
          <g transform="translate(14, 6)">
            <UpperArm />
            <g transform="translate(0,18)"><Forearm /><Dumbbell x={0} y={22} vertical /></g>
          </g>
        </g>
      </g>
      <rect x={-35} y={120} width={70} height={3} rx={1.5} fill="rgba(255,255,255,0.06)" />
    </svg>
  );
}

function LegCurlAnim() {
  return (
    <svg viewBox="-50 0 100 70" style={{ width: '100%', height: '100%' }}>
      {/* Bench */}
      <rect x={-40} y={25} width={80} height={6} rx={3} fill="#444455" />
      {/* Person lying face down */}
      <g transform="translate(-25, 8) rotate(-5)">
        <ellipse cx={0} cy={6} rx={7} ry={7} fill={SKIN} />
        <ellipse cx={-1} cy={4} rx={7.5} ry={7} fill={HAIR} />
      </g>
      {/* Body on bench */}
      <rect x={-18} y={14} width={30} height={14} rx={5} fill={SHIRT} />
      {/* Shorts */}
      <rect x={10} y={14} width={14} height={14} rx={4} fill={SHORTS} />
      {/* Arms hanging */}
      <g transform="translate(-22, 20) rotate(30)" style={{ transformOrigin: '0 0' }}>
        <rect x={-3} y={0} width={6} height={14} rx={3} fill={SKIN} />
      </g>
      {/* Upper legs on bench */}
      <rect x={20} y={17} width={18} height={10} rx={5} fill={SKIN} />
      {/* Lower legs curling */}
      <g transform="translate(36, 18)" style={{ animation: 'lc-knee 1.8s ease-in-out infinite', transformOrigin: '0 4px' }}>
        <rect x={-4} y={0} width={8} height={20} rx={4} fill={SKIN_SHADOW} />
        <rect x={-4} y={0} width={8} height={20} rx={4} fill={SKIN_SHADOW} />
        {/* Pad */}
        <rect x={-6} y={16} width={12} height={5} rx={2} fill={METAL} />
      </g>
    </svg>
  );
}

function GenericAnim({ color }) {
  return (
    <svg viewBox="-40 -20 80 60" style={{ width: '100%', height: '100%' }}>
      <g style={{ animation: 'gen-pulse 2s ease-in-out infinite', transformOrigin: '0 0' }}>
        <text x={0} y={10} textAnchor="middle" fontSize={28}>🏋️</text>
        <text x={0} y={30} textAnchor="middle" fontSize={7} fill={`${color}80`}
          fontFamily="monospace" letterSpacing={1.5}>EXERCISE</text>
      </g>
    </svg>
  );
}

// ─── Lookup & Export ─────────────────────────────────────────

const ANIMATION_MAP = {
  'bench press':      BenchPressAnim,
  'back squat':       SquatAnim,
  'deadlift':         DeadliftAnim,
  'overhead press':   OHPAnim,
  'incline db press': InclineDBPressAnim,
  'cable fly':        CableFlyAnim,
  'lateral raise':    LateralRaiseAnim,
  'pull-ups':         PullupsAnim,
  'barbell row':      BarbellRowAnim,
  'face pull':        FacePullAnim,
  'hammer curl':      HammerCurlAnim,
  'leg press':        LegPressAnim,
  'romanian dl':      RomanianDLAnim,
  'walking lunge':    WalkingLungeAnim,
  'leg curl':         LegCurlAnim,
};

export default function ExerciseAnimation({ name, color = '#DFFF3C', height = 100 }) {
  useEffect(() => { injectKeyframes(); }, []);

  const key = name.toLowerCase().trim();
  const Comp = ANIMATION_MAP[key] || GenericAnim;

  return (
    <div style={{
      width: '100%', height,
      borderRadius: 14,
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Comp color={color} />
    </div>
  );
}

export function hasAnimation(name) {
  return name.toLowerCase().trim() in ANIMATION_MAP;
}
