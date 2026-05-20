-- 0096_admin_assign_aufgieser.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Admin-Powers für Aufgießer-Zuweisung:
--   1) update_infusion erweitert um optional p_saunameister_id
--      (Admin kann den Saunameister beim Bearbeiten wechseln)
--   2) admin_set_co_aufgieser: Admin überschreibt komplett die
--      Co-Aufgießer-Liste eines Team-Aufgusses (max 2)
--
-- Erstellung mit Admin-Saunameister geht bereits via create_infusion-RPC
-- (Migration 0069) — p_saunameister_id wird dort Admin-only akzeptiert.
-- ─────────────────────────────────────────────────────────────────────────

-- Alte Signatur droppen (war 7 Params), neue mit 8 Params
drop function if exists public.update_infusion(uuid, text, text, text[], text[], boolean, int);

create or replace function public.update_infusion(
  p_id uuid,
  p_title text,
  p_description text default null,
  p_attributes text[] default null,
  p_oils text[] default null,
  p_team_infusion boolean default null,
  p_duration_minutes int default null,
  p_saunameister_id uuid default null
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

  -- Saunameister-Wechsel nur durch Admin, und nur an aktive Aufgießer
  if p_saunameister_id is not null and p_saunameister_id is distinct from v_meister_id then
    if not v_is_admin then return 'not_admin_for_meister_change'; end if;
    select coalesce(is_aufgieser, false) or role = 'admin' into v_target_is_aufg
      from public.members where id = p_saunameister_id and revoked_at is null;
    if not v_target_is_aufg then return 'target_not_aufgieser'; end if;
  end if;

  update public.infusions set
    title             = coalesce(p_title, title),
    description       = coalesce(p_description, description),
    attributes        = coalesce(p_attributes, attributes),
    oils              = coalesce(p_oils, oils),
    team_infusion     = coalesce(p_team_infusion, team_infusion),
    duration_minutes  = coalesce(p_duration_minutes, duration_minutes),
    saunameister_id   = coalesce(p_saunameister_id, saunameister_id)
  where id = p_id;

  return 'ok';
end;
$$;
revoke all on function public.update_infusion(uuid, text, text, text[], text[], boolean, int, uuid) from public;
grant execute on function public.update_infusion(uuid, text, text, text[], text[], boolean, int, uuid) to authenticated;

-- ─── admin_set_co_aufgieser ──────────────────────────────────────────────
-- Überschreibt komplett die Co-Aufgießer-Liste eines (Team-)Aufgusses.
-- p_member_ids: gewünschte Mitgliederliste (max 2). NULL/leeres Array =
-- alle entfernen. Trigger check_max_co_aufgieser (Migration 0024) bleibt
-- aktiv und greift bei direkten INSERTs — hier umgehen wir ihn durch
-- atomare delete-then-insert via SECURITY DEFINER.

create or replace function public.admin_set_co_aufgieser(
  p_infusion_id uuid,
  p_member_ids uuid[]
) returns text
language plpgsql security definer set search_path = public, auth as $$
declare
  v_is_admin boolean;
  v_exists boolean;
  v_count int;
  v_target uuid;
begin
  v_is_admin := public.is_admin();
  if not v_is_admin then return 'forbidden'; end if;

  if p_infusion_id is null then return 'infusion_not_found'; end if;
  select exists(select 1 from public.infusions where id = p_infusion_id) into v_exists;
  if not v_exists then return 'infusion_not_found'; end if;

  v_count := coalesce(cardinality(p_member_ids), 0);
  if v_count > 2 then return 'too_many_co_aufgieser'; end if;

  -- Validiere alle Member-IDs (müssen Aufgießer sein)
  if v_count > 0 then
    foreach v_target in array p_member_ids loop
      if not exists (
        select 1 from public.members
         where id = v_target
           and revoked_at is null
           and (coalesce(is_aufgieser, false) or role = 'admin' or role = 'guest_aufgieser')
      ) then
        return 'target_not_aufgieser';
      end if;
    end loop;
  end if;

  -- Atomar: delete all + insert new
  delete from public.infusion_co_aufgieser where infusion_id = p_infusion_id;
  if v_count > 0 then
    insert into public.infusion_co_aufgieser (infusion_id, member_id)
    select p_infusion_id, unnest(p_member_ids);
  end if;

  return 'ok';
end;
$$;
revoke all on function public.admin_set_co_aufgieser(uuid, uuid[]) from public;
grant execute on function public.admin_set_co_aufgieser(uuid, uuid[]) to authenticated;
