-- Migration: In-App Notification Preferences (Phase 1)
-- Creates public.notification_preferences table with RLS and updated_at trigger.
-- Privacy-first: strictly accessible to the owning authenticated user; no partner or public access.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  wind_down_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  streak_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  checkin_reminder_time TIME NOT NULL DEFAULT '20:00',
  wind_down_reminder_time TIME NOT NULL DEFAULT '22:30',
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TIME NOT NULL DEFAULT '22:00',
  quiet_hours_end TIME NOT NULL DEFAULT '07:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to maintain updated_at
DROP TRIGGER IF EXISTS touch_notification_preferences ON public.notification_preferences;
CREATE TRIGGER touch_notification_preferences
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

-- Row Level Security
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_preferences_select_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_select_own"
  ON public.notification_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notification_preferences_insert_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_insert_own"
  ON public.notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notification_preferences_update_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_update_own"
  ON public.notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notification_preferences_delete_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_delete_own"
  ON public.notification_preferences
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
