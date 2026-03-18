-- ============================================================
-- REALISTIC TEST USER SEED — gAIns
-- ============================================================
-- User: Marcus Webb, 28yo intermediate lifter, 12 weeks PPL
--
-- HOW TO USE:
-- 1. Create the auth user in Supabase Dashboard:
--    Authentication → Users → Add user
--    Email: marcus@gainstest.dev   Password: TestUser123!
-- 2. Copy the UUID Supabase assigns
-- 3. Find every occurrence of 00000000-0000-0000-0000-000000000000
--    and replace with that UUID (there are many — use Find & Replace)
-- 4. Run in SQL Editor
-- ============================================================

-- ─── Replace this placeholder UUID everywhere below ──────────
-- USER UUID: 00000000-0000-0000-0000-000000000000

-- ─── PROFILE ────────────────────────────────────────────────
UPDATE public.profiles SET
    name = 'Marcus Webb',
    email = 'marcus@gainstest.dev',
    gender = 'male',
    age = 28,
    weight_kg = 82.0,
    height_cm = 178,
    body_fat_pct = 14.0,
    training_goal = 'hypertrophy',
    experience = 'intermediate',
    unit_system = 'metric',
    onboarding_complete = true,
    target_rate = 'moderate',
    years_lifting = 3,
    training_frequency = 4,
    focus_areas = ARRAY['Chest','Back','Arms'],
    plan = 'pro',
    ai_queries_today = 2,
    ai_queries_reset_at = CURRENT_DATE
WHERE id = '00000000-0000-0000-0000-000000000000';

-- ─── CLEAN UP any prior seed data ───────────────────────────
DELETE FROM public.workout_sets
WHERE workout_id IN (SELECT id FROM public.workouts WHERE user_id = '00000000-0000-0000-0000-000000000000');
DELETE FROM public.workouts       WHERE user_id = '00000000-0000-0000-0000-000000000000';
DELETE FROM public.personal_records WHERE user_id = '00000000-0000-0000-0000-000000000000';
DELETE FROM public.progress_checkins WHERE user_id = '00000000-0000-0000-0000-000000000000';
DELETE FROM public.ai_messages WHERE conversation_id IN (SELECT id FROM public.ai_conversations WHERE user_id = '00000000-0000-0000-0000-000000000000');
DELETE FROM public.ai_conversations WHERE user_id = '00000000-0000-0000-0000-000000000000';
DELETE FROM public.template_exercises WHERE template_id IN (SELECT id FROM public.templates WHERE user_id = '00000000-0000-0000-0000-000000000000');
DELETE FROM public.templates WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- ─── TEMPLATES ──────────────────────────────────────────────
INSERT INTO public.templates (id, user_id, name, color, icon, sort_order) VALUES
('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'Push Day', '#A78BFA', '💪', 0),
('a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'Pull Day', '#3CFFF0', '🔄', 1),
('a1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'Legs',     '#FF6B3C', '🦵', 2),
('a1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'Upper',    '#6C63FF', '⚡', 3);

INSERT INTO public.template_exercises (template_id, name, equipment, default_sets, default_reps, default_weight, sort_order) VALUES
-- Push
('a1000000-0000-0000-0000-000000000001', 'Bench Press',      'Barbell',   4, 8,  100, 0),
('a1000000-0000-0000-0000-000000000001', 'Incline DB Press', 'Dumbbell',  3, 10, 36,  1),
('a1000000-0000-0000-0000-000000000001', 'Cable Fly',        'Cable',     3, 12, 20,  2),
('a1000000-0000-0000-0000-000000000001', 'Overhead Press',   'Barbell',   3, 8,  65,  3),
('a1000000-0000-0000-0000-000000000001', 'Lateral Raise',    'Dumbbell',  3, 15, 12,  4),
-- Pull
('a1000000-0000-0000-0000-000000000002', 'Deadlift',         'Barbell',   4, 5,  150, 0),
('a1000000-0000-0000-0000-000000000002', 'Pull-ups',         'Bodyweight',4, 8,  0,   1),
('a1000000-0000-0000-0000-000000000002', 'Barbell Row',      'Barbell',   3, 8,  80,  2),
('a1000000-0000-0000-0000-000000000002', 'Face Pull',        'Cable',     3, 15, 25,  3),
('a1000000-0000-0000-0000-000000000002', 'Hammer Curl',      'Dumbbell',  3, 12, 18,  4),
-- Legs
('a1000000-0000-0000-0000-000000000003', 'Back Squat',       'Barbell',   4, 6,  120, 0),
('a1000000-0000-0000-0000-000000000003', 'Leg Press',        'Machine',   3, 10, 200, 1),
('a1000000-0000-0000-0000-000000000003', 'Romanian DL',      'Barbell',   3, 8,  90,  2),
('a1000000-0000-0000-0000-000000000003', 'Walking Lunge',    'Dumbbell',  3, 12, 24,  3),
('a1000000-0000-0000-0000-000000000003', 'Leg Curl',         'Machine',   3, 12, 50,  4),
-- Upper
('a1000000-0000-0000-0000-000000000004', 'Bench Press',      'Barbell',   4, 8,  100, 0),
('a1000000-0000-0000-0000-000000000004', 'Barbell Row',      'Barbell',   4, 8,  80,  1),
('a1000000-0000-0000-0000-000000000004', 'Overhead Press',   'Barbell',   3, 8,  65,  2),
('a1000000-0000-0000-0000-000000000004', 'Pull-ups',         'Bodyweight',3, 8,  0,   3),
('a1000000-0000-0000-0000-000000000004', 'Lateral Raise',    'Dumbbell',  3, 15, 12,  4);

-- ─── WORKOUTS ───────────────────────────────────────────────
-- Each workout gets a fixed UUID so sets can reference it directly.
-- Pattern: w[week][session] e.g. w12a = week 12 session A

-- == WEEK 12 ==

-- W12 Push A — Mar 3
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000001', 'Push Day',
 now()-INTERVAL'15 days'+TIME'09:00', now()-INTERVAL'15 days'+TIME'10:08', 4080, 14640);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000001','Bench Press',1,105,8,true,7),
('b0000000-0000-0000-0000-000000000001','Bench Press',2,105,8,true,8),
('b0000000-0000-0000-0000-000000000001','Bench Press',3,105,7,true,9),
('b0000000-0000-0000-0000-000000000001','Bench Press',4,102.5,7,true,9),
('b0000000-0000-0000-0000-000000000001','Incline DB Press',1,40,10,true,7),
('b0000000-0000-0000-0000-000000000001','Incline DB Press',2,40,10,true,8),
('b0000000-0000-0000-0000-000000000001','Incline DB Press',3,40,9,true,9),
('b0000000-0000-0000-0000-000000000001','Cable Fly',1,22,12,true,7),
('b0000000-0000-0000-0000-000000000001','Cable Fly',2,22,12,true,7),
('b0000000-0000-0000-0000-000000000001','Cable Fly',3,22,11,true,8),
('b0000000-0000-0000-0000-000000000001','Overhead Press',1,67.5,8,true,8),
('b0000000-0000-0000-0000-000000000001','Overhead Press',2,67.5,7,true,9),
('b0000000-0000-0000-0000-000000000001','Overhead Press',3,65,7,true,9),
('b0000000-0000-0000-0000-000000000001','Lateral Raise',1,14,15,true,7),
('b0000000-0000-0000-0000-000000000001','Lateral Raise',2,14,14,true,8),
('b0000000-0000-0000-0000-000000000001','Lateral Raise',3,12,15,true,7);

-- W12 Pull — Mar 4
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000002', 'Pull Day',
 now()-INTERVAL'14 days'+TIME'09:15', now()-INTERVAL'14 days'+TIME'10:18', 3780, 13900);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000002','Deadlift',1,155,5,true,7),
('b0000000-0000-0000-0000-000000000002','Deadlift',2,155,5,true,8),
('b0000000-0000-0000-0000-000000000002','Deadlift',3,155,4,true,9),
('b0000000-0000-0000-0000-000000000002','Deadlift',4,150,5,true,9),
('b0000000-0000-0000-0000-000000000002','Pull-ups',1,0,10,true,7),
('b0000000-0000-0000-0000-000000000002','Pull-ups',2,0,9,true,8),
('b0000000-0000-0000-0000-000000000002','Pull-ups',3,0,8,true,9),
('b0000000-0000-0000-0000-000000000002','Pull-ups',4,0,8,true,9),
('b0000000-0000-0000-0000-000000000002','Barbell Row',1,82.5,8,true,7),
('b0000000-0000-0000-0000-000000000002','Barbell Row',2,82.5,8,true,8),
('b0000000-0000-0000-0000-000000000002','Barbell Row',3,82.5,7,true,9),
('b0000000-0000-0000-0000-000000000002','Face Pull',1,27,15,true,6),
('b0000000-0000-0000-0000-000000000002','Face Pull',2,27,15,true,7),
('b0000000-0000-0000-0000-000000000002','Face Pull',3,27,13,true,8),
('b0000000-0000-0000-0000-000000000002','Hammer Curl',1,20,12,true,7),
('b0000000-0000-0000-0000-000000000002','Hammer Curl',2,20,11,true,8),
('b0000000-0000-0000-0000-000000000002','Hammer Curl',3,18,12,true,7);

-- W12 Legs — Mar 6
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000003', 'Legs',
 now()-INTERVAL'12 days'+TIME'09:00', now()-INTERVAL'12 days'+TIME'10:15', 4500, 19200);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000003','Back Squat',1,125,6,true,7),
('b0000000-0000-0000-0000-000000000003','Back Squat',2,125,6,true,8),
('b0000000-0000-0000-0000-000000000003','Back Squat',3,125,5,true,9),
('b0000000-0000-0000-0000-000000000003','Back Squat',4,122.5,5,true,9),
('b0000000-0000-0000-0000-000000000003','Leg Press',1,210,10,true,7),
('b0000000-0000-0000-0000-000000000003','Leg Press',2,210,10,true,7),
('b0000000-0000-0000-0000-000000000003','Leg Press',3,210,9,true,8),
('b0000000-0000-0000-0000-000000000003','Romanian DL',1,95,8,true,7),
('b0000000-0000-0000-0000-000000000003','Romanian DL',2,95,8,true,8),
('b0000000-0000-0000-0000-000000000003','Romanian DL',3,92.5,8,true,8),
('b0000000-0000-0000-0000-000000000003','Walking Lunge',1,26,12,true,7),
('b0000000-0000-0000-0000-000000000003','Walking Lunge',2,26,12,true,8),
('b0000000-0000-0000-0000-000000000003','Walking Lunge',3,24,12,true,8),
('b0000000-0000-0000-0000-000000000003','Leg Curl',1,52,12,true,7),
('b0000000-0000-0000-0000-000000000003','Leg Curl',2,52,11,true,8),
('b0000000-0000-0000-0000-000000000003','Leg Curl',3,50,12,true,7);

-- W12 Push B — Mar 7
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000001', 'Push Day',
 now()-INTERVAL'11 days'+TIME'08:45', now()-INTERVAL'11 days'+TIME'09:50', 3900, 14200);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000004','Bench Press',1,107.5,8,true,8),
