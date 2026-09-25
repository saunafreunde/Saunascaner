-- 0185_cron_datenpflege.sql — Cron und Datenpflege (Audit 25.09.2026, Gruppe G1)
--
-- 1) Anwesenheit nachts räumen — zeitumstellungsfest und mit Protokoll.
--    Bisher: 'hard_logout_after_midnight' lief fest um 22:30 UTC (pg_cron rechnet
--    in UTC). Das ist 00:30 nur in der Sommerzeit; ab dem 25.10. wäre es 23:30 —
--    genau dann, wenn beim Saunafest (14.11., 12.12., 09.01., 13.02., 13.03.) die
--    letzten Aufgüsse starten. Alle Anwesenden wären aus der Evakuierungsliste
--    gefallen. Außerdem räumte der Job ohne Protokoll, sodass
--    'reset-presence-nightly' (02:00 UTC) nie mehr jemanden fand: presence_audit
--    bekam seit 29.05. keine Zeile mehr, die Admin-Statistik „Anwesenheit" blieb leer.
--    Neu: EIN Job 'anwesenheit-nachtreset' läuft stündlich um :30 zwischen
--    22:30 und 03:30 UTC. Die Funktion prüft selbst die Berliner Uhrzeit:
--    - 00:00–03:59 Ortszeit: räumen, sobald das Öffnungsfenster des Vorabends
--      (kiosk_oeffnung, beim Saunafest bis 01:00) vorbei ist → normal 00:30,
--      Saunafest 01:30;
--    - 04:xx Ortszeit: räumen immer (Rückfallebene);
--    - sonst nichts.
--    Geräumt wird über reset_presence_nightly() → presence_audit wird wieder
--    geschrieben. Die alten Jobs 'hard_logout_after_midnight' und
--    'reset-presence-nightly' entfallen.
-- 2) stats_presence_by_day zählt nach Berliner Besuchsabend (Räumung nach
--    Mitternacht zählt zum Vorabend) und bleibt Admins vorbehalten.
-- 3) notification_queue: Doppelte Einträge verhindern, auch wenn die erste Zeile
--    schon verarbeitet ist (der Unique-Index gilt nur für unverarbeitete Zeilen,
--    die Queue verarbeitet jede Minute). Gezielt je Erzeuger, der Index bleibt:
--    - Bewertungs-Erinnerung: je Aufguss und Person genau eine;
--    - Fan-Ablauf-Erinnerung: je Mitglied und Ablaufdatum genau eine;
--    - „Neuer Fan": je Paar höchstens eine in 30 Tagen (Entfolgen/Folgen-Spam);
--    - Vereins-Postfach: Empfänger im Schlüssel. Vorher bekamen alle Postfach-
--      Admins denselben Schlüssel → Unique-Verletzung → das ganze Ticket wurde
--      zurückgerollt; das Ticketsystem legte nie ein Ticket an. Zusätzlich:
--      schon bekannte Mails (der Abruf holt immer die letzten 50) werden nicht
--      noch einmal gezählt und öffnen beantwortete Tickets nicht wieder; über
--      alte Mails (älter als 3 Tage) wird niemand benachrichtigt, damit der
--      erste Abruf nach dem Fix keine Flut auslöst. Neuer Parameter
--      p_received_at (Eingangszeit der Mail, api/postfach.ts).
-- 4) Bewertungs-Erinnerungen verfallen: wer bewertet, dessen Erinnerung gilt
--    sofort als gelesen (Trigger); der 5-Minuten-Cron schließt außerdem
--    Erinnerungen, deren Bewertungsfenster abgelaufen ist, die schon bewertet
--    sind oder an Mit-Aufgießer gingen (je Lauf höchstens 500 → der Altbestand
--    von rund 4.000 Zeilen verteilt sich über gut 40 Minuten, statt auf einen
--    Schlag 4.000 Realtime-Ereignisse zu erzeugen). Mit-Aufgießer bekommen keine
--    Erinnerung mehr (Hinweis Gruppe A) — auch nicht per Push-Erinnerung.
-- 5) Heatmap der anonymen Bewertungen (CP) nach Berliner Zeit statt UTC; das
--    Abzeichen „Adlerauge" (gleicher Tag) rechnet ebenfalls mit Berliner Datum.
-- 6) cron.job_run_details wird täglich aufgeräumt (älter als 7 Tage). Die
--    Tabelle war mit 282.000 Zeilen / 106 MB über die Hälfte der Datenbank.
--    Hinweis: Die Datei schrumpft dadurch nicht (VACUUM FULL darf postgres
--    dort nicht), sie wächst aber nicht mehr.
--
-- Rechte: wie in 0181 (Gruppe C) vorgesehen, hier ausdrücklich wiederholt,
-- weil CREATE OR REPLACE die ACL behält und diese Migration auch ohne 0181
-- stimmen soll.


