-- 0208_postfach_zuordnung_fristen.sql — Vereinspostfach: Tickets richtig
-- zuordnen, Speicherfristen für Postfach-Tickets und Telegram-Anfragen
-- Audit-Runde 4, 25.09.2026 (Befunde 4 und 5, Gruppe U3_postfach_fristen)
--
-- Befund 4 (Zuordnung):
--  * Der Abruf (api/postfach.ts) bildete den Ticket-Schlüssel aus
--    References[0] ?? In-Reply-To ?? Message-ID — das IMAP-ENVELOPE hat aber
--    gar kein References-Feld. Schlüssel war also In-Reply-To. Folgen: Die
--    Kundenantwort C auf eine Vereinsantwort B bekam den Schlüssel b und damit
--    ein NEUES Ticket (das alte blieb „Beantwortet“); antworteten zwei
--    Personen auf dieselbe Vereinsmail, landeten beide im selben Ticket, die
--    Mail der ersten Person war in der App nicht mehr zu sehen.
--  * handleSend suchte das Ticket über den Schlüssel = In-Reply-To der
--    Antwort (= Message-ID der zuletzt geladenen Mail). Das traf nur Tickets
--    aus genau einer Mail ohne In-Reply-To; alle anderen blieben „Offen“.
--
--  Neu:
--  * Tabelle email_ticket_nachrichten(ticket_id, message_id, richtung, …):
--    merkt die Message-IDs der eingegangenen Mails (mit Absender) und der aus
--    der App gesendeten Antworten (mit Empfängern). Kaskade mit dem Ticket,
--    RLS ohne Zugriff für anon/authenticated (nur service_role).
--  * email_ticket_upsert_from_inbound: zwei neue, optionale Parameter
--    p_kandidaten (alle Message-IDs aus In-Reply-To und References, der
--    direkteste Bezug zuerst) und p_absender (Adresse). p_thread_key ist ab
--    jetzt die EIGENE Message-ID der Mail. Zuordnung:
--      1) Die Mail ist schon bekannt (Ticket-Schlüssel oder vermerkte
--         Eingangs-Nachricht) → dieses Ticket.
--      2) Ein Kandidat ist
--         - eine vermerkte Eingangs-Mail DESSELBEN Absenders,
--         - eine aus der App gesendete Vereinsantwort an diesen Absender
--           (bei mehreren Empfängern nur, wenn er der Absender des Tickets
--           ist — sonst eigenes Ticket, keine Verschmelzung),
--         - der Schlüssel eines Tickets DESSELBEN Absenders (auch die
--           Schlüssel vor 0208, die aus In-Reply-To stammen).
--         Mehrere Treffer: der direkteste Bezug gewinnt, dann der jüngste
--         Eingang.
--      3) Sonst ein neues Ticket mit der eigenen Message-ID als Schlüssel.
--    Ohne p_kandidaten (api/postfach.ts vor diesem Deploy) verhält sie sich
--    wie bisher (nur thread_key), damit der Abruf zwischen Migration und
--    Deploy weiterläuft.
--    Übergang: Mails, die vor 0208 verschiedener Absender in EINEM Ticket
--    gelandet sind, bekommen beim nächsten Abruf ihr eigenes Ticket — ohne
--    Meldung (diese Mail war schon gemeldet bzw. ist älter).
--    Benachrichtigung: neues Ticket oder Wiederöffnen wie bisher, nur Mails
--    der letzten 3 Tage, dedup_key je Empfänger. Neu gemeldet wird außerdem
--    eine Kundenantwort auf eine Vereinsmail, die in einem noch offenen bzw.
--    „In Bearbeitung“-Ticket landet (z. B. im Webmail beantwortet, nicht
--    geschlossen): vor 0208 ergab sie ein neues Ticket samt Meldung, sonst
--    ginge diese Meldung durch die richtige Zuordnung verloren. Nachträge
--    des Kunden auf die eigene Mail in ein offenes Ticket: weiter ohne Meldung.
--  * Neue Funktion email_ticket_antwort_vermerken (nur service_role, von
--    handleSend nach dem Versand aufgerufen): ordnet die Antwort über die
--    Ticket-ID zu (nur, wenn das Ticket zu diesem Postfach gehört), setzt
--    „Beantwortet“, gibt die Sperre frei und merkt die Message-ID der Antwort.
--    Kam seit dem Laden eine neuere Kundenmail (last_imap_uid größer als die
--    beantwortete UID), bleibt das Ticket offen. Ohne Ticket-ID (altes
--    App-Bundle) wird über In-Reply-To = beantwortete Mail gesucht.
--
-- Befund 5 (Speicherfristen):
--  * datenschutz_aufraeumen (Vorlage: Live-Fassung aus 0204) löscht
--    erledigte Postfach-Tickets (beantwortet/geschlossen), deren letzter
--    Eingang und letzte Antwort über 24 Monate zurückliegen (mit ihren
--    Nachrichten-Vermerken). Rückgabe um 'vereinspostfach_tickets' ergänzt.
--    Damit der Abruf (letzte 50 INBOX-Mails) sie nicht wieder anlegt, legt
--    email_ticket_upsert_from_inbound für Mails, die älter als 24 Monate
--    sind, kein neues Ticket mehr an. Die Mails selbst bleiben im Postfach
--    auf dem Mailserver; die App speichert nur die Bearbeitungsliste.
--  * Job 'versandprotokolle-aufraeumen' (0187, Live-Fassung als Vorlage):
--    abgelehnte Telegram-Anmeldeanfragen nach 12 Monaten löschen. Bis dahin
--    wirkt die Ablehnung als Sperre (kein erneutes Anpiepen des Vorstands),
--    danach kann derselbe Chat wieder anfragen.
--
-- Rechte: neue Funktionen haben seit 0181 kein anon-Recht, bekämen aber über
-- die Default-Privilegien authenticated — ausdrücklich entzogen, nur
-- service_role. Die neue Tabelle: REVOKE ALL von anon/authenticated.
--
-- Wiederholbar: CREATE TABLE/INDEX IF NOT EXISTS, DROP FUNCTION IF EXISTS vor
-- CREATE, CREATE OR REPLACE, Job per alter_job (fehlt er, wird er angelegt).
-- Reihenfolge beim Ausrollen: ERST diese Migration, DANN der Deploy von
-- api/postfach.ts (der neue Abruf ruft die Funktion mit den neuen Parametern).

