-- ============================================================
-- MIGRATION: Program Features
-- ============================================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Safe to run on existing databases — uses IF NOT EXISTS where possible
-- ============================================================


-- ─── STEP 1: Add new profile columns ─────────────────────────

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_rate TEXT CHECK (target_rate IN ('slow','moderate','aggressive'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS years_lifting INTEGER CHECK (years_lifting BETWEEN 0 AND 50);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS training_frequency INTEGER CHECK (training_frequency BETWEEN 0 AND 7);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS focus_areas TEXT[] DEFAULT '{}';

-- Update training_goal constraint to accept new goal values
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_training_goal_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_training_goal_check
  CHECK (training_goal IN ('hypertrophy','strength','endurance','general',
                           'fat_loss','muscle_gain','maintenance','performance'));


-- ─── STEP 2: Create program tables ───────────────────────────

CREATE TABLE IF NOT EXISTS public.programs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    description     TEXT,
    split_type      TEXT NOT NULL CHECK (split_type IN ('ppl','upper_lower','full_body','bro_split')),
    days_per_week   INTEGER NOT NULL CHECK (days_per_week BETWEEN 2 AND 7),
    duration_weeks  INTEGER NOT NULL DEFAULT 5,
    goal            TEXT NOT NULL CHECK (goal IN ('hypertrophy','strength','endurance','general')),
    experience_min  TEXT NOT NULL DEFAULT 'beginner',
    color           TEXT DEFAULT '#DFFF3C',
    icon            TEXT DEFAULT '📋',
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.program_days (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    day_index       INTEGER NOT NULL,
    name            TEXT NOT NULL,
    muscle_groups   TEXT[] NOT NULL,
    sort_order      INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.program_day_exercises (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_day_id  UUID NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
    exercise_name   TEXT NOT NULL,
    base_sets       INTEGER NOT NULL DEFAULT 3,
    base_reps       INTEGER NOT NULL DEFAULT 10,
    is_compound     BOOLEAN DEFAULT false,
    sort_order      INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.program_enrollments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','paused','completed','abandoned')),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_week    INTEGER NOT NULL DEFAULT 1,
    current_day     INTEGER NOT NULL DEFAULT 0,
    checkin_frequency TEXT DEFAULT 'weekly'
                        CHECK (checkin_frequency IN ('daily','weekly')),
    settings        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scheduled_workouts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id   UUID NOT NULL REFERENCES program_enrollments(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    program_day_id  UUID NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
    scheduled_date  DATE NOT NULL,
    week_number     INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 5),
    status          TEXT NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled','completed','skipped')),
    workout_id      UUID REFERENCES workouts(id) ON DELETE SET NULL,
    prescribed_exercises JSONB NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workout_feedback (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    scheduled_workout_id UUID REFERENCES scheduled_workouts(id) ON DELETE SET NULL,
    workout_id      UUID REFERENCES workouts(id) ON DELETE SET NULL,
    feedback_type   TEXT NOT NULL CHECK (feedback_type IN ('pump','soreness')),
    overall_rating  SMALLINT CHECK (overall_rating BETWEEN 1 AND 10),
    muscle_ratings  JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.progress_checkins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    enrollment_id   UUID REFERENCES program_enrollments(id) ON DELETE SET NULL,
    checkin_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    bodyweight_kg   DECIMAL(5,1),
    measurements    JSONB DEFAULT '{}',
    photo_urls      TEXT[] DEFAULT '{}',
    performance_notes TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);


-- ─── STEP 3: Indexes ─────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollment_active
    ON program_enrollments(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_checkins_user ON progress_checkins(user_id, checkin_date DESC);
CREATE INDEX IF NOT EXISTS idx_program_days_program ON public.program_days(program_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_program_day_exercises ON public.program_day_exercises(program_day_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON public.program_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_workouts_user ON public.scheduled_workouts(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_workouts_enrollment ON public.scheduled_workouts(enrollment_id, week_number);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON public.workout_feedback(user_id, created_at DESC);


-- ─── STEP 4: RLS ─────────────────────────────────────────────

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_day_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_checkins ENABLE ROW LEVEL SECURITY;

-- Drop policies first (safe if they don't exist)
DROP POLICY IF EXISTS "Authenticated users read programs" ON public.programs;
DROP POLICY IF EXISTS "Authenticated users read program days" ON public.program_days;
DROP POLICY IF EXISTS "Authenticated users read program day exercises" ON public.program_day_exercises;
DROP POLICY IF EXISTS "Users CRUD own enrollments" ON public.program_enrollments;
DROP POLICY IF EXISTS "Users CRUD own scheduled workouts" ON public.scheduled_workouts;
DROP POLICY IF EXISTS "Users CRUD own workout feedback" ON public.workout_feedback;
DROP POLICY IF EXISTS "Users CRUD own progress checkins" ON public.progress_checkins;

-- Recreate policies
CREATE POLICY "Authenticated users read programs"
    ON public.programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users read program days"
    ON public.program_days FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users read program day exercises"
    ON public.program_day_exercises FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users CRUD own enrollments"
    ON public.program_enrollments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users CRUD own scheduled workouts"
    ON public.scheduled_workouts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users CRUD own workout feedback"
    ON public.workout_feedback FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users CRUD own progress checkins"
    ON public.progress_checkins FOR ALL USING (auth.uid() = user_id);


-- ─── STEP 5: Seed programs (skip if already seeded) ──────────

-- PPL (Push/Pull/Legs) — 6 days/week
DO $$
DECLARE
    v_prog_id UUID;
    v_day_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.programs WHERE slug = 'ppl') THEN
        INSERT INTO public.programs (name, slug, description, split_type, days_per_week, duration_weeks, goal, experience_min, color, icon)
        VALUES ('Push Pull Legs', 'ppl', 'Classic 6-day split hitting each muscle group twice per week. High frequency for maximum growth.', 'ppl', 6, 5, 'hypertrophy', 'intermediate', '#DFFF3C', '💪')
        RETURNING id INTO v_prog_id;

        INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
        VALUES (v_prog_id, 0, 'Push A', ARRAY['Chest','Shoulders','Arms'], 0) RETURNING id INTO v_day_id;
        INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
        (v_day_id, 'Bench Press', 4, 8, true, 0), (v_day_id, 'Overhead Press', 3, 8, true, 1),
        (v_day_id, 'Incline DB Press', 3, 10, false, 2), (v_day_id, 'Lateral Raise', 3, 15, false, 3),
        (v_day_id, 'Tricep Pushdown', 3, 12, false, 4);

        INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
        VALUES (v_prog_id, 1, 'Pull A', ARRAY['Back','Arms'], 1) RETURNING id INTO v_day_id;
        INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
        (v_day_id, 'Deadlift', 4, 5, true, 0), (v_day_id, 'Barbell Row', 3, 8, true, 1),
        (v_day_id, 'Pull-ups', 3, 8, true, 2), (v_day_id, 'Face Pull', 3, 15, false, 3),
        (v_day_id, 'Hammer Curl', 3, 12, false, 4);

        INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
        VALUES (v_prog_id, 2, 'Legs A', ARRAY['Legs'], 2) RETURNING id INTO v_day_id;
        INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
        (v_day_id, 'Back Squat', 4, 6, true, 0), (v_day_id, 'Leg Press', 3, 10, false, 1),
        (v_day_id, 'Romanian DL', 3, 8, true, 2), (v_day_id, 'Leg Curl', 3, 12, false, 3),
        (v_day_id, 'Walking Lunge', 3, 12, false, 4);

        INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
        VALUES (v_prog_id, 3, 'Push B', ARRAY['Chest','Shoulders','Arms'], 3) RETURNING id INTO v_day_id;
        INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
        (v_day_id, 'Incline DB Press', 4, 8, true, 0), (v_day_id, 'Arnold Press', 3, 10, false, 1),
        (v_day_id, 'Cable Fly', 3, 12, false, 2), (v_day_id, 'Lateral Raise', 3, 15, false, 3),
        (v_day_id, 'Skull Crusher', 3, 10, false, 4);

        INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
        VALUES (v_prog_id, 4, 'Pull B', ARRAY['Back','Arms'], 4) RETURNING id INTO v_day_id;
        INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
        (v_day_id, 'Barbell Row', 4, 8, true, 0), (v_day_id, 'Lat Pulldown', 3, 10, false, 1),
        (v_day_id, 'Cable Row', 3, 12, false, 2), (v_day_id, 'Face Pull', 3, 15, false, 3),
        (v_day_id, 'Barbell Curl', 3, 10, false, 4);

        INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
        VALUES (v_prog_id, 5, 'Legs B', ARRAY['Legs'], 5) RETURNING id INTO v_day_id;
        INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
        (v_day_id, 'Leg Press', 4, 10, false, 0), (v_day_id, 'Back Squat', 3, 8, true, 1),
        (v_day_id, 'Leg Extension', 3, 12, false, 2), (v_day_id, 'Leg Curl', 3, 12, false, 3),
        (v_day_id, 'Walking Lunge', 3, 12, false, 4);
    END IF;
END $$;

-- Upper/Lower — 4 days/week
DO $$
DECLARE
    v_prog_id UUID;
    v_day_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.programs WHERE slug = 'upper-lower') THEN
        INSERT INTO public.programs (name, slug, description, split_type, days_per_week, duration_weeks, goal, experience_min, color, icon)
        VALUES ('Upper Lower', 'upper-lower', 'Balanced 4-day split. Upper and lower body each trained twice per week with optimal recovery.', 'upper_lower', 4, 5, 'hypertrophy', 'beginner', '#3CFFF0', '⚡')
        RETURNING id INTO v_prog_id;

        INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
        VALUES (v_prog_id, 0, 'Upper A', ARRAY['Chest','Back','Shoulders','Arms'], 0) RETURNING id INTO v_day_id;
        INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
        (v_day_id, 'Bench Press', 4, 8, true, 0), (v_day_id, 'Barbell Row', 4, 8, true, 1),
        (v_day_id, 'Overhead Press', 3, 8, true, 2), (v_day_id, 'Pull-ups', 3, 8, true, 3),
        (v_day_id, 'Lateral Raise', 3, 15, false, 4), (v_day_id, 'Hammer Curl', 3, 12, false, 5);

        INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
        VALUES (v_prog_id, 1, 'Lower A', ARRAY['Legs'], 1) RETURNING id INTO v_day_id;
        INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
        (v_day_id, 'Back Squat', 4, 6, true, 0), (v_day_id, 'Romanian DL', 3, 8, true, 1),
        (v_day_id, 'Leg Press', 3, 10, false, 2), (v_day_id, 'Leg Curl', 3, 12, false, 3),
        (v_day_id, 'Walking Lunge', 3, 12, false, 4);

        INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
        VALUES (v_prog_id, 2, 'Upper B', ARRAY['Chest','Back','Shoulders','Arms'], 2) RETURNING id INTO v_day_id;
        INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
        (v_day_id, 'Incline DB Press', 4, 10, false, 0), (v_day_id, 'Cable Row', 4, 10, false, 1),
        (v_day_id, 'Arnold Press', 3, 10, false, 2), (v_day_id, 'Lat Pulldown', 3, 10, false, 3),
        (v_day_id, 'Tricep Pushdown', 3, 12, false, 4), (v_day_id, 'Barbell Curl', 3, 10, false, 5);

        INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
        VALUES (v_prog_id, 3, 'Lower B', ARRAY['Legs'], 3) RETURNING id INTO v_day_id;
        INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
        (v_day_id, 'Deadlift', 4, 5, true, 0), (v_day_id, 'Leg Press', 3, 10, false, 1),
        (v_day_id, 'Back Squat', 3, 8, true, 2), (v_day_id, 'Leg Extension', 3, 12, false, 3),
        (v_day_id, 'Leg Curl', 3, 12, false, 4);
    END IF;
END $$;

-- Full Body — 3 days/week
DO $$
DECLARE
    v_prog_id UUID;
    v_day_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.programs WHERE slug = 'full-body') THEN
        INSERT INTO public.programs (name, slug, description, split_type, days_per_week, duration_weeks, goal, experience_min, color, icon)
        VALUES ('Full Body', 'full-body', 'Efficient 3-day program hitting all muscle groups each session. Perfect for beginners or busy schedules.', 'full_body', 3, 5, 'general', 'beginner', '#FF6B3C', '🔥')
        RETURNING id INTO v_prog_id;

        INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
        VALUES (v_prog_id, 0, 'Full Body A', ARRAY['Chest','Back','Legs','Shoulders'], 0) RETURNING id INTO v_day_id;
        INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
        (v_day_id, 'Back Squat', 4, 6, true, 0), (v_day_id, 'Bench Press', 3, 8, true, 1),
        (v_day_id, 'Barbell Row', 3, 8, true, 2), (v_day_id, 'Overhead Press', 3, 10, true, 3),
        (v_day_id, 'Hammer Curl', 2, 12, false, 4);

        INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
        VALUES (v_prog_id, 1, 'Full Body B', ARRAY['Chest','Back','Legs','Arms'], 1) RETURNING id INTO v_day_id;
        INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
        (v_day_id, 'Deadlift', 4, 5, true, 0), (v_day_id, 'Incline DB Press', 3, 10, false, 1),
        (v_day_id, 'Pull-ups', 3, 8, true, 2), (v_day_id, 'Leg Press', 3, 10, false, 3),
        (v_day_id, 'Tricep Pushdown', 2, 12, false, 4);

        INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
        VALUES (v_prog_id, 2, 'Full Body C', ARRAY['Chest','Back','Legs','Shoulders'], 2) RETURNING id INTO v_day_id;
        INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
        (v_day_id, 'Back Squat', 3, 8, true, 0), (v_day_id, 'Cable Fly', 3, 12, false, 1),
        (v_day_id, 'Lat Pulldown', 3, 10, false, 2), (v_day_id, 'Romanian DL', 3, 8, true, 3),
        (v_day_id, 'Lateral Raise', 3, 15, false, 4);
    END IF;
END $$;

-- Bro Split — 5 days/week
DO $$
DECLARE
    v_prog_id UUID;
    v_day_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.programs WHERE slug = 'bro-split') THEN
        INSERT INTO public.programs (name, slug, description, split_type, days_per_week, duration_weeks, goal, experience_min, color, icon)
        VALUES ('Bro Split', 'bro-split', 'Classic 5-day bodybuilding split. One muscle group per day for maximum isolation and volume.', 'bro_split', 5, 5, 'hypertrophy', 'intermediate', '#A47BFF', '🏆')
        RETURNING id INTO v_prog_id;

        INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
        VALUES (v_prog_id, 0, 'Chest Day', ARRAY['Chest'], 0) RETURNING id INTO v_day_id;
        INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
        (v_day_id, 'Bench Press', 4, 8, true, 0), (v_day_id, 'Incline DB Press', 3, 10, false, 1),
        (v_day_id, 'Cable Fly', 3, 12, false, 2), (v_day_id, 'Machine Press', 3, 10, false, 3),
        (v_day_id, 'Push-ups', 3, 15, false, 4);

        INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
        VALUES (v_prog_id, 1, 'Back Day', ARRAY['Back'], 1) RETURNING id INTO v_day_id;
        INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
        (v_day_id, 'Deadlift', 4, 5, true, 0), (v_day_id, 'Pull-ups', 3, 8, true, 1),
        (v_day_id, 'Barbell Row', 3, 8, true, 2), (v_day_id, 'Lat Pulldown', 3, 10, false, 3),
        (v_day_id, 'Cable Row', 3, 12, false, 4);

        INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
        VALUES (v_prog_id, 2, 'Shoulders Day', ARRAY['Shoulders'], 2) RETURNING id INTO v_day_id;
        INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
        (v_day_id, 'Overhead Press', 4, 8, true, 0), (v_day_id, 'Arnold Press', 3, 10, false, 1),
        (v_day_id, 'Lateral Raise', 4, 15, false, 2), (v_day_id, 'Face Pull', 3, 15, false, 3);

        INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
        VALUES (v_prog_id, 3, 'Legs Day', ARRAY['Legs'], 3) RETURNING id INTO v_day_id;
        INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
        (v_day_id, 'Back Squat', 4, 6, true, 0), (v_day_id, 'Leg Press', 3, 10, false, 1),
        (v_day_id, 'Romanian DL', 3, 8, true, 2), (v_day_id, 'Leg Extension', 3, 12, false, 3),
        (v_day_id, 'Leg Curl', 3, 12, false, 4);

        INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
        VALUES (v_prog_id, 4, 'Arms Day', ARRAY['Arms'], 4) RETURNING id INTO v_day_id;
        INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
        (v_day_id, 'Barbell Curl', 4, 10, false, 0), (v_day_id, 'Skull Crusher', 4, 10, false, 1),
        (v_day_id, 'Hammer Curl', 3, 12, false, 2), (v_day_id, 'Tricep Pushdown', 3, 12, false, 3);
    END IF;
END $$;


-- ============================================================
-- Done! Refresh your app and the Program tab should work.
-- ============================================================
