-- ─── Migration 0041: Aufgießer-Stars (Trading-Card-Profile) ───────────────
-- Erweitert members um Star-Profil-Felder: Bio, Story, Signatur-Aufguss,
-- Specialties (Tags), Style-Quote, Visibility, Accent-Color für Trading-Card.
-- Plus Stats-RPC für die Trading-Card.

-- ─── 1. Neue Spalten ─────────────────────────────────────────────────────
alter table public.members
  add column if not exists bio text,                          -- "Über mich" mehrzeilig
  add column if not exists aufgieser_story text,              -- "Wie ich Aufgießer wurde"
  add column if not exists signature_aufguss text,            -- "Honig-Birke-Salz"
  add column if not exists specialties text[] default '{}',   -- ['salz','honig','birke','eis','musik','licht','kraeuter','show']
  add column if not exists style_quote text,                  -- Persönliches Motto (zusätzlich zu 'motto')
  add column if not exists star_card_visible boolean default true,
  add column if not exists star_accent_color text;            -- Hex '#f59e0b'

-- ─── 2. Constraints ──────────────────────────────────────────────────────
alter table public.members drop constraint if exists bio_length_check;
alter table public.members
  add constraint bio_length_check check (bio is null or char_length(bio) <= 1000);

alter table public.members drop constraint if exists story_length_check;
alter table public.members
  add constraint story_length_check check (aufgieser_story is null or char_length(aufgieser_story) <= 2000);

alter table public.members drop constraint if exists signature_length_check;
alter table public.members
  add constraint signature_length_check check (signature_aufguss is null or char_length(signature_aufguss) <= 100);

alter table public.members drop constraint if exists quote_length_check;
alter table public.members
  add constraint quote_length_check check (style_quote is null or char_length(style_quote) <= 200);

alter table public.members drop constraint if exists accent_color_format_check;
alter table public.members
  add constraint accent_color_format_check check (star_accent_color is null or star_accent_color ~ '^#[0-9a-fA-F]{6}$');

-- ─── 3. GIN-Index für Specialty-Filter ───────────────────────────────────
create index if not exists idx_members_specialties on public.members using gin(specialties);

