-- ============================================================
-- NUTRITION TRACKING — Migration
-- ============================================================
-- INSTRUCTIONS:
-- 1. Go to your Supabase dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click "Run"
-- ============================================================


-- ─── NUTRITION GOALS ─────────────────────────────────────────
-- One row per user: daily calorie/macro targets

CREATE TABLE IF NOT EXISTS public.nutrition_goals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    calories        INTEGER NOT NULL DEFAULT 2000,
    protein_g       INTEGER NOT NULL DEFAULT 150,
    carbs_g         INTEGER NOT NULL DEFAULT 220,
    fat_g           INTEGER NOT NULL DEFAULT 65,
    calculation_method TEXT DEFAULT 'auto'
        CHECK (calculation_method IN ('auto', 'manual')),
    activity_level  TEXT DEFAULT 'moderate'
        CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
    goal_type       TEXT DEFAULT 'maintain'
        CHECK (goal_type IN ('lose', 'maintain', 'gain')),
    water_goal_ml   INTEGER DEFAULT 2500,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);


-- ─── FOOD LOGS ───────────────────────────────────────────────
-- Individual food entries per meal per day

CREATE TABLE IF NOT EXISTS public.food_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    log_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    meal_type       TEXT NOT NULL
        CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    food_name       TEXT NOT NULL,
    brand           TEXT,
    barcode         TEXT,
    serving_size    DECIMAL(8,1) DEFAULT 100,
    serving_unit    TEXT DEFAULT 'g',
    servings        DECIMAL(4,1) DEFAULT 1,
    calories        INTEGER NOT NULL DEFAULT 0,
    protein_g       DECIMAL(5,1) DEFAULT 0,
    carbs_g         DECIMAL(5,1) DEFAULT 0,
    fat_g           DECIMAL(5,1) DEFAULT 0,
    fiber_g         DECIMAL(5,1) DEFAULT 0,
    sugar_g         DECIMAL(5,1) DEFAULT 0,
    sodium_mg       DECIMAL(6,1) DEFAULT 0,
    off_product_id  TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);


-- ─── FOOD FAVORITES ──────────────────────────────────────────
-- Saved foods for quick re-logging

CREATE TABLE IF NOT EXISTS public.food_favorites (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    food_name       TEXT NOT NULL,
    brand           TEXT,
    barcode         TEXT,
    serving_size    DECIMAL(8,1) DEFAULT 100,
    serving_unit    TEXT DEFAULT 'g',
    calories        INTEGER NOT NULL DEFAULT 0,
    protein_g       DECIMAL(5,1) DEFAULT 0,
    carbs_g         DECIMAL(5,1) DEFAULT 0,
    fat_g           DECIMAL(5,1) DEFAULT 0,
    fiber_g         DECIMAL(5,1) DEFAULT 0,
    sugar_g         DECIMAL(5,1) DEFAULT 0,
    sodium_mg       DECIMAL(6,1) DEFAULT 0,
    off_product_id  TEXT,
    use_count       INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_food_favorites_unique
    ON public.food_favorites (user_id, food_name, COALESCE(brand, ''));


-- ─── WATER LOGS ──────────────────────────────────────────────
-- Multiple entries per day, summed for daily total

CREATE TABLE IF NOT EXISTS public.water_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    log_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    amount_ml       INTEGER NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now()
);


-- ─── INDEXES ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_food_logs_user_date
    ON public.food_logs (user_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_food_logs_date_meal
    ON public.food_logs (user_id, log_date, meal_type);

CREATE INDEX IF NOT EXISTS idx_food_favorites_user
    ON public.food_favorites (user_id, use_count DESC);

CREATE INDEX IF NOT EXISTS idx_water_logs_user_date
    ON public.water_logs (user_id, log_date);


-- ─── ROW LEVEL SECURITY ─────────────────────────────────────

ALTER TABLE public.nutrition_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own nutrition goals"
    ON public.nutrition_goals FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users CRUD own food logs"
    ON public.food_logs FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users CRUD own food favorites"
    ON public.food_favorites FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users CRUD own water logs"
    ON public.water_logs FOR ALL USING (auth.uid() = user_id);


-- ─── HELPER FUNCTIONS ────────────────────────────────────────

-- Get daily nutrition summary grouped by meal type
CREATE OR REPLACE FUNCTION public.get_daily_nutrition(p_user_id UUID, p_date DATE)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total', (
            SELECT json_build_object(
                'calories', COALESCE(SUM(calories), 0),
                'protein_g', COALESCE(SUM(protein_g), 0),
                'carbs_g', COALESCE(SUM(carbs_g), 0),
                'fat_g', COALESCE(SUM(fat_g), 0),
                'fiber_g', COALESCE(SUM(fiber_g), 0)
            )
            FROM public.food_logs
            WHERE user_id = p_user_id AND log_date = p_date
        ),
        'by_meal', (
            SELECT COALESCE(json_object_agg(meal_type, meal_data), '{}'::JSON)
            FROM (
                SELECT meal_type, json_build_object(
                    'calories', COALESCE(SUM(calories), 0),
                    'protein_g', COALESCE(SUM(protein_g), 0),
                    'carbs_g', COALESCE(SUM(carbs_g), 0),
                    'fat_g', COALESCE(SUM(fat_g), 0),
                    'count', COUNT(*)
                ) AS meal_data
                FROM public.food_logs
                WHERE user_id = p_user_id AND log_date = p_date
                GROUP BY meal_type
            ) meals
        ),
        'water_ml', (
            SELECT COALESCE(SUM(amount_ml), 0)
            FROM public.water_logs
            WHERE user_id = p_user_id AND log_date = p_date
        )
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Get weekly nutrition trend (last 7 days)
CREATE OR REPLACE FUNCTION public.get_nutrition_trend(p_user_id UUID, p_days INTEGER DEFAULT 7)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.log_date), '[]'::JSON)
    INTO result
    FROM (
        SELECT
            d.log_date,
            COALESCE(SUM(f.calories), 0)::INTEGER AS calories,
            COALESCE(SUM(f.protein_g), 0)::NUMERIC(6,1) AS protein_g,
            COALESCE(SUM(f.carbs_g), 0)::NUMERIC(6,1) AS carbs_g,
            COALESCE(SUM(f.fat_g), 0)::NUMERIC(6,1) AS fat_g,
            COALESCE(w.water_ml, 0) AS water_ml
        FROM generate_series(
            CURRENT_DATE - (p_days - 1),
            CURRENT_DATE,
            '1 day'::INTERVAL
        ) AS d(log_date)
        LEFT JOIN public.food_logs f
            ON f.user_id = p_user_id AND f.log_date = d.log_date::DATE
        LEFT JOIN (
            SELECT log_date, SUM(amount_ml) AS water_ml
            FROM public.water_logs
            WHERE user_id = p_user_id
            GROUP BY log_date
        ) w ON w.log_date = d.log_date::DATE
        GROUP BY d.log_date, w.water_ml
    ) t;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Auto-update updated_at on nutrition_goals
CREATE OR REPLACE FUNCTION public.handle_nutrition_goals_updated()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_nutrition_goals_updated
    BEFORE UPDATE ON public.nutrition_goals
    FOR EACH ROW EXECUTE FUNCTION public.handle_nutrition_goals_updated();
