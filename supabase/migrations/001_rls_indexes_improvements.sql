-- ============================================================
-- GYMTRACKER — RLS Policies, Indexes & Schema Improvements
-- ============================================================
-- Migration: 001_rls_indexes_improvements.sql
--
-- This migration:
--   1. Drops and recreates all RLS policies with granular per-operation rules
--   2. Adds INSERT policies (missing from original schema)
--   3. Adds indexes for analytics queries and foreign keys
--   4. Adds missing columns/tables to improve the app
--
-- INSTRUCTIONS:
--   1. Go to Supabase Dashboard → SQL Editor
--   2. Paste and run this entire file
--   3. It is idempotent — safe to run multiple times
-- ============================================================


-- ============================================================
-- PART 1: DROP EXISTING RLS POLICIES
-- ============================================================
-- Remove the broad "FOR ALL" policies and replace with granular ones.
-- Using IF EXISTS so this migration is re-runnable.

DROP POLICY IF EXISTS "Users read own profile"            ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile"          ON public.profiles;
DROP POLICY IF EXISTS "Users CRUD own templates"          ON public.templates;
DROP POLICY IF EXISTS "Users CRUD own template exercises" ON public.template_exercises;
DROP POLICY IF EXISTS "Users CRUD own workouts"           ON public.workouts;
DROP POLICY IF EXISTS "Users CRUD own sets"               ON public.workout_sets;
DROP POLICY IF EXISTS "Users CRUD own PRs"                ON public.personal_records;
DROP POLICY IF EXISTS "Users CRUD own AI convos"          ON public.ai_conversations;
DROP POLICY IF EXISTS "Users CRUD own AI messages"        ON public.ai_messages;

-- Also drop our new policy names in case this migration is re-run
DROP POLICY IF EXISTS "profiles_select_own"              ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"              ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"              ON public.profiles;
DROP POLICY IF EXISTS "templates_select_own"             ON public.templates;
DROP POLICY IF EXISTS "templates_insert_own"             ON public.templates;
DROP POLICY IF EXISTS "templates_update_own"             ON public.templates;
DROP POLICY IF EXISTS "templates_delete_own"             ON public.templates;
DROP POLICY IF EXISTS "template_exercises_select_own"    ON public.template_exercises;
DROP POLICY IF EXISTS "template_exercises_insert_own"    ON public.template_exercises;
DROP POLICY IF EXISTS "template_exercises_update_own"    ON public.template_exercises;
DROP POLICY IF EXISTS "template_exercises_delete_own"    ON public.template_exercises;
DROP POLICY IF EXISTS "workouts_select_own"              ON public.workouts;
DROP POLICY IF EXISTS "workouts_insert_own"              ON public.workouts;
DROP POLICY IF EXISTS "workouts_update_own"              ON public.workouts;
DROP POLICY IF EXISTS "workouts_delete_own"              ON public.workouts;
DROP POLICY IF EXISTS "workout_sets_select_own"          ON public.workout_sets;
DROP POLICY IF EXISTS "workout_sets_insert_own"          ON public.workout_sets;
DROP POLICY IF EXISTS "workout_sets_update_own"          ON public.workout_sets;
DROP POLICY IF EXISTS "workout_sets_delete_own"          ON public.workout_sets;
DROP POLICY IF EXISTS "personal_records_select_own"      ON public.personal_records;
DROP POLICY IF EXISTS "personal_records_insert_own"      ON public.personal_records;
DROP POLICY IF EXISTS "personal_records_update_own"      ON public.personal_records;
DROP POLICY IF EXISTS "personal_records_delete_own"      ON public.personal_records;
DROP POLICY IF EXISTS "ai_conversations_select_own"      ON public.ai_conversations;
DROP POLICY IF EXISTS "ai_conversations_insert_own"      ON public.ai_conversations;
DROP POLICY IF EXISTS "ai_conversations_delete_own"      ON public.ai_conversations;
DROP POLICY IF EXISTS "ai_messages_select_own"           ON public.ai_messages;
DROP POLICY IF EXISTS "ai_messages_insert_own"           ON public.ai_messages;


