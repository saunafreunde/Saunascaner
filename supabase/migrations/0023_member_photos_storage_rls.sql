-- Sauna-Momente Galerie-Upload für eingeloggte Mitglieder freischalten.
-- Hintergrund: 0001_init beschränkt INSERT/UPDATE/DELETE auf assets/* auf
-- public.is_admin(). Migration 0018 hat zwar member_photos-Tabelle + RLS
-- mit Member-Berechtigung angelegt, aber den Storage-Layer übersehen —
-- daher schlug das Hochladen eines Fotos in die Galerie für Nicht-Admins
-- mit "new row violates row-level security policy" fehl. Migration 0021
-- hat dasselbe Pattern bereits für avatars/ gefixt.

drop policy if exists "assets insert member photo" on storage.objects;
drop policy if exists "assets update member photo" on storage.objects;
drop policy if exists "assets delete member photo" on storage.objects;

-- INSERT: eingeloggte User dürfen in member-photos/ schreiben
create policy "assets insert member photo" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = 'member-photos'
  );

-- UPDATE: damit Re-Upload/Überschreiben funktioniert
create policy "assets update member photo" on storage.objects for update
  to authenticated
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = 'member-photos'
  )
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = 'member-photos'
  );

-- DELETE: damit useDeleteMemberPhoto die Datei aus dem Storage entfernen
-- kann (DB-Eintrag wird über Tabellen-RLS in 0018 gesteuert).
create policy "assets delete member photo" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = 'member-photos'
  );
