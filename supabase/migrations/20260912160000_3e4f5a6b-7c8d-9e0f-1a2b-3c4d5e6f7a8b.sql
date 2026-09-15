-- Migration: User Daily Check-in Streak System
-- Calculates current streak, longest streak, checked_in_today status, and recent 7-day activity.
-- Evaluated strictly in the user's configured profile timezone.
-- Derived dynamically from database records (no mutable counter columns).

CREATE OR REPLACE FUNCTION public.get_my_streak()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _raw_tz text;
  _tz text := 'UTC';
  _local_today date;
  _local_yesterday date;
  _checked_in_today boolean := false;
  _checked_in_yesterday boolean := false;
  _current_streak integer := 0;
  _longest_streak integer := 0;
  _anchor_date date;
  _check_date date;
  _recent_days jsonb := '[]'::jsonb;
  _i integer;
  _curr_day date;
  _has_checkin boolean;
  _day_name text;
BEGIN
  -- 1. Security check: caller must be authenticated
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object(
      'current_streak', 0,
      'longest_streak', 0,
      'checked_in_today', false,
      'recent_days', '[]'::jsonb
    );
  END IF;

  -- 2. Resolve user timezone safely
  SELECT timezone INTO _raw_tz FROM public.profiles WHERE id = _user_id;
  IF _raw_tz IS NOT NULL AND _raw_tz <> '' THEN
    BEGIN
      _local_today := (now() AT TIME ZONE _raw_tz)::date;
      _tz := _raw_tz;
    EXCEPTION WHEN OTHERS THEN
      _tz := 'UTC';
      _local_today := (now() AT TIME ZONE 'UTC')::date;
    END;
  ELSE
    _local_today := (now() AT TIME ZONE 'UTC')::date;
  END IF;
  _local_yesterday := _local_today - 1;

  -- 3. Check if checked in today and yesterday
  SELECT EXISTS (
    SELECT 1 FROM public.daily_checkins
    WHERE user_id = _user_id AND checkin_date = _local_today
  ) INTO _checked_in_today;

  SELECT EXISTS (
    SELECT 1 FROM public.daily_checkins
    WHERE user_id = _user_id AND checkin_date = _local_yesterday
  ) INTO _checked_in_yesterday;

  -- 4. Calculate current streak
  IF _checked_in_today THEN
    _anchor_date := _local_today;
    _current_streak := 1;
  ELSIF _checked_in_yesterday THEN
    _anchor_date := _local_yesterday;
    _current_streak := 1;
  ELSE
    _current_streak := 0;
  END IF;

  IF _current_streak > 0 THEN
    _check_date := _anchor_date - 1;
    WHILE EXISTS (
      SELECT 1 FROM public.daily_checkins
      WHERE user_id = _user_id AND checkin_date = _check_date
    ) LOOP
      _current_streak := _current_streak + 1;
      _check_date := _check_date - 1;
    END LOOP;
  END IF;

  -- 5. Calculate longest streak across history using gaps and islands
  WITH checkin_days AS (
    SELECT DISTINCT checkin_date
    FROM public.daily_checkins
    WHERE user_id = _user_id
  ),
  islands AS (
    SELECT checkin_date,
           checkin_date - (ROW_NUMBER() OVER (ORDER BY checkin_date))::int * INTERVAL '1 day' AS grp
    FROM checkin_days
  ),
  streak_lengths AS (
    SELECT COUNT(*) AS len
    FROM islands
    GROUP BY grp
  )
  SELECT COALESCE(MAX(len), 0)
  INTO _longest_streak
  FROM streak_lengths;

  _longest_streak := GREATEST(_longest_streak, _current_streak);

  -- 6. Build recent 7-day activity array (from local_today - 6 to local_today)
  FOR _i IN 0..6 LOOP
    _curr_day := _local_today - (6 - _i);

    SELECT EXISTS (
      SELECT 1 FROM public.daily_checkins
      WHERE user_id = _user_id AND checkin_date = _curr_day
    ) INTO _has_checkin;

    _day_name := trim(to_char(_curr_day, 'Dy'));

    _recent_days := _recent_days || jsonb_build_object(
      'date', to_char(_curr_day, 'YYYY-MM-DD'),
      'day_label', _day_name,
      'completed', _has_checkin,
      'is_today', (_curr_day = _local_today)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'current_streak', _current_streak,
    'longest_streak', _longest_streak,
    'checked_in_today', _checked_in_today,
    'recent_days', _recent_days
  );
END;
$$;

-- Revoke execute from public/anon, grant to authenticated and service_role
REVOKE ALL ON FUNCTION public.get_my_streak() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_streak() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_streak() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_streak() TO service_role;
