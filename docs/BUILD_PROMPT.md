# Family HQ — Build Prompt

You're building "Family HQ": a family command center that combines a
Skylight-style shared calendar/display with Greenlight-style chores and
allowance, plus a simple household budget. Build it in this repo.

## Who uses it
- Parents (2): full admin. Manage budget, approve chores, set rewards.
- Kids, ages 7, 6, 5, and 3. Three of the four are pre-readers or early
  readers, which drives most of the kid-facing design (see "Designing for
  ages 3–7" below).
- The wall display: a tablet mounted in the kitchen running in kiosk mode.

## Stack (don't deviate without asking)
- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Supabase: Postgres, Auth, Row Level Security, Realtime
- Deploy on Vercel
- Installable PWA (phone + wall tablet)

## Designing for ages 3–7
- **Picture-first, text-second.** Every chore and routine step has a large
  icon or photo. Text labels are secondary. Tapping an item reads it aloud
  (Web Speech API).
- **Login by avatar, no kid PINs.** Kids tap their own picture on the wall
  display. A 3-year-old can't manage a PIN. Parents use a 4-digit PIN, which
  is required for approvals, settings, and anything budget-related.
- **Routines over chores for the little ones.** Morning, after-school and
  bedtime routines as visual step-by-step checklists ("brush teeth → get
  dressed → shoes on"). These are separate from earning chores and can
  optionally award stars.
- **Per-kid reward mode:**
  - Stars mode (default for the 3- and 5-year-olds): earn stars and fill a
    star chart toward a picture reward ("10 stars = pick the movie").
  - Money mode (default for the 7-year-old, optional for the 6-year-old):
    dollars split into visual Spend / Save / Give jars that fill up.
  - A parent can switch a kid from stars to money with one toggle as the
    kid grows. History is preserved.
- **Parent approval on by default.** Little kids will tap everything as
  done. Completed items go to "pending" until a parent batch-approves with
  their PIN.
- **Celebrate everything.** Big animations and sounds when a routine is
  finished or a jar or star chart fills. Day streaks are shown as a
  flame or plant that grows.
- **Tamper-proof kiosk.** No settings, delete, or edit controls are
  reachable from kid mode without a parent PIN. Large targets (min 64px in
  kid mode). Nothing a 3-year-old can break by mashing the screen.
- **Age-appropriate seed chores:** make bed, put toys away, feed pet,
  set/clear table, laundry to hamper, water plants, and help unload the
  dishwasher (for the 6- and 7-year-olds).

## Core modules

### 1. Calendar
- Two-way sync with our Google Calendars. Each family member has a color.
- Views: Day, Week, Month, plus a "Today" agenda for the wall display
- Kid events (school, practice, playdates) show the kid's avatar
- Recurring events, and quick-add from the tablet
- Meal plan row on the week view (dinner each night)

### 2. Chores, Routines & Rewards (the Greenlight part)
- Chores: assignee, recurrence, star or cent value, needs-approval flag,
  optional photo proof
- Routines: ordered steps with icons, a time window (morning/bedtime), and
  an optional star reward when the whole routine is done
- Ledger per kid, append-only. Every transaction is a row. Never just
  update a balance field. Supports both stars and cents.
- Savings goals with a picture of the item and a progress bar
- Weekly auto-allowance (money-mode kids) with a parent-set
  Spend/Save/Give split
- "Payout" button: parent marks money or rewards as given in real life

### 3. Household Budget (parents only)
- Monthly budget by category with planned vs. actual
- Manual entry + CSV import from our bank
- Schema ready for Plaid later. Don't build Plaid in v1.
- Dashboard: spend by category, trend vs. last 3 months, upcoming bills

### 4. Lists
- Shared grocery and to-do lists, real-time synced

## Design direction
- It lives on the kitchen wall, so it has to look good. Warm, calm and
  premium (Skylight/Apple), not a spreadsheet.
- Readable from 6 feet away. Each family member's color is used everywhere.
- Kid mode is playful and bright. Parent mode is clean.
- Auto dim at night.

## Non-negotiables
- RLS on every table. Kids can never read budget data or another kid's
  ledger, enforced in the database.
- Money stored as integer cents
- Timezone: America/Chicago
- Seed script with realistic sample data for a family with kids 7, 6, 5, 3

## How to work
1. Ask any remaining clarifying questions first.
2. Propose the data model (tables, relationships, RLS) and the screen list.
   Wait for approval.
3. Build in phases, commit and push after each one, and give a preview URL:
   - Phase 1: Auth, family profiles, avatar/PIN login, wall-display shell
   - Phase 2: Routines + chores + rewards ledger (ship first)
   - Phase 3: Calendar + Google sync
   - Phase 4: Budget
   - Phase 5: Lists, polish, PWA install, kiosk mode
4. After each phase, test it in a real browser at phone and tablet width,
   fix what's broken, and report what works and what doesn't.
