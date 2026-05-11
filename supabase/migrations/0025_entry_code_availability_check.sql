-- ─── Migration 0025: RPC entry_code_available für Live-Vorprüfung ──────
-- Gibt true wenn der übergebene Code noch frei ist (oder bereits MIR selbst
-- gehört — damit beim Edit der eigene Code nicht als „vergeben" angezeigt
-- wird). Der atomare Unique-Index members_entry_code_idx aus Migration 0005
-- bleibt die endgültige Sicherheits-Garantie; diese Funktion ist nur für UX.

create or replace function public.entry_code_available(p_code text)
returns boolean
language sql stable security definer set search_path = public, auth as $$
  select not exists (
    select 1
      from public.members
     where entry_code = p_code
       and (auth_user_id is null or auth_user_id is distinct from auth.uid())
  );
$$;

revoke all on function public.entry_code_available(text) from public;
grant execute on function public.entry_code_available(text) to authenticated;

comment on function public.entry_code_available(text) is
  'Pre-Check ob ein Einlass-Code frei ist. true = frei oder gehört bereits dem Aufrufer selbst. Endgültige Eindeutigkeit garantiert weiterhin members_entry_code_idx.';
