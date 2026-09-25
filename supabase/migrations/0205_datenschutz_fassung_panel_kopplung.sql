-- 0205_datenschutz_fassung_panel_kopplung.sql — Fassungs-Kennung mit Zähler,
-- Anwesenheits-PC nur mit den angezeigten Angaben, Kopplungsanfragen nach
-- einem Tag weg
-- (Audit-Runde 3, 25.09.2026, Gruppe T8_datenschutz_texte)
--
-- 1) Fassung der Datenschutzhinweise (members.datenschutz_fassung, 0186):
--    Die Kennung war nur „JJJJ-MM-TT“. Am 25.09. wurde der Text aber zweimal
--    geändert (b905733 und bd4bf58), ohne dass sich die Kennung änderte, und
--    mit dieser Runde ändert er sich ein drittes Mal — '2026-09-25' stünde
--    damit für mehrere Texte. Neu: optionaler Zähler für weitere Änderungen
--    am selben Tag, „JJJJ-MM-TT.N“ (N = 1–99 ohne führende Null, z. B.
--    '2026-09-25.2'). Der Trigger _members_datenschutz_fassung übernahm bisher
--    nur ^\d{4}-\d{2}-\d{2}$ und hätte '2026-09-25.2' STILL verworfen (NULL).
--    Alte Werte bleiben gültig. Dieselbe Regel prüfen api/qr-signin.ts
--    (Tablet-Signup) und api/email.ts (Gast-Signup); useAuth.signUp geht
--    direkt über Supabase Auth, dort prüft nur dieser Trigger.
--    Zuordnung (auch in src/lib/datenschutz.ts):
--      '2026-09-25'   = Text aus b905733 (live ab 25.09. 04:24 UTC). Ab 07:55
--                       UTC stand unter derselben Kennung der Text aus
--                       bd4bf58 — Registrierungen danach über den Zeitpunkt
--                       der Registrierung zuordnen: auth.users.created_at,
--                       nicht members.created_at (bei Mail-Bestätigung
--                       entsteht die Mitgliedszeile erst beim Klick, 0189).
--                       Stand 25.09. mittags: keine; die einzige Zeile mit
--                       '2026-09-25' ist von 06:48 UTC.
--      '2026-09-25.2' = Text ab Audit-Runde 3 (Telegram-Vereinsmeldungen,
--                       Anwesenheits-PC, gekoppelte Geräte).
--
-- 2) list_panel_members (Anwesenheits-PC, anonym am gekoppelten Gerät):
--    lieferte neben dem, was die Kacheln zeigen, auch role, is_aufgieser,
--    is_cp_employee, last_scan_at (minutengenauer Check-in) und die
--    Familienangaben (present_with_partner, present_children_count) aller
--    freigegebenen Konten außer Gästen. Die Oberfläche (AnwesenheitsPanel,
--    PanelGrid) nutzt nur id, name, member_number, is_present, avatar_path und
--    sauna_name — nur die gibt es noch (Datensparsamkeit; die
--    Datenschutzhinweise nennen genau diese Angaben). Prüfung, Filter und
--    Sortierung unverändert.
--    Rückgabetyp ändert sich → DROP + CREATE. Seit 0181 bekommen neue
--    Funktionen kein anon-Recht (ALTER DEFAULT PRIVILEGES) — das GRANT an anon
--    ist deshalb ausdrücklich gesetzt, sonst stünde der Panel-PC still (42501).
--    Alte Bundles lesen die entfallenen Felder nicht (Typ PanelMember).
--
-- 3) Kopplungsanfragen per QR-Code (kiosk_kopplungsanfragen, 0197/0198)
--    enthalten eine grobe Geräteangabe (Betriebssystem, Browser,
--    Bildschirmgröße) und einen sha256-Auszug der Absender-IP. Gelöscht
--    wurden alte Anfragen bisher nur, wenn eine NEUE Anfrage kam — ohne neue
--    Kopplung blieben sie beliebig lange liegen. Neu: stündlicher pg_cron-Job
--    löscht Anfragen, die älter als einen Tag sind. Sie gelten ohnehin nur
--    15 Minuten; nach der Freigabe erkennt das Gerät seine Kopplung über
--    kiosk_geraete, nicht über die Anfrage. Die Kopplungs-Funktionen selbst
--    bleiben unverändert.
--
-- Wiederholbar: CREATE OR REPLACE / DROP … IF EXISTS / cron.unschedule vorab.
-- Einführung: ERST diese Migration, DANN das Frontend mit
-- DATENSCHUTZ_FASSUNG = '2026-09-25.2' (sonst speichert der Trigger NULL).
-- Danach app_force_reload_at setzen (Tablets/PWAs mit altem Bundle schicken
-- sonst weiter '2026-09-25' für den neuen Text).


