-- Analytics Migration: User Login Tracking + Page Navigation
-- Run this in Supabase Dashboard SQL Editor

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_login_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    login_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    session_count INTEGER NOT NULL DEFAULT 1,
    platform      TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web', 'android', 'ios')),
    app_version   TEXT,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, login_date)
);

CREATE TABLE IF NOT EXISTS public.user_page_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    screen_name     TEXT NOT NULL,
    previous_screen TEXT,
    platform        TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web', 'android', 'ios')),
    app_version     TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.user_login_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_page_events  ENABLE ROW LEVEL SECURITY;

-- user_login_events: users can read/insert/update their own rows
-- (UPDATE needed for ON CONFLICT ... DO UPDATE path via SECURITY DEFINER RPC)
CREATE POLICY "Users can view own login events"
    ON public.user_login_events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own login events"
    ON public.user_login_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own login events"
    ON public.user_login_events FOR UPDATE
    USING (auth.uid() = user_id);

-- user_page_events: append-only (no UPDATE policy)
CREATE POLICY "Users can view own page events"
    ON public.user_page_events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own page events"
    ON public.user_page_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Indexes (idempotent)
-- ============================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_login_events_user_date') THEN
        CREATE INDEX idx_login_events_user_date ON public.user_login_events (user_id, login_date DESC);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_page_events_user_time') THEN
        CREATE INDEX idx_page_events_user_time ON public.user_page_events (user_id, created_at DESC);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_page_events_screen') THEN
        CREATE INDEX idx_page_events_screen ON public.user_page_events (screen_name, created_at DESC);
    END IF;
END $$;

-- ============================================================
-- updated_at trigger on user_login_events
-- Reuses existing update_updated_at() function from schema.sql
-- ============================================================

CREATE TRIGGER set_login_events_updated_at
    BEFORE UPDATE ON public.user_login_events
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- RPC: log_login_event
-- Atomic idempotent upsert — safe to call multiple times per day
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_login_event(
    p_user_id    UUID,
    p_platform   TEXT DEFAULT 'web',
    p_app_version TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.user_login_events (user_id, login_date, session_count, platform, app_version)
    VALUES (p_user_id, CURRENT_DATE, 1, p_platform, p_app_version)
    ON CONFLICT (user_id, login_date) DO UPDATE SET
        session_count = user_login_events.session_count + 1,
        updated_at    = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- View: user_14day_streak (admin-only — gap-and-island technique)
-- Do NOT grant to authenticated role. Query via SQL Editor only.
-- ============================================================

CREATE OR REPLACE VIEW public.user_14day_streak AS
WITH ranked_logins AS (
    SELECT
        user_id,
        login_date,
        login_date - CAST(ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) AS INTEGER) AS grp
    FROM public.user_login_events
),
streaks AS (
    SELECT
        user_id,
        MIN(login_date) AS streak_start,
        MAX(login_date) AS streak_end,
        COUNT(*)        AS streak_days
    FROM ranked_logins
    GROUP BY user_id, grp
)
SELECT
    user_id,
    MAX(streak_days)             AS longest_streak,
    MAX(streak_end)              AS last_login,
    bool_or(streak_days >= 14)   AS has_14day_streak,
    COUNT(*)                     AS total_streak_islands
FROM streaks
GROUP BY user_id;

-- ============================================================
-- Useful Admin Queries (run in Supabase Dashboard SQL Editor)
-- ============================================================

-- Users with 14-day streak (Play Store submission proof):
-- SELECT p.email, p.name, s.longest_streak, s.has_14day_streak, s.last_login
-- FROM public.user_14day_streak s
-- JOIN public.profiles p ON p.id = s.user_id
-- WHERE s.has_14day_streak = true ORDER BY s.longest_streak DESC;

-- Daily Active Users (last 30 days):
-- SELECT login_date, COUNT(DISTINCT user_id) AS dau, SUM(session_count) AS sessions
-- FROM public.user_login_events
-- WHERE login_date >= CURRENT_DATE - INTERVAL '30 days'
-- GROUP BY login_date ORDER BY login_date DESC;

-- Most-visited screens (all time):
-- SELECT screen_name, COUNT(*) AS views, COUNT(DISTINCT user_id) AS unique_users
-- FROM public.user_page_events
-- GROUP BY screen_name ORDER BY views DESC;

-- Per-user lifetime engagement summary:
-- SELECT p.email, p.name, p.plan,
--        COUNT(DISTINCT le.login_date) AS total_days_active,
--        MAX(le.login_date) AS last_seen,
--        COUNT(pe.id) AS total_screen_views
-- FROM public.profiles p
-- LEFT JOIN public.user_login_events le ON le.user_id = p.id
-- LEFT JOIN public.user_page_events pe ON pe.user_id = p.id
-- GROUP BY p.id, p.email, p.name, p.plan
-- ORDER BY total_days_active DESC NULLS LAST;
