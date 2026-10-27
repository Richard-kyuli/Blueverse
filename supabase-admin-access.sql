-- ============================================================================
-- ADMIN ACCESS
--
-- Two things the admin console needs from the database:
--   1. the moderation columns the Users screen reads and writes, and
--   2. at least one account with profiles.user_type = 'admin'.
--
-- Deliberately NO admin RLS policies. The console reaches /api/admin/* instead,
-- where authenticateAdmin() verifies the caller and the service-role client does
-- the reading. A policy such as "admins can read everything" would widen what
-- an admin's browser anon key can reach for no benefit.
--
-- Run this once, then sign out and back in so AuthContext reloads the profile.
--
-- Sections 2-4 are for the FIRST administrator only, the chicken-and-egg case:
-- there is nobody signed in who could promote anybody. After that, an
-- administrator adds the rest from Dashboard > Admin > Users > "Add
-- administrator", which posts to /api/admin/admins. Do not promote by hand
-- afterwards: the console also notifies the person and enforces the rules (no
-- duplicate promotion, no suspended account).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Moderation columns
--    Present in supabase-schema.sql, but a database created before that file was
--    extended will be missing them, and suspend/verify would then fail with
--    "column ... does not exist" (Postgres 42703). The console's own
--    "Add administrator" path retries without these columns if they are absent.
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- Existing accounts predate these columns, so backfill the defaults explicitly.
UPDATE public.profiles SET is_active = true WHERE is_active IS NULL;
UPDATE public.profiles SET is_verified = false WHERE is_verified IS NULL;

-- ----------------------------------------------------------------------------
-- 2. Find the account to promote  (first administrator only)
--    Replace the email, run it, and note the id it returns.
-- ----------------------------------------------------------------------------
SELECT id, email, full_name, user_type, is_active
FROM public.profiles
WHERE email = 'you@example.com';

-- ----------------------------------------------------------------------------
-- 3. Promote it  (first administrator only)
-- ----------------------------------------------------------------------------
UPDATE public.profiles
SET user_type = 'admin',
    is_active = true
WHERE email = 'you@example.com';

-- ----------------------------------------------------------------------------
-- 4. Verify
-- ----------------------------------------------------------------------------
SELECT id, email, full_name, user_type, is_active, is_verified
FROM public.profiles
WHERE email = 'you@example.com';

-- Which administrators exist right now. The console refuses to suspend the last
-- active one, so this list should never be empty in a working deployment.
SELECT id, email, full_name, is_active
FROM public.profiles
WHERE user_type = 'admin'
ORDER BY created_at;
