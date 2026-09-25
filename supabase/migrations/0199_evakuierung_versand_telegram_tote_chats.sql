-- 0199_evakuierung_versand_telegram_tote_chats.sql — Audit-Runde 3 (25.09.2026), Gruppe T1
--
-- Evakuierungs-Versand und Telegram:
--   1) Der Versand des Evakuierungsalarms konnte für immer auf 'sende' hängen
--      bleiben (Telegram-Aufruf ohne Zeitgrenze, Function nach 30 s beendet)
--      — kein Nachversand, weil jeder spätere Aufruf „schon beansprucht“ sah.
--      Jetzt:
--        * evacuation_events.telegram_status_seit (Zeitpunkt der Beanspruchung
--          bzw. des letzten Statuswechsels) und telegram_versuche;
--        * evakuierung_versand_beanspruchen(p_alarm): beansprucht mit
--          Datenbankzeit — NULL → 'sende', oder ein 'sende', das seit über
--          90 s hängt (maxDuration der Function ist 30 s, sie ist dann sicher
--          tot); ein hängender Versand wird höchstens EINMAL übernommen;
--        * pg_cron-Job 'evakuierung-nachfassen' (jede Minute): stößt für
--          laufende Alarme der letzten 15 Minuten, deren Status seit über
--          90 s auf 'sende' steht (bzw. nach 20 s noch NULL ist),
--          /api/send-evacuation erneut an — per pg_net wie der Trigger aus
--          0191 (x-cron-secret aus dem Vault).
--      Im Normalfall (Versand fertig) passiert nichts doppelt.
--      Neue Statuswerte (api/send-evacuation.ts): 'gesendet k/n' (k ≥ 1),
--      'fehlgeschlagen 0/n', 'kein_token', 'keine_chats', 'fehler' — jeweils
--      mit ' · push a/b' bzw. ' · push fehlt:<grund>'.
--   2) Tote Telegram-Chats (Bot blockiert, Telegram-Konto gelöscht, Bot aus
--      der Gruppe entfernt, Chat nicht gefunden) blieben im Verteiler; jeder
--      Rundruf und jeder Alarm meldete dauerhaft Teilausfall. Jetzt pausiert
--      der Server sie in telegram_chat_deaktiviert (Grund + Zeitpunkt) —
--      NICHT gelöscht: sie bleiben im Verteiler, bekommen aber nichts, bis ein
--      Admin sie wieder aktiviert (telegram_chat_reaktivieren) oder der Chat
--      selbst /start sendet. telegram_chats_admin_liste zeigt sie als
--      'pausiert'. unregister_telegram_chat räumt die Pause mit weg und
--      ändert den Verteiler jetzt in EINER Anweisung (vorher Lesen, dann
--      Schreiben ohne Sperre).
--   3) takeover_personal_fallback_by_telegram: gesperrte bzw. nicht
--      freigegebene Konten übernehmen nichts mehr (neuer Fehler
--      'konto_gesperrt', Helfer _mitglied_gesperrt mit derselben Regel wie
--      _konto_gesperrt() aus 0192), Zeilensperre gegen Doppelübernahme.
--      claim_telegram_link: gesperrte Konten verknüpfen nicht mehr.
--   4) set_sauna_name: jede Domain-artige Zeichenfolge (irgendwas.tld, auch
--      mit „。．｡“ statt Punkt), @Benutzernamen und unsichtbare Zeichen werden
--      abgelehnt — im Vereins-Telegram entsteht daraus kein Link. Emoji mit
--      Nullbreiten-Verbinder (🧖‍♀️, ❤️‍🔥) bleiben erlaubt; der Verbinder wird
--      nur für die Link-Prüfung entfernt. Bestehende Namen bleiben
--      unangetastet (live trifft die Regel keinen).

-- ─── 1) Evakuierungs-Versand ────────────────────────────────────────────────
ALTER TABLE public.evacuation_events
  ADD COLUMN IF NOT EXISTS telegram_status_seit timestamptz,
  ADD COLUMN IF NOT EXISTS telegram_versuche smallint NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.evacuation_events.telegram_status IS
  'Versand von Telegram-Text + Push (0191/0199): NULL, sende, gesendet k/n, fehlgeschlagen 0/n, kein_token, keine_chats, fehler — ab 0199 mit " · push a/b" bzw. " · push fehlt:<grund>".';
