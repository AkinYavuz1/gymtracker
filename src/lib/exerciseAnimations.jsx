// ============================================================
// Exercise Animations — Video/GIF player
// ============================================================
// Place media files in public/exercises/ named per EXERCISE_FILES map.
// Change VIDEO_EXT to 'webm' or 'gif' if using those formats.
// ============================================================

const VIDEO_EXT = 'mp4';

const EXERCISE_FILES = {
  'bench press':      'bench-press',
  'back squat':       'back-squat',
  'deadlift':         'deadlift',
  'overhead press':   'overhead-press',
  'incline db press': 'incline-db-press',
  'cable fly':        'cable-fly',
  'lateral raise':    'lateral-raise',
  'pull-ups':         'pull-ups',
  'barbell row':      'barbell-row',
  'face pull':        'face-pull',
  'hammer curl':      'hammer-curl',
  'leg press':        'leg-press',
  'romanian dl':      'romanian-dl',
  'walking lunge':    'lunge',
  'leg curl':         'leg-curl',
};

export function hasAnimation(name) {
  return !!(name && EXERCISE_FILES[name.toLowerCase()]);
}

export default function ExerciseAnimation({ name, color, height = 100 }) {
  const key = name?.toLowerCase();
  const slug = EXERCISE_FILES[key];

  if (!slug) {
    return (
      <div style={{ width: '100%', height, borderRadius: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
        🏋️
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height, borderRadius: 14, overflow: 'hidden', background: '#0E0F14' }}>
      <video
        src={`/exercises/${slug}.${VIDEO_EXT}`}
        autoPlay
        loop
        muted
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
}
