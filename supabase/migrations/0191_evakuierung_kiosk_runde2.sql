-- 0191_evakuierung_kiosk_runde2.sql
-- ---------------------------------------------------------------------
-- Evakuierung und Kiosk-Kopplung nachgeschärft (Audit-Runde 2, 25.09.2026).
--
-- Befunde (live belegt, kiosk_geraete war leer):
--  * Die Übergangsregel aus 0177/0178 („solange kein Gerät aktiv gekoppelt
--    ist, darf jeder Kiosk auslösen") war live offen: Jeder im Internet konnte
--    mit dem anon-Key einen echten Alarm auslösen (Tafel-Overlay, Push an alle,
--    Telegram) und bekam die Anwesenheitsliste zurück. Sie endete außerdem beim
--    ersten gekoppelten Gerät JEDER Art — ein zuerst gekoppeltes Panel nahm dem
--    noch ungekoppelten Öl-Raum-Tablet den Alarm. Und ein Widerruf des letzten
--    Geräts hätte sie wieder geöffnet.
--  * Die Bremse (Trigger evacuation_rate_limit, ≥ 3 Alarme in 30 min) sperrte
--    danach JEDEN weiteren Alarm außer von Admins — auch den echten Alarm von
--    Personal, Mitgliedern und gekoppelten Geräten.
--  * Push und Telegram hingen allein an einem zweiten Aufruf aus dem Browser
--    (/api/send-evacuation); scheiterte der, ging nichts raus.
--  * Der Kopplungslink war das dauerhafte Geräte-Token — beliebig oft nutzbar,
--    obwohl der Admin-Text „gilt nur einmal" sagte.
--
-- Lösung:
--  1) Übergang (evakuierung_uebergang_offen): nur solange noch NIE ein Gerät
--     der Art 'oelraum' gekoppelt wurde (auch widerrufene zählen) UND nur bis
--     09.10.2026 00:00 Uhr (Berlin). Im Übergang: p_von wird ignoriert, die
--     Rückgabe enthält keine Namensliste, eigene Bremse 2 Alarme je 30 min.
--     Beenden bleibt im Übergang verboten.
--  2) Die alte Bremse entfällt. Angemeldete Mitglieder (nicht Gast/Fan) und
--     gekoppelte Geräte werden nie gebremst; die Herkunft steht in der neuen
--     Spalte evacuation_events.quelle.
--  3) Nach dem INSERT eines Alarms ruft die Datenbank selbst per pg_net
--     /api/send-evacuation auf (Header x-cron-secret aus dem Vault, wie die
--     Cron-Jobs aus 0168). Text und Push gehen damit auch raus, wenn der
--     Browser den zweiten Aufruf nicht mehr schafft. Ein Fehler dabei bricht
--     den Alarm NIE ab. Das Öl-Raum-Foto schickt der Browser danach getrennt
--     (Spalte foto_status, genau einmal).
--  4) Einmal-Kopplung: admin_kiosk_geraet_koppeln liefert einen zufälligen
--     Kopplungscode (nur sha256 gespeichert, 24 h gültig). /koppeln tauscht
--     ihn per kiosk_geraet_einloesen (anon) gegen das eigentliche Geräte-Token;
--     danach ist der Code verbraucht. Bestehende Geräte-Tokens bleiben gültig.
--
-- Wiederholbar: IF [NOT] EXISTS, OR REPLACE, DROP bei Signaturwechsel.
-- Seit 0181 bekommen neue Funktionen kein EXECUTE für PUBLIC/anon — was
-- Kiosk/Tafel (anon) braucht, steht unten ausdrücklich als GRANT … TO anon.
-- ---------------------------------------------------------------------

