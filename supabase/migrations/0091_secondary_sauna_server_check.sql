-- 0091_secondary_sauna_server_check.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Bug: Nutzer konnte einen Aufguss in der Zweit-Sauna anlegen obwohl die
-- Garantie-Sauna noch offene Personal-Fallback-Slots hatte. Frontend hat
-- die UI gesperrt, aber create_infusion (Migration 0069) und
-- create_infusion_kiosk (Migration 0070) prüften das serverseitig NICHT.
--
-- Fix: Beide RPCs bekommen einen check_secondary_sauna_allowed-Aufruf,
-- der genau die Regel aus can_plan_secondary durchsetzt:
--   - Wenn Slot in Nicht-Garantie-Sauna liegt
--   - UND der Tag noch offene Garantie-Slots hat (Personal-Fallback statt
--     echter Aufgießer)
--   → reject mit deutscher Fehlermeldung.
--
-- Admins dürfen das wie bisher umgehen (haben volle Planungs-Hoheit).
-- Personal-Fallback-Inserts sind explizit ausgenommen (sie SIND ja der
-- Garantie-Slot).
-- ─────────────────────────────────────────────────────────────────────────

-- ─── Helper-Funktion ─────────────────────────────────────────────────────
create or replace function public.check_secondary_sauna_allowed(
  p_sauna_id uuid,
  p_start_time timestamptz
) returns void
language plpgsql stable
set search_path = public, pg_temp as $$
declare
  v_temp smallint;
  v_garantie_sauna_id uuid;
  v_day date;
begin
  -- Slot in keiner Garantie-Stunde (z.B. zu früh/spät) → keine Sperre
  v_temp := public.garantie_temperature_for(p_start_time);
  if v_temp is null then return; end if;

  -- Slot IN der Garantie-Sauna für diese Stunde → immer erlaubt
  v_garantie_sauna_id := public.garantie_sauna_for(p_start_time);
  if v_garantie_sauna_id = p_sauna_id then return; end if;

  -- Slot in Zweit-Sauna → prüfe ob Tages-Garantie schon komplett erfüllt
  v_day := (p_start_time at time zone 'Europe/Berlin')::date;
  if not public.can_plan_secondary(v_day) then
    raise exception '⛔ Zweit-Sauna gesperrt — erst die offenen Personal-Slots in der dran-Sauna übernehmen. (Slot-Stunde % %)',
      to_char(p_start_time at time zone 'Europe/Berlin', 'HH24:MI'),
      to_char(p_start_time at time zone 'Europe/Berlin', 'DD.MM.');
  end if;
end;
$$;
revoke all on function public.check_secondary_sauna_allowed(uuid, timestamptz) from public;
grant execute on function public.check_secondary_sauna_allowed(uuid, timestamptz) to anon, authenticated;

