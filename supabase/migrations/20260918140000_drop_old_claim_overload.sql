-- Migration: Drop old 4-param overload of claim_notification_slot
-- The 20260918120000 migration created a 4-param version.
-- The 20260918130000 migration added a 5-param version with p_claim_token.
-- Postgres now has two overloads and .rpc() calls are ambiguous.
-- This migration drops the old 4-param signature so only the 5-param version remains.

DROP FUNCTION IF EXISTS public.claim_notification_slot(UUID, TEXT, DATE, TIMESTAMPTZ);
