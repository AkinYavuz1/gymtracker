# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Commands

```bash
npm run dev              # Start Vite dev server (http://localhost:3000)
npm run build            # Production build to dist/
npm run functions:deploy # Deploy Edge Functions (coach + stripe-webhook)
npm run db:push          # Push schema changes (if linked to Supabase)
npm run test             # Run Vitest test suite (191 tests)
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report
npm run setup            # Show setup instructions
```

## Architecture Overview

**gAIns** is an AI-powered gym tracking app with three layers:

### Frontend (React + Vite)
- **src/App.jsx**: Single monolithic component file (~1286 lines, ~90 KB) containing all screens, state, and logic
- **src/lib/supabase.js**: Supabase client initialization and helper functions for auth, data queries, and AI coach API calls (294 lines)
- **src/lib/exerciseGifs.js**: Exercise GIF/animation data (93 lines)
- **src/lib/offlineStorage.js**: Offline caching helpers (87 lines)
- **src/components/**, **src/screens/**: Component directories (currently empty — reserved for future splits)
- **src/main.jsx**: React entry point
- **Styling**: Tailwind CSS + inline styles with consistent theme colors (defined as object `C`)

### Backend (Supabase)
- **Database**: PostgreSQL with RLS (Row Level Security) policies
- **Auth**: Built-in email/Google/Apple auth via Supabase
- **Edge Functions**: Two Deno functions deployed via Supabase CLI:
  - `coach/index.ts` (219 lines): AI Coach endpoint using Claude Haiku with prompt caching
  - `stripe-webhook/index.ts` (137 lines): Subscription webhook handler
- **Shared**: `_shared/cors.ts` for CORS headers

### AI Integration
- Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) for lightweight, low-cost AI coaching
- Prompt caching reduces input token costs by ~90%
- Cost tracking: input $0.003/MTok, cache read $0.0003/MTok, output $0.015/MTok

### Payments
- Stripe integration for subscriptions (Free/Pro/Unlimited plans)
- Plans in `src/App.jsx` (lines 5-9) define pricing and query limits
- Webhook validates subscription state and updates user plan

## Database Schema

**Key Tables** (see `supabase/schema.sql`):

- `profiles` — User metadata (extends `auth.users`), stores `plan` (free/pro/unlimited), `ai_queries_used`, `ai_quota_reset_at`
- `templates` + `template_exercises` — Predefined workout templates
- `workouts` + `workout_sets` — Completed sessions with exercise data
- `personal_records` — Max lifts with auto-calculated 1RM (Epley formula)
- `ai_conversations` + `ai_messages` — Chat history and cost tracking per request

**Plan Limits** (hard-coded in schema):
- Free: 5 queries/day
- Pro: 30 queries/day
- Unlimited: 999 queries/day

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

### Adding Features
- **New screens**: Add case to `currentScreen` state and render conditionally
- **New data queries**: Add function to `supabase.js` following existing pattern
- **New Edge Function**: Add to `supabase/functions/YOUR_NAME/index.ts`, add to deploy script
- **Database changes**: Edit `supabase/schema.sql` and run migrations via CLI

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

No formal test suite configured. For manual testing:
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

- `src/App.jsx`: ~90 KB / ~1286 lines (large monolith; consider splitting if adding major features)
- `src/lib/supabase.js`: 294 lines
- `src/lib/exerciseGifs.js`: 93 lines
- `src/lib/offlineStorage.js`: 87 lines
- `supabase/functions/coach/index.ts`: 219 lines
- `supabase/schema.sql`: 429 lines
