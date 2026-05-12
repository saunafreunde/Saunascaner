-- ─── Migration 0043: WM-Admin-Flag ────────────────────────────────────────
-- Eine Person, die das WM-Tipspiel verwaltet (Spiele anlegen, Ergebnisse
-- eintragen, Teams setzen), ohne voll-Admin-Rechte zu brauchen. Analog zu
-- is_aufgieser: ein zusätzlicher Boolean-Flag auf members. Admin vergibt den
-- Flag über den Members-Tab im Admin-Bereich.

-- ─── 1. Spalte ────────────────────────────────────────────────────────────
alter table public.members
  add column if not exists is_wm_admin boolean not null default false;

-- ─── 2. Helper ────────────────────────────────────────────────────────────
create or replace function public.is_wm_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select is_wm_admin from public.members where auth_user_id = auth.uid()),
    false
  );
$$;
revoke all on function public.is_wm_admin() from public;
grant execute on function public.is_wm_admin() to anon, authenticated;

comment on function public.is_wm_admin() is
  'true wenn members.is_wm_admin=true. Admin oder WM-Admin dürfen WM-Spiele/Tipps verwalten.';

-- ─── 3. WM-RPCs erweitern: auch is_wm_admin zulassen ─────────────────────
-- Alle drei Funktionen aus 0009 prüfen role='admin' — wir öffnen sie für
-- is_wm_admin. Die Bodies bleiben sonst unverändert.

create or replace function public.score_wm_match(
  p_match_id    uuid,
  p_score_home  int,
  p_score_away  int
) returns text language plpgsql security definer set search_path = public, auth as $$
declare
  v_role         text;
  v_is_wm_admin  boolean;
  v_phase        text;
  v_actual_out   text;
  v_base         int;
  r              record;
  v_pts          int;
  v_diff_actual  int;
  v_diff_guess   int;
begin
  select role, is_wm_admin into v_role, v_is_wm_admin
    from members where auth_user_id = auth.uid();
  if v_role <> 'admin' and not coalesce(v_is_wm_admin, false) then
    return 'not_admin';
  end if;

  update wm_matches
    set score_home = p_score_home, score_away = p_score_away, locked = true
    where id = p_match_id
    returning phase into v_phase;
  if v_phase is null then return 'match_not_found'; end if;

  v_base := wm_phase_points(v_phase);
  v_actual_out := case
    when p_score_home > p_score_away then 'home'
    when p_score_home < p_score_away then 'away'
    else 'draw'
  end;
  v_diff_actual := p_score_home - p_score_away;

  for r in select * from wm_tips where match_id = p_match_id loop
    v_pts := 0;
    if r.tip_outcome = v_actual_out then
      v_pts := v_base;
      if r.score_home_guess is not null and r.score_away_guess is not null then
        v_diff_guess := r.score_home_guess - r.score_away_guess;
        if r.score_home_guess = p_score_home and r.score_away_guess = p_score_away then
          v_pts := v_pts + 2;
        elsif v_diff_guess = v_diff_actual then
          v_pts := v_pts + 1;
        end if;
      end if;
      if r.joker then v_pts := v_pts * 2; end if;
    end if;
    update wm_tips set points_earned = v_pts where id = r.id;
  end loop;

  return 'ok';
end; $$;

create or replace function public.set_wm_match_teams(
  p_match_id    uuid,
  p_home_team   uuid,
  p_away_team   uuid,
  p_home_label  text default null,
  p_away_label  text default null
) returns text language plpgsql security definer set search_path = public, auth as $$
declare v_role text; v_is_wm_admin boolean;
begin
  select role, is_wm_admin into v_role, v_is_wm_admin
    from members where auth_user_id = auth.uid();
  if v_role <> 'admin' and not coalesce(v_is_wm_admin, false) then
    return 'not_admin';
  end if;

  update wm_matches
    set home_team_id = p_home_team,
        away_team_id = p_away_team,
        home_label   = p_home_label,
        away_label   = p_away_label
    where id = p_match_id;
  return 'ok';
end; $$;

create or replace function public.upsert_wm_match(
  p_match_no    int,
  p_phase       text,
  p_group_label text,
  p_kickoff     timestamptz,
  p_home_team   uuid,
  p_away_team   uuid,
  p_home_label  text,
  p_away_label  text
) returns uuid language plpgsql security definer set search_path = public, auth as $$
declare v_role text; v_is_wm_admin boolean; v_id uuid;
begin
  select role, is_wm_admin into v_role, v_is_wm_admin
    from members where auth_user_id = auth.uid();
  if v_role <> 'admin' and not coalesce(v_is_wm_admin, false) then
    raise exception 'not_admin';
  end if;

  insert into wm_matches (match_no, phase, group_label, kickoff, home_team_id, away_team_id, home_label, away_label)
  values (p_match_no, p_phase, p_group_label, p_kickoff, p_home_team, p_away_team, p_home_label, p_away_label)
  on conflict (match_no) do update set
    phase = excluded.phase,
    group_label = excluded.group_label,
    kickoff = excluded.kickoff,
    home_team_id = excluded.home_team_id,
    away_team_id = excluded.away_team_id,
    home_label = excluded.home_label,
    away_label = excluded.away_label
  returning id into v_id;
  return v_id;
end; $$;
