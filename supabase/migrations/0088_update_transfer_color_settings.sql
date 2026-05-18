-- 0088_update_transfer_color_settings.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 3 neue Features:
--   1) update_infusion RPC: eigene Aufgüsse bearbeiten (oder Admin alle)
--   2) transfer_infusion RPC: eigenen Aufguss an anderen Aufgießer übergeben
--   3) attribute_colors + oil_colors in system_config für Color-Override
-- ─────────────────────────────────────────────────────────────────────────

-- ─── 1. update_infusion ─────────────────────────────────────────────────
create or replace function public.update_infusion(
  p_id uuid,
  p_title text,
  p_description text default null,
  p_attributes text[] default null,
  p_oils text[] default null,
  p_team_infusion boolean default null,
  p_duration_minutes int default null
) returns text
language plpgsql security definer set search_path = public, auth as $$
declare
  v_meister_id uuid;
  v_start_time timestamptz;
  v_caller_id uuid;
  v_is_admin boolean;
begin
  select id into v_caller_id from public.members where auth_user_id = auth.uid();
  if v_caller_id is null then return 'not_authenticated'; end if;
  v_is_admin := public.is_admin();

  select saunameister_id, start_time
    into v_meister_id, v_start_time
    from public.infusions where id = p_id;
  if v_start_time is null then return 'infusion_not_found'; end if;

  if not v_is_admin and v_meister_id <> v_caller_id then
    return 'not_owner';
  end if;

  if not v_is_admin and now() > (v_start_time - interval '60 minutes') then
    return 'lock_window_active';
  end if;

  update public.infusions set
    title             = coalesce(p_title, title),
    description       = coalesce(p_description, description),
    attributes        = coalesce(p_attributes, attributes),
    oils              = coalesce(p_oils, oils),
    team_infusion     = coalesce(p_team_infusion, team_infusion),
    duration_minutes  = coalesce(p_duration_minutes, duration_minutes)
  where id = p_id;

  return 'ok';
end;
$$;
revoke all on function public.update_infusion(uuid, text, text, text[], text[], boolean, int) from public;
grant execute on function public.update_infusion(uuid, text, text, text[], text[], boolean, int) to authenticated;

-- ─── 2. transfer_infusion ───────────────────────────────────────────────
create or replace function public.transfer_infusion(
  p_id uuid,
  p_to_member_id uuid
) returns text
language plpgsql security definer set search_path = public, auth as $$
declare
  v_meister_id uuid;
  v_start_time timestamptz;
  v_caller_id uuid;
  v_is_admin boolean;
  v_target_is_aufg boolean;
begin
  select id into v_caller_id from public.members where auth_user_id = auth.uid();
  if v_caller_id is null then return 'not_authenticated'; end if;
  v_is_admin := public.is_admin();

  select saunameister_id, start_time
    into v_meister_id, v_start_time
    from public.infusions where id = p_id;
  if v_start_time is null then return 'infusion_not_found'; end if;

  if not v_is_admin and v_meister_id <> v_caller_id then
    return 'not_owner';
  end if;
  if not v_is_admin and now() > (v_start_time - interval '60 minutes') then
    return 'lock_window_active';
  end if;

  select coalesce(is_aufgieser, false) into v_target_is_aufg
    from public.members where id = p_to_member_id;
  if not v_target_is_aufg then return 'target_not_aufgieser'; end if;

  if v_meister_id = p_to_member_id then return 'already_owner'; end if;

  update public.infusions set
    saunameister_id = p_to_member_id
  where id = p_id;

  return 'ok';
end;
$$;
revoke all on function public.transfer_infusion(uuid, uuid) from public;
grant execute on function public.transfer_infusion(uuid, uuid) to authenticated;

-- ─── 3. Color-Defaults ───────────────────────────────────────────────────
insert into public.system_config (key, value) values
  ('attribute_colors', '{}'::jsonb)
on conflict (key) do nothing;

insert into public.system_config (key, value) values
  ('oil_colors', '{}'::jsonb)
on conflict (key) do nothing;

create or replace function public.get_attribute_colors() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select value from public.system_config where key = 'attribute_colors'),
    '{}'::jsonb
  );
$$;
revoke all on function public.get_attribute_colors() from public;
grant execute on function public.get_attribute_colors() to anon, authenticated;

create or replace function public.get_oil_colors() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select value from public.system_config where key = 'oil_colors'),
    '{}'::jsonb
  );
$$;
revoke all on function public.get_oil_colors() from public;
grant execute on function public.get_oil_colors() to anon, authenticated;

create or replace function public.set_attribute_color(p_attr text, p_color text) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_new jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden: admin only'; end if;
  if p_color is null or p_color = '' then
    v_new := coalesce(
      (select value from public.system_config where key = 'attribute_colors'),
      '{}'::jsonb
    ) - p_attr;
  else
    if p_color !~ '^#[0-9a-fA-F]{3,8}$' then raise exception 'invalid color: %', p_color; end if;
    v_new := coalesce(
      (select value from public.system_config where key = 'attribute_colors'),
      '{}'::jsonb
    ) || jsonb_build_object(p_attr, p_color);
  end if;
  insert into public.system_config (key, value) values ('attribute_colors', v_new)
  on conflict (key) do update set value = excluded.value;
  return v_new;
end;
$$;
revoke all on function public.set_attribute_color(text, text) from public;
grant execute on function public.set_attribute_color(text, text) to authenticated;

create or replace function public.set_oil_color(p_oil text, p_color text) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_new jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden: admin only'; end if;
  if p_color is null or p_color = '' then
    v_new := coalesce(
      (select value from public.system_config where key = 'oil_colors'),
      '{}'::jsonb
    ) - p_oil;
  else
    if p_color !~ '^#[0-9a-fA-F]{3,8}$' then raise exception 'invalid color: %', p_color; end if;
    v_new := coalesce(
      (select value from public.system_config where key = 'oil_colors'),
      '{}'::jsonb
    ) || jsonb_build_object(p_oil, p_color);
  end if;
  insert into public.system_config (key, value) values ('oil_colors', v_new)
  on conflict (key) do update set value = excluded.value;
  return v_new;
end;
$$;
revoke all on function public.set_oil_color(text, text) from public;
grant execute on function public.set_oil_color(text, text) to authenticated;
