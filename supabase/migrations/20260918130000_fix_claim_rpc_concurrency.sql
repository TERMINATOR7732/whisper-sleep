-- Migration: Fix Atomic Notification Claim RPC (Phase 5 Final Fix)
--
-- Fixes a concurrency bug in the initial claim_notification_slot function.
--
-- ROOT CAUSE:
--   The original function used:
--     INSERT ... ON CONFLICT DO UPDATE
--     Then SELECT ... WHERE created_at >= now() - 5s
--   Two concurrent transactions could both pass the time-based check
--   because both complete within the 5-second window.
--
-- FIX:
--   Use a per-call UUID claim token (p_claim_token).
--   The INSERT attempts to write the token into the metadata field.
--   ON CONFLICT DO NOTHING (for non-stale rows).
--   After the INSERT, the caller reads back the row and checks whether
--   the stored claim_token matches the one they provided.
--   Because the INSERT is atomic, exactly one concurrent caller will have
--   written their token. The other will see a different token and return false.
--
--   Stale recovery: If the row is 'pending' AND older than 10 minutes,
--   we overwrite it with the new token via DO UPDATE ... WHERE stale condition.
--   This prevents lost claims from crashing Edge Functions permanently blocking a slot.
--
-- STATE MACHINE (unchanged):
--   [none] → pending    (via claim_notification_slot — atomic)
--   pending → sent      (via mark_notification_sent)
--   pending → failed    (via mark_notification_failed)
--   suppressed          (terminal, written directly)
--
-- SECURITY (unchanged):
--   SECURITY DEFINER, search_path = public
--   REVOKE EXECUTE FROM authenticated, PUBLIC
--   GRANT EXECUTE TO service_role only

-- -------------------------------------------------------
-- Add claim_token column to hold per-call UUID during pending state
-- -------------------------------------------------------
ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS claim_token UUID;

-- -------------------------------------------------------
-- Recreate claim_notification_slot with claim_token approach
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_notification_slot(
  p_user_id        UUID,
  p_type           TEXT,
  p_local_date     DATE,
  p_scheduled_for  TIMESTAMPTZ DEFAULT now(),
  p_claim_token    UUID DEFAULT gen_random_uuid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stale_threshold CONSTANT INTERVAL := INTERVAL '10 minutes';
  v_stored_token    UUID;
BEGIN
  -- Attempt 1: Plain INSERT — succeeds only if no row exists yet.
  -- ON CONFLICT DO NOTHING if a non-stale row (any status) already exists.
  INSERT INTO public.notification_logs (
    user_id, notification_type, local_date, scheduled_for, sent_at, status, claim_token, metadata
  )
  VALUES (
    p_user_id, p_type, p_local_date, p_scheduled_for, now(), 'pending', p_claim_token, '{}'::jsonb
  )
  ON CONFLICT (user_id, notification_type, local_date)
  DO UPDATE
    SET
      status        = 'pending',
      scheduled_for = p_scheduled_for,
      sent_at       = now(),
      created_at    = now(),
      claim_token   = p_claim_token,
      metadata      = '{}'::jsonb
    -- Only overwrite STALE pending rows (crash recovery).
    -- Terminal rows (sent / failed / suppressed) are NEVER overwritten.
    WHERE notification_logs.status = 'pending'
      AND notification_logs.created_at < (now() - v_stale_threshold)
  ;

  -- Read back the stored token for this slot.
  -- If our token is stored → we won.
  -- If a different token is stored → another caller won.
  SELECT claim_token
  INTO v_stored_token
  FROM public.notification_logs
  WHERE user_id          = p_user_id
    AND notification_type = p_type
    AND local_date        = p_local_date
    AND status            = 'pending';  -- terminal rows have NULL claim_token

  -- Return true ONLY if our token matches the stored token.
  RETURN (v_stored_token IS NOT NULL AND v_stored_token = p_claim_token);
END;
$$;

-- -------------------------------------------------------
-- Update mark_notification_sent to clear the claim token
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
  SET status      = 'sent',
      sent_at     = now(),
      claim_token = NULL,
      metadata    = p_metadata
  WHERE user_id          = p_user_id
    AND notification_type = p_type
    AND local_date        = p_local_date
    AND status            = 'pending';
END;
$$;

-- -------------------------------------------------------
-- Update mark_notification_failed to clear the claim token
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
  SET status      = 'failed',
      claim_token = NULL,
      metadata    = jsonb_build_object('failure_reason', p_reason)
  WHERE user_id          = p_user_id
    AND notification_type = p_type
    AND local_date        = p_local_date
    AND status            = 'pending';
END;
$$;

-- -------------------------------------------------------
-- Re-apply grants (idempotent)
-- -------------------------------------------------------
REVOKE ALL ON FUNCTION public.claim_notification_slot(UUID, TEXT, DATE, TIMESTAMPTZ, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_notification_sent(UUID, TEXT, DATE, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_notification_failed(UUID, TEXT, DATE, TEXT) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.claim_notification_slot(UUID, TEXT, DATE, TIMESTAMPTZ, UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_notification_sent(UUID, TEXT, DATE, JSONB) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_notification_failed(UUID, TEXT, DATE, TEXT) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.claim_notification_slot(UUID, TEXT, DATE, TIMESTAMPTZ, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_sent(UUID, TEXT, DATE, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_failed(UUID, TEXT, DATE, TEXT) TO service_role;
