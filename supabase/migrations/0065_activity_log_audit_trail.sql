-- Migration 0065: Audit-Log für alle wichtigen Vereins-Aktionen
-- Admin kann nach Datum (Tag/Woche/Monat/Custom) und nach Mitglied (Aktor) filtern.

-- 1. Zentrale Log-Tabelle
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  actor_name text,           -- Denormalisiert: bleibt sinnvoll auch wenn Member später gelöscht wird
  actor_role text,
  action text NOT NULL,      -- Pattern: domain.action (z.B. 'member.role_change', 'fan.approve')
  target_type text,          -- 'member', 'infusion', 'fan_upgrade_request', 'org_news', etc.
  target_id uuid,
  target_label text,         -- Lesbares Label, z.B. Mitgliedsname oder Aufguss-Beschreibung
  details jsonb              -- Frei verwendbarer Kontext
);

CREATE INDEX idx_activity_log_occurred ON public.activity_log(occurred_at DESC);
CREATE INDEX idx_activity_log_actor ON public.activity_log(actor_id, occurred_at DESC);
CREATE INDEX idx_activity_log_target ON public.activity_log(target_type, target_id);
CREATE INDEX idx_activity_log_action ON public.activity_log(action, occurred_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_log_read_admin ON public.activity_log
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY activity_log_no_self_write ON public.activity_log
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY activity_log_no_self_update ON public.activity_log
  FOR UPDATE TO authenticated USING (false);
CREATE POLICY activity_log_no_self_delete ON public.activity_log
  FOR DELETE TO authenticated USING (false);

-- 2. Helper: aktuellen Aktor ermitteln
CREATE OR REPLACE FUNCTION public.log_activity_actor()
RETURNS TABLE(actor_id uuid, actor_name text, actor_role text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id, name, role
  FROM public.members
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- 3. Generischer Insert-Helper
CREATE OR REPLACE FUNCTION public.log_activity(
  p_action text,
  p_target_type text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL,
  p_target_label text DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
BEGIN
  SELECT * INTO v_actor FROM public.log_activity_actor();
  INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
  VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role, p_action, p_target_type, p_target_id, p_target_label, p_details);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_activity(text, text, uuid, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.log_activity(text, text, uuid, text, jsonb) TO authenticated;

-- 4. Trigger: Members (kritische Feld-Änderungen)
CREATE OR REPLACE FUNCTION public.trg_log_members()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_actor record;
BEGIN
  SELECT * INTO v_actor FROM public.log_activity_actor();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            'member.create', 'member', NEW.id, NEW.name,
            jsonb_build_object('role', NEW.role, 'is_aufgieser', NEW.is_aufgieser));
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            'member.delete', 'member', OLD.id, OLD.name,
            jsonb_build_object('role', OLD.role));
    RETURN OLD;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            'member.role_change', 'member', NEW.id, NEW.name,
            jsonb_build_object('from_role', OLD.role, 'to_role', NEW.role));
  END IF;

  IF NEW.is_aufgieser IS DISTINCT FROM OLD.is_aufgieser THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            CASE WHEN NEW.is_aufgieser THEN 'member.aufgieser_grant' ELSE 'member.aufgieser_revoke' END,
            'member', NEW.id, NEW.name, NULL);
  END IF;

  IF NEW.is_wm_admin IS DISTINCT FROM OLD.is_wm_admin THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            CASE WHEN NEW.is_wm_admin THEN 'member.wm_admin_grant' ELSE 'member.wm_admin_revoke' END,
            'member', NEW.id, NEW.name, NULL);
  END IF;

  IF NEW.is_personal_planer IS DISTINCT FROM OLD.is_personal_planer THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            CASE WHEN NEW.is_personal_planer THEN 'member.cp_grant' ELSE 'member.cp_revoke' END,
            'member', NEW.id, NEW.name, NULL);
  END IF;

  IF NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            CASE WHEN NEW.revoked_at IS NOT NULL THEN 'member.lock' ELSE 'member.unlock' END,
            'member', NEW.id, NEW.name, NULL);
  END IF;

  IF NEW.paid_until IS DISTINCT FROM OLD.paid_until THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            'member.paid_until_change', 'member', NEW.id, NEW.name,
            jsonb_build_object('from', OLD.paid_until::text, 'to', NEW.paid_until::text));
  END IF;

  IF NEW.approved IS DISTINCT FROM OLD.approved AND NEW.approved = true THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            'member.approve', 'member', NEW.id, NEW.name,
            jsonb_build_object('role', NEW.role));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_activity_log_members_insert
