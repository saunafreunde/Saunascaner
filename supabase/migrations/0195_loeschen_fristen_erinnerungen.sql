-- 0195_loeschen_fristen_erinnerungen.sql
-- ---------------------------------------------------------------------
-- Kontolöschung, Speicherfristen, Bewertungs-Erinnerungen, Fehlerberichte
-- (Audit-Runde 2, 25.09.2026, Gruppe R5).
--
-- Befunde:
--  * Löschte ein Admin das Konto des Admins, der das Vereinspostfach
--    eingerichtet hatte, riss ON DELETE CASCADE das gemeinsame Postfach samt
--    Freigaben aller Postfach-Admins und Tickets mit. Die IMAP-Passwörter
--    (samt Adresse im Namen) blieben dagegen verwaist im Vault liegen — nur
--    revoke_email_account räumte sie ab. Neu:
--      - _mitglied_vergessen() übergibt Vereinspostfächer an einen
--        verbleibenden Admin (bevorzugt einen, der das Postfach schon
--        mitbetreut). Gibt es keinen, bleibt es beim Mitlöschen — das
--        Löschrecht wird nie blockiert.
--      - Trigger trg_email_konto_geheimnis_loeschen auf email_accounts
--        löscht das Vault-Geheimnis bei JEDEM Löschweg (auch per Kaskade)
--        und wenn ein Geheimnis ersetzt wird.
--      - get_email_credentials, my_email_account und grant_email_account
--        betrachten nur noch das persönliche Postfach (not is_shared). Sonst
--        bekäme der neue Besitzer das Vereinspostfach als „sein" Postfach,
--        und grant_email_account könnte es überschreiben.
--  * Wochenrückblicke gehören technisch dem dienstältesten Admin
--    (post_wochenrueckblick). Wurde der gelöscht, verschwanden per Kaskade
--    alle Rückblicke samt Reaktionen. Neu: Sie werden vorher an den nächsten
--    Admin (sonst ein Vereinsmitglied) übergeben; die Karte zeigt ohnehin
--    „Saunafreunde".
--  * E-Mail-Protokoll: Die Adresse konnte nach der Löschung im Fehlertext
--    stehen bleiben (nodemailer nennt sie in der Server-Antwort). Neu:
--    _mitglied_vergessen() ersetzt Adressen im Fehlertext der betroffenen
--    Zeilen; api/_email_helpers.ts filtert sie schon beim Schreiben.
--  * Bewertungs-Erinnerung (Glocke) ging an jeden, der an dem Tag irgendwann
--    eingecheckt war — auch an längst Ausgecheckte und an Leute, die erst
--    nach dem Aufguss kamen. Neu: _war_beim_aufguss() verlangt, dass die
--    Person vor dem Ende eingecheckt und nicht vor dem Beginn ausgecheckt
--    hat. Gilt für Glocke (cron_notify_rating_window_open) und Push
--    (rating_pending_reminders).
--  * Push-Erinnerung: kam alle 30 Minuten erneut und nannte Nicht-Aufgießern
--    „noch X Min", obwohl sie bis 12:00 am Folgetag bewerten dürfen. Neu:
--    rating_pending_reminders liefert die echte Frist (Spalte frist) und
--    lässt Aufgüsse weg, an die schon per Push erinnert wurde (Tabelle
--    bewertung_push_erinnerungen, je Person und Aufguss genau einmal).
--  * Speicherfristen: kiosk_versuche (IP-Bremse) wurde nur beim nächsten
--    Schreiben aufgeräumt — nach einer ruhigen Phase blieben IP-Adressen
--    tagelang stehen. Aufguss-Teilnahmen (infusion_attendances, mit Uhrzeit),
--    Telegram-Erinnerungs-Vermerke und nie bestätigte Registrierungen
--    (auth.users ohne Mitglieds-Zeile, seit 0189) hatten gar keine Frist.
--    Neu: eigener Job alle 10 Minuten für kiosk_versuche (1 Tag), in
--    datenschutz_aufraeumen(): Aufguss-Teilnahmen 24 Monate (wie
--    Besuchstage), Erinnerungs-Vermerke 7 Tage, unbestätigte Registrierungen
--    7 Tage nach der letzten Anfrage. Bewertungen, Abzeichen, Aufgüsse und
--    Besuchstage (Statistik, Bestenlisten, Personal-Nachweis) bleiben
--    unberührt.
--  * client_fehler_melden: Die Grenze von 60 neuen Meldungen je Stunde galt
--    für alle zusammen — anonym ausschöpfbar, danach gingen echte Berichte
--    verloren und der 5000-Zeilen-Deckel verdrängte ältere echte Einträge.
--    Neu: vier Töpfe (freigegebenes Mitglied ohne Gast-Rolle 60/h,
--    gekoppeltes Kiosk-Gerät 60/h über den neuen Parameter p_geraet_token,
--    sonstiges angemeldetes Konto 30/h — Gäste und noch nicht freigegebene
--    Konten legt jeder selbst an —, anonym 30/h); ein bekannter Fehler wird
--    weiter gezählt und dabei zum vertrauenswürdigeren Topf hochgestuft; der
--    Zeilendeckel und die Admin-Liste lassen anonyme Zeilen zuerst weichen.
--
-- Signaturwechsel: client_fehler_melden bekommt einen 6. Parameter
-- (p_geraet_token, Standard NULL) — die alte 5-Parameter-Fassung wird
-- entfernt. Alte App-Stände (5 benannte Parameter) treffen weiter die neue
-- Funktion. Die Selbstprüfung in 0188 prüft noch die 5-Parameter-Signatur:
-- 0188 NICHT erneut einspielen (sie legte die alte Fassung wieder an).
-- rating_pending_reminders bekommt die Spalte frist (DROP + CREATE).
--
-- Reihenfolge: VOR dem Deploy einspielen. Der alte Code verträgt die neue
-- Spalte (wird ignoriert). Der neue Push-Code braucht die Tabelle
-- bewertung_push_erinnerungen — ohne Migration schickt er keine Erinnerung.
-- Wiederholbar.
-- ---------------------------------------------------------------------


