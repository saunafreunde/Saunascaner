-- ─── Migration 0047: Aufguss-Interaktionen ────────────────────────────────
-- 1) infusion_reactions: Emoji-Reactions auf konkrete Aufgüsse (🔥 ❤️ ✨ 💨 🧖)
-- 2) infusion_announcements: "Ich komme heute" — Gäste melden sich an
-- 3) aufguss_wishes: Gäste wünschen sich bestimmten Aufguss-Stil von Aufgießer

-- ─── 1. Reactions auf Aufgüsse ───────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'reaction_kind') then
    create type public.reaction_kind as enum ('fire', 'heart', 'sparkle', 'wind', 'sauna');
  end if;
end$$;

create table if not exists public.infusion_reactions (
  infusion_id uuid not null references public.infusions(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  reaction    public.reaction_kind not null,
  created_at  timestamptz not null default now(),
  primary key (infusion_id, member_id)
);
create index if not exists idx_inf_reactions_infusion on public.infusion_reactions(infusion_id);

alter table public.infusion_reactions enable row level security;

drop policy if exists ir_read on public.infusion_reactions;
create policy ir_read on public.infusion_reactions
  for select to authenticated using (true);

drop policy if exists ir_self on public.infusion_reactions;
create policy ir_self on public.infusion_reactions
  for all to authenticated using (
    member_id = (select id from public.members where auth_user_id = auth.uid())
  ) with check (
    member_id = (select id from public.members where auth_user_id = auth.uid())
  );

create or replace function public.react_to_infusion(
  p_infusion uuid, p_reaction public.reaction_kind
) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid;
begin
  select id into v_me from public.members where auth_user_id = auth.uid();
  if v_me is null then raise exception 'not_logged_in'; end if;
  insert into public.infusion_reactions(infusion_id, member_id, reaction)
    values (p_infusion, v_me, p_reaction)
    on conflict (infusion_id, member_id) do update set reaction = excluded.reaction, created_at = now();
end$$;
revoke all on function public.react_to_infusion(uuid, public.reaction_kind) from public;
grant execute on function public.react_to_infusion(uuid, public.reaction_kind) to authenticated;

create or replace function public.unreact_to_infusion(p_infusion uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid;
begin
  select id into v_me from public.members where auth_user_id = auth.uid();
  delete from public.infusion_reactions where infusion_id = p_infusion and member_id = v_me;
end$$;
revoke all on function public.unreact_to_infusion(uuid) from public;
grant execute on function public.unreact_to_infusion(uuid) to authenticated;

-- ─── 2. Announcements "Ich komme heute" ──────────────────────────────────
create table if not exists public.infusion_announcements (
  infusion_id   uuid not null references public.infusions(id) on delete cascade,
  member_id     uuid not null references public.members(id) on delete cascade,
  announced_at  timestamptz not null default now(),
  message       text check (message is null or char_length(message) <= 200),
  primary key (infusion_id, member_id)
);
create index if not exists idx_announce_infusion on public.infusion_announcements(infusion_id);
create index if not exists idx_announce_member on public.infusion_announcements(member_id);

alter table public.infusion_announcements enable row level security;

drop policy if exists annc_read on public.infusion_announcements;
create policy annc_read on public.infusion_announcements
  for select to authenticated using (true);

drop policy if exists annc_self on public.infusion_announcements;
create policy annc_self on public.infusion_announcements
  for all to authenticated using (
    member_id = (select id from public.members where auth_user_id = auth.uid())
  ) with check (
    member_id = (select id from public.members where auth_user_id = auth.uid())
  );

create or replace function public.announce_attendance(
  p_infusion uuid, p_message text default null
) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid; v_start timestamptz;
begin
  select id into v_me from public.members where auth_user_id = auth.uid();
  if v_me is null then raise exception 'not_logged_in'; end if;
  -- Aufguss muss in der Zukunft liegen
  select start_time into v_start from public.infusions where id = p_infusion;
  if v_start is null then raise exception 'infusion_not_found'; end if;
  if v_start <= now() then raise exception 'infusion_already_started'; end if;
  insert into public.infusion_announcements(infusion_id, member_id, message)
    values (p_infusion, v_me, nullif(btrim(coalesce(p_message, '')), ''))
    on conflict (infusion_id, member_id) do update
      set message = excluded.message, announced_at = now();
end$$;
revoke all on function public.announce_attendance(uuid, text) from public;
grant execute on function public.announce_attendance(uuid, text) to authenticated;

create or replace function public.unannounce_attendance(p_infusion uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid;
begin
  select id into v_me from public.members where auth_user_id = auth.uid();
  delete from public.infusion_announcements where infusion_id = p_infusion and member_id = v_me;
end$$;
revoke all on function public.unannounce_attendance(uuid) from public;
grant execute on function public.unannounce_attendance(uuid) to authenticated;

-- ─── 3. Aufguss-Wünsche ──────────────────────────────────────────────────
create table if not exists public.aufguss_wishes (
  id            uuid primary key default gen_random_uuid(),
  aufgieser_id  uuid not null references public.members(id) on delete cascade,
  author_id     uuid not null references public.members(id) on delete cascade,
  wish_text     text not null check (char_length(wish_text) between 1 and 500),
  -- Optional Tag: welcher Aufguss-Stil (specialty-Slug)
  wish_specialty text,
  created_at    timestamptz not null default now(),
  fulfilled_at  timestamptz,    -- Aufgießer markiert als erfüllt
  deleted_at    timestamptz
);
create index if not exists idx_wishes_aufgieser on public.aufguss_wishes(aufgieser_id, created_at desc) where deleted_at is null;

alter table public.aufguss_wishes enable row level security;

drop policy if exists wishes_read on public.aufguss_wishes;
create policy wishes_read on public.aufguss_wishes
  for select to authenticated using (deleted_at is null);

drop policy if exists wishes_self_insert on public.aufguss_wishes;
create policy wishes_self_insert on public.aufguss_wishes
  for insert to authenticated with check (
    author_id = (select id from public.members where auth_user_id = auth.uid())
  );

drop policy if exists wishes_delete on public.aufguss_wishes;
create policy wishes_delete on public.aufguss_wishes
  for delete to authenticated using (
    author_id = (select id from public.members where auth_user_id = auth.uid())
    or aufgieser_id = (select id from public.members where auth_user_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists wishes_aufgieser_update on public.aufguss_wishes;
create policy wishes_aufgieser_update on public.aufguss_wishes
  for update to authenticated using (
    aufgieser_id = (select id from public.members where auth_user_id = auth.uid())
  );

-- Likes auf Wünsche (signalisieren "ich auch")
create table if not exists public.aufguss_wish_likes (
  wish_id    uuid not null references public.aufguss_wishes(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wish_id, member_id)
);
create index if not exists idx_wish_likes_wish on public.aufguss_wish_likes(wish_id);

alter table public.aufguss_wish_likes enable row level security;

drop policy if exists wishlikes_read on public.aufguss_wish_likes;
create policy wishlikes_read on public.aufguss_wish_likes
  for select to authenticated using (true);
drop policy if exists wishlikes_self on public.aufguss_wish_likes;
create policy wishlikes_self on public.aufguss_wish_likes
  for all to authenticated using (
    member_id = (select id from public.members where auth_user_id = auth.uid())
  ) with check (
    member_id = (select id from public.members where auth_user_id = auth.uid())
  );

-- ─── 4. Listing-RPCs ─────────────────────────────────────────────────────
create or replace function public.get_infusion_reactions(p_infusion uuid)
returns jsonb language sql stable security definer set search_path = public, auth as $$
  select jsonb_build_object(
    'counts', (
      select coalesce(jsonb_object_agg(reaction, cnt), '{}'::jsonb)
        from (select reaction, count(*) as cnt from public.infusion_reactions
               where infusion_id = p_infusion group by reaction) sq
    ),
    'my_reaction', (
      select reaction from public.infusion_reactions
       where infusion_id = p_infusion
         and member_id = (select id from public.members where auth_user_id = auth.uid())
    ),
    'total', (select count(*) from public.infusion_reactions where infusion_id = p_infusion)
  );
$$;
revoke all on function public.get_infusion_reactions(uuid) from public;
grant execute on function public.get_infusion_reactions(uuid) to authenticated;

create or replace function public.list_infusion_announcements(p_infusion uuid)
returns table (
  member_id uuid,
  name text,
  avatar_path text,
  is_aufgieser boolean,
  announced_at timestamptz,
  message text,
  is_me boolean
)
language sql stable security definer set search_path = public, auth as $$
  select a.member_id, m.name, m.avatar_path, m.is_aufgieser,
         a.announced_at, a.message,
         (a.member_id = (select id from public.members where auth_user_id = auth.uid())) as is_me
    from public.infusion_announcements a
    join public.members m on m.id = a.member_id
   where a.infusion_id = p_infusion
   order by a.announced_at asc;
$$;
revoke all on function public.list_infusion_announcements(uuid) from public;
grant execute on function public.list_infusion_announcements(uuid) to authenticated;

create or replace function public.list_aufguss_wishes(p_aufgieser_id uuid, p_limit int default 50)
returns table (
  id uuid,
  author_id uuid,
  author_name text,
  author_avatar text,
  wish_text text,
  wish_specialty text,
  created_at timestamptz,
  fulfilled_at timestamptz,
  like_count bigint,
  liked_by_me boolean,
  is_my_wish boolean
)
language sql stable security definer set search_path = public, auth as $$
  select w.id, w.author_id, m.name, m.avatar_path, w.wish_text, w.wish_specialty,
         w.created_at, w.fulfilled_at,
         (select count(*) from public.aufguss_wish_likes l where l.wish_id = w.id),
         exists (select 1 from public.aufguss_wish_likes l
                  where l.wish_id = w.id
                    and l.member_id = (select id from public.members where auth_user_id = auth.uid())),
         (w.author_id = (select id from public.members where auth_user_id = auth.uid()))
    from public.aufguss_wishes w
    join public.members m on m.id = w.author_id
   where w.aufgieser_id = p_aufgieser_id
     and w.deleted_at is null
   order by
     w.fulfilled_at nulls first,
     (select count(*) from public.aufguss_wish_likes l where l.wish_id = w.id) desc,
     w.created_at desc
   limit p_limit;
$$;
revoke all on function public.list_aufguss_wishes(uuid, int) from public;
grant execute on function public.list_aufguss_wishes(uuid, int) to authenticated;

create or replace function public.mark_wish_fulfilled(p_wish_id uuid, p_fulfilled boolean default true) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid; v_aufgieser uuid;
begin
  select id into v_me from public.members where auth_user_id = auth.uid();
  select aufgieser_id into v_aufgieser from public.aufguss_wishes where id = p_wish_id;
  if v_aufgieser <> v_me and not public.is_admin() then
    raise exception 'only_aufgieser_can_mark_fulfilled';
  end if;
  update public.aufguss_wishes
     set fulfilled_at = case when p_fulfilled then now() else null end
   where id = p_wish_id;
end$$;
revoke all on function public.mark_wish_fulfilled(uuid, boolean) from public;
grant execute on function public.mark_wish_fulfilled(uuid, boolean) to authenticated;

comment on table public.infusion_reactions is 'Emoji-Reactions auf konkrete Aufgüsse (1 Reaction pro Member pro Aufguss).';
comment on table public.infusion_announcements is '"Ich komme heute" — Gäste melden Anwesenheit bei zukünftigen Aufgüssen an.';
comment on table public.aufguss_wishes is 'Aufguss-Wünsche von Gästen an Aufgießer (mit Like-System).';
