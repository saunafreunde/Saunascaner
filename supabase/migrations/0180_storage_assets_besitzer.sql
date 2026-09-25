-- 0180_storage_assets_besitzer.sql — Bucket „assets" absichern (Audit 25.09.2026)
--
-- Befunde:
-- 1) Die Policies aus 0021 (avatars/) und 0023 (member-photos/) prüften nur den
--    Ordner, nie den Besitzer. Jeder eingeloggte Account — auch jeder Gast, und
--    einen Gast-Zugang kann sich jeder im Internet anlegen — konnte damit per
--    Storage-API (upload mit upsert bzw. remove) JEDES Profilbild und JEDES
--    Mitgliederfoto überschreiben oder endgültig löschen (Storage hat keine
--    Versionen). Die Bilder laufen auf der TV-Tafel.
-- 2) „assets read public" galt für die Rolle PUBLIC, also auch anon: Jeder
--    konnte den ganzen Bucket auflisten, auch längst ersetzte Profilbilder und
--    die von gelöschten Konten.
-- 3) Für feed-posts/ und aufgieser-photos/ gab es gar keine Upload-Policy für
--    Nicht-Admins — Foto-Beiträge im Feed und die Fotogalerie der Aufgießer
--    scheiterten für alle außer den Admins mit einem RLS-Fehler.
-- 4) Der Bucket hatte weder Größen- noch Typgrenze.
--
-- Neu:
-- * Lesen/Auflisten: nur noch eingeloggt, und zwar die eigenen Dateien; Admins
--   sehen alle. Die Bilder selbst bleiben für alle sichtbar: Der Bucket ist
--   öffentlich, und /storage/v1/object/public/… (getPublicUrl, Tafel, Mails,
--   Service-Worker-Cache) liest am RLS vorbei. Kein Client ruft list() oder
--   download() auf; api/saunafest-video.ts arbeitet mit service_role.
--   Die SELECT-Policy auf die EIGENE Zeile ist Pflicht: Die Storage-API löscht
--   mit DELETE … WHERE name = ANY(…) RETURNING * (laut pg_stat_statements) —
--   ohne SELECT-Recht auf die Zeile löschte remove() still 0 Dateien; neuere
--   API-Fassungen lesen auch beim Hochladen per RETURNING zurück.
--   Funktionen mit SECURITY DEFINER (Eigentümer postgres, BYPASSRLS) wie die
--   Löschliste aus 0186 sehen weiter alle Dateien.
-- * Hochladen (Nicht-Admin): nur mit eigenem Besitzer und freigeschaltetem,
--   nicht gesperrtem Konto — avatars/, member-photos/, feed-posts/ für alle
--   Mitglieder inkl. Gäste (wie create_feed_post), aufgieser-photos/ nur für
--   Aufgießer (wie die Tabellen-Policy photos_self_insert). Den Besitzer setzt
--   die Storage-API aus dem JWT; der Vergleich ist doppelte Absicherung.
--   coalesce(owner_id, owner::text): storage.can_insert_object() füllt nur die
--   alte Spalte owner, der normale Upload beide.
-- * Überschreiben (UPDATE) für Nicht-Admins entfällt ersatzlos: Jeder Upload
--   der App legt einen neuen Zufallspfad an (upsert: false), niemand verschiebt
--   oder kopiert Dateien. Ohne UPDATE-Recht ist auch kein upsert auf fremde
--   Dateien mehr möglich.
-- * Löschen (Nicht-Admin): nur eigene Dateien in den vier Mitglieder-Ordnern
--   (Aufräumen nach einem fehlgeschlagenen Speichern, eigenes Galeriefoto).
-- * Admins behalten alles über die unveränderten Policies aus 0001
--   („assets write/update/delete admin", public.is_admin()).
-- * Bucket-Grenzen: 25 MB je Datei (Videos dürfen laut uploadVideo und
--   api/saunafest-video.ts 20 MB haben, Rest ist Luft) und nur noch die Typen,
--   die die App tatsächlich hochlädt: JPEG, PNG, WebP, GIF, MP4, WebM. Im
--   Bucket liegen heute nur JPEG (73), PNG (15) und MP4 (5), die größte Datei
--   hat 8,3 MB. SVG fällt bewusst weg (kein SVG im Bucket; ein MIME-Filter gilt
--   bucketweit und würde sonst jedem Gast SVG in avatars/ erlauben). Die
--   Grenzen gelten auch für service_role — saunafest-video lädt nur
--   JPEG/PNG/WebP und MP4 bis 20 MB hoch. Frontend (src/lib/api.ts) ist
--   angeglichen.

-- ─── Alte Policies aus 0001/0021/0023 ────────────────────────────────────
drop policy if exists "assets read public"         on storage.objects;
drop policy if exists "assets insert own avatar"   on storage.objects;
drop policy if exists "assets update own avatar"   on storage.objects;
drop policy if exists "assets delete own avatar"   on storage.objects;
drop policy if exists "assets insert member photo" on storage.objects;
drop policy if exists "assets update member photo" on storage.objects;
drop policy if exists "assets delete member photo" on storage.objects;

-- ─── Lesen / Auflisten ───────────────────────────────────────────────────
drop policy if exists "assets lesen eigene oder admin" on storage.objects;
create policy "assets lesen eigene oder admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assets'
    and (
      coalesce(owner_id, owner::text) = (select auth.uid())::text
      or (select public.is_admin())
    )
  );

-- ─── Hochladen ───────────────────────────────────────────────────────────
drop policy if exists "assets hochladen mitglied" on storage.objects;
create policy "assets hochladen mitglied" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] in ('avatars', 'member-photos', 'feed-posts')
    and coalesce(owner_id, owner::text) = (select auth.uid())::text
    and (select public.is_approved_account())
  );

drop policy if exists "assets hochladen aufgiesser-foto" on storage.objects;
create policy "assets hochladen aufgiesser-foto" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = 'aufgieser-photos'
    and coalesce(owner_id, owner::text) = (select auth.uid())::text
    and (select public.is_approved_account())
    and (select public.is_aufgieser())
  );

-- ─── Löschen ─────────────────────────────────────────────────────────────
drop policy if exists "assets loeschen eigene" on storage.objects;
create policy "assets loeschen eigene" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] in ('avatars', 'member-photos', 'feed-posts', 'aufgieser-photos')
    and coalesce(owner_id, owner::text) = (select auth.uid())::text
  );

-- ─── Bucket-Grenzen ──────────────────────────────────────────────────────
update storage.buckets
   set file_size_limit    = 26214400,   -- 25 MB
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif',
                                  'video/mp4', 'video/webm']
 where id = 'assets';