-- ─── 1) Vault-Geheimnis mit dem Postfach löschen ───────────────────────────
CREATE OR REPLACE FUNCTION public._email_konto_geheimnis_loeschen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.vault_secret_id IS NOT DISTINCT FROM OLD.vault_secret_id THEN
    RETURN NULL;
  END IF;
  -- Nur löschen, wenn kein anderes Postfach dasselbe Geheimnis nutzt.
  IF OLD.vault_secret_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.email_accounts e
                      WHERE e.vault_secret_id = OLD.vault_secret_id) THEN
    DELETE FROM vault.secrets WHERE id = OLD.vault_secret_id;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public._email_konto_geheimnis_loeschen() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_email_konto_geheimnis_loeschen ON public.email_accounts;
CREATE TRIGGER trg_email_konto_geheimnis_loeschen
  AFTER DELETE OR UPDATE OF vault_secret_id ON public.email_accounts
  FOR EACH ROW EXECUTE FUNCTION public._email_konto_geheimnis_loeschen();

-- Altbestand: Postfach-Geheimnisse, auf die kein Postfach mehr zeigt. Nur die
-- Präfixe der Postfach-Funktionen — andere Geheimnisse (cron_secret …) bleiben.
DELETE FROM vault.secrets v
 WHERE (v.name LIKE 'email_account:%' OR v.name LIKE 'shared_email_account:%')
   AND NOT EXISTS (SELECT 1 FROM public.email_accounts e WHERE e.vault_secret_id = v.id);