COMMENT ON COLUMN public.evacuation_events.telegram_status_seit IS
  'Zeitpunkt der Beanspruchung bzw. des letzten Statuswechsels (0199) — ein seit über 90 s hängendes sende wird übernommen.';
COMMENT ON COLUMN public.evacuation_events.telegram_versuche IS
  'Wie oft Text + Push beansprucht wurden (0199): 1 = erster Versand, 2 = einmalige Übernahme eines hängenden Versands.';

CREATE OR REPLACE FUNCTION public.evakuierung_versand_beanspruchen(p_alarm uuid)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_versuch integer;
BEGIN
  -- Eine Anweisung: zwei gleichzeitige Aufrufe → die Zeilensperre lässt den
  -- zweiten warten, danach sieht er 'sende' (frisch) und bekommt 0.
  UPDATE public.evacuation_events e
     SET telegram_status      = 'sende',
         telegram_status_seit = now(),
         telegram_versuche    = e.telegram_versuche + 1
   WHERE e.id = p_alarm
     AND e.ended_at IS NULL
     AND e.triggered_at > now() - interval '15 minutes'
     AND (e.telegram_status IS NULL
          OR (e.telegram_status = 'sende'
              AND coalesce(e.telegram_status_seit, e.triggered_at) < now() - interval '90 seconds'
              AND e.telegram_versuche < 2))
  RETURNING e.telegram_versuche INTO v_versuch;
  RETURN coalesce(v_versuch, 0);
END;
$fn$;
COMMENT ON FUNCTION public.evakuierung_versand_beanspruchen(uuid) IS
  'Nur /api/send-evacuation (0199): Versand von Text + Push beanspruchen. Ergebnis 1 = erster Versand, 2 = Übernahme eines hängenden, 0 = nicht beansprucht.';
REVOKE ALL ON FUNCTION public.evakuierung_versand_beanspruchen(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evakuierung_versand_beanspruchen(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._evakuierung_nachfassen()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  r   record;
  v_n integer := 0;
BEGIN
  FOR r IN
    SELECT e.id
      FROM public.evacuation_events e
     WHERE e.ended_at IS NULL
       AND e.triggered_at > now() - interval '15 minutes'
       AND ((e.telegram_status IS NULL AND e.triggered_at < now() - interval '20 seconds')
            OR (e.telegram_status = 'sende'
                AND coalesce(e.telegram_status_seit, e.triggered_at) < now() - interval '90 seconds'
                AND e.telegram_versuche < 2))
  LOOP
    -- Wie der Trigger aus 0191: pg_net schickt erst nach dem COMMIT, jeder
    -- Fehler wird nur protokolliert.
    BEGIN
      PERFORM net.http_post(
        url := 'https://app.sauna-fds.de/api/send-evacuation',
        body := jsonb_build_object('alarm_id', r.id),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', coalesce(
            (SELECT d.decrypted_secret FROM vault.decrypted_secrets d WHERE d.name = 'cron_secret' LIMIT 1),
            ''
          )
        ),
        timeout_milliseconds := 30000
      );
      v_n := v_n + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '0199: Evakuierungs-Versand nicht erneut angestoßen (%): %', SQLSTATE, SQLERRM;
    END;
  END LOOP;
  RETURN v_n;
END;
$fn$;
COMMENT ON FUNCTION public._evakuierung_nachfassen() IS
  'pg_cron evakuierung-nachfassen (0199): hängenden bzw. nie begonnenen Versand laufender Alarme erneut anstoßen.';
REVOKE ALL ON FUNCTION public._evakuierung_nachfassen() FROM PUBLIC, anon, authenticated;

-- cron.schedule mit gleichem Namen ersetzt den Job (wiederholbar).
SELECT cron.schedule('evakuierung-nachfassen', '* * * * *', $job$ select public._evakuierung_nachfassen(); $job$);