-- ─── 1) kiosk_geraete: Einmal-Kopplungscode ─────────────────────────────
-- token_hash ist erst nach dem Einlösen gesetzt; bis dahin gibt es nur den
-- Hash des Kopplungscodes. Ein Kopplungscode ist nie ein Geräte-Token
-- (kiosk_geraet_art/kiosk_geraet_pruefen vergleichen nur token_hash).
ALTER TABLE public.kiosk_geraete ALTER COLUMN token_hash DROP NOT NULL;
ALTER TABLE public.kiosk_geraete ADD COLUMN IF NOT EXISTS kopplung_hash text;
ALTER TABLE public.kiosk_geraete ADD COLUMN IF NOT EXISTS kopplung_bis  timestamptz;
ALTER TABLE public.kiosk_geraete ADD COLUMN IF NOT EXISTS eingeloest_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS kiosk_geraete_kopplung_hash_key
  ON public.kiosk_geraete (kopplung_hash) WHERE kopplung_hash IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.kiosk_geraete'::regclass AND conname = 'kiosk_geraete_token_oder_code'
  ) THEN
    ALTER TABLE public.kiosk_geraete
      ADD CONSTRAINT kiosk_geraete_token_oder_code CHECK (token_hash IS NOT NULL OR kopplung_hash IS NOT NULL);
  END IF;
END $$;

-- Bestand (vor 0191 direkt mit Token gekoppelt): gilt als eingelöst.
UPDATE public.kiosk_geraete
   SET eingeloest_at = erstellt_at
 WHERE token_hash IS NOT NULL AND eingeloest_at IS NULL;

COMMENT ON COLUMN public.kiosk_geraete.kopplung_hash IS
  'sha256 des Einmal-Kopplungscodes (0191); NULL nach dem Einlösen.';
COMMENT ON COLUMN public.kiosk_geraete.kopplung_bis IS
  'Kopplungscode gültig bis (0191, 24 h).';
COMMENT ON COLUMN public.kiosk_geraete.eingeloest_at IS
  'Zeitpunkt, an dem das Gerät den Kopplungscode gegen sein Token getauscht hat (0191).';

