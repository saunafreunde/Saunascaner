-- Avatar-Upload für eingeloggte Mitglieder freischalten.
-- Hintergrund: 0001_init beschränkt INSERT/UPDATE/DELETE auf assets/* auf
-- public.is_admin(). Migration 0018 hat zwar Avatar-Spalte + set_my_avatar-RPC
-- mit Member-Berechtigung angelegt, aber den Storage-Layer übersehen — daher
-- schlug das Hochladen eines eigenen Fotos für Nicht-Admins mit
-- "new row violates row-level security policy" fehl.

drop policy if exists "assets insert own avatar" on storage.objects;
drop policy if exists "assets update own avatar" on storage.objects;
drop policy if exists "assets delete own avatar" on storage.objects;

-- INSERT: eingeloggte User dürfen in avatars/ schreiben
create policy "assets insert own avatar" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = 'avatars'
  );

-- UPDATE: damit Upsert/Überschreiben des eigenen Avatars funktioniert
create policy "assets update own avatar" on storage.objects for update
  to authenticated
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = 'avatars'
  )
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = 'avatars'
  );

-- DELETE: alte Avatare dürfen entfernt werden (Aufräumen, Avatar zurücksetzen)
create policy "assets delete own avatar" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = 'avatars'
  );
