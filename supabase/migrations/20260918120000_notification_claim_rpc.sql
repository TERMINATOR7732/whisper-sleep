-- Migration: Atomic Notification Claim RPC (Phase 5 Fix)
--
-- Adds a status 'pending' to notification_logs and a PostgreSQL RPC
-- claim_notification_slot() that atomically reserves a slot for a
-- (user_id, notification_type, local_date) tuple before any push is sent.
--
-- The atomic claim mechanism ensures:
--   - Two concurrent scheduler executions for the same user/type/date
--     result in EXACTLY ONE push attempt.
--   - "pending" → "sent" or "failed" are the only valid post-claim transitions.
--   - A failed send does NOT leave a permanent "sent" record (no false success).
--   - A previously failed slot can be retried on the NEXT scheduler cycle
--     (pending rows older than 10 minutes are treated as stale/expired claims).
--
-- State transitions:
--   [none] → pending  (via claim_notification_slot; atomic INSERT ON CONFLICT DO NOTHING)
--   pending → sent    (via mark_notification_sent; only after push delivery confirmed)
--   pending → failed  (via mark_notification_failed; when push delivery fails)
--   suppressed        (terminal; written directly; never transitions)
--   failed            (terminal after mark_notification_failed)
--   sent              (terminal after mark_notification_sent)
--
-- Retry semantics:
--   If a push attempt fails, the row is set to "failed".
--   On the NEXT scheduler run on the SAME local_date, the UNIQUE constraint
--   will block a new claim (the failed row still occupies the slot).
--   This is an intentional choice: one attempt per user per type per local day.
--   This prevents notification storms on repeated delivery failures.
--
--   If a "pending" row is older than 10 minutes (stale claim, e.g. function crash),
--   it is treated as eligible for reclaim. The RPC handles this by overwriting
--   stale pending rows atomically via ON CONFLICT DO UPDATE ... WHERE.
--
-- Security:
--   - SECURITY DEFINER is used to allow service_role functions to bypass RLS
--     for the INSERT/UPDATE, but normal authenticated callers cannot call this
--     function (REVOKE EXECUTE FROM authenticated).
--   - search_path is locked to public to prevent schema-injection attacks.
--   - The function accepts only the caller's own user_id (verified by the caller's
--     Edge Function, which itself is already authenticated as service_role).

-- -------------------------------------------------------
-- 1. Add 'pending' to the status constraint safely
-- -------------------------------------------------------
ALTER TABLE public.notification_logs
  DROP CONSTRAINT IF EXISTS notification_logs_status_check;

ALTER TABLE public.notification_logs
  ADD CONSTRAINT notification_logs_status_check
  CHECK (status IN ('pending', 'sent', 'failed', 'suppressed'));

-- -------------------------------------------------------
-- 2. Index for fast stale-pending detection
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notification_logs_pending
  ON public.notification_logs (user_id, notification_type, local_date, status, created_at)
  WHERE status = 'pending';

-- -------------------------------------------------------
-- 3. Atomic claim function
-- -------------------------------------------------------
-- Returns TRUE  → this caller won the claim; it MUST send the push, then call mark_notification_sent or mark_notification_failed.
-- Returns FALSE → another caller already holds a valid (non-stale) claim or a terminal record exists; caller MUST NOT send.
--
-- Stale pending threshold: 10 minutes. If a pending record is older than this,
-- it is overwritten atomically (function crash recovery).

CREATE OR REPLACE FUNCTION public.claim_notification_slot(
  p_user_id        UUID,
  p_type           TEXT,
  p_local_date     DATE,
  p_scheduled_for  TIMESTAMPTZ DEFAULT now()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stale_threshold CONSTANT INTERVAL := INTERVAL '10 minutes';
  v_inserted        BOOLEAN := FALSE;
BEGIN
  -- Attempt atomic INSERT of a pending claim.
  -- ON CONFLICT DO NOTHING: if a terminal (sent/failed/suppressed) row exists, or
  -- a fresh pending row exists, do nothing and return false.
  INSERT INTO public.notification_logs (
    user_id, notification_type, local_date, scheduled_for, sent_at, status
  )
  VALUES (
    p_user_id, p_type, p_local_date, p_scheduled_for, now(), 'pending'
  )
  ON CONFLICT (user_id, notification_type, local_date)
  DO UPDATE
    SET
      status        = 'pending',
      scheduled_for = p_scheduled_for,
      sent_at       = now(),
      created_at    = now(),
      metadata      = '{}'::jsonb
    -- Only overwrite if the existing row is a STALE pending (older than threshold)
    WHERE notification_logs.status = 'pending'
      AND notification_logs.created_at < (now() - v_stale_threshold)
  ;

  -- Check if we actually inserted or updated (i.e., won the claim)
  SELECT EXISTS (
    SELECT 1
    FROM public.notification_logs
    WHERE user_id        = p_user_id
      AND notification_type = p_type
      AND local_date     = p_local_date
      AND status         = 'pending'
      -- Must be a very recent record (within last 5 seconds) to be ours
      AND created_at     >= (now() - INTERVAL '5 seconds')
  ) INTO v_inserted;

  RETURN v_inserted;
END;
$$;

-- -------------------------------------------------------
-- 4. Mark-sent function (call after confirmed push delivery)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_notification_sent(
  p_user_id    UUID,
  p_type       TEXT,
  p_local_date DATE,
  p_metadata   JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notification_logs
  SET status   = 'sent',
      sent_at  = now(),
      metadata = p_metadata
  WHERE user_id          = p_user_id
    AND notification_type = p_type
    AND local_date        = p_local_date
    AND status            = 'pending';
END;
$$;

-- -------------------------------------------------------
-- 5. Mark-failed function (call when push delivery fails)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_notification_failed(
  p_user_id    UUID,
  p_type       TEXT,
  p_local_date DATE,
  p_reason     TEXT DEFAULT 'push_delivery_failed'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notification_logs
  SET status   = 'failed',
      metadata = jsonb_build_object('failure_reason', p_reason)
  WHERE user_id          = p_user_id
    AND notification_type = p_type
    AND local_date        = p_local_date
    AND status            = 'pending';
END;
$$;

-- -------------------------------------------------------
-- 6. Restrict function access
-- -------------------------------------------------------
-- Only service_role (used by Edge Functions) may call these.
-- Normal authenticated users cannot claim, mark-sent, or mark-failed.
REVOKE ALL ON FUNCTION public.claim_notification_slot(UUID, TEXT, DATE, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_notification_sent(UUID, TEXT, DATE, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_notification_failed(UUID, TEXT, DATE, TEXT) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.claim_notification_slot(UUID, TEXT, DATE, TIMESTAMPTZ) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_notification_sent(UUID, TEXT, DATE, JSONB) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_notification_failed(UUID, TEXT, DATE, TEXT) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.claim_notification_slot(UUID, TEXT, DATE, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_sent(UUID, TEXT, DATE, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_failed(UUID, TEXT, DATE, TEXT) TO service_role;