('b0000000-0000-0000-0000-000000000004','Bench Press',2,107.5,7,true,9),
('b0000000-0000-0000-0000-000000000004','Bench Press',3,105,7,true,9),
('b0000000-0000-0000-0000-000000000004','Bench Press',4,105,6,true,10),
('b0000000-0000-0000-0000-000000000004','Incline DB Press',1,40,10,true,8),
('b0000000-0000-0000-0000-000000000004','Incline DB Press',2,40,9,true,9),
('b0000000-0000-0000-0000-000000000004','Incline DB Press',3,38,10,true,8),
('b0000000-0000-0000-0000-000000000004','Cable Fly',1,22,12,true,7),
('b0000000-0000-0000-0000-000000000004','Cable Fly',2,22,12,true,8),
('b0000000-0000-0000-0000-000000000004','Cable Fly',3,20,12,true,7),
('b0000000-0000-0000-0000-000000000004','Overhead Press',1,67.5,8,true,8),
('b0000000-0000-0000-0000-000000000004','Overhead Press',2,65,8,true,8),
('b0000000-0000-0000-0000-000000000004','Overhead Press',3,65,7,true,9),
('b0000000-0000-0000-0000-000000000004','Lateral Raise',1,14,15,true,7),
('b0000000-0000-0000-0000-000000000004','Lateral Raise',2,14,13,true,8),
('b0000000-0000-0000-0000-000000000004','Lateral Raise',3,12,15,true,7);

-- == WEEK 11 ==

-- W11 Pull A — Feb 24
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000002', 'Pull Day',
 now()-INTERVAL'22 days'+TIME'09:00', now()-INTERVAL'22 days'+TIME'10:05', 3900, 13400);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000005','Deadlift',1,152.5,5,true,7),
('b0000000-0000-0000-0000-000000000005','Deadlift',2,152.5,5,true,8),
('b0000000-0000-0000-0000-000000000005','Deadlift',3,152.5,5,true,8),
('b0000000-0000-0000-0000-000000000005','Deadlift',4,150,5,true,9),
('b0000000-0000-0000-0000-000000000005','Pull-ups',1,0,10,true,7),
('b0000000-0000-0000-0000-000000000005','Pull-ups',2,0,9,true,8),
('b0000000-0000-0000-0000-000000000005','Pull-ups',3,0,8,true,9),
('b0000000-0000-0000-0000-000000000005','Pull-ups',4,0,7,true,9),
('b0000000-0000-0000-0000-000000000005','Barbell Row',1,80,8,true,7),
('b0000000-0000-0000-0000-000000000005','Barbell Row',2,80,8,true,8),
('b0000000-0000-0000-0000-000000000005','Barbell Row',3,80,8,true,8),
('b0000000-0000-0000-0000-000000000005','Face Pull',1,25,15,true,6),
('b0000000-0000-0000-0000-000000000005','Face Pull',2,25,15,true,7),
('b0000000-0000-0000-0000-000000000005','Face Pull',3,25,14,true,7),
('b0000000-0000-0000-0000-000000000005','Hammer Curl',1,18,12,true,7),
('b0000000-0000-0000-0000-000000000005','Hammer Curl',2,18,12,true,7),
('b0000000-0000-0000-0000-000000000005','Hammer Curl',3,18,11,true,8);

-- W11 Legs — Feb 25
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000003', 'Legs',
 now()-INTERVAL'21 days'+TIME'09:30', now()-INTERVAL'21 days'+TIME'10:40', 4200, 18600);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000006','Back Squat',1,122.5,6,true,7),
('b0000000-0000-0000-0000-000000000006','Back Squat',2,122.5,6,true,8),
('b0000000-0000-0000-0000-000000000006','Back Squat',3,122.5,6,true,8),
('b0000000-0000-0000-0000-000000000006','Back Squat',4,120,6,true,9),
('b0000000-0000-0000-0000-000000000006','Leg Press',1,205,10,true,7),
('b0000000-0000-0000-0000-000000000006','Leg Press',2,205,10,true,7),
('b0000000-0000-0000-0000-000000000006','Leg Press',3,205,10,true,8),
('b0000000-0000-0000-0000-000000000006','Romanian DL',1,92.5,8,true,7),
('b0000000-0000-0000-0000-000000000006','Romanian DL',2,92.5,8,true,8),
('b0000000-0000-0000-0000-000000000006','Romanian DL',3,90,8,true,8),
('b0000000-0000-0000-0000-000000000006','Walking Lunge',1,24,12,true,7),
('b0000000-0000-0000-0000-000000000006','Walking Lunge',2,24,12,true,7),
('b0000000-0000-0000-0000-000000000006','Walking Lunge',3,24,11,true,8),
('b0000000-0000-0000-0000-000000000006','Leg Curl',1,50,12,true,7),
('b0000000-0000-0000-0000-000000000006','Leg Curl',2,50,12,true,7),
('b0000000-0000-0000-0000-000000000006','Leg Curl',3,50,11,true,8);

