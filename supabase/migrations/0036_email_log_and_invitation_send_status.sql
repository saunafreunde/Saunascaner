-- ─── Migration 0036: Email-Log + Versand-Status in Invitations ───
-- Fundament für Stufe 1 (System-Mailer + Invite-Mail) und Stufe 3 (Postfach).
-- email_log dient Admin-Debugging + Bounce-Tracking.
-- invitations.sent_* nimmt Versand-Metadaten (Empfänger-Email, Zeitpunkt,
-- absendender Admin, Versandweg).

-- ─── 1. Invitations: Versand-Spalten ─────────────────────────────────────
alter table public.invitations
  add column if not exists sent_to_email     text,
  add column if not exists sent_at           timestamptz,
  add column if not exists sent_by_member_id uuid references public.members(id) on delete set null,
  add column if not exists sent_via          text check (sent_via in ('admin_account','system_fallback'));

create index if not exists invitations_sent_at_idx on public.invitations(sent_at) where sent_at is not null;

-- ─── 2. Email-Log ─────────────────────────────────────────────────────────
create table if not exists public.email_log (
  id                     uuid primary key default gen_random_uuid(),
  sent_at                timestamptz not null default now(),
  recipient              text not null,
  subject                text,
  template_name          text,
  status                 text not null check (status in ('queued','sent','failed','bounced')),
  error                  text,
  related_invitation_id  uuid references public.invitations(id) on delete set null,
  related_member_id      uuid references public.members(id) on delete set null,
  sender_email           text,
  sender_member_id       uuid references public.members(id) on delete set null
);
create index if not exists email_log_sent_at_idx on public.email_log(sent_at desc);
create index if not exists email_log_status_idx  on public.email_log(status) where status <> 'sent';

alter table public.email_log enable row level security;

-- Nur Admin darf das Mail-Log lesen
create policy email_log_read_admin on public.email_log
  for select to authenticated using (public.is_admin());

-- Schreibzugriff ausschließlich über SECURITY DEFINER RPCs.

-- ─── 3. RPC: Log-Einträge schreiben (vom Backend nach Mail-Versand) ─────
create or replace function public.log_email_send(
  p_recipient            text,
  p_subject              text,
  p_template_name        text,
  p_status               text,
  p_error                text default null,
  p_related_invitation_id uuid default null,
  p_related_member_id    uuid default null,
  p_sender_email         text default null,
  p_sender_member_id     uuid default null
) returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare
  v_id uuid;
begin
  -- Sicherheits-Check: nur authentifizierte können loggen
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.email_log
    (recipient, subject, template_name, status, error,
     related_invitation_id, related_member_id, sender_email, sender_member_id)
  values
    (p_recipient, p_subject, p_template_name, p_status, p_error,
     p_related_invitation_id, p_related_member_id, p_sender_email, p_sender_member_id)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.log_email_send(text, text, text, text, text, uuid, uuid, text, uuid) from public;
grant execute on function public.log_email_send(text, text, text, text, text, uuid, uuid, text, uuid) to authenticated;

-- ─── 4. RPC: Invitation als versendet markieren ─────────────────────────
create or replace function public.mark_invitation_sent(
  p_invitation_id uuid,
  p_recipient_email text,
  p_via text
) returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_member_id uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_via not in ('admin_account','system_fallback') then raise exception 'invalid_via'; end if;
  select id into v_member_id from public.members where auth_user_id = auth.uid();
  update public.invitations
     set sent_to_email     = p_recipient_email,
         sent_at           = now(),
         sent_by_member_id = v_member_id,
         sent_via          = p_via
   where id = p_invitation_id;
  if not found then raise exception 'invitation_not_found'; end if;
end;
$$;
revoke all on function public.mark_invitation_sent(uuid, text, text) from public;
grant execute on function public.mark_invitation_sent(uuid, text, text) to authenticated;

comment on table public.email_log is
  'Audit-Log aller System-/Admin-Mail-Sends. Admin-only SELECT, Insert via log_email_send RPC.';
