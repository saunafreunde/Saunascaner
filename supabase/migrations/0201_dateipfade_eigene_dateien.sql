-- 0201_dateipfade_eigene_dateien.sql — Profilbild, Feed-Bild, Aufgießer-Galerie
-- und die übrigen Bildspalten nehmen nur noch eigene Dateien an
-- (Audit-Runde 3, 25.09.2026, Gruppe T3_dateipfade)
--
-- Befund: 0192 hat für member_photos geschlossen, dass man den Pfad einer
-- FREMDEN Datei eintragen kann. Dieselbe Lücke stand noch offen bei
--   - set_my_avatar(text)            (schrieb jeden beliebigen Text),
--   - create_feed_post(…)            (prüfte nur „nicht leer"),
--   - aufgieser_photos               (Policies ohne Pfadprüfung, INSERT und
--                                     UPDATE auf photo_path frei),
-- und — laut Gegenprüfung — über drei Nebenwege:
--   - members.nameplate_config       (set_my_nameplate_config nimmt jedes
--                                     jsonb; _storage_pfad_in_gebrauch sucht
--                                     dort per strpos nach dem Pfad),
--   - infusion_templates.image_path  (templates_write_own, auch Gäste),
--   - member_custom_oils.image_path  (custom_oils_insert_self, Aufgießer).
-- (infusions.image_path ist für anon/authenticated nicht schreibbar und keine
-- RPC nimmt dafür einen Wert an — dort ist nichts zu tun.)
--
-- Folge: Wer den Pfad eines fremden Fotos (z. B. „avatars/<uuid>.jpg" aus dem
-- Mitgliederverzeichnis) bei sich einträgt, lässt _storage_pfad_in_gebrauch
-- für diese Datei „in Gebrauch" melden. Wird das Konto des Betroffenen
-- gelöscht, kommt sein Foto dann NICHT auf die Löschliste (0186/0195) und
-- bleibt im öffentlichen Bucket liegen — die zugesagte Löschung läuft still
-- ins Leere.
--
-- Neu (gleiche Regel wie member_photos_vor_insert in 0192):
--   1) Helfer _eigener_asset_pfad(pfad): die Datei liegt im Bucket „assets"
--      und gehört dem Aufrufer (coalesce(owner_id, owner::text) = auth.uid()).
--      Ohne auth.uid() (Server, Wartung, Jobs) und für Admins gilt die Prüfung
--      als bestanden — Admins dürfen wie bisher (sie dürfen im Bucket ohnehin
--      alles schreiben und löschen), admin_set_member_avatar bleibt unverändert.
--   2) set_my_avatar: NULL/leer, „dicebear:…" oder „avatars/<name>" UND
--      eigene Datei. Sonst Fehler 42501 (avatar_pfad_ungueltig bzw.
--      avatar_nicht_eigene_datei).
--   3) create_feed_post: „feed-posts/<name>" UND eigene Datei, sonst 42501
--      (feed_bild_pfad_ungueltig bzw. feed_bild_nicht_eigene_datei).
--   4) aufgieser_photos: BEFORE INSERT OR UPDATE OF photo_path-Trigger mit
--      „aufgieser-photos/<name>" UND eigener Datei; Spaltenrechte wie bei
--      member_photos: INSERT nur (member_id, photo_path, caption, sort_order),
--      UPDATE nur (caption, sort_order); anon schreibt gar nicht mehr.
--   5) infusion_templates.image_path und member_custom_oils.image_path:
--      Verweist der Pfad in einen persönlichen Ordner (avatars, member-photos,
--      aufgieser-photos, feed-posts), muss die Datei dem Aufrufer gehören.
--      Mitgelieferte Bilder („/oele/…", „/schnaps/…") und Admin-Ordner bleiben
--      frei. Der Trigger läuft vor trg_custom_oil_bild_erben (alphabetisch),
--      prüft also nur, was der Aufrufer selbst angibt.
--   6) CHECK-Constraints als Rückhalt gegen jeden anderen Schreibweg
--      (Super-Admin per Tabelle, künftige Funktionen):
--      members.avatar_path, members.nameplate_config (kein Dateipfad),
--      feed_posts.image_path, aufgieser_photos.photo_path.
--      Alle Bestandszeilen erfüllen sie (geprüft 25.09.2026: 31× avatars/,
--      43× NULL; Feed nur Systembeiträge mit NULL; 1× aufgieser-photos/;
--      kein nameplate_config mit Pfad).
--   7) _storage_pfad_in_gebrauch: Ein Treffer in feed_posts.meta zählt nur
--      noch, wenn die Datei dem Autor des Beitrags gehört. In meta landen
--      Freitexte, die das Mitglied selbst bestimmt (der bei der Registrierung
--      frei gewählte Name in game_win/Wochenrückblick, Öl- und
--      Besonderheiten-IDs); damit ließ sich eine fremde Datei ebenfalls
--      „in Gebrauch" halten (Gegenprüfung, Rollback belegt).
--
-- Bewusst KEINE Prüfung der Dateiendung: uploadAsset übernimmt bei GIFs und
-- kleinen Dateien den Originalnamen (compressImage), die Endung kann also
-- fehlen oder ungewöhnlich sein. Geprüft wird nur der Ordner (ein Segment,
-- beginnt nicht mit „.") plus der Besitz. Bestehende Daten werden nicht
-- verändert.
--
-- Aufrufer im Frontend (alle laden vorher selbst hoch → eigene Datei):
--   AvatarPicker → uploadAsset(…, 'avatars') bzw. 'dicebear:…' bzw. null;
--   FeedComposeModal → uploadAsset(…, 'feed-posts');
--   useAddAufgieserPhoto → uploadAsset(…, 'aufgieser-photos') + insert
--   (member_id, photo_path, caption, sort_order);
--   AdminAvatarManager → uploadAsset(…, 'avatars') + admin_set_member_avatar.


-- ─── 1) Helfer: gehört die Datei dem Aufrufer? ─────────────────────────────

