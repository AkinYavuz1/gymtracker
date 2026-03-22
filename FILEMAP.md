# File Map (token index)

Read this before any task to avoid loading unnecessary files.
Use `grep -n "=== SECTION:"` on App.jsx to jump directly to a screen.

## src/

- `App.jsx` (6316 lines) — All UI screens and state; sections marked `// === SECTION: X ===`
  - SECTION: Shared Components (line 94) — MiniChart, Pill, WeightStepper, RepBubbles
  - SECTION: Pricing (line 121) — PricingScreen
  - SECTION: AI Coach (line 224) — AICoachScreen, chat UI, quota display
  - SECTION: Onboarding (line 454) — OnboardingScreen (multi-step first-run flow)
  - SECTION: Auth (line 811) — AuthScreen (login / sign-up)
  - SECTION: Home / Dashboard (line 905) — HomeScreen, weekly KPIs, schedule strip
  - SECTION: Template Picker (line 1006) — TemplatePicker, normaliseTemplate
  - SECTION: Workout (line 1100) — WorkoutScreen (active session tracking)
  - SECTION: Stats (line 1391) — StatsScreen (charts, volume, muscle breakdown)
  - SECTION: History (line 1684) — HistoryScreen (past workouts list)
  - SECTION: Week Detail (line 1845) — WeekDetailScreen (weekly breakdown)
  - SECTION: Day Detail (line 2195) — DayDetailScreen (single-day view)
  - SECTION: Personal Records (line 2306) — PRScreen (personal records)
  - SECTION: Notifications (line 2425) — NotificationScreen (push notification settings)
  - SECTION: Profile / Settings (line 2627) — ChangePasswordSection, ProfileModal
  - SECTION: Pre/Post Workout Modals (line 2948) — PreWorkoutCheckin, PostWorkoutFeedback, ProgressCheckinModal
  - SECTION: Program Onboarding (line 3153) — ProgramOnboardingScreen
  - SECTION: Program Builder (line 3456) — ProgramBuilderScreen
  - SECTION: Volume Dashboard (line 3813) — VolumeDashboardScreen
  - SECTION: Programs (line 3914) — ProgramScreen (program list, enrollment)
  - SECTION: Exercise Library (line ~4960) — ExerciseLibraryScreen, ExerciseCard, ExerciseDetailModal, CustomExerciseForm
  - SECTION: Legal (~line 5320) — LegalScreen (privacy/terms)
  - SECTION: App Root (GAIns) (line 4242) — Main component, all useState, routing logic

- `main.jsx` (9 lines) — React entry point, renders `<App>`
- `lib/supabase.js` (1144 lines) — Supabase client, auth helpers, data queries, `callCoachAPI()`, custom exercise CRUD
- `lib/programEngine.js` (345 lines) — Workout program generation and scheduling logic
- `lib/notifications.js` (343 lines) — Push notification setup and scheduling (APNs/FCM)
- `lib/exerciseGifs.js` (106 lines) — Static map of exercise name → GIF URL
- `lib/healthData.js` (130 lines) — Unified Apple Health / Google Fit abstraction (sleep, HRV data fetching)
- `lib/readinessScore.js` (82 lines) — Pure readiness score calculation and score band logic
- `lib/offlineStorage.js` (87 lines) — LocalStorage helpers for caching workouts offline
- `lib/animalWeights.js` (40 lines) — Static data: animal weight comparisons for fun UI stats

## supabase/

- `schema.sql` (1092 lines) — Full Postgres schema: tables, RLS policies, stored functions, triggers
- `migration_programs.sql` (343 lines) — Migration adding programs/cycles tables
- `seed_test_user.sql` (794 lines) — Seed data for testing
- `functions/coach/index.ts` (257 lines) — AI coach edge function: auth, quota check, Claude Haiku call
- `functions/stripe-webhook/index.ts` (126 lines) — Webhook: validates Stripe events, updates user plan
- `functions/create-checkout/index.ts` (128 lines) — Creates Stripe checkout session for plan upgrades
- `functions/send-notification/index.ts` (411 lines) — Sends push notifications via APNs/FCM
- `functions/_shared/cors.ts` (11 lines) — CORS headers shared across edge functions

## Root config

- `CLAUDE.md` — Architecture guide, commands, patterns
- `package.json` — Dependencies and npm scripts
- `vite.config.js` — Vite/Capacitor config
- `capacitor.config.json` — App ID, server URL for Capacitor
