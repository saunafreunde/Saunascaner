-- 0172_members_spaltenrechte.sql
-- ---------------------------------------------------------------------
-- Geheime Spalten von members nicht mehr für anon/authenticated lesbar
-- (24.09.2026). Läuft NACH dem Frontend-Deploy, der useAllMembers von
-- select('*') auf eine feste Spaltenliste umstellt (sonst 42501).
--
-- Befund: members_read_self FOR SELECT TO authenticated USING (true) plus
-- Tabellenrecht SELECT → jeder Eingeloggte (auch Gäste) konnte per
-- GET /rest/v1/members?select=… lesen:
--   checkin_pin          Check-in am Eingangs-Tablet als diese Person (72)
--   member_code          Login-Code: POST /api/qr-signin {member_code} → Magic-Link,
--                        also Kontoübernahme — auch der Admins (72)
--   entry_code           Check-in per toggle_presence_by_entry_code (5 gesetzt)
--   calendar_feed_token  fremde Kalender-Feeds (72)
--   telegram_link_token  fremdes Konto mit eigenem Telegram verknüpfen (1 offen)
--
-- Technik: Tabellen-SELECT entziehen, dann SELECT spaltenweise auf alle
-- übrigen Spalten gewähren — für anon UND authenticated. anon sieht mangels
-- Policy weiter 0 Zeilen, braucht die Spaltenrechte aber für Embeds
-- (members(name) auf der anonymen Tafel), für rund 17 Policies „TO public"
-- mit members-Unterabfrage und für den Realtime-RLS-Check. Ein nacktes
-- REVOKE für anon würde all das mit 42501 brechen.
-- Wer die Geheimnisse braucht, bekommt sie nur über SECURITY-DEFINER-RPCs:
-- current_member() (eigene Zeile), get_my_checkin_pin(), generate_my_telegram_link_token(),
-- admin_member_code() (0171), serverseitig über service_role.
--
-- ⚠️ FOLGEREGELN (auch im Tabellenkommentar):
--  * Jede neue Spalte in members braucht ab jetzt ausdrücklich
--    GRANT SELECT (neue_spalte) ON public.members TO anon, authenticated;
--    sonst ist sie fürs Frontend unlesbar (Default-Privileges gelten nicht für Spalten).
--  * NIE wieder GRANT SELECT ON public.members (Tabellenebene) an anon/authenticated
--    — auch nicht per „GRANT ALL ON ALL TABLES" bei einem Umzug (VPS!). Danach
--    die Prüfabfrage unten wiederholen.
--  * Frontend: nie select('*') auf members, auch nicht .update().select() ohne Spalten.
-- ---------------------------------------------------------------------

REVOKE SELECT ON public.members FROM anon, authenticated;

DO $grant$
DECLARE
  v_spalten text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_spalten
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'members'
    AND column_name NOT IN ('checkin_pin', 'member_code', 'entry_code', 'calendar_feed_token', 'telegram_link_token');
  EXECUTE format('GRANT SELECT (%s) ON public.members TO anon, authenticated', v_spalten);
END
$grant$;

COMMENT ON TABLE public.members IS
  'Mitglieder. SEIT 0172 NUR SPALTENRECHTE für anon/authenticated: checkin_pin, member_code, entry_code, '
  'calendar_feed_token, telegram_link_token sind geheim (nur über DEFINER-RPCs). Neue Spalte → '
  'GRANT SELECT (spalte) ON public.members TO anon, authenticated. Nie Tabellen-SELECT an anon/authenticated.';

-- Prüfung: bricht die Migration ab, wenn ein Geheimnis lesbar bliebe oder
-- eine normale Spalte fehlte.
DO $pruef$
DECLARE
  r record;
  v_geheim constant text[] := ARRAY['checkin_pin', 'member_code', 'entry_code', 'calendar_feed_token', 'telegram_link_token'];
BEGIN
  IF has_table_privilege('authenticated', 'public.members', 'SELECT') OR has_table_privilege('anon', 'public.members', 'SELECT') THEN
    RAISE EXCEPTION '0172: Tabellen-SELECT auf members besteht noch';
  END IF;
  FOR r IN SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' LOOP
    IF r.column_name = ANY (v_geheim) THEN
      IF has_column_privilege('authenticated', 'public.members', r.column_name, 'SELECT')
         OR has_column_privilege('anon', 'public.members', r.column_name, 'SELECT') THEN
        RAISE EXCEPTION '0172: Geheime Spalte % ist noch lesbar', r.column_name;
      END IF;
    ELSIF NOT has_column_privilege('authenticated', 'public.members', r.column_name, 'SELECT')
       OR NOT has_column_privilege('anon', 'public.members', r.column_name, 'SELECT') THEN
      RAISE EXCEPTION '0172: Spalte % ist nicht mehr lesbar', r.column_name;
    END IF;
  END LOOP;
END
$pruef$;
