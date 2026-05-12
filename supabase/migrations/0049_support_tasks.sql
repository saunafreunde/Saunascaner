-- ─── Migration 0049: Unterstützer-Aufgaben + Helfer-Achievements ─────────
-- Aufgaben-Pool für Nicht-Aufgießer-Mitglieder: Admin erstellt Aufgaben mit
-- optionalem Termin, Limit, Kategorie, Sichtbarkeit. Mitglieder melden sich
-- an, optionale Notiz. Badge-Trigger bei Anmeldung.

-- ─── 1. Enums ────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'support_task_category') then
    create type public.support_task_category as enum ('event','care','material','social','other');
  end if;
  if not exists (select 1 from pg_type where typname = 'support_task_visibility') then
    create type public.support_task_visibility as enum ('all','member_only','staff_only','aufgieser');
  end if;
end$$;

-- ─── 2. Tabellen ─────────────────────────────────────────────────────────
create table if not exists public.support_tasks (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (char_length(title) between 1 and 200),
  description     text check (description is null or char_length(description) <= 2000),
  category        public.support_task_category not null default 'other',
  visibility      public.support_task_visibility not null default 'all',
  start_time      timestamptz,
  end_time        timestamptz,
  max_helpers     int check (max_helpers is null or max_helpers > 0),
  location        text check (location is null or char_length(location) <= 200),
  created_by      uuid references public.members(id) on delete set null,
  created_at      timestamptz not null default now(),
  archived_at     timestamptz,
  archived_reason text
);
create index if not exists idx_support_tasks_list
  on public.support_tasks(archived_at, start_time)
  where archived_at is null;
create index if not exists idx_support_tasks_category on public.support_tasks(category);

