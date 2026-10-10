# Haagie Headquarters — Build Prompt

You're building "Haagie Headquarters": a family command center that combines a
Skylight-style shared calendar/display with Greenlight-style chores and
allowance, plus a simple household budget. Build it in this repo.

## Who uses it
- Parents have full admin: manage the budget, approve chores, set rewards.
- Parents (2): Andy and Jess.
- Kids: Foster (7), Ira (6), Rita (5), Enid (3). Three of the four are
  pre-readers or early readers, which drives most of the kid-facing design (see "Designing for
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
- **Stars for everyone.** All four kids earn stars and fill a star chart
  toward picture rewards ("10 stars = pick the movie", "30 stars = trip to
  the trampoline park"). There's no money in the chore system for now.
- **Parent approval on by default.** Little kids will tap everything as
  done. Completed items go to "pending" until a parent batch-approves with
  their PIN.
- **Celebrate everything.** Big animations and sounds when a routine is
  finished or a jar or star chart fills. Day streaks are shown as a
  flame or plant that grows.
- **Tamper-proof kiosk.** No settings, delete, or edit controls are
  reachable from kid mode without a parent PIN. Large targets (min 64px in
  kid mode). Nothing a 3-year-old can break by mashing the screen.
- **Photo avatars for everyone.** Each kid and parent has a real photo as
  their avatar, which matters most for pre-readers ("that's me!"). See
  "Profile photos" below.
- **Age-appropriate seed chores:** make bed, put toys away, feed pet,
  set/clear table, laundry to hamper, water plants, and help unload the
  dishwasher (for the 6- and 7-year-olds).

## Profile photos
- Every family member (kids and parents) can have a photo avatar.
- Upload from the camera roll, or take one live with the tablet/phone camera.
- A crop step (square, with a circle preview) before saving. Resize on the
  client to 512x512 WebP before upload.
- **Strip EXIF metadata (including GPS location) before upload.** These are
  photos of young kids.
- Stored in a **private** Supabase Storage bucket, scoped to the family by
  RLS, and served with short-lived signed URLs. Never use public URLs.
- Only parents can add or change photos (behind the parent PIN). Kids can't
  change their own or anyone else's.
- The photo is shown with a ring in that person's color everywhere it
  appears (login screen, chores, calendar events, ledger).
- Fallback when there's no photo: the person's initial on their color, or a
  picked emoji/animal.
- Cache avatars on the wall display so the login screen loads instantly and
  still works offline.

## Core modules

### 1. Calendar
Calendars to sync (across four Google accounts):
| Calendar | Owner | Access |
|---|---|---|
| Haagenson Family Calendar | shared | two-way (default for new events) |
| Andy's personal calendar | Andy | two-way |
| andy@mplsgymnastics.com | Andy (work, Google Workspace) | read-only |
| jess@mplsgymnastics.com | Jess (work, Google Workspace) | read-only |
| Jessica.haagenson@gmail.com | Jess | two-way |

- Each parent connects their own Google accounts through a "Connect Google
  account" flow (multiple accounts per parent). Refresh tokens are stored
  server-side only (Supabase Vault), never sent to the client.
- Work calendars are read-only so nobody adds "snack time" to the gym
  calendar from the kitchen wall.
- Events added from the wall go to the Haagenson Family Calendar by default.
- Kid tagging: if an event title contains a kid's name ("Foster soccer"),
  show that kid's avatar on it automatically. Parents can override the tag.
- Gotcha: the Google OAuth app must be set to **"In production"** (it can
  stay unverified for under 100 users). In "Testing" mode, Google expires
  refresh tokens after 7 days and sync silently dies.
- Gotcha: mplsgymnastics.com is a Google Workspace domain, so the admin may
  need to allow the OAuth app in the Admin console before work calendars
  can connect.
- Views: Day, Week, Month, plus a "Today" agenda for the wall display
- Kid events (school, practice, playdates) show the kid's avatar
- Recurring events, and quick-add from the tablet
- Meal plan row on the week view (dinner each night)

### 2. Chores, Routines & Stars
- Chores: assignee, recurrence, star value, needs-approval flag, optional
  photo proof
- Routines: ordered steps with icons, a time window (morning/bedtime), and
  an optional star reward when the whole routine is done
- Star ledger per kid, append-only. Every earn or spend is a row. Never
  just update a balance field.
- Reward shop: parent-defined rewards with a picture and a star price. A kid
  "buys" a reward, and a parent confirms it with their PIN.
- Star goals with a picture and a progress bar
- Design the ledger so a money unit can be added later without a migration
  rewrite. Don't build money in v1.

### 2b. Greenlight Balances (view only)
- Each kid has a "My Money" card showing their Greenlight balances (Spend,
  Save, Give, plus total), styled like jars that fill up, with a "last
  updated" date.
- Greenlight has no public API, so **parents update balances by hand**: one
  quick screen with all four kids and a field per jar, done in about 30
  seconds a week. Do **not** scrape Greenlight or store Greenlight login
  credentials.
- Balance history stored as snapshots so kids can see a simple "my savings
  went up" line over time.
- Optional savings goal per kid tied to their Greenlight Save balance
  ("Bike: $45 of $120").
- A Sunday reminder on the parent's phone: "Update Greenlight balances."
- A kid sees only their own balances. Parents see all of them. Enforce
  this with RLS.
- Keep the data model source-agnostic (`source = 'manual'`) so an automated
  feed can replace manual entry later if one becomes available.

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

## Wall display hardware
- Target device: Samsung Galaxy Tab A9+ (11", Android), landscape, running
  Fully Kiosk Browser pointed at the PWA. Design the wall layout for
  1920x1200 landscape first.
- Until the tablet arrives, test in a desktop browser at that size.

## Non-negotiables
- RLS on every table. Kids can never read budget data or another kid's
  ledger, enforced in the database.
- Money stored as integer cents
- Timezone: America/Chicago
- Seed script with realistic sample data for Foster, Ira, Rita and Enid

## How to work
1. Ask any remaining clarifying questions first.
2. Propose the data model (tables, relationships, RLS) and the screen list.
   Wait for approval.
3. Build in phases, commit and push after each one, and give a preview URL:
   - Phase 1: Auth, family profiles with photo avatars, avatar/PIN login,
     wall-display shell
   - Phase 2: Routines + chores + star ledger + reward shop + Greenlight
     balance cards (ship first)
   - Phase 3: Calendar + Google sync
   - Phase 4: Budget
   - Phase 5: Lists, polish, PWA install, kiosk mode
4. After each phase, test it in a real browser at phone and tablet width,
   fix what's broken, and report what works and what doesn't.
