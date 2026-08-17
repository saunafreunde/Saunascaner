-- 0147 — Gäste-Übersicht für den Admin-Bereich.
--
-- Seit das Eingangs-Tablet hängt, legen Gäste ihr Konto selbst an und sind per
-- Trigger sofort freigeschaltet (handle_new_user setzt approved=true). Es gibt
-- also NICHTS zu genehmigen — dieser Reiter ist kein Eingangskorb, sondern eine
-- Beobachtungsliste. Er beantwortet genau drei Fragen: wer ist neu, wer kommt
-- wieder, und wer hat sich nie wieder gemeldet.
--
-- Warum eine eigene RPC statt eines zweiten Frontend-Filters (den Gäste-Filter
-- gibt es in der Mitgliederliste längst): die drei Fragen hängen an Daten, die
-- der Browser gar nicht sehen kann bzw. nicht zusammenrechnen soll —
-- auth.users.last_sign_in_at ist vom Client aus unerreichbar, und die
-- Besuchs-/Bewertungszahlen wären sonst N+1 Einzelabfragen pro Zeile.
--
-- Zwei Fallen, die die Spalten hier bewusst umgehen:
--
--  1. BESUCHSTAGE, NICHT BESUCHE. Der Trigger members_log_attendance schreibt
--     beim Tablet-Signup sofort einen attendance_event (gemessen: 248 ms nach
--     Kontoanlage). Jeder Tablet-Gast hätte damit automatisch „1 Besuch" und
--     sähe aktiv aus. count(distinct date) gegen den Anmeldetag gestellt zeigt
--     die Wahrheit: gleicher Tag = nie wiedergekommen.
--
--  2. VIER QUELLEN FÜR „ZULETZT GESEHEN". Jede einzelne lügt in eine andere
--     Richtung: last_scan_at ist NULL bei jemandem, der gestern in der App war;
--     last_sign_in_at ist NULL bei Tablet-Konten (die entstehen serverseitig
--     per admin.createUser), obwohl die Person gescannt und bewertet hat. Erst
--     greatest() über alle vier ergibt eine ehrliche Spalte — greatest()
--     ignoriert NULLs.
--
-- Der checkin_pin bleibt bewusst DRAUSSEN: er wird nicht gebraucht, um einen
-- Gast einzuschätzen, und ein neuer PIN kommt bei Bedarf über
-- admin_rotate_checkin_pin (0135). Geliefert wird nur, OB einer existiert —
-- fehlt er, läuft der Tablet-Signup dieser Person in einen Serverfehler.

CREATE OR REPLACE FUNCTION public.list_gaeste_uebersicht()
RETURNS TABLE (
  id uuid,
  name text,
  sauna_name text,
  member_number int,
  email text,
  gast_seit timestamptz,
  herkunft text,
  besuchstage int,
  letzter_besuch date,
  bewertungen int,
  app_geoeffnet boolean,
  zuletzt_gesehen timestamptz,
  hat_pin boolean,
  revoked_at timestamptz,
  status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
BEGIN
  -- Harter Abbruch statt leerer Liste: bei einer Handvoll Gästen wäre „0 Zeilen"
  -- nicht von „keine Gäste da" zu unterscheiden.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'nur_admin';
  END IF;

  RETURN QUERY
  WITH g AS (
    SELECT
      m.id, m.name, m.sauna_name, m.member_number, m.email::text AS email,
      m.created_at, m.revoked_at,
      -- Freitext aus dem ?ref=-Parameter (Tablet, qr_kelo, qr_bio, qr_haus …),
      -- kein Enum. Roh durchreichen, sonst verschwinden die QR-Herkünfte still,
      -- sobald die Plakate im Vereinsraum wieder hängen. NULL heißt zuverlässig
      -- „von Hand angelegt": der Trigger setzt referral/origin/consent immer
      -- gemeinsam.
      COALESCE(NULLIF(m.gast_referral_source, ''), NULLIF(m.gast_signup_origin, ''), 'Vom Admin angelegt') AS herkunft,
      (SELECT count(DISTINCT ae.date)::int FROM public.attendance_events ae WHERE ae.member_id = m.id) AS besuchstage,
      (SELECT max(ae.date) FROM public.attendance_events ae WHERE ae.member_id = m.id) AS letzter_besuch,
      (SELECT count(*)::int FROM public.infusion_ratings r WHERE r.member_id = m.id) AS bewertungen,
      (u.last_sign_in_at IS NOT NULL) AS app_geoeffnet,
      greatest(
        m.last_scan_at,
        u.last_sign_in_at,
        (SELECT max(r.created_at) FROM public.infusion_ratings r WHERE r.member_id = m.id),
        (SELECT max(ae.created_at) FROM public.attendance_events ae WHERE ae.member_id = m.id)
      ) AS zuletzt_gesehen,
      (m.checkin_pin IS NOT NULL) AS hat_pin,
      (m.role = 'gast') AS ist_noch_gast
    FROM public.members m
    LEFT JOIN auth.users u ON u.id = m.auth_user_id
    -- Ehemalige Gäste bleiben in der Liste: „Gast wurde Mitglied" ist der
    -- Erfolgsfall, den der Verein sehen will, und ohne diesen Zweig wäre er
    -- unsichtbar.
    WHERE m.role = 'gast'
       OR EXISTS (
            SELECT 1 FROM public.activity_log al
             WHERE al.target_id = m.id
               AND al.action = 'member.role_change'
               AND al.details->>'from_role' = 'gast'
          )
  )
  SELECT
    g.id, g.name, g.sauna_name, g.member_number, g.email, g.created_at,
    g.herkunft, g.besuchstage, g.letzter_besuch, g.bewertungen,
    g.app_geoeffnet, g.zuletzt_gesehen, g.hat_pin, g.revoked_at,
    CASE
      WHEN NOT g.ist_noch_gast                                     THEN 'mitglied_geworden'
      WHEN g.besuchstage >= 2                                      THEN 'stammgast'
      WHEN g.created_at > now() - interval '14 days'               THEN 'neu'
      WHEN g.zuletzt_gesehen IS NULL
        OR g.zuletzt_gesehen < now() - interval '30 days'          THEN 'karteileiche'
      WHEN g.besuchstage = 0                                       THEN 'nie_da'
      ELSE                                                              'beobachten'
    END
  FROM g
  ORDER BY g.created_at DESC;
END;
$$;

COMMENT ON FUNCTION public.list_gaeste_uebersicht() IS
  'Gäste-Beobachtungsliste für den Admin-Reiter. Schwellwerte: neu = in den '
  'letzten 14 Tagen angemeldet, Stammgast = an >= 2 verschiedenen Tagen da '
  'gewesen, Karteileiche = seit 30 Tagen kein Lebenszeichen aus vier Quellen. '
  'Besuchstage bewusst distinct, weil der Signup selbst einen attendance_event '
  'erzeugt.';

-- Supabase vergibt neuen public-Funktionen über ALTER DEFAULT PRIVILEGES einen
-- DIREKTEN Grant an anon — ein blosses "revoke from public" lässt den unberührt
-- (siehe 0123_star_profile_anon_revoke.sql). Diese Funktion gibt E-Mail-Adressen
-- und Aktivitätsprofile heraus; ohne die zweite Zeile wäre die Gästeliste
-- anonym über die REST-API abrufbar.
REVOKE ALL ON FUNCTION public.list_gaeste_uebersicht() FROM public;
REVOKE ALL ON FUNCTION public.list_gaeste_uebersicht() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_gaeste_uebersicht() TO authenticated;