-- ─── 2) Persönliche Postfach-Funktionen: nur das persönliche Postfach ─────
-- (Vorlage: Live-Fassungen, geändert ist jeweils nur „and not is_shared".)
CREATE OR REPLACE FUNCTION public.get_email_credentials(p_member_id uuid)
 RETURNS TABLE(email_address text, imap_host text, imap_port integer, smtp_host text, smtp_port integer, password text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$
declare
  v_account public.email_accounts%rowtype;
  v_secret  text;
begin
  -- Nur das persönliche Postfach; Vereinspostfächer: get_shared_email_credentials.
  select * into v_account from public.email_accounts
   where member_id = p_member_id and active = true and not is_shared;
  if not found then return; end if;

  select decrypted_secret into v_secret
    from vault.decrypted_secrets where id = v_account.vault_secret_id;
  if v_secret is null then return; end if;

  email_address := v_account.email_address;
  imap_host     := v_account.imap_host;
  imap_port     := v_account.imap_port;
  smtp_host     := v_account.smtp_host;
  smtp_port     := v_account.smtp_port;
  password      := v_secret;
  return next;
end;
$function$;

CREATE OR REPLACE FUNCTION public.my_email_account()
 RETURNS email_accounts
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select e.* from public.email_accounts e
    join public.members m on m.id = e.member_id
   where m.auth_user_id = auth.uid()
     and e.active = true
     and not e.is_shared
   limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.grant_email_account(p_member_id uuid, p_email text, p_password text, p_imap_host text DEFAULT 'w01b00df.kasserver.com'::text, p_imap_port integer DEFAULT 993, p_smtp_host text DEFAULT 'w01b00df.kasserver.com'::text, p_smtp_port integer DEFAULT 465, p_display_name text DEFAULT NULL::text)
 RETURNS email_accounts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'vault', 'extensions'
AS $function$
declare
  v_admin_id      uuid;
  v_secret_id     uuid;
  v_secret_name   text;
  v_account       public.email_accounts%rowtype;
  v_existing      public.email_accounts%rowtype;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if length(btrim(coalesce(p_email, ''))) < 3 then raise exception 'invalid_email'; end if;
  if length(btrim(coalesce(p_password, ''))) < 1 then raise exception 'password_required'; end if;

  select id into v_admin_id from public.members where auth_user_id = auth.uid();

  -- Nur das persönliche Postfach — ein Vereinspostfach desselben Besitzers
  -- darf hier nie überschrieben werden.
  select * into v_existing from public.email_accounts
   where member_id = p_member_id and not is_shared;
  if found then
    v_secret_name := 'email_account:' || v_existing.id || ':' || p_email;
    select vault.create_secret(p_password, v_secret_name, 'Email password (rotated) for ' || p_email)
      into v_secret_id;
    update public.email_accounts
       set email_address  = p_email,
           imap_host      = p_imap_host,
           imap_port      = p_imap_port,
           smtp_host      = p_smtp_host,
           smtp_port      = p_smtp_port,
           vault_secret_id = v_secret_id,
           display_name   = p_display_name,
           active         = true,
           granted_by     = v_admin_id,
           granted_at     = now()
     where id = v_existing.id
     returning * into v_account;
    delete from vault.secrets where id = v_existing.vault_secret_id;
    return v_account;
  end if;

  v_secret_name := 'email_account:' || gen_random_uuid()::text || ':' || p_email;
  select vault.create_secret(p_password, v_secret_name, 'Email password for ' || p_email)
    into v_secret_id;

  insert into public.email_accounts
    (member_id, email_address, imap_host, imap_port, smtp_host, smtp_port,
     vault_secret_id, display_name, granted_by)
  values
    (p_member_id, p_email, p_imap_host, p_imap_port, p_smtp_host, p_smtp_port,
     v_secret_id, p_display_name, v_admin_id)
  returning * into v_account;

  return v_account;
end;
$function$;


-- ─── 3) Kontolöschung: Vereinspostfach, Wochenrückblicke, E-Mail-Fehlertext ─
-- Vorlage: Live-Fassung aus 0186. Neu sind die Blöcke „Vereinspostfächer",
-- „Wochenrückblicke" und „Fehlertexte". Der Trigger läuft BEFORE DELETE, also
-- vor den Kaskaden — umgehängte Zeilen trifft ON DELETE CASCADE nicht mehr.
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
  v_konto_id uuid;
  v_nachfolger uuid;
  v_ersatz uuid;
begin
  v_name_frei := nullif(btrim(OLD.name), '') is not null
    and not exists (select 1 from public.members m where m.id <> OLD.id and m.name = OLD.name);
  v_anzeige_frei := v_anzeige is not null
    and not exists (select 1 from public.members m
                     where m.id <> OLD.id and public.anzeigename(m.name, m.sauna_name) = v_anzeige);

  -- Vereinspostfächer gehören dem Verein: an einen verbleibenden Admin
  -- übergeben (bevorzugt einen, der das Postfach schon mitbetreut). Ohne
  -- Nachfolger bleibt es beim Mitlöschen — das Löschrecht wird nie blockiert;
  -- das Vault-Geheimnis räumt trg_email_konto_geheimnis_loeschen ab.
  for v_konto_id in
    select e.id from public.email_accounts e
     where e.is_shared and e.member_id = OLD.id
  loop
    v_nachfolger := null;
    select m.id into v_nachfolger
      from public.members m
      left join public.shared_email_admins s
        on s.account_id = v_konto_id and s.member_id = m.id
     where m.id <> OLD.id
       and m.role = 'admin' and m.approved = true and m.revoked_at is null
     order by (s.member_id is not null) desc, s.granted_at nulls last, m.created_at
     limit 1;
    if v_nachfolger is not null then
      update public.email_accounts set member_id = v_nachfolger where id = v_konto_id;
      insert into public.shared_email_admins (account_id, member_id)
      values (v_konto_id, v_nachfolger)
      on conflict (account_id, member_id) do nothing;
    end if;
  end loop;

  -- Wochenrückblicke gehören dem Verein, nicht der Person (Autor ist nur
  -- technisch der dienstälteste Admin): umhängen statt kaskadieren. Ersatz:
  -- nächster Admin, sonst ältestes Vereinsmitglied; gibt es keins, bleibt es
  -- beim bisherigen Verhalten (author_id ist NOT NULL, NULL würde das Löschen
  -- blockieren).
  if exists (select 1 from public.feed_posts f
              where f.author_id = OLD.id and f.post_kind = 'wochenrueckblick') then
    select m.id into v_ersatz
      from public.members m
     where m.id <> OLD.id and m.approved = true and m.revoked_at is null
       and m.role in ('admin', 'member')
     order by (m.role = 'admin') desc, m.created_at
     limit 1;
    if v_ersatz is not null then
      update public.feed_posts set author_id = v_ersatz
       where author_id = OLD.id and post_kind = 'wochenrueckblick';
    end if;
  end if;

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

  -- E-Mail-Versandprotokoll: Adressen im Fehlertext (nodemailer nennt sie in
  -- der Server-Antwort) — VOR dem Ersetzen des Empfängers, der die Zeilen
  -- sonst nicht mehr erkennt. Adresse nie als Muster (Punkt, Plus …): strpos.
  update public.email_log
     set error = regexp_replace(error, '[^\s<>"''(),;:]+@[^\s<>"''(),;:]+', '<email>', 'g')
   where error ~ '@'
     and (related_member_id = OLD.id
          or sender_member_id = OLD.id
          or (v_email is not null
              and (lower(recipient) = v_email or strpos(lower(error), v_email) > 0)));

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

-- Altbestand: Adressen in Fehlertexten des E-Mail-Protokolls (die App
-- filtert sie ab jetzt beim Schreiben; der Empfänger steht in recipient).
UPDATE public.email_log
   SET error = regexp_replace(error, '[^\s<>"''(),;:]+@[^\s<>"''(),;:]+', '<email>', 'g')
 WHERE error ~ '@';


-- ─── 4) Bewertungs-Erinnerungen: nur wer beim Aufguss da war, Push einmal ──

