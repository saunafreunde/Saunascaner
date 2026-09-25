-- 0207_evakuierung_beenden_telegram_nachversand.sql — Audit-Runde 4 (25.09.2026), Gruppe U1_evak_ende_telegram
--
-- Evakuierungsalarm: wer beenden darf, und Telegram-Nachversand.
--
--   1) Alarm BEENDEN nur noch durch angemeldete Vereinsmitglieder (wie
--      bisher: admin/staff/member/guest_aufgieser, freigegeben, nicht
--      gesperrt) und durch gekoppelte Geräte der Art 'oelraum' oder 'panel'.
--      Vorher genügte JEDES gekoppelte Gerät (_evakuierung_berechtigt prüfte
--      nur kiosk_geraet_art(...) IS NOT NULL). Seit das Eingangs-Tablet über
--      /willkommen gekoppelt wird (live seit 25.09.), konnte ein Gast dort
--      mit „✓ Alarm beenden“ den Alarm auf allen Geräten stoppen — Sirene,
--      Vollbild, Anwesenheitsliste und Nachfass-Job inklusive.
--      'eingang', 'scanner' und 'tafel' (dort stehen Gäste) dürfen nicht mehr
--      beenden. AUSLÖSEN bleibt unverändert (evakuierung_ausloesen prüft
--      selbst, jedes gekoppelte Gerät darf auslösen).
--      NULL-sicher: kiosk_geraet_art() liefert für fehlende, ungültige und
--      widerrufene Token NULL — daraus wird hier ausdrücklich false.
--      evakuierung_beenden wertet das Ergebnis zusätzlich mit coalesce aus
--      (ein NULL hätte „IF NOT …“ still durchgelassen).
--
--   2) Nur-Telegram-Nachversand: Seit den Zeitgrenzen aus 0199 endet eine
--      Telegram-Störung beim Alarm nicht mehr in einem hängenden 'sende',
--      sondern nach wenigen Sekunden im Endstatus 'fehlgeschlagen 0/n · push …'
--      bzw. 'fehler · push …' — und danach wurde nie nachgesendet, obwohl das
--      Handbuch es versprach. Jetzt:
--        * evacuation_events.telegram_nachversuche (neu, Standard 0);
--        * evakuierung_telegram_nachversand_beanspruchen(p_alarm) (neu, nur
--          service_role): beansprucht einen laufenden Alarm der letzten
--          15 Minuten, bei dem Telegram an KEINEN Chat zugestellt wurde
--          ('fehlgeschlagen 0/…' oder 'fehler · …'), frühestens 60 s nach dem
--          letzten Statuswechsel, höchstens 2× je Alarm. Der Status wird
--          'nachsende · <alter Push-Teil>' — der Push-Teil bleibt erhalten,
--          Push wird NICHT erneut verschickt (api/send-evacuation.ts sendet in
--          diesem Fall nur Telegram). Ein hängendes 'nachsende' (Function
--          tot) wird nach 90 s ebenfalls nur per Telegram übernommen, solange
--          Nachversuche übrig sind — nie über den 'sende'-Weg, der den Push
--          wiederholen würde.
--        * _evakuierung_nachfassen (Vorlage: Live-Fassung 0199) stößt den
--          Endpunkt zusätzlich für genau diese Alarme an.
--      Teilausfälle ('gesendet k/n', k ≥ 1), 'keine_chats' und 'kein_token'
--      werden bewusst NICHT nachgesendet. Im Normalfall (Versand angekommen)
--      passiert nichts doppelt. evakuierung_versand_beanspruchen bleibt
--      unverändert (sie kennt nur NULL und genau 'sende').
--
-- Wiederholbar: ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE, cron.schedule
-- mit gleichem Namen ersetzt den Job.

