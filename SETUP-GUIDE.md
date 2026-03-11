# GymTracker — Supabase Deployment Guide

## What You're Deploying

A gym tracking mobile app with AI coaching, backed by:
- **Supabase** — Database, Auth, Edge Functions (free tier)
- **Anthropic API** — AI Coach via Haiku 4.5 (~$0.003/query)
- **Stripe** — Subscription billing (free, pro, unlimited plans)
- **Vercel** or **Expo** — Frontend hosting

---

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up
2. Click **New Project**
3. Choose a name (e.g., `gymtracker`), set a database password, pick a region
4. Save your project credentials (you'll need them later):
   - `Project URL` — found in Settings → API
   - `anon/public key` — found in Settings → API
   - `service_role key` — found in Settings → API (keep this secret!)

---

## Step 2: Set Up the Database

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Paste the entire contents of `supabase-schema.sql`
4. Click **Run**

This creates all tables, indexes, Row Level Security policies, and helper
functions. It also sets up auto-profile creation when users sign up.

---

## Step 3: Enable Authentication

1. Go to **Authentication** → **Providers**
2. Enable the providers you want:
   - **Email** (enabled by default)
   - **Google** — requires OAuth credentials from Google Cloud Console
   - **Apple** — requires Apple Developer account
3. Go to **Authentication** → **URL Configuration**
4. Set your **Site URL** to your frontend domain
5. Add any redirect URLs your app needs

---

## Step 4: Deploy Edge Functions

### Install Supabase CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Your project ref is the part after `https://` in your Supabase URL
(e.g., `abcdefghijklm`).

### Set Secrets

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
supabase secrets set STRIPE_SECRET_KEY=sk_live_your-key-here
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your-secret-here
```

### Create Function Directories

```bash
mkdir -p supabase/functions/_shared
mkdir -p supabase/functions/coach
mkdir -p supabase/functions/stripe-webhook
```

### Copy Files

- `supabase-shared-cors.ts` → `supabase/functions/_shared/cors.ts`
- `supabase-edge-function-coach.ts` → `supabase/functions/coach/index.ts`
- `supabase-edge-function-stripe.ts` → `supabase/functions/stripe-webhook/index.ts`

### Deploy

```bash
supabase functions deploy coach
supabase functions deploy stripe-webhook
```

Your AI Coach endpoint will be live at:
`https://YOUR_PROJECT.supabase.co/functions/v1/coach`

---

## Step 5: Set Up Stripe

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Go to **Products** and create two products:

   **GymTracker Pro** — $4.99/month
   - Copy the price ID (e.g., `price_1Qx...`)
   
   **GymTracker Unlimited** — $9.99/month
   - Copy the price ID (e.g., `price_1Qy...`)

3. Update the `PRICE_TO_PLAN` mapping in `stripe-webhook/index.ts`
   with your real price IDs

4. Go to **Developers** → **Webhooks** → **Add endpoint**
   - URL: `https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook`
   - Events to listen for:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`

5. Copy the webhook signing secret and update your Supabase secrets:
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```

---

## Step 6: Connect the Frontend

In your React Native app (or React web app), initialize Supabase:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://YOUR_PROJECT.supabase.co',
  'your-anon-key'
);
```

Replace the `callCoachAPI()` function in the app with:

```javascript
async function callCoachAPI(prompt, history, conversationId) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(
    'https://YOUR_PROJECT.supabase.co/functions/v1/coach',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ prompt, label, conversationId }),
    }
  );
  
  return await response.json();
}
```

---

## Step 7: Create a Stripe Checkout Flow

When a user taps "Upgrade to Pro", call your checkout:

```javascript
// Create checkout session via Supabase Edge Function (or direct Stripe)
async function startCheckout(priceId) {
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(
    'https://YOUR_PROJECT.supabase.co/functions/v1/create-checkout',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ priceId }),
    }
  );
  
  const { url } = await response.json();
  // Open Stripe Checkout in browser
  window.open(url);
}
```

---

## File Structure

```
your-project/
├── supabase/
│   └── functions/
│       ├── _shared/
│       │   └── cors.ts              ← Shared CORS config
│       ├── coach/
│       │   └── index.ts             ← AI Coach endpoint
│       └── stripe-webhook/
│           └── index.ts             ← Stripe subscription handler
├── src/
│   ├── App.jsx                      ← Your gym tracker app
│   └── lib/
│       └── supabase.js              ← Supabase client init
├── supabase-schema.sql              ← Database schema (run once)
└── .env.local                       ← Local env vars (never commit)
```

---

## Environment Variables

For your frontend `.env.local`:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbG...
VITE_STRIPE_PRO_PRICE_ID=price_...
VITE_STRIPE_UNLIMITED_PRICE_ID=price_...
```

For Supabase Edge Functions (set via CLI):

```
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Cost Breakdown

### Free Tier (0 users to ~5,000)

| Service          | Monthly Cost |
|-----------------|-------------|
| Supabase Free   | $0          |
| Vercel Free     | $0          |
| Stripe          | $0 base     |
| Anthropic API   | Pay per use |

### At 1,000 users (10 queries/day)

| Service          | Monthly Cost |
|-----------------|-------------|
| Supabase Free   | $0           |
| Anthropic API   | ~$960        |
| Stripe fees     | ~$145        |
| **Total**       | **~$1,105**  |
| **Revenue** (all Pro) | **$4,990** |
| **Profit**      | **~$3,885**  |

### Cost optimization tips

- Prompt caching cuts Anthropic input costs by ~90%
- Use Supabase's built-in connection pooling
- Set appropriate `max_tokens` (600 keeps responses cheap)
- Monitor usage in Supabase Dashboard → Edge Functions → Logs

---

## Deployment Checklist

- [ ] Create Supabase project
- [ ] Run `supabase-schema.sql` in SQL Editor
- [ ] Enable Auth providers (Email, Google, Apple)
- [ ] Get Anthropic API key from console.anthropic.com
- [ ] Set Supabase secrets via CLI
- [ ] Deploy `coach` Edge Function
- [ ] Deploy `stripe-webhook` Edge Function
- [ ] Create Stripe products and prices
- [ ] Configure Stripe webhook endpoint
- [ ] Update price IDs in stripe-webhook function
- [ ] Connect frontend to Supabase
- [ ] Test full flow: signup → workout → AI coach → subscribe
- [ ] Set up error monitoring (Sentry)
- [ ] Launch!
