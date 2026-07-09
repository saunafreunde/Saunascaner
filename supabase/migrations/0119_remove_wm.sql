-- ─── Migration 0119: WM-Tippspiel aus der DB entfernen ───────────────────
-- Frontend + Push-Cron sind bereits WM-frei (siehe Branch). Hier wird die
-- substanzielle WM-Data gedroppt: alle WM-Funktionen (außer is_wm_admin),
-- die 5 WM-Tabellen (Tipp-Historie etc.) und die WM-Champion-Badges.
--
-- BEWUSST NICHT angefasst: members.is_wm_admin (Spalte) + public.is_wm_admin()
-- (Helper). Beide sind ungenutzt (kein Frontend liest sie mehr, kein Toggle
-- schreibt sie), aber das Entfernen der Spalte würde eine fehleranfällige
-- Neuerstellung des members-Audit-Triggers trg_log_members() (0065, ~100 Z.,
-- referenziert NEW/OLD.is_wm_admin) erfordern — Risiko: bricht ALLE Member-
-- Writes. Die zwei ungenutzten Objekte sind harmlos und können später separat
-- entfernt werden.

-- 1) WM-Funktionen droppen (alle außer is_wm_admin — per exakter Signatur)
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'award_wm_champions','get_wm_leaderboard','record_wm_result','score_wm_match',
         'set_wm_match_teams','submit_wm_meta_tip','submit_wm_tip','upsert_wm_match',
         'wm_group_standings','wm_pending_tip_reminders','wm_pending_tippers','wm_phase_points'
       )
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end $$;

-- 2) WM-Tabellen droppen (Daten + RLS-Policies + Indizes via CASCADE)
drop table if exists
  public.wm_tips,
  public.wm_meta_tips,
  public.wm_matches,
  public.wm_teams,
  public.wm_settings
  cascade;

-- 3) WM-Champion-Badges entfernen
delete from public.member_achievements where badge_id like 'wm_champion_%';
