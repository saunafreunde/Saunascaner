-- ─── Migration 0051: PIN für alle Mitglieder + Aufgaben-Approval ─────────
-- A) PIN-Pool vereinheitlicht: ALLE Mitglieder bekommen einen 4-stelligen
--    checkin_pin (war bisher nur für Gäste). Aufgießer, Mitglieder, Staff,
--    Admin können damit auch am Sauna-Tablet einchecken.
-- B) Aufgaben-Approval pro Aufgabe: Admin kann beim Erstellen wählen ob
--    Helfer-Anmeldungen erst freigegeben werden müssen.

-- ─── A.1) Backfill: PIN für alle Member ohne PIN ──────────────────────────
do $$
declare m record;
begin
  for m in
    select id from public.members
     where checkin_pin is null
       and revoked_at is null
  loop
    update public.members set checkin_pin = public.generate_checkin_pin() where id = m.id;
  end loop;
end$$;

-- ─── A.2) handle_new_user: PIN auch für Nicht-Gäste ──────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare
  v_code text := new.raw_user_meta_data->>'invite_code';
  v_kind text := new.raw_user_meta_data->>'signup_kind';
  v_ref  text := new.raw_user_meta_data->>'gast_referral';
  v_origin text := new.raw_user_meta_data->>'gast_origin';
  v_inv  public.invitations%rowtype;
  v_member_id uuid;
  v_pin char(4);
begin
  v_pin := public.generate_checkin_pin();

  if v_kind = 'gast' then
    insert into public.members (
      auth_user_id, email, name, role, is_aufgieser, approved,
      gast_referral_source, gast_signup_origin, gast_consent_at,
      checkin_pin
    ) values (
      new.id, new.email,
      coalesce(new.raw_user_meta_data->>'name', new.email),
      'gast', false, true,
      v_ref, v_origin, now(),
      v_pin
    )
    on conflict (auth_user_id) do update set
      role = 'gast',
      approved = true,
      gast_referral_source = excluded.gast_referral_source,
      gast_signup_origin = excluded.gast_signup_origin,
      gast_consent_at = coalesce(public.members.gast_consent_at, excluded.gast_consent_at),
      checkin_pin = coalesce(public.members.checkin_pin, excluded.checkin_pin);
    return new;
  end if;

  if v_code is not null and length(v_code) > 0 then
    select * into v_inv from public.invitations
     where code = upper(v_code)
       and used_by is null
       and (expires_at is null or expires_at > now())
     for update;
    if found then
      insert into public.members (auth_user_id, email, name, role, is_aufgieser, approved, checkin_pin)
        values (new.id, new.email,
                coalesce(new.raw_user_meta_data->>'name', new.email),
                v_inv.target_role, v_inv.target_is_aufgieser, true,
                v_pin)
        on conflict (auth_user_id) do update set
          role         = excluded.role,
          is_aufgieser = excluded.is_aufgieser,
          approved     = true,
          checkin_pin  = coalesce(public.members.checkin_pin, excluded.checkin_pin)
        returning id into v_member_id;
      update public.invitations
         set used_by = v_member_id, used_at = now()
       where id = v_inv.id;
      return new;
    end if;
  end if;

  -- Fallback: regulärer Member, unapproved, PIN bereits zugewiesen
  insert into public.members (auth_user_id, email, name, role, approved, checkin_pin)
    values (new.id, new.email,
            coalesce(new.raw_user_meta_data->>'name', new.email),
            'member', false, v_pin)
    on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

-- ─── A.3) approve_member garantiert PIN vorhanden ─────────────────────────
create or replace function public.approve_member(
  p_member_id    uuid,
  p_role         text default 'member',
  p_is_aufgieser boolean default false
) returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_role text := coalesce(p_role, 'member');
  v_aufgieser boolean := coalesce(p_is_aufgieser, false);
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if v_role not in ('gast','member','guest_aufgieser','staff','admin') then
    v_role := 'member';
  end if;
  if v_role <> 'member' then v_aufgieser := false; end if;
  update public.members
     set approved     = true,
         role         = v_role,
         is_aufgieser = v_aufgieser,
         checkin_pin  = coalesce(checkin_pin, public.generate_checkin_pin())
   where id = p_member_id;
end;
$$;

