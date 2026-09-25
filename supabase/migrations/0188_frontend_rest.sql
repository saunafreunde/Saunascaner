-- 0188_frontend_rest.sql — Anwesenheit per Zielzustand, WLAN-Automatik mit
-- Sperrfrist, CP-Posteingang „gelesen", Fehlerberichte aus dem Frontend
-- (Audit 25.09.2026, Gruppe H)
--
-- 1) set_my_presence(p_present): „Ich bin da" / „Ich gehe jetzt" schicken ab
--    jetzt den gewünschten ZIELZUSTAND statt blind umzuschalten. Wer am Tablet
--    schon eingecheckt hat und in der (veralteten) App noch „Ich bin da" sieht,
--    bleibt eingecheckt — vorher hätte ein Umschalter ihn AUSgecheckt.
--    Steht der Zustand schon, ändert sich nichts (auch „seit" = last_scan_at
--    bleibt). Gesperrte Mitglieder (revoked_at) können sich nicht selbst melden.
--    last_scan_at wird bei JEDEM echten Wechsel gesetzt, auch beim Auschecken
--    (die WLAN-Automatik unten braucht den Zeitpunkt).
-- 2) toggle_my_presence() entfällt: Sie scheiterte seit 0050 bei jedem Aufruf
--    (42702 „is_present is ambiguous", RETURNS TABLE-Spalte gegen members-
--    Spalte) — der Knopf in /mitarbeiter, /cp und /unterstuetzer tat nie etwas.
--    „Reparieren" würde das blinde Umschalten für alte App-Stände scharf
--    schalten. Alte Stände bekommen nach dem Neuladen-Signal den neuen Code.
-- 3) auto_checkin_via_wifi: Wer ausgecheckt hat (App, Tablet-PIN, Panel,
--    Scanner — alle setzen last_scan_at), wird 3 Stunden lang NICHT
--    automatisch wieder eingecheckt. Vorher checkte die App ein Android-Handy,
--    das beim Rausgehen noch im Vereins-WLAN hing, sofort wieder ein — bis zum
--    Nacht-Reset stand es falsch auf der Evakuierungsliste. Nach 3 Stunden
--    (Rückkehr am Abend) greift die Automatik wieder.
-- 4) CP-Posteingang: „✓ gelesen" setzte processed_at (das Versand-Flag des
--    Push-Dispatchers) statt read_at — der Eintrag blieb 7 Tage stehen, und
--    ein frühes ✓ konnte den Push unterdrücken. Jetzt read_at wie die Glocke;
--    die Liste zeigt nur Ungelesenes der letzten 7 Tage.
-- 5) Fehlerberichte aus dem Frontend (Tafel, Kiosk-Tablets, App): kleine
--    Tabelle client_fehler, befüllt über client_fehler_melden (auch anon —
--    die Tafel läuft ohne Anmeldung). Serverseitig gedeckelt: Texte gekürzt,
--    gleicher Fehler binnen 1 h wird nur gezählt, höchstens 60 neue Einträge
--    je Stunde, höchstens 5000 Zeilen, Aufbewahrung 30 Tage (pg_cron).
--    Keine Mitglieds-IDs, keine Namen — nur „angemeldet ja/nein".
--    Lesen nur Admins über client_fehler_liste.
--
-- Vorlage für jedes CREATE OR REPLACE: pg_get_functiondef der Live-DB am 25.09.2026.
-- Rechte werden hier ausdrücklich gesetzt (Supabase gibt anon direkte Grants,
-- REVOKE … FROM PUBLIC allein nimmt anon nichts weg).