CREATE OR REPLACE FUNCTION public._eigener_asset_pfad(p_pfad text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select auth.uid() is null
      or public.is_admin()
      or exists (
           select 1 from storage.objects o
            where o.bucket_id = 'assets'
              and o.name = p_pfad
              and coalesce(o.owner_id, o.owner::text) = auth.uid()::text
         );
$function$;
-- Nur intern (Trigger und SECURITY-DEFINER-Funktionen laufen als Eigentümer).
REVOKE ALL ON FUNCTION public._eigener_asset_pfad(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._eigener_asset_pfad(text) TO service_role;


-- ─── 2) set_my_avatar ──────────────────────────────────────────────────────
-- Vorlage: Live-Fassung (0018/0111). Signatur und Rückgabewerte unverändert.

CREATE OR REPLACE FUNCTION public.set_my_avatar(p_path text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_locked boolean;
  v_pfad   text := nullif(btrim(coalesce(p_path, '')), '');
BEGIN
  SELECT avatar_locked INTO v_locked
    FROM public.members WHERE auth_user_id = auth.uid();
  IF v_locked = true THEN
    RETURN 'avatar_locked';
  END IF;

  -- Erlaubt: kein Bild, DiceBear-Marker oder eine EIGENE Datei im Ordner
  -- avatars/ (AvatarPicker lädt vorher hoch). Ein fremder Pfad würde die Datei
  -- des anderen vor der Löschliste (0186) schützen.
  IF v_pfad IS NOT NULL AND v_pfad NOT LIKE 'dicebear:%' THEN
    IF v_pfad !~ '^avatars/[^/.][^/]*$' THEN
      RAISE EXCEPTION 'avatar_pfad_ungueltig' USING ERRCODE = '42501';
    END IF;
    IF NOT public._eigener_asset_pfad(v_pfad) THEN
      RAISE EXCEPTION 'avatar_nicht_eigene_datei' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.members
     SET avatar_path = v_pfad
   WHERE auth_user_id = auth.uid();
  IF NOT FOUND THEN RETURN 'not_authorized'; END IF;
  RETURN 'ok';
END $function$;
REVOKE ALL ON FUNCTION public.set_my_avatar(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_avatar(text) TO authenticated, service_role;


-- ─── 3) create_feed_post ───────────────────────────────────────────────────
-- Vorlage: Live-Fassung (0052). Signatur, search_path und Ablauf unverändert,
-- nur die Pfadprüfung kommt dazu.

CREATE OR REPLACE FUNCTION public.create_feed_post(p_image_path text, p_caption text DEFAULT NULL::text, p_infusion_id uuid DEFAULT NULL::uuid, p_oils text[] DEFAULT '{}'::text[])
 RETURNS feed_posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_me uuid; v_caption text; v_oils text[]; v_post public.feed_posts;
begin
  select id into v_me from public.members where auth_user_id = auth.uid();
  if v_me is null then raise exception 'not_logged_in'; end if;
  if p_image_path is null or btrim(p_image_path) = '' then raise exception 'image_required'; end if;
  -- Nur eine EIGENE Datei aus feed-posts/ (FeedComposeModal lädt vorher hoch).
  if p_image_path !~ '^feed-posts/[^/.][^/]*$' then
    raise exception 'feed_bild_pfad_ungueltig' using errcode = '42501';
  end if;
  if not public._eigener_asset_pfad(p_image_path) then
    raise exception 'feed_bild_nicht_eigene_datei' using errcode = '42501';
  end if;
  v_caption := nullif(btrim(coalesce(p_caption, '')), '');
  if v_caption is not null and char_length(v_caption) > 280 then raise exception 'caption_too_long'; end if;
  v_oils := coalesce(p_oils, '{}'::text[]);
  if array_length(v_oils, 1) is not null and array_length(v_oils, 1) > 3 then raise exception 'too_many_oils'; end if;
  insert into public.feed_posts (author_id, image_path, caption, infusion_id, oils)
    values (v_me, p_image_path, v_caption, p_infusion_id, v_oils)
  returning * into v_post;
  return v_post;
end$function$;
REVOKE ALL ON FUNCTION public.create_feed_post(text, text, uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_feed_post(text, text, uuid, text[]) TO authenticated, service_role;


-- ─── 4) aufgieser_photos: Pfad und Besitz beim Schreiben ───────────────────

CREATE OR REPLACE FUNCTION public._aufgieser_photos_pfad_pruefen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.photo_path IS NOT DISTINCT FROM OLD.photo_path THEN
    RETURN NEW;
  END IF;

  IF NEW.photo_path IS NULL
     OR NEW.photo_path !~ '^aufgieser-photos/[^/.][^/]*$' THEN
    RAISE EXCEPTION 'foto_pfad_ungueltig' USING ERRCODE = '42501';
  END IF;

  -- useAddAufgieserPhoto lädt vor dem INSERT hoch → die Datei gehört dem
  -- Aufrufer. Server/Wartung (ohne auth.uid()) und Admins: nur Pfadprüfung.
  IF NOT public._eigener_asset_pfad(NEW.photo_path) THEN
    RAISE EXCEPTION 'foto_nicht_eigene_datei' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._aufgieser_photos_pfad_pruefen() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_aufgieser_photos_pfad ON public.aufgieser_photos;
CREATE TRIGGER trg_aufgieser_photos_pfad
  BEFORE INSERT OR UPDATE OF photo_path ON public.aufgieser_photos
  FOR EACH ROW EXECUTE FUNCTION public._aufgieser_photos_pfad_pruefen();

ALTER TABLE public.aufgieser_photos DROP CONSTRAINT IF EXISTS aufgieser_photos_pfad_chk;
ALTER TABLE public.aufgieser_photos ADD CONSTRAINT aufgieser_photos_pfad_chk
  CHECK (photo_path ~ '^aufgieser-photos/[^/.][^/]*$');

-- Spaltenrechte: Ein REVOKE auf Tabellenebene nimmt auch die Spaltenrechte.
-- Das Frontend fügt nur (member_id, photo_path, caption, sort_order) ein und
-- ändert nie per UPDATE; Beschriftung und Reihenfolge bleiben änderbar, der
-- Pfad nicht. anon hatte INSERT/UPDATE (ohne Policy wirkungslos) — jetzt weg.
REVOKE INSERT, UPDATE ON public.aufgieser_photos FROM anon, authenticated;
GRANT INSERT (member_id, photo_path, caption, sort_order) ON public.aufgieser_photos TO authenticated;
GRANT UPDATE (caption, sort_order) ON public.aufgieser_photos TO authenticated;


-- ─── 5) Nebenwege: Vorlagen und eigene Öle ─────────────────────────────────

CREATE OR REPLACE FUNCTION public._bildpfad_eigene_datei()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.image_path IS NOT DISTINCT FROM OLD.image_path THEN
    RETURN NEW;
  END IF;
  -- Nur Verweise in persönliche Ordner zählen für die Löschliste (0186).
  -- Mitgelieferte Bilder („/oele/…") und Admin-Ordner bleiben unberührt.
  IF NEW.image_path ~ '^(avatars|member-photos|aufgieser-photos|feed-posts)/'
     AND NOT public._eigener_asset_pfad(NEW.image_path) THEN
    RAISE EXCEPTION 'bild_nicht_eigene_datei' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._bildpfad_eigene_datei() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bildpfad_eigene_datei ON public.infusion_templates;
CREATE TRIGGER trg_bildpfad_eigene_datei
  BEFORE INSERT OR UPDATE OF image_path ON public.infusion_templates
  FOR EACH ROW EXECUTE FUNCTION public._bildpfad_eigene_datei();

-- Name beginnt mit „trg_b" → feuert vor trg_custom_oil_bild_erben (0157).
DROP TRIGGER IF EXISTS trg_bildpfad_eigene_datei ON public.member_custom_oils;
CREATE TRIGGER trg_bildpfad_eigene_datei
  BEFORE INSERT OR UPDATE OF image_path ON public.member_custom_oils
  FOR EACH ROW EXECUTE FUNCTION public._bildpfad_eigene_datei();


-- ─── 6) CHECK-Constraints als Rückhalt ─────────────────────────────────────

ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_avatar_pfad_chk;
ALTER TABLE public.members ADD CONSTRAINT members_avatar_pfad_chk
  CHECK (avatar_path IS NULL
         OR avatar_path LIKE 'dicebear:%'
         OR avatar_path ~ '^avatars/[^/.][^/]*$');

-- Das Namensschild ist reine Gestaltung (Form, Farben, Deko-ID) — ein
-- Dateipfad darin hätte nur den Zweck, eine fremde Datei „in Gebrauch" zu
-- halten (_storage_pfad_in_gebrauch sucht dort per strpos).
ALTER TABLE public.members DROP CONSTRAINT IF EXISTS members_nameplate_ohne_dateipfad_chk;
ALTER TABLE public.members ADD CONSTRAINT members_nameplate_ohne_dateipfad_chk
  CHECK (nameplate_config IS NULL
         OR nameplate_config::text !~ '(avatars|member-photos|aufgieser-photos|feed-posts)/');

ALTER TABLE public.feed_posts DROP CONSTRAINT IF EXISTS feed_posts_bild_pfad_chk;
ALTER TABLE public.feed_posts ADD CONSTRAINT feed_posts_bild_pfad_chk
  CHECK (image_path IS NULL OR image_path ~ '^feed-posts/[^/.][^/]*$');


-- ─── 7) Löschhelfer: feed_posts.meta nur für Dateien des Beitragsautors ────
-- Vorlage: Live-Fassung (0186), Signatur unverändert, nur der meta-Zweig ist
-- neu. Warum: In feed_posts.meta schreiben zwar nur Systemfunktionen, sie
-- übernehmen aber Freitexte, die das Mitglied selbst bestimmt:
--   - game_win: winner_name/loser_name = members.name — den Namen wählt ein
--     Gast bei der Registrierung frei (raw_user_meta_data.name, ungeprüft);
--   - Wochenrückblick: aufgiesser[].name, spiele[].name, oele[].id und
--     attribute[].id (aus infusions.oils/attributes).
-- Rollback belegt: Gast mit Namen „avatars/<uuid des Opfers>.jpg" gewinnt ein
-- Spiel → _storage_pfad_in_gebrauch(Opfer-Bild, Opfer) vorher false, nachher
-- true → das Bild wäre bei der Löschung des Opfers liegen geblieben.
-- Jetzt zählt ein meta-Treffer nur, wenn die Datei dem Autor des Beitrags
-- gehört. Heute steht in keinem meta ein Pfad (Spiele, Kart und
-- Wochenrückblick schreiben keinen), es kommt also keine Datei neu auf die
-- Löschliste. Die übrigen Zweige bleiben wörtlich wie in 0186.

