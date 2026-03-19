-- ============================================================
-- GYMTRACKER — Supabase Database Schema
-- ============================================================
-- INSTRUCTIONS:
-- 1. Go to your Supabase dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click "Run"
-- ============================================================


-- ─── USERS (extends Supabase auth.users) ────────────────────

CREATE TABLE public.profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name            TEXT,
    email           TEXT,
    avatar_url      TEXT,
    gender          TEXT CHECK (gender IN ('male', 'female', 'other')),
    age             INTEGER CHECK (age BETWEEN 13 AND 100),
    weight_kg       DECIMAL(5,1),
    height_cm       INTEGER,
    body_fat_pct    DECIMAL(4,1),
    training_goal   TEXT DEFAULT 'hypertrophy'
        CHECK (training_goal IN ('hypertrophy', 'strength', 'endurance', 'general',
                                 'fat_loss', 'muscle_gain', 'maintenance', 'performance')),
    experience      TEXT DEFAULT 'intermediate'
        CHECK (experience IN ('beginner', 'intermediate', 'advanced')),
    unit_system     TEXT DEFAULT 'metric'
        CHECK (unit_system IN ('metric', 'imperial')),
    onboarding_complete BOOLEAN DEFAULT false,
    target_rate     TEXT CHECK (target_rate IN ('slow', 'moderate', 'aggressive')),
    years_lifting   INTEGER CHECK (years_lifting BETWEEN 0 AND 50),
    training_frequency INTEGER CHECK (training_frequency BETWEEN 0 AND 7),
    focus_areas     TEXT[] DEFAULT '{}',

    -- Subscription
    plan            TEXT DEFAULT 'free'
        CHECK (plan IN ('free', 'pro', 'unlimited')),
    stripe_customer_id  TEXT,
    stripe_sub_id       TEXT,
    plan_expires_at     TIMESTAMPTZ,
    
    -- AI usage tracking
    ai_queries_today    INTEGER DEFAULT 0,
    ai_queries_reset_at DATE DEFAULT CURRENT_DATE,
    
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := NEW.id;

    -- Create profile with default plan
    INSERT INTO public.profiles (id, name, email, avatar_url, plan, ai_queries_today, ai_queries_reset_at)
    VALUES (
        v_user_id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Athlete'),
        NEW.email,
        NEW.raw_user_meta_data->>'avatar_url',
        'free',  -- Default to free plan
        0,
        CURRENT_DATE
    );

    -- Seed default workout templates
    PERFORM public.seed_default_templates(v_user_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ─── WORKOUT TEMPLATES ──────────────────────────────────────

CREATE TABLE public.templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    color           TEXT DEFAULT '#DFFF3C',
    icon            TEXT DEFAULT '💪',
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.template_exercises (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id     UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    equipment       TEXT,
    default_sets    INTEGER DEFAULT 3,
    default_reps    INTEGER DEFAULT 10,
    default_weight  DECIMAL(6,1) DEFAULT 0,
    sort_order      INTEGER DEFAULT 0
);


-- ─── WORKOUTS (completed sessions) ──────────────────────────

CREATE TABLE public.workouts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    template_id     UUID REFERENCES public.templates(id) ON DELETE SET NULL,
    title           TEXT NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    duration_secs   INTEGER,
    total_volume_kg DECIMAL(10,1) DEFAULT 0,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.workout_sets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id      UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
    exercise_name   TEXT NOT NULL,
    set_number      INTEGER NOT NULL,
    weight_kg       DECIMAL(6,1),
    reps            INTEGER,
    completed       BOOLEAN DEFAULT false,
    rpe             SMALLINT CHECK (rpe BETWEEN 1 AND 10),
    logged_at       TIMESTAMPTZ DEFAULT now()
);


-- ─── PERSONAL RECORDS ───────────────────────────────────────

CREATE TABLE public.personal_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    exercise_name   TEXT NOT NULL,
    weight_kg       DECIMAL(6,1) NOT NULL,
    reps            INTEGER NOT NULL,
    estimated_1rm   DECIMAL(6,1),
    set_volume      DECIMAL(8,1),
    pr_type         TEXT NOT NULL DEFAULT '1rm' CHECK (pr_type IN ('1rm', 'volume')),
    achieved_at     TIMESTAMPTZ DEFAULT now(),
    workout_id      UUID REFERENCES public.workouts(id) ON DELETE SET NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true
);

-- Auto-calculate estimated 1RM and set volume
CREATE OR REPLACE FUNCTION public.calc_estimated_1rm()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.reps = 1 THEN
        NEW.estimated_1rm = NEW.weight_kg;
    ELSE
        NEW.estimated_1rm = ROUND((NEW.weight_kg * (1 + NEW.reps / 30.0))::NUMERIC, 1);
    END IF;
    NEW.set_volume = ROUND((NEW.weight_kg * NEW.reps)::NUMERIC, 1);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pr_calc_1rm
    BEFORE INSERT OR UPDATE ON public.personal_records
    FOR EACH ROW EXECUTE FUNCTION public.calc_estimated_1rm();