-- ─── 1) Anwesenheit per Zielzustand ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_my_presence(p_present boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_me  uuid;
  v_ist boolean;
BEGIN
  IF p_present IS NULL THEN
    RAISE EXCEPTION 'invalid_presence' USING ERRCODE = 'P0001';
  END IF;

  SELECT m.id, m.is_present INTO v_me, v_ist
    FROM public.members m
   WHERE m.auth_user_id = auth.uid() AND m.revoked_at IS NULL
   FOR UPDATE;
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_logged_in' USING ERRCODE = 'P0001';
  END IF;

  -- Nur bei echtem Wechsel schreiben: kein neues „seit", keine doppelten
  -- Anwesenheits-Einträge (Trigger members_log_attendance & Co.).
  IF coalesce(v_ist, false) IS DISTINCT FROM p_present THEN
    UPDATE public.members m
       SET is_present = p_present,
           last_scan_at = now()
     WHERE m.id = v_me;
  END IF;

  RETURN p_present;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_my_presence(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_presence(boolean) TO authenticated, service_role;


-- ─── 2) Der kaputte Umschalter entfällt ────────────────────────────────────
DROP FUNCTION IF EXISTS public.toggle_my_presence();


-- ─── 3) WLAN-Automatik: Sperrfrist nach dem Auschecken ─────────────────────
CREATE OR REPLACE FUNCTION public.auto_checkin_via_wifi(p_local_ip text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c_sperrfrist constant interval := interval '3 hours';
  v_me_id uuid; v_opt_in boolean; v_is_present boolean; v_rolle text;
  v_on_wifi boolean; v_needs_family boolean; v_last_scan timestamptz;
BEGIN
  SELECT m.id, m.auto_checkin_enabled, m.is_present, m.role,
         coalesce(m.family_has_partner OR m.family_children_count > 0, false), m.last_scan_at
    INTO v_me_id, v_opt_in, v_is_present, v_rolle, v_needs_family, v_last_scan
  FROM public.members m
  WHERE m.auth_user_id = auth.uid() AND m.revoked_at IS NULL AND m.approved = true
  FOR UPDATE;
  IF v_me_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_logged_in'); END IF;
  IF v_rolle = 'gast' THEN RETURN jsonb_build_object('ok', false, 'reason', 'gast_kein_auto_checkin'); END IF;
  IF NOT coalesce(v_opt_in, false) THEN RETURN jsonb_build_object('ok', false, 'reason', 'opt_in_disabled'); END IF;
  IF v_is_present THEN RETURN jsonb_build_object('ok', true, 'reason', 'already_present', 'changed', false); END IF;

  -- NEU: nicht anwesend + letzter Wechsel jünger als die Sperrfrist = gerade
  -- ausgecheckt. Nicht wieder einchecken, nur sagen, wann es wieder geht.
  IF v_last_scan IS NOT NULL AND v_last_scan > now() - c_sperrfrist THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'recently_checked_out', 'changed', false,
      'retry_after_s', greatest(60, ceil(extract(epoch FROM (v_last_scan + c_sperrfrist - now())))::int)
    );
  END IF;

  v_on_wifi := public.check_wifi_subnet(p_local_ip);
  IF NOT v_on_wifi THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_on_wifi'); END IF;
  UPDATE public.members m SET is_present = true, last_scan_at = now() WHERE m.id = v_me_id;
  RETURN jsonb_build_object('ok', true, 'reason', 'checked_in', 'changed', true,
    'needs_family_modal', v_needs_family);
END;
$function$;

