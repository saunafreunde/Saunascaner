-- 0186_datenschutz_loeschen_fristen.sql — Datenschutz: Löschrecht, vollständige
-- Kontolöschung, Speicherfristen, Einwilligungsnachweis, anonyme
-- Bewertungskommentare (Audit 25.09.2026, Gruppe G2)
--
-- Befunde und was diese Migration dagegen tut:
--
-- 1) Löschrecht blockiert: delete_member() scheiterte bei 5 von 73 Konten.
--    a) feed_posts.deleted_by, shared_email_admins.granted_by und
--       personal_shifts.created_by verwiesen ohne ON DELETE auf members —
--       wer fremde Beiträge moderiert oder Postfach-Rechte vergeben hatte, war
--       unlöschbar (23503). Jetzt ON DELETE SET NULL; personal_shifts.created_by
--       und aroma_recipes.created_by verlieren dafür NOT NULL (aroma_recipes
--       hatte schon SET NULL, das NOT NULL hätte jeden Rezept-Ersteller
--       unlöschbar gemacht). Die RLS-Policies verlangen beim Anlegen weiter den
--       eigenen Namen — NULL entsteht nur durch Löschen.
--    b) Der Banja-Trigger validate_infusion_banja_and_overlap() wertet das
--       ON DELETE SET NULL auf infusions.saunameister_id als UPDATE und prüft
--       es wie eine Planänderung (alte Aufgüsse mit „Banja" im Titel ohne
--       Banja-Merkmal → 2 von 73 Konten unlöschbar). Der Trigger gehört
--       Gruppe E1: 0183 enthält dafür jetzt einen Early-Return (Saunameister
--       fällt weg, sonst nichts geändert, Mitgliedszeile schon gelöscht).
--       Diese Migration ändert ihn NICHT; mit 0183 sind alle Konten löschbar.
--    c) trg_log_infusions schrieb beim Löschen eines Aufgießers für JEDEN
--       seiner vergangenen Aufgüsse einen Eintrag „infusion.reassign" ins
--       Protokoll (hunderte Zeilen je Löschung). Jetzt kein Eintrag, wenn der
--       Aufgießer wegfällt, weil sein Konto gelöscht wird.
--    d) system_config.updated_by verwies ohne ON DELETE auf auth.users.
--       kiosk_sperre_aktiv_setzen() (Joker-Sperre an/aus) trägt dort den Admin
--       ein — danach scheiterte delete_member() für diesen Admin am
--       DELETE FROM auth.users (23503). Jetzt ON DELETE SET NULL.
--
-- 2) Kontolöschung war unvollständig. Neuer BEFORE-DELETE-Trigger auf members
--    (_mitglied_vergessen, läuft bei JEDEM Löschen — Admin, Selbstlöschung,
--    Hand-SQL — nach Gruppe E2s trg_mitglied_loeschen_aufguesse_freigeben):
--      • Benachrichtigungen, die die Person nennen (neuer Fan, Direktnachricht
--        mit Textauszug, Spiel-Herausforderung, Aufguss-Ankündigung), werden
--        gelöscht.
--      • Protokoll: Name als Handelnde/r → „gelöschtes Konto", Name als
--        Betroffene/r → „gelöschtes Mitglied". Der Löscheintrag selbst
--        (trg_log_members) nennt keinen Namen mehr, nur ID und Rolle.
--      • Evakuierungslisten: Name → „gelöschte Person" (Anzahl bleibt).
--      • Feed: Wochenrückblicke (Aufgießer-Rangliste, Wochenbeste in
--        Spielen) → „gelöschtes Mitglied"; Spiel-Siege anderer („X hat Y
--        geschlagen") → „ein gelöschtes Konto". Namen werden nur ersetzt,
--        wenn kein anderes Mitglied denselben Namen trägt.
--      • E-Mail-Protokoll und Einladungen: Adresse/Notiz entfernt.
--      • Nachtabschluss-Protokoll (presence_audit): ID entfernt.
--      • Dateien (Profilbild, Fotos, Feed-Bilder): SQL darf storage.objects
--        nicht löschen (storage.protect_delete; ein SQL-Löschen ließe die Datei
--        im Speicher liegen). Deshalb Löschliste public.storage_loeschliste:
--        delete_member()/delete_my_account() geben die Pfade zurück, die App
--        entfernt sie sofort über die Storage-API; was dabei liegen bleibt,
--        arbeitet ein Admin über storage_loeschliste_offen() ab (Admin →
--        Gäste). Nur Dateien in den persönlichen Ordnern und nur, wenn sie
--        sonst nirgends verwendet werden.
--    delete_member/delete_my_account/delete_my_gast_account liefern deshalb
--    text[] statt void (DROP + CREATE; alte App-Bundles ignorieren den Wert).
--
-- 3) Speicherfristen: datenschutz_aufraeumen(), täglich 03:45 UTC (pg_cron):
--      • Benachrichtigungen (notification_queue): nach 90 Tagen gelöscht
--      • Admin-Protokoll (activity_log): nach 24 Monaten gelöscht
--      • Besuchstage (attendance_events): nach 24 Monaten gelöscht — außer
--        beim Personal (role 'staff'; mögliche Arbeitszeitnachweise, Frist
--        klärt der Vorstand)
--      • Namenslisten beendeter Evakuierungsalarme: nach 90 Tagen geleert
--        (Zeitpunkt und Anzahl bleiben)
--      • Nachtabschluss-Protokoll: Mitglieder-IDs nach 90 Tagen geleert
--        (Anzahl bleibt für die Statistik)
--      • (E-Mail-Versandprotokoll: 12 Monate — eigener Job
--        'versandprotokolle-aufraeumen' aus 0187, Gruppe F2)
--      • Dateien in persönlichen Ordnern, die seit 7 Tagen niemand mehr
--        verwendet (ersetzte Profilbilder, gelöschte Beiträge), kommen auf
--        die Löschliste.
--    Mitgliederkonten werden NIE automatisch gelöscht (inaktive Gäste zeigt
--    der Admin-Reiter „Gäste" nur als Vorschlag).
--
-- 4) Einwilligungsnachweis: members.datenschutz_fassung hält fest, welche
--    Fassung der Datenschutzhinweise bei der Registrierung angezeigt und
--    bestätigt wurde. Die App schickt die Fassung in den Anmelde-Metadaten
--    (raw_user_meta_data->>'datenschutz_fassung'); ein BEFORE-INSERT-Trigger
--    übernimmt sie. handle_new_user bleibt unverändert (gehört Gruppe F1).
--
-- 5) Bewertungskommentare: Das Handbuch verspricht „anonym", die Liste auf
--    dem Aufgießer-Profil zeigte Name und Foto des Bewertenden.
--    list_aufgieser_rating_comments() liefert author_name/author_avatar jetzt
--    immer NULL, das Datum nur noch tagesgenau, höchstens 50 Einträge.
--
-- 6) Altbestand: Namen bereits gelöschter Konten in Protokoll, Evakuierungs-
--    listen, Benachrichtigungen und Feed (Wochenrückblick, Spiel-Siege)
--    werden einmalig entfernt; verwaiste Dateien gelöschter Konten kommen auf
--    die Löschliste.
--
-- Vorlagen: Live-Fassungen vom 25.09.2026 (pg_get_functiondef).

