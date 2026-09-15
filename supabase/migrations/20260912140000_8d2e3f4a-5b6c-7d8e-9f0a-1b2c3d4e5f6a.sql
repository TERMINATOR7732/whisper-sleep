-- Migration: Secure Partner Pairing
-- Introduces public.partner_invites table and secure SECURITY DEFINER RPCs for pairing.
-- Ensures zero client-side direct relationship activation and strict role/expiry/self-pairing validation.

-- 1. Create partner_invites table
CREATE TABLE IF NOT EXISTS public.partner_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial indexes for fast pending lookups
CREATE INDEX IF NOT EXISTS idx_partner_invites_code_pending
  ON public.partner_invites(invite_code)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_partner_invites_inviter_pending
  ON public.partner_invites(inviter_id)
  WHERE status = 'pending';

-- Automatic updated_at timestamp trigger
DROP TRIGGER IF EXISTS partner_invites_touch ON public.partner_invites;
CREATE TRIGGER partner_invites_touch
  BEFORE UPDATE ON public.partner_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- Row Level Security
ALTER TABLE public.partner_invites ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.partner_invites TO authenticated;
GRANT ALL ON public.partner_invites TO service_role;

-- Inviter may only view their own invite records
DROP POLICY IF EXISTS "partner_invites_select_own" ON public.partner_invites;
CREATE POLICY "partner_invites_select_own" ON public.partner_invites
  FOR SELECT TO authenticated
  USING (inviter_id = auth.uid());

-- 2. Code generation helper (32-character unambiguous alphabet, cryptographically random)
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SET search_path = public, extensions
AS $$
DECLARE
  chars CONSTANT TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  res TEXT := 'WHSP-';
  i INT;
  bytes BYTEA := extensions.gen_random_bytes(8);
BEGIN
  FOR i IN 0..7 LOOP
    IF i = 4 THEN
      res := res || '-';
    END IF;
    res := res || substr(chars, (get_byte(bytes, i) % length(chars)) + 1, 1);
  END LOOP;
  RETURN res;
END;
$$;

-- 3. Code normalization helper
CREATE OR REPLACE FUNCTION public.normalize_invite_code(raw_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  cleaned TEXT;
BEGIN
  IF raw_code IS NULL THEN
    RETURN NULL;
  END IF;
  cleaned := upper(regexp_replace(raw_code, '[^a-zA-Z0-9]', '', 'g'));
  IF cleaned LIKE 'WHSP%' AND length(cleaned) = 12 THEN
    RETURN 'WHSP-' || substr(cleaned, 5, 4) || '-' || substr(cleaned, 9, 4);
  ELSIF length(cleaned) = 8 THEN
    RETURN 'WHSP-' || substr(cleaned, 1, 4) || '-' || substr(cleaned, 5, 4);
  ELSE
    RETURN cleaned;
  END IF;
END;
$$;

-- 4. RPC: create_partner_invite()
CREATE OR REPLACE FUNCTION public.create_partner_invite()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID;
  caller_role public.app_role;
  new_code TEXT;
  new_expires TIMESTAMPTZ;
  attempts INT := 0;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = caller_id;

  IF caller_role IS NULL OR caller_role <> 'user'::public.app_role THEN
    RAISE EXCEPTION 'Only primary users can create partner invitations.';
  END IF;

  -- Verify caller does not already have an active relationship
  IF EXISTS (
    SELECT 1 FROM public.relationships
    WHERE (user_id = caller_id OR partner_id = caller_id)
      AND status = 'active'::public.relationship_status
  ) THEN
    RAISE EXCEPTION 'You already have an active partner connection.';
  END IF;

  -- Cancel any previous pending invites for this caller
  UPDATE public.partner_invites
  SET status = 'cancelled', updated_at = now()
  WHERE inviter_id = caller_id AND status = 'pending';

  -- Generate a unique code
  LOOP
    new_code := public.generate_invite_code();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.partner_invites WHERE invite_code = new_code
    );
    attempts := attempts + 1;
    IF attempts > 10 THEN
      RAISE EXCEPTION 'Unable to generate a unique invite code. Please try again.';
    END IF;
  END LOOP;

  new_expires := now() + INTERVAL '24 hours';

  INSERT INTO public.partner_invites (inviter_id, invite_code, status, expires_at)
  VALUES (caller_id, new_code, 'pending', new_expires);

  RETURN jsonb_build_object(
    'invite_code', new_code,
    'expires_at', new_expires,
    'status', 'pending'
  );
END;
$$;

-- 5. RPC: get_my_partner_invite()
CREATE OR REPLACE FUNCTION public.get_my_partner_invite()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID;
  invite_row public.partner_invites%ROWTYPE;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Retrieve active pending invite
  SELECT * INTO invite_row
  FROM public.partner_invites
  WHERE inviter_id = caller_id
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF invite_row.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check expiry
  IF invite_row.expires_at <= now() THEN
    UPDATE public.partner_invites
    SET status = 'expired', updated_at = now()
    WHERE id = invite_row.id;
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'invite_code', invite_row.invite_code,
    'expires_at', invite_row.expires_at,
    'created_at', invite_row.created_at,
    'status', invite_row.status
  );
END;
$$;

-- 6. RPC: cancel_partner_invite()
CREATE OR REPLACE FUNCTION public.cancel_partner_invite()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  UPDATE public.partner_invites
  SET status = 'cancelled', updated_at = now()
  WHERE inviter_id = caller_id AND status = 'pending';

  RETURN TRUE;
END;
$$;

