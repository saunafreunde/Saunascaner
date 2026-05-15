-- ─── Migration 0057: Security-Hardening (Linter-Findings beheben) ────────
-- Bereinigt alle nicht-Standard-Findings aus dem Supabase Security Advisor:
--
-- A) public.present_members: SECURITY DEFINER View → security_invoker = on
--    (Findings-URL: lint=0010_security_definer_view)
-- B) 25 Funktionen ohne pinned search_path → ALTER FUNCTION ... SET search_path
--    (Findings-URL: lint=0011_function_search_path_mutable)
-- C) handle_new_user-Trigger: REVOKE EXECUTE — Trigger soll nicht als RPC
--    aufrufbar sein (Defense-in-Depth).
--
-- NICHT in dieser Migration (zu riskant ohne Audit):
-- - citext / pg_net ins extensions-Schema verschieben (würde RPC-Aufrufe brechen)
-- - storage.assets-Bucket Listing-Policy entfernen (App-Verhalten unbekannt)
-- - Leaked Password Protection (muss im Dashboard aktiviert werden, nicht via SQL)

-- ─── A) View security_invoker statt SECURITY DEFINER ─────────────────────
alter view if exists public.present_members set (security_invoker = on);

-- ─── B) search_path pinnen für 25 Funktionen ──────────────────────────────
-- search_path = public, pg_temp ist der Supabase-Empfehlung-Default.
alter function public.set_infusion_end_time()                                                                set search_path = public, pg_temp;
alter function public.touch_updated_at()                                                                     set search_path = public, pg_temp;
alter function public.check_max_custom_attrs()                                                               set search_path = public, pg_temp;
alter function public.get_member_stats(p_member_id uuid)                                                     set search_path = public, pg_temp;
alter function public.award_badge(p_member_id uuid, p_badge_id text, p_metadata jsonb)                       set search_path = public, pg_temp;
alter function public.get_monthly_leaderboard()                                                              set search_path = public, pg_temp;
alter function public.log_attendance_on_checkin()                                                            set search_path = public, pg_temp;
alter function public.get_meister_rating_avg(p_member_id uuid)                                               set search_path = public, pg_temp;
alter function public.count_member_ratings(p_member_id uuid)                                                 set search_path = public, pg_temp;
alter function public.submit_wm_tip(p_match_id uuid, p_outcome text, p_score_home smallint, p_score_away smallint, p_joker boolean)  set search_path = public, pg_temp;
alter function public.submit_wm_meta_tip(p_champion_id uuid, p_picks jsonb)                                  set search_path = public, pg_temp;
alter function public.wm_phase_points(p_phase text)                                                          set search_path = public, pg_temp;
alter function public.record_wm_result(p_match_id uuid, p_score_home smallint, p_score_away smallint)        set search_path = public, pg_temp;
alter function public.wm_group_standings(p_group text)                                                       set search_path = public, pg_temp;
alter function public.get_wm_leaderboard()                                                                   set search_path = public, pg_temp;
alter function public.wm_pending_tippers(p_match_id uuid)                                                    set search_path = public, pg_temp;
alter function public.get_birthdays_today()                                                                  set search_path = public, pg_temp;
alter function public.wm_pending_tip_reminders(p_within_hours integer)                                       set search_path = public, pg_temp;
alter function public.rating_pending_reminders()                                                             set search_path = public, pg_temp;
alter function public.push_subscribers_today_birthday_recipients()                                           set search_path = public, pg_temp;
alter function public.garantie_temperature_for(p_start timestamptz)                                          set search_path = public, pg_temp;
alter function public.infusions_set_temperature()                                                            set search_path = public, pg_temp;
alter function public.garantie_sauna_for(p_start timestamptz)                                                set search_path = public, pg_temp;
alter function public.can_plan_secondary(p_day date)                                                         set search_path = public, pg_temp;
alter function public.enforce_photo_limit()                                                                  set search_path = public, pg_temp;

-- ─── C) handle_new_user: Trigger soll nicht direkt aufrufbar sein ─────────
-- Defense-in-Depth: auch wenn der Aufruf ohne new-Record praktisch nichts macht,
-- entziehen wir EXECUTE explizit. Trigger feuert weiter automatisch über
-- auth.users-Insert (läuft als postgres-Owner, ist nicht von GRANT abhängig).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