REVOKE ALL ON FUNCTION public.auto_checkin_via_wifi(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_checkin_via_wifi(text) TO authenticated, service_role;


-- ─── 4) CP-Posteingang: „gelesen" = read_at ────────────────────────────────
-- mark_notification_seen bleibt als Name bestehen (alte App-Stände rufen ihn),
-- wirkt jetzt aber wie mark_notification_read. processed_at gehört allein dem
-- Push-Dispatcher (api/push-send.ts) und seinen Dedup-Prüfungen.
CREATE OR REPLACE FUNCTION public.mark_notification_seen(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.notification_queue n
     SET read_at = now()
   WHERE n.id = p_id
     AND n.read_at IS NULL
     AND n.recipient_id IN (SELECT m.id FROM public.members m WHERE m.auth_user_id = auth.uid());
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_my_pending_notifications()
 RETURNS TABLE(id uuid, kind text, payload jsonb, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select n.id, n.kind, n.payload, n.created_at
    from public.notification_queue n
    join public.members m on m.id = n.recipient_id
   where m.auth_user_id = auth.uid()
     and n.read_at is null
     and n.created_at > now() - interval '7 days'
   order by n.created_at desc
   limit 50;
$function$;

REVOKE ALL ON FUNCTION public.mark_notification_seen(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_seen(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.list_my_pending_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_pending_notifications() TO authenticated, service_role;


-- ─── 5) Fehlerberichte aus dem Frontend ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_fehler (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  erstmals_am   timestamptz NOT NULL DEFAULT now(),
  zuletzt_am    timestamptz NOT NULL DEFAULT now(),
  anzahl        integer     NOT NULL DEFAULT 1,
  quelle        text        NOT NULL,  -- z. B. 'fenster', 'versprechen', 'grenze:Dashboard'
  route         text        NOT NULL,  -- Pfad ohne Query/Hash, IDs und Codes maskiert
  meldung       text        NOT NULL,
  stack         text,
  geraet        text,                  -- gekürzter User-Agent (Tafel-TV, Tablet, Handy)
  angemeldet    boolean     NOT NULL DEFAULT false,
  fingerabdruck text        NOT NULL   -- md5(quelle|route|meldung) zum Zusammenfassen
);
COMMENT ON TABLE public.client_fehler IS
  'Fehlerberichte aus dem Frontend (window.onerror, unhandledrejection, ErrorBoundary). '
  'Schreiben nur über client_fehler_melden (gedeckelt), Lesen nur Admins über client_fehler_liste. '
  'Aufbewahrung 30 Tage (cron client-fehler-aufraeumen). Migration 0188.';

CREATE INDEX IF NOT EXISTS client_fehler_fingerabdruck_idx ON public.client_fehler (fingerabdruck, zuletzt_am DESC);
CREATE INDEX IF NOT EXISTS client_fehler_erstmals_idx ON public.client_fehler (erstmals_am);
CREATE INDEX IF NOT EXISTS client_fehler_zuletzt_idx ON public.client_fehler (zuletzt_am);

-- Kein direkter Zugriff (Supabase vergibt für neue Tabellen sonst alles an anon/authenticated).
ALTER TABLE public.client_fehler ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.client_fehler FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.client_fehler TO service_role;
DO $$
DECLARE v_seq text := pg_get_serial_sequence('public.client_fehler', 'id');
BEGIN
  IF v_seq IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', v_seq);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.client_fehler_melden(
  p_quelle  text,
  p_route   text,
  p_meldung text,
  p_stack   text DEFAULT NULL,
  p_geraet  text DEFAULT NULL
)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  c_neu_je_stunde constant integer := 60;
  c_max_zeilen    constant integer := 5000;
  v_quelle  text := left(coalesce(nullif(btrim(p_quelle), ''), 'unbekannt'), 60);
  v_route   text := left(coalesce(nullif(btrim(p_route), ''), '/'), 120);
  v_meldung text := left(coalesce(nullif(btrim(p_meldung), ''), '(ohne Text)'), 500);
  v_stack   text := left(nullif(btrim(p_stack), ''), 2000);
  v_geraet  text := left(nullif(btrim(p_geraet), ''), 200);
  v_fp      text;
  v_id      bigint;
BEGIN
  v_fp := md5(v_quelle || '|' || v_route || '|' || v_meldung);

  -- Gleicher Fehler in der letzten Stunde: nur mitzählen, keine neue Zeile.
  UPDATE public.client_fehler f
     SET anzahl = least(f.anzahl + 1, 1000000),
         zuletzt_am = now()
   WHERE f.id = (
     SELECT f2.id FROM public.client_fehler f2
      WHERE f2.fingerabdruck = v_fp AND f2.zuletzt_am > now() - interval '1 hour'
      ORDER BY f2.zuletzt_am DESC
      LIMIT 1)
  RETURNING f.id INTO v_id;
  IF v_id IS NOT NULL THEN
    RETURN true;
  END IF;

  -- Deckel gegen Fluten (die Funktion ist auch für anon offen).
  IF (SELECT count(*) FROM public.client_fehler f3
       WHERE f3.erstmals_am > now() - interval '1 hour') >= c_neu_je_stunde THEN
    RETURN false;
  END IF;

  INSERT INTO public.client_fehler (quelle, route, meldung, stack, geraet, angemeldet, fingerabdruck)
  VALUES (v_quelle, v_route, v_meldung, v_stack, v_geraet, auth.uid() IS NOT NULL, v_fp);

  -- Gesamtdeckel: die ältesten Einträge weichen.
  DELETE FROM public.client_fehler f4
   WHERE f4.id IN (SELECT f5.id FROM public.client_fehler f5 ORDER BY f5.id DESC OFFSET c_max_zeilen);

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.client_fehler_melden(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_fehler_melden(text, text, text, text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.client_fehler_liste(p_tage integer DEFAULT 7)
 RETURNS TABLE(
   id bigint, erstmals_am timestamptz, zuletzt_am timestamptz, anzahl integer,
   quelle text, route text, meldung text, stack text, geraet text, angemeldet boolean
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'nur_admin' USING ERRCODE = '42501',
      HINT = 'Diese Funktion ist nur für Admins.';
  END IF;
  RETURN QUERY
    SELECT f.id, f.erstmals_am, f.zuletzt_am, f.anzahl, f.quelle, f.route,
           f.meldung, f.stack, f.geraet, f.angemeldet
      FROM public.client_fehler f
     WHERE f.zuletzt_am > now() - make_interval(days => least(greatest(coalesce(p_tage, 7), 1), 30))
     ORDER BY f.zuletzt_am DESC
     LIMIT 200;
END;
$function$;

REVOKE ALL ON FUNCTION public.client_fehler_liste(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_fehler_liste(integer) TO authenticated, service_role;

-- Aufbewahrung 30 Tage (täglich 03:40 UTC). cron.schedule mit gleichem Namen
-- ersetzt einen vorhandenen Job, die Migration ist also wiederholbar.
SELECT cron.schedule(
  'client-fehler-aufraeumen',
  '40 3 * * *',
  $$DELETE FROM public.client_fehler WHERE zuletzt_am < now() - interval '30 days'$$
);


-- ─── Selbstprüfung ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'toggle_my_presence') THEN
    RAISE EXCEPTION '0188-Selbstprüfung: toggle_my_presence gibt es noch';
  END IF;
  IF has_function_privilege('anon', 'public.set_my_presence(boolean)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.auto_checkin_via_wifi(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.mark_notification_seen(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.list_my_pending_notifications()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.client_fehler_liste(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION '0188-Selbstprüfung: anon darf eine Mitglieder-Funktion ausführen';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.set_my_presence(boolean)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.auto_checkin_via_wifi(text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.list_my_pending_notifications()', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.client_fehler_melden(text, text, text, text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION '0188-Selbstprüfung: fehlendes EXECUTE';
  END IF;
  IF has_table_privilege('anon', 'public.client_fehler', 'SELECT')
     OR has_table_privilege('authenticated', 'public.client_fehler', 'SELECT')
     OR has_table_privilege('anon', 'public.client_fehler', 'INSERT') THEN
    RAISE EXCEPTION '0188-Selbstprüfung: client_fehler ist direkt lesbar/schreibbar';
  END IF;
END $$;