-- War die Person bei diesem Aufguss da? Es gibt keine Besuchshistorie mit
-- Ein-/Auscheckzeiten — nur den Besuchstag (attendance_events, created_at =
-- erster Check-in des Tages), is_present und last_scan_at (letzter Wechsel).
-- Daraus: vor dem Ende erstmals eingecheckt UND
--   jetzt anwesend und seit vor dem Ende da (last_scan_at ≤ Ende) ODER
--   ausgecheckt, aber erst nach dem Beginn (last_scan_at ≥ Beginn).
-- Wer vor dem Beginn ging oder erst nach dem Ende kam, fällt heraus. (Ein
-- Kiosk-Check-in setzt last_scan_at auch bei schon Anwesenden neu — dann
-- fällt im Zweifel eine Erinnerung weg, statt dass eine zu viel kommt.)
CREATE OR REPLACE FUNCTION public._war_beim_aufguss(p_member_id uuid, p_start timestamptz, p_ende timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.members m
      JOIN public.attendance_events a
        ON a.member_id = m.id
       AND a.date = (p_start AT TIME ZONE 'Europe/Berlin')::date
     WHERE m.id = p_member_id
       AND m.approved = true
       AND m.revoked_at IS NULL
       AND a.created_at <= p_ende
       AND CASE WHEN coalesce(m.is_present, false)
                THEN coalesce(m.last_scan_at, a.created_at) <= p_ende
                ELSE coalesce(m.last_scan_at >= p_start, false)
           END
  );
$$;
REVOKE ALL ON FUNCTION public._war_beim_aufguss(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._war_beim_aufguss(uuid, timestamptz, timestamptz) TO service_role;

-- Push-Erinnerungen je Person und Aufguss genau einmal (api/push-reminder-cron
-- trägt VOR dem Senden ein). Frist: 7 Tage (datenschutz_aufraeumen).
CREATE TABLE IF NOT EXISTS public.bewertung_push_erinnerungen (
  member_id   uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  infusion_id uuid        NOT NULL REFERENCES public.infusions(id) ON DELETE CASCADE,
  gesendet_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, infusion_id)
);
COMMENT ON TABLE public.bewertung_push_erinnerungen IS
  'Welche Bewertungs-Erinnerung per Push schon verschickt wurde (je Person und Aufguss genau einmal, api/push-reminder-cron). Nur service_role. Aufbewahrung 7 Tage (datenschutz_aufraeumen). Migration 0195.';
CREATE INDEX IF NOT EXISTS bewertung_push_erinnerungen_infusion_idx
  ON public.bewertung_push_erinnerungen (infusion_id);
CREATE INDEX IF NOT EXISTS bewertung_push_erinnerungen_gesendet_idx
  ON public.bewertung_push_erinnerungen (gesendet_at);
ALTER TABLE public.bewertung_push_erinnerungen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bewertung_push_erinnerungen FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.bewertung_push_erinnerungen TO service_role;

