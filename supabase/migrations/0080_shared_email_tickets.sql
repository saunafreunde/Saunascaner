-- Migration 0080: Shared-Inbox-Ticket-System für Vereins-Postfach
--
-- Macht aus email_accounts (1:1 member-account) ein Helpdesk-Modell:
-- mehrere Admins können denselben Account bearbeiten ohne Doppel-Arbeit.
-- Soft-Lock + 4-Status-Workflow + IMAP-Threading via Message-ID.

-- ─── 1) email_accounts erweitern ────────────────────────────────────────

ALTER TABLE public.email_accounts ADD COLUMN IF NOT EXISTS is_shared boolean NOT NULL DEFAULT false;

-- Unique-Constraint anpassen: ein Member kann max EINEN persönlichen Account haben,
-- aber zusätzlich N geteilte Accounts verwalten (technisch via member_id-Slot des
-- Account-Verwalters; alle anderen Admins kommen über shared_email_admins rein).
ALTER TABLE public.email_accounts DROP CONSTRAINT IF EXISTS email_accounts_member_id_key;
DROP INDEX IF EXISTS email_accounts_member_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS email_accounts_personal_unique
  ON public.email_accounts (member_id) WHERE is_shared = false;

-- ─── 2) Berechtigungstabelle für geteilte Postfächer ────────────────────

