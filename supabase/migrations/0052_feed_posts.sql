-- ─── Migration 0052: Mini-Insta-Feed ─────────────────────────────────────
-- Zentraler Bild-Feed für alle Rollen (inkl. Gäste). Posts können optional
-- an einen Aufguss "geheftet" und mit bis zu 3 Ölen (Aroma-Tags) versehen
-- werden. 5 sauna-spezifische Reactions statt klassisches Like.
-- Bilder liegen im existierenden `assets`-Bucket unter `feed-posts/<...>`.

-- ─── 1. Enum für Reactions ───────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'feed_reaction_type') then
    create type public.feed_reaction_type as enum ('fire','water','leaf','crown','theater');
  end if;
end$$;

-- ─── 2. Tabelle: feed_posts ──────────────────────────────────────────────
create table if not exists public.feed_posts (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.members(id) on delete cascade,
  image_path   text not null,
  caption      text check (caption is null or char_length(caption) <= 280),
  infusion_id  uuid references public.infusions(id) on delete set null,
  oils         text[] not null default '{}',
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  deleted_by   uuid references public.members(id),
  constraint feed_posts_oils_max3 check (array_length(oils, 1) is null or array_length(oils, 1) <= 3)
);

create index if not exists idx_feed_posts_visible
  on public.feed_posts (created_at desc)
  where deleted_at is null;
create index if not exists idx_feed_posts_infusion
  on public.feed_posts (infusion_id)
  where infusion_id is not null and deleted_at is null;
create index if not exists idx_feed_posts_author
  on public.feed_posts (author_id, created_at desc)
  where deleted_at is null;
create index if not exists idx_feed_posts_oils_gin
  on public.feed_posts using gin (oils)
  where deleted_at is null;

alter table public.feed_posts enable row level security;

drop policy if exists feed_posts_read on public.feed_posts;
create policy feed_posts_read on public.feed_posts
  for select to authenticated using (deleted_at is null or public.is_admin());

drop policy if exists feed_posts_self_insert on public.feed_posts;
create policy feed_posts_self_insert on public.feed_posts
  for insert to authenticated with check (
    author_id = (select id from public.members where auth_user_id = auth.uid())
  );

-- Update/Delete laufen über RPCs (security definer) — keine direkten Policies nötig
drop policy if exists feed_posts_admin_update on public.feed_posts;
create policy feed_posts_admin_update on public.feed_posts
  for update to authenticated using (public.is_admin());