-- 7. RPC: accept_partner_invite(raw_code TEXT)
CREATE OR REPLACE FUNCTION public.accept_partner_invite(raw_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID;
  caller_role public.app_role;
  normalized_code TEXT;
  invite_rec public.partner_invites%ROWTYPE;
  inviter_role public.app_role;
  inviter_name TEXT;
  existing_rel_id UUID;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Verify caller role is partner
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = caller_id;

  IF caller_role IS NULL OR caller_role <> 'partner'::public.app_role THEN
    RAISE EXCEPTION 'Only partner accounts can accept partner invites.';
  END IF;

  -- Verify caller is not already in an active relationship
  IF EXISTS (
    SELECT 1 FROM public.relationships
    WHERE (user_id = caller_id OR partner_id = caller_id)
      AND status = 'active'::public.relationship_status
  ) THEN
    RAISE EXCEPTION 'You already have an active partner connection.';
  END IF;

  -- Normalize input code
  normalized_code := public.normalize_invite_code(raw_code);
  IF normalized_code IS NULL OR length(normalized_code) = 0 THEN
    RAISE EXCEPTION 'Please enter a valid invite code.';
  END IF;

  -- Row lock on invite to avoid race conditions
  SELECT * INTO invite_rec
  FROM public.partner_invites
  WHERE invite_code = normalized_code
  FOR UPDATE;

  IF invite_rec.id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code. Please check the code and try again.';
  END IF;

  IF invite_rec.status = 'cancelled' THEN
    RAISE EXCEPTION 'This invite code was cancelled by the creator.';
  END IF;

  IF invite_rec.status = 'accepted' THEN
    RAISE EXCEPTION 'This invite code has already been used.';
  END IF;

  IF invite_rec.status = 'expired' OR invite_rec.expires_at <= now() THEN
    IF invite_rec.status <> 'expired' THEN
      UPDATE public.partner_invites
      SET status = 'expired', updated_at = now()
      WHERE id = invite_rec.id;
    END IF;
    RAISE EXCEPTION 'This invite code has expired. Please ask your partner for a new code.';
  END IF;

  IF invite_rec.status <> 'pending' THEN
    RAISE EXCEPTION 'This invite code is no longer valid.';
  END IF;

  -- Prevent self-pairing
  IF invite_rec.inviter_id = caller_id THEN
    RAISE EXCEPTION 'You cannot accept your own invite code.';
  END IF;

  -- Check inviter role is user
  SELECT role, COALESCE(nickname, display_name, 'Partner')
  INTO inviter_role, inviter_name
  FROM public.profiles
  WHERE id = invite_rec.inviter_id;

  IF inviter_role IS NULL OR inviter_role <> 'user'::public.app_role THEN
    RAISE EXCEPTION 'This invite was not created by a primary user account.';
  END IF;

  -- Verify inviter is not already connected
  IF EXISTS (
    SELECT 1 FROM public.relationships
    WHERE (user_id = invite_rec.inviter_id OR partner_id = invite_rec.inviter_id)
      AND status = 'active'::public.relationship_status
  ) THEN
    RAISE EXCEPTION 'The user who created this invite is already connected to another partner.';
  END IF;

  -- Mark invite accepted
  UPDATE public.partner_invites
  SET status = 'accepted', accepted_by = caller_id, updated_at = now()
  WHERE id = invite_rec.id;

  -- Cancel any other pending invites for both users
  UPDATE public.partner_invites
  SET status = 'cancelled', updated_at = now()
  WHERE (inviter_id = invite_rec.inviter_id OR inviter_id = caller_id)
    AND status = 'pending'
    AND id <> invite_rec.id;

  -- Clean up any invalid reversed relationship record
  DELETE FROM public.relationships
  WHERE user_id = caller_id AND partner_id = invite_rec.inviter_id;

  -- Upsert relationship: user_id = inviter_id, partner_id = caller_id
  SELECT id INTO existing_rel_id
  FROM public.relationships
  WHERE user_id = invite_rec.inviter_id AND partner_id = caller_id;

  IF existing_rel_id IS NOT NULL THEN
    UPDATE public.relationships
    SET status = 'active'::public.relationship_status, updated_at = now()
    WHERE id = existing_rel_id;
  ELSE
    INSERT INTO public.relationships (user_id, partner_id, status)
    VALUES (invite_rec.inviter_id, caller_id, 'active'::public.relationship_status);
  END IF;

  -- Initialize sharing permissions with all permissions defaulted to false
  INSERT INTO public.sharing_permissions (user_id, partner_id)
  VALUES (invite_rec.inviter_id, caller_id)
  ON CONFLICT (user_id, partner_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', invite_rec.inviter_id,
    'partner_id', caller_id,
    'partner_name', inviter_name
  );
END;
$$;

-- 8. RPC: disconnect_partner()
CREATE OR REPLACE FUNCTION public.disconnect_partner()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Set active relationship to disconnected
  UPDATE public.relationships
  SET status = 'disconnected'::public.relationship_status, updated_at = now()
  WHERE (user_id = caller_id OR partner_id = caller_id)
    AND status = 'active'::public.relationship_status;

  -- Also cancel any leftover pending invites
  UPDATE public.partner_invites
  SET status = 'cancelled', updated_at = now()
  WHERE inviter_id = caller_id AND status = 'pending';

  RETURN TRUE;
END;
$$;

-- 9. Grants and Revocations
REVOKE ALL ON FUNCTION public.generate_invite_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalize_invite_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_invite_code(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.create_partner_invite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_partner_invite() TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_partner_invite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_partner_invite() TO authenticated;

REVOKE ALL ON FUNCTION public.cancel_partner_invite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_partner_invite() TO authenticated;

REVOKE ALL ON FUNCTION public.accept_partner_invite(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_partner_invite(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.disconnect_partner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.disconnect_partner() TO authenticated;
