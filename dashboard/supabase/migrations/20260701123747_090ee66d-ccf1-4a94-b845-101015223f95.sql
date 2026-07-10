
-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status public.user_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_by uuid;

UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');
UPDATE public.profiles SET status = 'approved' WHERE status = 'pending' AND created_at < now() - interval '1 minute';

-- Helpers
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND status = 'approved')
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'admin'::app_role) OR public.has_role(_user_id,'super_admin'::app_role)
$$;

-- Audit logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  action text NOT NULL,
  entity text,
  entity_id text,
  ip_address text,
  device text,
  location text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Users insert audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs (created_at DESC);

-- Approval requests
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.user_status NOT NULL DEFAULT 'pending',
  reason text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.approval_requests TO authenticated;
GRANT ALL ON public.approval_requests TO service_role;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own request" ON public.approval_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage requests" ON public.approval_requests FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Users create own request" ON public.approval_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP TRIGGER IF EXISTS approval_requests_updated_at ON public.approval_requests;
CREATE TRIGGER approval_requests_updated_at BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Admins can update any profile
DROP POLICY IF EXISTS "Admins update profiles" ON public.profiles;
CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- New user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_is_super boolean := (new.email = 'nanaamofa297@gmail.com');
BEGIN
  INSERT INTO public.profiles (id, full_name, institution, country, profession, email, status)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'institution',
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'role',
    new.email,
    CASE WHEN v_is_super THEN 'approved'::user_status ELSE 'pending'::user_status END
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, CASE WHEN v_is_super THEN 'super_admin'::app_role ELSE 'researcher'::app_role END)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.approval_requests (user_id, status, reviewed_at)
  VALUES (new.id,
          CASE WHEN v_is_super THEN 'approved'::user_status ELSE 'pending'::user_status END,
          CASE WHEN v_is_super THEN now() ELSE NULL END);
  RETURN new;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill super admin
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE email = 'nanaamofa297@gmail.com';
  IF v_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, full_name, email, status)
    VALUES (v_id, 'Super Admin', 'nanaamofa297@gmail.com', 'approved')
    ON CONFLICT (id) DO UPDATE SET status = 'approved', email = EXCLUDED.email;
    INSERT INTO public.user_roles (user_id, role) VALUES (v_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;