-- ─── 1a) Fremdschlüssel: Löschen darf nicht an Verweisen scheitern ─────────

ALTER TABLE public.feed_posts
  DROP CONSTRAINT feed_posts_deleted_by_fkey,
  ADD CONSTRAINT feed_posts_deleted_by_fkey FOREIGN KEY (deleted_by)
    REFERENCES public.members(id) ON DELETE SET NULL;

ALTER TABLE public.shared_email_admins
  DROP CONSTRAINT shared_email_admins_granted_by_fkey,
  ADD CONSTRAINT shared_email_admins_granted_by_fkey FOREIGN KEY (granted_by)
    REFERENCES public.members(id) ON DELETE SET NULL;

ALTER TABLE public.personal_shifts
  ALTER COLUMN created_by DROP NOT NULL,
  DROP CONSTRAINT personal_shifts_created_by_fkey,
  ADD CONSTRAINT personal_shifts_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.members(id) ON DELETE SET NULL;

ALTER TABLE public.aroma_recipes
  ALTER COLUMN created_by DROP NOT NULL;

-- 1d) Joker-Sperre-Schalter trägt den Admin (auth.users) ein.
ALTER TABLE public.system_config
  DROP CONSTRAINT IF EXISTS system_config_updated_by_fkey,
  ADD CONSTRAINT system_config_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─── 1c) Protokoll: kein „reassign" je Aufguss, wenn ein Konto gelöscht wird ─

CREATE OR REPLACE FUNCTION public.trg_log_infusions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor record;
  v_label text;
  v_sauna_name text;
