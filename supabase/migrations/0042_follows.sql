-- ─── Migration 0042: Fan-Following + Notification-Queue ──────────────────
-- Gäste/Mitglieder folgen Aufgießern. Bei neuem Aufguss → Push an alle Follower.
-- Notification-Queue als Buffer für async Push-Dispatch über Cron.

-- ─── 1. member_follows ───────────────────────────────────────────────────
create table if not exists public.member_follows (
  follower_id           uuid not null references public.members(id) on delete cascade,
  followee_id           uuid not null references public.members(id) on delete cascade,
  created_at            timestamptz not null default now(),
  notifications_enabled boolean not null default true,
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index if not exists idx_follows_followee on public.member_follows(followee_id);
create index if not exists idx_follows_follower on public.member_follows(follower_id);

alter table public.member_follows enable row level security;

-- Read: Eigene Follows + Aufgießer sieht eigene Fan-Liste
drop policy if exists follows_read_self_or_followee on public.member_follows;
create policy follows_read_self_or_followee on public.member_follows
  for select to authenticated using (
    follower_id = (select id from public.members where auth_user_id = auth.uid())
    or followee_id = (select id from public.members where auth_user_id = auth.uid())
    or public.is_admin()
  );

-- Insert/Delete: Nur eigene Follower-Beziehung
drop policy if exists follows_self_insert on public.member_follows;
create policy follows_self_insert on public.member_follows
  for insert to authenticated with check (
    follower_id = (select id from public.members where auth_user_id = auth.uid())
  );

drop policy if exists follows_self_delete on public.member_follows;
create policy follows_self_delete on public.member_follows
  for delete to authenticated using (
    follower_id = (select id from public.members where auth_user_id = auth.uid())
  );

drop policy if exists follows_self_update on public.member_follows;
create policy follows_self_update on public.member_follows
  for update to authenticated using (
    follower_id = (select id from public.members where auth_user_id = auth.uid())
  );

-- ─── 2. RPCs ─────────────────────────────────────────────────────────────
create or replace function public.follow_member(p_followee uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_follower uuid;
begin
  select id into v_follower from public.members where auth_user_id = auth.uid();
  if v_follower is null then raise exception 'not_logged_in'; end if;
  if v_follower = p_followee then raise exception 'cannot_follow_self'; end if;
  insert into public.member_follows(follower_id, followee_id)
    values (v_follower, p_followee)
    on conflict do nothing;
end$$;
revoke all on function public.follow_member(uuid) from public;
grant execute on function public.follow_member(uuid) to authenticated;

create or replace function public.unfollow_member(p_followee uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_follower uuid;
begin
  select id into v_follower from public.members where auth_user_id = auth.uid();
  if v_follower is null then raise exception 'not_logged_in'; end if;
  delete from public.member_follows
   where follower_id = v_follower and followee_id = p_followee;
end$$;
revoke all on function public.unfollow_member(uuid) from public;
grant execute on function public.unfollow_member(uuid) to authenticated;

create or replace function public.get_my_following()
returns table (
  followee_id uuid,
  name text,
  avatar_path text,
  signature_aufguss text,
  specialties text[],
  is_aufgieser boolean,
  notifications_enabled boolean
)
language sql stable security definer set search_path = public, auth as $$
  select m.id, m.name, m.avatar_path, m.signature_aufguss, m.specialties, m.is_aufgieser, f.notifications_enabled
    from public.member_follows f
    join public.members m on m.id = f.followee_id
   where f.follower_id = (select id from public.members where auth_user_id = auth.uid())
   order by m.name asc;
$$;
revoke all on function public.get_my_following() from public;
grant execute on function public.get_my_following() to authenticated;

-- Aufgießer sieht eigene Top-Fans (sortiert nach Follow-Datum)
create or replace function public.get_top_fans(p_member_id uuid, p_limit int default 20)
returns table (
  follower_id uuid,
  name text,
  avatar_path text,
  followed_at timestamptz
)
language sql stable security definer set search_path = public, auth as $$
  select m.id, m.name, m.avatar_path, f.created_at
    from public.member_follows f
    join public.members m on m.id = f.follower_id
   where f.followee_id = p_member_id
     -- Sichtbar nur für Aufgießer selbst oder Admin
     and (
       p_member_id = (select id from public.members where auth_user_id = auth.uid())
       or public.is_admin()
     )
   order by f.created_at desc
   limit p_limit;
$$;
revoke all on function public.get_top_fans(uuid, int) from public;
grant execute on function public.get_top_fans(uuid, int) to authenticated;

-- Praktischer Helper: folge ich diesem Member?
create or replace function public.am_i_following(p_followee uuid) returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists(
    select 1 from public.member_follows
     where follower_id = (select id from public.members where auth_user_id = auth.uid())
       and followee_id = p_followee
  );
$$;
revoke all on function public.am_i_following(uuid) from public;
grant execute on function public.am_i_following(uuid) to authenticated;

-- ─── 3. notification_queue ───────────────────────────────────────────────
create table if not exists public.notification_queue (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null,             -- 'aufguss_announced' | 'new_post' | 'mentor_request' | 'module_completed'
  payload       jsonb not null,
  dedup_key     text,                      -- z.B. 'aufguss:<infusion_id>' für Idempotenz
  recipient_id  uuid references public.members(id) on delete cascade,  -- null = broadcast (an alle Follower)
  created_at    timestamptz not null default now(),
  processed_at  timestamptz,
  error         text
);

create unique index if not exists idx_notification_queue_dedup
  on public.notification_queue(dedup_key) where dedup_key is not null and processed_at is null;
create index if not exists idx_notification_queue_pending
  on public.notification_queue(created_at) where processed_at is null;

alter table public.notification_queue enable row level security;

-- Nur Service-Role darf lesen/schreiben — kein RLS-Policy für authenticated.
-- Crons greifen über service_role zu.

-- ─── 4. Trigger: Bei neuem Aufguss → Queue-Eintrag ────────────────────────
create or replace function public.notify_followers_of_infusion() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  if coalesce(new.is_personal_fallback, false) = true then return new; end if;
  if new.saunameister_id is null then return new; end if;
  -- Skip wenn keine Follower
  if not exists (select 1 from public.member_follows
                  where followee_id = new.saunameister_id
                    and notifications_enabled) then
    return new;
  end if;
  insert into public.notification_queue(kind, payload, dedup_key)
    values (
      'aufguss_announced',
      jsonb_build_object(
        'infusion_id', new.id,
        'saunameister_id', new.saunameister_id,
        'sauna_id', new.sauna_id,
        'start_time', new.start_time,
        'title', new.title
      ),
      'aufguss:' || new.id::text
    )
    on conflict (dedup_key) where dedup_key is not null and processed_at is null
    do nothing;
  return new;
end$$;

drop trigger if exists trg_notify_followers_on_infusion on public.infusions;
create trigger trg_notify_followers_on_infusion
  after insert on public.infusions
  for each row execute function public.notify_followers_of_infusion();

comment on table public.member_follows is
  'Fan-Following: Mitglieder/Gäste folgen Aufgießern. Push bei neuen Aufgüssen.';
comment on table public.notification_queue is
  'Async Buffer für Push-Notifications. Wird vom Cron in api/push-send.ts verarbeitet.';

-- ─── 5. pg_cron-Schedule: Notification-Queue verarbeiten ─────────────────
create extension if not exists pg_net;

do $$ begin
  perform cron.unschedule('process-notification-queue');
exception when others then null;
end$$;

-- Cron-Secret muss in Supabase Vault hinterlegt sein als 'cron_secret'.
-- Lesen via vault.decrypted_secrets.
select cron.schedule(
  'process-notification-queue',
  '* * * * *',  -- jede Minute
  $job$
  select net.http_post(
    url := 'https://saunascaner.vercel.app/api/push-send?action=process-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1),
        ''
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);
