-- 0090_remove_sauna_name_cooldown.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 1) 30-Tage-Cooldown für Aufguss-Name (set_sauna_name) entfernen.
--    Aufgießer dürfen ihren Künstlernamen jederzeit ändern.
-- 2) Bonus: Footgun-Fix — die alte RPC hatte `WHERE id = auth.uid()`,
--    was bei members nie funktioniert (members.id ≠ auth.uid()). Korrigiert
--    auf `auth_user_id = auth.uid()`. Siehe Memory-Eintrag
--    feedback_supabase_auth_lookup_footgun.md.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.set_sauna_name(p_name text)
returns void
language plpgsql security definer
set search_path = public, auth as $$
begin
  update public.members
     set sauna_name = nullif(trim(p_name), ''),
         sauna_name_changed_at = now()
   where auth_user_id = auth.uid();
end;
$$;

revoke all on function public.set_sauna_name(text) from public;
grant execute on function public.set_sauna_name(text) to authenticated;