-- ============================================================
-- PART 2: ENSURE RLS IS ENABLED ON ALL TABLES
-- ============================================================
-- Idempotent — safe even if already enabled.

ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages        ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- PART 3: PROFILES — RLS POLICIES
-- ============================================================
-- profiles.id = auth.users.id, so we match on auth.uid() = id.
-- INSERT is handled by the SECURITY DEFINER trigger (handle_new_user),
-- but we add a policy so the client can also create a profile if needed.

-- SELECT: Users can only read their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);
COMMENT ON POLICY "profiles_select_own" ON public.profiles IS
    'Users can only read their own profile row. Prevents enumeration of other users.';

-- INSERT: Users can only insert a profile for themselves.
-- The handle_new_user trigger uses SECURITY DEFINER so it bypasses RLS,
-- but this policy covers edge cases (e.g. OAuth users where trigger may not fire).
CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);
COMMENT ON POLICY "profiles_insert_own" ON public.profiles IS
    'Users can only create a profile with their own auth.uid() as the id.';

-- UPDATE: Users can only update their own profile.
-- WITH CHECK ensures they cannot change the id to impersonate someone else.
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
COMMENT ON POLICY "profiles_update_own" ON public.profiles IS
    'Users can only update their own profile. WITH CHECK prevents id tampering.';

-- NOTE: No DELETE policy — users should not delete their own profile row.
-- Account deletion should be handled via Supabase auth admin API or a
-- SECURITY DEFINER function that cleans up all user data atomically.


-- ============================================================
-- PART 4: TEMPLATES — RLS POLICIES
-- ============================================================
-- Templates belong to a user via user_id column.

CREATE POLICY "templates_select_own" ON public.templates
    FOR SELECT
    USING (auth.uid() = user_id);
COMMENT ON POLICY "templates_select_own" ON public.templates IS
    'Users can only see their own workout templates.';

CREATE POLICY "templates_insert_own" ON public.templates
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
COMMENT ON POLICY "templates_insert_own" ON public.templates IS
    'Users can only create templates under their own user_id.';

CREATE POLICY "templates_update_own" ON public.templates
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
COMMENT ON POLICY "templates_update_own" ON public.templates IS
    'Users can only edit their own templates. WITH CHECK prevents reassigning to another user.';

CREATE POLICY "templates_delete_own" ON public.templates
    FOR DELETE
    USING (auth.uid() = user_id);
COMMENT ON POLICY "templates_delete_own" ON public.templates IS
    'Users can only delete their own templates. CASCADE will remove child template_exercises.';


-- ============================================================
-- PART 5: TEMPLATE_EXERCISES — RLS POLICIES
-- ============================================================
-- No direct user_id column — ownership is derived via the parent template.
-- We use a subquery to check that the template belongs to the current user.

CREATE POLICY "template_exercises_select_own" ON public.template_exercises
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.templates t
            WHERE t.id = template_exercises.template_id
              AND t.user_id = auth.uid()
        )
    );
COMMENT ON POLICY "template_exercises_select_own" ON public.template_exercises IS
    'Users can only read exercises belonging to their own templates (checked via parent template).';

CREATE POLICY "template_exercises_insert_own" ON public.template_exercises
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.templates t
            WHERE t.id = template_exercises.template_id
              AND t.user_id = auth.uid()
        )
    );
COMMENT ON POLICY "template_exercises_insert_own" ON public.template_exercises IS
    'Users can only add exercises to their own templates.';

CREATE POLICY "template_exercises_update_own" ON public.template_exercises
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.templates t
            WHERE t.id = template_exercises.template_id
              AND t.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.templates t
            WHERE t.id = template_exercises.template_id
              AND t.user_id = auth.uid()
        )
    );
