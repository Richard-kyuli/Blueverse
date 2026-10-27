-- ============================================================================
-- BLUEVERSE: BLOCK SELF-PROMOTION TO ADMIN
-- ============================================================================
-- Run this in Supabase > SQL Editor (it runs as `postgres`, which the trigger
-- below treats as trusted). Safe to re-run.
--
-- THE PROBLEM
-- Every profiles policy in this repo is row-scoped, never column-scoped:
--
--   FOR UPDATE TO authenticated USING (auth.uid() = id)
--
-- `WITH CHECK (auth.uid() = id)` only re-asserts row ownership; it says nothing
-- about WHICH columns may change. Supabase also grants table-level UPDATE to
-- `authenticated`, which covers every column. So any signed-in user could run
-- this from the browser console and become an administrator:
--
--   supabase.from('profiles').update({ user_type: 'admin' }).eq('id', myId)
--
-- The admin console's routes (/api/admin/*) authorise on
-- profiles.user_type === 'admin', so that one UPDATE hands over the console.
--
-- THE FIX has three independent layers, so re-running an older RLS script in
-- this repo cannot silently reopen the hole:
--   1. INSERT policy: self-registration is limited to student/writer.
--   2. Column privileges: `authenticated` may only UPDATE profile-edit columns.
--   3. BEFORE INSERT OR UPDATE trigger: pins the privileged columns to their
--      stored values for any non-service-role caller.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- LAYER 1: self-registration cannot claim a privileged role
-- ----------------------------------------------------------------------------
-- Policies are dropped from the catalog rather than by name: this table has
-- carried "Enable insert for authentication users" and "Users can insert own
-- profile" across different scripts.
DO $$
DECLARE policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', policy_row.policyname);
  END LOOP;
END $$;

CREATE POLICY "Enable insert for authentication users"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id AND user_type IN ('student', 'writer'));

-- ----------------------------------------------------------------------------
-- LAYER 2: column-level UPDATE privileges
-- ----------------------------------------------------------------------------
-- A table-level GRANT covers all columns and cannot be narrowed by a column
-- REVOKE, so the table grant has to go first. These are exactly the columns the
-- profile editor writes (components/dashboard/ProfileModal.jsx and
-- app/dashboard/profile/page.jsx). To allow a new self-editable column later,
-- add it to the GRANT below rather than restoring the table grant.
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (full_name, phone, location, bio, expertise, avatar_url, updated_at)
  ON public.profiles TO authenticated;

-- ----------------------------------------------------------------------------
-- LAYER 3: trigger that pins privileged columns
-- ----------------------------------------------------------------------------
-- Silently reverts rather than raising, so an ordinary profile save that posts
-- an extra field still succeeds. Reverting is the safe default: a client that
-- tries to escalate gets 200 with the value unchanged.
--
-- Trusted callers: service_role (server routes, admin console, provisioning),
-- postgres and supabase_admin (SQL editor, migrations).
CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A client-side signup may only create a student or writer.
    IF NEW.user_type IS NULL OR NEW.user_type NOT IN ('student', 'writer') THEN
      RAISE EXCEPTION 'Accounts cannot be created with user_type = %', NEW.user_type
        USING ERRCODE = '42501';
    END IF;

    NEW.is_verified        := FALSE;
    NEW.verified_at        := NULL;
    NEW.is_active          := TRUE;
    NEW.suspended_at       := NULL;
    NEW.suspension_reason  := NULL;
    NEW.rating             := 0;
    NEW.completed_assignments := 0;
    NEW.success_rate       := 0;
    RETURN NEW;
  END IF;

  -- UPDATE: privileged columns keep whatever is already stored.
  NEW.user_type             := OLD.user_type;
  NEW.is_verified           := OLD.is_verified;
  NEW.verified_at           := OLD.verified_at;
  NEW.is_active             := OLD.is_active;
  NEW.suspended_at          := OLD.suspended_at;
  NEW.suspension_reason     := OLD.suspension_reason;
  NEW.rating                := OLD.rating;
  NEW.completed_assignments := OLD.completed_assignments;
  NEW.success_rate          := OLD.success_rate;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_privileges ON public.profiles;
CREATE TRIGGER guard_profile_privileges
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileges();

-- ----------------------------------------------------------------------------
-- VERIFY
-- ----------------------------------------------------------------------------
-- Expect one INSERT policy whose qual mentions student/writer.
SELECT policyname, cmd, roles, qual AS using_check, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY cmd, policyname;

-- Expect UPDATE limited to the profile-edit columns, and no table-level UPDATE.
SELECT grantee, privilege_type, column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'profiles' AND privilege_type = 'UPDATE'
ORDER BY grantee, column_name;

SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY grantee, privilege_type;

-- Expect the trigger present and enabled (tgenabled = 'O').
SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.profiles'::regclass AND NOT tgisinternal;

-- Sanity check: privileged accounts and how they got there.
SELECT id, email, user_type, is_active, is_verified
FROM public.profiles
WHERE user_type = 'admin'
ORDER BY email;