BEGIN
  SELECT * INTO v_actor FROM public.log_activity_actor();

  IF TG_OP = 'INSERT' THEN
    SELECT name INTO v_sauna_name FROM public.saunas WHERE id = NEW.sauna_id;
    v_label := coalesce(v_sauna_name, '?') || ' · ' || to_char(NEW.start_time, 'DD.MM HH24:MI');
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            'infusion.create', 'infusion', NEW.id, v_label,
            jsonb_build_object('sauna_id', NEW.sauna_id, 'meister_id', NEW.saunameister_id, 'is_personal_fallback', NEW.is_personal_fallback));
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT name INTO v_sauna_name FROM public.saunas WHERE id = OLD.sauna_id;
    v_label := coalesce(v_sauna_name, '?') || ' · ' || to_char(OLD.start_time, 'DD.MM HH24:MI');
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            'infusion.delete', 'infusion', OLD.id, v_label, NULL);
    RETURN OLD;
  END IF;

  -- Konto des Aufgießers gelöscht (ON DELETE SET NULL aus members, 0186):
  -- die Löschung steht schon als member.delete im Protokoll — kein Eintrag
  -- je vergangenem Aufguss.
  IF NEW.saunameister_id IS NULL AND OLD.saunameister_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.members WHERE id = OLD.saunameister_id) THEN
    RETURN NEW;
  END IF;

  -- Takeover: Saunameister-Wechsel (von NULL auf gesetzt, oder Wechsel)
  IF NEW.saunameister_id IS DISTINCT FROM OLD.saunameister_id THEN
    SELECT name INTO v_sauna_name FROM public.saunas WHERE id = NEW.sauna_id;
    v_label := coalesce(v_sauna_name, '?') || ' · ' || to_char(NEW.start_time, 'DD.MM HH24:MI');
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            CASE WHEN OLD.saunameister_id IS NULL THEN 'infusion.takeover' ELSE 'infusion.reassign' END,
            'infusion', NEW.id, v_label,
            jsonb_build_object('from_meister_id', OLD.saunameister_id, 'to_meister_id', NEW.saunameister_id));
  END IF;

  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.trg_log_infusions() FROM PUBLIC, anon, authenticated;

-- ─── 2) Löschliste für Dateien ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.storage_loeschliste (
  pfad        text PRIMARY KEY,
  -- bewusst ohne Fremdschlüssel: das Konto ist beim Abarbeiten schon gelöscht
  mitglied_id uuid,
  angelegt_am timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.storage_loeschliste IS
  'Dateien im Bucket assets, die gelöscht werden sollen (gelöschte Konten, verwaiste persönliche Dateien). '
  'SQL darf storage.objects nicht löschen; abgearbeitet über die Storage-API (App nach delete_member/delete_my_account, '
  'Admin über storage_loeschliste_offen). 0186.';
ALTER TABLE public.storage_loeschliste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.storage_loeschliste FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_loeschliste TO service_role;

-- Wird die Datei noch irgendwo verwendet? p_ausser: das Konto, das gerade
-- gelöscht wird (dessen eigene Verweise zählen nicht).
-- Geprüft werden alle Spalten, die solche Pfade aufnehmen können (Suche über
-- alle Text-/JSON-Spalten am 25.09.2026: belegt sind heute nur
-- members.avatar_path, member_photos.photo_path, aufgieser_photos.photo_path).
-- NEUE Spalten mit Pfaden aus avatars/, member-photos/, aufgieser-photos/ oder
-- feed-posts/ hier ergänzen — sonst kommen die Dateien nachts auf die Löschliste.
CREATE OR REPLACE FUNCTION public._storage_pfad_in_gebrauch(p_pfad text, p_ausser uuid DEFAULT NULL)
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
                   and (x.image_path = p_pfad or strpos(coalesce(x.meta::text, ''), p_pfad) > 0))
      or exists (select 1 from public.infusions x where x.image_path = p_pfad)
      or exists (select 1 from public.infusion_templates x where x.image_path = p_pfad and x.member_id is distinct from p_ausser)
      or exists (select 1 from public.member_custom_oils x where x.image_path = p_pfad and x.member_id is distinct from p_ausser)
      or exists (select 1 from public.saunas x where x.header_image = p_pfad)
      or exists (select 1 from public.org_news x where strpos(coalesce(x.cover_image_url, ''), p_pfad) > 0)
      or exists (select 1 from public.system_config x where strpos(coalesce(x.value::text, ''), p_pfad) > 0);
$function$;
REVOKE ALL ON FUNCTION public._storage_pfad_in_gebrauch(text, uuid) FROM PUBLIC, anon, authenticated;

-- Persönliche Ordner — nur dort räumt der Datenschutz automatisch auf
-- (Logos, Info-Karten, Hintergründe usw. bleiben unberührt).
CREATE OR REPLACE FUNCTION public._storage_pfad_persoenlich(p_pfad text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select split_part(coalesce(p_pfad, ''), '/', 1) in ('avatars', 'member-photos', 'aufgieser-photos', 'feed-posts')
     and position('/' in coalesce(p_pfad, '')) > 1;
$function$;
REVOKE ALL ON FUNCTION public._storage_pfad_persoenlich(text) FROM PUBLIC, anon, authenticated;

-- Admin: offene Einträge holen. Trägt vorher aus, was erledigt ist (Datei
-- nicht mehr im Speicher) oder inzwischen wieder verwendet wird.
CREATE OR REPLACE FUNCTION public.storage_loeschliste_offen()
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_pfade text[];
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  delete from public.storage_loeschliste l
   where not exists (select 1 from storage.objects o
                      where o.bucket_id = 'assets' and o.name = l.pfad)
      or public._storage_pfad_in_gebrauch(l.pfad, null);

  select coalesce(array_agg(pfad order by angelegt_am, pfad), '{}'::text[])
    into v_pfade
    from public.storage_loeschliste;
  return v_pfade;
end;
$function$;
REVOKE ALL ON FUNCTION public.storage_loeschliste_offen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_loeschliste_offen() TO authenticated, service_role;

-- ─── 2) Konto vergessen: läuft bei jedem DELETE FROM members ──────────────