CREATE OR REPLACE FUNCTION public._storage_pfad_in_gebrauch(p_pfad text, p_ausser uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (select 1 from public.members x where x.avatar_path = p_pfad and x.id is distinct from p_ausser)
      or exists (select 1 from public.members x where x.id is distinct from p_ausser
                   and x.nameplate_config is not null and strpos(x.nameplate_config::text, p_pfad) > 0)
      or exists (select 1 from public.member_photos x where x.photo_path = p_pfad and x.uploader_id is distinct from p_ausser)
      or exists (select 1 from public.aufgieser_photos x where x.photo_path = p_pfad and x.member_id is distinct from p_ausser)
      or exists (select 1 from public.feed_posts x where x.author_id is distinct from p_ausser
                   and x.image_path = p_pfad)
      or exists (select 1
                   from public.feed_posts x
                   join public.members a on a.id = x.author_id
                   join storage.objects o on o.bucket_id = 'assets' and o.name = p_pfad
                                         and coalesce(o.owner_id, o.owner::text) = a.auth_user_id::text
                  where x.author_id is distinct from p_ausser
                    and strpos(coalesce(x.meta::text, ''), p_pfad) > 0)
      or exists (select 1 from public.infusions x where x.image_path = p_pfad)
      or exists (select 1 from public.infusion_templates x where x.image_path = p_pfad and x.member_id is distinct from p_ausser)
      or exists (select 1 from public.member_custom_oils x where x.image_path = p_pfad and x.member_id is distinct from p_ausser)
      or exists (select 1 from public.saunas x where x.header_image = p_pfad)
      or exists (select 1 from public.org_news x where strpos(coalesce(x.cover_image_url, ''), p_pfad) > 0)
      or exists (select 1 from public.system_config x where strpos(coalesce(x.value::text, ''), p_pfad) > 0);
$function$;