-- Glocke (pg_cron notify_rating_window, alle 5 min). Vorlage: Live-Fassung
-- aus 0185; neu ist nur die Bedingung _war_beim_aufguss.
CREATE OR REPLACE FUNCTION public.cron_notify_rating_window_open()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_count int := 0;
begin
  insert into public.notification_queue(kind, recipient_id, payload, dedup_key)
  select distinct
    'rating_reminder',
    a.member_id,
    jsonb_build_object(
      'title', '⭐ Wie war dein Aufguss?',
      'body',  coalesce(i.title, 'Aufguss') || ' — jetzt bewerten in der App',
      'infusion_id', i.id,
      'sauna_id', i.sauna_id,
      'saunameister_id', i.saunameister_id,
      'end_time', i.end_time
    ),
    'rating:' || i.id::text || ':' || a.member_id::text
  from public.infusions i
  join public.attendance_events a
    on a.date = (i.start_time at time zone 'Europe/Berlin')::date
   and a.member_id <> i.saunameister_id
  where i.end_time between now() - interval '10 minutes' and now() - interval '2 minutes'
    and i.saunameister_id is not null
    -- Nur wer beim Aufguss da war (nicht: irgendwann an diesem Tag).
    and public._war_beim_aufguss(a.member_id, i.start_time, i.end_time)
    -- Mit-Aufgießer dürfen ihren eigenen Aufguss nicht bewerten.
    and not public.hat_mitgewedelt(i.id, a.member_id)
    and not exists (
      select 1 from public.infusion_ratings r
       where r.infusion_id = i.id and r.member_id = a.member_id
    )
    -- Dauerhaft je Aufguss und Person nur EINE Erinnerung — auch wenn die
    -- erste schon verarbeitet ist.
    and not exists (
      select 1 from public.notification_queue q
       where q.dedup_key = 'rating:' || i.id::text || ':' || a.member_id::text
    )
  on conflict do nothing;
  get diagnostics v_count = row_count;

  -- Verfall: Erinnerungen, die nichts mehr bewirken können, gelten als gelesen
  -- (sonst zeigt die Glocke dauerhaft „9+"). Fenster wie submit_rating:
  -- Aufgießer 3 Stunden nach Ende, alle anderen bis 12:00 am Folgetag.
  update public.notification_queue q
     set read_at = now()
   where q.id in (
     select q2.id
       from public.notification_queue q2
       left join public.infusions i
         on i.id = case when (q2.payload->>'infusion_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                        then (q2.payload->>'infusion_id')::uuid end
      where q2.kind = 'rating_reminder'
        and q2.read_at is null
        and (
          i.id is null
          or q2.recipient_id is null
          or exists (select 1 from public.infusion_ratings r
                      where r.infusion_id = i.id and r.member_id = q2.recipient_id)
          or public.hat_mitgewedelt(i.id, q2.recipient_id)
          or now() > case
               when public.is_aufgieser_for(q2.recipient_id)
                 then coalesce(i.end_time, i.start_time) + interval '3 hours'
               else (date_trunc('day', i.start_time at time zone 'Europe/Berlin')
                     + interval '1 day 12 hours') at time zone 'Europe/Berlin'
             end
        )
      order by q2.created_at
      limit 500
   );

  return v_count;
end$function$;
REVOKE ALL ON FUNCTION public.cron_notify_rating_window_open() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_notify_rating_window_open() TO service_role;

-- Push (api/push-reminder-cron, alle 30 min). Neu: Spalte frist (wie
-- submit_rating: Aufgießer Ende + 3 h, alle anderen 12:00 am Folgetag),
-- _war_beim_aufguss, und schon per Push erinnerte Aufgüsse fallen weg. Das
-- Auswahlfenster (Ende in den letzten 3 Stunden, jetzt anwesend) bleibt.
DROP FUNCTION IF EXISTS public.rating_pending_reminders();
CREATE FUNCTION public.rating_pending_reminders()
 RETURNS TABLE(member_id uuid, member_name text, infusion_id uuid, infusion_title text,
               end_time timestamp with time zone, meister_name text, frist timestamp with time zone)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT DISTINCT m.id, m.name, i.id, i.title, i.end_time,
    COALESCE((SELECT name FROM members WHERE id = i.saunameister_id), 'Saunameister:in') AS meister_name,
    CASE WHEN public.is_aufgieser_for(m.id)
         THEN i.end_time + interval '3 hours'
         ELSE (date_trunc('day', i.start_time AT TIME ZONE 'Europe/Berlin')
               + interval '1 day 12 hours') AT TIME ZONE 'Europe/Berlin'
    END AS frist
  FROM members m
  CROSS JOIN infusions i
  WHERE m.approved = true AND m.revoked_at IS NULL AND m.is_present = true
    AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.member_id = m.id)
    AND i.end_time < NOW()
    AND i.end_time > NOW() - INTERVAL '3 hours'
    AND i.saunameister_id IS NOT NULL
    AND i.saunameister_id <> m.id
    AND NOT public.hat_mitgewedelt(i.id, m.id)
    AND public._war_beim_aufguss(m.id, i.start_time, i.end_time)
    AND NOT EXISTS (
      SELECT 1 FROM infusion_ratings r WHERE r.member_id = m.id AND r.infusion_id = i.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM bewertung_push_erinnerungen p WHERE p.member_id = m.id AND p.infusion_id = i.id
    );
$function$;
REVOKE ALL ON FUNCTION public.rating_pending_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rating_pending_reminders() TO service_role;


-- ─── 5) Speicherfristen ────────────────────────────────────────────────────

-- IP-Bremse (kiosk_versuche, auch api_drossel_buchen): alle 10 Minuten alles
-- älter als 1 Tag. Kürzer geht nicht — api_drossel_buchen zählt Tagesfenster.
SELECT cron.schedule('kiosk-versuche-aufraeumen', '*/10 * * * *',
  $$ delete from public.kiosk_versuche where zeit < now() - interval '1 day'; $$);

COMMENT ON TABLE public.kiosk_versuche IS
  'Bremse für öffentliche Endpunkte: PIN-Fehlversuche und Tablet-Anmeldungen (0173), KI-Titel und Login-/Passwort-Mails (0189), weitere Arten laut kiosk_versuche_art_check. Schlüssel: IP, Mitglieds-ID, Geräte-Hash oder E-Mail-Hash (nie die Adresse). Nur service_role. Einträge älter als 1 Tag löscht pg_cron kiosk-versuche-aufraeumen alle 10 Minuten (0195) und jedes Schreiben.';