-- ─── AI COACHING ────────────────────────────────────────────

CREATE TABLE public.ai_conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.ai_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content         TEXT NOT NULL,
    label           TEXT,
    input_tokens    INTEGER DEFAULT 0,
    output_tokens   INTEGER DEFAULT 0,
    cost_usd        DECIMAL(10,6) DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now()
);


-- ─── PUSH NOTIFICATIONS ───────────────────────────────────

CREATE TABLE public.push_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint        TEXT NOT NULL UNIQUE,
    p256dh          TEXT NOT NULL,
    auth            TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.notification_preferences (
    user_id             UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    workout_reminders   BOOLEAN DEFAULT true,
    rest_day_alerts     BOOLEAN DEFAULT true,
    pr_celebrations     BOOLEAN DEFAULT true,
    weekly_summary      BOOLEAN DEFAULT true,
    ai_coach_tips       BOOLEAN DEFAULT true,
    streak_alerts       BOOLEAN DEFAULT true,
    updated_at          TIMESTAMPTZ DEFAULT now()
);


-- ─── INDEXES ────────────────────────────────────────────────

CREATE INDEX idx_templates_user        ON public.templates(user_id);
CREATE INDEX idx_template_ex_template  ON public.template_exercises(template_id, sort_order);
CREATE INDEX idx_workouts_user_date    ON public.workouts(user_id, started_at DESC);
CREATE INDEX idx_sets_workout          ON public.workout_sets(workout_id);
CREATE INDEX idx_prs_user_exercise     ON public.personal_records(user_id, exercise_name, pr_type, estimated_1rm DESC);
CREATE INDEX idx_ai_conv_user          ON public.ai_conversations(user_id, created_at DESC);
CREATE INDEX idx_ai_msgs_conv          ON public.ai_messages(conversation_id, created_at);
CREATE INDEX idx_profiles_stripe       ON public.profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_push_subs_user        ON public.push_subscriptions(user_id);


-- ─── ROW LEVEL SECURITY (RLS) ──────────────────────────────
-- Users can only access their own data

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own
CREATE POLICY "Users read own profile"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Templates: users own their templates
CREATE POLICY "Users CRUD own templates"
    ON public.templates FOR ALL USING (auth.uid() = user_id);

-- Template exercises: via template ownership
CREATE POLICY "Users CRUD own template exercises"
    ON public.template_exercises FOR ALL
    USING (template_id IN (SELECT id FROM public.templates WHERE user_id = auth.uid()));

-- Workouts
CREATE POLICY "Users CRUD own workouts"
    ON public.workouts FOR ALL USING (auth.uid() = user_id);

-- Sets: via workout ownership
CREATE POLICY "Users CRUD own sets"
    ON public.workout_sets FOR ALL
    USING (workout_id IN (SELECT id FROM public.workouts WHERE user_id = auth.uid()));

-- Personal records
CREATE POLICY "Users CRUD own PRs"
    ON public.personal_records FOR ALL USING (auth.uid() = user_id);

-- AI conversations
CREATE POLICY "Users CRUD own AI convos"
    ON public.ai_conversations FOR ALL USING (auth.uid() = user_id);

-- AI messages: via conversation ownership
CREATE POLICY "Users CRUD own AI messages"
    ON public.ai_messages FOR ALL
    USING (conversation_id IN (SELECT id FROM public.ai_conversations WHERE user_id = auth.uid()));

-- Push subscriptions
CREATE POLICY "Users CRUD own push subscriptions"
    ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id);

-- Notification preferences
CREATE POLICY "Users CRUD own notification prefs"
    ON public.notification_preferences FOR ALL USING (auth.uid() = user_id);


-- ─── HELPER FUNCTIONS ───────────────────────────────────────

