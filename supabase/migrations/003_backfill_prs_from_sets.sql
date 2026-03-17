-- Backfill personal records (1RM and volume) from existing workout_sets
-- Clears all existing PRs first, then inserts exactly one 1RM and one volume PR per user+exercise

-- Clear existing PRs (will be rebuilt from workout_sets)
DELETE FROM public.personal_records;

-- Insert best 1RM PRs (highest estimated 1RM per user+exercise)
INSERT INTO public.personal_records (user_id, exercise_name, weight_kg, reps, pr_type, workout_id, achieved_at)
SELECT DISTINCT ON (w.user_id, ws.exercise_name)
    w.user_id,
    ws.exercise_name,
    ws.weight_kg,
    ws.reps,
    '1rm',
    ws.workout_id,
    w.finished_at
FROM public.workout_sets ws
JOIN public.workouts w ON w.id = ws.workout_id
WHERE ws.completed = true
  AND ws.weight_kg > 0
  AND ws.reps > 0
ORDER BY w.user_id, ws.exercise_name,
    CASE WHEN ws.reps = 1 THEN ws.weight_kg
         ELSE ROUND((ws.weight_kg * (1 + ws.reps / 30.0))::NUMERIC, 1)
    END DESC;

-- Insert best volume PRs (highest weight*reps per user+exercise)
INSERT INTO public.personal_records (user_id, exercise_name, weight_kg, reps, pr_type, workout_id, achieved_at)
SELECT DISTINCT ON (w.user_id, ws.exercise_name)
    w.user_id,
    ws.exercise_name,
    ws.weight_kg,
    ws.reps,
    'volume',
    ws.workout_id,
    w.finished_at
FROM public.workout_sets ws
JOIN public.workouts w ON w.id = ws.workout_id
WHERE ws.completed = true
  AND ws.weight_kg > 0
  AND ws.reps > 0
ORDER BY w.user_id, ws.exercise_name,
    (ws.weight_kg * ws.reps) DESC;