-- ─── A.4) lookup_gast_by_pin → wirkt jetzt für alle Rollen ────────────────
-- Name behalten für Backward-Compat, semantisch jetzt 'lookup_member_by_pin'
create or replace function public.lookup_gast_by_pin(p_pin char(4))
returns table (
  id uuid,
  auth_user_id uuid,
  name text,
  email text,
  role text
)
language sql stable security definer set search_path = public as $$
  select m.id, m.auth_user_id, m.name, m.email, m.role
    from public.members m
   where m.checkin_pin = p_pin
     and m.revoked_at is null
     and m.approved = true
   limit 1;
$$;

-- ─── B.1) support_tasks: requires_approval-Flag ──────────────────────────
alter table public.support_tasks
  add column if not exists requires_approval boolean not null default false;

-- ─── B.2) support_task_helpers: approval-Felder ──────────────────────────
alter table public.support_task_helpers
  add column if not exists approved_at  timestamptz,
  add column if not exists approved_by  uuid references public.members(id) on delete set null,
  add column if not exists rejected_at  timestamptz,
  add column if not exists rejected_by  uuid references public.members(id) on delete set null;

-- ─── B.3) join_support_task: bei requires_approval → approved_at=NULL ────
create or replace function public.join_support_task(p_task_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_me uuid;
  v_max int;
  v_count int;
  v_archived timestamptz;
  v_requires bool;
begin
  select id into v_me from public.members where auth_user_id = auth.uid();
  if v_me is null then raise exception 'not_logged_in'; end if;

  select max_helpers, archived_at, requires_approval
    into v_max, v_archived, v_requires
    from public.support_tasks where id = p_task_id;
  if v_archived is not null then raise exception 'task_archived'; end if;

  if v_max is not null then
    -- Limit nur auf bereits zugewiesene zählen (approved_at not null) wenn requires_approval,
    -- sonst alle aktiven
    select count(*) into v_count
      from public.support_task_helpers
     where task_id = p_task_id
       and left_at is null
       and rejected_at is null
       and (not v_requires or approved_at is not null);
    if v_count >= v_max then raise exception 'task_full'; end if;
  end if;

  insert into public.support_task_helpers(task_id, member_id, note, left_at, approved_at, rejected_at)
    values (
      p_task_id, v_me,
      nullif(btrim(coalesce(p_note,'')), ''),
      null,
      case when v_requires then null else now() end,  -- auto-approve wenn keine Freigabe nötig
      null
    )
    on conflict (task_id, member_id) do update
      set left_at = null,
          rejected_at = null,
          note = coalesce(excluded.note, public.support_task_helpers.note),
          joined_at = case when public.support_task_helpers.left_at is not null then now() else public.support_task_helpers.joined_at end,
          -- bei Wieder-Anmeldung: requires_approval-Status neu auswerten
          approved_at = case
            when v_requires then null
            else now()
          end;
end$$;

-- ─── B.4) approve_helper / reject_helper (Admin-only) ───────────────────
create or replace function public.approve_helper(p_task_id uuid, p_member_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_admin uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select id into v_admin from public.members where auth_user_id = auth.uid();
  update public.support_task_helpers
     set approved_at = now(),
         approved_by = v_admin,
         rejected_at = null,
         rejected_by = null
   where task_id = p_task_id and member_id = p_member_id;
end$$;
revoke all on function public.approve_helper(uuid, uuid) from public;
grant execute on function public.approve_helper(uuid, uuid) to authenticated;

create or replace function public.reject_helper(p_task_id uuid, p_member_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_admin uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select id into v_admin from public.members where auth_user_id = auth.uid();
  update public.support_task_helpers
     set rejected_at = now(),
         rejected_by = v_admin,
         approved_at = null,
         approved_by = null
   where task_id = p_task_id and member_id = p_member_id;
end$$;
revoke all on function public.reject_helper(uuid, uuid) from public;
grant execute on function public.reject_helper(uuid, uuid) to authenticated;

-- ─── B.5) create_support_task um requires_approval ───────────────────────
create or replace function public.create_support_task(
  p_title text, p_description text default null,
  p_category public.support_task_category default 'other',
  p_visibility public.support_task_visibility default 'all',
  p_start_time timestamptz default null,
  p_end_time timestamptz default null,
  p_max_helpers int default null,
  p_location text default null,
  p_requires_approval boolean default false
) returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid; v_id uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select id into v_me from public.members where auth_user_id = auth.uid();
  insert into public.support_tasks(title, description, category, visibility, start_time, end_time, max_helpers, location, created_by, requires_approval)
    values (btrim(p_title), nullif(btrim(coalesce(p_description,'')), ''), p_category, p_visibility, p_start_time, p_end_time, p_max_helpers, nullif(btrim(coalesce(p_location,'')), ''), v_me, coalesce(p_requires_approval, false))
    returning id into v_id;
  return v_id;
end$$;
revoke all on function public.create_support_task(text, text, public.support_task_category, public.support_task_visibility, timestamptz, timestamptz, int, text, boolean) from public;
grant execute on function public.create_support_task(text, text, public.support_task_category, public.support_task_visibility, timestamptz, timestamptz, int, text, boolean) to authenticated;

-- ─── B.6) list_open_support_tasks erweitert: requires_approval + my_status ─
create or replace function public.list_open_support_tasks()
returns table (
  id uuid,
  title text,
  description text,
  category public.support_task_category,
  visibility public.support_task_visibility,
  start_time timestamptz,
  end_time timestamptz,
  max_helpers int,
  location text,
  created_at timestamptz,
  requires_approval boolean,
  helper_count bigint,
  pending_count bigint,
  is_helping_me boolean,
  my_status text,  -- 'pending' | 'approved' | 'rejected' | null
  is_full boolean
)
language sql stable security definer set search_path = public, auth as $$
  with me as (select id from public.members where auth_user_id = auth.uid())
  select t.id, t.title, t.description, t.category, t.visibility,
         t.start_time, t.end_time, t.max_helpers, t.location, t.created_at, t.requires_approval,
         -- helper_count: nur zugewiesene (approved_at not null)
         coalesce((select count(*) from public.support_task_helpers h
                    where h.task_id = t.id
                      and h.left_at is null
                      and h.rejected_at is null
                      and h.approved_at is not null), 0) as helper_count,
         -- pending_count: noch zu freigeben
         coalesce((select count(*) from public.support_task_helpers h
                    where h.task_id = t.id
                      and h.left_at is null
                      and h.rejected_at is null
                      and h.approved_at is null), 0) as pending_count,
         exists (
           select 1 from public.support_task_helpers h
            where h.task_id = t.id
              and h.member_id = (select id from me)
              and h.left_at is null
              and h.rejected_at is null
         ) as is_helping_me,
         (select
            case when rejected_at is not null then 'rejected'
                 when approved_at is not null then 'approved'
                 else 'pending'
            end
            from public.support_task_helpers
           where task_id = t.id
             and member_id = (select id from me)
             and left_at is null
          ) as my_status,
         (t.max_helpers is not null
          and (select count(*) from public.support_task_helpers h
                where h.task_id = t.id
                  and h.left_at is null
                  and h.rejected_at is null
                  and (not t.requires_approval or h.approved_at is not null)
               ) >= t.max_helpers) as is_full
    from public.support_tasks t
   where t.archived_at is null
     and (
       t.visibility = 'all'
       or (t.visibility = 'member_only' and exists (select 1 from public.members where auth_user_id = auth.uid() and role in ('member','admin')))
       or (t.visibility = 'staff_only'  and exists (select 1 from public.members where auth_user_id = auth.uid() and role in ('staff','admin')))
       or (t.visibility = 'aufgieser'   and public.is_aufgieser())
       or public.is_admin()
     )
   order by
     (t.start_time is null) asc,
     t.start_time asc nulls last,
     t.created_at desc;
