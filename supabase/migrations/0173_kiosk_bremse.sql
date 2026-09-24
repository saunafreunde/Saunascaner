-- 0173_kiosk_bremse.sql
-- ---------------------------------------------------------------------
-- Bremse für PIN-Fehlversuche und Tablet-Anmeldungen (25.09.2026).
-- Läuft VOR dem Deploy (rein additiv), die Sperren der alten Wege folgen
-- in 0174 nach dem Deploy.
--
-- Befund: Der Scanner (/scanner) rief toggle_presence_by_checkin_pin direkt
-- über PostgREST mit dem öffentlichen anon-Key auf — ohne jede Bremse. Ein
-- Rollback-Test fand mit 10.000 Versuchen alle 72 PINs. Die Bremse in
-- api/qr-signin.ts lebte nur im Speicher einer Serverinstanz (10/min je IP)
-- und bremste auch Treffer — am Saunafest-Eingang (eine IP für Tablet und
-- Scanner) ein Risiko für echte Gäste.
--
-- Jetzt: kiosk_versuche merkt sich nur FEHLVERSUCHE (unbekannte PIN) und
-- Anmelde-Mails je Schlüssel (IP bzw. E-Mail-Hash). Treffer bremsen nie.
-- Nur service_role (api/qr-signin.ts) darf lesen/schreiben.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.kiosk_versuche (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  art        text        NOT NULL CHECK (art IN ('pin_fehl', 'signup', 'signup_mail')),
  schluessel text        NOT NULL CHECK (length(schluessel) BETWEEN 1 AND 128),
  zeit       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kiosk_versuche_art_schluessel_zeit ON public.kiosk_versuche (art, schluessel, zeit DESC);

ALTER TABLE public.kiosk_versuche ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kiosk_versuche FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.kiosk_versuche TO service_role;

COMMENT ON TABLE public.kiosk_versuche IS
  'Bremse für Kiosk-Endpunkte (0173): Fehlversuche je IP, Anmeldungen/Anmelde-Mails je IP bzw. E-Mail-Hash. Nur service_role. Einträge älter als 1 Tag werden beim Schreiben gelöscht.';

-- Zählt die Einträge im Fenster; true = gesperrt (Grenze erreicht).
CREATE OR REPLACE FUNCTION public.kiosk_gesperrt(p_art text, p_schluessel text, p_max integer, p_fenster_sekunden integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT count(*) >= greatest(p_max, 1)
  FROM public.kiosk_versuche v
  WHERE v.art = p_art
    AND v.schluessel = p_schluessel
    AND v.zeit > now() - make_interval(secs => greatest(p_fenster_sekunden, 1));
$fn$;

-- Merkt einen Versuch und räumt Einträge älter als einen Tag weg.
CREATE OR REPLACE FUNCTION public.kiosk_versuch_merken(p_art text, p_schluessel text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  INSERT INTO public.kiosk_versuche (art, schluessel) VALUES (p_art, left(p_schluessel, 128));
  DELETE FROM public.kiosk_versuche WHERE zeit < now() - interval '1 day';
END;
$fn$;

REVOKE ALL ON FUNCTION public.kiosk_gesperrt(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kiosk_versuch_merken(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_gesperrt(text, text, integer, integer), public.kiosk_versuch_merken(text, text) TO service_role;

-- toggle_presence_by_checkin_pin läuft künftig über /api/qr-signin (service_role).
GRANT EXECUTE ON FUNCTION public.toggle_presence_by_checkin_pin(text) TO service_role;

-- Ungenutzt seit dem Umstieg auf den PIN-Pool (0051): kein Aufrufer im
-- Frontend oder in api/. Mit dem öffentlichen anon-Key war es ein
-- Check-in-Weg ohne Bremse.
REVOKE EXECUTE ON FUNCTION public.toggle_presence_by_entry_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_presence_by_entry_code(text) TO service_role;

-- Nur eingeloggte Mitglieder prüfen, ob ihr Wunsch-Einlasscode frei ist.
REVOKE EXECUTE ON FUNCTION public.entry_code_available(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.entry_code_available(text) TO authenticated, service_role;

-- Nächtlicher Reset ist Sache von pg_cron (läuft als postgres). Vorher
-- konnte jeder mit dem anon-Key alle Anwesenden auschecken.
REVOKE EXECUTE ON FUNCTION public.reset_presence_nightly() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_presence_nightly() TO service_role;
