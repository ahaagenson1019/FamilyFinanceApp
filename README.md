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

Then open http://localhost:3000. The wall display is designed for a
1920x1200 landscape tablet. On a laptop, go full-screen or zoom out.

The preview stores everything in your browser (localStorage) until Supabase is
connected. The default parent PIN for both Andy and Jess is **1234**. Change it
under Parents → Family.

## What works now (Phase 1 preview)

- Wall home: clock, today's agenda (sample events), dinner, and the four kids
  with stars and routine progress
- Together view: all four kids' routines side by side, with true multi-touch
  so all four can tap at once. Hold a picture to hear it read aloud.
  Per-column confetti, plus "Everybody's ready!" when all four are done.
- Single-kid view
- Parent PIN unlock (5-minute session), approvals that award stars, family
  photos (crop plus EXIF/GPS stripping), colors, PINs, and routine time windows

## Not yet

- Supabase (real sign-in, shared data across devices): Phase 1b
- Chores, star shop, Greenlight balances: Phase 2
- Google Calendar sync: Phase 3
- Budget: Phase 4
- Lists, PWA install, night mode: Phase 5
