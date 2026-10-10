-- Which parents in the family have a wall PIN set (never the PIN itself).
create or replace function public.parents_with_pin(fid uuid) returns setof uuid
language sql stable security definer set search_path = '' as $fn$
  select p.member_id from public.member_pins p
  join public.members m on m.id = p.member_id
  where m.family_id = fid and public.can_view_family(fid)
$fn$;

revoke execute on function public.parents_with_pin(uuid) from public, anon;
grant execute on function public.parents_with_pin(uuid) to authenticated;