-- ─── 1) Anwesenheit nachts räumen ──────────────────────────────────────────
-- p_jetzt nur für Tests (Zeitpunkt vorgeben); der Cron ruft ohne Argument.
-- Rückgabe: true = Räumung ausgeführt (auch wenn niemand mehr anwesend war).
CREATE OR REPLACE FUNCTION public.anwesenheit_nachtreset(p_jetzt timestamp with time zone DEFAULT now())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_lokal  timestamp := p_jetzt AT TIME ZONE 'Europe/Berlin';
  v_stunde int       := extract(hour FROM (p_jetzt AT TIME ZONE 'Europe/Berlin'))::int;
  v_ende   timestamptz;
BEGIN
  -- Nur nachts zwischen 00:00 und 04:59 Berliner Zeit.
  IF v_stunde > 4 THEN
    RETURN false;
  END IF;

  -- Bis 03:59 erst räumen, wenn das Öffnungsfenster des Vorabends vorbei ist
  -- (Saunafest: letzter Aufguss 23:30, Fenster bis 01:00). Ab 04:00 immer.
  IF v_stunde < 4 THEN
    BEGIN
      SELECT k.bis INTO v_ende FROM public.kiosk_oeffnung(v_lokal::date - 1) k;
    EXCEPTION WHEN OTHERS THEN
      -- Im Zweifel lieber später räumen: die Liste ist die Evakuierungsliste.
      RAISE WARNING 'anwesenheit_nachtreset: kiosk_oeffnung fehlgeschlagen (%), geräumt wird um 04:30', SQLERRM;
      RETURN false;
    END;
    IF v_ende IS NOT NULL AND p_jetzt < v_ende THEN
      RETURN false;
    END IF;
  END IF;

  -- Schreibt presence_audit (nur wenn jemand anwesend ist) und setzt is_present zurück.
  PERFORM public.reset_presence_nightly();
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.anwesenheit_nachtreset(timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anwesenheit_nachtreset(timestamp with time zone) TO service_role;

DO $$ BEGIN PERFORM cron.unschedule('hard_logout_after_midnight'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('reset-presence-nightly');     EXCEPTION WHEN OTHERS THEN NULL; END $$;
-- 22:30–03:30 UTC deckt 00:30–04:30 Berliner Zeit in Sommer- UND Winterzeit ab;
-- die Läufe außerhalb davon (23:30 bzw. 05:30 Ortszeit) tun nichts.
SELECT cron.schedule('anwesenheit-nachtreset', '30 22,23,0,1,2,3 * * *',
  $$ select public.anwesenheit_nachtreset(); $$);


-- ─── 2) Anwesenheits-Statistik nach Berliner Besuchsabend ──────────────────
-- Eine Räumung zwischen 00:00 und 04:59 Ortszeit gehört zum Vorabend (-5 h).
-- p_from/p_to: Admin → Statistik übergibt Monats-/Jahresgrenzen; gezählt wird
-- jeder Besuchsabend, dessen Berliner Datum in [p_from, p_to) liegt.
CREATE OR REPLACE FUNCTION public.stats_presence_by_day(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS TABLE(day date, count bigint)
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
  SELECT b.abend, sum(b.reset_count)::bigint
    FROM (SELECT ((a.reset_at AT TIME ZONE 'Europe/Berlin') - interval '5 hours')::date AS abend,
                 a.reset_count
            FROM public.presence_audit a
           WHERE a.reset_at >= p_from - interval '1 day'
             AND a.reset_at <  p_to   + interval '2 days') b
   WHERE b.abend >= (p_from AT TIME ZONE 'Europe/Berlin')::date
     AND b.abend <  (p_to   AT TIME ZONE 'Europe/Berlin')::date
   GROUP BY b.abend
   ORDER BY b.abend;
END;
$function$;
REVOKE ALL ON FUNCTION public.stats_presence_by_day(timestamp with time zone, timestamp with time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stats_presence_by_day(timestamp with time zone, timestamp with time zone) TO authenticated, service_role;


-- ─── 3) notification_queue: Nachschlage-Indizes ────────────────────────────
-- Nicht eindeutig: dient nur dem NOT EXISTS über ALLE Zeilen (auch verarbeitete).
CREATE INDEX IF NOT EXISTS idx_notification_queue_dedup_lookup
  ON public.notification_queue (dedup_key) WHERE dedup_key IS NOT NULL;
-- Offene Bewertungs-Erinnerungen für den Verfall im 5-Minuten-Cron.
CREATE INDEX IF NOT EXISTS idx_notification_queue_erinnerung_offen
  ON public.notification_queue (created_at) WHERE kind = 'rating_reminder' AND read_at IS NULL;


-- ─── 3a+4) Bewertungs-Erinnerung (pg_cron 'notify_rating_window', */5) ─────
CREATE OR REPLACE FUNCTION public.cron_notify_rating_window_open()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_count int := 0;
begin
  insert into public.notification_queue(kind, recipient_id, payload, dedup_key)
  select distinct
    'rating_reminder',
    a.member_id,
    jsonb_build_object(
      'title', '⭐ Wie war dein Aufguss?',
      'body',  coalesce(i.title, 'Aufguss') || ' — jetzt bewerten in der App',
      'infusion_id', i.id,
      'sauna_id', i.sauna_id,
      'saunameister_id', i.saunameister_id,
      'end_time', i.end_time
    ),
    'rating:' || i.id::text || ':' || a.member_id::text
  from public.infusions i
  join public.attendance_events a
    on a.date = (i.start_time at time zone 'Europe/Berlin')::date
   and a.member_id <> i.saunameister_id
  where i.end_time between now() - interval '10 minutes' and now() - interval '2 minutes'
    and i.saunameister_id is not null
    -- Mit-Aufgießer dürfen ihren eigenen Aufguss nicht bewerten.
    and not public.hat_mitgewedelt(i.id, a.member_id)
    and not exists (
      select 1 from public.infusion_ratings r
       where r.infusion_id = i.id and r.member_id = a.member_id
    )
    -- Dauerhaft je Aufguss und Person nur EINE Erinnerung — auch wenn die
    -- erste schon verarbeitet ist.
    and not exists (
      select 1 from public.notification_queue q
       where q.dedup_key = 'rating:' || i.id::text || ':' || a.member_id::text
    )
  on conflict do nothing;
  get diagnostics v_count = row_count;

  -- Verfall: Erinnerungen, die nichts mehr bewirken können, gelten als gelesen
  -- (sonst zeigt die Glocke dauerhaft „9+"). Fenster wie submit_rating:
  -- Aufgießer 3 Stunden nach Ende, alle anderen bis 12:00 am Folgetag.
  update public.notification_queue q
     set read_at = now()
   where q.id in (
     select q2.id
       from public.notification_queue q2
       left join public.infusions i
         on i.id = case when (q2.payload->>'infusion_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                        then (q2.payload->>'infusion_id')::uuid end
      where q2.kind = 'rating_reminder'
        and q2.read_at is null
        and (
          i.id is null
          or q2.recipient_id is null
          or exists (select 1 from public.infusion_ratings r
                      where r.infusion_id = i.id and r.member_id = q2.recipient_id)
          or public.hat_mitgewedelt(i.id, q2.recipient_id)
          or now() > case
               when public.is_aufgieser_for(q2.recipient_id)
                 then coalesce(i.end_time, i.start_time) + interval '3 hours'
               else (date_trunc('day', i.start_time at time zone 'Europe/Berlin')
                     + interval '1 day 12 hours') at time zone 'Europe/Berlin'
             end
        )
      order by q2.created_at
      limit 500
   );

  return v_count;
end$function$;
REVOKE ALL ON FUNCTION public.cron_notify_rating_window_open() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_notify_rating_window_open() TO service_role;

-- Wer bewertet, dessen Erinnerung zu diesem Aufguss ist erledigt.
CREATE OR REPLACE FUNCTION public.bewertungs_erinnerung_erledigt()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.notification_queue
     SET read_at = now()
   WHERE recipient_id = NEW.member_id
     AND kind = 'rating_reminder'
     AND read_at IS NULL
     AND payload->>'infusion_id' = NEW.infusion_id::text;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.bewertungs_erinnerung_erledigt() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bewertungs_erinnerung_erledigt ON public.infusion_ratings;
CREATE TRIGGER trg_bewertungs_erinnerung_erledigt
  AFTER INSERT ON public.infusion_ratings
  FOR EACH ROW EXECUTE FUNCTION public.bewertungs_erinnerung_erledigt();

-- Push-Erinnerung (api/push-reminder-cron.ts): ebenfalls ohne Mit-Aufgießer.
CREATE OR REPLACE FUNCTION public.rating_pending_reminders()
 RETURNS TABLE(member_id uuid, member_name text, infusion_id uuid, infusion_title text, end_time timestamp with time zone, meister_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT DISTINCT m.id, m.name, i.id, i.title, i.end_time,
    COALESCE((SELECT name FROM members WHERE id = i.saunameister_id), 'Saunameister:in') AS meister_name
  FROM members m
  CROSS JOIN infusions i
  WHERE m.approved = true AND m.revoked_at IS NULL AND m.is_present = true
    AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.member_id = m.id)
    AND i.end_time < NOW()
    AND i.end_time > NOW() - INTERVAL '3 hours'
    AND i.saunameister_id IS NOT NULL
    AND i.saunameister_id <> m.id
    AND NOT public.hat_mitgewedelt(i.id, m.id)
    AND NOT EXISTS (
      SELECT 1 FROM infusion_ratings r WHERE r.member_id = m.id AND r.infusion_id = i.id
    );
$function$;
REVOKE ALL ON FUNCTION public.rating_pending_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rating_pending_reminders() TO service_role;


-- ─── 3b) Fan-Ablauf-Erinnerung (pg_cron täglich 09:00 UTC) ─────────────────
-- 'BETWEEN 27 AND 28' bleibt als Puffer für einen ausgefallenen Lauf; das
-- NOT EXISTS über alle Zeilen sorgt für genau eine Erinnerung je Ablaufdatum.
CREATE OR REPLACE FUNCTION public.process_fan_membership_expiry()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- 4-Wochen-Erinnerung: genau einmal je Mitglied und Ablaufdatum
  INSERT INTO public.notification_queue(kind, payload, recipient_id, dedup_key)
  SELECT 'fan_membership_expiring',
         jsonb_build_object('paid_until', m.paid_until::text, 'days_left', (m.paid_until - current_date)),
         m.id,
         'fan_expiry_4w_' || m.id::text || '_' || m.paid_until::text
  FROM public.members m
  WHERE m.role = 'fan'
    AND m.paid_until IS NOT NULL
    AND m.paid_until - current_date BETWEEN 27 AND 28  -- ~4 Wochen vor Ablauf
    AND NOT EXISTS (
      SELECT 1 FROM public.notification_queue q
       WHERE q.dedup_key = 'fan_expiry_4w_' || m.id::text || '_' || m.paid_until::text
    )
  ON CONFLICT DO NOTHING;

  -- Fallback auf Gast nach 30 Tagen Karenz (paid_until + 30 Tage erreicht)
  UPDATE public.members
  SET role = 'gast',
      paid_until = NULL,
      fan_address = NULL
      -- fan_since wird bewusst behalten (Historie: war mal Fan)
  WHERE role = 'fan'
    AND paid_until IS NOT NULL
    AND paid_until + INTERVAL '30 days' <= current_date;
END;
$function$;
REVOKE ALL ON FUNCTION public.process_fan_membership_expiry() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_fan_membership_expiry() TO service_role;


-- ─── 3c) „Neuer Fan" (Trigger trg_notify_new_follower auf member_follows) ──
-- Entfolgen + erneut Folgen erzeugt innerhalb von 30 Tagen keinen neuen Eintrag.
CREATE OR REPLACE FUNCTION public._notify_new_follower()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_follower_name text;
BEGIN
  SELECT name INTO v_follower_name FROM public.members WHERE id = NEW.follower_id;
  INSERT INTO public.notification_queue(kind, recipient_id, payload, dedup_key)
  SELECT 'new_follower', NEW.followee_id,
    jsonb_build_object('title','🌟 Neuer Fan',
      'body', coalesce(v_follower_name,'Jemand') || ' folgt dir jetzt.',
      'follower_id', NEW.follower_id, 'follower_name', v_follower_name),
    'new_follower:' || NEW.follower_id::text || ':' || NEW.followee_id::text
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notification_queue
    WHERE dedup_key = 'new_follower:' || NEW.follower_id::text || ':' || NEW.followee_id::text
      AND created_at > now() - interval '30 days'
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $function$;


-- ─── 3d) Vereins-Postfach: Ticket aus eingehender Mail ─────────────────────
-- Neue Signatur (p_received_at) → alte Fassung entfernen, sonst wäre der
-- Aufruf mit fünf Argumenten mehrdeutig. Einziger Aufrufer: api/postfach.ts
-- (poll-shared-tickets, service_role).
DROP FUNCTION IF EXISTS public.email_ticket_upsert_from_inbound(uuid, text, text, text, bigint);