-- Admin: Gerät anlegen → gibt den EINMAL-Kopplungscode zurück (für Link/QR).
CREATE OR REPLACE FUNCTION public.admin_kiosk_geraet_koppeln(p_name text, p_art text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_code  text;
  v_admin uuid;
BEGIN
  IF NOT public._ist_aktiver_admin() THEN
    RAISE EXCEPTION 'Nur Admins dürfen Geräte koppeln.' USING ERRCODE = '42501';
  END IF;
  IF p_art NOT IN ('oelraum', 'eingang', 'tafel', 'panel', 'scanner') THEN
    RAISE EXCEPTION 'Unbekannte Geräteart.' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO v_admin FROM public.members WHERE auth_user_id = auth.uid();
  v_code := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.kiosk_geraete (name, art, token_hash, kopplung_hash, kopplung_bis, erstellt_von)
  VALUES (left(btrim(coalesce(p_name, '')), 60), p_art, NULL,
          encode(extensions.digest(v_code, 'sha256'), 'hex'), now() + interval '24 hours', v_admin);
  RETURN v_code;
END;
$fn$;
REVOKE ALL ON FUNCTION public.admin_kiosk_geraet_koppeln(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_kiosk_geraet_koppeln(text, text) TO authenticated, service_role;

-- Gerät löst den Code ein: erzeugt das Geräte-Token, gibt es GENAU EINMAL
-- zurück und verbraucht den Code (ein UPDATE, also atomar).
CREATE OR REPLACE FUNCTION public.kiosk_geraet_einloesen(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_token text;
  v_hash  text;
  v_art   text;
  v_name  text;
BEGIN
  IF p_code IS NULL OR p_code !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'ungueltig');
  END IF;
  v_hash  := encode(extensions.digest(p_code, 'sha256'), 'hex');
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  UPDATE public.kiosk_geraete g
     SET token_hash         = encode(extensions.digest(v_token, 'sha256'), 'hex'),
         kopplung_hash      = NULL,
         kopplung_bis       = NULL,
         eingeloest_at      = now(),
         zuletzt_gesehen_at = now()
   WHERE g.kopplung_hash = v_hash
     AND g.token_hash IS NULL
     AND g.widerrufen_at IS NULL
     AND g.kopplung_bis > now()
  RETURNING g.art, g.name INTO v_art, v_name;
  IF v_art IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.kiosk_geraete g WHERE g.kopplung_hash = v_hash AND g.widerrufen_at IS NULL) THEN
      RETURN jsonb_build_object('ok', false, 'grund', 'abgelaufen');
    END IF;
    RETURN jsonb_build_object('ok', false, 'grund', 'ungueltig');
  END IF;
  RETURN jsonb_build_object('ok', true, 'token', v_token, 'art', v_art, 'name', v_name);
END;
$fn$;
REVOKE ALL ON FUNCTION public.kiosk_geraet_einloesen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_geraet_einloesen(text) TO anon, authenticated, service_role;

-- Admin-Liste mit Kopplungsstand (Rückgabetyp neu → DROP + CREATE).
DROP FUNCTION IF EXISTS public.admin_kiosk_geraete();
CREATE OR REPLACE FUNCTION public.admin_kiosk_geraete()
RETURNS TABLE (id uuid, name text, art text, erstellt_at timestamptz, zuletzt_gesehen_at timestamptz,
               widerrufen_at timestamptz, eingeloest_at timestamptz, kopplung_bis timestamptz, status text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF NOT public._ist_aktiver_admin() THEN
    RAISE EXCEPTION 'Nur Admins.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT g.id, g.name, g.art, g.erstellt_at, g.zuletzt_gesehen_at, g.widerrufen_at,
           g.eingeloest_at, g.kopplung_bis,
           CASE
             WHEN g.widerrufen_at IS NOT NULL THEN 'widerrufen'
             WHEN g.token_hash IS NOT NULL   THEN 'gekoppelt'
             WHEN g.kopplung_bis > now()     THEN 'ausstehend'
             ELSE 'abgelaufen'
           END
    FROM public.kiosk_geraete g
    ORDER BY g.widerrufen_at NULLS FIRST, g.erstellt_at DESC;
END;
$fn$;
REVOKE ALL ON FUNCTION public.admin_kiosk_geraete() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_kiosk_geraete() TO authenticated, service_role;

-- ─── 2) Evakuierung: Übergang eng und befristet ──────────────────────────
-- EINE Stelle für die Übergangsregel — die Datenbank (evakuierung_ausloesen)
-- und /api/send-evacuation fragen beide hier. anon darf fragen: das Öl-Raum-
-- Tablet zeigt damit an, ob der Alarm dort noch ohne Kopplung geht.
CREATE OR REPLACE FUNCTION public.evakuierung_uebergang_offen()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT now() < (timestamp '2026-10-09 00:00:00' AT TIME ZONE 'Europe/Berlin')
     AND NOT EXISTS (
       -- „einmal gekoppelt": Token gesetzt (auch wenn später widerrufen);
       -- ein nur angelegter, nie eingelöster Code zählt nicht.
       SELECT 1 FROM public.kiosk_geraete g
       WHERE g.art = 'oelraum' AND g.token_hash IS NOT NULL
     );
$fn$;
REVOKE ALL ON FUNCTION public.evakuierung_uebergang_offen() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evakuierung_uebergang_offen() TO anon, authenticated, service_role;

-- Beenden (p_uebergang = false): Mitglieder (nicht Gast/Fan) und gekoppelte
-- Geräte. Auslösen prüft evakuierung_ausloesen selbst (siehe unten).
CREATE OR REPLACE FUNCTION public._evakuierung_berechtigt(p_geraet text, p_uebergang boolean)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.auth_user_id = auth.uid() AND m.approved AND m.revoked_at IS NULL
      AND m.role IN ('admin', 'staff', 'member', 'guest_aufgieser')
  ) THEN
    RETURN true;
  END IF;
  IF public.kiosk_geraet_art(p_geraet) IS NOT NULL THEN
    RETURN true;
  END IF;
  RETURN coalesce(p_uebergang, false) AND public.evakuierung_uebergang_offen();
