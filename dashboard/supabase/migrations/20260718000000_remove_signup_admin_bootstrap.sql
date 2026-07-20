
-- 20260701123747 special-cased 'nanaamofa297@gmail.com' inside handle_new_user()
-- so every signup, forever, gets checked against a hardcoded personal email.
-- The account was bootstrapped once (see that migration's one-time backfill DO
-- block, which is left untouched — it only ever matches during fresh-database
-- provisioning). Ongoing admin promotion already has a real path via
-- is_admin() / "Admins update profiles" / "Admins manage requests", exercised
-- through the admin UI. Redefine the trigger so every new signup is treated
-- identically, closing the hardcoded-email code path without touching
-- whoever already holds admin rights.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, institution, country, profession, email, status)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'institution',
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'role',
    new.email,
    'pending'::user_status
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'researcher'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.approval_requests (user_id, status, reviewed_at)
  VALUES (new.id, 'pending'::user_status, NULL);
  RETURN new;
END; $$;