-- ─── 1) Beenden nur durch Mitglieder, Öl-Raum-Tablet und Panel ─────────────
-- Einziger Aufrufer: evakuierung_beenden (p_uebergang = false). Der Zweig
-- p_uebergang = true beschreibt die Auslöse-Regel aus 0191 und hat derzeit
-- keinen Aufrufer (evakuierung_ausloesen prüft selbst).
CREATE OR REPLACE FUNCTION public._evakuierung_berechtigt(p_geraet text, p_uebergang boolean)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_art text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.auth_user_id = auth.uid() AND m.approved AND m.revoked_at IS NULL
      AND m.role IN ('admin', 'staff', 'member', 'guest_aufgieser')
  ) THEN
    RETURN true;
  END IF;
  -- NULL bei fehlendem, ungültigem oder widerrufenem Token.
  v_art := public.kiosk_geraet_art(p_geraet);
  IF coalesce(p_uebergang, false) THEN
    -- Auslöse-Regel: jedes gekoppelte Gerät, sonst nur im Übergang.
    IF v_art IS NOT NULL THEN
      RETURN true;
    END IF;
    RETURN coalesce(public.evakuierung_uebergang_offen(), false);
  END IF;
  -- Beenden (0207): nur Geräte, an denen Vereinsleute stehen — nicht
  -- Eingangs-Tablet, Scanner oder TV-Tafel (Gäste-Bereich).
  RETURN coalesce(v_art IN ('oelraum', 'panel'), false);
END;
$fn$;
COMMENT ON FUNCTION public._evakuierung_berechtigt(text, boolean) IS
  'Intern (0191/0207): p_uebergang=false = darf Alarm beenden (Mitglied nicht Gast/Fan, oder gekoppeltes Öl-Raum-Tablet/Panel); true = Auslöse-Regel (jedes gekoppelte Gerät bzw. Übergang).';