-- W11 Push — Feb 27
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000001', 'Push Day',
 now()-INTERVAL'19 days'+TIME'08:30', now()-INTERVAL'19 days'+TIME'09:35', 3900, 13800);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000007','Bench Press',1,102.5,8,true,7),
('b0000000-0000-0000-0000-000000000007','Bench Press',2,102.5,8,true,8),
('b0000000-0000-0000-0000-000000000007','Bench Press',3,102.5,8,true,8),
('b0000000-0000-0000-0000-000000000007','Bench Press',4,100,8,true,8),
('b0000000-0000-0000-0000-000000000007','Incline DB Press',1,38,10,true,7),
('b0000000-0000-0000-0000-000000000007','Incline DB Press',2,38,10,true,8),
('b0000000-0000-0000-0000-000000000007','Incline DB Press',3,38,9,true,8),
('b0000000-0000-0000-0000-000000000007','Cable Fly',1,20,12,true,7),
('b0000000-0000-0000-0000-000000000007','Cable Fly',2,20,12,true,7),
('b0000000-0000-0000-0000-000000000007','Cable Fly',3,20,12,true,7),
('b0000000-0000-0000-0000-000000000007','Overhead Press',1,65,8,true,7),
('b0000000-0000-0000-0000-000000000007','Overhead Press',2,65,8,true,8),
('b0000000-0000-0000-0000-000000000007','Overhead Press',3,65,7,true,9),
('b0000000-0000-0000-0000-000000000007','Lateral Raise',1,12,15,true,6),
('b0000000-0000-0000-0000-000000000007','Lateral Raise',2,12,15,true,7),
('b0000000-0000-0000-0000-000000000007','Lateral Raise',3,12,14,true,7);

-- W11 Pull B — Feb 28
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000002', 'Pull Day',
 now()-INTERVAL'18 days'+TIME'09:00', now()-INTERVAL'18 days'+TIME'09:58', 3480, 12900);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000008','Deadlift',1,150,5,true,7),
('b0000000-0000-0000-0000-000000000008','Deadlift',2,150,5,true,8),
('b0000000-0000-0000-0000-000000000008','Deadlift',3,150,5,true,8),
('b0000000-0000-0000-0000-000000000008','Deadlift',4,147.5,5,true,9),
('b0000000-0000-0000-0000-000000000008','Pull-ups',1,0,9,true,7),
('b0000000-0000-0000-0000-000000000008','Pull-ups',2,0,9,true,8),
('b0000000-0000-0000-0000-000000000008','Pull-ups',3,0,8,true,9),
('b0000000-0000-0000-0000-000000000008','Pull-ups',4,0,7,true,9),
('b0000000-0000-0000-0000-000000000008','Barbell Row',1,80,8,true,7),
('b0000000-0000-0000-0000-000000000008','Barbell Row',2,80,8,true,8),
('b0000000-0000-0000-0000-000000000008','Barbell Row',3,77.5,8,true,8),
('b0000000-0000-0000-0000-000000000008','Face Pull',1,25,15,true,6),
('b0000000-0000-0000-0000-000000000008','Face Pull',2,25,14,true,7),
('b0000000-0000-0000-0000-000000000008','Face Pull',3,25,13,true,7),
('b0000000-0000-0000-0000-000000000008','Hammer Curl',1,18,12,true,7),
('b0000000-0000-0000-0000-000000000008','Hammer Curl',2,18,12,true,7),
('b0000000-0000-0000-0000-000000000008','Hammer Curl',3,16,12,true,7);

-- == WEEK 10 ==

-- W10 Legs — Feb 18
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000003', 'Legs',
 now()-INTERVAL'28 days'+TIME'09:00', now()-INTERVAL'28 days'+TIME'10:12', 4320, 18100);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000009','Back Squat',1,120,6,true,7),
('b0000000-0000-0000-0000-000000000009','Back Squat',2,120,6,true,8),
('b0000000-0000-0000-0000-000000000009','Back Squat',3,120,6,true,8),
('b0000000-0000-0000-0000-000000000009','Back Squat',4,117.5,6,true,8),
('b0000000-0000-0000-0000-000000000009','Leg Press',1,200,10,true,7),
('b0000000-0000-0000-0000-000000000009','Leg Press',2,200,10,true,7),
('b0000000-0000-0000-0000-000000000009','Leg Press',3,200,10,true,8),
('b0000000-0000-0000-0000-000000000009','Romanian DL',1,90,8,true,7),
('b0000000-0000-0000-0000-000000000009','Romanian DL',2,90,8,true,8),
('b0000000-0000-0000-0000-000000000009','Romanian DL',3,90,8,true,8),
('b0000000-0000-0000-0000-000000000009','Walking Lunge',1,22,12,true,7),
('b0000000-0000-0000-0000-000000000009','Walking Lunge',2,22,12,true,7),
('b0000000-0000-0000-0000-000000000009','Walking Lunge',3,22,12,true,8),
('b0000000-0000-0000-0000-000000000009','Leg Curl',1,47,12,true,7),
('b0000000-0000-0000-0000-000000000009','Leg Curl',2,47,12,true,7),
('b0000000-0000-0000-0000-000000000009','Leg Curl',3,47,11,true,8);

-- W10 Push — Feb 20
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000001', 'Push Day',
 now()-INTERVAL'26 days'+TIME'08:45', now()-INTERVAL'26 days'+TIME'09:50', 3900, 13500);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000010','Bench Press',1,100,8,true,7),
('b0000000-0000-0000-0000-000000000010','Bench Press',2,100,8,true,8),
('b0000000-0000-0000-0000-000000000010','Bench Press',3,100,8,true,8),
('b0000000-0000-0000-0000-000000000010','Bench Press',4,100,7,true,9),
('b0000000-0000-0000-0000-000000000010','Incline DB Press',1,36,10,true,7),
('b0000000-0000-0000-0000-000000000010','Incline DB Press',2,36,10,true,8),
('b0000000-0000-0000-0000-000000000010','Incline DB Press',3,36,10,true,8),
('b0000000-0000-0000-0000-000000000010','Cable Fly',1,20,12,true,7),
('b0000000-0000-0000-0000-000000000010','Cable Fly',2,20,12,true,7),
('b0000000-0000-0000-0000-000000000010','Cable Fly',3,18,12,true,7),
('b0000000-0000-0000-0000-000000000010','Overhead Press',1,62.5,8,true,7),
('b0000000-0000-0000-0000-000000000010','Overhead Press',2,62.5,8,true,8),
('b0000000-0000-0000-0000-000000000010','Overhead Press',3,62.5,7,true,8),
('b0000000-0000-0000-0000-000000000010','Lateral Raise',1,12,15,true,6),
('b0000000-0000-0000-0000-000000000010','Lateral Raise',2,12,15,true,7),
('b0000000-0000-0000-0000-000000000010','Lateral Raise',3,12,14,true,7);

-- W10 Pull — Feb 21
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000002', 'Pull Day',
 now()-INTERVAL'25 days'+TIME'09:15', now()-INTERVAL'25 days'+TIME'10:20', 3900, 13200);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000011','Deadlift',1,147.5,5,true,7),
