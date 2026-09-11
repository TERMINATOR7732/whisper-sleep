CREATE TABLE public.sleep_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sleep_date date NOT NULL,
  bedtime timestamptz,
  fell_asleep_at timestamptz,
  wake_time timestamptz,
  out_of_bed_at timestamptz,
  sleep_latency_minutes integer CHECK (sleep_latency_minutes IS NULL OR sleep_latency_minutes >= 0),
  total_sleep_minutes integer CHECK (total_sleep_minutes IS NULL OR total_sleep_minutes >= 0),
  sleep_quality integer CHECK (sleep_quality IS NULL OR sleep_quality BETWEEN 1 AND 5),
  awakenings_count integer CHECK (awakenings_count IS NULL OR awakenings_count >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, sleep_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sleep_entries TO authenticated;
GRANT ALL ON public.sleep_entries TO service_role;
ALTER TABLE public.sleep_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY sleep_entries_select_own ON public.sleep_entries FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY sleep_entries_insert_own ON public.sleep_entries FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY sleep_entries_update_own ON public.sleep_entries FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY sleep_entries_delete_own ON public.sleep_entries FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER sleep_entries_touch BEFORE UPDATE ON public.sleep_entries FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.naps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nap_date date NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
  quality integer CHECK (quality IS NULL OR quality BETWEEN 1 AND 5),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.naps TO authenticated;
GRANT ALL ON public.naps TO service_role;
ALTER TABLE public.naps ENABLE ROW LEVEL SECURITY;
CREATE POLICY naps_select_own ON public.naps FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY naps_insert_own ON public.naps FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY naps_update_own ON public.naps FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY naps_delete_own ON public.naps FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER naps_touch BEFORE UPDATE ON public.naps FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE OR REPLACE FUNCTION public.validate_nap() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.started_at IS NOT NULL AND NEW.ended_at IS NOT NULL AND NEW.ended_at <= NEW.started_at THEN
    RAISE EXCEPTION 'Nap end time must be after the start time';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER naps_validate BEFORE INSERT OR UPDATE ON public.naps FOR EACH ROW EXECUTE FUNCTION public.validate_nap();

CREATE TABLE public.daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  energy_level integer CHECK (energy_level IS NULL OR energy_level BETWEEN 1 AND 5),
  mood_level integer CHECK (mood_level IS NULL OR mood_level BETWEEN 1 AND 5),
  rested_level integer CHECK (rested_level IS NULL OR rested_level BETWEEN 1 AND 5),
  stress_level integer CHECK (stress_level IS NULL OR stress_level BETWEEN 1 AND 5),
  caffeine_used boolean NOT NULL DEFAULT false,
  caffeine_amount text,
  caffeine_last_time timestamptz,
  screen_before_bed boolean,
  phone_in_bed boolean,
  phone_activity text,
  exercise_done boolean,
  outdoor_time boolean,
  previous_evening_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, checkin_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_checkins TO authenticated;
GRANT ALL ON public.daily_checkins TO service_role;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_checkins_select_own ON public.daily_checkins FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY daily_checkins_insert_own ON public.daily_checkins FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY daily_checkins_update_own ON public.daily_checkins FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY daily_checkins_delete_own ON public.daily_checkins FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER daily_checkins_touch BEFORE UPDATE ON public.daily_checkins FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.sleep_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sleep_entry_id uuid REFERENCES public.sleep_entries(id) ON DELETE CASCADE,
  reason text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sleep_reasons TO authenticated;
GRANT ALL ON public.sleep_reasons TO service_role;
ALTER TABLE public.sleep_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY sleep_reasons_select_own ON public.sleep_reasons FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY sleep_reasons_insert_own ON public.sleep_reasons FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY sleep_reasons_update_own ON public.sleep_reasons FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY sleep_reasons_delete_own ON public.sleep_reasons FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX sleep_entries_user_date_idx ON public.sleep_entries (user_id, sleep_date DESC);
CREATE INDEX naps_user_date_idx ON public.naps (user_id, nap_date DESC);
CREATE INDEX daily_checkins_user_date_idx ON public.daily_checkins (user_id, checkin_date DESC);
CREATE INDEX sleep_reasons_entry_idx ON public.sleep_reasons (sleep_entry_id);