-- Vorlage: Live-Fassung aus 0186; neu sind die Blöcke ab „Aufguss-Teilnahmen".
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
  n_teilnahmen int;
  n_telegram_vermerke int;
  n_push_vermerke int;
  n_unbestaetigt int;
  n_drossel int;
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

  -- Aufguss-Teilnahmen (Check-in während eines Aufgusses, mit Uhrzeit):
  -- 24 Monate wie die Besuchstage. Kein Personal-Sonderfall — der
  -- Arbeitszeitnachweis (export_staff_attendance) liest attendance_events.
  -- Folge: get_member_stats_full zählt Aufguss-Besuche wie die Besuchstage
  -- nur noch aus 24 Monaten; verdiente Abzeichen bleiben.
  delete from public.infusion_attendances ia
   where (ia.scanned_at at time zone 'Europe/Berlin')::date
         < ((now() at time zone 'Europe/Berlin')::date - interval '24 months')::date;
  get diagnostics n_teilnahmen = row_count;

  -- Vermerke „an diesen Aufguss schon erinnert" (Telegram, Push): dienen nur
  -- der Entdoppelung in einem Fenster von höchstens 3 Stunden → 7 Tage.
  delete from public.telegram_rating_pushes
   where sent_at < now() - interval '7 days';
  get diagnostics n_telegram_vermerke = row_count;
  delete from public.bewertung_push_erinnerungen
   where gesendet_at < now() - interval '7 days';
  get diagnostics n_push_vermerke = row_count;

  -- Nie bestätigte Registrierungen (seit 0189 ohne Mitglieds-Zeile; Name und
  -- Herkunft stehen in user_metadata): 7 Tage nach der letzten Anfrage. Die
  -- Links laufen viel früher ab. Wer eine Mitglieds-Zeile hat (Altkonto vom
  -- 23.05.) oder anonym angemeldet ist, bleibt. greatest() übergeht NULL.
  delete from auth.users u
   where u.email_confirmed_at is null
     and u.phone_confirmed_at is null
     and coalesce(u.is_anonymous, false) = false
     and greatest(u.created_at, u.updated_at, u.confirmation_sent_at, u.recovery_sent_at,
                  u.email_change_sent_at, u.invited_at, u.last_sign_in_at)
         < now() - interval '7 days'
     and not exists (select 1 from public.members m where m.auth_user_id = u.id);
  get diagnostics n_unbestaetigt = row_count;

  -- IP-Bremse: eigentlich Job kiosk-versuche-aufraeumen (alle 10 min); hier
  -- nur als Netz, falls der Job einmal fehlt.
  delete from public.kiosk_versuche where zeit < now() - interval '1 day';
  get diagnostics n_drossel = row_count;

  return jsonb_build_object(
    'benachrichtigungen', n_benachrichtigungen,
    'protokoll', n_protokoll,
    'besuchstage', n_besuche,
    'evakuierungslisten', n_evakuierung,
    'nachtabschluss', n_nachtabschluss,
    'dateien_vorgemerkt', n_dateien,
    'aufguss_teilnahmen', n_teilnahmen,
    'telegram_erinnerungs_vermerke', n_telegram_vermerke,
    'push_erinnerungs_vermerke', n_push_vermerke,
    'unbestaetigte_anmeldungen', n_unbestaetigt,
    'drossel_eintraege', n_drossel);
end;
$function$;
REVOKE ALL ON FUNCTION public.datenschutz_aufraeumen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.datenschutz_aufraeumen() TO service_role;


-- ─── 6) Fehlerberichte: getrennte Töpfe ────────────────────────────────────
-- Vier Töpfe. „mitglied" nur für vom Vorstand freigegebene Konten ohne
-- Gast-Rolle: Ein Gast-Konto legt jeder selbst an (/gast → handle_new_user
-- setzt approved = true), ein Konto über /login ist bis zur Freigabe
-- approved = false — beide dürfen den Mitglieder-Topf nicht füllen können.
-- Sie zählen im Topf „konto" (vor anonymem Fluten geschützt, aber getrennt).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'client_fehler'
                    AND column_name = 'topf') THEN
    ALTER TABLE public.client_fehler ADD COLUMN topf text NOT NULL DEFAULT 'anon';
    -- Altbestand (nur beim ersten Lauf): Wer angemeldet war, lässt sich
    -- nachträglich nicht als Mitglied oder Gast erkennen → „konto".
    UPDATE public.client_fehler SET topf = 'konto' WHERE angemeldet;
  END IF;
END $$;
ALTER TABLE public.client_fehler DROP CONSTRAINT IF EXISTS client_fehler_topf_check;
ALTER TABLE public.client_fehler ADD CONSTRAINT client_fehler_topf_check
  CHECK (topf IN ('mitglied', 'geraet', 'konto', 'anon'));
CREATE INDEX IF NOT EXISTS client_fehler_topf_erstmals_idx ON public.client_fehler (topf, erstmals_am);
COMMENT ON COLUMN public.client_fehler.topf IS
  'Herkunft für die Grenzen: mitglied (angemeldet, vom Vorstand freigegeben, keine Gast-Rolle), geraet (gekoppeltes Kiosk-Gerät, 0177), konto (sonst angemeldet: Gäste, noch nicht freigegebene Konten), anon (alles andere). Migration 0195.';