-- ─── 3. Tabelle: feed_post_reactions ─────────────────────────────────────
create table if not exists public.feed_post_reactions (
  post_id    uuid not null references public.feed_posts(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  reaction   public.feed_reaction_type not null,
  created_at timestamptz not null default now(),
  primary key (post_id, member_id, reaction)
);
create index if not exists idx_feed_reactions_post on public.feed_post_reactions(post_id);

alter table public.feed_post_reactions enable row level security;

drop policy if exists feed_reactions_read on public.feed_post_reactions;
create policy feed_reactions_read on public.feed_post_reactions
  for select to authenticated using (true);

drop policy if exists feed_reactions_self on public.feed_post_reactions;
create policy feed_reactions_self on public.feed_post_reactions
  for all to authenticated using (
    member_id = (select id from public.members where auth_user_id = auth.uid())
  ) with check (
    member_id = (select id from public.members where auth_user_id = auth.uid())
  );

-- ─── 4. Echo-Tracking (verhindert wiederholten Echo-Prompt) ──────────────
alter table public.infusion_ratings
  add column if not exists feed_echo_dismissed_at timestamptz;

-- ─── 5. RPCs ─────────────────────────────────────────────────────────────

-- create_feed_post: jeder authentifizierte User darf posten
create or replace function public.create_feed_post(
  p_image_path text,
  p_caption    text default null,
  p_infusion_id uuid default null,
  p_oils       text[] default '{}'
) returns public.feed_posts
language plpgsql security definer set search_path = public, auth as $$
declare
  v_me uuid;
  v_caption text;
  v_oils text[];
  v_post public.feed_posts;
begin
  select id into v_me from public.members where auth_user_id = auth.uid();
  if v_me is null then raise exception 'not_logged_in'; end if;
  if p_image_path is null or btrim(p_image_path) = '' then
    raise exception 'image_required';
  end if;
  v_caption := nullif(btrim(coalesce(p_caption, '')), '');
  if v_caption is not null and char_length(v_caption) > 280 then
    raise exception 'caption_too_long';
  end if;
  v_oils := coalesce(p_oils, '{}'::text[]);
  if array_length(v_oils, 1) is not null and array_length(v_oils, 1) > 3 then
    raise exception 'too_many_oils';
  end if;

  insert into public.feed_posts (author_id, image_path, caption, infusion_id, oils)
    values (v_me, p_image_path, v_caption, p_infusion_id, v_oils)
  returning * into v_post;
  return v_post;
end$$;
revoke all on function public.create_feed_post(text, text, uuid, text[]) from public;
grant execute on function public.create_feed_post(text, text, uuid, text[]) to authenticated;

-- delete_my_feed_post: Author löscht seinen eigenen Post (soft)
create or replace function public.delete_my_feed_post(p_post_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid; v_author uuid;
begin
  select id into v_me from public.members where auth_user_id = auth.uid();
  select author_id into v_author from public.feed_posts where id = p_post_id;
  if v_author is null then raise exception 'post_not_found'; end if;
  if v_author <> v_me then raise exception 'not_your_post'; end if;
  update public.feed_posts set deleted_at = now() where id = p_post_id;
end$$;
revoke all on function public.delete_my_feed_post(uuid) from public;
grant execute on function public.delete_my_feed_post(uuid) to authenticated;

-- admin_delete_feed_post: Admin-Moderation
create or replace function public.admin_delete_feed_post(p_post_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid;
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  select id into v_me from public.members where auth_user_id = auth.uid();
  update public.feed_posts
     set deleted_at = now(), deleted_by = v_me
   where id = p_post_id;
end$$;
revoke all on function public.admin_delete_feed_post(uuid) from public;
grant execute on function public.admin_delete_feed_post(uuid) to authenticated;

-- react_to_feed_post: Toggle einer Reaction (User kann mehrere Typen setzen)
create or replace function public.react_to_feed_post(
  p_post_id uuid, p_reaction public.feed_reaction_type
) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid; v_exists boolean;
begin
  select id into v_me from public.members where auth_user_id = auth.uid();
  if v_me is null then raise exception 'not_logged_in'; end if;
  select exists(
    select 1 from public.feed_post_reactions
     where post_id = p_post_id and member_id = v_me and reaction = p_reaction
  ) into v_exists;
  if v_exists then
    delete from public.feed_post_reactions
      where post_id = p_post_id and member_id = v_me and reaction = p_reaction;
  else
    insert into public.feed_post_reactions (post_id, member_id, reaction)
      values (p_post_id, v_me, p_reaction);
  end if;
end$$;
revoke all on function public.react_to_feed_post(uuid, public.feed_reaction_type) from public;
grant execute on function public.react_to_feed_post(uuid, public.feed_reaction_type) to authenticated;

-- list_feed: paginierter Feed mit Cursor, optional Filter (Oil / Infusion)
create or replace function public.list_feed(
  p_limit int default 20,
  p_before timestamptz default null,
  p_filter_oil text default null,
  p_filter_infusion uuid default null
) returns table (
  id uuid,
  author_id uuid,
  author_name text,
  author_avatar text,
  author_role text,
  image_path text,
  caption text,
  infusion_id uuid,
  infusion_title text,
  infusion_aufgieser_name text,
  infusion_start_time timestamptz,
  oils text[],
  created_at timestamptz,
  reaction_counts jsonb,
  my_reactions text[]
)
language sql stable security definer set search_path = public, auth as $$
  with me as (
    select id from public.members where auth_user_id = auth.uid()
  )
  select
    p.id, p.author_id,
    m.name as author_name,
    m.avatar_path as author_avatar,
    m.role::text as author_role,
    p.image_path,
    p.caption,
    p.infusion_id,
    i.title as infusion_title,
    a.name as infusion_aufgieser_name,
    i.start_time as infusion_start_time,
    p.oils,
    p.created_at,
    coalesce((
      select jsonb_object_agg(reaction, cnt) from (
        select reaction, count(*) as cnt
          from public.feed_post_reactions r
         where r.post_id = p.id
         group by reaction
      ) sq
    ), '{}'::jsonb) as reaction_counts,
    coalesce((
      select array_agg(reaction::text)
        from public.feed_post_reactions r
       where r.post_id = p.id
         and r.member_id = (select id from me)
    ), '{}'::text[]) as my_reactions
  from public.feed_posts p
  join public.members m on m.id = p.author_id
  left join public.infusions i on i.id = p.infusion_id
  left join public.members a on a.id = i.saunameister_id
  where p.deleted_at is null
    and (p_before is null or p.created_at < p_before)
    and (p_filter_oil is null or p_filter_oil = any(p.oils))
    and (p_filter_infusion is null or p.infusion_id = p_filter_infusion)
  order by p.created_at desc
  limit greatest(1, least(p_limit, 50));
$$;
revoke all on function public.list_feed(int, timestamptz, text, uuid) from public;
grant execute on function public.list_feed(int, timestamptz, text, uuid) to authenticated;

-- list_member_feed_posts: für Polaroid-Galerie auf Star-Profil
create or replace function public.list_member_feed_posts(
  p_member_id uuid, p_limit int default 12
) returns table (
  id uuid,
  image_path text,
  caption text,
  infusion_id uuid,
  infusion_title text,
  oils text[],
  created_at timestamptz,
  reaction_total bigint
)
language sql stable security definer set search_path = public, auth as $$
  select p.id, p.image_path, p.caption, p.infusion_id, i.title, p.oils, p.created_at,
         (select count(*) from public.feed_post_reactions r where r.post_id = p.id)
    from public.feed_posts p
    left join public.infusions i on i.id = p.infusion_id
   where p.author_id = p_member_id
     and p.deleted_at is null
   order by p.created_at desc
   limit greatest(1, least(p_limit, 50));
$$;
revoke all on function public.list_member_feed_posts(uuid, int) from public;
grant execute on function public.list_member_feed_posts(uuid, int) to authenticated;

-- list_infusion_feed_posts: alle Posts zu einem Aufguss (Aufguss-Detail-Sheet)
create or replace function public.list_infusion_feed_posts(p_infusion_id uuid)
returns table (
  id uuid,
  author_id uuid,
  author_name text,
  author_avatar text,
  image_path text,
  caption text,
  oils text[],
  created_at timestamptz,
  reaction_total bigint
)
language sql stable security definer set search_path = public, auth as $$
  select p.id, p.author_id, m.name, m.avatar_path, p.image_path, p.caption, p.oils, p.created_at,
         (select count(*) from public.feed_post_reactions r where r.post_id = p.id)
    from public.feed_posts p
    join public.members m on m.id = p.author_id
   where p.infusion_id = p_infusion_id
     and p.deleted_at is null
   order by p.created_at desc;
$$;
revoke all on function public.list_infusion_feed_posts(uuid) from public;
grant execute on function public.list_infusion_feed_posts(uuid) to authenticated;

-- dismiss_feed_echo: User klickt "Später" im Echo-Modal, nie wieder zeigen
create or replace function public.dismiss_feed_echo(p_infusion_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid;
begin
  select id into v_me from public.members where auth_user_id = auth.uid();
  if v_me is null then raise exception 'not_logged_in'; end if;
  update public.infusion_ratings
     set feed_echo_dismissed_at = now()
   where infusion_id = p_infusion_id and member_id = v_me;
end$$;
revoke all on function public.dismiss_feed_echo(uuid) from public;
grant execute on function public.dismiss_feed_echo(uuid) to authenticated;

-- get_feed_echo_state: Hat User Echo schon weggeklickt? true = darf zeigen
create or replace function public.get_feed_echo_state(p_infusion_id uuid) returns boolean
language sql stable security definer set search_path = public, auth as $$
  select (feed_echo_dismissed_at is null)
    from public.infusion_ratings
   where infusion_id = p_infusion_id
     and member_id = (select id from public.members where auth_user_id = auth.uid());
$$;
revoke all on function public.get_feed_echo_state(uuid) from public;
grant execute on function public.get_feed_echo_state(uuid) to authenticated;

-- list_admin_feed: alle Posts inkl. gelöschte für Moderation
create or replace function public.list_admin_feed(
  p_show_deleted boolean default false,
  p_limit int default 100
) returns table (
  id uuid,
  author_id uuid,
  author_name text,
  author_avatar text,
  image_path text,
  caption text,
  infusion_id uuid,
  oils text[],
  created_at timestamptz,
  deleted_at timestamptz,
  reaction_total bigint
)
language sql stable security definer set search_path = public, auth as $$
  select p.id, p.author_id, m.name, m.avatar_path, p.image_path, p.caption,
         p.infusion_id, p.oils, p.created_at, p.deleted_at,
         (select count(*) from public.feed_post_reactions r where r.post_id = p.id)
    from public.feed_posts p
    join public.members m on m.id = p.author_id
   where public.is_admin()
     and (p_show_deleted or p.deleted_at is null)
   order by p.created_at desc
   limit greatest(1, least(p_limit, 500));
$$;
revoke all on function public.list_admin_feed(boolean, int) from public;
grant execute on function public.list_admin_feed(boolean, int) to authenticated;

-- ─── 6. Realtime publication ─────────────────────────────────────────────
alter publication supabase_realtime add table public.feed_posts;
alter publication supabase_realtime add table public.feed_post_reactions;

comment on table public.feed_posts is 'Mini-Insta-Feed: 1 Bild + Caption, optional an Aufguss geheftet, mit Aroma-Tags.';
comment on table public.feed_post_reactions is '5 sauna-spezifische Reactions pro Post: fire/water/leaf/crown/theater (mehrere pro User möglich).';