AFTER INSERT ON public.members FOR EACH ROW EXECUTE FUNCTION public.trg_log_members();
CREATE TRIGGER trg_activity_log_members_update
AFTER UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.trg_log_members();
CREATE TRIGGER trg_activity_log_members_delete
AFTER DELETE ON public.members FOR EACH ROW EXECUTE FUNCTION public.trg_log_members();

-- 5. Trigger: Infusions
CREATE OR REPLACE FUNCTION public.trg_log_infusions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_label text;
  v_sauna_name text;
BEGIN
  SELECT * INTO v_actor FROM public.log_activity_actor();

  IF TG_OP = 'INSERT' THEN
    SELECT name INTO v_sauna_name FROM public.saunas WHERE id = NEW.sauna_id;
    v_label := coalesce(v_sauna_name, '?') || ' · ' || to_char(NEW.start_time, 'DD.MM HH24:MI');
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            'infusion.create', 'infusion', NEW.id, v_label,
            jsonb_build_object('sauna_id', NEW.sauna_id, 'meister_id', NEW.saunameister_id, 'is_personal_fallback', NEW.is_personal_fallback));
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT name INTO v_sauna_name FROM public.saunas WHERE id = OLD.sauna_id;
    v_label := coalesce(v_sauna_name, '?') || ' · ' || to_char(OLD.start_time, 'DD.MM HH24:MI');
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            'infusion.delete', 'infusion', OLD.id, v_label, NULL);
    RETURN OLD;
  END IF;

  IF NEW.saunameister_id IS DISTINCT FROM OLD.saunameister_id THEN
    SELECT name INTO v_sauna_name FROM public.saunas WHERE id = NEW.sauna_id;
    v_label := coalesce(v_sauna_name, '?') || ' · ' || to_char(NEW.start_time, 'DD.MM HH24:MI');
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            CASE WHEN OLD.saunameister_id IS NULL THEN 'infusion.takeover' ELSE 'infusion.reassign' END,
            'infusion', NEW.id, v_label,
            jsonb_build_object('from_meister_id', OLD.saunameister_id, 'to_meister_id', NEW.saunameister_id));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_activity_log_infusions
AFTER INSERT OR UPDATE OR DELETE ON public.infusions
FOR EACH ROW EXECUTE FUNCTION public.trg_log_infusions();

-- 6. Trigger: Fan-Upgrade-Requests
CREATE OR REPLACE FUNCTION public.trg_log_fan_upgrade()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_target_name text;
BEGIN
  SELECT * INTO v_actor FROM public.log_activity_actor();
  SELECT name INTO v_target_name FROM public.members WHERE id = NEW.member_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            'fan.request', 'fan_upgrade_request', NEW.id, v_target_name, NULL);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status != 'pending' THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            'fan.' || NEW.status, 'fan_upgrade_request', NEW.id, v_target_name,
            jsonb_build_object('paid_until', NEW.paid_until_set::text, 'reason', NEW.rejection_reason));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_activity_log_fan_upgrade
AFTER INSERT OR UPDATE ON public.fan_upgrade_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_log_fan_upgrade();

