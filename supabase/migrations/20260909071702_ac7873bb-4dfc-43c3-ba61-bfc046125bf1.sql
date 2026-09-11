CREATE OR REPLACE FUNCTION public.get_shared_reset_plan(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _allowed boolean;
  _plan public.sleep_reset_plans;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_actively_linked(auth.uid(), _user_id) THEN
    RETURN jsonb_build_object('shared', false);
  END IF;

  SELECT (share_reset_plan OR share_everything) INTO _allowed
  FROM public.sharing_permissions
  WHERE user_id = _user_id AND partner_id = auth.uid();

  IF _allowed IS NOT TRUE THEN
    RETURN jsonb_build_object('shared', false);
  END IF;

  SELECT * INTO _plan
  FROM public.sleep_reset_plans
  WHERE user_id = _user_id AND is_active
  ORDER BY started_on DESC
  LIMIT 1;

  IF _plan.id IS NULL THEN
    RETURN jsonb_build_object('shared', true, 'has_plan', false);
  END IF;

  RETURN jsonb_build_object(
    'shared', true,
    'has_plan', true,
    'desired_sleep_minutes', _plan.desired_sleep_minutes,
    'target_bedtime', _plan.target_bedtime,
    'target_wake_time', _plan.target_wake_time,
    'adjustment_pace', _plan.adjustment_pace,
    'started_on', _plan.started_on,
    'stages', _plan.stages
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_shared_reset_plan(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_shared_reset_plan(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_shared_reset_plan(uuid) TO authenticated;