-- Namenslisten im Feed (Wochenrückblick: [{"name": …, "anzahl": …}, …]):
-- Einträge mit einem der Namen bekommen den Ersatztext, Reihenfolge bleibt.
CREATE OR REPLACE FUNCTION public._namen_in_liste_ersetzen(p_liste jsonb, p_namen text[], p_ersatz text)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select case
    when p_liste is null or jsonb_typeof(p_liste) <> 'array' then p_liste
    else coalesce((
      select jsonb_agg(case when jsonb_typeof(x.e) = 'object' and x.e->>'name' = any (p_namen)
                            then jsonb_set(x.e, '{name}', to_jsonb(p_ersatz))
                            else x.e end
                       order by x.o)
        from jsonb_array_elements(p_liste) with ordinality x(e, o)), '[]'::jsonb)
  end;
$function$;
REVOKE ALL ON FUNCTION public._namen_in_liste_ersetzen(jsonb, text[], text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._mitglied_vergessen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_id    text := OLD.id::text;
  v_auth  text := OLD.auth_user_id::text;
  v_email text := lower(nullif(btrim(coalesce(OLD.email::text, '')), ''));
  -- Anzeigename wie im Wochenrückblick (Saunaname, sonst Name).
  v_anzeige text := nullif(btrim(coalesce(public.anzeigename(OLD.name, OLD.sauna_name), '')), '');
  -- Namen nur ersetzen, wenn sie eindeutig diese Person meinen — sonst träfe
  -- es die Einträge eines gleichnamigen Mitglieds.
  v_name_frei boolean;
  v_anzeige_frei boolean;
begin
  v_name_frei := nullif(btrim(OLD.name), '') is not null
    and not exists (select 1 from public.members m where m.id <> OLD.id and m.name = OLD.name);
  v_anzeige_frei := v_anzeige is not null
    and not exists (select 1 from public.members m
                     where m.id <> OLD.id and public.anzeigename(m.name, m.sauna_name) = v_anzeige);

  -- Dateien → Löschliste (nur persönliche Ordner, nur wenn sonst ungenutzt).
  insert into public.storage_loeschliste (pfad, mitglied_id)
  select distinct k.pfad, OLD.id
    from (
      select OLD.avatar_path as pfad
      union all select x.photo_path from public.member_photos x where x.uploader_id = OLD.id
      union all select x.photo_path from public.aufgieser_photos x where x.member_id = OLD.id
      union all select x.image_path from public.feed_posts x where x.author_id = OLD.id
      union all select o.name from storage.objects o
                 where v_auth is not null
                   and o.bucket_id = 'assets'
                   and coalesce(o.owner_id, o.owner::text) = v_auth
    ) k
   where public._storage_pfad_persoenlich(k.pfad)
     and exists (select 1 from storage.objects o where o.bucket_id = 'assets' and o.name = k.pfad)
     and not public._storage_pfad_in_gebrauch(k.pfad, OLD.id)
  on conflict (pfad) do update
    set mitglied_id = coalesce(public.storage_loeschliste.mitglied_id, excluded.mitglied_id);

  -- Benachrichtigungen an andere, die die Person nennen (follower_id,
  -- sender_id + Textauszug, challenger_id, saunameister_id …). Die eigenen
  -- (recipient_id) löscht ON DELETE CASCADE.
  delete from public.notification_queue q
   where jsonb_typeof(q.payload) = 'object'
     and exists (select 1 from jsonb_each_text(q.payload) e where e.value = v_id);

  -- Protokoll: Namen ersetzen, IDs bleiben als Nachweis.
  update public.activity_log set actor_name = 'gelöschtes Konto'
   where actor_id = OLD.id and actor_name is distinct from 'gelöschtes Konto';
  update public.activity_log set target_label = 'gelöschtes Mitglied'
   where target_type = 'member' and target_id = OLD.id
     and target_label is distinct from 'gelöschtes Mitglied';

  -- Evakuierungslisten (Freitext-Namen, Anzahl bleibt).
  if v_name_frei then
    update public.evacuation_events
       set present_names = array_replace(present_names, OLD.name, 'gelöschte Person')
     where OLD.name = any(present_names);
  end if;

  -- Feed: Wochenrückblicke nennen Aufgießer und Wochenbeste nur mit Namen.
  if v_anzeige_frei then
    update public.feed_posts f
       set meta = f.meta
         || case when f.meta ? 'aufgiesser' then jsonb_build_object('aufgiesser',
              public._namen_in_liste_ersetzen(f.meta->'aufgiesser', array[v_anzeige], 'gelöschtes Mitglied'))
            else '{}'::jsonb end
         || case when f.meta ? 'spiele' then jsonb_build_object('spiele',
              public._namen_in_liste_ersetzen(f.meta->'spiele', array[v_anzeige], 'gelöschtes Mitglied'))
            else '{}'::jsonb end
     where f.post_kind = 'wochenrueckblick'
       and jsonb_typeof(f.meta) = 'object'
       and (coalesce(f.meta->'aufgiesser', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('name', v_anzeige))
         or coalesce(f.meta->'spiele', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('name', v_anzeige)));
  end if;

  -- Feed: Spiel-Siege anderer („X hat Y im Schach geschlagen."). Die eigenen
  -- Beiträge löscht ON DELETE CASCADE.
  update public.feed_posts f
     set caption = coalesce(f.meta->>'winner_name', 'Jemand') || ' hat ein gelöschtes Konto im '
                   || coalesce(f.meta->>'label', 'Spiel') || ' geschlagen.',
         meta = f.meta || jsonb_build_object('loser_id', null, 'loser_name', 'gelöschtes Konto')
   where f.post_kind = 'game_win'
     and jsonb_typeof(f.meta) = 'object'
     and f.meta->>'loser_id' = v_id;

  -- Nachtabschluss-Protokoll: nur IDs, Anzahl bleibt.
  update public.presence_audit set member_ids = array_remove(member_ids, OLD.id)
   where OLD.id = any(member_ids);

  -- E-Mail-Versandprotokoll und Einladungen.
  update public.email_log set recipient = 'gelöschtes Konto'
   where related_member_id = OLD.id
      or (v_email is not null and lower(recipient) = v_email);
  update public.email_log set sender_email = null
   where sender_member_id = OLD.id and sender_email is not null;
  update public.invitations set sent_to_email = null, note = null
   where used_by = OLD.id;
  if v_email is not null then
    update public.invitations set sent_to_email = null
     where lower(sent_to_email) = v_email;
  end if;

  return OLD;
end;
$function$;
REVOKE ALL ON FUNCTION public._mitglied_vergessen() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_mitglied_loeschen_vergessen ON public.members;
CREATE TRIGGER trg_mitglied_loeschen_vergessen
  BEFORE DELETE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public._mitglied_vergessen();

-- Löscheintrag ohne Klarnamen (Rest wörtlich wie live).
CREATE OR REPLACE FUNCTION public.trg_log_members()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor record;
BEGIN
  SELECT * INTO v_actor FROM public.log_activity_actor();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            'member.create', 'member', NEW.id, NEW.name,
            jsonb_build_object('role', NEW.role, 'is_aufgieser', NEW.is_aufgieser));
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    -- Kein Name (Art. 17): ID und Rolle genügen als Nachweis der Löschung.
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            'member.delete', 'member', OLD.id, 'gelöschtes Mitglied',
            jsonb_build_object('role', OLD.role));
    RETURN OLD;
  END IF;

  -- UPDATE: nur kritische Felder loggen
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            'member.role_change', 'member', NEW.id, NEW.name,
            jsonb_build_object('from_role', OLD.role, 'to_role', NEW.role));
  END IF;

  IF NEW.is_aufgieser IS DISTINCT FROM OLD.is_aufgieser THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            CASE WHEN NEW.is_aufgieser THEN 'member.aufgieser_grant' ELSE 'member.aufgieser_revoke' END,
            'member', NEW.id, NEW.name, NULL);
  END IF;

  IF NEW.is_wm_admin IS DISTINCT FROM OLD.is_wm_admin THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            CASE WHEN NEW.is_wm_admin THEN 'member.wm_admin_grant' ELSE 'member.wm_admin_revoke' END,
            'member', NEW.id, NEW.name, NULL);
  END IF;

  IF NEW.is_personal_planer IS DISTINCT FROM OLD.is_personal_planer THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            CASE WHEN NEW.is_personal_planer THEN 'member.cp_grant' ELSE 'member.cp_revoke' END,
            'member', NEW.id, NEW.name, NULL);
  END IF;

  IF NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            CASE WHEN NEW.revoked_at IS NOT NULL THEN 'member.lock' ELSE 'member.unlock' END,
            'member', NEW.id, NEW.name, NULL);
  END IF;

  IF NEW.paid_until IS DISTINCT FROM OLD.paid_until THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            'member.paid_until_change', 'member', NEW.id, NEW.name,
            jsonb_build_object('from', OLD.paid_until::text, 'to', NEW.paid_until::text));
  END IF;

  IF NEW.approved IS DISTINCT FROM OLD.approved AND NEW.approved = true THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            'member.approve', 'member', NEW.id, NEW.name,
            jsonb_build_object('role', NEW.role));
  END IF;

  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.trg_log_members() FROM PUBLIC, anon, authenticated;