$$;
revoke all on function public.list_open_support_tasks() from public;
grant execute on function public.list_open_support_tasks() to authenticated;

-- ─── B.7) list_task_helpers um approval-Felder ──────────────────────────
create or replace function public.list_task_helpers(p_task_id uuid)
returns table (
  member_id uuid,
  name text,
  avatar_path text,
  is_aufgieser boolean,
  joined_at timestamptz,
  note text,
  left_at timestamptz,
  fulfilled_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz
)
language sql stable security definer set search_path = public, auth as $$
  select h.member_id, m.name, m.avatar_path, m.is_aufgieser,
         h.joined_at, h.note, h.left_at, h.fulfilled_at,
         h.approved_at, h.rejected_at
    from public.support_task_helpers h
    join public.members m on m.id = h.member_id
   where h.task_id = p_task_id
   order by
     (h.approved_at is null) desc,  -- pending zuerst
     h.joined_at asc;
$$;
revoke all on function public.list_task_helpers(uuid) from public;
grant execute on function public.list_task_helpers(uuid) to authenticated;

-- ─── B.8) Achievement-Trigger: nur bei approved feuern ──────────────────
create or replace function public.check_support_achievements() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_event int;
  v_care int;
  v_first_hour int;
  v_task_category public.support_task_category;
  v_task_start timestamptz;
  v_task_created timestamptz;