COMMENT ON POLICY "template_exercises_update_own" ON public.template_exercises IS
    'Users can only modify exercises in their own templates.';

CREATE POLICY "template_exercises_delete_own" ON public.template_exercises
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.templates t
            WHERE t.id = template_exercises.template_id
              AND t.user_id = auth.uid()
        )
    );
COMMENT ON POLICY "template_exercises_delete_own" ON public.template_exercises IS
    'Users can only remove exercises from their own templates.';


-- ============================================================
-- PART 6: WORKOUTS — RLS POLICIES
-- ============================================================

CREATE POLICY "workouts_select_own" ON public.workouts
    FOR SELECT
    USING (auth.uid() = user_id);
COMMENT ON POLICY "workouts_select_own" ON public.workouts IS
    'Users can only view their own completed workouts.';

CREATE POLICY "workouts_insert_own" ON public.workouts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
COMMENT ON POLICY "workouts_insert_own" ON public.workouts IS
    'Users can only create workouts under their own user_id. App.jsx sends user_id explicitly.';

CREATE POLICY "workouts_update_own" ON public.workouts
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
COMMENT ON POLICY "workouts_update_own" ON public.workouts IS
    'Users can only edit their own workouts (e.g. adding notes after the fact).';

CREATE POLICY "workouts_delete_own" ON public.workouts
    FOR DELETE
    USING (auth.uid() = user_id);
COMMENT ON POLICY "workouts_delete_own" ON public.workouts IS
    'Users can only delete their own workouts. CASCADE removes child workout_sets.';


-- ============================================================
-- PART 7: WORKOUT_SETS — RLS POLICIES
-- ============================================================
-- No direct user_id — ownership derived from parent workout.

CREATE POLICY "workout_sets_select_own" ON public.workout_sets
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workouts w
            WHERE w.id = workout_sets.workout_id
              AND w.user_id = auth.uid()
        )
    );
COMMENT ON POLICY "workout_sets_select_own" ON public.workout_sets IS
    'Users can only read sets from their own workouts.';

CREATE POLICY "workout_sets_insert_own" ON public.workout_sets
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workouts w
            WHERE w.id = workout_sets.workout_id
              AND w.user_id = auth.uid()
        )
    );
COMMENT ON POLICY "workout_sets_insert_own" ON public.workout_sets IS
    'Users can only insert sets into their own workouts. Prevents injecting sets into other users workouts.';

CREATE POLICY "workout_sets_update_own" ON public.workout_sets
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.workouts w
            WHERE w.id = workout_sets.workout_id
              AND w.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workouts w
            WHERE w.id = workout_sets.workout_id
              AND w.user_id = auth.uid()
        )
    );
COMMENT ON POLICY "workout_sets_update_own" ON public.workout_sets IS
    'Users can only edit sets in their own workouts.';

CREATE POLICY "workout_sets_delete_own" ON public.workout_sets
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.workouts w
            WHERE w.id = workout_sets.workout_id
              AND w.user_id = auth.uid()
        )
    );
COMMENT ON POLICY "workout_sets_delete_own" ON public.workout_sets IS
    'Users can only delete sets from their own workouts.';


-- ============================================================
-- PART 8: PERSONAL_RECORDS — RLS POLICIES
-- ============================================================

CREATE POLICY "personal_records_select_own" ON public.personal_records
    FOR SELECT
    USING (auth.uid() = user_id);
COMMENT ON POLICY "personal_records_select_own" ON public.personal_records IS
    'Users can only view their own personal records.';

CREATE POLICY "personal_records_insert_own" ON public.personal_records
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
COMMENT ON POLICY "personal_records_insert_own" ON public.personal_records IS
    'Users can only create PRs under their own user_id.';

CREATE POLICY "personal_records_update_own" ON public.personal_records
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
COMMENT ON POLICY "personal_records_update_own" ON public.personal_records IS
    'Users can only update their own PRs. The calc_estimated_1rm trigger recalculates on update.';