-- Get weekly stats for a user
CREATE OR REPLACE FUNCTION public.get_weekly_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'workouts', COUNT(*),
        'total_volume_kg', COALESCE(SUM(total_volume_kg), 0),
        'total_duration_secs', COALESCE(SUM(duration_secs), 0),
        'avg_duration_secs', COALESCE(AVG(duration_secs), 0)
    ) INTO result
    FROM public.workouts
    WHERE user_id = p_user_id
      AND started_at >= date_trunc('week', CURRENT_DATE);
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get volume trend (last 8 weeks)
CREATE OR REPLACE FUNCTION public.get_volume_trend(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(row_to_json(t)) INTO result
    FROM (
        SELECT
            date_trunc('week', started_at)::DATE AS week_start,
            ROUND(SUM(total_volume_kg)::NUMERIC, 0) AS volume
        FROM public.workouts
        WHERE user_id = p_user_id
          AND started_at >= CURRENT_DATE - INTERVAL '8 weeks'
        GROUP BY date_trunc('week', started_at)
        ORDER BY week_start
    ) t;
    
    RETURN COALESCE(result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check and reset daily AI query counter
CREATE OR REPLACE FUNCTION public.check_ai_quota(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_limit INTEGER;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
    
    -- Reset counter if new day
    IF v_profile.ai_queries_reset_at < CURRENT_DATE THEN
        UPDATE public.profiles
        SET ai_queries_today = 0, ai_queries_reset_at = CURRENT_DATE
        WHERE id = p_user_id;
        v_profile.ai_queries_today := 0;
    END IF;
    
    -- Get limit based on plan
    v_limit := CASE v_profile.plan
        WHEN 'free' THEN 5
        WHEN 'pro' THEN 30
        WHEN 'unlimited' THEN 9999
        ELSE 5
    END;
    
    RETURN json_build_object(
        'plan', v_profile.plan,
        'used', v_profile.ai_queries_today,
        'limit', v_limit,
        'remaining', GREATEST(0, v_limit - v_profile.ai_queries_today),
        'allowed', v_profile.ai_queries_today < v_limit
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment AI query counter
CREATE OR REPLACE FUNCTION public.increment_ai_queries(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET ai_queries_today = ai_queries_today + 1
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Build AI context string from user data
CREATE OR REPLACE FUNCTION public.build_ai_context(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
    v_weekly JSON;
    v_prs TEXT;
    v_recent TEXT;
    v_context TEXT;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
    v_weekly := public.get_weekly_stats(p_user_id);
    
    -- Get top PRs (1RM and volume)
    SELECT string_agg(exercise_name || ' ' || weight_kg || 'kg x' || reps || ' (' || pr_type || ')', ', ')
    INTO v_prs
    FROM (
        SELECT DISTINCT ON (exercise_name, pr_type) exercise_name, weight_kg, reps, pr_type
        FROM public.personal_records
        WHERE user_id = p_user_id
        ORDER BY exercise_name, pr_type, estimated_1rm DESC
        LIMIT 10
    ) sub;
    
    -- Get recent workouts
    SELECT string_agg(
        title || ' ' || to_char(started_at, 'Mon DD') || ' ' ||
        COALESCE(duration_secs/60 || 'min', '') || ' ' ||
        COALESCE(total_volume_kg || 'kg', ''), ' | '
    )
    INTO v_recent
    FROM (
        SELECT title, started_at, duration_secs, total_volume_kg
        FROM public.workouts
        WHERE user_id = p_user_id
        ORDER BY started_at DESC
        LIMIT 5
    ) sub;
    
    v_context := COALESCE(v_profile.name, 'Athlete')
        || ' | ' || COALESCE(v_profile.weight_kg::TEXT || 'kg', 'weight unknown')
        || ' | ' || COALESCE(v_profile.height_cm::TEXT || 'cm', '')
        || ' | ' || COALESCE(v_profile.body_fat_pct::TEXT || '%bf', '')
        || ' | Goal: ' || COALESCE(v_profile.training_goal, 'general')
        || E'\nPRs: ' || COALESCE(v_prs, 'none yet')
        || E'\nWeek: ' || COALESCE(v_weekly::TEXT, '{}')
        || E'\nRecent: ' || COALESCE(v_recent, 'no workouts yet');
    
    RETURN v_context;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── SEED DEFAULT TEMPLATES (for new users) ────────────────

CREATE OR REPLACE FUNCTION public.seed_default_templates(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_push_id UUID;
    v_pull_id UUID;
    v_legs_id UUID;
BEGIN
    -- Push
    INSERT INTO public.templates (user_id, name, color, icon, sort_order)
    VALUES (p_user_id, 'Push Day', '#DFFF3C', '💪', 0)
    RETURNING id INTO v_push_id;
    
    INSERT INTO public.template_exercises (template_id, name, equipment, default_sets, default_reps, default_weight, sort_order) VALUES
    (v_push_id, 'Bench Press', 'Barbell', 4, 8, 60, 0),
    (v_push_id, 'Incline DB Press', 'Dumbbell', 3, 10, 24, 1),
    (v_push_id, 'Cable Fly', 'Cable', 3, 12, 15, 2),
    (v_push_id, 'Overhead Press', 'Barbell', 3, 8, 40, 3),
    (v_push_id, 'Lateral Raise', 'Dumbbell', 3, 15, 8, 4);
    
    -- Pull
    INSERT INTO public.templates (user_id, name, color, icon, sort_order)
    VALUES (p_user_id, 'Pull Day', '#3CFFF0', '🔄', 1)
    RETURNING id INTO v_pull_id;
    
    INSERT INTO public.template_exercises (template_id, name, equipment, default_sets, default_reps, default_weight, sort_order) VALUES
    (v_pull_id, 'Deadlift', 'Barbell', 4, 5, 100, 0),
    (v_pull_id, 'Pull-ups', 'Bodyweight', 4, 8, 0, 1),
    (v_pull_id, 'Barbell Row', 'Barbell', 3, 8, 60, 2),
    (v_pull_id, 'Face Pull', 'Cable', 3, 15, 20, 3),
    (v_pull_id, 'Hammer Curl', 'Dumbbell', 3, 12, 14, 4);
    
    -- Legs
    INSERT INTO public.templates (user_id, name, color, icon, sort_order)
    VALUES (p_user_id, 'Legs', '#FF6B3C', '🦵', 2)
    RETURNING id INTO v_legs_id;
    
    INSERT INTO public.template_exercises (template_id, name, equipment, default_sets, default_reps, default_weight, sort_order) VALUES
    (v_legs_id, 'Back Squat', 'Barbell', 4, 6, 80, 0),
    (v_legs_id, 'Leg Press', 'Machine', 3, 10, 140, 1),
    (v_legs_id, 'Romanian DL', 'Barbell', 3, 8, 70, 2),
    (v_legs_id, 'Walking Lunge', 'Dumbbell', 3, 12, 16, 3),
    (v_legs_id, 'Leg Curl', 'Machine', 3, 12, 35, 4);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── TRAINING PROGRAMS (system-level blueprints) ──────────────

CREATE TABLE public.programs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    description     TEXT,
    split_type      TEXT NOT NULL CHECK (split_type IN ('ppl','upper_lower','full_body','five_day_split')),
    days_per_week   INTEGER NOT NULL CHECK (days_per_week BETWEEN 2 AND 7),
    duration_weeks  INTEGER NOT NULL DEFAULT 5,
    goal            TEXT NOT NULL CHECK (goal IN ('hypertrophy','strength','endurance','general')),
    experience_min  TEXT NOT NULL DEFAULT 'beginner',
    color           TEXT DEFAULT '#DFFF3C',
    icon            TEXT DEFAULT '📋',
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.program_days (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    day_index       INTEGER NOT NULL,
    name            TEXT NOT NULL,
    muscle_groups   TEXT[] NOT NULL,
    sort_order      INTEGER DEFAULT 0
);

CREATE TABLE public.program_day_exercises (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_day_id  UUID NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
    exercise_name   TEXT NOT NULL,
    base_sets       INTEGER NOT NULL DEFAULT 3,
    base_reps       INTEGER NOT NULL DEFAULT 10,
    is_compound     BOOLEAN DEFAULT false,
    sort_order      INTEGER DEFAULT 0
);


-- ─── USER ENROLLMENT & SCHEDULE ───────────────────────────────

CREATE TABLE public.program_enrollments (
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
CREATE UNIQUE INDEX idx_enrollment_active
    ON program_enrollments(user_id) WHERE status = 'active';

CREATE TABLE public.scheduled_workouts (
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

CREATE TABLE public.workout_feedback (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    scheduled_workout_id UUID REFERENCES scheduled_workouts(id) ON DELETE SET NULL,
    workout_id      UUID REFERENCES workouts(id) ON DELETE SET NULL,
    feedback_type   TEXT NOT NULL CHECK (feedback_type IN ('pump','soreness','difficulty')),
    overall_rating  SMALLINT CHECK (overall_rating BETWEEN 1 AND 10),
    muscle_ratings  JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.progress_checkins (
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
CREATE INDEX idx_checkins_user ON progress_checkins(user_id, checkin_date DESC);


-- ─── PROGRAM INDEXES ──────────────────────────────────────────

CREATE INDEX idx_program_days_program ON public.program_days(program_id, sort_order);
CREATE INDEX idx_program_day_exercises ON public.program_day_exercises(program_day_id, sort_order);
CREATE INDEX idx_enrollments_user ON public.program_enrollments(user_id);
CREATE INDEX idx_scheduled_workouts_user ON public.scheduled_workouts(user_id, scheduled_date);
CREATE INDEX idx_scheduled_workouts_enrollment ON public.scheduled_workouts(enrollment_id, week_number);
CREATE INDEX idx_feedback_user ON public.workout_feedback(user_id, created_at DESC);


-- ─── PROGRAM RLS ──────────────────────────────────────────────

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_day_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_checkins ENABLE ROW LEVEL SECURITY;

-- Programs/days/exercises: readable by all authenticated users
CREATE POLICY "Authenticated users read programs"
    ON public.programs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users read program days"
    ON public.program_days FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users read program day exercises"
    ON public.program_day_exercises FOR SELECT TO authenticated USING (true);

-- Enrollments, scheduled workouts, feedback, checkins: user-scoped
CREATE POLICY "Users CRUD own enrollments"
    ON public.program_enrollments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users CRUD own scheduled workouts"
    ON public.scheduled_workouts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users CRUD own workout feedback"
    ON public.workout_feedback FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users CRUD own progress checkins"
    ON public.progress_checkins FOR ALL USING (auth.uid() = user_id);


-- ─── SEED PROGRAMS ────────────────────────────────────────────

-- PPL (Push/Pull/Legs) — 6 days/week
DO $$
DECLARE
    v_prog_id UUID;
    v_day_id UUID;
BEGIN
    INSERT INTO public.programs (name, slug, description, split_type, days_per_week, duration_weeks, goal, experience_min, color, icon)
    VALUES ('Push Pull Legs', 'ppl', 'Classic 6-day split hitting each muscle group twice per week. High frequency for maximum growth.', 'ppl', 6, 5, 'hypertrophy', 'intermediate', '#DFFF3C', '💪')
    RETURNING id INTO v_prog_id;

    -- Push A
    INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
    VALUES (v_prog_id, 0, 'Push A', ARRAY['Chest','Shoulders','Arms'], 0) RETURNING id INTO v_day_id;
    INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
    (v_day_id, 'Bench Press', 4, 8, true, 0),
    (v_day_id, 'Overhead Press', 3, 8, true, 1),
    (v_day_id, 'Incline DB Press', 3, 10, false, 2),
    (v_day_id, 'Lateral Raise', 3, 15, false, 3),
    (v_day_id, 'Tricep Pushdown', 3, 12, false, 4);

    -- Pull A
    INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
    VALUES (v_prog_id, 1, 'Pull A', ARRAY['Back','Arms'], 1) RETURNING id INTO v_day_id;
    INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
    (v_day_id, 'Deadlift', 4, 5, true, 0),
    (v_day_id, 'Barbell Row', 3, 8, true, 1),
    (v_day_id, 'Pull-ups', 3, 8, true, 2),
    (v_day_id, 'Face Pull', 3, 15, false, 3),
    (v_day_id, 'Hammer Curl', 3, 12, false, 4);

    -- Legs A
    INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
    VALUES (v_prog_id, 2, 'Legs A', ARRAY['Legs'], 2) RETURNING id INTO v_day_id;
    INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
    (v_day_id, 'Back Squat', 4, 6, true, 0),
    (v_day_id, 'Leg Press', 3, 10, false, 1),
    (v_day_id, 'Romanian DL', 3, 8, true, 2),
    (v_day_id, 'Leg Curl', 3, 12, false, 3),
    (v_day_id, 'Walking Lunge', 3, 12, false, 4);

    -- Push B
    INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
    VALUES (v_prog_id, 3, 'Push B', ARRAY['Chest','Shoulders','Arms'], 3) RETURNING id INTO v_day_id;
    INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
    (v_day_id, 'Incline DB Press', 4, 8, true, 0),
    (v_day_id, 'Arnold Press', 3, 10, false, 1),
    (v_day_id, 'Cable Fly', 3, 12, false, 2),
    (v_day_id, 'Lateral Raise', 3, 15, false, 3),
    (v_day_id, 'Skull Crusher', 3, 10, false, 4);

    -- Pull B
    INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
    VALUES (v_prog_id, 4, 'Pull B', ARRAY['Back','Arms'], 4) RETURNING id INTO v_day_id;
    INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
    (v_day_id, 'Barbell Row', 4, 8, true, 0),
    (v_day_id, 'Lat Pulldown', 3, 10, false, 1),
    (v_day_id, 'Cable Row', 3, 12, false, 2),
    (v_day_id, 'Face Pull', 3, 15, false, 3),
    (v_day_id, 'Barbell Curl', 3, 10, false, 4);

    -- Legs B
    INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
    VALUES (v_prog_id, 5, 'Legs B', ARRAY['Legs'], 5) RETURNING id INTO v_day_id;
    INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
    (v_day_id, 'Leg Press', 4, 10, false, 0),
    (v_day_id, 'Back Squat', 3, 8, true, 1),
    (v_day_id, 'Leg Extension', 3, 12, false, 2),
    (v_day_id, 'Leg Curl', 3, 12, false, 3),
    (v_day_id, 'Walking Lunge', 3, 12, false, 4);
END $$;

-- Upper/Lower — 4 days/week
DO $$
DECLARE
    v_prog_id UUID;
    v_day_id UUID;
BEGIN
    INSERT INTO public.programs (name, slug, description, split_type, days_per_week, duration_weeks, goal, experience_min, color, icon)
    VALUES ('Upper Lower', 'upper-lower', 'Balanced 4-day split. Upper and lower body each trained twice per week with optimal recovery.', 'upper_lower', 4, 5, 'hypertrophy', 'beginner', '#3CFFF0', '⚡')
    RETURNING id INTO v_prog_id;

    -- Upper A
    INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
    VALUES (v_prog_id, 0, 'Upper A', ARRAY['Chest','Back','Shoulders','Arms'], 0) RETURNING id INTO v_day_id;
    INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
    (v_day_id, 'Bench Press', 4, 8, true, 0),
    (v_day_id, 'Barbell Row', 4, 8, true, 1),
    (v_day_id, 'Overhead Press', 3, 8, true, 2),
    (v_day_id, 'Pull-ups', 3, 8, true, 3),
    (v_day_id, 'Lateral Raise', 3, 15, false, 4),
    (v_day_id, 'Hammer Curl', 3, 12, false, 5);

    -- Lower A
    INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
    VALUES (v_prog_id, 1, 'Lower A', ARRAY['Legs'], 1) RETURNING id INTO v_day_id;
    INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
    (v_day_id, 'Back Squat', 4, 6, true, 0),
    (v_day_id, 'Romanian DL', 3, 8, true, 1),
    (v_day_id, 'Leg Press', 3, 10, false, 2),
    (v_day_id, 'Leg Curl', 3, 12, false, 3),
    (v_day_id, 'Walking Lunge', 3, 12, false, 4);

    -- Upper B
    INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
    VALUES (v_prog_id, 2, 'Upper B', ARRAY['Chest','Back','Shoulders','Arms'], 2) RETURNING id INTO v_day_id;
    INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
    (v_day_id, 'Incline DB Press', 4, 10, false, 0),
    (v_day_id, 'Cable Row', 4, 10, false, 1),
    (v_day_id, 'Arnold Press', 3, 10, false, 2),
    (v_day_id, 'Lat Pulldown', 3, 10, false, 3),
    (v_day_id, 'Tricep Pushdown', 3, 12, false, 4),
    (v_day_id, 'Barbell Curl', 3, 10, false, 5);

    -- Lower B
    INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
    VALUES (v_prog_id, 3, 'Lower B', ARRAY['Legs'], 3) RETURNING id INTO v_day_id;
    INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
    (v_day_id, 'Deadlift', 4, 5, true, 0),
    (v_day_id, 'Leg Press', 3, 10, false, 1),
    (v_day_id, 'Back Squat', 3, 8, true, 2),
    (v_day_id, 'Leg Extension', 3, 12, false, 3),
    (v_day_id, 'Leg Curl', 3, 12, false, 4);
END $$;

-- Full Body — 3 days/week
DO $$
DECLARE
    v_prog_id UUID;
    v_day_id UUID;
BEGIN
    INSERT INTO public.programs (name, slug, description, split_type, days_per_week, duration_weeks, goal, experience_min, color, icon)
    VALUES ('Full Body', 'full-body', 'Efficient 3-day program hitting all muscle groups each session. Perfect for beginners or busy schedules.', 'full_body', 3, 5, 'general', 'beginner', '#FF6B3C', '🔥')
    RETURNING id INTO v_prog_id;

    -- Day A
    INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
    VALUES (v_prog_id, 0, 'Full Body A', ARRAY['Chest','Back','Legs','Shoulders'], 0) RETURNING id INTO v_day_id;
    INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
    (v_day_id, 'Back Squat', 4, 6, true, 0),
    (v_day_id, 'Bench Press', 3, 8, true, 1),
    (v_day_id, 'Barbell Row', 3, 8, true, 2),
    (v_day_id, 'Overhead Press', 3, 10, true, 3),
    (v_day_id, 'Hammer Curl', 2, 12, false, 4);

    -- Day B
    INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
    VALUES (v_prog_id, 1, 'Full Body B', ARRAY['Chest','Back','Legs','Arms'], 1) RETURNING id INTO v_day_id;
    INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
    (v_day_id, 'Deadlift', 4, 5, true, 0),
    (v_day_id, 'Incline DB Press', 3, 10, false, 1),
    (v_day_id, 'Pull-ups', 3, 8, true, 2),
    (v_day_id, 'Leg Press', 3, 10, false, 3),
    (v_day_id, 'Tricep Pushdown', 2, 12, false, 4);

    -- Day C
    INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
    VALUES (v_prog_id, 2, 'Full Body C', ARRAY['Chest','Back','Legs','Shoulders'], 2) RETURNING id INTO v_day_id;
    INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
    (v_day_id, 'Back Squat', 3, 8, true, 0),
    (v_day_id, 'Cable Fly', 3, 12, false, 1),
    (v_day_id, 'Lat Pulldown', 3, 10, false, 2),
    (v_day_id, 'Romanian DL', 3, 8, true, 3),
    (v_day_id, 'Lateral Raise', 3, 15, false, 4);
END $$;

-- 5-Day Split — 5 days/week
DO $$
DECLARE
    v_prog_id UUID;
    v_day_id UUID;
BEGIN
    INSERT INTO public.programs (name, slug, description, split_type, days_per_week, duration_weeks, goal, experience_min, color, icon)
    VALUES ('5-Day Split', '5-day-split', 'Classic 5-day bodybuilding split. One muscle group per day for maximum isolation and volume.', 'five_day_split', 5, 5, 'hypertrophy', 'intermediate', '#A47BFF', '🏆')
    RETURNING id INTO v_prog_id;

    -- Chest
    INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
    VALUES (v_prog_id, 0, 'Chest Day', ARRAY['Chest'], 0) RETURNING id INTO v_day_id;
    INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
    (v_day_id, 'Bench Press', 4, 8, true, 0),
    (v_day_id, 'Incline DB Press', 3, 10, false, 1),
    (v_day_id, 'Cable Fly', 3, 12, false, 2),
    (v_day_id, 'Machine Press', 3, 10, false, 3),
    (v_day_id, 'Push-ups', 3, 15, false, 4);

    -- Back
    INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
    VALUES (v_prog_id, 1, 'Back Day', ARRAY['Back'], 1) RETURNING id INTO v_day_id;
    INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
    (v_day_id, 'Deadlift', 4, 5, true, 0),
    (v_day_id, 'Pull-ups', 3, 8, true, 1),
    (v_day_id, 'Barbell Row', 3, 8, true, 2),
    (v_day_id, 'Lat Pulldown', 3, 10, false, 3),
    (v_day_id, 'Cable Row', 3, 12, false, 4);

    -- Shoulders
    INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
    VALUES (v_prog_id, 2, 'Shoulders Day', ARRAY['Shoulders'], 2) RETURNING id INTO v_day_id;
    INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
    (v_day_id, 'Overhead Press', 4, 8, true, 0),
    (v_day_id, 'Arnold Press', 3, 10, false, 1),
    (v_day_id, 'Lateral Raise', 4, 15, false, 2),
    (v_day_id, 'Face Pull', 3, 15, false, 3);

    -- Legs
    INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
    VALUES (v_prog_id, 3, 'Legs Day', ARRAY['Legs'], 3) RETURNING id INTO v_day_id;
    INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
    (v_day_id, 'Back Squat', 4, 6, true, 0),
    (v_day_id, 'Leg Press', 3, 10, false, 1),
    (v_day_id, 'Romanian DL', 3, 8, true, 2),
    (v_day_id, 'Leg Extension', 3, 12, false, 3),
    (v_day_id, 'Leg Curl', 3, 12, false, 4);

    -- Arms
    INSERT INTO public.program_days (program_id, day_index, name, muscle_groups, sort_order)
    VALUES (v_prog_id, 4, 'Arms Day', ARRAY['Arms'], 4) RETURNING id INTO v_day_id;
    INSERT INTO public.program_day_exercises (program_day_id, exercise_name, base_sets, base_reps, is_compound, sort_order) VALUES
    (v_day_id, 'Barbell Curl', 4, 10, false, 0),
    (v_day_id, 'Skull Crusher', 4, 10, false, 1),
    (v_day_id, 'Hammer Curl', 3, 12, false, 2),
    (v_day_id, 'Tricep Pushdown', 3, 12, false, 3);
END $$;


-- ============================================================
-- Done! Your database is ready.
-- Next: Set up Edge Functions (see coach-function.ts)
-- ============================================================


-- ─── MIGRATION: Run this if profiles table already exists ───
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other'));
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INTEGER CHECK (age BETWEEN 13 AND 100);
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS experience TEXT DEFAULT 'intermediate' CHECK (experience IN ('beginner', 'intermediate', 'advanced'));
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;

-- ─── MIGRATION: Program-related profile columns ───
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_rate TEXT CHECK (target_rate IN ('slow','moderate','aggressive'));
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS years_lifting INTEGER CHECK (years_lifting BETWEEN 0 AND 50);
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS training_frequency INTEGER CHECK (training_frequency BETWEEN 0 AND 7);
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS focus_areas TEXT[] DEFAULT '{}';
-- ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_training_goal_check;
-- ALTER TABLE public.profiles ADD CONSTRAINT profiles_training_goal_check
--   CHECK (training_goal IN ('hypertrophy','strength','endurance','general',
--                            'fat_loss','muscle_gain','maintenance','performance'));

-- ─── MIGRATION: AI-generated user programs ───
-- Run in Supabase SQL Editor:
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.programs ALTER COLUMN slug DROP NOT NULL;
ALTER TABLE public.programs DROP CONSTRAINT IF EXISTS programs_split_type_check;
ALTER TABLE public.programs ADD CONSTRAINT programs_split_type_check
  CHECK (split_type IN ('ppl','upper_lower','full_body','five_day_split','custom'));

-- RLS: users can insert/read their own programs
DROP POLICY IF EXISTS "Users insert own programs" ON public.programs;
CREATE POLICY "Users insert own programs"
  ON public.programs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Authenticated users read programs" ON public.programs;
CREATE POLICY "Authenticated users read programs"
  ON public.programs FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());
DROP POLICY IF EXISTS "Users delete own programs" ON public.programs;
CREATE POLICY "Users delete own programs"
  ON public.programs FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RLS: users can insert days/exercises for their own programs
DROP POLICY IF EXISTS "Users insert own program days" ON public.program_days;
CREATE POLICY "Users insert own program days"
  ON public.program_days FOR INSERT TO authenticated WITH CHECK (
    program_id IN (SELECT id FROM programs WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users insert own program day exercises" ON public.program_day_exercises;
CREATE POLICY "Users insert own program day exercises"
  ON public.program_day_exercises FOR INSERT TO authenticated WITH CHECK (
    program_day_id IN (
      SELECT pd.id FROM program_days pd
      JOIN programs p ON p.id = pd.program_id
      WHERE p.user_id = auth.uid()));

-- ─── PR SHARES ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pr_shares (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    exercise_name   TEXT NOT NULL,
    pr_type         TEXT NOT NULL CHECK (pr_type IN ('1rm', 'volume')),
    weight_kg       DECIMAL(6,2),
    reps            INTEGER,
    estimated_1rm   DECIMAL(6,2),
    shared_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pr_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users insert own pr_shares" ON public.pr_shares;
CREATE POLICY "Users insert own pr_shares"
  ON public.pr_shares FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users read own pr_shares" ON public.pr_shares;
CREATE POLICY "Users read own pr_shares"
  ON public.pr_shares FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ─── VOLUME STANDARDS (MEV/MAV/MRV reference table) ──────────
-- Stores science-based per-session set ranges per muscle group per training frequency.
-- Named internally with MEV/MAV/MRV; UI shows plain-language equivalents only.

CREATE TABLE public.muscle_volume_standards (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    muscle_group  TEXT NOT NULL CHECK (muscle_group IN (
                    'Chest','Back','Quads','Hamstrings','Glutes',
                    'Shoulders','Biceps','Triceps','Calves','Abs')),
    days_per_week SMALLINT NOT NULL CHECK (days_per_week IN (3,4,5,6)),
    scope         TEXT NOT NULL CHECK (scope IN ('weekly','per_session')),
    mev_low       SMALLINT NOT NULL,
    mev_high      SMALLINT NOT NULL,
    mav_low       SMALLINT NOT NULL,
    mav_high      SMALLINT NOT NULL,
    mrv_low       SMALLINT NOT NULL,
    mrv_high      SMALLINT NOT NULL,
    UNIQUE (muscle_group, days_per_week, scope)
);
ALTER TABLE public.muscle_volume_standards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users read volume standards"
    ON public.muscle_volume_standards FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_vol_standards_lookup
    ON public.muscle_volume_standards (muscle_group, days_per_week, scope);

-- Seed per_session volume standards (science-based RP-style estimates)
INSERT INTO public.muscle_volume_standards
    (muscle_group, days_per_week, scope, mev_low, mev_high, mav_low, mav_high, mrv_low, mrv_high)
VALUES
-- 3 days/week (full body — each muscle hit 3x/week)
('Chest',      3, 'per_session', 1, 2, 2, 3, 4, 5),
('Back',       3, 'per_session', 1, 2, 2, 3, 4, 5),
('Quads',      3, 'per_session', 1, 2, 2, 3, 4, 5),
('Hamstrings', 3, 'per_session', 1, 2, 2, 3, 3, 4),
('Glutes',     3, 'per_session', 1, 2, 2, 3, 3, 4),
('Shoulders',  3, 'per_session', 1, 2, 2, 3, 4, 5),
('Biceps',     3, 'per_session', 1, 2, 2, 3, 3, 4),
('Triceps',    3, 'per_session', 1, 2, 2, 3, 3, 4),
('Calves',     3, 'per_session', 1, 2, 2, 4, 4, 6),
('Abs',        3, 'per_session', 1, 2, 2, 3, 3, 4),

-- 4 days/week (upper/lower — each muscle 2x/week)
('Chest',      4, 'per_session', 2, 3, 3, 4, 5, 6),
('Back',       4, 'per_session', 2, 3, 3, 4, 5, 6),
('Quads',      4, 'per_session', 2, 3, 3, 4, 5, 6),
('Hamstrings', 4, 'per_session', 2, 3, 3, 4, 4, 5),
('Glutes',     4, 'per_session', 2, 3, 3, 4, 4, 5),
('Shoulders',  4, 'per_session', 2, 3, 3, 4, 5, 6),
('Biceps',     4, 'per_session', 2, 3, 3, 4, 4, 5),
('Triceps',    4, 'per_session', 2, 3, 3, 4, 4, 5),
('Calves',     4, 'per_session', 2, 3, 3, 5, 5, 7),
('Abs',        4, 'per_session', 2, 3, 3, 4, 4, 5),

-- 5 days/week (5-day split — most muscles hit 1-2x/week)
('Chest',      5, 'per_session', 3, 4, 4, 5, 6, 7),
('Back',       5, 'per_session', 3, 4, 4, 5, 6, 7),
('Quads',      5, 'per_session', 3, 4, 4, 5, 6, 7),
('Hamstrings', 5, 'per_session', 2, 3, 3, 4, 5, 6),
('Glutes',     5, 'per_session', 2, 3, 3, 4, 5, 6),
('Shoulders',  5, 'per_session', 3, 4, 4, 5, 6, 7),
('Biceps',     5, 'per_session', 2, 3, 3, 4, 5, 6),
('Triceps',    5, 'per_session', 2, 3, 3, 4, 5, 6),
('Calves',     5, 'per_session', 3, 4, 4, 6, 6, 8),
('Abs',        5, 'per_session', 2, 3, 3, 4, 4, 5),

-- 6 days/week (PPL — each muscle 2x/week with more total volume)
('Chest',      6, 'per_session', 2, 3, 3, 4, 5, 6),
('Back',       6, 'per_session', 2, 3, 3, 4, 5, 6),
('Quads',      6, 'per_session', 2, 3, 3, 4, 5, 6),
('Hamstrings', 6, 'per_session', 2, 3, 3, 4, 4, 5),
('Glutes',     6, 'per_session', 2, 3, 3, 4, 4, 5),
('Shoulders',  6, 'per_session', 2, 3, 3, 4, 5, 6),
('Biceps',     6, 'per_session', 2, 3, 3, 4, 4, 5),
('Triceps',    6, 'per_session', 2, 3, 3, 4, 4, 5),
('Calves',     6, 'per_session', 2, 3, 3, 5, 5, 7),
('Abs',        6, 'per_session', 2, 3, 3, 4, 4, 5);
