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
        CHECK (training_goal IN ('hypertrophy', 'strength', 'endurance', 'general')),
    experience      TEXT DEFAULT 'intermediate'
        CHECK (experience IN ('beginner', 'intermediate', 'advanced')),
    unit_system     TEXT DEFAULT 'metric'
        CHECK (unit_system IN ('metric', 'imperial')),
    onboarding_complete BOOLEAN DEFAULT false,

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
    achieved_at     TIMESTAMPTZ DEFAULT now(),
    workout_id      UUID REFERENCES public.workouts(id) ON DELETE SET NULL
);

-- Auto-calculate estimated 1RM using Epley formula
CREATE OR REPLACE FUNCTION public.calc_estimated_1rm()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.reps = 1 THEN
        NEW.estimated_1rm = NEW.weight_kg;
    ELSE
        NEW.estimated_1rm = ROUND((NEW.weight_kg * (1 + NEW.reps / 30.0))::NUMERIC, 1);
    END IF;
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


-- ─── INDEXES ────────────────────────────────────────────────

CREATE INDEX idx_templates_user        ON public.templates(user_id);
CREATE INDEX idx_template_ex_template  ON public.template_exercises(template_id, sort_order);
CREATE INDEX idx_workouts_user_date    ON public.workouts(user_id, started_at DESC);
CREATE INDEX idx_sets_workout          ON public.workout_sets(workout_id);
CREATE INDEX idx_prs_user_exercise     ON public.personal_records(user_id, exercise_name, estimated_1rm DESC);
CREATE INDEX idx_ai_conv_user          ON public.ai_conversations(user_id, created_at DESC);
CREATE INDEX idx_ai_msgs_conv          ON public.ai_messages(conversation_id, created_at);
CREATE INDEX idx_profiles_stripe       ON public.profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;


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
    
    -- Get top PRs
    SELECT string_agg(exercise_name || ' ' || weight_kg || 'kg x' || reps, ', ')
    INTO v_prs
    FROM (
        SELECT DISTINCT ON (exercise_name) exercise_name, weight_kg, reps
        FROM public.personal_records
        WHERE user_id = p_user_id
        ORDER BY exercise_name, estimated_1rm DESC
        LIMIT 6
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


-- ============================================================
-- Done! Your database is ready.
-- Next: Set up Edge Functions (see coach-function.ts)
-- ============================================================


-- ─── MIGRATION: Run this if profiles table already exists ───
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other'));
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INTEGER CHECK (age BETWEEN 13 AND 100);
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS experience TEXT DEFAULT 'intermediate' CHECK (experience IN ('beginner', 'intermediate', 'advanced'));
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;
