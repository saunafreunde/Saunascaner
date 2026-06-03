-- Migration 0113 — Feiertage als "Sonderöffnungstage" (30.05.2026)
-- Siehe Backend-Apply via MCP — Datei für Repo-Konsistenz.

CREATE TABLE IF NOT EXISTS public.holidays (
  date date PRIMARY KEY,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS holidays_date_idx ON public.holidays (date);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS holidays_read ON public.holidays;
CREATE POLICY holidays_read ON public.holidays FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS holidays_write_admin ON public.holidays;
CREATE POLICY holidays_write_admin ON public.holidays FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.is_holiday(p_date date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$ SELECT EXISTS (SELECT 1 FROM public.holidays WHERE date = p_date); $$;
GRANT EXECUTE ON FUNCTION public.is_holiday(date) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.admin_add_holiday(p_date date, p_label text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  INSERT INTO public.holidays(date, label)
  VALUES (p_date, COALESCE(NULLIF(btrim(p_label), ''), 'Feiertag'))
  ON CONFLICT (date) DO UPDATE SET label = EXCLUDED.label;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_add_holiday(date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_holiday(p_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  DELETE FROM public.holidays WHERE date = p_date;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_delete_holiday(date) TO authenticated;
