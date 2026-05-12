-- ─── 0054: Einladungen für Rolle 'gast' erlauben ─────────────────────────
-- CHECK-Constraint und create_invitation-RPC um 'gast' erweitern,
-- damit Admin auch Gäste per Einladungs-Link freischalten kann.

alter table public.invitations
  drop constraint if exists invitations_target_role_check;
alter table public.invitations
  add constraint invitations_target_role_check
  check (target_role = any (array['member','guest_aufgieser','staff','admin','gast']));

create or replace function public.create_invitation(
  p_target_role text,
  p_target_is_aufgieser boolean default false,
  p_note text default null,
  p_expires_at timestamptz default null
) returns public.invitations
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_admin_id uuid;
  v_code text;
  v_inv  public.invitations%rowtype;
  v_attempts int := 0;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_target_role not in ('member','guest_aufgieser','staff','admin','gast') then
    raise exception 'invalid_target_role';
  end if;
  select id into v_admin_id from public.members where auth_user_id = auth.uid();

  loop
    v_code := upper(substring(replace(replace(replace(replace(
      encode(extensions.gen_random_bytes(6), 'base64'),
      '/', ''), '+', ''), '=', ''), 'O', 'X'), 1, 8));
    if length(v_code) < 8 then v_code := v_code || repeat('A', 8 - length(v_code)); end if;
    exit when not exists (select 1 from public.invitations where code = v_code);
    v_attempts := v_attempts + 1;
    if v_attempts > 20 then raise exception 'could_not_generate_code'; end if;
  end loop;

  insert into public.invitations
    (code, target_role, target_is_aufgieser, note, expires_at, created_by)
  values
    (v_code, p_target_role,
     case when p_target_role = 'member' then coalesce(p_target_is_aufgieser, false) else false end,
     nullif(btrim(coalesce(p_note, '')), ''),
     p_expires_at, v_admin_id)
  returning * into v_inv;

  return v_inv;
end;
$$;
revoke all on function public.create_invitation(text, boolean, text, timestamptz) from public;
grant execute on function public.create_invitation(text, boolean, text, timestamptz) to authenticated;