-- ─── 1) Nachrichten-Vermerke ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_ticket_nachrichten (
  ticket_id   uuid NOT NULL REFERENCES public.email_tickets(id) ON DELETE CASCADE,
  message_id  text NOT NULL CHECK (length(message_id) BETWEEN 1 AND 998),
  richtung    text NOT NULL CHECK (richtung IN ('eingang', 'ausgang')),
  absender    text,     -- Eingang: Adresse des Absenders (klein geschrieben)
  empfaenger  text[],   -- Ausgang: Adressen aus An/Cc (klein geschrieben)
  erstellt_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, message_id)
);
CREATE INDEX IF NOT EXISTS email_ticket_nachrichten_message_id_idx
  ON public.email_ticket_nachrichten (message_id);

COMMENT ON TABLE public.email_ticket_nachrichten IS
  'Message-IDs der Mails eines Vereinspostfach-Tickets (0208): eingegangene mit Absender, aus der App gesendete Antworten mit Empfängern. Dient nur der Zuordnung von Antworten; wird mit dem Ticket gelöscht.';

ALTER TABLE public.email_ticket_nachrichten ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.email_ticket_nachrichten FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.email_ticket_nachrichten TO service_role;

-- ─── 2) Hilfsfunktion: Adresse aus „Name <adresse>“ ───────────────────────
CREATE OR REPLACE FUNCTION public._email_adresse(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
  -- „Name <a@b.de>“ → „a@b.de“, sonst der Text selbst; klein, ohne Rand.
  -- Ohne @ (z. B. 'Unbekannt') NULL — solche Absender führen nie zusammen.
  SELECT CASE WHEN s.a LIKE '%_@_%' THEN s.a END
    FROM (SELECT lower(btrim(coalesce(substring(p FROM '<([^<>]*)>\s*$'), p))) AS a) s
$function$;
REVOKE ALL ON FUNCTION public._email_adresse(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._email_adresse(text) TO service_role;

-- ─── 3) email_ticket_upsert_from_inbound (Vorlage: Live-Fassung aus 0185) ─
-- Neue Parameter → DROP + CREATE (ein zweites Overload wäre für PostgREST
-- mit benannten Parametern mehrdeutig).
DROP FUNCTION IF EXISTS public.email_ticket_upsert_from_inbound(uuid, text, text, text, bigint, timestamp with time zone);
DROP FUNCTION IF EXISTS public.email_ticket_upsert_from_inbound(uuid, text, text, text, bigint, timestamp with time zone, text[], text);

CREATE FUNCTION public.email_ticket_upsert_from_inbound(
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
                            WHERE n.ticket_id = t.id AND n.message_id = ANY (v_kand))));
    END IF;
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
      -- Tickets von vor 0208: die Message-ID für künftige Zuordnung nachtragen.
      IF v_neu THEN
        INSERT INTO public.email_ticket_nachrichten (ticket_id, message_id, richtung, absender)
        VALUES (v_ticket_id, v_key, 'eingang', v_absender)
        ON CONFLICT (ticket_id, message_id) DO NOTHING;
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
    ON CONFLICT (ticket_id, message_id) DO NOTHING;
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

