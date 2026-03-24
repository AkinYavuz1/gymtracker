# CLAUDE.md

> **Always read `FILEMAP.md` first before any task** — it lists every file with line counts and section anchors so you can jump directly to the relevant code without loading unnecessary files.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Commands

```bash
npm run dev              # Start Vite dev server (http://localhost:3000)
npm run build            # Production build to dist/
npm run functions:deploy # Deploy Edge Functions (coach + stripe-webhook)
npm run db:push          # Push schema changes (if linked to Supabase)
npm run test             # Run Vitest test suite (400+ tests)
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report
npm run setup            # Show setup instructions
```

## Architecture Overview

**gAIns** is an AI-powered gym tracking app with three layers:

### Frontend (React + Vite)
- **src/App.jsx**: Single monolithic component file (~6719 lines) containing all screens, state, and logic
- **src/lib/supabase.js**: Supabase client initialization and helper functions for auth, data queries, and AI coach API calls (1144 lines)
- **src/lib/programEngine.js**: Workout program generation and scheduling logic (345 lines)
- **src/lib/notifications.js**: Push notification setup and scheduling via APNs/FCM (465 lines) — includes `sendPushNotification()` and `setNotificationActionHandler()` for app-side triggers
- **src/lib/healthData.js**: Unified Apple Health / Google Fit abstraction — sleep, HRV data fetching (130 lines)
- **src/lib/readinessScore.js**: Pure readiness score calculation and score band logic (82 lines)
- **src/lib/exerciseGifs.js**: Exercise GIF/animation data (106 lines)
- **src/lib/offlineStorage.js**: Offline caching helpers (87 lines)
- **src/lib/animalWeights.js**: Static animal weight comparisons for fun UI stats (40 lines)
- **src/components/**, **src/screens/**: Component directories (reserved for future splits)
- **src/main.jsx**: React entry point
- **Styling**: Tailwind CSS + inline styles with consistent theme colors (defined as object `C`)

### Backend (Supabase)
- **Database**: PostgreSQL with RLS (Row Level Security) policies
- **Auth**: Built-in email/Google/Apple auth via Supabase
- **Edge Functions**: Five Deno functions deployed via Supabase CLI:
  - `coach/index.ts` (257 lines): AI Coach endpoint using Claude Haiku with prompt caching
  - `stripe-webhook/index.ts` (126 lines): Subscription webhook handler
  - `create-checkout/index.ts` (128 lines): Creates Stripe checkout sessions
  - `send-notification/index.ts` (411 lines): Push notifications via APNs/FCM
  - `schedule-notifications/index.ts` (268 lines): Hourly cron job for scheduled notifications (workout reminders, weekly summary, AI tips, streak alerts)
- **Shared**: `_shared/cors.ts` for CORS headers

### AI Integration
- Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) for lightweight, low-cost AI coaching
- Prompt caching reduces input token costs by ~90%
- Cost tracking: input $0.003/MTok, cache read $0.0003/MTok, output $0.015/MTok

### Payments
- Stripe integration for subscriptions (Free/Pro/Unlimited plans)
- Plans defined in `src/App.jsx` — define pricing and query limits
- Webhook validates subscription state and updates user plan

## Database Schema

**Key Tables** (see `supabase/schema.sql`):

- `profiles` — User metadata (extends `auth.users`), stores `plan` (free/pro/unlimited), `ai_queries_used`, `ai_quota_reset_at`
- `templates` + `template_exercises` — Predefined workout templates
- `workouts` + `workout_sets` — Completed sessions with exercise data
- `personal_records` — Max lifts with auto-calculated 1RM (Epley formula)
- `ai_conversations` + `ai_messages` — Chat history and cost tracking per request
- `programs` + `program_cycles` — Workout programs and enrollment cycles (added via `migration_programs.sql`)
- `user_login_events` — One row per user per day; tracks `session_count`, `platform`, `app_version` (added via `migration_analytics.sql`)
- `user_page_events` — Append-only screen navigation log; tracks `screen_name`, `previous_screen`, `platform` (added via `migration_analytics.sql`)

**Plan Limits** (hard-coded in schema):
- Free: 5 queries/day
- Pro: 30 queries/day
- Unlimited: 999 queries/day

## Screens

All screens live in `src/App.jsx`. Use `// === SECTION: X ===` anchors to navigate (see FILEMAP.md for line numbers):

- **Auth** — Login / sign-up
- **Onboarding** — Multi-step first-run flow
- **Home / Dashboard** — Weekly KPIs, schedule strip
- **Workout** — Active session tracking
- **Template Picker** — Browse and start from templates
- **Stats** — Charts, volume, muscle breakdown
- **History** — Past workouts list
- **Week Detail** — Weekly breakdown with exercises, PRs, AI insights
- **Day Detail** — Single-day view
- **Personal Records** — PR tracking
- **Exercise Library** — Browse exercises, detail modal, custom exercise form
- **Programs** — Program list and enrollment
- **Program Onboarding** — Program setup flow
- **Program Builder** — Build custom programs
- **Volume Dashboard** — Volume tracking over time
- **AI Coach** — Chat UI with quota display
- **Notifications** — Push notification settings
- **Profile / Settings** — Password change, profile management
- **Pre/Post Workout Modals** — Check-in and feedback flows
- **Pricing** — Plan upgrade screen
- **Legal** — Privacy / terms

## Development Patterns

### Using Supabase
```javascript
import { supabase, getProfile, getWorkouts, callCoachAPI } from './lib/supabase';

// Auth
const { error } = await signUp(email, password, name);
const { error } = await signIn(email, password);
const session = await getSession();

// Data
const profile = await getProfile();
const workouts = await getWorkouts(limit);
const prs = await getPersonalRecords();

// AI Coach (calls Edge Function)
const response = await callCoachAPI(prompt, label, conversationId);

// Analytics (fire-and-forget, silently swallowed on error)
await logLoginEvent(userId, platform, appVersion); // idempotent upsert via RPC
await logPageEvent(userId, screenName, previousScreen, platform, appVersion);
```

### App Component State
`App.jsx` uses `useState` to manage:
- `user`, `profile` — Current user and their metadata
- `currentScreen` — Navigation (auth, dashboard, workout, coach, etc.)
- `aiState` — AI chat history, loading, quota checks
- Modal/drawer states for adding workouts, editing templates

### AI Coach Flow
1. User enters prompt in UI
2. `callCoachAPI()` in `supabase.js` sends request to Edge Function
3. Edge Function (`coach/index.ts`):
   - Authenticates user via Authorization header
   - Checks AI quota (RPC: `check_ai_quota`)
   - Builds context from DB (workouts, PRs, progress trends)
   - Calls Claude Haiku with prompt caching
   - Returns response + token costs
4. App displays response and deducts from user's daily quota

### Push Notifications
6 notification types are wired up via 2 delivery mechanisms:

**App-side (immediate/on-event)**:
- **PR Celebrations**: Triggered when `onFinish()` in WorkoutScreen detects new PRs. Sends random message from `PR_CELEBRATION_MESSAGES` pool with top PR details.
- **Rest Day Alerts**: Set when post-workout difficulty ≥ 9. Flag stored in `gains_rest_day_pending`. Sent on next app open if yesterday's date.

**Server-side (hourly cron, `schedule-notifications` edge function)**:
- **Workout Reminders** (9am UTC): Queries `scheduled_workouts` with today's date, sends to each user.
- **Weekly Summary** (Sunday 7pm UTC): Sends to all users with active subscriptions, deep-links to `weekDetail`.
- **AI Coach Tips** (Wednesday noon UTC): Rotates through 4 tips (recovery, form, tracking, nutrition).
- **Streak Alerts** (Friday 6pm UTC): Counts workouts since Monday, sends count to users with ≥1 workout this week.

All notifications respect user preferences in `notification_preferences` table (per-user toggles). Deep-link data passed via `data.screen` opens the corresponding app screen.

### Adding Features
- **New screens**: Add case to `currentScreen` state and render conditionally in `App.jsx`; update FILEMAP.md and CLAUDE.md with new section info
- **New data queries**: Add function to `supabase.js` following existing pattern
- **New Edge Function**: Add to `supabase/functions/YOUR_NAME/index.ts`, add to deploy script
- **Database changes**: Edit `supabase/schema.sql` and run migrations via CLI; add migration SQL file if needed

## Environment Setup

### Local Development
```bash
cp .env.example .env.local
# Edit .env.local with:
#   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
#   VITE_SUPABASE_ANON_KEY=eyJhbGc...
#   VITE_STRIPE_PRO_PRICE_ID=price_xxx
#   VITE_STRIPE_UNLIMITED_PRICE_ID=price_yyy
```

### Edge Functions (Requires Supabase CLI)
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase functions deploy coach
supabase functions deploy stripe-webhook
```

## Key Design Decisions

- **Monolithic App.jsx**: All UI logic in one file for simplicity; could be split later
- **Prompt Caching**: Enabled by default in coach Edge Function—system prompt cached across user queries
- **Inline Styles**: Theme colors and responsive layouts use inline CSS; avoids external CSS parsing
- **Direct Supabase**: Frontend queries Supabase directly for most operations; only complex logic (AI, billing) in Edge Functions
- **Deno/TypeScript**: Edge Functions written in TypeScript for type safety; deployed via Supabase CLI

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Missing Supabase credentials | Copy `.env.example` → `.env.local` and fill in values from Supabase dashboard |
| Edge Function deployment fails | Run `supabase login` and `supabase link --project-ref YOUR_REF` first |
| AI Coach 401 error | Check that user is authenticated and `Authorization` header is valid |
| Workouts not saving | Ensure `RLS` policies allow `INSERT` on `workouts` table for authenticated users |
| Build fails with Tailwind | Run `npm install` to ensure all CSS dependencies are installed |

## Testing

The project uses Vitest with 400+ tests. Follow these rules for all tasks:

1. **During development**: Only run the specific test file(s) for the code being changed. Use targeted commands:
   ```bash
   npx vitest run src/lib/__tests__/healthData.test.js
   npx vitest run src/__tests__/ProfileModal.test.jsx
   ```
   Do NOT run the full suite during iterative development — it wastes time and tokens.

2. **Before committing**: Run the full suite once with `npx vitest run` to catch indirect regressions.

3. **Verbose output**: Default to minimal output. Only add `--reporter=verbose` when a test fails and you need more detail to diagnose it.

4. **Missing test files**: If no test file exists for the code being changed, create one before running tests. Tests are a required part of feature delivery, not a separate task.

### Manual testing
- Run `npm run dev` and test UI flows locally
- Check Edge Function logs: Supabase Dashboard → Edge Functions → Logs
- Use browser DevTools to debug API responses
- Test auth flows (login, signup, Google/Apple if configured)

## APK Build (Android)

Uses Capacitor 8. Steps:
```bash
npm run build              # Build web assets
npx cap sync android       # Sync to Android project
cd android && ./gradlew assembleDebug   # Build APK → android/app/build/outputs/apk/debug/app-debug.apk
```

**Known issue — Java version mismatch:**
Capacitor 8 requires Java 21 but system has Java 17. Fix by patching these two files to use `VERSION_17`:
- `android/app/capacitor.build.gradle` (auto-regenerated on `npx cap sync` — re-patch each time)
- `android/capacitor-cordova-android-plugins/build.gradle`

## File Size Reference

See `FILEMAP.md` for authoritative current line counts. Approximate sizes:
- `src/App.jsx`: ~6719 lines (large monolith; use `// === SECTION: X ===` anchors to navigate)
- `src/lib/supabase.js`: ~1144 lines
- `supabase/schema.sql`: ~1092 lines
