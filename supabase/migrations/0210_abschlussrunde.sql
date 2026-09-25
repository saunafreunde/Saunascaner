-- 0210_abschlussrunde.sql — Abschlussrunde des Audits (Runde 5, 25.09.2026)
--
-- Befunde aus der Kontrolle der Runde-4-Reparaturen (0207–0209):
--  1) Vereinspostfach: Wer ein BEANTWORTETES Ticket nur ansieht, setzte es über
--     email_ticket_lock auf „In Bearbeitung" und beim Verlassen (unlock) auf
--     „Offen" zurück. Danach fehlte die Meldung bei einem Nachtrag, und die
--     24-Monats-Frist (nur geschlossene/beantwortete) griff nicht mehr.
--     Jetzt wie im Zweig für die eigene Sperre: nur 'open' → 'in_progress'.
--  2) Vereinspostfach: Antwortete dieselbe Person ein zweites Mal auf dieselbe
--     Vereinsmail, entstand jedes Mal ein neues Ticket. Neue Richtung 'bezug'
--     in email_ticket_nachrichten: ein neues Ticket merkt sich seine Bezüge
--     (References/In-Reply-To) mit dem Absender; Schritt 2 der Zuordnung
--     berücksichtigt sie für DENSELBEN Absender.
--  3) Spiele: Kontolöschung (Gast löscht sich, Admin löscht) räumte Partien
--     nicht ab — player_b ON DELETE SET NULL ließ laufende Partien eingefroren
--     und machte Einladungen zu öffentlichen „X wartet"-Tischen. Der Aufräum-
--     Teil aus 0209 steckt jetzt im Helfer _spiele_konto_raeumen(p_id); ihn
--     rufen der Sperr-Trigger (0209) und ein neuer BEFORE-DELETE-Trigger.
-- Nach Gegenprüfung: gemerkte Bezüge zählen nicht als „schon abgerufen"
-- (v_schon_gesehen), und eine Mail, die erst nach einer Antwort auf sie
-- eintrifft, wird von 'bezug' zur Eingangs-Zeile.
-- Frontend-Teile derselben Runde: Alarm-Vollbild erkennt einen hängenden
-- Telegram-Nachversand, Spiele zeigen „Partie abgebrochen", Datenschutz-
-- hinweise nennen die Empfängeradressen von App-Antworten (Fassung .4).

