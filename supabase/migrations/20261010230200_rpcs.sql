-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Link a signed-in Google account to its member row by email (first sign-in).
create or replace function public.claim_membership() returns public.members
language plpgsql security definer set search_path = '' as $$
declare
  me public.members;
  jwt_email text := lower(auth.jwt() ->> 'email');
begin
  select * into me from public.members where auth_user_id = auth.uid();
  if found then return me; end if;
  if jwt_email is null then return null; end if;
  update public.members
    set auth_user_id = auth.uid()
    where lower(email) = jwt_email and auth_user_id is null and role in ('owner', 'parent')
    returning * into me;
  return me;
end $$;

-- Parent (signed in) creates a 6-digit code to pair a wall display.
create or replace function public.create_pairing_code() returns text
language plpgsql security definer set search_path = '' as $$
declare
  me public.members := public.current_member();
  new_code text;
begin
  if me.id is null or me.role not in ('owner', 'parent') then
    raise exception 'Only a parent can pair a wall display';
  end if;
  loop
    new_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.pairing_codes where code = new_code);
  end loop;
  insert into public.pairing_codes (code, family_id, created_by, expires_at)
    values (new_code, me.family_id, me.id, now() + interval '10 minutes');
  return new_code;
end $$;

-- The wall tablet (signed in anonymously) redeems the code and becomes a device.
create or replace function public.pair_device(p_code text, p_name text default 'Kitchen wall') returns public.devices
language plpgsql security definer set search_path = '' as $$
declare
  pc public.pairing_codes;
  dev public.devices;
  recent_fails int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select count(*) into recent_fails from public.pin_attempts
    where auth_user_id = auth.uid() and not succeeded and created_at > now() - interval '10 minutes';
  if recent_fails >= 5 then raise exception 'Too many tries. Wait 10 minutes.'; end if;

  select * into pc from public.pairing_codes
    where code = p_code and used_at is null and expires_at > now() for update;
  if not found then
    insert into public.pin_attempts (auth_user_id, member_id, succeeded) values (auth.uid(), '00000000-0000-0000-0000-000000000000', false);
    raise exception 'That code didn''t work. Make a new one on your phone.';
  end if;

  update public.pairing_codes set used_at = now() where code = pc.code;
  insert into public.devices (family_id, name, auth_user_id, paired_by)
    values (pc.family_id, coalesce(nullif(trim(p_name), ''), 'Kitchen wall'), auth.uid(), pc.created_by)
    on conflict (auth_user_id) do update set family_id = excluded.family_id, paired_by = excluded.paired_by
    returning * into dev;
  return dev;
end $$;

-- Wall: parent enters PIN, which unlocks parent actions on this device for 5 minutes.
create or replace function public.verify_parent_pin(p_member_id uuid, p_pin text) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  dev public.devices := public.current_device();
  parent public.members;
  stored text;
  recent_fails int;
  expires timestamptz := now() + interval '5 minutes';
begin
  select * into parent from public.members where id = p_member_id and role in ('owner', 'parent');
  if not found then raise exception 'Unknown parent'; end if;
  -- Signed-in parents can verify too (e.g. a parent using the wall from a laptop).
  if dev.id is null and not public.is_family_parent(parent.family_id) then raise exception 'Not allowed'; end if;
  if dev.id is not null and dev.family_id <> parent.family_id then raise exception 'Not allowed'; end if;

  select count(*) into recent_fails from public.pin_attempts
    where auth_user_id = auth.uid() and not succeeded and created_at > now() - interval '10 minutes';
  if recent_fails >= 5 then raise exception 'Too many wrong PINs. Try again in 10 minutes.'; end if;

  select pin_hash into stored from public.member_pins where member_id = parent.id;
  if stored is null or stored <> extensions.crypt(p_pin, stored) then
    insert into public.pin_attempts (auth_user_id, member_id, succeeded) values (auth.uid(), parent.id, false);
    return null;
  end if;

  insert into public.pin_attempts (auth_user_id, member_id, succeeded) values (auth.uid(), parent.id, true);
  if dev.id is not null then
    update public.parent_unlocks set expires_at = now() where device_id = dev.id and expires_at > now();
    insert into public.parent_unlocks (device_id, member_id, expires_at) values (dev.id, parent.id, expires);
    update public.devices set last_seen_at = now() where id = dev.id;
  end if;
  return expires;
end $$;

-- Unlocks are expired rather than removed, which keeps an audit trail.
create or replace function public.lock_device() returns void
language sql security definer set search_path = '' as $$
  update public.parent_unlocks u set expires_at = now()
  from public.devices d
  where u.device_id = d.id and d.auth_user_id = auth.uid() and u.expires_at > now()
$$;

