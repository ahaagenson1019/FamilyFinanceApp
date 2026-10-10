# Haagie Headquarters — Data Model & Screens (proposal, awaiting approval)

All tables live in Supabase Postgres with RLS on. Money is stored as integer cents,
times as `timestamptz`, and the family timezone is America/Chicago.

## Who's who: auth model

| Actor | How they sign in | What they can do |
|---|---|---|
| Parent (Andy, Jess) | Supabase Auth (Google sign-in) on their phone | Everything |
| Wall tablet | A **device account**: a Supabase user with role `kiosk`, paired once by a parent | Read the family's calendar, chores, stars and lists. Mark tasks done (as pending). Request rewards. |
| Kid (Foster, Ira, Rita, Enid) | No login. Taps their avatar on the tablet, which sets the "acting member" | Whatever the kiosk allows, for themselves |
| Parent on the tablet | Taps their avatar and enters a 4-digit PIN. A server function verifies the PIN and grants a 5-minute elevated session | Approvals, settings, Greenlight entry |

Kids never have their own auth users, so a 3-year-old can't end up with a password.

## Tables

### Family & people
- **families**: `id, name ('Haagie Headquarters'), timezone`
- **members**: `id, family_id, role (parent|kid), display_name, birthdate, color, avatar_path, avatar_emoji, auth_user_id (parents only), pin_hash (parents only)`
- **devices**: `id, family_id, name ('Kitchen wall'), auth_user_id, paired_by, last_seen_at`

### Calendar
- **google_accounts**: `id, member_id, google_email, refresh_token_secret_id (Vault ref), status`
- **calendars**: `id, google_account_id, google_calendar_id, name, color, access (read_only|read_write), is_default_for_new, sync_token`
- **events**: a local cache of Google events. `id, calendar_id, google_event_id, title, location, starts_at, ends_at, all_day, recurrence, etag, updated_at`
- **event_members**: `event_id, member_id, source (auto_name_match|manual)`
- **meal_plan**: `family_id, date, dinner`

Sync: incremental sync with Google `syncToken`, using a Vercel cron every 5 minutes plus Google push notifications where available. Google is the source of truth. Local writes go to Google first, then get cached.

### Chores, routines, stars
- **chores**: `id, family_id, title, icon, image_path, star_value, needs_approval (default true), recurrence (RRULE), active`
- **chore_assignees**: `chore_id, member_id`
- **routines**: `id, family_id, member_id, name ('Morning'), time_window (morning|after_school|bedtime), star_reward`
- **routine_steps**: `id, routine_id, position, title, icon, image_path`
- **task_instances**: one row per kid per day per chore or routine step. `id, member_id, source_type (chore|routine_step), source_id, due_date, status (todo|pending|approved|rejected), completed_at, approved_by, proof_photo_path`. Generated nightly by a cron, plus lazily on first load of the day.
- **star_ledger** (append-only, with no UPDATE or DELETE grants): `id, member_id, delta (+/-), kind (earn|spend|adjust), ref_type, ref_id, created_by, created_at`
- **star_balances** (view): `member_id, balance = sum(delta)`
- **rewards**: `id, family_id, title, image_path, star_cost, active`
- **reward_redemptions**: `id, reward_id, member_id, status (requested|approved|fulfilled|declined), ledger_entry_id`
- **star_goals**: `id, member_id, reward_id, created_at`. A kid's current target, shown as a progress bar.

### Greenlight (view-only, manual entry)
- **greenlight_snapshots**: `id, member_id, spend_cents, save_cents, give_cents, source ('manual'), recorded_by, recorded_at`
- **greenlight_goals**: `id, member_id, title, image_path, target_cents, achieved_at`

### Budget (parents only)
- **budget_categories**: `id, family_id, name, icon, color, kind (expense|income), sort`
- **budget_plans**: `category_id, month (date), planned_cents`
- **transactions**: `id, family_id, posted_on, amount_cents, merchant, memo, category_id, account_name, source (manual|csv|plaid), external_id (unique per source, for de-duping CSV re-imports)`
- **recurring_bills**: `id, family_id, name, amount_cents, category_id, due_day, recurrence`

### Lists
- **lists**: `id, family_id, name, kind (grocery|todo), icon`
- **list_items**: `id, list_id, text, checked, checked_by, position`

### Media
Storage buckets (all **private**, served via signed URLs):
- `avatars/{family_id}/{member_id}.webp`
- `chore-images/…`, `reward-images/…`, `proof-photos/…`

## RLS summary

| Data | Parent | Kiosk (wall) | Notes |
|---|---|---|---|
| members, avatars | read/write | read | Only parents can change photos |
| calendars, events | read/write (respects `access`) | read, create on family calendar | Work calendars are read-only for everyone |
| chores, routines, rewards | read/write | read | |
| task_instances | read/write | read, and can set `todo → pending` only | Enforced by RPC, not raw UPDATE |
| star_ledger | read, insert | read | No update/delete for anyone. Corrections are new `adjust` rows |
| reward_redemptions | read/write | insert `requested` | |
| greenlight_* | read/write | read only for the acting kid, via RPC | A kid sees only their own |
| budget_*, transactions, recurring_bills, google_accounts | read/write | **no access** | Wall can't see money or tokens |
| lists | read/write | read/write | |

Elevated parent actions on the tablet go through `security definer` RPCs that check a valid PIN session.

## Screens

### Wall tablet (1920x1200 landscape)
1. **Home**: today's agenda on the left, four kid columns on the right (avatar, today's chores/routines, star count), dinner, and the time
2. **Kid view** (after tapping an avatar): big picture checklist with read-aloud, star chart, goal, and "My Money" Greenlight jars
3. **Calendar**: day, week (with meal row), month
4. **Star shop**: rewards with pictures, plus a "request" button
5. **Lists**: grocery and to-do
6. **Parent PIN pad**, which unlocks approvals and quick settings
7. **Night mode**: dimmed clock plus tomorrow's first event

### Parent phone
1. **Dashboard**: pending approvals, today's events, star leaderboard, month budget snapshot
2. **Approvals**: batch approve or reject, with proof photos
3. **Chores & routines editor**
4. **Rewards editor**
5. **Greenlight update**: all four kids on one screen, 30 seconds a week
6. **Budget**: overview, transactions, CSV import, categories, bills
7. **Calendar settings**: connected Google accounts and per-calendar access
8. **Family**: members, photos, colors, PINs, wall tablet pairing
9. **Lists**

## Default colors (editable)
| Member | Color |
|---|---|
| Andy | Navy `#1E3A8A` |
| Jess | Plum `#7E22CE` |
| Foster | Blue `#2563EB` |
| Ira | Green `#16A34A` |
| Rita | Orange `#EA580C` |
| Enid | Pink `#DB2777` |
