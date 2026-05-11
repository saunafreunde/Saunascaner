-- ─── Migration 0037: Per-User Email-Konten + Vault-Credentials ───
-- Stufe 2 des Email-Plans. Admin vergibt jedem berechtigten Mitglied ein
-- IMAP/SMTP-Postfach (z.B. christoph@sauna-fds.de). Passwort wird in
-- Supabase Vault verschlüsselt gespeichert — niemals zum Client geliefert.

create table if not exists public.email_accounts (
  id                uuid primary key default gen_random_uuid(),
  member_id         uuid unique not null references public.members(id) on delete cascade,
  email_address     citext unique not null,
  imap_host         text not null default 'w01b00df.kasserver.com',
  imap_port         int  not null default 993,
  smtp_host         text not null default 'w01b00df.kasserver.com',
  smtp_port         int  not null default 465,
  vault_secret_id   uuid not null,
  display_name      text,
  active            boolean not null default true,
  granted_by        uuid references public.members(id) on delete set null,
  granted_at        timestamptz not null default now(),
  last_sync_at      timestamptz,
  unread_count      int not null default 0,
  created_at        timestamptz not null default now()
);
create index if not exists email_accounts_member_idx on public.email_accounts(member_id);
create index if not exists email_accounts_active_idx on public.email_accounts(active) where active;

alter table public.email_accounts enable row level security;

-- SELECT: self ODER Admin
create policy email_accounts_read_self on public.email_accounts
  for select to authenticated
  using (
    member_id = (select id from public.members where auth_user_id = auth.uid())
    or public.is_admin()
  );

-- Schreibzugriff ausschließlich über SECURITY DEFINER RPCs.

-- ─── RPC: grant_email_account (Admin vergibt Postfach) ───────────────────
create or replace function public.grant_email_account(
  p_member_id    uuid,
  p_email        text,
  p_password     text,
  p_imap_host    text default 'w01b00df.kasserver.com',
  p_imap_port    int  default 993,
  p_smtp_host    text default 'w01b00df.kasserver.com',
  p_smtp_port    int  default 465,
  p_display_name text default null
) returns public.email_accounts
language plpgsql security definer set search_path = public, auth, vault, extensions as $$
declare
  v_admin_id      uuid;
  v_secret_id     uuid;
  v_secret_name   text;
  v_account       public.email_accounts%rowtype;
  v_existing      public.email_accounts%rowtype;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if length(btrim(coalesce(p_email, ''))) < 3 then raise exception 'invalid_email'; end if;
  if length(btrim(coalesce(p_password, ''))) < 1 then raise exception 'password_required'; end if;

  select id into v_admin_id from public.members where auth_user_id = auth.uid();

  -- Existiert schon? Dann update mit neuem Passwort
  select * into v_existing from public.email_accounts where member_id = p_member_id;
  if found then
    -- Vault-Secret rotieren: alten löschen + neuen anlegen (kein direct update in vault)
    v_secret_name := 'email_account:' || v_existing.id || ':' || p_email;
    select vault.create_secret(p_password, v_secret_name, 'Email password (rotated) for ' || p_email)
      into v_secret_id;
    -- Update Account
    update public.email_accounts
       set email_address  = p_email,
           imap_host      = p_imap_host,
           imap_port      = p_imap_port,
           smtp_host      = p_smtp_host,
           smtp_port      = p_smtp_port,
           vault_secret_id = v_secret_id,
           display_name   = p_display_name,
           active         = true,
           granted_by     = v_admin_id,
           granted_at     = now()
     where id = v_existing.id
     returning * into v_account;
    -- Altes Secret löschen
    delete from vault.secrets where id = v_existing.vault_secret_id;
    return v_account;
  end if;

  -- Neuer Eintrag: erst die row-ID via gen_random_uuid() vorab erzeugen
  -- damit der Secret-Name die row-id enthält
  v_secret_name := 'email_account:' || gen_random_uuid()::text || ':' || p_email;
  select vault.create_secret(p_password, v_secret_name, 'Email password for ' || p_email)
    into v_secret_id;

  insert into public.email_accounts
    (member_id, email_address, imap_host, imap_port, smtp_host, smtp_port,
     vault_secret_id, display_name, granted_by)
  values
    (p_member_id, p_email, p_imap_host, p_imap_port, p_smtp_host, p_smtp_port,
     v_secret_id, p_display_name, v_admin_id)
  returning * into v_account;

  return v_account;