-- ─── 4) Antwort aus der App vermerken ─────────────────────────────────────
DROP FUNCTION IF EXISTS public.email_ticket_antwort_vermerken(uuid, uuid, text, bigint, text, text[]);

CREATE FUNCTION public.email_ticket_antwort_vermerken(
  p_account_id uuid,
  p_ticket_id uuid,
  p_in_reply_to text,
  p_antwort_uid bigint,
  p_message_id text,
  p_empfaenger text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_id uuid; v_status public.email_ticket_status; v_last_uid bigint;
        v_neu_status public.email_ticket_status; v_key text; v_mid text;
        v_empf text[];
BEGIN
  IF p_account_id IS NULL THEN RETURN NULL; END IF;

  IF p_ticket_id IS NOT NULL THEN
    -- Genau dieses Ticket — und nur, wenn es zu diesem Postfach gehört.
    SELECT id INTO v_id FROM public.email_tickets
     WHERE id = p_ticket_id AND account_id = p_account_id;
  ELSE
    -- Altes App-Bundle ohne Ticket-ID: über die beantwortete Mail
    -- (In-Reply-To der Antwort = Message-ID der Kundenmail).
    v_key := lower(regexp_replace(coalesce(p_in_reply_to, ''), '[<>\s]', '', 'g'));
    IF length(v_key) > 0 THEN
      SELECT t.id INTO v_id
        FROM public.email_tickets t
       WHERE t.account_id = p_account_id
         AND (t.thread_key = v_key
              OR EXISTS (SELECT 1 FROM public.email_ticket_nachrichten n
                          WHERE n.ticket_id = t.id AND n.message_id = v_key
                            AND n.richtung = 'eingang'))
       ORDER BY (t.thread_key = v_key) DESC, t.last_inbound_at DESC NULLS LAST
       LIMIT 1;
    END IF;
  END IF;
  IF v_id IS NULL THEN RETURN NULL; END IF;

  SELECT status, last_imap_uid INTO v_status, v_last_uid
    FROM public.email_tickets WHERE id = v_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Kam nach der beantworteten Mail schon eine neuere (größere UID), ist das
  -- Ticket nicht erledigt: offen lassen (Sperre wird trotzdem frei).
  IF p_antwort_uid IS NOT NULL AND coalesce(v_last_uid, 0) > p_antwort_uid THEN
    v_neu_status := CASE WHEN v_status = 'in_progress' THEN 'open'::public.email_ticket_status
                         ELSE v_status END;
  ELSE
    v_neu_status := 'answered';
  END IF;

  UPDATE public.email_tickets
     SET status = v_neu_status,
         closed_at = CASE WHEN v_neu_status = 'closed' THEN closed_at ELSE NULL END,
         last_outbound_at = now(),
         locked_by = NULL,
         locked_at = NULL
   WHERE id = v_id;

  v_mid := lower(regexp_replace(coalesce(p_message_id, ''), '[<>\s]', '', 'g'));
  IF length(v_mid) BETWEEN 1 AND 998 THEN
    SELECT array_agg(DISTINCT a) INTO v_empf
      FROM (SELECT public._email_adresse(x) AS a FROM unnest(p_empfaenger) AS x) s
     WHERE a IS NOT NULL;
    INSERT INTO public.email_ticket_nachrichten (ticket_id, message_id, richtung, empfaenger)
    VALUES (v_id, v_mid, 'ausgang', v_empf)
    ON CONFLICT (ticket_id, message_id) DO NOTHING;
  END IF;
  RETURN v_id;
END; $function$;

REVOKE ALL ON FUNCTION public.email_ticket_antwort_vermerken(uuid, uuid, text, bigint, text, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.email_ticket_antwort_vermerken(uuid, uuid, text, bigint, text, text[]) TO service_role;

-- ─── 5) datenschutz_aufraeumen (Vorlage: Live-Fassung aus 0204) ───────────
CREATE OR REPLACE FUNCTION public.datenschutz_aufraeumen()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  n_benachrichtigungen int;
  n_protokoll int;
  n_besuche int;
  n_evakuierung int;
  n_evak_protokoll int;
  n_nachtabschluss int;
  n_dateien int;
  n_teilnahmen int;
  n_telegram_vermerke int;
  n_push_vermerke int;
  n_unbestaetigt int;
  n_drossel int;
  n_postfach int;
begin
  -- Benachrichtigungen (Posteingang, Push-Warteschlange): 90 Tage.
  delete from public.notification_queue
   where created_at < now() - interval '90 days';
  get diagnostics n_benachrichtigungen = row_count;

  -- Admin-Protokoll: 24 Monate.
  delete from public.activity_log
   where occurred_at < now() - interval '24 months';
  get diagnostics n_protokoll = row_count;

  -- Besuchstage: 24 Monate. Personal (staff) ausgenommen — mögliche
  -- Arbeitszeitnachweise (export_staff_attendance), Frist klärt der Vorstand.
  delete from public.attendance_events a
   where a.date < ((now() at time zone 'Europe/Berlin')::date - interval '24 months')::date
     and not exists (select 1 from public.members m
                      where m.id = a.member_id and m.role = 'staff');
  get diagnostics n_besuche = row_count;

  -- Evakuierungsalarme: Namensliste und Auslöser (triggered_by) nach 90 Tagen
  -- leeren — Zeitpunkt, Anzahl und Quelle bleiben. Auch Alarme ohne
  -- Anwesende und solche, deren Liste ein früherer Lauf schon geleert hat.
  -- (Ein nie beendeter Alarm gilt nach 90 Tagen ebenfalls als abgeschlossen.)
  update public.evacuation_events
     set present_names = '{}'::text[], triggered_by = null
   where coalesce(ended_at, triggered_at) < now() - interval '90 days'
     and (cardinality(present_names) > 0 or triggered_by is not null);
  get diagnostics n_evakuierung = row_count;

  -- Dasselbe im Admin-Protokoll: trg_log_evacuation schreibt je Alarm eine
  -- Zeile mit dem Auslöser (actor_*). Das Protokoll gilt sonst 24 Monate —
  -- für Alarme ebenfalls nach 90 Tagen nur noch „Notfall-Alarm" + Zeitpunkt.
  update public.activity_log
     set actor_id = null, actor_name = null, actor_role = null
   where action = 'evacuation.alarm'
     and occurred_at < now() - interval '90 days'
     and (actor_id is not null or actor_name is not null or actor_role is not null);
  get diagnostics n_evak_protokoll = row_count;

  -- Nachtabschluss (wer um 2 Uhr noch eingecheckt war): IDs nach 90 Tagen weg.
  update public.presence_audit set member_ids = '{}'::uuid[]
   where reset_at < now() - interval '90 days'
     and cardinality(member_ids) > 0;
  get diagnostics n_nachtabschluss = row_count;

  -- (E-Mail-Versandprotokoll: 12 Monate, eigener Job
  -- 'versandprotokolle-aufraeumen' aus 0187, Gruppe F2.)

  -- Persönliche Dateien, die seit 7 Tagen niemand mehr verwendet (ersetzte
  -- Profilbilder, gelöschte Beiträge/Fotos) → Löschliste (Admin räumt ab).
  insert into public.storage_loeschliste (pfad)
  select o.name
    from storage.objects o
   where o.bucket_id = 'assets'
     and public._storage_pfad_persoenlich(o.name)
     and o.created_at < now() - interval '7 days'
     and not public._storage_pfad_in_gebrauch(o.name, null)
  on conflict (pfad) do nothing;
  get diagnostics n_dateien = row_count;

  -- Aufguss-Teilnahmen (Check-in während eines Aufgusses, mit Uhrzeit):
  -- 24 Monate wie die Besuchstage. Kein Personal-Sonderfall — der
  -- Arbeitszeitnachweis (export_staff_attendance) liest attendance_events.
  -- Folge: get_member_stats_full zählt Aufguss-Besuche wie die Besuchstage
  -- nur noch aus 24 Monaten; verdiente Abzeichen bleiben.
  delete from public.infusion_attendances ia
   where (ia.scanned_at at time zone 'Europe/Berlin')::date
         < ((now() at time zone 'Europe/Berlin')::date - interval '24 months')::date;
  get diagnostics n_teilnahmen = row_count;

  -- Vermerke „an diesen Aufguss schon erinnert" (Telegram, Push): dienen nur
  -- der Entdoppelung in einem Fenster von höchstens 3 Stunden → 7 Tage.
  delete from public.telegram_rating_pushes
   where sent_at < now() - interval '7 days';
  get diagnostics n_telegram_vermerke = row_count;
  delete from public.bewertung_push_erinnerungen
   where gesendet_at < now() - interval '7 days';
  get diagnostics n_push_vermerke = row_count;

  -- Nie bestätigte Registrierungen (seit 0189 ohne Mitglieds-Zeile; Name und
  -- Herkunft stehen in user_metadata): 7 Tage nach der letzten Anfrage. Die
  -- Links laufen viel früher ab. Wer eine Mitglieds-Zeile hat (Altkonto vom
  -- 23.05.) oder anonym angemeldet ist, bleibt. greatest() übergeht NULL.
  delete from auth.users u
   where u.email_confirmed_at is null
     and u.phone_confirmed_at is null
     and coalesce(u.is_anonymous, false) = false
     and greatest(u.created_at, u.updated_at, u.confirmation_sent_at, u.recovery_sent_at,
                  u.email_change_sent_at, u.invited_at, u.last_sign_in_at)
         < now() - interval '7 days'
     and not exists (select 1 from public.members m where m.auth_user_id = u.id);
  get diagnostics n_unbestaetigt = row_count;

  -- IP-Bremse: eigentlich Job kiosk-versuche-aufraeumen (alle 10 min); hier
  -- nur als Netz, falls der Job einmal fehlt.
  delete from public.kiosk_versuche where zeit < now() - interval '1 day';
  get diagnostics n_drossel = row_count;

  -- Vereinspostfach (0208): erledigte Tickets (beantwortet/geschlossen) mit
  -- Absender, Betreff und Nachrichten-Vermerken (Kaskade) 24 Monate nach dem
  -- letzten Eingang und der letzten Antwort. Offene/in Bearbeitung bleiben.
  -- email_ticket_upsert_from_inbound legt für so alte Mails kein neues
  -- Ticket an. Die Mails selbst liegen im Postfach auf dem Mailserver.
  delete from public.email_tickets t
   where t.status in ('answered', 'closed')
     and coalesce(t.last_inbound_at, t.opened_at) < now() - interval '24 months'
     and coalesce(t.last_outbound_at, '-infinity'::timestamptz) < now() - interval '24 months';
  get diagnostics n_postfach = row_count;

  return jsonb_build_object(
    'benachrichtigungen', n_benachrichtigungen,
    'protokoll', n_protokoll,
    'besuchstage', n_besuche,
    'evakuierungslisten', n_evakuierung,
    'evakuierungsprotokoll', n_evak_protokoll,
    'nachtabschluss', n_nachtabschluss,
    'dateien_vorgemerkt', n_dateien,
    'aufguss_teilnahmen', n_teilnahmen,
    'telegram_erinnerungs_vermerke', n_telegram_vermerke,
    'push_erinnerungs_vermerke', n_push_vermerke,
    'unbestaetigte_anmeldungen', n_unbestaetigt,
    'drossel_eintraege', n_drossel,
    'vereinspostfach_tickets', n_postfach);
end;
$function$;

REVOKE ALL ON FUNCTION public.datenschutz_aufraeumen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.datenschutz_aufraeumen() TO service_role;

-- ─── 6) Job 'versandprotokolle-aufraeumen' (Vorlage: Live-Fassung aus 0187)
-- Neu: abgelehnte Telegram-Anmeldeanfragen nach 12 Monaten löschen.
DO $cron$
DECLARE
  v_job bigint;
  v_befehl text := $job$
  delete from public.email_log where sent_at < now() - interval '12 months';
  delete from public.push_vorlagen_versand where gesendet_at < now() - interval '90 days';
  delete from public.telegram_chat_anfragen a
   where a.abgelehnt_at is null and a.angefragt_at < now() - interval '60 days'
     and not exists (select 1 from public.system_config s
                      where s.key = 'telegram_chats'
                        and coalesce(s.value->'chat_ids', '[]'::jsonb) @> to_jsonb(a.chat_id));
  delete from public.telegram_chat_anfragen
   where abgelehnt_at < now() - interval '12 months';
  $job$;