-- ─── 2) Lösch-RPCs: geben die zu entfernenden Dateien zurück ───────────────

DROP FUNCTION IF EXISTS public.delete_my_gast_account();
DROP FUNCTION IF EXISTS public.delete_my_account();
DROP FUNCTION IF EXISTS public.delete_member(uuid);

CREATE FUNCTION public.delete_member(p_member_id uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_auth_user_id uuid;
  v_pfade text[];
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  select auth_user_id into v_auth_user_id
    from public.members
   where id = p_member_id;

  if not found then
    raise exception 'not_found';
  end if;

  -- Trigger: trg_mitglied_loeschen_aufguesse_freigeben (E2),
  -- trg_mitglied_loeschen_vergessen (Namen, Benachrichtigungen, Löschliste).
  delete from public.members where id = p_member_id;

  if v_auth_user_id is not null then
    delete from auth.users where id = v_auth_user_id;
  end if;

  select coalesce(array_agg(pfad order by pfad), '{}'::text[]) into v_pfade
    from public.storage_loeschliste
   where mitglied_id = p_member_id;
  return v_pfade;
end;
$function$;

CREATE FUNCTION public.delete_my_account()
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_member uuid;
  v_role text;
  v_pfade text[];
BEGIN
  SELECT id, role INTO v_member, v_role
  FROM public.members
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF v_member IS NULL THEN
    RAISE EXCEPTION 'not_logged_in';
  END IF;

  -- Self-Delete nur für niedrigschwellige Rollen erlaubt (gast/fan).
  -- Aktiv-Mitglieder müssen über den Vereinsvorstand (Admin-Löschung) gehen.
  IF v_role NOT IN ('gast', 'fan') THEN
    RAISE EXCEPTION 'self_delete_not_allowed_for_role_%', v_role
      USING HINT = 'Aktiv-Mitglieder bitte über den Vereinsvorstand löschen lassen.';
  END IF;

  DELETE FROM public.members WHERE id = v_member;
  DELETE FROM auth.users WHERE id = auth.uid();

  SELECT coalesce(array_agg(pfad ORDER BY pfad), '{}'::text[]) INTO v_pfade
    FROM public.storage_loeschliste
   WHERE mitglied_id = v_member;
  RETURN v_pfade;
END;
$function$;

CREATE FUNCTION public.delete_my_gast_account()
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
BEGIN
  RETURN public.delete_my_account();
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_member(uuid), public.delete_my_account(), public.delete_my_gast_account()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_member(uuid), public.delete_my_account(), public.delete_my_gast_account()
  TO authenticated, service_role;

-- ─── 3) Speicherfristen ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.datenschutz_aufraeumen()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  n_benachrichtigungen int;
  n_protokoll int;
  n_besuche int;
  n_evakuierung int;
  n_nachtabschluss int;
  n_dateien int;
