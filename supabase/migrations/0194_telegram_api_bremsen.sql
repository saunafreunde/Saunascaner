-- 0194_telegram_api_bremsen.sql — Telegram-Bot und öffentliche API-Bremsen
-- (Audit-Runde 2, 25.09.2026, Gruppe R4_telegram_api)
--
-- 1) telegram_announce_attendance (Knopf „🙋 Ich komme“ unter /heute und
--    /morgen) scheiterte bei JEDEM Aufruf mit 42702 „column reference
--    start_time is ambiguous“: Die OUT-Spalten aus RETURNS TABLE (member_id,
--    member_name, infusion_title, start_time) kollidierten mit den
--    unqualifizierten Spalten im Rumpf und im ON CONFLICT (infusion_id,
--    member_id). Es wurde nie eine Ankündigung gespeichert. Jetzt mit
--    `#variable_conflict use_column` und Tabellen-Aliassen (Aliasse allein
--    reichen nicht, ON CONFLICT bliebe mehrdeutig) — dieselbe Fehlerklasse
--    wie bei telegram_quick_rate in 0179. Weil der Weg damit wieder offen
--    ist, zählen nur freigegebene, nicht gesperrte Konten (approved,
--    revoked_at IS NULL — wie die Schreibsperre der App aus 0192).
--    Rechte weiterhin nur für service_role (api/telegram-webhook.ts).
--
-- 2) Drossel-Tabelle kiosk_versuche: neue Art 'tg_meldung' für
--    /api/send-notification (Vereins-Meldungen „neues Abzeichen“ und „neuer
--    Aufguss-Name“ an alle Telegram-Chats). Vorher konnte jedes Mitglied
--    dieselbe Meldung beliebig oft in alle Chats schicken (set_sauna_name
--    erneuert den Zeitstempel bei jedem Aufruf). Der CHECK wird ERGÄNZT, nicht
--    neu aufgezählt: vorhandene Arten (auch solche aus parallel entstandenen
--    Migrationen) bleiben erhalten.
--
-- 3) set_sauna_name: höchstens 40 Zeichen (wie das Eingabefeld), keine
--    Steuerzeichen/Zeilenumbrüche, keine Internet-Adressen. Der Aufguss-Name
--    geht per Bot an alle Vereins-Chats, und Telegram macht Adressen dort zu
--    anklickbaren Links (Phishing über den offiziellen Vereins-Bot).
--    Bestehende Namen bleiben unverändert (live: 16 Namen, alle ≤ 15 Zeichen,
--    keiner mit Adresse). Keine Sperrfrist (die wurde in 0090 bewusst entfernt).
--
-- 4) api_mail_konto_status (neu, nur service_role): ob es zu einer Adresse ein
--    Konto gibt und ob es bestätigt ist — ohne Nebenwirkung. /api/email
--    „Passwort vergessen“ rief vorher für JEDE Adresse generateLink auf und
--    buchte den gemeinsamen Mail-Topf ('alle', 60/h) auch für
--    Fantasie-Adressen, an die gar keine Mail ging: 60 Anfragen sperrten
--    „Passwort vergessen“ und die QR-Gast-Anmeldung für alle eine Stunde lang.
--    Jetzt bucht die API den gemeinsamen und den Adress-Topf nur, wenn
--    wirklich eine Mail rausgeht; der gemeinsame Topf greift bei 60/h nur
--    noch für IPs mit vielen Anfragen, für alle anderen erst als Notbremse
--    bei 300/h (api/email.ts).
--
-- Reihenfolge: VOR dem Deploy einspielen (rein additiv). Ohne diese Migration
-- lehnt /api/send-notification Meldungen ab (Drossel-Art fehlt → sperrt), und
-- „Passwort vergessen“ fällt auf das bisherige Verhalten zurück.
-- ---------------------------------------------------------------------