('b0000000-0000-0000-0000-000000000011','Deadlift',2,147.5,5,true,8),
('b0000000-0000-0000-0000-000000000011','Deadlift',3,147.5,5,true,8),
('b0000000-0000-0000-0000-000000000011','Deadlift',4,145,5,true,9),
('b0000000-0000-0000-0000-000000000011','Pull-ups',1,0,9,true,7),
('b0000000-0000-0000-0000-000000000011','Pull-ups',2,0,9,true,8),
('b0000000-0000-0000-0000-000000000011','Pull-ups',3,0,8,true,8),
('b0000000-0000-0000-0000-000000000011','Pull-ups',4,0,7,true,9),
('b0000000-0000-0000-0000-000000000011','Barbell Row',1,77.5,8,true,7),
('b0000000-0000-0000-0000-000000000011','Barbell Row',2,77.5,8,true,8),
('b0000000-0000-0000-0000-000000000011','Barbell Row',3,77.5,8,true,8),
('b0000000-0000-0000-0000-000000000011','Face Pull',1,25,15,true,6),
('b0000000-0000-0000-0000-000000000011','Face Pull',2,25,15,true,7),
('b0000000-0000-0000-0000-000000000011','Face Pull',3,22,15,true,7),
('b0000000-0000-0000-0000-000000000011','Hammer Curl',1,18,12,true,7),
('b0000000-0000-0000-0000-000000000011','Hammer Curl',2,18,12,true,7),
('b0000000-0000-0000-0000-000000000011','Hammer Curl',3,16,12,true,7);

-- == WEEK 9 (deload) ==

-- W9 Push deload — Feb 10
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg, notes) VALUES
('b0000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000001', 'Push Day',
 now()-INTERVAL'36 days'+TIME'10:00', now()-INTERVAL'36 days'+TIME'10:45', 2700, 9200, 'Deload week — 60% loads, feeling fresh');
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000012','Bench Press',1,80,8,true,5),
('b0000000-0000-0000-0000-000000000012','Bench Press',2,80,8,true,5),
('b0000000-0000-0000-0000-000000000012','Bench Press',3,80,8,true,6),
('b0000000-0000-0000-0000-000000000012','Overhead Press',1,50,10,true,5),
('b0000000-0000-0000-0000-000000000012','Overhead Press',2,50,10,true,5),
('b0000000-0000-0000-0000-000000000012','Overhead Press',3,50,10,true,6),
('b0000000-0000-0000-0000-000000000012','Lateral Raise',1,10,15,true,5),
('b0000000-0000-0000-0000-000000000012','Lateral Raise',2,10,15,true,5),
('b0000000-0000-0000-0000-000000000012','Lateral Raise',3,10,15,true,5);

-- W9 Legs deload — Feb 12
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg, notes) VALUES
('b0000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000003', 'Legs',
 now()-INTERVAL'34 days'+TIME'09:00', now()-INTERVAL'34 days'+TIME'09:50', 3000, 11400, 'Deload — joints feel much better');
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000013','Back Squat',1,90,6,true,5),
('b0000000-0000-0000-0000-000000000013','Back Squat',2,90,6,true,5),
('b0000000-0000-0000-0000-000000000013','Back Squat',3,90,6,true,6),
('b0000000-0000-0000-0000-000000000013','Romanian DL',1,70,8,true,5),
('b0000000-0000-0000-0000-000000000013','Romanian DL',2,70,8,true,5),
('b0000000-0000-0000-0000-000000000013','Romanian DL',3,70,8,true,6),
('b0000000-0000-0000-0000-000000000013','Leg Curl',1,35,12,true,5),
('b0000000-0000-0000-0000-000000000013','Leg Curl',2,35,12,true,5),
('b0000000-0000-0000-0000-000000000013','Leg Curl',3,35,12,true,5);

-- == WEEKS 8–6 ==

-- W8 Push — Feb 3
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000001', 'Push Day',
 now()-INTERVAL'43 days'+TIME'09:00', now()-INTERVAL'43 days'+TIME'10:10', 4200, 13200);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000014','Bench Press',1,97.5,8,true,7),
('b0000000-0000-0000-0000-000000000014','Bench Press',2,97.5,8,true,8),
('b0000000-0000-0000-0000-000000000014','Bench Press',3,97.5,7,true,8),
('b0000000-0000-0000-0000-000000000014','Bench Press',4,95,8,true,8),
('b0000000-0000-0000-0000-000000000014','Incline DB Press',1,34,10,true,7),
('b0000000-0000-0000-0000-000000000014','Incline DB Press',2,34,10,true,8),
('b0000000-0000-0000-0000-000000000014','Incline DB Press',3,34,9,true,8),
('b0000000-0000-0000-0000-000000000014','Cable Fly',1,18,12,true,7),
('b0000000-0000-0000-0000-000000000014','Cable Fly',2,18,12,true,7),
('b0000000-0000-0000-0000-000000000014','Cable Fly',3,18,11,true,8),
('b0000000-0000-0000-0000-000000000014','Overhead Press',1,60,8,true,7),
('b0000000-0000-0000-0000-000000000014','Overhead Press',2,60,8,true,8),
('b0000000-0000-0000-0000-000000000014','Overhead Press',3,60,7,true,8),
('b0000000-0000-0000-0000-000000000014','Lateral Raise',1,12,15,true,7),
('b0000000-0000-0000-0000-000000000014','Lateral Raise',2,12,14,true,7),
('b0000000-0000-0000-0000-000000000014','Lateral Raise',3,10,15,true,7);

-- W8 Pull — Feb 4
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000002', 'Pull Day',
 now()-INTERVAL'42 days'+TIME'09:30', now()-INTERVAL'42 days'+TIME'10:30', 3600, 12800);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000015','Deadlift',1,142.5,5,true,7),
('b0000000-0000-0000-0000-000000000015','Deadlift',2,142.5,5,true,8),
('b0000000-0000-0000-0000-000000000015','Deadlift',3,142.5,5,true,8),
('b0000000-0000-0000-0000-000000000015','Deadlift',4,140,5,true,9),
('b0000000-0000-0000-0000-000000000015','Pull-ups',1,0,9,true,7),
('b0000000-0000-0000-0000-000000000015','Pull-ups',2,0,8,true,8),
('b0000000-0000-0000-0000-000000000015','Pull-ups',3,0,8,true,8),
('b0000000-0000-0000-0000-000000000015','Pull-ups',4,0,7,true,9),
('b0000000-0000-0000-0000-000000000015','Barbell Row',1,75,8,true,7),
('b0000000-0000-0000-0000-000000000015','Barbell Row',2,75,8,true,8),
('b0000000-0000-0000-0000-000000000015','Barbell Row',3,75,7,true,8),
('b0000000-0000-0000-0000-000000000015','Face Pull',1,22,15,true,6),
('b0000000-0000-0000-0000-000000000015','Face Pull',2,22,15,true,7),
('b0000000-0000-0000-0000-000000000015','Face Pull',3,22,14,true,7),
('b0000000-0000-0000-0000-000000000015','Hammer Curl',1,16,12,true,7),
('b0000000-0000-0000-0000-000000000015','Hammer Curl',2,16,12,true,7),
('b0000000-0000-0000-0000-000000000015','Hammer Curl',3,16,11,true,8);

-- W8 Legs — Feb 6
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000003', 'Legs',
 now()-INTERVAL'40 days'+TIME'09:00', now()-INTERVAL'40 days'+TIME'10:10', 4200, 17500);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000016','Back Squat',1,117.5,6,true,7),