CREATE POLICY "personal_records_delete_own" ON public.personal_records
    FOR DELETE
    USING (auth.uid() = user_id);
COMMENT ON POLICY "personal_records_delete_own" ON public.personal_records IS
    'Users can only delete their own personal records.';


-- ============================================================
-- PART 9: AI_CONVERSATIONS — RLS POLICIES
-- ============================================================
-- The coach Edge Function uses the service_role key (bypasses RLS),
-- but these policies protect against direct client-side access.

CREATE POLICY "ai_conversations_select_own" ON public.ai_conversations
    FOR SELECT
    USING (auth.uid() = user_id);
COMMENT ON POLICY "ai_conversations_select_own" ON public.ai_conversations IS
    'Users can only view their own AI coach conversations. Protects chat history privacy.';

CREATE POLICY "ai_conversations_insert_own" ON public.ai_conversations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
COMMENT ON POLICY "ai_conversations_insert_own" ON public.ai_conversations IS
    'Users can only create conversations under their own user_id. '
    'Normally the Edge Function does this via service_role, but this protects direct client access.';

-- NOTE: No UPDATE policy — conversations are append-only (new messages, not edits).
-- NOTE: DELETE allowed so users can clear their AI chat history.
CREATE POLICY "ai_conversations_delete_own" ON public.ai_conversations
    FOR DELETE
    USING (auth.uid() = user_id);
COMMENT ON POLICY "ai_conversations_delete_own" ON public.ai_conversations IS
    'Users can delete their own AI conversations (e.g. clear chat history). CASCADE removes messages.';


-- ============================================================
-- PART 10: AI_MESSAGES — RLS POLICIES
-- ============================================================
-- Messages reference a conversation; ownership checked via parent.
-- The Edge Function inserts via service_role so it bypasses RLS.
-- These policies protect against direct client-side tampering.

CREATE POLICY "ai_messages_select_own" ON public.ai_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.ai_conversations c
            WHERE c.id = ai_messages.conversation_id
              AND c.user_id = auth.uid()
        )
    );
COMMENT ON POLICY "ai_messages_select_own" ON public.ai_messages IS
    'Users can only read messages from their own AI conversations. '
    'Prevents reading other users AI coaching advice or prompts.';

CREATE POLICY "ai_messages_insert_own" ON public.ai_messages
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.ai_conversations c
            WHERE c.id = ai_messages.conversation_id
              AND c.user_id = auth.uid()
        )
    );
COMMENT ON POLICY "ai_messages_insert_own" ON public.ai_messages IS
    'Users can only add messages to their own conversations. '
    'Edge Function uses service_role to bypass this; policy guards direct client access.';

-- NOTE: No UPDATE or DELETE on individual messages — messages are immutable.
-- Deleting the parent conversation cascades to messages.


-- ============================================================
-- PART 11: ADDITIONAL INDEXES
-- ============================================================
-- The original schema has good indexes. These additions support:
--   - Analytics dashboard queries (date ranges, aggregations)
--   - Foreign key lookups not yet indexed
--   - Common query patterns found in supabase.js and App.jsx

