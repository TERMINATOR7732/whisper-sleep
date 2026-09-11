ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sleep_goal_minutes integer NOT NULL DEFAULT 480
  CHECK (sleep_goal_minutes BETWEEN 240 AND 720);

CREATE OR REPLACE FUNCTION public.get_shared_sleep_days(_user_id uuid, _days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _viewer uuid := auth.uid();
  _perm public.sharing_permissions;
  _all boolean;
  _from date;
  _days_json jsonb;
BEGIN
  IF _viewer IS NULL OR NOT public.is_actively_linked(_viewer, _user_id) THEN
    RETURN jsonb_build_object('linked', false, 'permissions', '{}'::jsonb, 'days', '[]'::jsonb);
  END IF;

  SELECT * INTO _perm
  FROM public.sharing_permissions
  WHERE user_id = _user_id AND partner_id = _viewer;

  IF _perm.id IS NULL THEN
    RETURN jsonb_build_object('linked', true, 'permissions', '{}'::jsonb, 'days', '[]'::jsonb);
  END IF;

  _all := COALESCE(_perm.share_everything, false);
  _from := (now()::date - GREATEST(LEAST(COALESCE(_days, 30), 400), 1));

  SELECT COALESCE(jsonb_agg(d ORDER BY d->>'date' DESC), '[]'::jsonb) INTO _days_json
  FROM (
    SELECT jsonb_strip_nulls(jsonb_build_object(
      'date', dates.d,
      'total_sleep_minutes', CASE WHEN _all OR _perm.share_sleep_duration THEN se.total_sleep_minutes END,
      'sleep_quality', CASE WHEN _all OR _perm.share_sleep_quality THEN se.sleep_quality END,
      'bedtime', CASE WHEN _all OR _perm.share_exact_bedtime THEN se.bedtime END,
      'wake_time', CASE WHEN _all OR _perm.share_exact_waketime THEN se.wake_time END,
      'energy_level', CASE WHEN _all OR _perm.share_energy THEN dc.energy_level END,
      'mood_level', CASE WHEN _all OR _perm.share_mood THEN dc.mood_level END,
      'rested_level', CASE WHEN _all OR _perm.share_energy THEN dc.rested_level END,
      'caffeine_used', CASE WHEN _all OR _perm.share_caffeine THEN dc.caffeine_used END,
      'screen_before_bed', CASE WHEN _all OR _perm.share_phone_usage THEN dc.screen_before_bed END,
      'phone_in_bed', CASE WHEN _all OR _perm.share_phone_usage THEN dc.phone_in_bed END,
      'nap_minutes', CASE WHEN _all OR _perm.share_naps THEN naps.total END,
      'reasons', CASE WHEN _all OR _perm.share_reasons THEN reasons.list END
    )) AS d
    FROM (
      SELECT DISTINCT x.d FROM (
        SELECT sleep_date AS d FROM public.sleep_entries WHERE user_id = _user_id AND sleep_date >= _from
        UNION
        SELECT checkin_date AS d FROM public.daily_checkins WHERE user_id = _user_id AND checkin_date >= _from
      ) x
    ) dates
    LEFT JOIN public.sleep_entries se ON se.user_id = _user_id AND se.sleep_date = dates.d
    LEFT JOIN public.daily_checkins dc ON dc.user_id = _user_id AND dc.checkin_date = dates.d
    LEFT JOIN LATERAL (
      SELECT SUM(n.duration_minutes)::int AS total
      FROM public.naps n WHERE n.user_id = _user_id AND n.nap_date = dates.d
    ) naps ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(sr.reason) AS list
      FROM public.sleep_reasons sr WHERE sr.user_id = _user_id AND sr.sleep_entry_id = se.id
    ) reasons ON true
  ) rows;

  RETURN jsonb_build_object(
    'linked', true,
    'permissions', jsonb_build_object(
      'sleep_duration', _all OR _perm.share_sleep_duration,
      'sleep_quality', _all OR _perm.share_sleep_quality,
      'exact_bedtime', _all OR _perm.share_exact_bedtime,
      'exact_waketime', _all OR _perm.share_exact_waketime,
      'mood', _all OR _perm.share_mood,
      'energy', _all OR _perm.share_energy,
      'caffeine', _all OR _perm.share_caffeine,
      'phone_usage', _all OR _perm.share_phone_usage,
      'naps', _all OR _perm.share_naps,
      'reasons', _all OR _perm.share_reasons,
      'patterns', _all OR _perm.share_patterns
    ),
    'days', _days_json
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_sleep_days(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_sleep_days(uuid, integer) TO authenticated;