-- ─── 1) Trigger: Fassung mit optionalem Zähler ──────────────────────────────
-- Vorlage: Live-Fassung (0186, pg_get_functiondef vom 25.09.2026). Geändert
-- ist nur die Formatprüfung.
CREATE OR REPLACE FUNCTION public._members_datenschutz_fassung()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_fassung text;
begin
  -- Nachweis: aus der App (anon/authenticated) nicht änderbar.
  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if TG_OP = 'UPDATE' then
      NEW.datenschutz_fassung := OLD.datenschutz_fassung;
      return NEW;
    end if;
    NEW.datenschutz_fassung := null;
  end if;

  if TG_OP = 'INSERT' and NEW.datenschutz_fassung is null and NEW.auth_user_id is not null then
    select u.raw_user_meta_data->>'datenschutz_fassung' into v_fassung
      from auth.users u where u.id = NEW.auth_user_id;
    -- JJJJ-MM-TT, bei weiteren Änderungen am selben Tag mit Zähler: JJJJ-MM-TT.2 (0205).
    if v_fassung ~ '^\d{4}-\d{2}-\d{2}(\.[1-9]\d?)?$' then
      NEW.datenschutz_fassung := v_fassung;
    end if;
  end if;
  return NEW;
end;
$function$;
REVOKE ALL ON FUNCTION public._members_datenschutz_fassung() FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.members.datenschutz_fassung IS
  'Fassung der Datenschutzhinweise (JJJJ-MM-TT, bei weiteren Änderungen am selben Tag JJJJ-MM-TT.N), '
  'die bei der Registrierung angezeigt und bestätigt wurde; Zeitpunkt = gast_consent_at bzw. created_at. '
  'NULL = vor dem 25.09.2026 oder unbekannt. 0186/0205.';


-- ─── 2) list_panel_members: nur, was der Anwesenheits-PC anzeigt ────────────
-- Vorlage: Live-Fassung (0177, pg_get_functiondef vom 25.09.2026). Prüfung,
-- Filter und Sortierung unverändert; nur weniger Spalten.
DROP FUNCTION IF EXISTS public.list_panel_members(text);

CREATE OR REPLACE FUNCTION public.list_panel_members(p_panel_password text)
 RETURNS TABLE(id uuid, name text, member_number integer, is_present boolean, avatar_path text, sauna_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public._panel_geraet_ok(p_panel_password) THEN
    RAISE EXCEPTION 'invalid_password' USING ERRCODE = 'P0001';
  END IF;
  RETURN QUERY
  SELECT
    m.id, m.name, m.member_number, m.is_present, m.avatar_path, m.sauna_name
  FROM public.members m
  WHERE m.revoked_at IS NULL
    AND m.approved = true
    AND m.role IN ('member', 'guest_aufgieser', 'staff', 'admin', 'fan')
  ORDER BY m.is_present DESC, m.name ASC;
END;
$function$;
COMMENT ON FUNCTION public.list_panel_members(text) IS
  'Anwesenheits-PC (gekoppeltes Gerät der Art panel): alle freigegebenen Konten außer Gästen mit Name, '
  'Saunaname, Mitgliedsnummer, Profilbild und Anwesenheit — nur, was die Kacheln zeigen (0205).';
REVOKE ALL ON FUNCTION public.list_panel_members(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_panel_members(text) TO anon, authenticated, service_role;


-- ─── 3) Kopplungsanfragen nach einem Tag löschen ────────────────────────────
DO $$ BEGIN
  PERFORM cron.unschedule('kiosk-kopplung-aufraeumen');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Stündlich zur Minute 55 (wie kiosk-versuche-aufraeumen als reiner DELETE).
SELECT cron.schedule(
  'kiosk-kopplung-aufraeumen',
  '55 * * * *',
  $$ delete from public.kiosk_kopplungsanfragen where erstellt_at < now() - interval '1 day'; $$
);
