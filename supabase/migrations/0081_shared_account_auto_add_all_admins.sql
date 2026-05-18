-- Migration 0081: grant_shared_email_account trägt alle Admins automatisch ein,
-- plus Trigger der bei role-Changes shared_email_admins synchronisiert.
--
-- Vorher: nur der anlegende Admin wurde Mitbearbeiter — Stephanie + Johannes
-- mussten manuell hinzugefügt werden. Jetzt: alle role='admin'-Mitglieder
-- automatisch dabei, und neue/aberkannte Admin-Rollen syncen das automatisch.

CREATE OR REPLACE FUNCTION public.grant_shared_email_account(
  p_email        text,
  p_password     text,
  p_imap_host    text DEFAULT 'w01b00df.kasserver.com',
  p_imap_port    int  DEFAULT 993,
  p_smtp_host    text DEFAULT 'w01b00df.kasserver.com',
  p_smtp_port    int  DEFAULT 465,
  p_display_name text DEFAULT NULL
) RETURNS public.email_accounts
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, vault, extensions AS $$
DECLARE
  v_admin_id  uuid;
  v_secret_id uuid;
  v_account   public.email_accounts%rowtype;
  v_existing  public.email_accounts%rowtype;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;
  IF length(btrim(coalesce(p_email,''))) < 3 THEN RAISE EXCEPTION 'invalid_email'; END IF;
  IF length(btrim(coalesce(p_password,''))) < 1 THEN RAISE EXCEPTION 'password_required'; END IF;

  SELECT id INTO v_admin_id FROM public.members WHERE auth_user_id = auth.uid();
  IF v_admin_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_existing FROM public.email_accounts
    WHERE lower(email_address::text) = lower(p_email) AND is_shared = true;
  IF FOUND THEN
    SELECT vault.create_secret(p_password,
      'shared_email_account:' || v_existing.id || ':' || p_email,
      'Shared email pwd (rotated) ' || p_email) INTO v_secret_id;
    UPDATE public.email_accounts
      SET imap_host = p_imap_host, imap_port = p_imap_port,
          smtp_host = p_smtp_host, smtp_port = p_smtp_port,
          vault_secret_id = v_secret_id, display_name = coalesce(p_display_name, display_name),
          active = true
     WHERE id = v_existing.id RETURNING * INTO v_account;
    DELETE FROM vault.secrets WHERE id = v_existing.vault_secret_id;
  ELSE
    SELECT vault.create_secret(p_password,
      'shared_email_account:' || gen_random_uuid()::text || ':' || p_email,
      'Shared email pwd ' || p_email) INTO v_secret_id;
    INSERT INTO public.email_accounts(
      member_id, email_address, imap_host, imap_port, smtp_host, smtp_port,
      vault_secret_id, display_name, granted_by, is_shared
    ) VALUES (
      v_admin_id, p_email, p_imap_host, p_imap_port, p_smtp_host, p_smtp_port,
      v_secret_id, p_display_name, v_admin_id, true
    ) RETURNING * INTO v_account;
  END IF;

  -- Alle aktiven Admins als Shared-Admin eintragen (idempotent)
  INSERT INTO public.shared_email_admins(account_id, member_id, granted_by)
  SELECT v_account.id, m.id, v_admin_id
    FROM public.members m
   WHERE m.role = 'admin' AND m.revoked_at IS NULL
  ON CONFLICT (account_id, member_id) DO NOTHING;

  RETURN v_account;
END; $$;

REVOKE ALL ON FUNCTION public.grant_shared_email_account(text, text, text, int, text, int, text) FROM public;
GRANT EXECUTE ON FUNCTION public.grant_shared_email_account(text, text, text, int, text, int, text) TO authenticated;

-- Trigger: bei role-Wechsel auf 'admin' → zu allen shared Accounts hinzu;
-- bei Verlust der Admin-Rolle oder Revoke → aus allen shared Accounts raus
CREATE OR REPLACE FUNCTION public._sync_shared_admins_on_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.role = 'admin' AND (OLD.role IS DISTINCT FROM 'admin') AND NEW.revoked_at IS NULL THEN
    INSERT INTO public.shared_email_admins(account_id, member_id)
    SELECT e.id, NEW.id
      FROM public.email_accounts e
     WHERE e.is_shared = true AND e.active = true
    ON CONFLICT (account_id, member_id) DO NOTHING;
  END IF;
  IF (OLD.role = 'admin' AND NEW.role IS DISTINCT FROM 'admin')
     OR (NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL) THEN
    DELETE FROM public.shared_email_admins WHERE member_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_shared_admins_on_role_change ON public.members;
CREATE TRIGGER trg_sync_shared_admins_on_role_change
  AFTER UPDATE OF role, revoked_at ON public.members
  FOR EACH ROW EXECUTE FUNCTION public._sync_shared_admins_on_role_change();

-- Backfill (idempotent)
INSERT INTO public.shared_email_admins(account_id, member_id)
SELECT e.id, m.id
  FROM public.email_accounts e
  JOIN public.members m ON m.role = 'admin' AND m.revoked_at IS NULL
 WHERE e.is_shared = true AND e.active = true
ON CONFLICT (account_id, member_id) DO NOTHING;