END;
$fn$;
REVOKE ALL ON FUNCTION public._evakuierung_berechtigt(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._evakuierung_berechtigt(text, boolean) TO service_role;

-- Herkunft des Alarms und Foto-Versand (genau einmal).
ALTER TABLE public.evacuation_events ADD COLUMN IF NOT EXISTS quelle text
  CONSTRAINT evacuation_events_quelle_check CHECK (quelle IN ('mitglied', 'geraet', 'uebergang'));
ALTER TABLE public.evacuation_events ADD COLUMN IF NOT EXISTS foto_status text;
COMMENT ON COLUMN public.evacuation_events.quelle IS
  'Wer hat ausgelöst (0191): mitglied (angemeldet, nicht Gast/Fan), geraet (gekoppelt), uebergang (ungekoppelter Kiosk bis zur Öl-Raum-Kopplung).';
COMMENT ON COLUMN public.evacuation_events.foto_status IS
  'Versand des Öl-Raum-Fotos an Telegram (0191): NULL, sende, gesendet n/m, kein_token, keine_chats.';

-- Alte Bremse weg: sie sperrte nach 3 Alarmen in 30 min auch echte Alarme.
DROP TRIGGER IF EXISTS trg_evacuation_rate_limit ON public.evacuation_events;
DROP FUNCTION IF EXISTS public.evacuation_rate_limit();

CREATE OR REPLACE FUNCTION public.evakuierung_ausloesen(p_geraet text DEFAULT NULL, p_von uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_ev     public.evacuation_events;
  v_von    uuid;
  v_namen  text[];
  v_quelle text;
  v_json   jsonb;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.auth_user_id = auth.uid() AND m.approved AND m.revoked_at IS NULL
      AND m.role IN ('admin', 'staff', 'member', 'guest_aufgieser')
  ) THEN
    v_quelle := 'mitglied';
  ELSIF public.kiosk_geraet_art(p_geraet) IS NOT NULL THEN
    v_quelle := 'geraet';
  ELSIF public.evakuierung_uebergang_offen() THEN
    v_quelle := 'uebergang';
  ELSE
    RAISE EXCEPTION 'nicht_berechtigt' USING ERRCODE = '42501';
  END IF;

  -- Zwei Knöpfe in derselben Sekunde ergeben EINEN Alarm.
  PERFORM pg_advisory_xact_lock(hashtext('public.evakuierung_ausloesen'));

  -- Läuft schon ein Alarm, gilt dieser (zweimal drücken schadet nicht).
  SELECT * INTO v_ev FROM public.evacuation_events
  WHERE ended_at IS NULL AND triggered_at > now() - interval '6 hours'
  ORDER BY triggered_at DESC LIMIT 1;
  IF v_ev.id IS NOT NULL THEN
    v_json := to_jsonb(v_ev) || jsonb_build_object('schon_aktiv', true);
    IF v_quelle = 'uebergang' THEN
      v_json := v_json - 'present_names' - 'present_count';
    END IF;
    RETURN v_json;
  END IF;

  -- Bremse NUR für den Übergangsweg: echte Alarme von Mitgliedern und
  -- gekoppelten Geräten werden nie gebremst.
  IF v_quelle = 'uebergang' AND (
    SELECT count(*) FROM public.evacuation_events
    WHERE quelle = 'uebergang' AND triggered_at > now() - interval '30 minutes'
  ) >= 2 THEN
    RAISE EXCEPTION 'evakuierung_gebremst' USING ERRCODE = 'P0001',
      HINT = 'Von ungekoppelten Geräten wurden gerade schon 2 Alarme ausgelöst. Bitte am Handy (angemeldet) auslösen.';
  END IF;

  -- Auslöser: das angemeldete Konto; am GEKOPPELTEN Kiosk optional die dort
  -- gewählte, gerade anwesende Person. Im Übergang wird p_von ignoriert.
  SELECT id INTO v_von FROM public.members WHERE auth_user_id = auth.uid();
  IF v_von IS NULL AND p_von IS NOT NULL AND v_quelle = 'geraet' THEN
    SELECT id INTO v_von FROM public.members
    WHERE id = p_von AND revoked_at IS NULL AND is_present;
  END IF;

  -- Die Anwesenheitsliste setzt der Server, nicht der Browser.
  SELECT coalesce(array_agg(m.name ORDER BY m.name), ARRAY[]::text[]) INTO v_namen
  FROM public.members m WHERE m.is_present AND m.revoked_at IS NULL;

  INSERT INTO public.evacuation_events (triggered_by, present_names, present_count, quelle)
  VALUES (v_von, v_namen, cardinality(v_namen), v_quelle)
  RETURNING * INTO v_ev;

  v_json := to_jsonb(v_ev) || jsonb_build_object('schon_aktiv', false);
  IF v_quelle = 'uebergang' THEN
    v_json := v_json - 'present_names' - 'present_count';
  END IF;
  RETURN v_json;
END;
$fn$;
REVOKE ALL ON FUNCTION public.evakuierung_ausloesen(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evakuierung_ausloesen(text, uuid) TO anon, authenticated, service_role;

-- ─── 3) Versand serverseitig anstoßen ────────────────────────────────────
-- Nach dem INSERT ruft die Datenbank /api/send-evacuation selbst auf (pg_net
-- schickt erst nach dem COMMIT). Der Endpunkt sendet Text + Push genau einmal
-- (Beanspruchung über telegram_status); ein späterer Browser-Aufruf schickt
-- nur noch das Foto nach. Jeder Fehler hier wird nur protokolliert — der
-- Alarm selbst darf daran NIE scheitern.
CREATE OR REPLACE FUNCTION public._evakuierung_versand_anstossen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := 'https://app.sauna-fds.de/api/send-evacuation',
      body := jsonb_build_object('alarm_id', NEW.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', coalesce(
          (SELECT d.decrypted_secret FROM vault.decrypted_secrets d WHERE d.name = 'cron_secret' LIMIT 1),
          ''
        )
      ),
      timeout_milliseconds := 30000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '0191: Evakuierungs-Versand nicht angestoßen (%): %', SQLSTATE, SQLERRM;
  END;
  RETURN NULL;