-- ─── 2) Tote Telegram-Chats pausieren ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.telegram_chat_deaktiviert (
  chat_id        bigint PRIMARY KEY,
  grund          text NOT NULL
    CONSTRAINT telegram_chat_deaktiviert_grund_check
    CHECK (grund IN ('blockiert', 'konto_geloescht', 'entfernt', 'nicht_gefunden', 'nicht_gestartet')),
  fehler_code    integer,
  beschreibung   text CONSTRAINT telegram_chat_deaktiviert_beschreibung_check CHECK (char_length(beschreibung) <= 200),
  deaktiviert_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.telegram_chat_deaktiviert IS
  'Nicht erreichbare Telegram-Chats (0199): vom Server beim Versand erkannt (Bot blockiert, Konto gelöscht, Bot entfernt, Chat nicht gefunden). Bleiben im Verteiler, bekommen aber nichts, bis ein Admin sie reaktiviert oder der Chat /start sendet.';
ALTER TABLE public.telegram_chat_deaktiviert ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.telegram_chat_deaktiviert FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.telegram_chat_deaktiviert TO service_role;

CREATE OR REPLACE FUNCTION public.telegram_chat_reaktivieren(p_chat_id bigint)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;
  DELETE FROM public.telegram_chat_deaktiviert WHERE chat_id = p_chat_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.telegram_chat_reaktivieren(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.telegram_chat_reaktivieren(bigint) TO authenticated, service_role;

-- Vorlage: Live-Fassung (0187). Neu: Pause mit entfernen; Verteiler in einer
-- Anweisung ändern (vorher SELECT, dann UPDATE ohne Sperre — eine
-- gleichzeitige Freigabe konnte verloren gehen). #>> statt ::text::bigint,
-- damit auch als Text gespeicherte IDs nicht zum Abbruch führen.
CREATE OR REPLACE FUNCTION public.unregister_telegram_chat(p_chat_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- NULL-sicher: „x <> NULL“ ist nie wahr — ohne diese Zeile würde ein
  -- Aufruf mit NULL den GANZEN Verteiler leeren.
  if p_chat_id is null then return; end if;
  delete from public.telegram_chat_anfragen where chat_id = p_chat_id and abgelehnt_at is null;
  delete from public.telegram_chat_deaktiviert where chat_id = p_chat_id;
  update public.system_config s
     set value = jsonb_set(s.value, '{chat_ids}', (
           select coalesce(jsonb_agg(x), '[]'::jsonb)
             from jsonb_array_elements(coalesce(s.value->'chat_ids', '[]'::jsonb)) x
            where (x #>> '{}') is distinct from p_chat_id::text))
   where s.key = 'telegram_chats';
end;
$function$;
REVOKE ALL ON FUNCTION public.unregister_telegram_chat(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_telegram_chat(bigint) TO service_role;

-- Neue Spalten im Ergebnis → Rückgabetyp ändert sich → DROP + CREATE
-- (Rechte danach neu setzen). Vorlage: Live-Fassung (0187).
DROP FUNCTION IF EXISTS public.telegram_chats_admin_liste();
CREATE OR REPLACE FUNCTION public.telegram_chats_admin_liste()
 RETURNS TABLE(chat_id bigint, status text, vorname text, benutzername text, chat_typ text,
               angefragt_at timestamp with time zone, mitglied_name text, mitglied_gesperrt boolean,
               deaktiviert_at timestamp with time zone, deaktiviert_grund text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
  with aktiv as (
    select (c #>> '{}')::bigint as cid
      from public.system_config s,
           jsonb_array_elements(coalesce(s.value->'chat_ids', '[]'::jsonb)) c
     where s.key = 'telegram_chats' and jsonb_typeof(c) = 'number'
  ), alle as (
    select a.cid, 'aktiv'::text as st from aktiv a
    union all
    select t.chat_id, case when t.abgelehnt_at is null then 'wartet' else 'abgelehnt' end
      from public.telegram_chat_anfragen t
     where not exists (select 1 from aktiv a where a.cid = t.chat_id)
  )
  select x.cid,
         -- Im Verteiler, aber als nicht erreichbar pausiert (0199).
         case when x.st = 'aktiv' and d.chat_id is not null then 'pausiert' else x.st end,
         t.vorname, t.benutzername, t.chat_typ, t.angefragt_at,
         mm.name, (mm.revoked_at is not null),
         d.deaktiviert_at, d.grund
    from alle x
    left join public.telegram_chat_anfragen t on t.chat_id = x.cid
    left join public.telegram_chat_deaktiviert d on d.chat_id = x.cid
    left join lateral (
      select m.name, m.revoked_at from public.members m
       where m.telegram_user_id = coalesce(t.telegram_user_id, x.cid)
       limit 1
    ) mm on true
   order by case x.st when 'wartet' then 0 when 'aktiv' then 1 else 2 end,
            t.angefragt_at desc nulls last, x.cid;
end;
$function$;
REVOKE ALL ON FUNCTION public.telegram_chats_admin_liste() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.telegram_chats_admin_liste() TO authenticated, service_role;

-- ─── 3) Telegram-Übernahme und -Verknüpfung nur für freie Konten ────────────
-- Gleiche Regel wie _konto_gesperrt() (0192), aber für ein bestimmtes Konto
-- statt auth.uid() — der Webhook läuft als service_role ohne Anmeldung.
CREATE OR REPLACE FUNCTION public._mitglied_gesperrt(p_member_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT coalesce((
    SELECT NOT (coalesce(m.approved, false) AND m.revoked_at IS NULL)
      FROM public.members m
     WHERE m.id = p_member_id
  ), true);
$fn$;
COMMENT ON FUNCTION public._mitglied_gesperrt(uuid) IS
  'true, wenn das Konto gesperrt oder nicht freigegeben ist (bzw. nicht existiert) — wie _konto_gesperrt() (0192), aber je Konto (0199).';
REVOKE ALL ON FUNCTION public._mitglied_gesperrt(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._mitglied_gesperrt(uuid) TO service_role;

-- Vorlage: Live-Fassung (0038).
CREATE OR REPLACE FUNCTION public.takeover_personal_fallback_by_telegram(p_telegram_user_id bigint, p_infusion_id uuid)
 RETURNS TABLE(member_id uuid, member_name text, infusion_title text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_member public.members%rowtype;
  v_inf    public.infusions%rowtype;
  v_allowed boolean;
begin
  select * into v_member from public.members where telegram_user_id = p_telegram_user_id;
  if not found then raise exception 'telegram_not_linked'; end if;
  -- 0199: gesperrte bzw. nicht freigegebene Konten übernehmen nichts (die
  -- Schreibsperre aus 0192 hängt an auth.uid() und greift hier nicht).
  if public._mitglied_gesperrt(v_member.id) then raise exception 'konto_gesperrt'; end if;
  v_allowed := coalesce(v_member.is_aufgieser, false) or v_member.role in ('guest_aufgieser','staff','admin');
  if not v_allowed then raise exception 'not_authorized'; end if;

  -- 0199: Zeilensperre — zwei gleichzeitige Übernahmen (zwei Knöpfe, oder
  -- Telegram und App) laufen nacheinander; die zweite sieht den neuen Stand.
  select * into v_inf from public.infusions where id = p_infusion_id for update;
  if not found then raise exception 'infusion_not_found'; end if;
  if not v_inf.is_personal_fallback then raise exception 'already_taken'; end if;
  if v_inf.end_time <= now() then raise exception 'slot_in_past'; end if;

  update public.infusions
     set saunameister_id      = v_member.id,
         is_personal_fallback = false,
         title                = 'Übernahme von ' || v_member.name
   where id = p_infusion_id
     and is_personal_fallback;
  if not found then raise exception 'already_taken'; end if;

  return query select v_member.id, v_member.name, v_inf.title;
end;
$function$;
REVOKE ALL ON FUNCTION public.takeover_personal_fallback_by_telegram(bigint, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.takeover_personal_fallback_by_telegram(bigint, uuid) TO service_role;

-- Vorlage: Live-Fassung. Neu: gesperrte Konten verknüpfen nicht (eigener
-- Fehler statt „Token ungültig“). Nicht freigegebene Neumitglieder dürfen
-- weiter verknüpfen (das Token erzeugen sie schon vor der Freigabe).
CREATE OR REPLACE FUNCTION public.claim_telegram_link(p_token uuid, p_telegram_user_id bigint)
 RETURNS TABLE(member_id uuid, name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_member_id uuid;
begin
  update public.members
     set telegram_user_id    = p_telegram_user_id,
         telegram_link_token = null
   where telegram_link_token = p_token
     and revoked_at is null
   returning id into v_member_id;
  if not found then
    if exists (select 1 from public.members m where m.telegram_link_token = p_token) then
      raise exception 'konto_gesperrt';
    end if;
    raise exception 'invalid_or_expired_token';
  end if;
  return query select m.id, m.name from public.members m where m.id = v_member_id;
end;
$function$;
REVOKE ALL ON FUNCTION public.claim_telegram_link(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_telegram_link(uuid, bigint) TO service_role;

-- ─── 4) Aufguss-Name ohne Links ────────────────────────────────────────────
-- Vorlage: Live-Fassung (0194). Statt einer Liste von Endungen jede Form
-- „etwas.Buchstaben“ — Telegram kennt alle Endungen (.co, .es, .store …).
-- Abkürzungen mit Leerzeichen („Dr. Hitze“) bleiben erlaubt.
CREATE OR REPLACE FUNCTION public.set_sauna_name(p_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_name  text := nullif(trim(p_name), '');
  v_pruef text;
begin
  if v_name is not null then
    if char_length(v_name) > 40 then
      raise exception 'Der Aufguss-Name darf höchstens 40 Zeichen haben.' using errcode = '22023';
    end if;
    if v_name ~ '[[:cntrl:]]' then
      raise exception 'Der Aufguss-Name darf keine Zeilenumbrüche oder Steuerzeichen enthalten.' using errcode = '22023';
    end if;
    -- Unsichtbare Zeichen (weiches Trennzeichen, Grapheme-Joiner, mongolischer
    -- Vokaltrenner, Nullbreite, Richtungswechsel/-isolate, BOM) — damit ließe
    -- sich jede Prüfung unten umgehen. Ausgenommen ist der Nullbreiten-
    -- Verbinder U+200D: er setzt Emoji wie 🧖‍♀️ oder ❤️‍🔥 zusammen. Für die
    -- Link-Prüfung unten werden er und die Emoji-Varianten-Selektoren
    -- (U+FE00–FE0F) entfernt, damit „sauna‍.de“ trotzdem auffällt.
    if v_name ~ ('[' || chr(173) || chr(847) || chr(6158) || chr(8203) || chr(8204) || chr(8206) || chr(8207)
                 || chr(8234) || '-' || chr(8238) || chr(8288) || '-' || chr(8303) || chr(65279) || ']') then
      raise exception 'Der Aufguss-Name darf keine unsichtbaren Zeichen enthalten.' using errcode = '22023';
    end if;
    v_pruef := regexp_replace(v_name, '[' || chr(8205) || chr(65024) || '-' || chr(65039) || ']', '', 'g');
    -- Der Name geht per Telegram an alle Vereins-Chats; Adressen würden dort
    -- zu anklickbaren Links, @Namen zu Verweisen auf fremde Konten.
    if v_pruef ~* '(://|www[.]|t[.]me/)'
       or v_pruef ~* ('[[:alnum:]_-][.' || chr(12290) || chr(65294) || chr(65377) || '][[:alpha:]]{2,}([^[:alpha:]]|$)')
       or v_pruef ~ '@[[:alnum:]_]{5,}' then
      raise exception 'Bitte keine Internet-Adressen oder @Namen im Aufguss-Namen. Abkürzungen bitte mit Leerzeichen schreiben (z. B. „Dr. Hitze“).' using errcode = '22023';
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

-- ─── 5) Selbstprüfung ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.evakuierung_versand_beanspruchen(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.evakuierung_versand_beanspruchen(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public._evakuierung_nachfassen()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._evakuierung_nachfassen()', 'EXECUTE')
     OR has_function_privilege('anon', 'public._mitglied_gesperrt(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._mitglied_gesperrt(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.takeover_personal_fallback_by_telegram(bigint,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.takeover_personal_fallback_by_telegram(bigint,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.claim_telegram_link(uuid,bigint)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.claim_telegram_link(uuid,bigint)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.unregister_telegram_chat(bigint)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.telegram_chats_admin_liste()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.telegram_chat_reaktivieren(bigint)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.set_sauna_name(text)', 'EXECUTE')
     OR has_table_privilege('anon', 'public.telegram_chat_deaktiviert', 'SELECT')
     OR has_table_privilege('authenticated', 'public.telegram_chat_deaktiviert', 'SELECT') THEN
    RAISE EXCEPTION '0199-Selbstprüfung: interne Funktion/Tabelle für anon bzw. authenticated zugänglich';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.telegram_chats_admin_liste()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.telegram_chat_reaktivieren(bigint)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.set_sauna_name(text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.evakuierung_versand_beanspruchen(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.takeover_personal_fallback_by_telegram(bigint,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '0199-Selbstprüfung: benötigtes EXECUTE-Recht fehlt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'evakuierung-nachfassen' AND schedule = '* * * * *') THEN
    RAISE EXCEPTION '0199-Selbstprüfung: Cron-Job evakuierung-nachfassen fehlt';
  END IF;
END $$;
