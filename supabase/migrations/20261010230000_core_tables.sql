-- Haagie Headquarters: core schema (Phase 1b)
-- Families, members, wall devices, parent PINs, routines, task instances and
-- the append-only star ledger. Everything is RLS-protected; writes that need
-- validation go through security-definer RPCs.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/Chicago',
  owner_member_id uuid,
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  role text not null check (role in ('owner', 'parent', 'kid')),
  display_name text not null,
  birthdate date,
  color text not null,
  avatar_path text,
  avatar_emoji text,
  email text,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  constraint kids_have_no_login check (role <> 'kid' or auth_user_id is null)
);
create index on public.members (family_id);
create unique index members_family_email on public.members (family_id, lower(email)) where email is not null;

alter table public.families
  add constraint families_owner_fk foreign key (owner_member_id) references public.members (id) on delete set null;

-- PIN hashes live apart from members so the wall (which can read members)
-- can never read them.
create table public.member_pins (
  member_id uuid primary key references public.members (id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now()
);

create table public.family_settings (
  family_id uuid primary key references public.families (id) on delete cascade,
  together_windows jsonb not null default '{
    "morning": {"start": "06:45", "end": "08:15"},
    "after_school": {"start": "15:30", "end": "17:30"},
    "bedtime": {"start": "19:00", "end": "20:15"}
  }',
  auto_switch_to_together boolean not null default true,
  dinner_today text
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null default 'Kitchen wall',
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  paired_by uuid references public.members (id) on delete set null,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.devices (family_id);

create table public.pairing_codes (
  code text primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  created_by uuid not null references public.members (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table public.parent_unlocks (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on public.parent_unlocks (device_id, expires_at);

create table public.pin_attempts (
  id bigint generated always as identity primary key,
  auth_user_id uuid not null,
  member_id uuid not null,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);
create index on public.pin_attempts (auth_user_id, created_at);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  name text not null,
  time_window text not null check (time_window in ('morning', 'after_school', 'bedtime')),
  star_reward int not null default 0 check (star_reward >= 0),
  active boolean not null default true,
  unique (member_id, time_window)
);
create index on public.routines (family_id);

create table public.routine_steps (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines (id) on delete cascade,
  position int not null,
  title text not null,
  icon text not null,
  image_path text
);
create index on public.routine_steps (routine_id, position);

create table public.task_instances (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  routine_id uuid not null references public.routines (id) on delete cascade,
  step_id uuid not null references public.routine_steps (id) on delete cascade,
  due_date date not null,
  status text not null default 'todo' check (status in ('todo', 'pending', 'approved', 'rejected')),
  completed_at timestamptz,
  approved_by uuid references public.members (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (member_id, step_id, due_date)
);
create index on public.task_instances (family_id, due_date);
create index on public.task_instances (family_id, status) where status = 'pending';

-- Append-only. Corrections are new 'adjust' rows; nobody gets UPDATE/DELETE.
create table public.star_ledger (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  delta int not null check (delta <> 0),
  kind text not null check (kind in ('earn', 'spend', 'adjust')),
  ref_type text not null check (ref_type in ('routine', 'chore', 'reward', 'manual')),
  ref_id text not null,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.star_ledger (family_id, member_id);
-- A routine pays out at most once per day.
create unique index star_ledger_routine_once on public.star_ledger (member_id, ref_id) where ref_type = 'routine';