REVOKE ALL ON FUNCTION public._evakuierung_berechtigt(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._evakuierung_berechtigt(text, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.evakuierung_beenden(p_id uuid, p_geraet text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  -- coalesce: ein NULL der Prüfung darf nie als „berechtigt“ durchgehen.
  IF NOT coalesce(public._evakuierung_berechtigt(p_geraet, false), false) THEN
    RAISE EXCEPTION 'nicht_berechtigt' USING ERRCODE = '42501';
  END IF;
  UPDATE public.evacuation_events SET ended_at = now() WHERE id = p_id AND ended_at IS NULL;
END;
$fn$;
-- Rechte wie live (0191): anon braucht es für gekoppelte Geräte ohne Login.
REVOKE ALL ON FUNCTION public.evakuierung_beenden(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evakuierung_beenden(uuid, text) TO anon, authenticated, service_role;

-- ─── 2) Nur-Telegram-Nachversand ───────────────────────────────────────────
ALTER TABLE public.evacuation_events
  ADD COLUMN IF NOT EXISTS telegram_nachversuche smallint NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.evacuation_events.telegram_nachversuche IS
  'Wie oft Telegram allein nachgesendet wurde (0207): nur wenn zuvor KEIN Chat erreicht wurde (fehlgeschlagen 0/n bzw. fehler), höchstens 2× je Alarm. Push wird dabei nicht wiederholt.';
COMMENT ON COLUMN public.evacuation_events.telegram_status IS
  'Versand von Telegram-Text + Push (0191/0199/0207): NULL, sende, nachsende (nur Telegram, 0207), gesendet k/n, fehlgeschlagen 0/n, kein_token, keine_chats, fehler — ab 0199 mit " · push a/b" bzw. " · push fehlt:<grund>".';

CREATE OR REPLACE FUNCTION public.evakuierung_telegram_nachversand_beanspruchen(p_alarm uuid)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_nr integer;
BEGIN
  -- Eine Anweisung (wie evakuierung_versand_beanspruchen): ein zweiter
  -- gleichzeitiger Aufruf wartet auf die Zeilensperre, sieht danach ein
  -- frisches 'nachsende' und bekommt 0.
  -- Dieselbe Bedingung steht in _evakuierung_nachfassen (unten).
  UPDATE public.evacuation_events e
     SET telegram_status       = 'nachsende'
                                 || coalesce(' · ' || substring(e.telegram_status FROM ' · (.*)$'), ''),
         telegram_status_seit  = now(),
         telegram_nachversuche = e.telegram_nachversuche + 1
   WHERE e.id = p_alarm
     AND e.ended_at IS NULL
     AND e.triggered_at > now() - interval '15 minutes'
     AND e.telegram_nachversuche < 2
     AND (((e.telegram_status LIKE 'fehlgeschlagen 0/%' OR e.telegram_status LIKE 'fehler · %')
           AND coalesce(e.telegram_status_seit, e.triggered_at) < now() - interval '60 seconds')
          OR (e.telegram_status LIKE 'nachsende%'
              AND coalesce(e.telegram_status_seit, e.triggered_at) < now() - interval '90 seconds'))
  RETURNING e.telegram_nachversuche INTO v_nr;
  RETURN coalesce(v_nr, 0);
END;
$fn$;
COMMENT ON FUNCTION public.evakuierung_telegram_nachversand_beanspruchen(uuid) IS
  'Nur /api/send-evacuation (0207): Nur-Telegram-Nachversand beanspruchen, wenn zuvor kein Chat erreicht wurde. Ergebnis = Nummer des Nachversuchs (1–2), 0 = nicht beansprucht.';
REVOKE ALL ON FUNCTION public.evakuierung_telegram_nachversand_beanspruchen(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evakuierung_telegram_nachversand_beanspruchen(uuid) TO service_role;

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
                AND e.telegram_versuche < 2)
            -- 0207: Nur-Telegram-Nachversand — dieselbe Bedingung wie in
            -- evakuierung_telegram_nachversand_beanspruchen.
            OR (e.telegram_nachversuche < 2
                AND (((e.telegram_status LIKE 'fehlgeschlagen 0/%' OR e.telegram_status LIKE 'fehler · %')
                      AND coalesce(e.telegram_status_seit, e.triggered_at) < now() - interval '60 seconds')
                     OR (e.telegram_status LIKE 'nachsende%'
                         AND coalesce(e.telegram_status_seit, e.triggered_at) < now() - interval '90 seconds'))))
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
  'pg_cron evakuierung-nachfassen (0199/0207): hängenden bzw. nie begonnenen Versand laufender Alarme erneut anstoßen; seit 0207 auch den Nur-Telegram-Nachversand, wenn kein Chat erreicht wurde.';
REVOKE ALL ON FUNCTION public._evakuierung_nachfassen() FROM PUBLIC, anon, authenticated;

-- cron.schedule mit gleichem Namen ersetzt den Job (wiederholbar, unverändert).
SELECT cron.schedule('evakuierung-nachfassen', '* * * * *', $job$ select public._evakuierung_nachfassen(); $job$);

-- ─── 3) Selbstprüfung ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF has_function_privilege('anon', 'public._evakuierung_berechtigt(text,boolean)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._evakuierung_berechtigt(text,boolean)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.evakuierung_telegram_nachversand_beanspruchen(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.evakuierung_telegram_nachversand_beanspruchen(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public._evakuierung_nachfassen()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._evakuierung_nachfassen()', 'EXECUTE') THEN
    RAISE EXCEPTION '0207-Selbstprüfung: interne Funktion für anon bzw. authenticated zugänglich';
  END IF;
  IF NOT has_function_privilege('anon', 'public.evakuierung_beenden(uuid,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.evakuierung_beenden(uuid,text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.evakuierung_telegram_nachversand_beanspruchen(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.evakuierung_versand_beanspruchen(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '0207-Selbstprüfung: benötigtes EXECUTE-Recht fehlt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'evakuierung-nachfassen' AND schedule = '* * * * *') THEN
    RAISE EXCEPTION '0207-Selbstprüfung: Cron-Job evakuierung-nachfassen fehlt';
  END IF;
END $$;
