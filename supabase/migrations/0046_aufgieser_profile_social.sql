-- ─── Migration 0046: Aufgießer-Profil-Aufwertung + Gästebuch ─────────────
-- 1) Foto-Galerie: bis zu 8 Fotos pro Aufgießer (eigene Atelier-/Action-Bilder)
-- 2) Lieblings-Öle: max 5 Slugs aus oils.ts
-- 3) Gästebuch: öffentliche Kommentare unter Aufgießer-Profilen

-- ─── 1. Foto-Galerie ─────────────────────────────────────────────────────
create table if not exists public.aufgieser_photos (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  photo_path  text not null,          -- 'aufgieser-photos/<uuid>.jpg' (Storage)
  caption     text,                   -- optional, max 200 Z
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  constraint photo_caption_length check (caption is null or char_length(caption) <= 200)
);
create index if not exists idx_aufgieser_photos_member on public.aufgieser_photos(member_id, sort_order);

alter table public.aufgieser_photos enable row level security;

-- Read: alle authenticated
drop policy if exists photos_read on public.aufgieser_photos;
create policy photos_read on public.aufgieser_photos
  for select to authenticated using (true);

-- Self-Write: nur eigener Aufgießer
drop policy if exists photos_self_insert on public.aufgieser_photos;
create policy photos_self_insert on public.aufgieser_photos
  for insert to authenticated with check (
    member_id = (select id from public.members where auth_user_id = auth.uid())
    and public.is_aufgieser()
  );

drop policy if exists photos_self_update on public.aufgieser_photos;
create policy photos_self_update on public.aufgieser_photos
  for update to authenticated using (
    member_id = (select id from public.members where auth_user_id = auth.uid())
  );

drop policy if exists photos_self_delete on public.aufgieser_photos;
create policy photos_self_delete on public.aufgieser_photos
  for delete to authenticated using (
    member_id = (select id from public.members where auth_user_id = auth.uid())
    or public.is_admin()
  );

-- Max 8 Fotos pro Aufgießer (Constraint via Trigger)
create or replace function public.enforce_photo_limit() returns trigger
language plpgsql security definer as $$
declare v_count int;
begin
  select count(*) into v_count from public.aufgieser_photos where member_id = new.member_id;
  if v_count >= 8 then raise exception 'photo_limit_reached: max 8 photos per Aufgießer'; end if;
  return new;
end$$;
drop trigger if exists trg_enforce_photo_limit on public.aufgieser_photos;
create trigger trg_enforce_photo_limit
  before insert on public.aufgieser_photos
  for each row execute function public.enforce_photo_limit();

-- ─── 2. Lieblings-Öle ────────────────────────────────────────────────────
alter table public.members
  add column if not exists favorite_oils text[] default '{}';

alter table public.members drop constraint if exists favorite_oils_max5;
alter table public.members
  add constraint favorite_oils_max5 check (array_length(favorite_oils, 1) is null or array_length(favorite_oils, 1) <= 5);

create or replace function public.set_my_favorite_oils(p_oils text[]) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_aufgieser() then
    raise exception 'only_aufgieser_can_set_oils';
  end if;
  if p_oils is not null and array_length(p_oils, 1) > 5 then
    raise exception 'max 5 oils allowed';
  end if;
  update public.members
     set favorite_oils = coalesce(p_oils, '{}'::text[])
   where auth_user_id = auth.uid();
end$$;
revoke all on function public.set_my_favorite_oils(text[]) from public;
grant execute on function public.set_my_favorite_oils(text[]) to authenticated;

-- ─── 3. Gästebuch (Kommentare unter Aufgießer-Profil) ────────────────────
create table if not exists public.aufgieser_comments (
  id           uuid primary key default gen_random_uuid(),
  aufgieser_id uuid not null references public.members(id) on delete cascade,
  author_id    uuid not null references public.members(id) on delete cascade,
  content      text not null check (char_length(content) between 1 and 1000),
  parent_id    uuid references public.aufgieser_comments(id) on delete cascade,
  created_at   timestamptz not null default now(),
  edited_at    timestamptz,
  deleted_at   timestamptz,
  check (aufgieser_id <> author_id or parent_id is not null)  -- Aufgießer kann nur Antworten, keine Top-Kommentare auf sich selbst
);
create index if not exists idx_comments_aufgieser on public.aufgieser_comments(aufgieser_id, created_at desc) where deleted_at is null;
create index if not exists idx_comments_parent on public.aufgieser_comments(parent_id) where deleted_at is null;

alter table public.aufgieser_comments enable row level security;

-- Read: alle authenticated (öffentlich für eingeloggte User)
drop policy if exists comments_read on public.aufgieser_comments;
create policy comments_read on public.aufgieser_comments
  for select to authenticated using (deleted_at is null);

-- Insert: eigener author_id
drop policy if exists comments_self_insert on public.aufgieser_comments;
create policy comments_self_insert on public.aufgieser_comments
  for insert to authenticated with check (
    author_id = (select id from public.members where auth_user_id = auth.uid())
  );

-- Update: eigener Kommentar (max 24h für Editieren)
drop policy if exists comments_self_update on public.aufgieser_comments;
create policy comments_self_update on public.aufgieser_comments
  for update to authenticated using (
    author_id = (select id from public.members where auth_user_id = auth.uid())
  );

