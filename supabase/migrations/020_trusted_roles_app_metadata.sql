-- 020: Move the trusted user role from user_metadata to app_metadata.
--
-- WHY: user_metadata is writable by the user themself (supabase.auth.updateUser /
-- public signUp with options.data). Role checks and the handle_new_user trigger
-- read user_metadata.role, so anyone could make themselves 'super_admin'.
-- app_metadata can only be written with the service role key.
--
-- RUN ORDER (Supabase dashboard → SQL editor):
--   0. Authentication → Sign In / Providers → turn OFF "Allow new users to sign up".
--   1. Run STEP 1 (review) and note the real super admin email(s).
--   2. Put those emails into STEP 3 and run STEPS 2-5 together.
--   3. Run STEP 6 (verify) — every row must show a role, no NULLs for real users.
--   4. Only then merge branch fix/role-from-app-metadata (app reads app_metadata).

-- ── STEP 1: review — who currently claims super_admin? ─────────────────────
-- Legit super admins were created by scripts/create-superadmin.ts or by hand.
-- Anything recent / unknown here is a self-registered account → do NOT whitelist.
SELECT u.email, u.created_at, u.last_sign_in_at,
       u.raw_user_meta_data->>'role' AS user_meta_role, p.role AS profile_role
FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.raw_user_meta_data->>'role' = 'super_admin' OR p.role = 'super_admin'
ORDER BY u.created_at;

BEGIN;

-- ── STEP 2: trigger trusts app_metadata only ───────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_app_meta_data->>'role', 'student'),
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── STEP 3: backfill app_metadata.role from authoritative tables ───────────
UPDATE auth.users u SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) || '{"role":"student"}'
WHERE EXISTS (SELECT 1 FROM public.students s WHERE s.id = u.id);

UPDATE auth.users u SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) || '{"role":"institute_admin"}'
WHERE EXISTS (SELECT 1 FROM public.institute_admins a WHERE a.id = u.id);

-- EDIT THIS LIST with the real super admin email(s) from STEP 1.
UPDATE auth.users u SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) || '{"role":"super_admin"}'
WHERE lower(u.email) IN (
    'replace-with-real-superadmin@example.com'
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE raw_app_meta_data->>'role' = 'super_admin') THEN
        RAISE EXCEPTION 'No super_admin whitelisted — edit the email list in STEP 3 before running.';
    END IF;
END $$;

-- ── STEP 4: strip forged super_admin from profiles (RLS uses profiles.role) ─
UPDATE public.profiles p
SET role = COALESCE(u.raw_app_meta_data->>'role', 'student')
FROM auth.users u
WHERE u.id = p.id AND p.role IS DISTINCT FROM COALESCE(u.raw_app_meta_data->>'role', 'student');

-- ── STEP 5 ──────────────────────────────────────────────────────────────────
COMMIT;

-- ── STEP 6: verify ─────────────────────────────────────────────────────────
SELECT raw_app_meta_data->>'role' AS app_role, count(*)
FROM auth.users GROUP BY 1 ORDER BY 1;