-- Using IF NOT EXISTS via a DO block for idempotency
DO $$
BEGIN
    -- workout_sets: index on exercise_name for PR lookups and analytics
    -- (getPersonalRecords queries by exercise_name frequently)
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sets_exercise_name') THEN
        CREATE INDEX idx_sets_exercise_name ON public.workout_sets(exercise_name);
    END IF;

    -- workout_sets: composite index for analytics queries that join on workout_id + exercise
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sets_workout_exercise') THEN
        CREATE INDEX idx_sets_workout_exercise ON public.workout_sets(workout_id, exercise_name);
    END IF;

    -- workouts: index on finished_at for duration/completion analytics
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_workouts_finished') THEN
        CREATE INDEX idx_workouts_finished ON public.workouts(user_id, finished_at DESC)
            WHERE finished_at IS NOT NULL;
    END IF;

    -- workouts: index for volume trend query (weekly aggregation over last 8 weeks)
    -- The get_volume_trend function filters on user_id + started_at range
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_workouts_user_volume') THEN
        CREATE INDEX idx_workouts_user_volume ON public.workouts(user_id, started_at, total_volume_kg);
    END IF;

    -- personal_records: index on achieved_at for timeline/progress views
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_prs_user_date') THEN
        CREATE INDEX idx_prs_user_date ON public.personal_records(user_id, achieved_at DESC);
    END IF;

    -- personal_records: FK index on workout_id (not yet indexed)
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_prs_workout') THEN
        CREATE INDEX idx_prs_workout ON public.personal_records(workout_id)
            WHERE workout_id IS NOT NULL;
    END IF;

    -- workouts: FK index on template_id (for "workouts from this template" queries)
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_workouts_template') THEN
        CREATE INDEX idx_workouts_template ON public.workouts(template_id)
            WHERE template_id IS NOT NULL;
    END IF;

    -- templates: composite for sort_order queries (getTemplates orders by sort_order)
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_templates_user_sort') THEN
        CREATE INDEX idx_templates_user_sort ON public.templates(user_id, sort_order);
    END IF;

    -- profiles: index on plan for admin queries (count users by plan)
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_plan') THEN
        CREATE INDEX idx_profiles_plan ON public.profiles(plan);
    END IF;

    -- profiles: index on ai_queries_reset_at for quota reset lookups
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_quota_reset') THEN
        CREATE INDEX idx_profiles_quota_reset ON public.profiles(ai_queries_reset_at);
    END IF;

    -- ai_messages: index on role for filtering user vs assistant messages
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ai_msgs_conv_role') THEN
        CREATE INDEX idx_ai_msgs_conv_role ON public.ai_messages(conversation_id, role, created_at);
    END IF;
END $$;


-- ============================================================
-- PART 12: SCHEMA IMPROVEMENTS — NEW COLUMNS
-- ============================================================
-- These additions improve the app without breaking existing code.

-- 12a. workout_sets: add rest_secs to track rest periods per set
-- (The UI already has a rest timer — this persists the data)
ALTER TABLE public.workout_sets
    ADD COLUMN IF NOT EXISTS rest_secs INTEGER;
COMMENT ON COLUMN public.workout_sets.rest_secs IS
    'Rest duration in seconds before this set. Captured from the in-app rest timer.';

-- 12b. workout_sets: add set_type for warm-up/working/drop/failure distinction
ALTER TABLE public.workout_sets
    ADD COLUMN IF NOT EXISTS set_type TEXT DEFAULT 'working';
-- Add constraint only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'workout_sets_set_type_check'
    ) THEN
        ALTER TABLE public.workout_sets
            ADD CONSTRAINT workout_sets_set_type_check
            CHECK (set_type IN ('warmup', 'working', 'drop', 'failure'));
    END IF;
END $$;
COMMENT ON COLUMN public.workout_sets.set_type IS
    'Type of set: warmup, working, drop, or failure. Defaults to working.';

-- 12c. workouts: add mood/energy rating for correlating recovery with performance
ALTER TABLE public.workouts
    ADD COLUMN IF NOT EXISTS energy_rating SMALLINT;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'workouts_energy_rating_check'
    ) THEN
        ALTER TABLE public.workouts
            ADD CONSTRAINT workouts_energy_rating_check
            CHECK (energy_rating BETWEEN 1 AND 5);
    END IF;
END $$;
COMMENT ON COLUMN public.workouts.energy_rating IS
    'Self-reported energy/mood 1-5 before or after workout. Useful for AI coach recovery analysis.';

