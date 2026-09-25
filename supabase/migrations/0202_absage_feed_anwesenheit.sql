-- 0202_absage_feed_anwesenheit.sql
-- ---------------------------------------------------------------------
-- Absage und Anwesenheit (Audit-Runde 3, 25.09.2026, Gruppe T4).
--
-- Befunde:
--  * Seit 0193 wird ein abgesagter Aufguss in einer Garantie-Stunde nicht mehr
--    gelöscht, sondern per _aufguss_ans_personal zum Personal-Platzhalter
--    umgewandelt (gleiche Zeile, gleiche id). Vorher löste das DELETE über den
--    Fremdschlüssel feed_posts_infusion_id_fkey (ON DELETE SET NULL) die
--    Verknüpfung der Feed-Beiträge. Jetzt blieben sie am Platzhalter hängen
--    und standen nach einer Übernahme (takeover_personal_fallback) beim
--    fremden Aufgießer — auf der Feed-Karte (list_feed) und in
--    list_infusion_feed_posts. Dasselbe galt für die anderen Wege zum
--    Platzhalter: add_absence (Urlaub), revoke_my_recurring_slot und der
--    Lösch-Trigger _mitglied_loeschen_aufguesse_freigeben.
--    Neu: _aufguss_ans_personal löst die Verknüpfung selbst, sobald die
--    Umwandlung geklappt hat — die Beiträge bleiben sichtbar, nur ohne Anker.
--    Scheitert die Umwandlung (return false), löscht der Aufrufer die Zeile,
--    und der Fremdschlüssel setzt die Spalte wie bisher auf NULL.
--  * Ein erneuter Check-in eines schon Anwesenden (PIN am Eingangs-Tablet =
--    kiosk_checkin, Anwesenheits-Panel = panel_set_presence) setzte
--    last_scan_at neu. _war_beim_aufguss (0195) wertet last_scan_at bei
--    Anwesenden als „seit wann da" (last_scan_at <= Ende) — Glocke
--    (cron_notify_rating_window_open) und Web-Push (rating_pending_reminders)
--    für gerade beendete Aufgüsse fielen damit weg. Umgekehrt schob ein
--    veraltetes Panel beim schon Abwesenden „abwesend" den Zeitstempel vor:
--    falsche Erinnerung für verpasste Aufgüsse und neu startende 3-h-Sperre
--    beim WLAN-Auto-Check-in.
--    Neu: Beide schreiben last_scan_at nur noch bei echtem Wechsel — wie
--    set_my_presence, auto_checkin_via_wifi und die *_kiosk_intern-Wege. Die
--    Einschränkung im Kommentar zu _war_beim_aufguss (0195: „Ein
--    Kiosk-Check-in setzt last_scan_at auch bei schon Anwesenden neu …")
--    gilt damit nicht mehr; die Funktion selbst bleibt unverändert.
--  * log_attendance_on_checkin schrieb attendance_events.date = CURRENT_DATE.
--    Die Datenbank läuft in UTC (TimeZone = UTC, keine Rollen-Abweichung) —
--    ein Check-in zwischen 00:00 und 02:00 Berliner Zeit (Winter: bis 01:00)
--    bekam den Vortag. Alle Leser vergleichen aber mit dem Berliner Tag
--    (submit_rating, get_ratable_infusions, kiosk_submit_rating,
--    telegram_quick_rate, _war_beim_aufguss, cron_notify_rating_window_open,
--    datenschutz_aufraeumen): Bewerten wäre dort gescheitert. Neu: Besuchstag
--    nach Berliner Kalender. Bestehende Zeilen bleiben unverändert (live
--    geprüft: alle 744 Zeilen haben bereits den Berliner Tag, weil es bisher
--    keinen Check-in in diesem Fenster gab).
--
-- Signaturen und Rechte bleiben gleich (CREATE OR REPLACE behält die ACL);
-- die Rechte werden unten trotzdem ausdrücklich gesetzt.
-- ---------------------------------------------------------------------


-- ─── 1) _aufguss_ans_personal: Feed-Beiträge lösen ────────────────────────
-- Vorlage: Live-Fassung aus 0184 (pg_get_functiondef, 25.09.2026).

