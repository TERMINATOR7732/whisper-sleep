-- Migration: Notification Logs & Idempotency (Phase 5)
-- Records automated notification dispatches to prevent duplicate reminders.
-- Strict unique constraint on (user_id, notification_type, local_date).
-- Strict RLS: users can only SELECT their own logs; service_role has full management access.
-- Partners have NO access.

CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('checkin', 'wind_down', 'streak')),
  local_date DATE NOT NULL,
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'suppressed')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_logs_user_type_date_key UNIQUE (user_id, notification_type, local_date)
);

-- Index for rapid lookups during reminder eligibility checks
CREATE INDEX IF NOT EXISTS idx_notification_logs_lookup
  ON public.notification_logs (user_id, notification_type, local_date);

-- Grants
REVOKE ALL ON public.notification_logs FROM PUBLIC, anon;
GRANT SELECT ON public.notification_logs TO authenticated;
GRANT ALL ON public.notification_logs TO service_role;

-- Row Level Security
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_logs_select_own" ON public.notification_logs;
CREATE POLICY "notification_logs_select_own"
  ON public.notification_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Ensure pg_net and pg_cron extensions exist
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;
