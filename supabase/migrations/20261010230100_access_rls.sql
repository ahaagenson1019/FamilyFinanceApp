-- ---------------------------------------------------------------------------
-- Access helpers (security definer so policies can call them without
-- recursing through RLS)
-- ---------------------------------------------------------------------------

create or replace function public.current_member() returns public.members
language sql stable security definer set search_path = '' as $$
  select m.* from public.members m where m.auth_user_id = auth.uid() limit 1
$$;

create or replace function public.current_device() returns public.devices
language sql stable security definer set search_path = '' as $$
  select d.* from public.devices d where d.auth_user_id = auth.uid() limit 1
$$;

create or replace function public.is_family_parent(fid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.family_id = fid and m.auth_user_id = auth.uid() and m.role in ('owner', 'parent')
  )
$$;

create or replace function public.is_family_device(fid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.devices d where d.family_id = fid and d.auth_user_id = auth.uid())
$$;

create or replace function public.can_view_family(fid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_family_parent(fid) or public.is_family_device(fid)
$$;

-- The parent acting right now: a signed-in parent, or a parent who unlocked
-- this wall device with their PIN in the last 5 minutes.
create or replace function public.acting_parent(fid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select m.id from public.members m
      where m.family_id = fid and m.auth_user_id = auth.uid() and m.role in ('owner', 'parent')),
    (select u.member_id from public.parent_unlocks u
      join public.devices d on d.id = u.device_id
      where d.family_id = fid and d.auth_user_id = auth.uid() and u.expires_at > now()
      order by u.expires_at desc limit 1)
  )
$$;

create or replace function public.can_manage_family(fid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.acting_parent(fid) is not null
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.families enable row level security;
alter table public.members enable row level security;
alter table public.member_pins enable row level security;
alter table public.family_settings enable row level security;
alter table public.devices enable row level security;
alter table public.pairing_codes enable row level security;
alter table public.parent_unlocks enable row level security;
alter table public.pin_attempts enable row level security;
alter table public.routines enable row level security;
alter table public.routine_steps enable row level security;
alter table public.task_instances enable row level security;
alter table public.star_ledger enable row level security;

-- Read access: anyone in the family (parents and paired wall devices).
create policy "family can read" on public.families for select to authenticated using (public.can_view_family(id));
create policy "family can read" on public.members for select to authenticated using (public.can_view_family(family_id));
create policy "family can read" on public.family_settings for select to authenticated using (public.can_view_family(family_id));
create policy "family can read" on public.routines for select to authenticated using (public.can_view_family(family_id));
create policy "family can read" on public.routine_steps for select to authenticated
  using (exists (select 1 from public.routines r where r.id = routine_id and public.can_view_family(r.family_id)));
create policy "family can read" on public.task_instances for select to authenticated using (public.can_view_family(family_id));
create policy "family can read" on public.star_ledger for select to authenticated using (public.can_view_family(family_id));
create policy "parents can read" on public.devices for select to authenticated
  using (public.is_family_parent(family_id) or auth_user_id = auth.uid());

-- Parents (signed in) can edit routines directly. Everything else is RPC-only.
create policy "parents can write" on public.routines for all to authenticated
  using (public.is_family_parent(family_id)) with check (public.is_family_parent(family_id));
create policy "parents can write" on public.routine_steps for all to authenticated
  using (exists (select 1 from public.routines r where r.id = routine_id and public.is_family_parent(r.family_id)))
  with check (exists (select 1 from public.routines r where r.id = routine_id and public.is_family_parent(r.family_id)));

-- member_pins, pairing_codes, parent_unlocks, pin_attempts: no policies at all,
-- so they're reachable only from the security-definer functions below.

revoke update, delete, truncate on public.star_ledger from anon, authenticated;
revoke all on public.member_pins, public.pairing_codes, public.parent_unlocks, public.pin_attempts from anon, authenticated;