DROP FUNCTION IF EXISTS public.client_fehler_melden(text, text, text, text, text);
CREATE OR REPLACE FUNCTION public.client_fehler_melden(
  p_quelle text,
  p_route text,
  p_meldung text,
  p_stack text DEFAULT NULL,
  p_geraet text DEFAULT NULL,
  p_geraet_token text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c_max_zeilen constant integer := 5000;
  v_quelle  text := left(coalesce(nullif(btrim(p_quelle), ''), 'unbekannt'), 60);
  v_route   text := left(coalesce(nullif(btrim(p_route), ''), '/'), 120);
  v_meldung text := left(coalesce(nullif(btrim(p_meldung), ''), '(ohne Text)'), 500);
  v_stack   text := left(nullif(btrim(p_stack), ''), 2000);
  v_geraet  text := left(nullif(btrim(p_geraet), ''), 200);
  v_fp      text;
  v_id      bigint;
  v_topf    text;
  v_grenze  integer;
  v_angemeldet boolean := auth.uid() IS NOT NULL;
  v_konto   boolean := false;
  v_freigegeben boolean := false;
BEGIN
  v_fp := md5(v_quelle || '|' || v_route || '|' || v_meldung);

  IF v_angemeldet THEN
    SELECT true, (m.approved AND m.role <> 'gast')
      INTO v_konto, v_freigegeben
      FROM public.members m
     WHERE m.auth_user_id = auth.uid() AND m.revoked_at IS NULL
     LIMIT 1;
    v_konto := coalesce(v_konto, false);
    v_freigegeben := coalesce(v_freigegeben, false);
  END IF;

  -- Topf: vom Vorstand freigegebenes Mitglied (keine Gast-Rolle), gekoppeltes
  -- Kiosk-Gerät (Tafel, Öl-Raum, Panel, Eingang, Scanner — Token wie bei den
  -- Kiosk-RPCs), sonstiges angemeldetes Konto (Gäste und noch nicht
  -- freigegebene Konten — die legt jeder selbst an), sonst anonym. Wer nur den
  -- öffentlichen Schlüssel oder ein selbst angelegtes Konto hat, füllt so nie
  -- den Topf der Mitglieder und Geräte.
  IF v_freigegeben THEN
    v_topf := 'mitglied';  v_grenze := 60;
  ELSIF p_geraet_token IS NOT NULL
     AND length(p_geraet_token) BETWEEN 32 AND 128
     AND public.kiosk_geraet_art(p_geraet_token) IS NOT NULL THEN
    v_topf := 'geraet';    v_grenze := 60;
  ELSIF v_konto THEN
    v_topf := 'konto';     v_grenze := 30;
  ELSE
    v_topf := 'anon';      v_grenze := 30;
  END IF;

  -- Gleicher Fehler in der letzten Stunde: nur mitzählen, keine neue Zeile —
  -- auch bei vollem Topf. Meldet ihn ein vertrauenswürdigerer Topf, wird die
  -- Zeile hochgestuft (dann verdrängt sie kein Müll aus niedrigeren Töpfen).
  -- Rang: mitglied/geraet 2, konto 1, anon 0.
  UPDATE public.client_fehler f
     SET anzahl = least(f.anzahl + 1, 1000000),
         zuletzt_am = now(),
         angemeldet = f.angemeldet OR v_angemeldet,
         topf = CASE
                  WHEN (CASE v_topf WHEN 'mitglied' THEN 2 WHEN 'geraet' THEN 2 WHEN 'konto' THEN 1 ELSE 0 END)
                     > (CASE f.topf WHEN 'mitglied' THEN 2 WHEN 'geraet' THEN 2 WHEN 'konto' THEN 1 ELSE 0 END)
                  THEN v_topf ELSE f.topf END
   WHERE f.id = (
     SELECT f2.id FROM public.client_fehler f2
      WHERE f2.fingerabdruck = v_fp AND f2.zuletzt_am > now() - interval '1 hour'
      ORDER BY f2.zuletzt_am DESC
      LIMIT 1)
  RETURNING f.id INTO v_id;
  IF v_id IS NOT NULL THEN
    RETURN true;
  END IF;

  -- Deckel gegen Fluten, je Topf getrennt.
  IF (SELECT count(*) FROM public.client_fehler f3
       WHERE f3.topf = v_topf
         AND f3.erstmals_am > now() - interval '1 hour') >= v_grenze THEN
    RETURN false;
  END IF;

  INSERT INTO public.client_fehler (quelle, route, meldung, stack, geraet, angemeldet, fingerabdruck, topf)
  VALUES (v_quelle, v_route, v_meldung, v_stack, v_geraet, v_angemeldet, v_fp, v_topf);

  -- Gesamtdeckel: anonyme Zeilen weichen zuerst, dann die sonstiger Konten,
  -- innerhalb eines Rangs die ältesten.
  DELETE FROM public.client_fehler f4
   WHERE f4.id IN (SELECT f5.id FROM public.client_fehler f5
                    ORDER BY (CASE f5.topf WHEN 'mitglied' THEN 2 WHEN 'geraet' THEN 2
                                           WHEN 'konto' THEN 1 ELSE 0 END) DESC,
                             f5.id DESC
                   OFFSET c_max_zeilen);

  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.client_fehler_melden(text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_fehler_melden(text, text, text, text, text, text) TO anon, authenticated, service_role;

-- Admin-Liste: Mitglieder- und Geräte-Meldungen können von anderen nicht aus
-- der Ansicht geschoben werden (bis 200 davon, bis 100 sonstiger Konten, bis
-- 100 anonyme).
CREATE OR REPLACE FUNCTION public.client_fehler_liste(p_tage integer DEFAULT 7)
 RETURNS TABLE(id bigint, erstmals_am timestamp with time zone, zuletzt_am timestamp with time zone, anzahl integer, quelle text, route text, meldung text, stack text, geraet text, angemeldet boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ab timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'nur_admin' USING ERRCODE = '42501',
      HINT = 'Diese Funktion ist nur für Admins.';
  END IF;
  v_ab := now() - make_interval(days => least(greatest(coalesce(p_tage, 7), 1), 30));
  RETURN QUERY
    SELECT x.id, x.erstmals_am, x.zuletzt_am, x.anzahl, x.quelle, x.route,
           x.meldung, x.stack, x.geraet, x.angemeldet
      FROM (
        (SELECT f.* FROM public.client_fehler f
          WHERE f.zuletzt_am > v_ab AND f.topf IN ('mitglied', 'geraet')
          ORDER BY f.zuletzt_am DESC
          LIMIT 200)
        UNION ALL
        (SELECT f.* FROM public.client_fehler f
          WHERE f.zuletzt_am > v_ab AND f.topf = 'konto'
          ORDER BY f.zuletzt_am DESC
          LIMIT 100)
        UNION ALL
        (SELECT f.* FROM public.client_fehler f
          WHERE f.zuletzt_am > v_ab AND f.topf NOT IN ('mitglied', 'geraet', 'konto')
          ORDER BY f.zuletzt_am DESC
          LIMIT 100)
      ) x
     ORDER BY x.zuletzt_am DESC;
END;
$function$;
REVOKE ALL ON FUNCTION public.client_fehler_liste(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_fehler_liste(integer) TO authenticated, service_role;


-- ─── 7) Selbstprüfung ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgrelid = 'public.email_accounts'::regclass
                    AND tgname = 'trg_email_konto_geheimnis_loeschen' AND NOT tgisinternal) THEN
    RAISE EXCEPTION '0195: Trigger trg_email_konto_geheimnis_loeschen fehlt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kiosk-versuche-aufraeumen' AND active) THEN
    RAISE EXCEPTION '0195: Job kiosk-versuche-aufraeumen fehlt';
  END IF;
  IF to_regprocedure('public.client_fehler_melden(text, text, text, text, text)') IS NOT NULL THEN
    RAISE EXCEPTION '0195: alte 5-Parameter-Fassung von client_fehler_melden besteht noch';
  END IF;
  IF NOT has_function_privilege('anon', 'public.client_fehler_melden(text, text, text, text, text, text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.client_fehler_melden(text, text, text, text, text, text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.client_fehler_liste(integer)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.rating_pending_reminders()', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.get_email_credentials(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.grant_email_account(uuid, text, text, text, integer, text, integer, text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.my_email_account()', 'EXECUTE') THEN
    RAISE EXCEPTION '0195: Rechte stimmen nicht (Aufrufer ausgesperrt)';
  END IF;
  IF has_function_privilege('anon', 'public.rating_pending_reminders()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.rating_pending_reminders()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.cron_notify_rating_window_open()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.cron_notify_rating_window_open()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.datenschutz_aufraeumen()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.datenschutz_aufraeumen()', 'EXECUTE')
     OR has_function_privilege('anon', 'public._war_beim_aufguss(uuid, timestamp with time zone, timestamp with time zone)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._war_beim_aufguss(uuid, timestamp with time zone, timestamp with time zone)', 'EXECUTE')
     OR has_function_privilege('anon', 'public._email_konto_geheimnis_loeschen()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._email_konto_geheimnis_loeschen()', 'EXECUTE')
     OR has_function_privilege('anon', 'public._mitglied_vergessen()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._mitglied_vergessen()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.client_fehler_liste(integer)', 'EXECUTE')
     OR has_table_privilege('anon', 'public.bewertung_push_erinnerungen', 'SELECT')
     OR has_table_privilege('authenticated', 'public.bewertung_push_erinnerungen', 'SELECT')
     OR has_table_privilege('authenticated', 'public.bewertung_push_erinnerungen', 'INSERT') THEN
    RAISE EXCEPTION '0195: Rechte stimmen nicht (interne Funktion/Tabelle offen)';
  END IF;
END $$;