begin
  -- Benachrichtigungen (Posteingang, Push-Warteschlange): 90 Tage.
  delete from public.notification_queue
   where created_at < now() - interval '90 days';
  get diagnostics n_benachrichtigungen = row_count;

  -- Admin-Protokoll: 24 Monate.
  delete from public.activity_log
   where occurred_at < now() - interval '24 months';
  get diagnostics n_protokoll = row_count;

  -- Besuchstage: 24 Monate. Personal (staff) ausgenommen — mögliche
  -- Arbeitszeitnachweise (export_staff_attendance), Frist klärt der Vorstand.
  delete from public.attendance_events a
   where a.date < ((now() at time zone 'Europe/Berlin')::date - interval '24 months')::date
     and not exists (select 1 from public.members m
                      where m.id = a.member_id and m.role = 'staff');
  get diagnostics n_besuche = row_count;

  -- Namenslisten beendeter Evakuierungsalarme: 90 Tage (Zeit + Anzahl bleiben).
  -- (Ein nie beendeter Alarm gilt nach 90 Tagen ebenfalls als abgeschlossen.)
  update public.evacuation_events set present_names = '{}'::text[]
   where coalesce(ended_at, triggered_at) < now() - interval '90 days'
     and cardinality(present_names) > 0;
  get diagnostics n_evakuierung = row_count;

  -- Nachtabschluss (wer um 2 Uhr noch eingecheckt war): IDs nach 90 Tagen weg.
  update public.presence_audit set member_ids = '{}'::uuid[]
   where reset_at < now() - interval '90 days'
     and cardinality(member_ids) > 0;
  get diagnostics n_nachtabschluss = row_count;

  -- (E-Mail-Versandprotokoll: 12 Monate, eigener Job
  -- 'versandprotokolle-aufraeumen' aus 0187, Gruppe F2.)

  -- Persönliche Dateien, die seit 7 Tagen niemand mehr verwendet (ersetzte
  -- Profilbilder, gelöschte Beiträge/Fotos) → Löschliste (Admin räumt ab).
  insert into public.storage_loeschliste (pfad)
  select o.name
    from storage.objects o
   where o.bucket_id = 'assets'
     and public._storage_pfad_persoenlich(o.name)
     and o.created_at < now() - interval '7 days'
     and not public._storage_pfad_in_gebrauch(o.name, null)
  on conflict (pfad) do nothing;
  get diagnostics n_dateien = row_count;

  return jsonb_build_object(
    'benachrichtigungen', n_benachrichtigungen,
    'protokoll', n_protokoll,
    'besuchstage', n_besuche,
    'evakuierungslisten', n_evakuierung,
    'nachtabschluss', n_nachtabschluss,
    'dateien_vorgemerkt', n_dateien);
