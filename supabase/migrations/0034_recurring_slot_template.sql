-- ─── Migration 0034: Stamm-Slot mit Template-Vorlage ───
-- Christoph (11.05.2026 abend): "stamm tage können vom aufgieser mit
-- vorlagen eingestellt werden" — der Aufgießer wählt beim Antrag eine
-- seiner Aufguss-Vorlagen, die bei jeder Materialisierung benutzt wird.
-- Ohne Template: Fallback-Titel "Stamm-Aufguss" wie bisher.

alter table public.recurring_slots
  add column if not exists template_id uuid references public.infusion_templates(id) on delete set null;

-- apply_recurring_slot um template_id-Param erweitern
create or replace function public.apply_recurring_slot(
  p_weekday    smallint,
  p_hour       smallint,
  p_sauna_id   uuid,
  p_note       text default null,
  p_template_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare
  v_member public.members%rowtype;
  v_id uuid;
begin
  select * into v_member from public.members where auth_user_id = auth.uid();
  if not found then raise exception 'member_not_found'; end if;
  if not v_member.is_aufgieser then raise exception 'not_aufgieser'; end if;
  if p_weekday = 1 then raise exception 'invalid_weekday_mo'; end if;
  if p_weekday < 0 or p_weekday > 6 then raise exception 'invalid_weekday'; end if;
  if p_hour < 11 or p_hour > 20 then raise exception 'invalid_hour'; end if;
  if not exists (select 1 from public.saunas where id = p_sauna_id and is_active) then
    raise exception 'invalid_sauna';
  end if;
  -- Template gehört dem Aufgießer (oder ist global, member_id IS NULL)?
  if p_template_id is not null and not exists (
    select 1 from public.infusion_templates
     where id = p_template_id and (member_id is null or member_id = v_member.id)
  ) then
    raise exception 'invalid_template';
  end if;

  if exists (
    select 1 from public.recurring_slots
     where member_id = v_member.id and weekday = p_weekday and slot_hour = p_hour
       and sauna_id = p_sauna_id and status in ('pending', 'active')
  ) then
    raise exception 'duplicate_request';
  end if;

  insert into public.recurring_slots (member_id, weekday, slot_hour, sauna_id, status, note, template_id)
    values (v_member.id, p_weekday, p_hour, p_sauna_id, 'pending', p_note, p_template_id)
    returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.apply_recurring_slot(smallint, smallint, uuid, text, uuid) from public;
grant execute on function public.apply_recurring_slot(smallint, smallint, uuid, text, uuid) to authenticated;

-- materialize_infusion_horizon: nutzt Template-Daten falls vorhanden
create or replace function public.materialize_infusion_horizon(p_weeks int default 8)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  v_day date;
  v_dow int;
  v_hour int;
  v_start_hour int;
  v_end_hour int := 20;
  v_start_ts timestamptz;
  v_sauna_id uuid;
  v_temp smallint;
  v_slot record;
  v_tpl public.infusion_templates%rowtype;
  v_horizon_end date := current_date + (p_weeks * 7);
begin
  v_day := current_date;
  while v_day <= v_horizon_end loop
    v_dow := extract(dow from v_day)::int;

    if v_dow <> 1 then
      if v_dow in (2,3,4) then v_start_hour := 14;
      else v_start_hour := 11;
      end if;

      v_hour := v_start_hour;
      while v_hour <= v_end_hour loop
        v_start_ts := (v_day::text || ' ' || lpad(v_hour::text, 2, '0') || ':00:00')::timestamp at time zone 'Europe/Berlin';
        v_temp := public.garantie_temperature_for(v_start_ts);
        if v_temp is not null then
          v_sauna_id := public.garantie_sauna_for(v_start_ts);

          if v_sauna_id is not null then
            if not exists (
              select 1 from public.infusions
               where sauna_id = v_sauna_id and start_time = v_start_ts
            ) then
              select rs.id, rs.member_id, rs.template_id into v_slot
                from public.recurring_slots rs
               where rs.status = 'active'
                 and rs.sauna_id = v_sauna_id
                 and rs.weekday = v_dow
                 and rs.slot_hour = v_hour
                 and rs.active_from <= v_day
                 and not exists (
                       select 1 from public.aufgieser_absences a
                        where a.member_id = rs.member_id
                          and v_day between a.start_date and a.end_date
                     )
               limit 1;

              if found then
                -- Template-Daten holen falls vorhanden
                if v_slot.template_id is not null then
                  select * into v_tpl from public.infusion_templates where id = v_slot.template_id;
                  if found then
                    insert into public.infusions
                      (sauna_id, saunameister_id, recurring_slot_id, template_id, title, description, attributes, oils,
                       start_time, duration_minutes, is_personal_fallback, temperature_c)
                    values
                      (v_sauna_id, v_slot.member_id, v_slot.id, v_tpl.id,
                       v_tpl.title, v_tpl.description, v_tpl.attributes, v_tpl.oils,
                       v_start_ts, coalesce(v_tpl.duration_minutes, 15), false, v_temp);
                  else
                    -- Template wurde gelöscht: fall through zu Default-Stamm-Aufguss
                    insert into public.infusions
                      (sauna_id, saunameister_id, recurring_slot_id, title, attributes, start_time, duration_minutes, is_personal_fallback, temperature_c)
                    values
                      (v_sauna_id, v_slot.member_id, v_slot.id, 'Stamm-Aufguss', '{}', v_start_ts, 15, false, v_temp);
                  end if;
                else
                  insert into public.infusions
                    (sauna_id, saunameister_id, recurring_slot_id, title, attributes, start_time, duration_minutes, is_personal_fallback, temperature_c)
                  values
                    (v_sauna_id, v_slot.member_id, v_slot.id, 'Stamm-Aufguss', '{}', v_start_ts, 15, false, v_temp);
                end if;
              else
                insert into public.infusions
                  (sauna_id, saunameister_id, recurring_slot_id, title, attributes, start_time, duration_minutes, is_personal_fallback, temperature_c)
                values
                  (v_sauna_id, null, null,
                   'Klassischer Aufguss durch das Personal mit naturreinen Stoffen',
                   '{}', v_start_ts, 15, true, v_temp);
              end if;
              v_count := v_count + 1;
            end if;
          end if;
        end if;
        v_hour := v_hour + 1;
      end loop;
    end if;

    v_day := v_day + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.materialize_infusion_horizon(int) from public;
grant execute on function public.materialize_infusion_horizon(int) to authenticated;

-- ─── RPC: takeover_personal_fallback ─────────────────────────────────────
-- Ein Aufgießer übernimmt einen Personal-Fallback-Aufguss und macht ihn zu
-- seinem eigenen. UPDATE statt INSERT (vermeidet Unique-Conflict auf
-- (sauna_id, start_time)).
create or replace function public.takeover_personal_fallback(
  p_infusion_id uuid,
  p_title       text,
  p_description text default null,
  p_attributes  text[] default '{}',
  p_oils        text[] default null,
  p_team_infusion boolean default false
) returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_member public.members%rowtype;
  v_inf public.infusions%rowtype;
begin
  select * into v_member from public.members where auth_user_id = auth.uid();
  if not found then raise exception 'member_not_found'; end if;
  if not v_member.is_aufgieser then raise exception 'not_aufgieser'; end if;

  select * into v_inf from public.infusions where id = p_infusion_id;
  if not found then raise exception 'infusion_not_found'; end if;
  if not v_inf.is_personal_fallback then raise exception 'not_a_fallback'; end if;
  if v_inf.end_time <= now() then raise exception 'slot_in_past'; end if;
  if length(btrim(coalesce(p_title, ''))) < 1 then raise exception 'title_required'; end if;

  update public.infusions
     set saunameister_id      = v_member.id,
         is_personal_fallback = false,
         title                = btrim(p_title),
         description          = nullif(btrim(coalesce(p_description, '')), ''),
         attributes           = coalesce(p_attributes, '{}'),
         oils                 = p_oils,
         team_infusion        = coalesce(p_team_infusion, false)
   where id = p_infusion_id;
end;
$$;

revoke all on function public.takeover_personal_fallback(uuid, text, text, text[], text[], boolean) from public;
grant execute on function public.takeover_personal_fallback(uuid, text, text, text[], text[], boolean) to authenticated;

comment on function public.takeover_personal_fallback(uuid, text, text, text[], text[], boolean) is
  'Aufgießer übernimmt einen Personal-Fallback-Aufguss (UPDATE statt INSERT). Verhindert Unique-Conflict auf (sauna_id, start_time).';
