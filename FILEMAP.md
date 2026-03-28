# File Map (token index)

Read this before any task to avoid loading unnecessary files.
Use `grep -n "=== SECTION:"` on App.jsx to jump directly to a screen.

## src/

- `App.jsx` (7848 lines) — All UI screens and state; sections marked `// === SECTION: X ===`
  - SECTION: Shared Components (line 158) — MiniChart, Pill, WeightStepper, RepBubbles
  - SECTION: Pricing (line 272) — PricingScreen
  - SECTION: AI Coach (line 375) — AICoachScreen, chat UI, quota display
  - SECTION: Onboarding (line 876) — OnboardingScreen (multi-step first-run flow)
  - SECTION: Auth (line 1249) — AuthScreen (login / sign-up)
  - SECTION: Home / Dashboard (line 1387) — HomeScreen, weekly KPIs, schedule strip, nutrition card
  - SECTION: Template Picker (line 1492) — TemplatePicker, normaliseTemplate
  - SECTION: Workout (line 1586) — WorkoutScreen (active session tracking)
  - SECTION: Stats (line 2083) — StatsScreen (charts, volume, muscle breakdown)
  - SECTION: Export (line 2376) — Export functionality
  - SECTION: History (line 2709) — HistoryScreen (past workouts list)
  - SECTION: Week Detail (line 2883) — WeekDetailScreen (weekly breakdown)
  - SECTION: Day Detail (line 3231) — DayDetailScreen (single-day view)
  - SECTION: Personal Records (line 3340) — PRScreen (personal records)
  - SECTION: Notifications (line 3457) — NotificationScreen (push notification settings)
  - SECTION: Profile / Settings (line 3680) — ChangePasswordSection, ProfileModal
  - SECTION: Pre/Post Workout Modals (line 4240) — PreWorkoutCheckin, PostWorkoutFeedback, ProgressCheckinModal
  - SECTION: Program Onboarding (line 4530) — ProgramOnboardingScreen
  - SECTION: Program Builder (line 4833) — ProgramBuilderScreen
  - SECTION: Volume Dashboard (line 5420) — VolumeDashboardScreen
  - SECTION: Programs (line 5521) — ProgramScreen (program list, enrollment)
  - SECTION: Nutrition (line 5752) — NutritionScreen, CircleProgress, MacroPieChart (food logging, macros, water, barcode scanner, trends)
  - SECTION: Exercise Library (line 6466) — ExerciseLibraryScreen, ExerciseCard, ExerciseDetailModal, CustomExerciseForm
  - SECTION: Legal (line 6806) — LegalScreen (privacy/terms)
  - SECTION: App Root (GAIns) (line 6918) — Main component, all useState, routing logic

- `main.jsx` (9 lines) — React entry point, renders `<App>`
- `lib/supabase.js` (1492 lines) — Supabase client, auth helpers, data queries, `callCoachAPI()`, custom exercise CRUD, nutrition CRUD, Open Food Facts API
- `lib/nutritionEngine.js` (173 lines) — TDEE/macro calculation, protein timing analysis, food API parsing, calorie balance, water presets
- `lib/programEngine.js` (345 lines) — Workout program generation and scheduling logic
- `lib/notifications.js` (465 lines) — Push notification setup and scheduling (APNs/FCM); `sendPushNotification()` and `setNotificationActionHandler()` for app-side triggers
- `lib/exerciseGifs.js` (106 lines) — Static map of exercise name → GIF URL
- `lib/healthData.js` (130 lines) — Unified Apple Health / Google Fit abstraction (sleep, HRV data fetching)
- `lib/readinessScore.js` (82 lines) — Pure readiness score calculation and score band logic
- `lib/offlineStorage.js` (87 lines) — LocalStorage helpers for caching workouts offline
- `lib/animalWeights.js` (40 lines) — Static data: animal weight comparisons for fun UI stats

## supabase/

- `schema.sql` (1092 lines) — Full Postgres schema: tables, RLS policies, stored functions, triggers
- `migration_programs.sql` (343 lines) — Migration adding programs/cycles tables
- `migration_nutrition.sql` (228 lines) — Migration adding nutrition_goals, food_logs, food_favorites, water_logs tables with RLS and helper functions
- `seed_test_user.sql` (794 lines) — Seed data for testing
- `functions/coach/index.ts` (257 lines) — AI coach edge function: auth, quota check, Claude Haiku call
- `functions/stripe-webhook/index.ts` (126 lines) — Webhook: validates Stripe events, updates user plan
- `functions/create-checkout/index.ts` (128 lines) — Creates Stripe checkout session for plan upgrades
- `functions/send-notification/index.ts` (411 lines) — Sends push notifications via APNs/FCM
- `functions/schedule-notifications/index.ts` (268 lines) — Hourly cron job: workout reminders, weekly summary, AI tips, streak alerts
- `functions/_shared/cors.ts` (11 lines) — CORS headers shared across edge functions

## Root config

- `CLAUDE.md` — Architecture guide, commands, patterns
- `package.json` — Dependencies and npm scripts
- `vite.config.js` — Vite/Capacitor config
- `capacitor.config.json` — App ID, server URL for Capacitor
