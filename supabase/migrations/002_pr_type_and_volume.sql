-- Migration: Add pr_type and set_volume columns to personal_records
-- Splits PRs into two categories: 1 Rep Max and Volume

-- Add new columns
ALTER TABLE public.personal_records
  ADD COLUMN IF NOT EXISTS set_volume DECIMAL(8,1),
  ADD COLUMN IF NOT EXISTS pr_type TEXT NOT NULL DEFAULT '1rm';

-- Add check constraint for pr_type
ALTER TABLE public.personal_records
  ADD CONSTRAINT personal_records_pr_type_check CHECK (pr_type IN ('1rm', 'volume'));

-- Backfill set_volume for existing rows
UPDATE public.personal_records
  SET set_volume = ROUND((weight_kg * reps)::NUMERIC, 1)
  WHERE set_volume IS NULL;

-- Update trigger function to also calculate set_volume
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

-- Update index to include pr_type
DROP INDEX IF EXISTS idx_prs_user_exercise;
CREATE INDEX idx_prs_user_exercise ON public.personal_records(user_id, exercise_name, pr_type, estimated_1rm DESC);

-- Update build_ai_context to include pr_type in PR summary
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