create table if not exists public.support_task_helpers (
  task_id      uuid not null references public.support_tasks(id) on delete cascade,
  member_id    uuid not null references public.members(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  note         text check (note is null or char_length(note) <= 300),
  left_at      timestamptz,
  fulfilled_at timestamptz,
  primary key (task_id, member_id)
);
create index if not exists idx_helpers_member on public.support_task_helpers(member_id, joined_at desc) where left_at is null;
create index if not exists idx_helpers_task on public.support_task_helpers(task_id) where left_at is null;

-- ─── 3. RLS ──────────────────────────────────────────────────────────────
alter table public.support_tasks enable row level security;
alter table public.support_task_helpers enable row level security;

-- Tasks: read alle authenticated mit Visibility-Filter
drop policy if exists support_tasks_read on public.support_tasks;
create policy support_tasks_read on public.support_tasks
  for select to authenticated using (
    visibility = 'all'
    or (visibility = 'member_only'    and exists (select 1 from public.members where auth_user_id = auth.uid() and role in ('member','admin')))
    or (visibility = 'staff_only'     and exists (select 1 from public.members where auth_user_id = auth.uid() and role in ('staff','admin')))
    or (visibility = 'aufgieser'      and public.is_aufgieser())
    or public.is_admin()
  );

-- Tasks: write nur Admin
drop policy if exists support_tasks_write_admin on public.support_tasks;
create policy support_tasks_write_admin on public.support_tasks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Helpers: read alle authenticated
drop policy if exists support_helpers_read on public.support_task_helpers;
create policy support_helpers_read on public.support_task_helpers
  for select to authenticated using (true);

-- Helpers: write nur eigene
drop policy if exists support_helpers_self_insert on public.support_task_helpers;
create policy support_helpers_self_insert on public.support_task_helpers
  for insert to authenticated with check (
    member_id = (select id from public.members where auth_user_id = auth.uid())
  );

drop policy if exists support_helpers_self_update on public.support_task_helpers;
create policy support_helpers_self_update on public.support_task_helpers
  for update to authenticated using (
    member_id = (select id from public.members where auth_user_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists support_helpers_self_delete on public.support_task_helpers;
create policy support_helpers_self_delete on public.support_task_helpers
  for delete to authenticated using (
    member_id = (select id from public.members where auth_user_id = auth.uid())
    or public.is_admin()
  );

-- ─── 4. RPCs (Member-Side) ───────────────────────────────────────────────
create or replace function public.join_support_task(p_task_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_me uuid;
  v_max int;
  v_count int;
  v_archived timestamptz;
begin
  select id into v_me from public.members where auth_user_id = auth.uid();
  if v_me is null then raise exception 'not_logged_in'; end if;

  select max_helpers, archived_at into v_max, v_archived from public.support_tasks where id = p_task_id;
  if v_archived is not null then raise exception 'task_archived'; end if;

  -- Bei max_helpers prüfen
  if v_max is not null then
    select count(*) into v_count
      from public.support_task_helpers
     where task_id = p_task_id and left_at is null;
    if v_count >= v_max then raise exception 'task_full'; end if;
  end if;

  insert into public.support_task_helpers(task_id, member_id, note, left_at)
    values (p_task_id, v_me, nullif(btrim(coalesce(p_note,'')), ''), null)
    on conflict (task_id, member_id) do update
      set left_at = null,
          note = coalesce(excluded.note, public.support_task_helpers.note),
          joined_at = case when public.support_task_helpers.left_at is not null then now() else public.support_task_helpers.joined_at end;
end$$;
revoke all on function public.join_support_task(uuid, text) from public;
grant execute on function public.join_support_task(uuid, text) to authenticated;

create or replace function public.leave_support_task(p_task_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid;
begin
  select id into v_me from public.members where auth_user_id = auth.uid();
  update public.support_task_helpers
     set left_at = now()
   where task_id = p_task_id and member_id = v_me;
end$$;
revoke all on function public.leave_support_task(uuid) from public;
grant execute on function public.leave_support_task(uuid) to authenticated;

-- ─── 5. RPCs (Admin-Side) ────────────────────────────────────────────────
create or replace function public.create_support_task(
  p_title text, p_description text default null,
  p_category public.support_task_category default 'other',
  p_visibility public.support_task_visibility default 'all',
  p_start_time timestamptz default null,
  p_end_time timestamptz default null,
  p_max_helpers int default null,
  p_location text default null
) returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid; v_id uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select id into v_me from public.members where auth_user_id = auth.uid();
  insert into public.support_tasks(title, description, category, visibility, start_time, end_time, max_helpers, location, created_by)
    values (btrim(p_title), nullif(btrim(coalesce(p_description,'')), ''), p_category, p_visibility, p_start_time, p_end_time, p_max_helpers, nullif(btrim(coalesce(p_location,'')), ''), v_me)
    returning id into v_id;
  return v_id;
end$$;
revoke all on function public.create_support_task(text, text, public.support_task_category, public.support_task_visibility, timestamptz, timestamptz, int, text) from public;
grant execute on function public.create_support_task(text, text, public.support_task_category, public.support_task_visibility, timestamptz, timestamptz, int, text) to authenticated;

create or replace function public.archive_support_task(p_id uuid, p_reason text default 'erledigt')
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.support_tasks
     set archived_at = now(),
         archived_reason = coalesce(p_reason, 'erledigt')
   where id = p_id;
end$$;
revoke all on function public.archive_support_task(uuid, text) from public;
grant execute on function public.archive_support_task(uuid, text) to authenticated;

create or replace function public.unarchive_support_task(p_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.support_tasks
     set archived_at = null, archived_reason = null
   where id = p_id;
end$$;
revoke all on function public.unarchive_support_task(uuid) from public;
grant execute on function public.unarchive_support_task(uuid) to authenticated;

create or replace function public.mark_helper_fulfilled(p_task_id uuid, p_member_id uuid, p_fulfilled boolean default true)
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.support_task_helpers
     set fulfilled_at = case when p_fulfilled then now() else null end
   where task_id = p_task_id and member_id = p_member_id;
end$$;
revoke all on function public.mark_helper_fulfilled(uuid, uuid, boolean) from public;
grant execute on function public.mark_helper_fulfilled(uuid, uuid, boolean) to authenticated;

-- ─── 6. List-RPCs ────────────────────────────────────────────────────────
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
  helper_count bigint,
  is_helping_me boolean,
  is_full boolean
)
language sql stable security definer set search_path = public, auth as $$
  with me as (select id from public.members where auth_user_id = auth.uid())
  select t.id, t.title, t.description, t.category, t.visibility,
         t.start_time, t.end_time, t.max_helpers, t.location, t.created_at,
         coalesce((select count(*) from public.support_task_helpers h where h.task_id = t.id and h.left_at is null), 0) as helper_count,
         exists (
           select 1 from public.support_task_helpers h
            where h.task_id = t.id
              and h.member_id = (select id from me)
              and h.left_at is null
         ) as is_helping_me,
         (t.max_helpers is not null
          and (select count(*) from public.support_task_helpers h where h.task_id = t.id and h.left_at is null) >= t.max_helpers) as is_full
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
     (t.start_time is null) asc,  -- erst Termine, dann Pools
     t.start_time asc nulls last,
     t.created_at desc;
$$;
revoke all on function public.list_open_support_tasks() from public;
grant execute on function public.list_open_support_tasks() to authenticated;

create or replace function public.list_my_support_tasks(p_include_archived boolean default true)
returns table (
  task_id uuid,
  title text,
  description text,
  category public.support_task_category,
  start_time timestamptz,
  end_time timestamptz,
  location text,
  joined_at timestamptz,
  note text,
  left_at timestamptz,
  fulfilled_at timestamptz,
  archived_at timestamptz,
  archived_reason text
)
language sql stable security definer set search_path = public, auth as $$
  select t.id, t.title, t.description, t.category, t.start_time, t.end_time, t.location,
         h.joined_at, h.note, h.left_at, h.fulfilled_at, t.archived_at, t.archived_reason
    from public.support_task_helpers h
    join public.support_tasks t on t.id = h.task_id
   where h.member_id = (select id from public.members where auth_user_id = auth.uid())
     and (p_include_archived or (t.archived_at is null and h.left_at is null))
   order by h.joined_at desc;
$$;
revoke all on function public.list_my_support_tasks(boolean) from public;
grant execute on function public.list_my_support_tasks(boolean) to authenticated;

create or replace function public.list_task_helpers(p_task_id uuid)
returns table (
  member_id uuid,
  name text,
  avatar_path text,
  is_aufgieser boolean,
  joined_at timestamptz,
  note text,
  left_at timestamptz,
  fulfilled_at timestamptz
)
language sql stable security definer set search_path = public, auth as $$
  select h.member_id, m.name, m.avatar_path, m.is_aufgieser,
         h.joined_at, h.note, h.left_at, h.fulfilled_at
    from public.support_task_helpers h
    join public.members m on m.id = h.member_id
   where h.task_id = p_task_id
   order by h.joined_at asc;
$$;
revoke all on function public.list_task_helpers(uuid) from public;
grant execute on function public.list_task_helpers(uuid) to authenticated;

-- ─── 7. Achievement-Trigger ──────────────────────────────────────────────
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
  -- Skip wenn left_at gesetzt (Abmeldung)
  if new.left_at is not null then return new; end if;

  -- Task-Daten holen
  select category, start_time, created_at
    into v_task_category, v_task_start, v_task_created
    from public.support_tasks where id = new.task_id;

  -- Volunteer-Count (alle aktiven Einsätze)
  select count(*) into v_total
    from public.support_task_helpers
   where member_id = new.member_id and left_at is null;
  if v_total >= 1   then perform public.award_badge_if_not_exists(new.member_id, 'volunteer_first'); end if;
  if v_total >= 5   then perform public.award_badge_if_not_exists(new.member_id, 'volunteer_5'); end if;
  if v_total >= 25  then perform public.award_badge_if_not_exists(new.member_id, 'volunteer_25'); end if;
  if v_total >= 50  then perform public.award_badge_if_not_exists(new.member_id, 'volunteer_50'); end if;
  if v_total >= 100 then perform public.award_badge_if_not_exists(new.member_id, 'volunteer_100'); end if;

  -- Event-Helfer (Tasks mit start_time)
  if v_task_start is not null then
    select count(*) into v_event
      from public.support_task_helpers h
      join public.support_tasks t on t.id = h.task_id
     where h.member_id = new.member_id
       and h.left_at is null
       and t.start_time is not null;
    if v_event >= 1  then perform public.award_badge_if_not_exists(new.member_id, 'event_helper_first'); end if;
    if v_event >= 5  then perform public.award_badge_if_not_exists(new.member_id, 'event_helper_5'); end if;
    if v_event >= 10 then perform public.award_badge_if_not_exists(new.member_id, 'event_helper_10'); end if;
  end if;

  -- Pflege-Held
  if v_task_category = 'care' then
    select count(*) into v_care
      from public.support_task_helpers h
      join public.support_tasks t on t.id = h.task_id
     where h.member_id = new.member_id
       and h.left_at is null
       and t.category = 'care';
    if v_care >= 1  then perform public.award_badge_if_not_exists(new.member_id, 'care_hero_first'); end if;
    if v_care >= 5  then perform public.award_badge_if_not_exists(new.member_id, 'care_hero_5'); end if;
    if v_care >= 15 then perform public.award_badge_if_not_exists(new.member_id, 'care_hero_15'); end if;
  end if;

  -- Erste-Stunde (innerhalb 1h nach Task-Erstellung angemeldet)
  if v_task_created is not null and new.joined_at < v_task_created + interval '1 hour' then
    select count(*) into v_first_hour
      from public.support_task_helpers h
      join public.support_tasks t on t.id = h.task_id
     where h.member_id = new.member_id
       and h.left_at is null
       and h.joined_at < t.created_at + interval '1 hour';
    if v_first_hour >= 3  then perform public.award_badge_if_not_exists(new.member_id, 'early_bird_helper_3'); end if;
    if v_first_hour >= 10 then perform public.award_badge_if_not_exists(new.member_id, 'early_bird_helper_10'); end if;
  end if;

  return new;
end$$;

drop trigger if exists trg_check_support_achievements on public.support_task_helpers;
create trigger trg_check_support_achievements
  after insert or update of left_at on public.support_task_helpers
  for each row execute function public.check_support_achievements();

comment on table public.support_tasks is
  'Helfer-Aufgaben für Nicht-Aufgießer-Mitglieder (Unterstützer). Admin-CRUD, Member-Anmeldung.';
comment on table public.support_task_helpers is
  'Anmeldungen für support_tasks mit optionaler Notiz, Soft-Delete via left_at, Admin-Fulfilled-Marker.';