create or replace function public.set_parent_pin(p_member_id uuid, p_pin text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target public.members;
begin
  if p_pin !~ '^\d{4}$' then raise exception 'PIN must be 4 digits'; end if;
  select * into target from public.members where id = p_member_id and role in ('owner', 'parent');
  if not found then raise exception 'Unknown parent'; end if;
  -- You can set your own PIN; the owner can set anyone's.
  if not (
    target.auth_user_id = auth.uid()
    or public.acting_parent(target.family_id) = target.id
    or exists (select 1 from public.families f where f.id = target.family_id and f.owner_member_id = public.acting_parent(target.family_id))
  ) then raise exception 'Not allowed'; end if;
  insert into public.member_pins (member_id, pin_hash) values (target.id, extensions.crypt(p_pin, extensions.gen_salt('bf')))
    on conflict (member_id) do update set pin_hash = excluded.pin_hash, updated_at = now();
end $$;

-- Kid taps a step: todo -> pending, pending -> todo. Approved is locked.
create or replace function public.toggle_step(p_member_id uuid, p_step_id uuid, p_date date) returns public.task_instances
language plpgsql security definer set search_path = '' as $$
declare
  kid public.members;
  r public.routines;
  t public.task_instances;
begin
  select * into kid from public.members where id = p_member_id and role = 'kid';
  if not found or not public.can_view_family(kid.family_id) then raise exception 'Not allowed'; end if;
  select r2.* into r from public.routines r2 join public.routine_steps s on s.routine_id = r2.id
    where s.id = p_step_id and r2.member_id = kid.id;
  if not found then raise exception 'Step does not belong to this kid'; end if;

  insert into public.task_instances (family_id, member_id, routine_id, step_id, due_date, status, completed_at)
    values (kid.family_id, kid.id, r.id, p_step_id, p_date, 'pending', now())
  on conflict (member_id, step_id, due_date) do update set
    status = case when public.task_instances.status = 'pending' then 'todo' else 'pending' end,
    completed_at = case when public.task_instances.status = 'pending' then null else now() end,
    updated_at = now()
  where public.task_instances.status <> 'approved'
  returning * into t;
  if t.id is null then
    select * into t from public.task_instances where member_id = kid.id and step_id = p_step_id and due_date = p_date;
  end if;
  return t;
end $$;

-- Parent approves; any routine that's now fully approved pays out its stars once.
create or replace function public.approve_tasks(p_task_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  fid uuid;
  parent_id uuid;
  rec record;
  n int;
begin
  select distinct family_id into fid from public.task_instances where id = any (p_task_ids) limit 1;
  if fid is null then return 0; end if;
  if (select count(distinct family_id) from public.task_instances where id = any (p_task_ids)) > 1 then
    raise exception 'Mixed families';
  end if;
  parent_id := public.acting_parent(fid);
  if parent_id is null then raise exception 'A parent needs to unlock first'; end if;

  update public.task_instances set status = 'approved', approved_by = parent_id, updated_at = now()
    where id = any (p_task_ids) and status = 'pending';
  get diagnostics n = row_count;

  for rec in
    select distinct t.routine_id, t.member_id, t.due_date, r.star_reward
    from public.task_instances t join public.routines r on r.id = t.routine_id
    where t.id = any (p_task_ids) and r.star_reward > 0
  loop
    if not exists (
      select 1 from public.routine_steps s
      left join public.task_instances t2
        on t2.step_id = s.id and t2.member_id = rec.member_id and t2.due_date = rec.due_date
      where s.routine_id = rec.routine_id and coalesce(t2.status, 'todo') <> 'approved'
    ) then
      insert into public.star_ledger (family_id, member_id, delta, kind, ref_type, ref_id, created_by)
        values (fid, rec.member_id, rec.star_reward, 'earn', 'routine', rec.due_date || ':' || rec.routine_id, parent_id)
        on conflict do nothing;
    end if;
  end loop;
  return n;
end $$;

create or replace function public.reject_tasks(p_task_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  fid uuid;
  parent_id uuid;
  n int;
begin
  select family_id into fid from public.task_instances where id = any (p_task_ids) limit 1;
  if fid is null then return 0; end if;
  parent_id := public.acting_parent(fid);
  if parent_id is null then raise exception 'A parent needs to unlock first'; end if;
  update public.task_instances set status = 'todo', completed_at = null, approved_by = parent_id, updated_at = now()
    where id = any (p_task_ids) and status = 'pending' and family_id = fid;
  get diagnostics n = row_count;
  return n;
end $$;

-- Parent edits a member's look (color, photo, emoji).
create or replace function public.update_member_look(p_member_id uuid, p_color text default null, p_avatar_path text default null, p_clear_avatar boolean default false)
returns public.members
language plpgsql security definer set search_path = '' as $$
declare
  m public.members;
begin
  select * into m from public.members where id = p_member_id;
  if not found or not public.can_manage_family(m.family_id) then raise exception 'Not allowed'; end if;
  if p_color is not null and p_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Bad color'; end if;
  if p_avatar_path is not null and split_part(p_avatar_path, '/', 1) <> m.family_id::text then raise exception 'Bad path'; end if;
  update public.members set
    color = coalesce(p_color, color),
    avatar_path = case when p_clear_avatar then null else coalesce(p_avatar_path, avatar_path) end
  where id = m.id returning * into m;
  return m;
end $$;

create or replace function public.update_family_settings(p_family_id uuid, p_together_windows jsonb default null, p_auto_switch boolean default null)
returns public.family_settings
language plpgsql security definer set search_path = '' as $$
declare
  s public.family_settings;
begin
  if not public.can_manage_family(p_family_id) then raise exception 'Not allowed'; end if;
  update public.family_settings set
    together_windows = coalesce(p_together_windows, together_windows),
    auto_switch_to_together = coalesce(p_auto_switch, auto_switch_to_together)
  where family_id = p_family_id returning * into s;
  return s;
end $$;

-- Lock down who can call what: no anonymous (signed-out) calls at all.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
