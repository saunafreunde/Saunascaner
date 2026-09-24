-- 0176_members_persoenliche_daten.sql
-- ---------------------------------------------------------------------
-- Persönliche Daten der Mitglieder nur noch für Admins (25.09.2026).
-- Läuft NACH dem Deploy, der die Admin-Mitgliederliste auf
-- admin_list_members() (0175) umstellt.
--
-- Befund (Audit 24.09.2026): members_read_self gilt für authenticated mit
-- USING (true). Damit konnte jeder Eingeloggte — auch jeder der Gäste — von
-- allen Mitgliedern E-Mail, Geburtstag, Anschrift, Stundenlohn, Zahlstatus,
-- Telegram-ID und Familienangaben lesen (DSGVO: Datenminimierung, Art. 5).
--
-- Jetzt: SELECT auf diese Spalten wird anon/authenticated entzogen (die
-- Tabelle hat seit 0172 nur noch Spaltenrechte). Sichtbar bleibt das
-- Vereinsprofil (Name, Sauna-Name, Avatar, Motto, Star-Profil, Rolle,
-- Anwesenheit …). Die eigene Zeile liefert weiter current_member()
-- (SECURITY DEFINER), Admins bekommen alles über admin_list_members().
-- Keine Richtlinie und keine INVOKER-Funktion liest diese Spalten direkt
-- (geprüft: die Policies auf member_photos/infusion_templates/poll_responses
-- nutzen current_member(); get_birthdays_today ist seit 0175 DEFINER;
-- _members_reset_family_on_checkout arbeitet nur mit NEW/OLD).
-- ---------------------------------------------------------------------

REVOKE SELECT (
  email, birthday, fan_address, hourly_rate_eur, monthly_hour_limit_eur,
  paid_until, fan_since, telegram_user_id,
  gast_referral_source, gast_consent_at, gast_signup_origin,
  family_has_partner, family_children_count, present_with_partner, present_children_count
) ON public.members FROM anon, authenticated;

COMMENT ON TABLE public.members IS
  'Mitglieder. NUR SPALTENRECHTE für anon/authenticated (0172/0176): geheim sind checkin_pin, member_code, entry_code, '
  'calendar_feed_token, telegram_link_token; persönlich (nur Admin via admin_list_members, eigene Zeile via current_member) '
  'sind email, birthday, fan_address, hourly_rate_eur, monthly_hour_limit_eur, paid_until, fan_since, telegram_user_id, '
  'gast_*, family_*, present_with_partner, present_children_count. Neue Spalte → bewusst entscheiden und ggf. '
  'GRANT SELECT (spalte) ON public.members TO anon, authenticated. Nie Tabellen-SELECT an anon/authenticated.';

DO $pruef$
DECLARE
  c text;
BEGIN
  IF has_table_privilege('authenticated', 'public.members', 'SELECT') OR has_table_privilege('anon', 'public.members', 'SELECT') THEN
    RAISE EXCEPTION '0176: Tabellen-SELECT auf members besteht';
  END IF;
  FOREACH c IN ARRAY ARRAY['email', 'birthday', 'fan_address', 'hourly_rate_eur', 'monthly_hour_limit_eur', 'paid_until',
    'fan_since', 'telegram_user_id', 'gast_referral_source', 'gast_consent_at', 'gast_signup_origin', 'family_has_partner',
    'family_children_count', 'present_with_partner', 'present_children_count', 'checkin_pin', 'member_code'] LOOP
    IF has_column_privilege('authenticated', 'public.members', c, 'SELECT') OR has_column_privilege('anon', 'public.members', c, 'SELECT') THEN
      RAISE EXCEPTION '0176: Spalte % ist noch lesbar', c;
    END IF;
  END LOOP;
  FOREACH c IN ARRAY ARRAY['id', 'auth_user_id', 'name', 'role', 'revoked_at', 'is_present', 'last_scan_at', 'is_aufgieser',
    'avatar_path', 'custom_attrs_enabled', 'approved', 'sauna_name'] LOOP
    IF NOT has_column_privilege('authenticated', 'public.members', c, 'SELECT') OR NOT has_column_privilege('anon', 'public.members', c, 'SELECT') THEN
      RAISE EXCEPTION '0176: benötigte Spalte % ist nicht lesbar', c;
    END IF;
  END LOOP;
END
$pruef$;