CREATE TABLE IF NOT EXISTS public.shared_email_admins (
  account_id  uuid NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  granted_by  uuid REFERENCES public.members(id),
  PRIMARY KEY (account_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_shared_admins_member ON public.shared_email_admins (member_id);

ALTER TABLE public.shared_email_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shared_admins_read ON public.shared_email_admins;
CREATE POLICY shared_admins_read ON public.shared_email_admins
  FOR SELECT TO authenticated USING (
    member_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS shared_admins_no_direct_write ON public.shared_email_admins;
CREATE POLICY shared_admins_no_direct_write ON public.shared_email_admins
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ─── 3) Tickets: ein Eintrag pro Mail-Thread im Shared-Account ──────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_ticket_status') THEN
    CREATE TYPE public.email_ticket_status AS ENUM ('open','in_progress','answered','closed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.email_tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES public.email_accounts(id) ON DELETE CASCADE,
  thread_key      text NOT NULL,
  subject         text,
  from_address    text,
  status          public.email_ticket_status NOT NULL DEFAULT 'open',
  locked_by       uuid REFERENCES public.members(id) ON DELETE SET NULL,
  locked_at       timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  opened_at       timestamptz NOT NULL DEFAULT now(),
  closed_at       timestamptz,
  message_count   int NOT NULL DEFAULT 1,
  last_imap_uid   bigint,
  UNIQUE (account_id, thread_key)
);
CREATE INDEX IF NOT EXISTS idx_tickets_account_status
  ON public.email_tickets (account_id, status, last_inbound_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_locked
  ON public.email_tickets (locked_by) WHERE locked_by IS NOT NULL;

ALTER TABLE public.email_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tickets_read_shared_admin ON public.email_tickets;
CREATE POLICY tickets_read_shared_admin ON public.email_tickets
  FOR SELECT TO authenticated USING (
    account_id IN (
      SELECT account_id FROM public.shared_email_admins
      WHERE member_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS tickets_no_direct_write ON public.email_tickets;
CREATE POLICY tickets_no_direct_write ON public.email_tickets
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND tablename='email_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.email_tickets;
  END IF;
END $$;
ALTER TABLE public.email_tickets REPLICA IDENTITY FULL;

-- ─── 4) Helper: prüft ob caller shared-admin auf Account ist ─────────────

CREATE OR REPLACE FUNCTION public._is_shared_email_admin(p_account_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_email_admins
    WHERE account_id = p_account_id
      AND member_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
  );
$$;

-- ─── 5) Admin-RPCs: Berechtigungen vergeben/entziehen ────────────────────

CREATE OR REPLACE FUNCTION public.grant_shared_email_admin(p_account_id uuid, p_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_admin uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;
  SELECT id INTO v_admin FROM public.members WHERE auth_user_id = auth.uid();
  INSERT INTO public.shared_email_admins(account_id, member_id, granted_by)
  VALUES (p_account_id, p_member_id, v_admin)
  ON CONFLICT (account_id, member_id) DO NOTHING;
END; $$;
GRANT EXECUTE ON FUNCTION public.grant_shared_email_admin(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_shared_email_admin(p_account_id uuid, p_member_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;
  DELETE FROM public.shared_email_admins
   WHERE account_id = p_account_id AND member_id = p_member_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.revoke_shared_email_admin(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_account_shared(p_account_id uuid, p_shared boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;
  UPDATE public.email_accounts SET is_shared = coalesce(p_shared, false) WHERE id = p_account_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.mark_account_shared(uuid, boolean) TO authenticated;

-- ─── 6) Read-RPCs für UI ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_my_shared_accounts()
RETURNS TABLE(account_id uuid, email_address text, display_name text, unread_count int, open_ticket_count int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH me AS (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
  SELECT e.id, e.email_address::text, e.display_name, e.unread_count,
         (SELECT count(*)::int FROM public.email_tickets t
            WHERE t.account_id = e.id AND t.status IN ('open','in_progress'))
  FROM public.email_accounts e
  JOIN public.shared_email_admins s ON s.account_id = e.id
  WHERE s.member_id = (SELECT id FROM me)
    AND e.is_shared = true
    AND e.active = true
  ORDER BY e.email_address;
$$;
GRANT EXECUTE ON FUNCTION public.list_my_shared_accounts() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_shared_account_admins(p_account_id uuid)
RETURNS TABLE(member_id uuid, name text, avatar_path text, granted_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT s.member_id, m.name, m.avatar_path, s.granted_at
  FROM public.shared_email_admins s
  JOIN public.members m ON m.id = s.member_id
  WHERE s.account_id = p_account_id
    AND (public.is_admin() OR public._is_shared_email_admin(p_account_id))
  ORDER BY m.name;
$$;
GRANT EXECUTE ON FUNCTION public.list_shared_account_admins(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_account_tickets(
  p_account_id uuid,
  p_status public.email_ticket_status DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE(
  id uuid, thread_key text, subject text, from_address text,
  status public.email_ticket_status,
  locked_by uuid, locked_by_name text, locked_at timestamptz,
  last_inbound_at timestamptz, last_outbound_at timestamptz,
  message_count int, last_imap_uid bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT t.id, t.thread_key, t.subject, t.from_address, t.status,
         t.locked_by, lm.name, t.locked_at,
         t.last_inbound_at, t.last_outbound_at, t.message_count, t.last_imap_uid
  FROM public.email_tickets t
  LEFT JOIN public.members lm ON lm.id = t.locked_by
  WHERE t.account_id = p_account_id
    AND (public.is_admin() OR public._is_shared_email_admin(p_account_id))
    AND (p_status IS NULL OR t.status = p_status)
  ORDER BY (t.status = 'open') DESC, t.last_inbound_at DESC NULLS LAST
  LIMIT greatest(1, least(p_limit, 200));
$$;
GRANT EXECUTE ON FUNCTION public.list_account_tickets(uuid, public.email_ticket_status, int) TO authenticated;

-- ─── 7) Lock-RPCs (transaktional, race-safe) ────────────────────────────

CREATE OR REPLACE FUNCTION public.email_ticket_lock(p_ticket_id uuid, p_force boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid;
  v_row public.email_tickets%rowtype;
  v_lock_age interval;
BEGIN
  SELECT id INTO v_me FROM public.members WHERE auth_user_id = auth.uid();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_row FROM public.email_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_not_found'; END IF;
  IF NOT public._is_shared_email_admin(v_row.account_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Lock von mir selbst → idempotent
  IF v_row.locked_by = v_me THEN
    UPDATE public.email_tickets
      SET locked_at = now(),
          status = CASE WHEN v_row.status = 'open' THEN 'in_progress'::public.email_ticket_status ELSE v_row.status END
     WHERE id = p_ticket_id;
    RETURN;
  END IF;

  -- Lock von jemand anderem
  IF v_row.locked_by IS NOT NULL AND v_row.locked_at IS NOT NULL THEN
    v_lock_age := now() - v_row.locked_at;
    IF v_lock_age < interval '10 minutes' AND NOT coalesce(p_force, false) THEN
      RAISE EXCEPTION 'lock_held' USING DETAIL = v_row.locked_by::text;
    END IF;
  END IF;

  -- Lock setzen / stealen
  UPDATE public.email_tickets
    SET locked_by = v_me,
        locked_at = now(),
        status = CASE WHEN v_row.status IN ('open','answered') THEN 'in_progress'::public.email_ticket_status ELSE v_row.status END
   WHERE id = p_ticket_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.email_ticket_lock(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.email_ticket_unlock(p_ticket_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_me uuid;
BEGIN
  SELECT id INTO v_me FROM public.members WHERE auth_user_id = auth.uid();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.email_tickets
    SET locked_by = NULL, locked_at = NULL,
        status = CASE WHEN status = 'in_progress' THEN 'open'::public.email_ticket_status ELSE status END
   WHERE id = p_ticket_id AND locked_by = v_me;
END; $$;
GRANT EXECUTE ON FUNCTION public.email_ticket_unlock(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.email_ticket_set_status(
  p_ticket_id uuid, p_status public.email_ticket_status
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_me uuid; v_row public.email_tickets%rowtype;
BEGIN
  SELECT id INTO v_me FROM public.members WHERE auth_user_id = auth.uid();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_row FROM public.email_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket_not_found'; END IF;
  IF NOT public._is_shared_email_admin(v_row.account_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;
  UPDATE public.email_tickets
    SET status = p_status,
        closed_at = CASE WHEN p_status = 'closed' THEN now() ELSE NULL END,
        locked_by = CASE WHEN p_status IN ('closed','answered') THEN NULL ELSE locked_by END,
        locked_at = CASE WHEN p_status IN ('closed','answered') THEN NULL ELSE locked_at END
   WHERE id = p_ticket_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.email_ticket_set_status(uuid, public.email_ticket_status) TO authenticated;

-- ─── 8) Reply-Hook: vom Send-Pfad gerufen nach SMTP-Erfolg ──────────────

CREATE OR REPLACE FUNCTION public.email_ticket_record_reply(p_ticket_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_me uuid; v_row public.email_tickets%rowtype;
BEGIN
  SELECT id INTO v_me FROM public.members WHERE auth_user_id = auth.uid();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_row FROM public.email_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT public._is_shared_email_admin(v_row.account_id) AND NOT public.is_admin() THEN
    RETURN;
  END IF;
  UPDATE public.email_tickets
    SET status = 'answered',
        last_outbound_at = now(),
        locked_by = NULL,
        locked_at = NULL
   WHERE id = p_ticket_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.email_ticket_record_reply(uuid) TO authenticated;

-- ─── 9) UPSERT vom Cron: neue Mail vom IMAP eingelaufen ─────────────────
-- Nur service_role darf das aufrufen.

CREATE OR REPLACE FUNCTION public.email_ticket_upsert_from_inbound(
  p_account_id uuid,
  p_thread_key text,
  p_subject text,
  p_from text,
  p_imap_uid bigint
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_ticket_id uuid;
  v_was_inserted boolean := false;
  v_was_reopened boolean := false;
  v_old_status public.email_ticket_status;
  v_key text;
BEGIN
  -- Normalisierung: <...> Klammern weg, lowercase, whitespace weg
  v_key := lower(regexp_replace(coalesce(p_thread_key, ''), '[<>\s]', '', 'g'));
  IF length(v_key) = 0 THEN RAISE EXCEPTION 'empty_thread_key'; END IF;

  -- Existiert schon?
  SELECT id, status INTO v_ticket_id, v_old_status
    FROM public.email_tickets
   WHERE account_id = p_account_id AND thread_key = v_key
   FOR UPDATE;

  IF v_ticket_id IS NULL THEN
    INSERT INTO public.email_tickets(
      account_id, thread_key, subject, from_address,
      status, last_inbound_at, last_imap_uid, message_count
    ) VALUES (
      p_account_id, v_key, p_subject, p_from,
      'open', now(), p_imap_uid, 1
    ) RETURNING id INTO v_ticket_id;
    v_was_inserted := true;
  ELSE
    UPDATE public.email_tickets
      SET subject = coalesce(p_subject, subject),
          from_address = coalesce(p_from, from_address),
          last_inbound_at = now(),
          last_imap_uid = greatest(coalesce(last_imap_uid, 0), coalesce(p_imap_uid, 0)),
          message_count = message_count + 1,
          status = CASE
            WHEN v_old_status = 'closed' THEN 'open'::public.email_ticket_status
            WHEN v_old_status = 'answered' THEN 'open'::public.email_ticket_status
            ELSE v_old_status
          END,
          closed_at = CASE WHEN v_old_status = 'closed' THEN NULL ELSE closed_at END
     WHERE id = v_ticket_id;
    v_was_reopened := (v_old_status IN ('closed','answered'));
  END IF;

  -- Notification an alle shared_email_admins bei neuer Mail oder Re-Open
  IF v_was_inserted OR v_was_reopened THEN
    INSERT INTO public.notification_queue(kind, recipient_id, payload, dedup_key)
    SELECT 'shared_email_inbound', s.member_id,
      jsonb_build_object(
        'title', '📧 Neue Vereins-Mail',
        'body', coalesce(p_from, 'Unbekannt') || ': ' || coalesce(left(p_subject, 80), '(kein Betreff)'),
        'account_id', p_account_id,
        'ticket_id', v_ticket_id,
        'reopened', v_was_reopened
      ),
      'shared_email:' || v_ticket_id::text || ':' || coalesce(p_imap_uid, 0)::text
    FROM public.shared_email_admins s
    WHERE s.account_id = p_account_id
      AND NOT EXISTS (
        SELECT 1 FROM public.notification_queue
        WHERE dedup_key = 'shared_email:' || v_ticket_id::text || ':' || coalesce(p_imap_uid, 0)::text
          AND recipient_id = s.member_id
      );
  END IF;

  RETURN v_ticket_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.email_ticket_upsert_from_inbound(uuid, text, text, text, bigint) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.email_ticket_upsert_from_inbound(uuid, text, text, text, bigint) TO service_role;

-- ─── 10) Helper für api/postfach.ts: Credentials für Shared-Account ─────
-- Nur service_role + Caller muss Mitglied der shared_email_admins sein
-- (das prüft der API-Endpoint VOR dem Aufruf).

CREATE OR REPLACE FUNCTION public.get_shared_email_credentials(p_account_id uuid)
RETURNS TABLE(
  email_address text, imap_host text, imap_port int,
  smtp_host text, smtp_port int, password text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault AS $$
DECLARE v_account public.email_accounts%rowtype; v_secret text;
BEGIN
  SELECT * INTO v_account FROM public.email_accounts
   WHERE id = p_account_id AND is_shared = true AND active = true;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE id = v_account.vault_secret_id;
  IF v_secret IS NULL THEN RETURN; END IF;
  email_address := v_account.email_address;
  imap_host := v_account.imap_host; imap_port := v_account.imap_port;
  smtp_host := v_account.smtp_host; smtp_port := v_account.smtp_port;
  password := v_secret;
  RETURN NEXT;
END; $$;
REVOKE EXECUTE ON FUNCTION public.get_shared_email_credentials(uuid) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_shared_email_credentials(uuid) TO service_role;

-- ─── 11) Initial-Seed: info@sauna-fds.de + alle Admins ──────────────────

UPDATE public.email_accounts
   SET is_shared = true
 WHERE lower(email_address::text) = 'info@sauna-fds.de';

INSERT INTO public.shared_email_admins(account_id, member_id)
SELECT e.id, m.id
  FROM public.email_accounts e
  JOIN public.members m ON m.role = 'admin' AND m.revoked_at IS NULL
 WHERE e.is_shared = true
ON CONFLICT (account_id, member_id) DO NOTHING;
