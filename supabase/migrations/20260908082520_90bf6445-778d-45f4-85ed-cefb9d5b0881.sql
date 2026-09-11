-- 1. Sleep reset plans
CREATE TABLE public.sleep_reset_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  desired_sleep_minutes integer CHECK (desired_sleep_minutes IS NULL OR (desired_sleep_minutes BETWEEN 240 AND 720)),
  target_wake_time time,
  current_bedtime time,
  target_bedtime time,
  day_start_time time,
  adjustment_pace text NOT NULL DEFAULT 'gentle' CHECK (adjustment_pace IN ('gentle','steady','faster')),
  naps_needed boolean,
  personal_goal text,
  started_on date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sleep_reset_plans TO authenticated;
GRANT ALL ON public.sleep_reset_plans TO service_role;
ALTER TABLE public.sleep_reset_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY reset_plans_select_own ON public.sleep_reset_plans FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY reset_plans_insert_own ON public.sleep_reset_plans FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY reset_plans_update_own ON public.sleep_reset_plans FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY reset_plans_delete_own ON public.sleep_reset_plans FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER touch_sleep_reset_plans BEFORE UPDATE ON public.sleep_reset_plans
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Wind-down preferences
CREATE TABLE public.wind_down_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes IN (30, 60)),
  communication_style text NOT NULL DEFAULT 'calm'
    CHECK (communication_style IN ('calm','cute','motivational','funny','minimal','romantic')),
  in_app_reminders boolean NOT NULL DEFAULT true,
  use_default_checklist boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wind_down_preferences TO authenticated;
GRANT ALL ON public.wind_down_preferences TO service_role;
ALTER TABLE public.wind_down_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY wind_prefs_select_own ON public.wind_down_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY wind_prefs_insert_own ON public.wind_down_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY wind_prefs_update_own ON public.wind_down_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY wind_prefs_delete_own ON public.wind_down_preferences FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER touch_wind_down_preferences BEFORE UPDATE ON public.wind_down_preferences
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Wind-down checklist tasks
CREATE TABLE public.wind_down_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  phase text NOT NULL DEFAULT 'thirty' CHECK (phase IN ('sixty','thirty','final')),
  position integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wind_down_tasks TO authenticated;
GRANT ALL ON public.wind_down_tasks TO service_role;
ALTER TABLE public.wind_down_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY wind_tasks_select_own ON public.wind_down_tasks FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY wind_tasks_insert_own ON public.wind_down_tasks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY wind_tasks_update_own ON public.wind_down_tasks FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY wind_tasks_delete_own ON public.wind_down_tasks FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX wind_down_tasks_user_idx ON public.wind_down_tasks (user_id, phase, position);

CREATE TRIGGER touch_wind_down_tasks BEFORE UPDATE ON public.wind_down_tasks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Completed wind-down sessions
CREATE TABLE public.wind_down_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  tasks_completed integer NOT NULL DEFAULT 0,
  tasks_skipped integer NOT NULL DEFAULT 0,
  tasks_total integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wind_down_sessions TO authenticated;
GRANT ALL ON public.wind_down_sessions TO service_role;
ALTER TABLE public.wind_down_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY wind_sessions_select_own ON public.wind_down_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY wind_sessions_insert_own ON public.wind_down_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY wind_sessions_update_own ON public.wind_down_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY wind_sessions_delete_own ON public.wind_down_sessions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER touch_wind_down_sessions BEFORE UPDATE ON public.wind_down_sessions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. New, off-by-default sharing switches
ALTER TABLE public.sharing_permissions
  ADD COLUMN share_reset_plan boolean NOT NULL DEFAULT false,
  ADD COLUMN share_recovery_status boolean NOT NULL DEFAULT false;

-- 6. Partner-facing rough-night status, permission gated
CREATE OR REPLACE FUNCTION public.get_shared_recovery_status(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _allowed boolean;
  _goal integer;
  _target integer;
  _latest record;
  _baseline numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_actively_linked(auth.uid(), _user_id) THEN
    RETURN jsonb_build_object('shared', false);
  END IF;

  SELECT (share_recovery_status OR share_everything) INTO _allowed
  FROM public.sharing_permissions
  WHERE user_id = _user_id AND partner_id = auth.uid();

  IF _allowed IS NOT TRUE THEN
    RETURN jsonb_build_object('shared', false);
  END IF;

  SELECT sleep_goal_minutes INTO _goal FROM public.profiles WHERE id = _user_id;
  SELECT desired_sleep_minutes INTO _target FROM public.sleep_reset_plans WHERE user_id = _user_id;
  _target := COALESCE(_target, _goal, 480);

  SELECT sleep_date, total_sleep_minutes INTO _latest
  FROM public.sleep_entries
  WHERE user_id = _user_id AND total_sleep_minutes IS NOT NULL
  ORDER BY sleep_date DESC
  LIMIT 1;

  IF _latest IS NULL THEN
    RETURN jsonb_build_object('shared', true, 'status', 'unknown');
  END IF;

  SELECT avg(total_sleep_minutes) INTO _baseline
  FROM (
    SELECT total_sleep_minutes FROM public.sleep_entries
    WHERE user_id = _user_id AND total_sleep_minutes IS NOT NULL AND sleep_date < _latest.sleep_date
    ORDER BY sleep_date DESC LIMIT 14
  ) recent;

  RETURN jsonb_build_object(
    'shared', true,
    'status', CASE
      WHEN _latest.total_sleep_minutes < LEAST(_target * 0.75, COALESCE(_baseline, _target) * 0.8)
        THEN 'rough'
      ELSE 'okay'
    END,
    'as_of', _latest.sleep_date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_recovery_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_shared_recovery_status(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_shared_recovery_status(uuid) TO authenticated;