CREATE OR REPLACE FUNCTION public.email_ticket_upsert_from_inbound(
  p_account_id uuid,
  p_thread_key text,
  p_subject text,
  p_from text,
  p_imap_uid bigint,
  p_received_at timestamp with time zone DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_ticket_id uuid; v_was_inserted boolean := false; v_was_reopened boolean := false;
        v_old_status public.email_ticket_status; v_key text; v_last_uid bigint;
        v_eingang timestamptz := least(coalesce(p_received_at, now()), now());
BEGIN
  v_key := lower(regexp_replace(coalesce(p_thread_key, ''), '[<>\s]', '', 'g'));
  IF length(v_key) = 0 THEN RAISE EXCEPTION 'empty_thread_key'; END IF;
  SELECT id, status, last_imap_uid INTO v_ticket_id, v_old_status, v_last_uid
    FROM public.email_tickets
   WHERE account_id = p_account_id AND thread_key = v_key
   FOR UPDATE;
  IF v_ticket_id IS NULL THEN
    INSERT INTO public.email_tickets(account_id, thread_key, subject, from_address, status,
      last_inbound_at, last_imap_uid, message_count)
    VALUES (p_account_id, v_key, p_subject, p_from, 'open', v_eingang, p_imap_uid, 1)
    RETURNING id INTO v_ticket_id;
    v_was_inserted := true;
  ELSE
    -- Der Abruf holt jedes Mal die letzten 50 Mails. Eine Mail, die das Ticket
    -- schon kennt (UID nicht größer als die zuletzt gesehene), zählt nicht noch
    -- einmal und öffnet ein beantwortetes Ticket nicht wieder.
    IF p_imap_uid IS NOT NULL AND p_imap_uid <= coalesce(v_last_uid, 0) THEN
      RETURN v_ticket_id;
    END IF;
    UPDATE public.email_tickets
      SET subject = coalesce(p_subject, subject),
          from_address = coalesce(p_from, from_address),
          last_inbound_at = greatest(coalesce(last_inbound_at, v_eingang), v_eingang),
          last_imap_uid = greatest(coalesce(last_imap_uid, 0), coalesce(p_imap_uid, 0)),
          message_count = message_count + 1,
          status = CASE
            WHEN v_old_status = 'closed' THEN 'open'::public.email_ticket_status
            WHEN v_old_status = 'answered' THEN 'open'::public.email_ticket_status
            ELSE v_old_status END,
          closed_at = CASE WHEN v_old_status = 'closed' THEN NULL ELSE closed_at END
     WHERE id = v_ticket_id;
    v_was_reopened := (v_old_status IN ('closed','answered'));
  END IF;
  -- Benachrichtigen nur bei neuer Mail oder Wieder-Öffnen — und nur für Mails
  -- der letzten 3 Tage (der erste Abruf nach längerer Pause soll keine Flut
  -- alter Mails melden). Schlüssel je Empfänger: der Unique-Index auf dedup_key
  -- hätte sonst beim zweiten Admin das ganze Ticket zurückgerollt.
  IF (v_was_inserted OR v_was_reopened) AND v_eingang > now() - interval '3 days' THEN
    INSERT INTO public.notification_queue(kind, recipient_id, payload, dedup_key)
    SELECT 'shared_email_inbound', s.member_id,
      jsonb_build_object('title','📧 Neue Vereins-Mail',
        'body', coalesce(p_from,'Unbekannt') || ': ' || coalesce(left(p_subject,80),'(kein Betreff)'),
        'account_id', p_account_id, 'ticket_id', v_ticket_id, 'reopened', v_was_reopened),
      'shared_email:' || v_ticket_id::text || ':' || coalesce(p_imap_uid,0)::text || ':' || s.member_id::text
    FROM public.shared_email_admins s
    WHERE s.account_id = p_account_id
      AND NOT EXISTS (
        SELECT 1 FROM public.notification_queue q
        WHERE q.dedup_key = 'shared_email:' || v_ticket_id::text || ':' || coalesce(p_imap_uid,0)::text
                            || ':' || s.member_id::text)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN v_ticket_id;
END; $function$;
REVOKE ALL ON FUNCTION public.email_ticket_upsert_from_inbound(uuid, text, text, text, bigint, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_ticket_upsert_from_inbound(uuid, text, text, text, bigint, timestamp with time zone) TO service_role;


-- ─── 5) Heatmap (CP) und „Adlerauge" in Berliner Zeit ──────────────────────
-- Datumsfilter als halboffenes Intervall über Berliner Mitternächte.
CREATE OR REPLACE FUNCTION public.list_ratings_anonymous(p_from date, p_to date)
 RETURNS TABLE(sauna_id uuid, sauna_name text, weekday smallint, hour_of_day smallint, rating_count bigint, avg_chemie numeric, avg_luftbewegung numeric, avg_wedeltechnik numeric, avg_hitzeniveau numeric, avg_musik numeric, avg_duftentwicklung numeric, avg_overall numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select
    i.sauna_id, s.name,
    extract(dow  from i.start_time at time zone 'Europe/Berlin')::smallint,
    extract(hour from i.start_time at time zone 'Europe/Berlin')::smallint,
    count(r.id),
    round(avg(r.chemie)::numeric, 2),
    round(avg(r.luftbewegung)::numeric, 2),
    round(avg(r.wedeltechnik)::numeric, 2),
    round(avg(r.hitzeniveau)::numeric, 2),
    round(avg(r.musik)::numeric, 2),
    round(avg(r.duftentwicklung)::numeric, 2),
    round(((avg(r.chemie) + avg(r.luftbewegung) + avg(r.wedeltechnik)
          + avg(r.hitzeniveau) + avg(r.musik) + avg(r.duftentwicklung)) / 6)::numeric, 2)
  from public.infusion_ratings r
  join public.infusions i on i.id = r.infusion_id
  join public.saunas s    on s.id = i.sauna_id
  where i.start_time >= (p_from::timestamp at time zone 'Europe/Berlin')
    and i.start_time <  ((p_to + 1)::timestamp at time zone 'Europe/Berlin')
    and (public.is_personal_planer() or public.is_admin())
  group by i.sauna_id, s.name,
           extract(dow  from i.start_time at time zone 'Europe/Berlin'),
           extract(hour from i.start_time at time zone 'Europe/Berlin');
$function$;
REVOKE ALL ON FUNCTION public.list_ratings_anonymous(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_ratings_anonymous(date, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.check_rating_achievements()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_count int;
  v_distinct_meister int;
  v_distinct_saunas int;
  v_infusion_date date;
  v_rated_date date := (new.created_at at time zone 'Europe/Berlin')::date;
  v_same_day int;
begin
  select count(*) into v_count from public.infusion_ratings where member_id = new.member_id;
  if v_count = 1   then perform public.award_badge_if_not_exists(new.member_id, 'first_rating'); end if;
  if v_count = 10  then perform public.award_badge_if_not_exists(new.member_id, 'feedback_giver'); end if;
  if v_count = 50  then perform public.award_badge_if_not_exists(new.member_id, 'feedback_pro'); end if;
  if v_count = 100 then perform public.award_badge_if_not_exists(new.member_id, 'feedback_top'); end if;

  select count(distinct i.saunameister_id)
    into v_distinct_meister
    from public.infusion_ratings r
    join public.infusions i on i.id = r.infusion_id
   where r.member_id = new.member_id and i.saunameister_id is not null;
  if v_distinct_meister >= 3  then perform public.award_badge_if_not_exists(new.member_id, 'curious'); end if;
  if v_distinct_meister >= 10 then perform public.award_badge_if_not_exists(new.member_id, 'vielsauner'); end if;
  if v_distinct_meister >= 25 then perform public.award_badge_if_not_exists(new.member_id, 'connaisseur'); end if;

  select count(distinct i.sauna_id)
    into v_distinct_saunas
    from public.infusion_ratings r
    join public.infusions i on i.id = r.infusion_id
   where r.member_id = new.member_id;
  if v_distinct_saunas >= 3 then perform public.award_badge_if_not_exists(new.member_id, 'sauna_allrounder'); end if;

  select (i.start_time at time zone 'Europe/Berlin')::date into v_infusion_date
    from public.infusions i where i.id = new.infusion_id;
  if v_infusion_date = v_rated_date then
    select count(*) into v_same_day
      from public.infusion_ratings r
      join public.infusions i on i.id = r.infusion_id
     where r.member_id = new.member_id
       and (r.created_at at time zone 'Europe/Berlin')::date = (i.start_time at time zone 'Europe/Berlin')::date;
    if v_same_day >= 10 then perform public.award_badge_if_not_exists(new.member_id, 'eagle_eye'); end if;
  end if;

  return new;
end$function$;


-- ─── 6) Cron-Verlauf aufräumen ─────────────────────────────────────────────
-- Täglich 03:17 UTC; start_time statt end_time, damit auch abgebrochene Läufe
-- (end_time NULL) verschwinden. Der erste Lauf löscht den Altbestand in einem Zug.
SELECT cron.schedule('cron-verlauf-aufraeumen', '17 3 * * *',
  $$ DELETE FROM cron.job_run_details WHERE start_time < now() - interval '7 days'; $$);


-- ─── 7) Selbstprüfung ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname IN ('hard_logout_after_midnight', 'reset-presence-nightly')) THEN
    RAISE EXCEPTION '0185: alte Anwesenheits-Jobs sind noch eingeplant';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'anwesenheit-nachtreset'
                  AND schedule = '30 22,23,0,1,2,3 * * *' AND active) THEN
    RAISE EXCEPTION '0185: Job anwesenheit-nachtreset fehlt';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cron-verlauf-aufraeumen' AND active) THEN
    RAISE EXCEPTION '0185: Job cron-verlauf-aufraeumen fehlt';
  END IF;
  IF has_function_privilege('anon', 'public.anwesenheit_nachtreset(timestamp with time zone)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.anwesenheit_nachtreset(timestamp with time zone)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.cron_notify_rating_window_open()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.cron_notify_rating_window_open()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.process_fan_membership_expiry()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.process_fan_membership_expiry()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.rating_pending_reminders()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.rating_pending_reminders()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.email_ticket_upsert_from_inbound(uuid, text, text, text, bigint, timestamp with time zone)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.stats_presence_by_day(timestamp with time zone, timestamp with time zone)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.list_ratings_anonymous(date, date)', 'EXECUTE') THEN
    RAISE EXCEPTION '0185: Rechte stimmen nicht (interne Funktion für anon/authenticated ausführbar)';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.stats_presence_by_day(timestamp with time zone, timestamp with time zone)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.list_ratings_anonymous(date, date)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.email_ticket_upsert_from_inbound(uuid, text, text, text, bigint, timestamp with time zone)', 'EXECUTE') THEN
    RAISE EXCEPTION '0185: Rechte stimmen nicht (Aufrufer ausgesperrt)';
  END IF;
END $$;
