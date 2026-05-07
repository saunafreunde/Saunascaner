-- Adds the `approved` column that the frontend references but was missing from the initial migration.
-- Super-admins are auto-approved; all others start unapproved until an admin confirms them.

alter table public.members
  add column if not exists approved boolean not null default false;

-- Super-admins are always approved
update public.members set approved = true where role = 'super_admin';

-- New users created by the auth trigger should start unapproved
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.members (auth_user_id, email, name, role, approved)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email), 'saunameister', false)
    on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

-- Bootstrap sets approved = true for the first super admin
create or replace function public.bootstrap_super_admin(p_name text)
returns public.members
language plpgsql security definer set search_path = public, auth as $$
declare
  m public.members%rowtype;
  uid uuid := auth.uid();
  uemail text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.members where role = 'super_admin') then
    raise exception 'super_admin_exists';
  end if;
  select email into uemail from auth.users where id = uid;
  insert into public.members (auth_user_id, email, name, role, approved)
    values (uid, uemail, coalesce(nullif(p_name,''), uemail), 'super_admin', true)
    on conflict (auth_user_id) do update set role = 'super_admin', approved = true
    returning * into m;
  return m;
end;
$$;
grant execute on function public.bootstrap_super_admin(text) to authenticated;

-- RPC: list members waiting for approval
create or replace function public.list_pending_members()
returns table (id uuid, email citext, name text, created_at timestamptz)
language sql security definer set search_path = public as $$
  select id, email, name, created_at
    from public.members
   where approved = false
   order by created_at;
$$;
revoke all on function public.list_pending_members() from public;
grant execute on function public.list_pending_members() to authenticated;

-- RPC: approve a member and optionally set their role
create or replace function public.approve_member(p_member_id uuid, p_role text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.members where auth_user_id = auth.uid() and role = 'super_admin') then
    raise exception 'not_super_admin';
  end if;
  update public.members
     set approved = true,
         role = coalesce(p_role, role)
   where id = p_member_id;
end;
$$;
revoke all on function public.approve_member(uuid, text) from public;
grant execute on function public.approve_member(uuid, text) to authenticated;
