-- Security hardening: Enforce participant immutability on public.relationships
-- Ensures that once a relationship row is created:
-- 1. `id`, `user_id`, and `partner_id` cannot be modified by any update.
-- 2. Relationships cannot be reverted back to 'pending' from active or disconnected.
-- 3. Non-activation actions (such as disconnecting or canceling) remain permissible
--    under the existing RLS policies.

CREATE OR REPLACE FUNCTION public.enforce_relationship_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent changing primary key id
  IF NEW.id <> OLD.id THEN
    RAISE EXCEPTION 'Relationship id cannot be changed.';
  END IF;

  -- Prevent changing participant IDs
  IF NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'Relationship user_id cannot be changed.';
  END IF;

  IF NEW.partner_id <> OLD.partner_id THEN
    RAISE EXCEPTION 'Relationship partner_id cannot be changed.';
  END IF;

  -- Prevent reverting active or disconnected relationships back to pending
  IF OLD.status <> 'pending'::public.relationship_status AND NEW.status = 'pending'::public.relationship_status THEN
    RAISE EXCEPTION 'Cannot revert a relationship back to pending.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_relationship_participants_immutable ON public.relationships;
CREATE TRIGGER enforce_relationship_participants_immutable
  BEFORE UPDATE ON public.relationships
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_relationship_immutability();