-- 12d. profiles: add preferred_rest_secs for default rest timer duration
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS preferred_rest_secs INTEGER DEFAULT 90;
COMMENT ON COLUMN public.profiles.preferred_rest_secs IS
    'Default rest timer duration in seconds. Currently hardcoded to 90 in the UI.';

-- 12e. templates: add last_used_at for sorting by recency
ALTER TABLE public.templates
    ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
COMMENT ON COLUMN public.templates.last_used_at IS
    'Timestamp of the last time this template was used to start a workout. Enables sort-by-recent.';

-- 12f. template_exercises: add muscle_group for analytics grouping
ALTER TABLE public.template_exercises
    ADD COLUMN IF NOT EXISTS muscle_group TEXT;
COMMENT ON COLUMN public.template_exercises.muscle_group IS
    'Primary muscle group (e.g. chest, back, legs, shoulders, arms). Enables volume-per-muscle analytics.';

-- 12g. workout_sets: add muscle_group (denormalized from template for analytics speed)
ALTER TABLE public.workout_sets
    ADD COLUMN IF NOT EXISTS muscle_group TEXT;
COMMENT ON COLUMN public.workout_sets.muscle_group IS
    'Primary muscle group for this exercise. Denormalized for fast analytics queries without joins.';


-- ============================================================
-- PART 13: NEW TABLE — body_measurements
-- ============================================================
-- Tracks body composition over time (weight, body fat, measurements).
-- Currently profiles only stores a single snapshot; this enables progress tracking.

CREATE TABLE IF NOT EXISTS public.body_measurements (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    weight_kg   DECIMAL(5,1),
    body_fat_pct DECIMAL(4,1),
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

-- RLS policies for body_measurements
DROP POLICY IF EXISTS "body_measurements_select_own" ON public.body_measurements;
CREATE POLICY "body_measurements_select_own" ON public.body_measurements
    FOR SELECT
    USING (auth.uid() = user_id);
COMMENT ON POLICY "body_measurements_select_own" ON public.body_measurements IS
    'Users can only view their own body measurements.';

DROP POLICY IF EXISTS "body_measurements_insert_own" ON public.body_measurements;
CREATE POLICY "body_measurements_insert_own" ON public.body_measurements
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
COMMENT ON POLICY "body_measurements_insert_own" ON public.body_measurements IS
    'Users can only create measurements under their own user_id.';

DROP POLICY IF EXISTS "body_measurements_update_own" ON public.body_measurements;
CREATE POLICY "body_measurements_update_own" ON public.body_measurements
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
COMMENT ON POLICY "body_measurements_update_own" ON public.body_measurements IS
    'Users can only update their own body measurements.';

DROP POLICY IF EXISTS "body_measurements_delete_own" ON public.body_measurements;
CREATE POLICY "body_measurements_delete_own" ON public.body_measurements
    FOR DELETE
    USING (auth.uid() = user_id);
COMMENT ON POLICY "body_measurements_delete_own" ON public.body_measurements IS
    'Users can only delete their own body measurements.';

-- Indexes for body_measurements
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_body_measurements_user_date') THEN
        CREATE INDEX idx_body_measurements_user_date
            ON public.body_measurements(user_id, measured_at DESC);
    END IF;
END $$;


-- ============================================================
-- PART 14: NEW TABLE — exercise_library
-- ============================================================
-- A shared + user-custom exercise catalog with muscle group metadata.
-- Enables autocomplete, muscle group analytics, and exercise discovery.

CREATE TABLE IF NOT EXISTS public.exercise_library (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    -- user_id NULL = system/global exercise; non-NULL = user-created custom exercise
    name         TEXT NOT NULL,
    muscle_group TEXT,
    equipment    TEXT,
    is_compound  BOOLEAN DEFAULT false,
    created_at   TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, name)  -- prevent duplicate exercise names per user (NULL user_id = global)
);

ALTER TABLE public.exercise_library ENABLE ROW LEVEL SECURITY;

