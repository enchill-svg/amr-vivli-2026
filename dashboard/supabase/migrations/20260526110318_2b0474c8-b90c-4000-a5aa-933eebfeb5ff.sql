insert into storage.buckets (id, name, public) values ('user-uploads', 'user-uploads', false)
on conflict (id) do nothing;

create policy "Users read own uploads"
on storage.objects for select to authenticated
using (bucket_id = 'user-uploads' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users upload own uploads"
on storage.objects for insert to authenticated
with check (bucket_id = 'user-uploads' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users update own uploads"
on storage.objects for update to authenticated
using (bucket_id = 'user-uploads' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users delete own uploads"
on storage.objects for delete to authenticated
using (bucket_id = 'user-uploads' and auth.uid()::text = (storage.foldername(name))[1]);