-- ─── 1) telegram_announce_attendance ────────────────────────────────────
-- Vorlage: Live-Fassung vom 25.09.2026 (pg_get_functiondef, Stand 0053).
CREATE OR REPLACE FUNCTION public.telegram_announce_attendance(p_telegram_user_id bigint, p_infusion_id uuid)
 RETURNS TABLE(member_id uuid, member_name text, infusion_title text, start_time timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
declare v_me uuid; v_name text; v_start timestamptz; v_title text;
begin
  -- Nur verknüpfte, freigegebene und nicht gesperrte Konten (wie
  -- telegram_quick_rate in 0179; in der App sperrt 0192 dieselben Konten
  -- für neue Ankündigungen).
  select m.id, m.name into v_me, v_name
    from public.members m
   where m.telegram_user_id = p_telegram_user_id
     and m.revoked_at is null
     and m.approved
   limit 1;
  if v_me is null then raise exception 'telegram_not_linked'; end if;

  select i.start_time, i.title into v_start, v_title
    from public.infusions i
   where i.id = p_infusion_id;
  if v_start is null then raise exception 'infusion_not_found'; end if;
  if v_start <= now() then raise exception 'infusion_already_started'; end if;

  insert into public.infusion_announcements (infusion_id, member_id)
    values (p_infusion_id, v_me)
    on conflict (infusion_id, member_id) do update set announced_at = now();
  return query select v_me, v_name, v_title, v_start;
end$function$;

REVOKE ALL ON FUNCTION public.telegram_announce_attendance(bigint, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_announce_attendance(bigint, uuid) TO service_role;

-- ─── 2) Drossel-Art 'tg_meldung' ergänzen ───────────────────────────────
DO $do$
DECLARE
  v_def   text;
  v_arten text[];
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO v_def
    FROM pg_constraint c
   WHERE c.conrelid = 'public.kiosk_versuche'::regclass
     AND c.conname = 'kiosk_versuche_art_check';

  -- Vorhandene Arten aus der aktuellen Regel lesen und nur ergänzen. Die
  -- Regel kann als ARRAY['a'::text, …] oder als '{a,b}'::text[] vorliegen —
  -- beide Schreibweisen werden gelesen.
  SELECT ARRAY(
    SELECT DISTINCT a FROM (
      SELECT (regexp_matches(coalesce(v_def, ''), '''([a-z0-9_]+)''', 'g'))[1] AS a
      UNION ALL
      SELECT unnest(string_to_array((regexp_match(coalesce(v_def, ''), '''\{([a-z0-9_,]*)\}'''))[1], ','))
      UNION ALL
      SELECT unnest(ARRAY['pin_fehl', 'signup', 'signup_mail', 'ki_titel', 'mail', 'tg_meldung'])
    ) x
    WHERE a <> ''
    ORDER BY a
  ) INTO v_arten;

  ALTER TABLE public.kiosk_versuche DROP CONSTRAINT IF EXISTS kiosk_versuche_art_check;
  -- Als IN-Liste anlegen (ergibt wieder die Schreibweise ARRAY['a'::text, …]).
  EXECUTE 'ALTER TABLE public.kiosk_versuche ADD CONSTRAINT kiosk_versuche_art_check CHECK (art IN ('
    || (SELECT string_agg(quote_literal(a), ', ' ORDER BY a) FROM unnest(v_arten) AS a)
    || '))';
END
$do$;

-- ─── 3) set_sauna_name härten ───────────────────────────────────────────
-- Vorlage: Live-Fassung vom 25.09.2026 (pg_get_functiondef). Neu sind nur
-- die Prüfungen vor dem UPDATE.
CREATE OR REPLACE FUNCTION public.set_sauna_name(p_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_name text := nullif(trim(p_name), '');
begin
  if v_name is not null then
    if char_length(v_name) > 40 then
      raise exception 'Der Aufguss-Name darf höchstens 40 Zeichen haben.' using errcode = '22023';
    end if;
    if v_name ~ '[[:cntrl:]]' then
      raise exception 'Der Aufguss-Name darf keine Zeilenumbrüche oder Steuerzeichen enthalten.' using errcode = '22023';
    end if;
    -- Der Name geht per Telegram an alle Vereins-Chats; Adressen würden dort
    -- zu anklickbaren Links.
    if v_name ~* '(://|www\.|t\.me/)'
       or v_name ~* '[[:alnum:]-]\.(de|com|net|org|info|io|me|ru|xyz|app|link|ly|to|eu|at|ch|biz|online|site|shop|top|cc|tk|click|gg|tv)([^[:alpha:]]|$)' then
      raise exception 'Bitte keine Internet-Adressen im Aufguss-Namen.' using errcode = '22023';
    end if;
  end if;

  update public.members
     set sauna_name = v_name,
         sauna_name_changed_at = now()
   where auth_user_id = auth.uid();
end;
$function$;

REVOKE ALL ON FUNCTION public.set_sauna_name(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_sauna_name(text) TO authenticated, service_role;

-- ─── 4) api_mail_konto_status ───────────────────────────────────────────
-- 'bestaetigt' | 'unbestaetigt' | 'unbekannt'. Nur lesen, keine Nebenwirkung
-- (anders als generateLink, das bei jedem Aufruf ein neues Token anlegt und
-- damit den zuletzt verschickten Link entwertet).
CREATE OR REPLACE FUNCTION public.api_mail_konto_status(p_email text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT coalesce(
    (SELECT CASE WHEN u.email_confirmed_at IS NOT NULL THEN 'bestaetigt' ELSE 'unbestaetigt' END
       FROM auth.users u
      WHERE lower(u.email) = lower(trim(p_email))
        AND u.deleted_at IS NULL
      ORDER BY u.email_confirmed_at IS NULL, u.created_at
      LIMIT 1),
    'unbekannt'
  );
$fn$;

REVOKE ALL ON FUNCTION public.api_mail_konto_status(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_mail_konto_status(text) TO service_role;

COMMENT ON FUNCTION public.api_mail_konto_status(text) IS
  'Mail-Bremse (0194): Konto zu einer Adresse bestätigt/unbestätigt/unbekannt — ohne Nebenwirkung. Nur service_role (api/email.ts).';
