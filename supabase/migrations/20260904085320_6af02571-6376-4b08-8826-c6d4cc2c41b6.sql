CREATE TYPE public.app_role AS ENUM ('user', 'partner');
CREATE TYPE public.relationship_status AS ENUM ('pending', 'active', 'disconnected');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  nickname TEXT,
  role public.app_role NOT NULL DEFAULT 'user',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  avatar_url TEXT,
  onboarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.relationship_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT relationships_distinct_people CHECK (user_id <> partner_id),
  CONSTRAINT relationships_unique_pair UNIQUE (user_id, partner_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relationships TO authenticated;
GRANT ALL ON public.relationships TO service_role;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sharing_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_sleep_duration BOOLEAN NOT NULL DEFAULT false,
  share_sleep_quality BOOLEAN NOT NULL DEFAULT false,
  share_exact_bedtime BOOLEAN NOT NULL DEFAULT false,
  share_exact_waketime BOOLEAN NOT NULL DEFAULT false,
  share_mood BOOLEAN NOT NULL DEFAULT false,
  share_energy BOOLEAN NOT NULL DEFAULT false,
  share_caffeine BOOLEAN NOT NULL DEFAULT false,
  share_phone_usage BOOLEAN NOT NULL DEFAULT false,
  share_naps BOOLEAN NOT NULL DEFAULT false,
  share_reasons BOOLEAN NOT NULL DEFAULT false,
  share_notes BOOLEAN NOT NULL DEFAULT false,
  share_insights BOOLEAN NOT NULL DEFAULT false,
  share_patterns BOOLEAN NOT NULL DEFAULT false,
  share_journal BOOLEAN NOT NULL DEFAULT false,
  share_everything BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sharing_permissions_unique_pair UNIQUE (user_id, partner_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sharing_permissions TO authenticated;
GRANT ALL ON public.sharing_permissions TO service_role;
ALTER TABLE public.sharing_permissions ENABLE ROW LEVEL SECURITY;

-- Security definer helper: are these two people actively connected?
CREATE OR REPLACE FUNCTION public.is_actively_linked(_a UUID, _b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.relationships r
    WHERE r.status = 'active'
      AND ((r.user_id = _a AND r.partner_id = _b)
        OR (r.user_id = _b AND r.partner_id = _a))
  )
$$;

-- profiles policies
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_select_linked" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_actively_linked(auth.uid(), id));
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- relationships policies
CREATE POLICY "relationships_select_involved" ON public.relationships
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "relationships_insert_involved" ON public.relationships
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "relationships_update_involved" ON public.relationships
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR partner_id = auth.uid())
  WITH CHECK (user_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "relationships_delete_involved" ON public.relationships
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR partner_id = auth.uid());

-- sharing_permissions policies: only the primary user writes; partner may read
CREATE POLICY "sharing_select_owner" ON public.sharing_permissions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "sharing_select_partner" ON public.sharing_permissions
  FOR SELECT TO authenticated
  USING (partner_id = auth.uid() AND public.is_actively_linked(auth.uid(), user_id));
CREATE POLICY "sharing_insert_owner" ON public.sharing_permissions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "sharing_update_owner" ON public.sharing_permissions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "sharing_delete_owner" ON public.sharing_permissions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- timestamps
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER relationships_touch BEFORE UPDATE ON public.relationships
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER sharing_touch BEFORE UPDATE ON public.sharing_permissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- auto-create a profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();