
-- "Profiles viewable by authenticated" (20260520113514) let any signed-up user,
-- including one still 'pending'/'rejected' approval, select every other user's
-- profile row (full_name, institution, country, email). No feature in the app
-- reads another user's profile outside the admin routes, which already gate on
-- is_admin(). Narrow the policy to self-or-admin, matching the pattern already
-- used by "Admins update profiles".
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
CREATE POLICY "Profiles viewable by self or admin" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin(auth.uid()));