end;
$$;
revoke all on function public.grant_email_account(uuid, text, text, text, int, text, int, text) from public;
grant execute on function public.grant_email_account(uuid, text, text, text, int, text, int, text) to authenticated;

-- ─── RPC: revoke_email_account (Admin oder Owner entfernt Postfach) ─────
create or replace function public.revoke_email_account(p_id uuid)
returns void
language plpgsql security definer set search_path = public, auth, vault as $$
declare
  v_account public.email_accounts%rowtype;
  v_me_id   uuid;
begin
  select * into v_account from public.email_accounts where id = p_id;
  if not found then raise exception 'account_not_found'; end if;
  select id into v_me_id from public.members where auth_user_id = auth.uid();
  if not (public.is_admin() or v_account.member_id = v_me_id) then
    raise exception 'not_authorized';
  end if;
  -- Vault-Secret löschen
  delete from vault.secrets where id = v_account.vault_secret_id;
  -- Account-Row löschen
  delete from public.email_accounts where id = p_id;
end;
$$;
revoke all on function public.revoke_email_account(uuid) from public;
grant execute on function public.revoke_email_account(uuid) to authenticated;

-- ─── RPC: get_email_credentials (SERVER-SIDE ONLY via Service-Role) ─────
-- Sollte NIE vom Client direkt aufgerufen werden. Vercel-Function nutzt
-- Service-Role-Client → ruft diesen RPC auf um Credentials zu holen.
-- Wir markieren das durch grant nur an `service_role`.
create or replace function public.get_email_credentials(p_member_id uuid)
returns table(
  email_address text, imap_host text, imap_port int,
  smtp_host text, smtp_port int, password text
)
language plpgsql security definer set search_path = public, vault as $$
declare
  v_account public.email_accounts%rowtype;
  v_secret  text;
begin
  select * into v_account from public.email_accounts
   where member_id = p_member_id and active = true;
  if not found then return; end if;

  select decrypted_secret into v_secret
    from vault.decrypted_secrets where id = v_account.vault_secret_id;
  if v_secret is null then return; end if;

  email_address := v_account.email_address;
  imap_host     := v_account.imap_host;
  imap_port     := v_account.imap_port;
  smtp_host     := v_account.smtp_host;
  smtp_port     := v_account.smtp_port;
  password      := v_secret;
  return next;
end;
$$;
revoke all on function public.get_email_credentials(uuid) from public;
revoke all on function public.get_email_credentials(uuid) from anon, authenticated;
grant execute on function public.get_email_credentials(uuid) to service_role;

-- ─── RPC: my_email_account (Frontend: zeigt eigenes Postfach ohne Passwort) ─
create or replace function public.my_email_account()
returns public.email_accounts
language sql stable security definer set search_path = public, auth as $$
  select e.* from public.email_accounts e
    join public.members m on m.id = e.member_id
   where m.auth_user_id = auth.uid()
     and e.active = true
   limit 1;
$$;
revoke all on function public.my_email_account() from public;
grant execute on function public.my_email_account() to authenticated;

-- ─── RPC: list_email_accounts_admin (Admin-Übersicht) ───────────────────
create or replace function public.list_email_accounts_admin()
returns setof public.email_accounts
language sql stable security definer set search_path = public, auth as $$
  select * from public.email_accounts
   where public.is_admin()
   order by created_at desc;
$$;
revoke all on function public.list_email_accounts_admin() from public;
grant execute on function public.list_email_accounts_admin() to authenticated;

comment on table public.email_accounts is
  'Per-User Email-Konten mit Vault-Credentials. Passwort niemals direkt zugänglich, nur via get_email_credentials (service_role).';
