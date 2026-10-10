# Haagie Headquarters

The Haagenson family command center: a shared wall calendar, routines and
chores with stars, Greenlight balances, and a household budget.

- Build plan: [docs/BUILD_PROMPT.md](docs/BUILD_PROMPT.md)
- Data model and screens: [docs/DATA_MODEL.md](docs/DATA_MODEL.md)
- Screenshots: [docs/preview](docs/preview)

## Run it locally

Needs Node 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000 and sign in with Google. The app talks to the
Haagenson Family Supabase project. The connection details are publishable
values in `src/lib/supabase.ts`; row-level security protects the data.

To try it offline on sample data instead (default parent PIN **1234**):

```bash
NEXT_PUBLIC_DATA_MODE=local npm run dev
```

## How access works

- **Parents** sign in with Google. Andy (andy.haagenson@gmail.com) is the owner.
- **The wall tablet** is paired once with a 6-digit code from a parent's phone
  (Family → Pair a wall display). It never sees budget data or PINs.
- **Kids** never log in. They tap their own column or photo on the wall.
- **Parent PINs** are hashed and checked on the server. Five wrong tries locks
  the PIN pad for 10 minutes. A correct PIN unlocks parent actions on the wall
  for 5 minutes.

Database changes live in `supabase/migrations`. The family's starting data is
in `supabase/seed/haagenson_family.sql`.

## Status

- Phase 1 (done): wall home, the four-kid Together view, photo avatars, PIN
- Phase 1b (done): Supabase, Google sign-in, wall pairing, realtime sync
- Phase 2: chores, star shop, Greenlight balances
- Phase 3: Google Calendar sync
- Phase 4: budget
- Phase 5: lists, PWA install, night mode