-- ─── create_infusion mit Garantie-Check ──────────────────────────────────
create or replace function public.create_infusion(
  p_sauna_id uuid,
  p_start_time timestamptz,
  p_duration_minutes int,
  p_title text,
  p_description text default null,
  p_attributes text[] default array[]::text[],
  p_oils text[] default null,
  p_saunameister_id uuid default null,
  p_template_id uuid default null,
  p_team_infusion boolean default false,
  p_is_personal_fallback boolean default false
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_member_id uuid;
  v_is_admin boolean;
  v_is_aufgieser boolean;
  v_new_id uuid;
begin
  select id into v_member_id
  from public.members where auth_user_id = auth.uid() limit 1;

  if v_member_id is null then
    raise exception 'Nicht eingeloggt — bitte neu anmelden.';
  end if;

  v_is_admin := public.is_admin();
  v_is_aufgieser := public.is_aufgieser();

  if not v_is_admin and not v_is_aufgieser then
    raise exception 'Keine Berechtigung — nur Aufgießer und Admins dürfen Aufgüsse anlegen.';
  end if;

  if not v_is_admin and p_saunameister_id is not null and p_saunameister_id != v_member_id then
    raise exception 'Du kannst nur eigene Aufgüsse anlegen (Saunameister-Wechsel ist Admin-only).';
  end if;

  if p_sauna_id is null then raise exception 'Sauna fehlt.'; end if;
  if p_start_time is null then raise exception 'Startzeit fehlt.'; end if;
  if p_duration_minutes is null or p_duration_minutes < 1 then
    raise exception 'Dauer fehlt oder ungültig.';
  end if;

  -- Garantie-Sperre (Admins dürfen alles, Personal-Fallback ist immer erlaubt)
  if not v_is_admin and not p_is_personal_fallback then
    perform public.check_secondary_sauna_allowed(p_sauna_id, p_start_time);
  end if;

  insert into public.infusions (
    sauna_id, start_time, duration_minutes, title, description,
    attributes, oils, saunameister_id, template_id, team_infusion, is_personal_fallback
  ) values (
    p_sauna_id, p_start_time, p_duration_minutes, p_title, p_description,
    p_attributes, p_oils, coalesce(p_saunameister_id, v_member_id), p_template_id,
    p_team_infusion, p_is_personal_fallback
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;
revoke execute on function public.create_infusion(uuid, timestamptz, int, text, text, text[], text[], uuid, uuid, boolean, boolean) from public;
grant execute on function public.create_infusion(uuid, timestamptz, int, text, text, text[], text[], uuid, uuid, boolean, boolean) to authenticated;

-- ─── create_infusion_kiosk mit Garantie-Check ────────────────────────────
create or replace function public.create_infusion_kiosk(
  p_saunameister_id uuid,
  p_sauna_id uuid,
  p_start_time timestamptz,
  p_duration_minutes int,
  p_title text,
  p_description text default null,
  p_attributes text[] default array[]::text[],
  p_oils text[] default null,
  p_template_id uuid default null,
  p_team_infusion boolean default false
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  m public.members%rowtype;
  v_new_id uuid;
begin
  if p_saunameister_id is null then
    raise exception 'Bitte zuerst auswählen, wer du bist.';
  end if;

  select * into m
  from public.members
  where id = p_saunameister_id
    and revoked_at is null
    and (
      (role = 'member' and is_aufgieser = true)
      or role = 'guest_aufgieser'
      or role = 'admin'
    );

  if not found then
    raise exception 'Du musst ein freigeschalteter Aufgießer sein.';
  end if;

  if not m.is_present then
    raise exception 'Bitte zuerst am Eingang einchecken.';
  end if;

  if p_sauna_id is null then raise exception 'Sauna fehlt.'; end if;
  if p_start_time is null then raise exception 'Startzeit fehlt.'; end if;
  if p_duration_minutes is null or p_duration_minutes < 1 then
    raise exception 'Dauer fehlt oder ungültig.';
  end if;
  if p_title is null or length(btrim(p_title)) < 1 then
    raise exception 'Titel fehlt.';
  end if;

  -- Kiosk hat kein Admin-Konzept → Sperre gilt für alle ohne Bypass.
  -- Kein Personal-Fallback am Kiosk (das macht Personal-View).
  perform public.check_secondary_sauna_allowed(p_sauna_id, p_start_time);

  insert into public.infusions (
    sauna_id, start_time, duration_minutes, title, description,
    attributes, oils, saunameister_id, template_id, team_infusion, is_personal_fallback
  ) values (
    p_sauna_id, p_start_time, p_duration_minutes, btrim(p_title), p_description,
    coalesce(p_attributes, array[]::text[]), p_oils, p_saunameister_id, p_template_id,
    coalesce(p_team_infusion, false), false
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;
revoke execute on function public.create_infusion_kiosk(uuid, uuid, timestamptz, int, text, text, text[], text[], uuid, boolean) from public;
grant execute on function public.create_infusion_kiosk(uuid, uuid, timestamptz, int, text, text, text[], text[], uuid, boolean) to anon, authenticated;