('b0000000-0000-0000-0000-000000000016','Back Squat',2,117.5,6,true,8),
('b0000000-0000-0000-0000-000000000016','Back Squat',3,117.5,5,true,9),
('b0000000-0000-0000-0000-000000000016','Back Squat',4,115,6,true,8),
('b0000000-0000-0000-0000-000000000016','Leg Press',1,195,10,true,7),
('b0000000-0000-0000-0000-000000000016','Leg Press',2,195,10,true,7),
('b0000000-0000-0000-0000-000000000016','Leg Press',3,195,9,true,8),
('b0000000-0000-0000-0000-000000000016','Romanian DL',1,87.5,8,true,7),
('b0000000-0000-0000-0000-000000000016','Romanian DL',2,87.5,8,true,8),
('b0000000-0000-0000-0000-000000000016','Romanian DL',3,85,8,true,8),
('b0000000-0000-0000-0000-000000000016','Walking Lunge',1,22,12,true,7),
('b0000000-0000-0000-0000-000000000016','Walking Lunge',2,22,11,true,8),
('b0000000-0000-0000-0000-000000000016','Walking Lunge',3,20,12,true,7),
('b0000000-0000-0000-0000-000000000016','Leg Curl',1,45,12,true,7),
('b0000000-0000-0000-0000-000000000016','Leg Curl',2,45,12,true,7),
('b0000000-0000-0000-0000-000000000016','Leg Curl',3,45,11,true,8);

-- W7 Push — Jan 27
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000001', 'Push Day',
 now()-INTERVAL'49 days'+TIME'09:00', now()-INTERVAL'49 days'+TIME'10:05', 3900, 12700);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000017','Bench Press',1,95,8,true,7),
('b0000000-0000-0000-0000-000000000017','Bench Press',2,95,8,true,8),
('b0000000-0000-0000-0000-000000000017','Bench Press',3,95,7,true,8),
('b0000000-0000-0000-0000-000000000017','Bench Press',4,92.5,8,true,8),
('b0000000-0000-0000-0000-000000000017','Incline DB Press',1,34,10,true,7),
('b0000000-0000-0000-0000-000000000017','Incline DB Press',2,34,9,true,8),
('b0000000-0000-0000-0000-000000000017','Incline DB Press',3,32,10,true,7),
('b0000000-0000-0000-0000-000000000017','Cable Fly',1,18,12,true,7),
('b0000000-0000-0000-0000-000000000017','Cable Fly',2,18,12,true,7),
('b0000000-0000-0000-0000-000000000017','Cable Fly',3,18,12,true,7),
('b0000000-0000-0000-0000-000000000017','Overhead Press',1,60,8,true,7),
('b0000000-0000-0000-0000-000000000017','Overhead Press',2,60,7,true,8),
('b0000000-0000-0000-0000-000000000017','Overhead Press',3,57.5,8,true,8),
('b0000000-0000-0000-0000-000000000017','Lateral Raise',1,12,15,true,6),
('b0000000-0000-0000-0000-000000000017','Lateral Raise',2,12,14,true,7),
('b0000000-0000-0000-0000-000000000017','Lateral Raise',3,10,15,true,6);

-- W7 Pull — Jan 28
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000002', 'Pull Day',
 now()-INTERVAL'48 days'+TIME'09:00', now()-INTERVAL'48 days'+TIME'09:55', 3300, 12200);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000018','Deadlift',1,140,5,true,7),
('b0000000-0000-0000-0000-000000000018','Deadlift',2,140,5,true,8),
('b0000000-0000-0000-0000-000000000018','Deadlift',3,140,5,true,8),
('b0000000-0000-0000-0000-000000000018','Deadlift',4,137.5,5,true,9),
('b0000000-0000-0000-0000-000000000018','Pull-ups',1,0,9,true,7),
('b0000000-0000-0000-0000-000000000018','Pull-ups',2,0,8,true,8),
('b0000000-0000-0000-0000-000000000018','Pull-ups',3,0,8,true,8),
('b0000000-0000-0000-0000-000000000018','Pull-ups',4,0,7,true,9),
('b0000000-0000-0000-0000-000000000018','Barbell Row',1,72.5,8,true,7),
('b0000000-0000-0000-0000-000000000018','Barbell Row',2,72.5,8,true,8),
('b0000000-0000-0000-0000-000000000018','Barbell Row',3,72.5,7,true,8),
('b0000000-0000-0000-0000-000000000018','Face Pull',1,22,15,true,6),
('b0000000-0000-0000-0000-000000000018','Face Pull',2,22,14,true,7),
('b0000000-0000-0000-0000-000000000018','Face Pull',3,20,15,true,7),
('b0000000-0000-0000-0000-000000000018','Hammer Curl',1,16,12,true,7),
('b0000000-0000-0000-0000-000000000018','Hammer Curl',2,16,11,true,8),
('b0000000-0000-0000-0000-000000000018','Hammer Curl',3,14,12,true,7);

-- W7 Legs — Jan 30
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000003', 'Legs',
 now()-INTERVAL'46 days'+TIME'09:15', now()-INTERVAL'46 days'+TIME'10:20', 3900, 17000);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000019','Back Squat',1,115,6,true,7),
('b0000000-0000-0000-0000-000000000019','Back Squat',2,115,6,true,8),
('b0000000-0000-0000-0000-000000000019','Back Squat',3,115,6,true,8),
('b0000000-0000-0000-0000-000000000019','Back Squat',4,112.5,6,true,8),
('b0000000-0000-0000-0000-000000000019','Leg Press',1,190,10,true,7),
('b0000000-0000-0000-0000-000000000019','Leg Press',2,190,10,true,7),
('b0000000-0000-0000-0000-000000000019','Leg Press',3,190,10,true,8),
('b0000000-0000-0000-0000-000000000019','Romanian DL',1,85,8,true,7),
('b0000000-0000-0000-0000-000000000019','Romanian DL',2,85,8,true,8),
('b0000000-0000-0000-0000-000000000019','Romanian DL',3,85,8,true,8),
('b0000000-0000-0000-0000-000000000019','Walking Lunge',1,20,12,true,7),
('b0000000-0000-0000-0000-000000000019','Walking Lunge',2,20,12,true,7),
('b0000000-0000-0000-0000-000000000019','Walking Lunge',3,20,12,true,8),
('b0000000-0000-0000-0000-000000000019','Leg Curl',1,45,12,true,7),
('b0000000-0000-0000-0000-000000000019','Leg Curl',2,45,12,true,7),
('b0000000-0000-0000-0000-000000000019','Leg Curl',3,42,12,true,8);

-- W6 Push — Jan 20
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000001', 'Push Day',
 now()-INTERVAL'56 days'+TIME'09:00', now()-INTERVAL'56 days'+TIME'10:00', 3600, 12300);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000020','Bench Press',1,92.5,8,true,7),
('b0000000-0000-0000-0000-000000000020','Bench Press',2,92.5,8,true,8),
('b0000000-0000-0000-0000-000000000020','Bench Press',3,92.5,7,true,8),
('b0000000-0000-0000-0000-000000000020','Bench Press',4,90,8,true,8),
('b0000000-0000-0000-0000-000000000020','Incline DB Press',1,32,10,true,7),
('b0000000-0000-0000-0000-000000000020','Incline DB Press',2,32,10,true,8),
('b0000000-0000-0000-0000-000000000020','Incline DB Press',3,32,9,true,8),
('b0000000-0000-0000-0000-000000000020','Cable Fly',1,18,12,true,7),
('b0000000-0000-0000-0000-000000000020','Cable Fly',2,18,12,true,7),
('b0000000-0000-0000-0000-000000000020','Cable Fly',3,16,12,true,7),
('b0000000-0000-0000-0000-000000000020','Overhead Press',1,57.5,8,true,7),
('b0000000-0000-0000-0000-000000000020','Overhead Press',2,57.5,8,true,8),
('b0000000-0000-0000-0000-000000000020','Overhead Press',3,57.5,7,true,8),
('b0000000-0000-0000-0000-000000000020','Lateral Raise',1,10,15,true,6),
('b0000000-0000-0000-0000-000000000020','Lateral Raise',2,10,15,true,6),
('b0000000-0000-0000-0000-000000000020','Lateral Raise',3,10,14,true,7);