BEGIN
  SELECT jobid INTO v_job FROM cron.job WHERE jobname = 'versandprotokolle-aufraeumen';
  IF v_job IS NOT NULL THEN
    PERFORM cron.alter_job(v_job, command := v_befehl);
  ELSE
    RAISE WARNING '0208: pg_cron-Job versandprotokolle-aufraeumen fehlte — neu angelegt';
    PERFORM cron.schedule('versandprotokolle-aufraeumen', '40 3 * * *', v_befehl);
  END IF;
END $cron$;

-- ─── 7) Selbstprüfung ─────────────────────────────────────────────────────
DO $$
DECLARE
  v_upsert text := 'public.email_ticket_upsert_from_inbound(uuid, text, text, text, bigint, timestamp with time zone, text[], text)';
  v_antwort text := 'public.email_ticket_antwort_vermerken(uuid, uuid, text, bigint, text, text[])';
BEGIN
  IF to_regprocedure('public.email_ticket_upsert_from_inbound(uuid, text, text, text, bigint, timestamp with time zone)') IS NOT NULL THEN
    RAISE EXCEPTION '0208: alte Signatur von email_ticket_upsert_from_inbound besteht noch';
  END IF;
  IF has_function_privilege('anon', v_upsert, 'EXECUTE')
     OR has_function_privilege('authenticated', v_upsert, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_upsert, 'EXECUTE')
     OR has_function_privilege('anon', v_antwort, 'EXECUTE')
     OR has_function_privilege('authenticated', v_antwort, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_antwort, 'EXECUTE')
     OR has_function_privilege('anon', 'public.datenschutz_aufraeumen()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.datenschutz_aufraeumen()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._email_adresse(text)', 'EXECUTE') THEN
    RAISE EXCEPTION '0208: Funktionsrechte falsch';
  END IF;
  IF has_table_privilege('anon', 'public.email_ticket_nachrichten', 'SELECT')
     OR has_table_privilege('authenticated', 'public.email_ticket_nachrichten', 'SELECT')
     OR has_table_privilege('authenticated', 'public.email_ticket_nachrichten', 'INSERT')
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.email_ticket_nachrichten'::regclass) THEN
    RAISE EXCEPTION '0208: Rechte/RLS der Tabelle email_ticket_nachrichten falsch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'versandprotokolle-aufraeumen'
                   AND command LIKE '%abgelehnt_at < now() - interval ''12 months''%') THEN
    RAISE EXCEPTION '0208: Job versandprotokolle-aufraeumen ohne 12-Monats-Frist';
  END IF;
  IF public._email_adresse('Erika Muster <Erika@Beispiel.DE>') IS DISTINCT FROM 'erika@beispiel.de'
     OR public._email_adresse('Unbekannt') IS NOT NULL THEN
    RAISE EXCEPTION '0208: _email_adresse falsch';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