-- 7. Trigger: Org-News
CREATE OR REPLACE FUNCTION public.trg_log_org_news()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_actor record;
BEGIN
  SELECT * INTO v_actor FROM public.log_activity_actor();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            'news.publish', 'org_news', NEW.id, NEW.title,
            jsonb_build_object('target_min_role', NEW.target_min_role, 'pinned', NEW.pinned));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            'news.delete', 'org_news', OLD.id, OLD.title, NULL);
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_activity_log_org_news
AFTER INSERT OR DELETE ON public.org_news
FOR EACH ROW EXECUTE FUNCTION public.trg_log_org_news();

-- 8. Trigger: Aroma-Rezepte
CREATE OR REPLACE FUNCTION public.trg_log_aroma_recipes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_actor record;
BEGIN
  SELECT * INTO v_actor FROM public.log_activity_actor();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            'recipe.submit', 'aroma_recipe', NEW.id, NEW.title, NULL);
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.approved IS DISTINCT FROM OLD.approved AND NEW.approved = true THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            'recipe.approve', 'aroma_recipe', NEW.id, NEW.title, NULL);
  END IF;
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
    VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
            'recipe.delete', 'aroma_recipe', OLD.id, OLD.title, NULL);
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_activity_log_aroma_recipes
AFTER INSERT OR UPDATE OR DELETE ON public.aroma_recipes
FOR EACH ROW EXECUTE FUNCTION public.trg_log_aroma_recipes();

-- 9. Trigger: Evakuierungs-Alarm
CREATE OR REPLACE FUNCTION public.trg_log_evacuation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_actor record;
BEGIN
  SELECT * INTO v_actor FROM public.log_activity_actor();
  INSERT INTO public.activity_log(actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
  VALUES (v_actor.actor_id, v_actor.actor_name, v_actor.actor_role,
          'evacuation.alarm', 'evacuation_event', NEW.id, 'Notfall-Alarm', NULL);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_activity_log_evacuation
AFTER INSERT ON public.evacuation_events
FOR EACH ROW EXECUTE FUNCTION public.trg_log_evacuation();

-- 10. List-RPC mit Filter (Admin-only)
CREATE OR REPLACE FUNCTION public.list_activity_log(
  p_from timestamptz DEFAULT NULL,
  p_until timestamptz DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_action_prefix text DEFAULT NULL,
  p_limit int DEFAULT 200,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  id uuid, occurred_at timestamptz, actor_id uuid, actor_name text, actor_role text,
  action text, target_type text, target_id uuid, target_label text, details jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id, occurred_at, actor_id, actor_name, actor_role, action,
         target_type, target_id, target_label, details
  FROM public.activity_log
  WHERE public.is_admin()
    AND (p_from IS NULL OR occurred_at >= p_from)
    AND (p_until IS NULL OR occurred_at < p_until)
    AND (p_actor_id IS NULL OR actor_id = p_actor_id)
    AND (p_action_prefix IS NULL OR action LIKE p_action_prefix || '%')
  ORDER BY occurred_at DESC
  LIMIT greatest(1, least(p_limit, 1000))
  OFFSET greatest(0, p_offset);
$$;
REVOKE EXECUTE ON FUNCTION public.list_activity_log(timestamptz, timestamptz, uuid, text, int, int) FROM public;
GRANT EXECUTE ON FUNCTION public.list_activity_log(timestamptz, timestamptz, uuid, text, int, int) TO authenticated;

-- 11. Count-RPC für Pagination
CREATE OR REPLACE FUNCTION public.count_activity_log(
  p_from timestamptz DEFAULT NULL,
  p_until timestamptz DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_action_prefix text DEFAULT NULL
)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::int
  FROM public.activity_log
  WHERE public.is_admin()
    AND (p_from IS NULL OR occurred_at >= p_from)
    AND (p_until IS NULL OR occurred_at < p_until)
    AND (p_actor_id IS NULL OR actor_id = p_actor_id)
    AND (p_action_prefix IS NULL OR action LIKE p_action_prefix || '%');
$$;
REVOKE EXECUTE ON FUNCTION public.count_activity_log(timestamptz, timestamptz, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.count_activity_log(timestamptz, timestamptz, uuid, text) TO authenticated;