-- W6 Pull — Jan 21
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000002', 'Pull Day',
 now()-INTERVAL'55 days'+TIME'09:30', now()-INTERVAL'55 days'+TIME'10:25', 3300, 11900);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000021','Deadlift',1,137.5,5,true,7),
('b0000000-0000-0000-0000-000000000021','Deadlift',2,137.5,5,true,8),
('b0000000-0000-0000-0000-000000000021','Deadlift',3,137.5,5,true,8),
('b0000000-0000-0000-0000-000000000021','Deadlift',4,135,5,true,9),
('b0000000-0000-0000-0000-000000000021','Pull-ups',1,0,8,true,7),
('b0000000-0000-0000-0000-000000000021','Pull-ups',2,0,8,true,8),
('b0000000-0000-0000-0000-000000000021','Pull-ups',3,0,7,true,8),
('b0000000-0000-0000-0000-000000000021','Pull-ups',4,0,7,true,9),
('b0000000-0000-0000-0000-000000000021','Barbell Row',1,70,8,true,7),
('b0000000-0000-0000-0000-000000000021','Barbell Row',2,70,8,true,8),
('b0000000-0000-0000-0000-000000000021','Barbell Row',3,70,7,true,8),
('b0000000-0000-0000-0000-000000000021','Face Pull',1,20,15,true,6),
('b0000000-0000-0000-0000-000000000021','Face Pull',2,20,15,true,7),
('b0000000-0000-0000-0000-000000000021','Face Pull',3,20,13,true,7),
('b0000000-0000-0000-0000-000000000021','Hammer Curl',1,14,12,true,7),
('b0000000-0000-0000-0000-000000000021','Hammer Curl',2,14,12,true,7),
('b0000000-0000-0000-0000-000000000021','Hammer Curl',3,14,11,true,8);

-- W6 Legs — Jan 23
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000003', 'Legs',
 now()-INTERVAL'53 days'+TIME'08:45', now()-INTERVAL'53 days'+TIME'09:55', 4200, 16400);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000022','Back Squat',1,112.5,6,true,7),
('b0000000-0000-0000-0000-000000000022','Back Squat',2,112.5,6,true,8),
('b0000000-0000-0000-0000-000000000022','Back Squat',3,112.5,6,true,8),
('b0000000-0000-0000-0000-000000000022','Back Squat',4,110,6,true,8),
('b0000000-0000-0000-0000-000000000022','Leg Press',1,185,10,true,7),
('b0000000-0000-0000-0000-000000000022','Leg Press',2,185,10,true,7),
('b0000000-0000-0000-0000-000000000022','Leg Press',3,185,9,true,8),
('b0000000-0000-0000-0000-000000000022','Romanian DL',1,82.5,8,true,7),
('b0000000-0000-0000-0000-000000000022','Romanian DL',2,82.5,8,true,8),
('b0000000-0000-0000-0000-000000000022','Romanian DL',3,80,8,true,8),
('b0000000-0000-0000-0000-000000000022','Walking Lunge',1,20,12,true,7),
('b0000000-0000-0000-0000-000000000022','Walking Lunge',2,20,12,true,8),
('b0000000-0000-0000-0000-000000000022','Walking Lunge',3,18,12,true,7),
('b0000000-0000-0000-0000-000000000022','Leg Curl',1,42,12,true,7),
('b0000000-0000-0000-0000-000000000022','Leg Curl',2,42,12,true,7),
('b0000000-0000-0000-0000-000000000022','Leg Curl',3,42,11,true,8);

-- == WEEKS 5–3 ==

-- W5 Push — Jan 13
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000001', 'Push Day',
 now()-INTERVAL'63 days'+TIME'09:00', now()-INTERVAL'63 days'+TIME'10:00', 3600, 11800);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000023','Bench Press',1,90,8,true,7),
('b0000000-0000-0000-0000-000000000023','Bench Press',2,90,8,true,7),
('b0000000-0000-0000-0000-000000000023','Bench Press',3,90,8,true,8),
('b0000000-0000-0000-0000-000000000023','Bench Press',4,87.5,8,true,8),
('b0000000-0000-0000-0000-000000000023','Incline DB Press',1,30,10,true,7),
('b0000000-0000-0000-0000-000000000023','Incline DB Press',2,30,10,true,7),
('b0000000-0000-0000-0000-000000000023','Incline DB Press',3,30,9,true,8),
('b0000000-0000-0000-0000-000000000023','Cable Fly',1,16,12,true,7),
('b0000000-0000-0000-0000-000000000023','Cable Fly',2,16,12,true,7),
('b0000000-0000-0000-0000-000000000023','Cable Fly',3,16,12,true,7),
('b0000000-0000-0000-0000-000000000023','Overhead Press',1,55,8,true,7),
('b0000000-0000-0000-0000-000000000023','Overhead Press',2,55,8,true,8),
('b0000000-0000-0000-0000-000000000023','Overhead Press',3,55,7,true,8),
('b0000000-0000-0000-0000-000000000023','Lateral Raise',1,10,15,true,6),
('b0000000-0000-0000-0000-000000000023','Lateral Raise',2,10,15,true,7),
('b0000000-0000-0000-0000-000000000023','Lateral Raise',3,10,13,true,7);

-- W5 Pull — Jan 14
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000002', 'Pull Day',
 now()-INTERVAL'62 days'+TIME'09:00', now()-INTERVAL'62 days'+TIME'10:00', 3600, 11600);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000024','Deadlift',1,132.5,5,true,7),
('b0000000-0000-0000-0000-000000000024','Deadlift',2,132.5,5,true,8),
('b0000000-0000-0000-0000-000000000024','Deadlift',3,132.5,5,true,8),
('b0000000-0000-0000-0000-000000000024','Deadlift',4,130,5,true,8),
('b0000000-0000-0000-0000-000000000024','Pull-ups',1,0,8,true,7),
('b0000000-0000-0000-0000-000000000024','Pull-ups',2,0,8,true,8),
('b0000000-0000-0000-0000-000000000024','Pull-ups',3,0,7,true,8),
('b0000000-0000-0000-0000-000000000024','Pull-ups',4,0,7,true,9),
('b0000000-0000-0000-0000-000000000024','Barbell Row',1,67.5,8,true,7),
('b0000000-0000-0000-0000-000000000024','Barbell Row',2,67.5,8,true,8),
('b0000000-0000-0000-0000-000000000024','Barbell Row',3,67.5,7,true,8),
('b0000000-0000-0000-0000-000000000024','Face Pull',1,20,15,true,6),
('b0000000-0000-0000-0000-000000000024','Face Pull',2,20,14,true,7),
('b0000000-0000-0000-0000-000000000024','Face Pull',3,18,15,true,7),
('b0000000-0000-0000-0000-000000000024','Hammer Curl',1,14,12,true,7),
('b0000000-0000-0000-0000-000000000024','Hammer Curl',2,14,12,true,7),
('b0000000-0000-0000-0000-000000000024','Hammer Curl',3,12,12,true,7);

-- W5 Legs — Jan 16
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000003', 'Legs',
 now()-INTERVAL'60 days'+TIME'09:00', now()-INTERVAL'60 days'+TIME'10:10', 4200, 15900);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000025','Back Squat',1,110,6,true,7),
