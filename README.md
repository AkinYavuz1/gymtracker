# 💪 GymTracker

AI-powered gym tracking app with zero-typing UX, built on Supabase + Anthropic Haiku.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 3. Run dev server
npm run dev
```

## Supabase Setup

```bash
# 4. Install Supabase CLI
npm install -g supabase

# 5. Login & link
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# 6. Run the schema (paste supabase/schema.sql into SQL Editor)

# 7. Set secrets
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# 8. Deploy edge functions
npm run functions:deploy
```

## Project Structure

```
gymtracker/
├── index.html                          ← App entry
├── package.json                        ← Dependencies & scripts
├── vite.config.js                      ← Build config
├── .env.example                        ← Environment template
├── .gitignore
├── SETUP-GUIDE.md                      ← Full deployment guide
├── README.md                           ← You are here
│
├── public/                             ← Static assets
│
├── src/
│   ├── main.jsx                        ← React entry
│   ├── App.jsx                         ← Full app (all screens)
│   └── lib/
│       └── supabase.js                 ← Supabase client + helpers
│
└── supabase/
    ├── schema.sql                      ← Database schema (paste into SQL Editor)
    └── functions/
        ├── _shared/
        │   └── cors.ts                 ← Shared CORS headers
        ├── coach/
        │   └── index.ts               ← AI Coach endpoint (Haiku)
        └── stripe-webhook/
            └── index.ts               ← Subscription handler
```

## Tech Stack

| Layer      | Tech               | Cost           |
|------------|-------------------|----------------|
| Frontend   | React + Vite       | Free (Vercel)  |
| Database   | Supabase Postgres  | Free tier      |
| Auth       | Supabase Auth      | Free tier      |
| API        | Supabase Edge Fns  | Free tier      |
| AI Coach   | Anthropic Haiku    | ~$0.003/query  |
| Payments   | Stripe             | 2.9%/txn       |

## License

MIT
