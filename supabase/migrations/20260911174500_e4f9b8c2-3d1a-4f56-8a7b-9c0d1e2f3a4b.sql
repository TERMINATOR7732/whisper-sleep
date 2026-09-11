-- Security fix: Prevent unilateral relationship activation.
-- Disallow inserting or updating relationships with status = 'active' via authenticated client queries.
-- Activation must occur only through a secure, mutual-consent mechanism.

DROP POLICY IF EXISTS "relationships_insert_involved" ON public.relationships;
CREATE POLICY "relationships_insert_involved" ON public.relationships
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() OR partner_id = auth.uid())
    AND status = 'pending'::public.relationship_status
  );

DROP POLICY IF EXISTS "relationships_update_involved" ON public.relationships;
CREATE POLICY "relationships_update_involved" ON public.relationships
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR partner_id = auth.uid())
  WITH CHECK (
    (user_id = auth.uid() OR partner_id = auth.uid())
    AND status <> 'active'::public.relationship_status
  );