('b0000000-0000-0000-0000-000000000025','Back Squat',2,110,6,true,7),
('b0000000-0000-0000-0000-000000000025','Back Squat',3,110,6,true,8),
('b0000000-0000-0000-0000-000000000025','Back Squat',4,107.5,6,true,8),
('b0000000-0000-0000-0000-000000000025','Leg Press',1,180,10,true,7),
('b0000000-0000-0000-0000-000000000025','Leg Press',2,180,10,true,7),
('b0000000-0000-0000-0000-000000000025','Leg Press',3,180,10,true,7),
('b0000000-0000-0000-0000-000000000025','Romanian DL',1,80,8,true,7),
('b0000000-0000-0000-0000-000000000025','Romanian DL',2,80,8,true,8),
('b0000000-0000-0000-0000-000000000025','Romanian DL',3,80,7,true,8),
('b0000000-0000-0000-0000-000000000025','Walking Lunge',1,18,12,true,7),
('b0000000-0000-0000-0000-000000000025','Walking Lunge',2,18,12,true,7),
('b0000000-0000-0000-0000-000000000025','Walking Lunge',3,18,11,true,8),
('b0000000-0000-0000-0000-000000000025','Leg Curl',1,40,12,true,7),
('b0000000-0000-0000-0000-000000000025','Leg Curl',2,40,12,true,7),
('b0000000-0000-0000-0000-000000000025','Leg Curl',3,40,11,true,8);

-- W4 Push — Jan 6
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000026', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000001', 'Push Day',
 now()-INTERVAL'70 days'+TIME'09:00', now()-INTERVAL'70 days'+TIME'09:55', 3300, 11200);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000026','Bench Press',1,87.5,8,true,7),
('b0000000-0000-0000-0000-000000000026','Bench Press',2,87.5,8,true,7),
('b0000000-0000-0000-0000-000000000026','Bench Press',3,87.5,7,true,8),
('b0000000-0000-0000-0000-000000000026','Bench Press',4,85,8,true,8),
('b0000000-0000-0000-0000-000000000026','Incline DB Press',1,28,10,true,7),
('b0000000-0000-0000-0000-000000000026','Incline DB Press',2,28,10,true,8),
('b0000000-0000-0000-0000-000000000026','Incline DB Press',3,28,9,true,8),
('b0000000-0000-0000-0000-000000000026','Cable Fly',1,16,12,true,7),
('b0000000-0000-0000-0000-000000000026','Cable Fly',2,16,11,true,7),
('b0000000-0000-0000-0000-000000000026','Cable Fly',3,14,12,true,7),
('b0000000-0000-0000-0000-000000000026','Overhead Press',1,52.5,8,true,7),
('b0000000-0000-0000-0000-000000000026','Overhead Press',2,52.5,8,true,8),
('b0000000-0000-0000-0000-000000000026','Overhead Press',3,52.5,7,true,8),
('b0000000-0000-0000-0000-000000000026','Lateral Raise',1,10,15,true,6),
('b0000000-0000-0000-0000-000000000026','Lateral Raise',2,10,14,true,7),
('b0000000-0000-0000-0000-000000000026','Lateral Raise',3,10,13,true,7);

-- W4 Pull — Jan 7
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000027', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000002', 'Pull Day',
 now()-INTERVAL'69 days'+TIME'09:00', now()-INTERVAL'69 days'+TIME'09:58', 3480, 11000);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000027','Deadlift',1,130,5,true,7),
('b0000000-0000-0000-0000-000000000027','Deadlift',2,130,5,true,8),
('b0000000-0000-0000-0000-000000000027','Deadlift',3,130,5,true,8),
('b0000000-0000-0000-0000-000000000027','Deadlift',4,127.5,5,true,9),
('b0000000-0000-0000-0000-000000000027','Pull-ups',1,0,8,true,7),
('b0000000-0000-0000-0000-000000000027','Pull-ups',2,0,8,true,8),
('b0000000-0000-0000-0000-000000000027','Pull-ups',3,0,7,true,8),
('b0000000-0000-0000-0000-000000000027','Pull-ups',4,0,6,true,9),
('b0000000-0000-0000-0000-000000000027','Barbell Row',1,65,8,true,7),
('b0000000-0000-0000-0000-000000000027','Barbell Row',2,65,8,true,7),
('b0000000-0000-0000-0000-000000000027','Barbell Row',3,65,8,true,8),
('b0000000-0000-0000-0000-000000000027','Face Pull',1,18,15,true,6),
('b0000000-0000-0000-0000-000000000027','Face Pull',2,18,14,true,7),
('b0000000-0000-0000-0000-000000000027','Face Pull',3,18,13,true,7),
('b0000000-0000-0000-0000-000000000027','Hammer Curl',1,14,12,true,7),
('b0000000-0000-0000-0000-000000000027','Hammer Curl',2,14,11,true,7),
('b0000000-0000-0000-0000-000000000027','Hammer Curl',3,12,12,true,7);

-- W4 Legs — Jan 9
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000028', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000003', 'Legs',
 now()-INTERVAL'67 days'+TIME'09:00', now()-INTERVAL'67 days'+TIME'10:05', 3900, 15200);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000028','Back Squat',1,107.5,6,true,7),
('b0000000-0000-0000-0000-000000000028','Back Squat',2,107.5,6,true,8),
('b0000000-0000-0000-0000-000000000028','Back Squat',3,107.5,5,true,9),
('b0000000-0000-0000-0000-000000000028','Back Squat',4,105,6,true,8),
('b0000000-0000-0000-0000-000000000028','Leg Press',1,175,10,true,7),
('b0000000-0000-0000-0000-000000000028','Leg Press',2,175,10,true,7),
('b0000000-0000-0000-0000-000000000028','Leg Press',3,175,9,true,8),
('b0000000-0000-0000-0000-000000000028','Romanian DL',1,77.5,8,true,7),
('b0000000-0000-0000-0000-000000000028','Romanian DL',2,77.5,8,true,8),
('b0000000-0000-0000-0000-000000000028','Romanian DL',3,75,8,true,8),
('b0000000-0000-0000-0000-000000000028','Walking Lunge',1,18,12,true,7),
('b0000000-0000-0000-0000-000000000028','Walking Lunge',2,18,11,true,8),
('b0000000-0000-0000-0000-000000000028','Walking Lunge',3,16,12,true,7),
('b0000000-0000-0000-0000-000000000028','Leg Curl',1,40,12,true,7),
('b0000000-0000-0000-0000-000000000028','Leg Curl',2,40,11,true,8),
('b0000000-0000-0000-0000-000000000028','Leg Curl',3,38,12,true,7);

-- W3 Push — Dec 30
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000029', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000001', 'Push Day',
 now()-INTERVAL'77 days'+TIME'10:00', now()-INTERVAL'77 days'+TIME'10:55', 3300, 10600);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000029','Bench Press',1,85,8,true,7),
('b0000000-0000-0000-0000-000000000029','Bench Press',2,85,8,true,7),
('b0000000-0000-0000-0000-000000000029','Bench Press',3,85,7,true,8),
('b0000000-0000-0000-0000-000000000029','Bench Press',4,82.5,8,true,8),
('b0000000-0000-0000-0000-000000000029','Incline DB Press',1,28,10,true,7),
('b0000000-0000-0000-0000-000000000029','Incline DB Press',2,28,9,true,7),
('b0000000-0000-0000-0000-000000000029','Incline DB Press',3,26,10,true,7),
('b0000000-0000-0000-0000-000000000029','Cable Fly',1,14,12,true,7),
('b0000000-0000-0000-0000-000000000029','Cable Fly',2,14,12,true,7),
('b0000000-0000-0000-0000-000000000029','Cable Fly',3,14,11,true,7),
('b0000000-0000-0000-0000-000000000029','Overhead Press',1,50,8,true,7),
('b0000000-0000-0000-0000-000000000029','Overhead Press',2,50,8,true,7),
('b0000000-0000-0000-0000-000000000029','Overhead Press',3,50,8,true,8),
('b0000000-0000-0000-0000-000000000029','Lateral Raise',1,10,15,true,6),
('b0000000-0000-0000-0000-000000000029','Lateral Raise',2,10,13,true,7),
('b0000000-0000-0000-0000-000000000029','Lateral Raise',3,8,15,true,6);

