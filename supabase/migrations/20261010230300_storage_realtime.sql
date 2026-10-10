-- ---------------------------------------------------------------------------
-- Storage: private avatars bucket, path = {family_id}/{file}
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "family can view avatars" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.can_view_family(((storage.foldername(name))[1])::uuid));
create policy "parents can upload avatars" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.can_manage_family(((storage.foldername(name))[1])::uuid));
-- No delete policy: replaced photos get a new filename, and old ones are left in place.
-- ---------------------------------------------------------------------------
-- Realtime: wall and phones stay in sync
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.task_instances, public.star_ledger, public.members, public.family_settings;