-- Users can read all global exercises (user_id IS NULL) plus their own custom ones
DROP POLICY IF EXISTS "exercise_library_select" ON public.exercise_library;
CREATE POLICY "exercise_library_select" ON public.exercise_library
    FOR SELECT
    USING (user_id IS NULL OR auth.uid() = user_id);
COMMENT ON POLICY "exercise_library_select" ON public.exercise_library IS
    'Users can see all global/system exercises (user_id IS NULL) plus their own custom exercises.';

-- Users can only insert custom exercises for themselves
DROP POLICY IF EXISTS "exercise_library_insert_own" ON public.exercise_library;
CREATE POLICY "exercise_library_insert_own" ON public.exercise_library
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
COMMENT ON POLICY "exercise_library_insert_own" ON public.exercise_library IS
    'Users can only create custom exercises under their own user_id. Global exercises are admin-only.';

DROP POLICY IF EXISTS "exercise_library_update_own" ON public.exercise_library;
CREATE POLICY "exercise_library_update_own" ON public.exercise_library
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
COMMENT ON POLICY "exercise_library_update_own" ON public.exercise_library IS
    'Users can only edit their own custom exercises. Global exercises are immutable to regular users.';

DROP POLICY IF EXISTS "exercise_library_delete_own" ON public.exercise_library;
CREATE POLICY "exercise_library_delete_own" ON public.exercise_library
    FOR DELETE
    USING (auth.uid() = user_id);
COMMENT ON POLICY "exercise_library_delete_own" ON public.exercise_library IS
    'Users can only delete their own custom exercises.';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_exercise_library_name') THEN
        CREATE INDEX idx_exercise_library_name
            ON public.exercise_library(name);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_exercise_library_muscle') THEN
        CREATE INDEX idx_exercise_library_muscle
            ON public.exercise_library(muscle_group)
            WHERE muscle_group IS NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_exercise_library_user') THEN
        CREATE INDEX idx_exercise_library_user
            ON public.exercise_library(user_id)
            WHERE user_id IS NOT NULL;
    END IF;
END $$;


-- ============================================================
-- DONE
-- ============================================================
-- Summary of changes:
--
-- RLS POLICIES (34 total):
--   profiles:           SELECT, INSERT, UPDATE (no DELETE — use admin API)
--   templates:          SELECT, INSERT, UPDATE, DELETE
--   template_exercises: SELECT, INSERT, UPDATE, DELETE (via parent template)
--   workouts:           SELECT, INSERT, UPDATE, DELETE
--   workout_sets:       SELECT, INSERT, UPDATE, DELETE (via parent workout)
--   personal_records:   SELECT, INSERT, UPDATE, DELETE
--   ai_conversations:   SELECT, INSERT, DELETE (no UPDATE — append-only)
--   ai_messages:        SELECT, INSERT (no UPDATE/DELETE — immutable, cascade from conversation)
--   body_measurements:  SELECT, INSERT, UPDATE, DELETE (new table)
--   exercise_library:   SELECT (global + own), INSERT, UPDATE, DELETE (own only)
--
-- NEW INDEXES (11):
--   idx_sets_exercise_name, idx_sets_workout_exercise, idx_workouts_finished,
--   idx_workouts_user_volume, idx_prs_user_date, idx_prs_workout,
--   idx_workouts_template, idx_templates_user_sort, idx_profiles_plan,
--   idx_profiles_quota_reset, idx_ai_msgs_conv_role
--   + 3 indexes on new tables
--
-- NEW COLUMNS (7):
--   workout_sets.rest_secs, workout_sets.set_type, workout_sets.muscle_group,
--   workouts.energy_rating, profiles.preferred_rest_secs,
--   templates.last_used_at, template_exercises.muscle_group
--
-- NEW TABLES (2):
--   body_measurements — track weight/body fat over time
--   exercise_library  — shared + custom exercise catalog
-- ============================================================