-- W3 Pull — Dec 31
INSERT INTO public.workouts (id, user_id, template_id, title, started_at, finished_at, duration_secs, total_volume_kg) VALUES
('b0000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000002', 'Pull Day',
 now()-INTERVAL'76 days'+TIME'09:30', now()-INTERVAL'76 days'+TIME'10:25', 3300, 10500);
INSERT INTO public.workout_sets (workout_id, exercise_name, set_number, weight_kg, reps, completed, rpe) VALUES
('b0000000-0000-0000-0000-000000000030','Deadlift',1,127.5,5,true,7),
('b0000000-0000-0000-0000-000000000030','Deadlift',2,127.5,5,true,8),
('b0000000-0000-0000-0000-000000000030','Deadlift',3,127.5,5,true,8),
('b0000000-0000-0000-0000-000000000030','Deadlift',4,125,5,true,8),
('b0000000-0000-0000-0000-000000000030','Pull-ups',1,0,8,true,7),
('b0000000-0000-0000-0000-000000000030','Pull-ups',2,0,7,true,8),
('b0000000-0000-0000-0000-000000000030','Pull-ups',3,0,7,true,8),
('b0000000-0000-0000-0000-000000000030','Pull-ups',4,0,6,true,9),
('b0000000-0000-0000-0000-000000000030','Barbell Row',1,62.5,8,true,7),
('b0000000-0000-0000-0000-000000000030','Barbell Row',2,62.5,8,true,7),
('b0000000-0000-0000-0000-000000000030','Barbell Row',3,62.5,7,true,8),
('b0000000-0000-0000-0000-000000000030','Face Pull',1,18,15,true,6),
('b0000000-0000-0000-0000-000000000030','Face Pull',2,18,14,true,6),
('b0000000-0000-0000-0000-000000000030','Face Pull',3,16,15,true,7),
('b0000000-0000-0000-0000-000000000030','Hammer Curl',1,12,12,true,7),
('b0000000-0000-0000-0000-000000000030','Hammer Curl',2,12,12,true,7),
('b0000000-0000-0000-0000-000000000030','Hammer Curl',3,12,10,true,8);

-- ─── PERSONAL RECORDS ───────────────────────────────────────
INSERT INTO public.personal_records (user_id, exercise_name, weight_kg, reps, pr_type, achieved_at, is_active) VALUES
('00000000-0000-0000-0000-000000000000', 'Bench Press',     107.5, 7,  '1rm',    now()-INTERVAL'11 days', true),
('00000000-0000-0000-0000-000000000000', 'Bench Press',     105,   8,  'volume', now()-INTERVAL'15 days', true),
('00000000-0000-0000-0000-000000000000', 'Deadlift',        155,   5,  '1rm',    now()-INTERVAL'14 days', true),
('00000000-0000-0000-0000-000000000000', 'Deadlift',        155,   5,  'volume', now()-INTERVAL'14 days', true),
('00000000-0000-0000-0000-000000000000', 'Back Squat',      125,   6,  '1rm',    now()-INTERVAL'12 days', true),
('00000000-0000-0000-0000-000000000000', 'Back Squat',      125,   6,  'volume', now()-INTERVAL'12 days', true),
('00000000-0000-0000-0000-000000000000', 'Overhead Press',  67.5,  8,  '1rm',    now()-INTERVAL'15 days', true),
('00000000-0000-0000-0000-000000000000', 'Barbell Row',     82.5,  8,  '1rm',    now()-INTERVAL'14 days', true),
('00000000-0000-0000-0000-000000000000', 'Incline DB Press',40,    10, '1rm',    now()-INTERVAL'15 days', true),
('00000000-0000-0000-0000-000000000000', 'Leg Press',       210,   10, '1rm',    now()-INTERVAL'12 days', true),
('00000000-0000-0000-0000-000000000000', 'Romanian DL',     95,    8,  '1rm',    now()-INTERVAL'12 days', true),
('00000000-0000-0000-0000-000000000000', 'Pull-ups',        0,     10, '1rm',    now()-INTERVAL'14 days', true);

-- ─── PROGRESS CHECK-INS ─────────────────────────────────────
INSERT INTO public.progress_checkins (user_id, checkin_date, bodyweight_kg, measurements, performance_notes) VALUES
('00000000-0000-0000-0000-000000000000', CURRENT_DATE-84, 80.2, '{"waist_cm":82,"chest_cm":102}', 'Starting point. Feeling motivated, sleep is good.'),
('00000000-0000-0000-0000-000000000000', CURRENT_DATE-70, 80.8, '{"waist_cm":82,"chest_cm":103}', 'Up 0.6kg. Lifts moving steadily. Added calories slightly.'),
('00000000-0000-0000-0000-000000000000', CURRENT_DATE-56, 81.4, '{"waist_cm":82,"chest_cm":103}', 'Bench hit 95kg for 8. Feeling strong.'),
('00000000-0000-0000-0000-000000000000', CURRENT_DATE-42, 81.0, '{"waist_cm":81,"chest_cm":104}', 'Deload week done — weight dipped, feeling fresh.'),
('00000000-0000-0000-0000-000000000000', CURRENT_DATE-28, 81.7, '{"waist_cm":81,"chest_cm":104}', 'Post-deload bounce. Deadlift hit 150kg x5. Best week yet.'),
('00000000-0000-0000-0000-000000000000', CURRENT_DATE-14, 82.0, '{"waist_cm":81,"chest_cm":105}', 'Bench PR: 107.5kg x7. Shoulder feels slightly tight.');

-- ─── AI CONVERSATIONS ───────────────────────────────────────
INSERT INTO public.ai_conversations (id, user_id, created_at) VALUES
('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', now()-INTERVAL'30 days');
INSERT INTO public.ai_messages (conversation_id, role, content, label, input_tokens, output_tokens, cost_usd, created_at) VALUES
('c0000000-0000-0000-0000-000000000001', 'user',      'Is my weekly volume appropriate for hypertrophy?', 'Volume check', 800, 0, 0.0008, now()-INTERVAL'30 days'),
('c0000000-0000-0000-0000-000000000001', 'assistant', 'Based on your recent training, you''re hitting roughly 16 sets per muscle group per week — right in the hypertrophy sweet spot (10–20 sets). Chest and quads look well covered. One area to watch: rear delts via Face Pulls are only 3x15 once a week. Consider adding a second rear-delt slot on Pull B if recovery allows.', 'Volume check', 1200, 180, 0.0039, now()-INTERVAL'30 days'+INTERVAL'5 seconds');

INSERT INTO public.ai_conversations (id, user_id, created_at) VALUES
('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', now()-INTERVAL'10 days');
INSERT INTO public.ai_messages (conversation_id, role, content, label, input_tokens, output_tokens, cost_usd, created_at) VALUES
('c0000000-0000-0000-0000-000000000002', 'user',      'My bench stalled at 107.5kg. Give me a 3-week breakthrough plan.', 'Break plateau', 820, 0, 0.0008, now()-INTERVAL'10 days'),
('c0000000-0000-0000-0000-000000000002', 'assistant', 'Your bench has been stuck at 107.5kg for two sessions — classic early plateau. 3-week plan: Week 1: drop to 95kg, 5x5 with 3-min rest, focus on bar path. Week 2: 100kg, 4x6, add 1s paused reps. Week 3: retest 107.5kg for max clean reps. Also add 3 sets close-grip bench — tricep lockout is usually the limiter at this load.', 'Break plateau', 1400, 220, 0.0047, now()-INTERVAL'10 days'+INTERVAL'6 seconds');

-- notification_preferences table omitted (not yet migrated)
