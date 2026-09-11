CREATE OR REPLACE FUNCTION public.is_actively_linked(_a UUID, _b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.relationships r
    WHERE r.status = 'active'
      AND ((r.user_id = _a AND r.partner_id = _b)
        OR (r.user_id = _b AND r.partner_id = _a))
  )
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_actively_linked(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_actively_linked(UUID, UUID) TO authenticated;