CREATE OR REPLACE FUNCTION public._aufguss_ans_personal(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_n int := 0;
begin
  begin
    update public.infusions
       set saunameister_id      = null,
           is_personal_fallback = true,
           title                = 'Klassischer Aufguss durch das Personal mit naturreinen Stoffen',
           description          = null,
           oils                 = null,
           attributes           = '{}',
           image_path           = null,
           team_infusion        = false,
           template_id          = null,
           duration_minutes     = 15,
           telegram_takeover_announced_at = null
     where id = p_id;
    get diagnostics v_n = row_count;
  exception when others then
    begin
      update public.infusions
         set saunameister_id      = null,
             is_personal_fallback = true,
             title                = 'Klassischer Aufguss durch das Personal mit naturreinen Stoffen',
             description          = null,
             oils                 = null,
             attributes           = '{}',
             image_path           = null,
             team_infusion        = false,
             template_id          = null,
             telegram_takeover_announced_at = null
       where id = p_id;
      get diagnostics v_n = row_count;
    exception when others then
      raise notice '_aufguss_ans_personal: % bleibt unverändert (%)', p_id, sqlerrm;
      return false;
    end;
  end;
  if v_n = 0 then return false; end if;
  -- Ein Personal-Slot hat keine Team-Plätze.
  delete from public.infusion_co_aufgieser where infusion_id = p_id;
  -- Beiträge zum bisherigen Aufguss gehören nicht zum Platzhalter und schon
  -- gar nicht zu dem, der ihn später übernimmt. Wirkung wie früher das
  -- DELETE samt ON DELETE SET NULL: Beitrag bleibt, Verknüpfung weg.
  update public.feed_posts set infusion_id = null where infusion_id = p_id;
  return true;
end;
$function$;
REVOKE ALL ON FUNCTION public._aufguss_ans_personal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._aufguss_ans_personal(uuid) TO service_role;


-- ─── 2) kiosk_checkin: last_scan_at nur beim echten Einchecken ────────────
-- Vorlage: Live-Fassung (pg_get_functiondef, 25.09.2026).
-- Im UPDATE meint is_present den alten Wert der Zeile. Der CASE statt einer
-- Vorab-Prüfung hält auch bei zwei gleichzeitigen PIN-Eingaben: die zweite
-- wartet auf die Zeilensperre und sieht dann den neuen Stand.

CREATE OR REPLACE FUNCTION public.kiosk_checkin(p_pin text)
 RETURNS TABLE(member_id uuid, name text, war_schon_da boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_id uuid; v_war boolean; v_name text;
BEGIN
  v_id := public.mitglied_zu_pin(p_pin);
  IF v_id IS NULL THEN RAISE EXCEPTION 'pin_unbekannt'; END IF;

  SELECT m.is_present, m.name INTO v_war, v_name FROM public.members m WHERE m.id = v_id;

  -- Schon Anwesende behalten ihr „seit" — _war_beim_aufguss braucht den
  -- echten Check-in-Zeitpunkt für die Bewertungs-Erinnerungen.
  UPDATE public.members
     SET is_present   = true,
         last_scan_at = CASE WHEN is_present THEN last_scan_at ELSE now() END
   WHERE id = v_id;

  RETURN QUERY SELECT v_id, v_name, coalesce(v_war, false);
END; $function$;
REVOKE ALL ON FUNCTION public.kiosk_checkin(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_checkin(text) TO service_role;


-- ─── 3) panel_set_presence: last_scan_at nur bei echtem Wechsel ───────────
-- Vorlage: Live-Fassung (pg_get_functiondef, 25.09.2026). Das Panel läuft
-- anonym auf dem gekoppelten Gerät — anon behält das Ausführungsrecht.

CREATE OR REPLACE FUNCTION public.panel_set_presence(p_member_id uuid, p_present boolean, p_panel_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_needs_family boolean;
BEGIN
  IF NOT public._panel_geraet_ok(p_panel_password) THEN
    RAISE EXCEPTION 'invalid_password' USING ERRCODE = 'P0001';
  END IF;
  -- Nur ein echter Wechsel bekommt einen neuen Zeitstempel (wie
  -- set_my_presence). Ein veraltetes Panel, das „anwesend" für einen schon
  -- Anwesenden oder „abwesend" für einen schon Abwesenden schickt, lässt
  -- last_scan_at stehen.
  UPDATE public.members
     SET is_present   = COALESCE(p_present, false),
         last_scan_at = CASE WHEN is_present IS DISTINCT FROM COALESCE(p_present, false)
                             THEN now() ELSE last_scan_at END
   WHERE id = p_member_id AND revoked_at IS NULL AND approved = true
   RETURNING (family_has_partner OR family_children_count > 0) INTO v_needs_family;
  IF NOT FOUND THEN RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object(
    'ok', true, 'member_id', p_member_id,
    'is_present', COALESCE(p_present, false),
    'needs_family_modal', COALESCE(v_needs_family, false)
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.panel_set_presence(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.panel_set_presence(uuid, boolean, text) TO anon, authenticated, service_role;


-- ─── 4) log_attendance_on_checkin: Besuchstag nach Berliner Kalender ──────
-- Vorlage: Live-Fassung (pg_get_functiondef, 25.09.2026). Trigger-Funktion
-- (members_log_attendance), bleibt SECURITY INVOKER wie bisher.

CREATE OR REPLACE FUNCTION public.log_attendance_on_checkin()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.is_present = true AND (OLD.is_present = false OR OLD.is_present IS NULL) THEN
    -- Berliner Tag, nicht CURRENT_DATE: die Datenbank läuft in UTC, alle
    -- Leser vergleichen mit (… AT TIME ZONE 'Europe/Berlin')::date.
    INSERT INTO attendance_events (member_id, date)
    VALUES (NEW.id, (now() AT TIME ZONE 'Europe/Berlin')::date)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $function$;