end;
$function$;
REVOKE ALL ON FUNCTION public.datenschutz_aufraeumen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.datenschutz_aufraeumen() TO service_role;

DO $$ BEGIN
  PERFORM cron.unschedule('datenschutz-aufraeumen');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 03:45 UTC = 05:45 Sommerzeit / 04:45 Winterzeit; kollidiert mit keinem Job.
SELECT cron.schedule(
  'datenschutz-aufraeumen',
  '45 3 * * *',
  $$select public.datenschutz_aufraeumen();$$
);

-- ─── 4) Einwilligungsnachweis: Fassung der Datenschutzhinweise ─────────────

ALTER TABLE public.members ADD COLUMN IF NOT EXISTS datenschutz_fassung text;
COMMENT ON COLUMN public.members.datenschutz_fassung IS
  'Fassung (JJJJ-MM-TT) der Datenschutzhinweise, die bei der Registrierung angezeigt und bestätigt wurde; '
  'Zeitpunkt = gast_consent_at bzw. created_at. NULL = vor dem 25.09.2026 oder unbekannt. 0186.';

CREATE OR REPLACE FUNCTION public._members_datenschutz_fassung()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_fassung text;
begin
  -- Nachweis: aus der App (anon/authenticated) nicht änderbar.
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if TG_OP = 'UPDATE' then
      NEW.datenschutz_fassung := OLD.datenschutz_fassung;
      return NEW;
    end if;
    NEW.datenschutz_fassung := null;
  end if;

  if TG_OP = 'INSERT' and NEW.datenschutz_fassung is null and NEW.auth_user_id is not null then
    select u.raw_user_meta_data->>'datenschutz_fassung' into v_fassung
      from auth.users u where u.id = NEW.auth_user_id;
    if v_fassung ~ '^\d{4}-\d{2}-\d{2}$' then
      NEW.datenschutz_fassung := v_fassung;
    end if;
  end if;
  return NEW;
end;
$function$;
REVOKE ALL ON FUNCTION public._members_datenschutz_fassung() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_members_datenschutz_fassung ON public.members;
CREATE TRIGGER trg_members_datenschutz_fassung
  BEFORE INSERT OR UPDATE OF datenschutz_fassung ON public.members
  FOR EACH ROW EXECUTE FUNCTION public._members_datenschutz_fassung();

