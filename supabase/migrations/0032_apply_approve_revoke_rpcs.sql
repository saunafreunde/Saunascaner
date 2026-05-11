-- ─── Migration 0032: Antrags-/Genehmigungs-Workflow für Stamm-Slots ───
-- apply_recurring_slot:    Aufgießer beantragt (status='pending')
-- approve_recurring_slot:  Admin gibt frei (status='active') + Materialisierung
-- reject_recurring_slot:   Admin lehnt ab (status='revoked')
-- revoke_my_recurring_slot: Eigentümer kündigt (status='revoked') + Zukunfts-Slots zu Personal-Fallback

-- ─── apply_recurring_slot ────────────────────────────────────────────────
create or replace function public.apply_recurring_slot(
  p_weekday  smallint,
  p_hour     smallint,
  p_sauna_id uuid,
  p_note     text default null
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

  -- Duplikat-Antrag desselben Members verhindern (pending oder active)
  if exists (
    select 1 from public.recurring_slots
     where member_id = v_member.id and weekday = p_weekday and slot_hour = p_hour
       and sauna_id = p_sauna_id and status in ('pending', 'active')
  ) then
    raise exception 'duplicate_request';
  end if;

  insert into public.recurring_slots (member_id, weekday, slot_hour, sauna_id, status, note)
    values (v_member.id, p_weekday, p_hour, p_sauna_id, 'pending', p_note)
    returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.apply_recurring_slot(smallint, smallint, uuid, text) from public;
grant execute on function public.apply_recurring_slot(smallint, smallint, uuid, text) to authenticated;

-- ─── approve_recurring_slot ──────────────────────────────────────────────
create or replace function public.approve_recurring_slot(p_id uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_admin_id uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select id into v_admin_id from public.members where auth_user_id = auth.uid();

  update public.recurring_slots
     set status = 'active', approved_at = now(), approved_by = v_admin_id
   where id = p_id and status = 'pending';
  if not found then raise exception 'not_pending_or_unknown'; end if;

  -- Sofort materialisieren, damit die Slots sichtbar werden
  perform public.materialize_infusion_horizon(8);
end;
$$;

revoke all on function public.approve_recurring_slot(uuid) from public;
grant execute on function public.approve_recurring_slot(uuid) to authenticated;

-- ─── reject_recurring_slot ──────────────────────────────────────────────
create or replace function public.reject_recurring_slot(p_id uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.recurring_slots
     set status = 'revoked'
   where id = p_id and status = 'pending';
  if not found then raise exception 'not_pending_or_unknown'; end if;
end;
$$;

revoke all on function public.reject_recurring_slot(uuid) from public;
grant execute on function public.reject_recurring_slot(uuid) to authenticated;

-- ─── revoke_my_recurring_slot ───────────────────────────────────────────
-- Eigentümer ODER Admin darf kündigen. Zukunfts-Aufgüsse werden auf
-- Personal-Fallback umgestellt.
create or replace function public.revoke_my_recurring_slot(p_id uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_owner_id uuid;
  v_me_id uuid;
begin
  select member_id into v_owner_id from public.recurring_slots where id = p_id;
  if not found then raise exception 'slot_not_found'; end if;
  select id into v_me_id from public.members where auth_user_id = auth.uid();
  if not (public.is_admin() or v_owner_id = v_me_id) then
    raise exception 'not_authorized';
  end if;

  update public.recurring_slots set status = 'revoked' where id = p_id;

  -- Zukunfts-Aufgüsse aus diesem Slot → Personal-Fallback
  update public.infusions
     set saunameister_id      = null,
         is_personal_fallback = true,
         title                = 'Klassischer Aufguss durch das Personal mit naturreinen Stoffen',
         description          = null,
         oils                 = null,
         attributes           = '{}'
   where recurring_slot_id = p_id
     and end_time > now();
end;
$$;

revoke all on function public.revoke_my_recurring_slot(uuid) from public;
grant execute on function public.revoke_my_recurring_slot(uuid) to authenticated;

comment on function public.apply_recurring_slot(smallint, smallint, uuid, text) is
  'Aufgießer beantragt Stamm-Slot. Returnt UUID des Antrags. Errors: not_aufgieser, duplicate_request, invalid_weekday_mo, invalid_hour, invalid_sauna.';