-- ─── 1) email_ticket_lock (Vorlage: Live-Fassung) ─────────────────────────
CREATE OR REPLACE FUNCTION public.email_ticket_lock(p_ticket_id uuid, p_force boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_me uuid; v_row public.email_tickets%rowtype; v_lock_age interval;
BEGIN
  SELECT id INTO v_me FROM public.members WHERE auth_user_id = auth.uid();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_row FROM public.email_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_not_found'; END IF;
  IF NOT public._is_shared_email_admin(v_row.account_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  IF v_row.locked_by = v_me THEN
    UPDATE public.email_tickets
      SET locked_at = now(),
          status = CASE WHEN v_row.status = 'open' THEN 'in_progress'::public.email_ticket_status ELSE v_row.status END
     WHERE id = p_ticket_id;
    RETURN;
  END IF;
  IF v_row.locked_by IS NOT NULL AND v_row.locked_at IS NOT NULL THEN
    v_lock_age := now() - v_row.locked_at;
    IF v_lock_age < interval '10 minutes' AND NOT coalesce(p_force, false) THEN
      RAISE EXCEPTION 'lock_held' USING DETAIL = v_row.locked_by::text;
    END IF;
  END IF;
  -- 0210: Ein beantwortetes (oder geschlossenes) Ticket bleibt beim Ansehen,
  -- was es ist — nur ein offenes wird „In Bearbeitung".
  UPDATE public.email_tickets
    SET locked_by = v_me, locked_at = now(),
        status = CASE WHEN v_row.status = 'open' THEN 'in_progress'::public.email_ticket_status ELSE v_row.status END
   WHERE id = p_ticket_id;
END; $function$;
REVOKE ALL ON FUNCTION public.email_ticket_lock(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.email_ticket_lock(uuid, boolean) TO authenticated, service_role;

-- ─── 2) Bezüge je Absender merken ─────────────────────────────────────────
ALTER TABLE public.email_ticket_nachrichten DROP CONSTRAINT IF EXISTS email_ticket_nachrichten_richtung_check;
ALTER TABLE public.email_ticket_nachrichten
  ADD CONSTRAINT email_ticket_nachrichten_richtung_check CHECK (richtung IN ('eingang', 'ausgang', 'bezug'));
COMMENT ON COLUMN public.email_ticket_nachrichten.richtung IS
  'eingang = Mail des Absenders, ausgang = Antwort aus der App, bezug (0210) = Message-ID, auf die sich die erste Mail eines Tickets bezog (mit Absender) — nur zur Zuordnung weiterer Antworten derselben Person.';

-- Vorlage: 0208 (= live), geändert nur Schritt 2 (Richtung 'bezug') und das
-- Merken der Bezüge beim Anlegen eines Tickets.
CREATE OR REPLACE FUNCTION public.email_ticket_upsert_from_inbound(
  p_account_id uuid,
  p_thread_key text,
  p_subject text,
  p_from text,
  p_imap_uid bigint,
  p_received_at timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_kandidaten text[] DEFAULT NULL::text[],
  p_absender text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_ticket_id uuid; v_was_inserted boolean := false; v_was_reopened boolean := false;
        v_old_status public.email_ticket_status; v_key text; v_last_uid bigint;
        v_eingang timestamptz := least(coalesce(p_received_at, now()), now());
        -- Aufrufer ab 0208 schicken p_kandidaten (auch leer) und als
        -- p_thread_key die EIGENE Message-ID der Mail.
        v_neu boolean := p_kandidaten IS NOT NULL;
        v_absender text := public._email_adresse(coalesce(p_absender, p_from));
        v_kand text[] := '{}';
        v_schon_gesehen boolean := false;
        -- Zuordnung über einen Bezug (Schritt 2) und ob der DIREKTE Bezug
        -- (In-Reply-To) eine eigene frühere Mail des Kunden ist (= Nachtrag).
        v_ueber_bezug boolean := false;
        v_nachtrag boolean := false;
BEGIN
  v_key := lower(regexp_replace(coalesce(p_thread_key, ''), '[<>\s]', '', 'g'));
  IF length(v_key) = 0 THEN RAISE EXCEPTION 'empty_thread_key'; END IF;

  IF v_neu THEN
    -- Bezüge normalisieren wie der Schlüssel; Reihenfolge des Aufrufers
    -- (direktester Bezug zuerst) bleibt, Dubletten und die eigene ID fallen weg.
    SELECT coalesce(array_agg(s.k ORDER BY s.pos), '{}') INTO v_kand
      FROM (SELECT lower(regexp_replace(u.x, '[<>\s]', '', 'g')) AS k, min(u.ord) AS pos
              FROM unnest(p_kandidaten) WITH ORDINALITY AS u(x, ord)
             WHERE u.x IS NOT NULL
             GROUP BY 1) s
     WHERE length(s.k) > 0 AND s.k <> v_key;
    v_kand := coalesce(v_kand[1:100], '{}');
  END IF;

  -- 1) Die Mail selbst kennt schon ein Ticket (erneuter Abruf).
  SELECT t.id INTO v_ticket_id
    FROM public.email_tickets t
   WHERE t.account_id = p_account_id
     AND (t.thread_key = v_key
          OR (v_neu AND EXISTS (SELECT 1 FROM public.email_ticket_nachrichten n
                                 WHERE n.ticket_id = t.id AND n.message_id = v_key
                                   AND n.richtung = 'eingang')))
   ORDER BY (t.thread_key = v_key) DESC, t.last_inbound_at DESC NULLS LAST
   LIMIT 1;

  -- 2) Bezüge (In-Reply-To/References): nur Gespräche mit DIESEM Absender.
  IF v_ticket_id IS NULL AND v_neu AND cardinality(v_kand) > 0 AND v_absender IS NOT NULL THEN
    SELECT m.ticket_id, (m.pos = 1 AND m.eigen) INTO v_ticket_id, v_nachtrag
      FROM (
        SELECT n.ticket_id, array_position(v_kand, n.message_id) AS pos, 1 AS art,
               (n.richtung = 'eingang') AS eigen
          FROM public.email_ticket_nachrichten n
          JOIN public.email_tickets t ON t.id = n.ticket_id
         WHERE t.account_id = p_account_id
           AND n.message_id = ANY (v_kand)
           AND ((n.richtung = 'eingang' AND n.absender = v_absender)
             -- 0210: Bezüge, die ein früheres Ticket DIESES Absenders gemerkt hat
             -- (zweite Antwort derselben Person auf dieselbe Vereinsmail).
             OR (n.richtung = 'bezug' AND n.absender = v_absender)
             OR (n.richtung = 'ausgang' AND v_absender = ANY (n.empfaenger)
                 AND (cardinality(n.empfaenger) = 1
                      OR public._email_adresse(t.from_address) = v_absender)))
        UNION ALL
        SELECT t.id, array_position(v_kand, t.thread_key), 2, true
          FROM public.email_tickets t
         WHERE t.account_id = p_account_id
           AND t.thread_key = ANY (v_kand)
           AND public._email_adresse(t.from_address) = v_absender
      ) m
      JOIN public.email_tickets t2 ON t2.id = m.ticket_id
     ORDER BY m.pos, m.art, t2.last_inbound_at DESC NULLS LAST
     LIMIT 1;
    v_ueber_bezug := v_ticket_id IS NOT NULL;
    v_nachtrag := coalesce(v_nachtrag, false);
  END IF;

  IF v_ticket_id IS NOT NULL THEN
    SELECT id, status, last_imap_uid INTO v_ticket_id, v_old_status, v_last_uid
      FROM public.email_tickets
     WHERE id = v_ticket_id
     FOR UPDATE;
  END IF;

  IF v_ticket_id IS NULL THEN
    -- Speicherfrist (0208): Erledigte Tickets löscht datenschutz_aufraeumen
    -- 24 Monate nach dem letzten Eingang. Für so alte Mails kein neues
    -- Ticket — sonst legte der nächste Abruf ein gelöschtes wieder an.
    IF v_eingang < now() - interval '24 months' THEN
      RETURN NULL;
    END IF;
    -- Übergang 0208: Eine Mail, deren Gespräch ein Ticket schon mit einer
    -- neueren UID kennt, war bereits abgerufen (vor 0208 in ein Ticket eines
    -- anderen Absenders verschmolzen) — eigenes Ticket, aber keine Meldung.
    IF v_neu AND p_imap_uid IS NOT NULL AND cardinality(v_kand) > 0 THEN
      v_schon_gesehen := EXISTS (
        SELECT 1 FROM public.email_tickets t
         WHERE t.account_id = p_account_id
           AND t.last_imap_uid >= p_imap_uid
           AND (t.thread_key = ANY (v_kand)
                OR EXISTS (SELECT 1 FROM public.email_ticket_nachrichten n
                            WHERE n.ticket_id = t.id AND n.message_id = ANY (v_kand)
                              -- 0210: ein gemerkter Bezug beweist nicht, dass die
                              -- Mail schon abgerufen war (sonst ginge die Meldung
                              -- einer zweiten Antwort auf dieselbe Rundmail verloren).
                              AND n.richtung <> 'bezug')));
    END IF;
    INSERT INTO public.email_tickets(account_id, thread_key, subject, from_address, status,
      last_inbound_at, last_imap_uid, message_count)
    VALUES (p_account_id, v_key, p_subject, p_from, 'open', v_eingang, p_imap_uid, 1)
    RETURNING id INTO v_ticket_id;
    v_was_inserted := true;
    -- 0210: Bezüge des neuen Tickets merken. Antwortet dieselbe Person noch
    -- einmal auf dieselbe Vereinsmail (Rundmail, Mail aus dem Webmail, App-
    -- Antwort an mehrere), landet die zweite Antwort in diesem Ticket statt
    -- in einem neuen. Andere Absender führt das nie zusammen (Schritt 2 prüft
    -- den Absender).
    IF v_neu AND v_absender IS NOT NULL AND cardinality(v_kand) > 0 THEN
      INSERT INTO public.email_ticket_nachrichten (ticket_id, message_id, richtung, absender)
      SELECT v_ticket_id, k.x, 'bezug', v_absender FROM unnest(v_kand) AS k(x)
      ON CONFLICT (ticket_id, message_id) DO NOTHING;
    END IF;
  ELSE
    -- Der Abruf holt jedes Mal die letzten 50 Mails. Eine Mail, die das Ticket
    -- schon kennt (UID nicht größer als die zuletzt gesehene), zählt nicht noch
    -- einmal und öffnet ein beantwortetes Ticket nicht wieder.
    IF p_imap_uid IS NOT NULL AND p_imap_uid <= coalesce(v_last_uid, 0) THEN
      -- Tickets von vor 0208: die Message-ID für künftige Zuordnung nachtragen.
      IF v_neu THEN
        INSERT INTO public.email_ticket_nachrichten (ticket_id, message_id, richtung, absender)
        VALUES (v_ticket_id, v_key, 'eingang', v_absender)
        -- 0210: Kam diese Mail NACH einer Antwort, die sich auf sie bezog, steht
        -- sie schon als 'bezug' im Ticket — dann wird sie zur Eingangs-Zeile.
        ON CONFLICT (ticket_id, message_id) DO UPDATE
          SET richtung = 'eingang', absender = EXCLUDED.absender
        WHERE public.email_ticket_nachrichten.richtung = 'bezug';
      END IF;
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

  IF v_neu THEN
    INSERT INTO public.email_ticket_nachrichten (ticket_id, message_id, richtung, absender)
    VALUES (v_ticket_id, v_key, 'eingang', v_absender)
    -- 0210: siehe oben — ein vorher gemerkter Bezug wird zur Eingangs-Zeile.
    ON CONFLICT (ticket_id, message_id) DO UPDATE
      SET richtung = 'eingang', absender = EXCLUDED.absender
    WHERE public.email_ticket_nachrichten.richtung = 'bezug';
  END IF;

  -- Benachrichtigen nur bei neuer Mail oder Wieder-Öffnen — und nur für Mails
  -- der letzten 3 Tage (der erste Abruf nach längerer Pause soll keine Flut
  -- alter Mails melden). Schlüssel je Empfänger: der Unique-Index auf dedup_key
  -- hätte sonst beim zweiten Admin das ganze Ticket zurückgerollt.
  -- Zusätzlich (0208): Antwortet der Kunde auf eine Mail des Vereins (aus der
  -- App oder im Webmail beantwortet) und das Ticket ist noch offen bzw. in
  -- Bearbeitung, wird ebenfalls gemeldet. Vor 0208 wurde so eine Antwort ein
  -- neues Ticket und damit gemeldet — ohne diese Regel ginge die Meldung
  -- verloren (z. B. Ticket im Webmail beantwortet und nicht geschlossen).
  -- Nachträge auf die eigene Mail in ein offenes Ticket bleiben ohne Meldung.
  IF (v_was_inserted OR v_was_reopened OR (v_ueber_bezug AND NOT v_nachtrag))
     AND NOT v_schon_gesehen
     AND v_eingang > now() - interval '3 days' THEN
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

REVOKE ALL ON FUNCTION public.email_ticket_upsert_from_inbound(uuid, text, text, text, bigint, timestamp with time zone, text[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_ticket_upsert_from_inbound(uuid, text, text, text, bigint, timestamp with time zone, text[], text) TO service_role;

-- ─── 3) Spiele: Aufräumen bei Sperre UND Löschung ─────────────────────────
CREATE OR REPLACE FUNCTION public._spiele_konto_raeumen(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_id IS NULL THEN RETURN; END IF;
  -- Offene Tische und Einladungen — egal, ob Gastgeber oder Eingeladener.
  -- Löschen statt 'aborted' wie games_decline_challenge: keine Statistik.
  DELETE FROM public.games_match
   WHERE status = 'pending'
     AND p_id IN (player_a, player_b);
  -- Laufende Partien abbrechen wie games_cleanup_stale (winner 'd', 'aborted'
  -- zählt in keiner Statistik), turn NULL: niemandem mehr „Du bist dran".
  UPDATE public.games_match
     SET status = 'aborted', winner = 'd', turn = NULL, finished_at = now()
   WHERE status = 'active'
     AND p_id IN (player_a, player_b);
END;
$function$;
REVOKE ALL ON FUNCTION public._spiele_konto_raeumen(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._spiele_konto_raeumen(uuid) TO service_role;

-- Sperr-Trigger aus 0209: gleiche Bedingung (steht am Trigger), jetzt über den Helfer.
CREATE OR REPLACE FUNCTION public._mitglied_sperre_spiele()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public._spiele_konto_raeumen(NEW.id);
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public._mitglied_sperre_spiele() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._mitglied_sperre_spiele() TO service_role;

-- Löschung: BEFORE DELETE, damit der Helfer vor ON DELETE SET NULL (player_b)
-- bzw. CASCADE (player_a) läuft. RETURN OLD — sonst bräche die Löschung ab.
CREATE OR REPLACE FUNCTION public._mitglied_loeschen_spiele()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public._spiele_konto_raeumen(OLD.id);
  RETURN OLD;
END;
$function$;
REVOKE ALL ON FUNCTION public._mitglied_loeschen_spiele() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._mitglied_loeschen_spiele() TO service_role;

DROP TRIGGER IF EXISTS trg_mitglied_loeschen_spiele ON public.members;
CREATE TRIGGER trg_mitglied_loeschen_spiele
  BEFORE DELETE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public._mitglied_loeschen_spiele();