begin
  -- Nur bei wirklich zugewiesenen Helfern feuern
  if new.left_at is not null or new.rejected_at is not null then return new; end if;
  if new.approved_at is null then return new; end if;

  select category, start_time, created_at
    into v_task_category, v_task_start, v_task_created
    from public.support_tasks where id = new.task_id;

  select count(*) into v_total
    from public.support_task_helpers
   where member_id = new.member_id
     and left_at is null
     and rejected_at is null
     and approved_at is not null;
  if v_total >= 1   then perform public.award_badge_if_not_exists(new.member_id, 'volunteer_first'); end if;
  if v_total >= 5   then perform public.award_badge_if_not_exists(new.member_id, 'volunteer_5'); end if;
  if v_total >= 25  then perform public.award_badge_if_not_exists(new.member_id, 'volunteer_25'); end if;
  if v_total >= 50  then perform public.award_badge_if_not_exists(new.member_id, 'volunteer_50'); end if;
  if v_total >= 100 then perform public.award_badge_if_not_exists(new.member_id, 'volunteer_100'); end if;

  if v_task_start is not null then
    select count(*) into v_event
      from public.support_task_helpers h
      join public.support_tasks t on t.id = h.task_id
     where h.member_id = new.member_id
       and h.left_at is null and h.rejected_at is null and h.approved_at is not null
       and t.start_time is not null;
    if v_event >= 1  then perform public.award_badge_if_not_exists(new.member_id, 'event_helper_first'); end if;
    if v_event >= 5  then perform public.award_badge_if_not_exists(new.member_id, 'event_helper_5'); end if;
    if v_event >= 10 then perform public.award_badge_if_not_exists(new.member_id, 'event_helper_10'); end if;
  end if;

  if v_task_category = 'care' then
    select count(*) into v_care
      from public.support_task_helpers h
      join public.support_tasks t on t.id = h.task_id
     where h.member_id = new.member_id
       and h.left_at is null and h.rejected_at is null and h.approved_at is not null
       and t.category = 'care';
    if v_care >= 1  then perform public.award_badge_if_not_exists(new.member_id, 'care_hero_first'); end if;
    if v_care >= 5  then perform public.award_badge_if_not_exists(new.member_id, 'care_hero_5'); end if;
    if v_care >= 15 then perform public.award_badge_if_not_exists(new.member_id, 'care_hero_15'); end if;
  end if;

  if v_task_created is not null and new.joined_at < v_task_created + interval '1 hour' then
    select count(*) into v_first_hour
      from public.support_task_helpers h
      join public.support_tasks t on t.id = h.task_id
     where h.member_id = new.member_id
       and h.left_at is null and h.rejected_at is null and h.approved_at is not null
       and h.joined_at < t.created_at + interval '1 hour';
    if v_first_hour >= 3  then perform public.award_badge_if_not_exists(new.member_id, 'early_bird_helper_3'); end if;
    if v_first_hour >= 10 then perform public.award_badge_if_not_exists(new.member_id, 'early_bird_helper_10'); end if;
  end if;

  return new;
end$$;

-- Trigger feuert jetzt auch bei UPDATE OF approved_at
drop trigger if exists trg_check_support_achievements on public.support_task_helpers;
create trigger trg_check_support_achievements
  after insert or update of left_at, approved_at, rejected_at on public.support_task_helpers
  for each row execute function public.check_support_achievements();

comment on column public.support_tasks.requires_approval is
  'Wenn true: Helfer-Anmeldungen müssen vom Admin freigegeben werden (approved_at gesetzt).';
comment on column public.members.checkin_pin is
  '4-stelliger PIN für Sauna-Tablet-Checkin. Wird beim Approve und Signup automatisch generiert. Gilt für alle Rollen (Gast/Mitglied/Aufgießer/Staff/Admin).';