-- Delete (soft): eigener Kommentar, Aufgießer kann unter eigenem Profil löschen, Admin alles
drop policy if exists comments_delete on public.aufgieser_comments;
create policy comments_delete on public.aufgieser_comments
  for delete to authenticated using (
    author_id = (select id from public.members where auth_user_id = auth.uid())
    or aufgieser_id = (select id from public.members where auth_user_id = auth.uid())
    or public.is_admin()
  );

-- Likes für Kommentare (light gewichtet)
create table if not exists public.aufgieser_comment_likes (
  comment_id uuid not null references public.aufgieser_comments(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, member_id)
);
create index if not exists idx_comment_likes_comment on public.aufgieser_comment_likes(comment_id);

alter table public.aufgieser_comment_likes enable row level security;
drop policy if exists comment_likes_read on public.aufgieser_comment_likes;
create policy comment_likes_read on public.aufgieser_comment_likes
  for select to authenticated using (true);
drop policy if exists comment_likes_self on public.aufgieser_comment_likes;
create policy comment_likes_self on public.aufgieser_comment_likes
  for all to authenticated using (
    member_id = (select id from public.members where auth_user_id = auth.uid())
  ) with check (
    member_id = (select id from public.members where auth_user_id = auth.uid())
  );

-- ─── 4. Listing-RPC: Gästebuch eines Aufgießers ──────────────────────────
create or replace function public.list_aufgieser_comments(p_aufgieser_id uuid, p_limit int default 50)
returns table (
  id uuid,
  author_id uuid,
  author_name text,
  author_avatar text,
  author_role text,
  author_is_aufgieser boolean,
  content text,
  parent_id uuid,
  created_at timestamptz,
  edited_at timestamptz,
  like_count bigint,
  liked_by_me boolean,
  can_delete boolean
)
language sql stable security definer set search_path = public, auth as $$
  select c.id, c.author_id, m.name, m.avatar_path, m.role, m.is_aufgieser,
         c.content, c.parent_id, c.created_at, c.edited_at,
         (select count(*) from public.aufgieser_comment_likes l where l.comment_id = c.id) as like_count,
         exists (
           select 1 from public.aufgieser_comment_likes l
           where l.comment_id = c.id
             and l.member_id = (select id from public.members where auth_user_id = auth.uid())
         ) as liked_by_me,
         (
           c.author_id = (select id from public.members where auth_user_id = auth.uid())
           or c.aufgieser_id = (select id from public.members where auth_user_id = auth.uid())
           or public.is_admin()
         ) as can_delete
    from public.aufgieser_comments c
    join public.members m on m.id = c.author_id
   where c.aufgieser_id = p_aufgieser_id
     and c.deleted_at is null
   order by c.created_at desc
   limit p_limit;
$$;
revoke all on function public.list_aufgieser_comments(uuid, int) from public;
grant execute on function public.list_aufgieser_comments(uuid, int) to authenticated;

-- ─── 5. RPC: Letzte Bewertungs-Kommentare eines Aufgießers (für Karussell) ─
create or replace function public.list_aufgieser_rating_comments(p_aufgieser_id uuid, p_limit int default 10)
returns table (
  rating_id uuid,
  infusion_id uuid,
  infusion_title text,
  rated_at timestamptz,
  author_name text,
  author_avatar text,
  comment text,
  avg_score numeric
)
language sql stable security definer set search_path = public, auth as $$
  select r.id, i.id, i.title, r.created_at, m.name, m.avatar_path, r.comment,
         round(((r.chemie + r.luftbewegung + r.wedeltechnik + r.hitzeniveau + r.musik + r.duftentwicklung) / 6.0)::numeric, 1)
    from public.infusion_ratings r
    join public.infusions i on i.id = r.infusion_id
    join public.members m on m.id = r.member_id
   where i.saunameister_id = p_aufgieser_id
     and r.comment is not null
     and char_length(btrim(r.comment)) > 0
   order by r.created_at desc
   limit p_limit;
$$;
revoke all on function public.list_aufgieser_rating_comments(uuid, int) from public;
grant execute on function public.list_aufgieser_rating_comments(uuid, int) to authenticated;

-- ─── 6. RPC: Rating-Radar (6-Dimensionen-Durchschnitt) ───────────────────
create or replace function public.get_aufgieser_rating_radar(p_aufgieser_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'chemie',          coalesce(round(avg(r.chemie)::numeric, 2), 0),
    'luftbewegung',    coalesce(round(avg(r.luftbewegung)::numeric, 2), 0),
    'wedeltechnik',    coalesce(round(avg(r.wedeltechnik)::numeric, 2), 0),
    'hitzeniveau',     coalesce(round(avg(r.hitzeniveau)::numeric, 2), 0),
    'musik',           coalesce(round(avg(r.musik)::numeric, 2), 0),
    'duftentwicklung', coalesce(round(avg(r.duftentwicklung)::numeric, 2), 0),
    'sample_size',     count(*)
  )
    from public.infusion_ratings r
    join public.infusions i on i.id = r.infusion_id
   where i.saunameister_id = p_aufgieser_id;
$$;
revoke all on function public.get_aufgieser_rating_radar(uuid) from public;
grant execute on function public.get_aufgieser_rating_radar(uuid) to authenticated;

comment on table public.aufgieser_photos is 'Foto-Galerie pro Aufgießer (max 8). Storage: assets/aufgieser-photos/';
comment on table public.aufgieser_comments is 'Gästebuch unter Aufgießer-Profilen. Threading via parent_id.';
comment on column public.members.favorite_oils is 'Bis zu 5 Lieblings-Öl-Slugs (Aroma-Wolke auf Star-Profil).';