END;
$fn$;
REVOKE ALL ON FUNCTION public._evakuierung_versand_anstossen() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_evakuierung_versand ON public.evacuation_events;
CREATE TRIGGER trg_evakuierung_versand
  AFTER INSERT ON public.evacuation_events
  FOR EACH ROW EXECUTE FUNCTION public._evakuierung_versand_anstossen();

-- ─── 4) Selbstprüfung ────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT has_function_privilege('anon', 'public.evakuierung_ausloesen(text,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.evakuierung_beenden(uuid,text)', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.kiosk_geraet_einloesen(text)', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.kiosk_geraet_pruefen(text)', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.evakuierung_uebergang_offen()', 'EXECUTE') THEN
    RAISE EXCEPTION '0191-Selbstprüfung: anon fehlt EXECUTE auf einer Kiosk-/Evakuierungsfunktion';
  END IF;
  IF has_function_privilege('anon', 'public.admin_kiosk_geraete()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_kiosk_geraet_koppeln(text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public._evakuierung_berechtigt(text,boolean)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._evakuierung_berechtigt(text,boolean)', 'EXECUTE')
     OR has_function_privilege('anon', 'public._evakuierung_versand_anstossen()', 'EXECUTE') THEN
    RAISE EXCEPTION '0191-Selbstprüfung: interne bzw. Admin-Funktion für anon ausführbar';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.admin_kiosk_geraete()', 'EXECUTE') THEN
    RAISE EXCEPTION '0191-Selbstprüfung: authenticated fehlt EXECUTE auf admin_kiosk_geraete';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.evacuation_events'::regclass AND tgname = 'trg_evacuation_rate_limit') THEN
    RAISE EXCEPTION '0191-Selbstprüfung: alte Evakuierungs-Bremse noch aktiv';
  END IF;
END $$;