-- ─── 5) Bewertungskommentare anonym ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_aufgieser_rating_comments(p_aufgieser_id uuid, p_limit integer DEFAULT 10)
 RETURNS TABLE(rating_id uuid, infusion_id uuid, infusion_title text, rated_at timestamp with time zone, author_name text, author_avatar text, comment text, avg_score numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  -- Anonym (Handbuch: „bewerten … anonym"): kein Name, kein Foto, Datum nur
  -- tagesgenau. Die Spalten bleiben für alte App-Bundles erhalten (immer NULL).
  select r.id, i.id, i.title,
         date_trunc('day', r.created_at at time zone 'Europe/Berlin') at time zone 'Europe/Berlin',
         null::text, null::text, r.comment,
         round(((r.chemie + r.luftbewegung + r.wedeltechnik + r.hitzeniveau + r.musik + r.duftentwicklung) / 6.0)::numeric, 1)
    from public.infusion_ratings r
    join public.infusions i on i.id = r.infusion_id
   where i.saunameister_id = p_aufgieser_id
     and r.comment is not null
     and char_length(btrim(r.comment)) > 0
   order by r.created_at desc
   limit least(greatest(coalesce(p_limit, 10), 1), 50);
$function$;
REVOKE ALL ON FUNCTION public.list_aufgieser_rating_comments(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_aufgieser_rating_comments(uuid, integer) TO authenticated, service_role;

-- ─── 6) Altbestand bereinigen ──────────────────────────────────────────────

-- Namen gelöschter Konten stehen heute in den member.delete-Einträgen. Zuerst
-- damit die anderen Stellen finden, danach die Einträge selbst ersetzen.
DO $$
DECLARE
  v_namen text[];
  v_frei  text[];
  v_name  text;
BEGIN
  SELECT coalesce(array_agg(DISTINCT a.target_label), '{}') INTO v_namen
    FROM public.activity_log a
   WHERE a.action = 'member.delete'
     AND nullif(btrim(a.target_label), '') IS NOT NULL
     AND a.target_label <> 'gelöschtes Mitglied'
     AND NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = a.target_id)
     -- Gleichnamige lebende Mitglieder nicht treffen.
     AND NOT EXISTS (SELECT 1 FROM public.members m WHERE m.name = a.target_label);

  -- Handelnde, deren Konto gelöscht ist (actor_id per SET NULL leer).
  UPDATE public.activity_log SET actor_name = 'gelöschtes Konto'
   WHERE actor_id IS NULL AND actor_name = ANY (v_namen);

  -- Evakuierungslisten.
  FOREACH v_name IN ARRAY v_namen LOOP
    UPDATE public.evacuation_events
       SET present_names = array_replace(present_names, v_name, 'gelöschte Person')
     WHERE v_name = ANY (present_names);
  END LOOP;

  -- Wochenrückblicke im Feed (dort steht der Anzeigename; nur Namen, die
  -- kein lebendes Mitglied als Anzeigenamen trägt).
  SELECT coalesce(array_agg(x), '{}') INTO v_frei
    FROM unnest(v_namen) x
   WHERE NOT EXISTS (SELECT 1 FROM public.members m
                      WHERE public.anzeigename(m.name, m.sauna_name) = x);
  IF cardinality(v_frei) > 0 THEN
    UPDATE public.feed_posts f
       SET meta = f.meta
         || CASE WHEN f.meta ? 'aufgiesser' THEN jsonb_build_object('aufgiesser',
              public._namen_in_liste_ersetzen(f.meta->'aufgiesser', v_frei, 'gelöschtes Mitglied'))
            ELSE '{}'::jsonb END
         || CASE WHEN f.meta ? 'spiele' THEN jsonb_build_object('spiele',
              public._namen_in_liste_ersetzen(f.meta->'spiele', v_frei, 'gelöschtes Mitglied'))
            ELSE '{}'::jsonb END
     WHERE f.post_kind = 'wochenrueckblick'
       AND jsonb_typeof(f.meta) = 'object'
       AND (public._namen_in_liste_ersetzen(f.meta->'aufgiesser', v_frei, 'gelöschtes Mitglied')
              IS DISTINCT FROM f.meta->'aufgiesser'
         OR public._namen_in_liste_ersetzen(f.meta->'spiele', v_frei, 'gelöschtes Mitglied')
              IS DISTINCT FROM f.meta->'spiele');
  END IF;
END $$;

-- Spiel-Siege über inzwischen gelöschte Konten.
UPDATE public.feed_posts f
   SET caption = coalesce(f.meta->>'winner_name', 'Jemand') || ' hat ein gelöschtes Konto im '
                 || coalesce(f.meta->>'label', 'Spiel') || ' geschlagen.',
       meta = f.meta || jsonb_build_object('loser_id', null, 'loser_name', 'gelöschtes Konto')
 WHERE f.post_kind = 'game_win'
   AND jsonb_typeof(f.meta) = 'object'
   AND f.meta->>'loser_id' IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id::text = f.meta->>'loser_id');

UPDATE public.activity_log a SET target_label = 'gelöschtes Mitglied'
 WHERE a.target_type = 'member'
   AND a.target_id IS NOT NULL
   AND a.target_label IS DISTINCT FROM 'gelöschtes Mitglied'
   AND NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = a.target_id);

-- Benachrichtigungen, die gelöschte Personen nennen.
DELETE FROM public.notification_queue q
 WHERE jsonb_typeof(q.payload) = 'object'
   AND EXISTS (
     SELECT 1 FROM jsonb_each_text(q.payload) e
      WHERE e.key IN ('follower_id', 'sender_id', 'challenger_id', 'saunameister_id', 'member_id')
        AND e.value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        -- Textvergleich statt ::uuid: kein Abbruch, falls der Planer die
        -- Bedingungen umsortiert und auf einen Nicht-UUID-Wert trifft.
        AND NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id::text = lower(e.value)));

-- Dateien, deren Besitzer-Konto es nicht mehr gibt und die niemand verwendet.
INSERT INTO public.storage_loeschliste (pfad)
SELECT o.name
  FROM storage.objects o
 WHERE o.bucket_id = 'assets'
   AND public._storage_pfad_persoenlich(o.name)
   AND coalesce(o.owner_id, o.owner::text) IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM auth.users u
                    WHERE u.id::text = coalesce(o.owner_id, o.owner::text))
   AND NOT public._storage_pfad_in_gebrauch(o.name, NULL)
ON CONFLICT (pfad) DO NOTHING;