-- ─── 3b. Forward-Declaration: member_follows (volle Definition in 0042) ──
-- Wird hier minimal erzeugt, damit RPCs in 0041 (fan_count) bereits funktionieren.
-- Migration 0042 erweitert mit RLS, RPCs, Trigger, Cron.
create table if not exists public.member_follows (
  follower_id           uuid not null references public.members(id) on delete cascade,
  followee_id           uuid not null references public.members(id) on delete cascade,
  created_at            timestamptz not null default now(),
  notifications_enabled boolean not null default true,
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

-- ─── 4. RPC: Star-Profil aktualisieren (SECURITY DEFINER wegen RLS-Footgun) ─
create or replace function public.update_my_star_profile(
  p_bio text default null,
  p_story text default null,
  p_signature text default null,
  p_specialties text[] default null,
  p_quote text default null,
  p_visible boolean default null,
  p_accent text default null
) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_aufgieser() then
    raise exception 'only_aufgieser_can_edit_star_profile';
  end if;
  update public.members
     set bio = case when p_bio is not null then nullif(btrim(p_bio), '') else bio end,
         aufgieser_story = case when p_story is not null then nullif(btrim(p_story), '') else aufgieser_story end,
         signature_aufguss = case when p_signature is not null then nullif(btrim(p_signature), '') else signature_aufguss end,
         specialties = coalesce(p_specialties, specialties),
         style_quote = case when p_quote is not null then nullif(btrim(p_quote), '') else style_quote end,
         star_card_visible = coalesce(p_visible, star_card_visible),
         star_accent_color = case when p_accent is not null then nullif(btrim(p_accent), '') else star_accent_color end
   where auth_user_id = auth.uid();
  if not found then raise exception 'member_not_found'; end if;
end$$;
revoke all on function public.update_my_star_profile(text, text, text, text[], text, boolean, text) from public;
grant execute on function public.update_my_star_profile(text, text, text, text[], text, boolean, text) to authenticated;

-- ─── 5. RPC: Star-Stats für Trading-Card ─────────────────────────────────
create or replace function public.get_star_stats(p_member_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'total_aufguss', (
      select count(*) from public.infusions
       where saunameister_id = p_member_id
         and coalesce(is_personal_fallback, false) = false
    ),
    'team_aufguss', (
      select count(*) from public.infusion_co_aufgieser where member_id = p_member_id
    ),
    'avg_rating', (
      select round(avg((r.chemie + r.luftbewegung + r.wedeltechnik + r.hitzeniveau + r.musik + r.duftentwicklung) / 6.0)::numeric, 2)
        from public.infusion_ratings r
        join public.infusions i on i.id = r.infusion_id
       where i.saunameister_id = p_member_id
    ),
    'rating_count', (
      select count(*) from public.infusion_ratings r
        join public.infusions i on i.id = r.infusion_id
       where i.saunameister_id = p_member_id
    ),
    'fan_count', (
      select count(*) from public.member_follows where followee_id = p_member_id
    ),
    'badge_count', (
      select count(*) from public.member_achievements where member_id = p_member_id
    ),
    'favorite_temp', (
      select temperature_c::text from public.infusions
       where saunameister_id = p_member_id
         and coalesce(is_personal_fallback, false) = false
         and temperature_c is not null
       group by temperature_c
       order by count(*) desc
       limit 1
    )
  );
$$;
revoke all on function public.get_star_stats(uuid) from public;
grant execute on function public.get_star_stats(uuid) to authenticated;

-- ─── 6. RPC: Liste aller Aufgießer-Stars für /aufgieser-Übersicht ────────
create or replace function public.list_aufgieser_stars()
returns table (
  id uuid,
  name text,
  avatar_path text,
  motto text,
  bio text,
  aufgieser_story text,
  signature_aufguss text,
  specialties text[],
  style_quote text,
  star_accent_color text,
  role text,
  is_aufgieser boolean,
  home_group text,
  total_aufguss bigint,
  fan_count bigint,
  avg_rating numeric
)
language sql stable security definer set search_path = public, auth as $$
  select m.id, m.name, m.avatar_path, m.motto, m.bio, m.aufgieser_story, m.signature_aufguss,
         m.specialties, m.style_quote, m.star_accent_color, m.role, m.is_aufgieser, m.home_group,
         (select count(*) from public.infusions
            where saunameister_id = m.id
              and coalesce(is_personal_fallback, false) = false) as total_aufguss,
         (select count(*) from public.member_follows where followee_id = m.id) as fan_count,
         (select round(avg((r.chemie + r.luftbewegung + r.wedeltechnik + r.hitzeniveau + r.musik + r.duftentwicklung) / 6.0)::numeric, 2)
            from public.infusion_ratings r
            join public.infusions i on i.id = r.infusion_id
           where i.saunameister_id = m.id) as avg_rating
    from public.members m
   where m.approved = true
     and m.revoked_at is null
     and m.star_card_visible = true
     and (m.is_aufgieser = true or m.role in ('guest_aufgieser', 'admin'))
     and exists (select 1 from public.members me where me.auth_user_id = auth.uid())
   order by fan_count desc, total_aufguss desc, m.name asc;
$$;
revoke all on function public.list_aufgieser_stars() from public;
grant execute on function public.list_aufgieser_stars() to authenticated;

comment on function public.update_my_star_profile(text, text, text, text[], text, boolean, text) is
  'Aufgießer pflegt eigenes Star-Profil (bio, story, signature, specialties, quote, visibility, accent).';
comment on function public.get_star_stats(uuid) is
  'JSONB mit Trading-Card-Stats: total_aufguss, team_aufguss, avg_rating, rating_count, fan_count, badge_count, favorite_temp.';
comment on function public.list_aufgieser_stars() is
  'Liste aller sichtbaren Aufgießer (Star-Karten) mit aggregierten Stats für /aufgieser-Übersicht.';
