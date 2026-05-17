-- Migration 0072: REPLICA IDENTITY FULL für tv_stage_state
--
-- Default (PRIMARY KEY) reicht für unseren „etwas-geändert"-Signal-Use-Case
-- (useRealtime.ts ruft per invalidateQueries die volle Row neu vom Server),
-- aber FULL ist robuster und liefert den kompletten neuen Row-Inhalt direkt
-- in den postgres_changes-Events. Kosten sind minimal (1 Zeile, selten
-- geupdated).

ALTER TABLE public.tv_stage_state REPLICA IDENTITY FULL;
