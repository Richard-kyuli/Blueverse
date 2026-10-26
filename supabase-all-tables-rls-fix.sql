-- ============================================================================
-- COMPLETE RLS FIX FOR ALL TABLES
-- Run this once to fix all permission issues
-- ============================================================================

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authentication users" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.profiles;

CREATE POLICY "Enable read access for all users" 
ON public.profiles FOR SELECT 
USING (true);

CREATE POLICY "Enable insert for authentication users" 
ON public.profiles FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users based on id" 
ON public.profiles FOR UPDATE 
TO authenticated
USING (auth.uid() = id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ASSIGNMENTS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Enable read access for all users" ON public.assignments;
DROP POLICY IF EXISTS "Enable insert for students" ON public.assignments;
DROP POLICY IF EXISTS "Enable update for assignment owners" ON public.assignments;
DROP POLICY IF EXISTS "Enable update for assigned writers" ON public.assignments;

CREATE POLICY "Enable read access for all users" 
ON public.assignments FOR SELECT 
USING (true);

CREATE POLICY "Enable insert for students" 
ON public.assignments FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Enable update for assignment owners" 
ON public.assignments FOR UPDATE 
TO authenticated
USING (auth.uid() = student_id);

CREATE POLICY "Enable update for assigned writers" 
ON public.assignments FOR UPDATE 
TO authenticated
USING (auth.uid() = assigned_writer_id);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- BIDS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Enable read for assignment owner and bidder" ON public.bids;
DROP POLICY IF EXISTS "Enable insert for writers" ON public.bids;
DROP POLICY IF EXISTS "Enable update for bidder" ON public.bids;
DROP POLICY IF EXISTS "Enable update for assignment owner" ON public.bids;

-- Writers can see their own bids
CREATE POLICY "Enable read for bidder" 
ON public.bids FOR SELECT 
TO authenticated
USING (auth.uid() = writer_id);

-- Students can see bids on their assignments
CREATE POLICY "Enable read for assignment owner" 
ON public.bids FOR SELECT 
TO authenticated
USING (
  auth.uid() IN (
    SELECT student_id FROM assignments WHERE id = assignment_id
  )
);

-- Writers can create bids
CREATE POLICY "Enable insert for writers" 
ON public.bids FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = writer_id);

-- Writers can update their own bids
CREATE POLICY "Enable update for bidder" 
ON public.bids FOR UPDATE 
TO authenticated
USING (auth.uid() = writer_id);

-- Students can update bids on their assignments (to accept/reject)
CREATE POLICY "Enable update for assignment owner" 
ON public.bids FOR UPDATE 
TO authenticated
USING (
  auth.uid() IN (
    SELECT student_id FROM assignments WHERE id = assignment_id
  )
);

ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Enable read for sender and receiver" ON public.messages;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.messages;
DROP POLICY IF EXISTS "Enable update for receiver" ON public.messages;

CREATE POLICY "Enable read for sender and receiver" 
ON public.messages FOR SELECT 
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Enable insert for authenticated users" 
ON public.messages FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Enable update for receiver" 
ON public.messages FOR UPDATE 
TO authenticated
USING (auth.uid() = receiver_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- REVIEWS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Enable read for all users" ON public.reviews;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.reviews;

CREATE POLICY "Enable read for all users" 
ON public.reviews FOR SELECT 
USING (true);

CREATE POLICY "Enable insert for authenticated users" 
ON public.reviews FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = reviewer_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
-- Policies are dropped from the catalog rather than by name: this file creates
-- "Enable read for user" while supabase-schema.sql creates "Users can view own
-- notifications", so a half-applied run can leave RLS enabled with no policy at
-- all. PostgREST then returns an empty set instead of an error, and the
-- dashboard bell silently looks empty (its load error stays hidden).
DO $$
DECLARE
  policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', policy_row.policyname);
  END LOOP;
END $$;

-- markNotificationAsRead() writes both columns; a missing one 400s the UPDATE
-- and the badge never clears. A NULL is_read also hides it, since the bell
-- counts rows where is_read is false.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
UPDATE public.notifications SET is_read = false WHERE is_read IS NULL;
ALTER TABLE public.notifications ALTER COLUMN is_read SET DEFAULT false;
ALTER TABLE public.notifications ALTER COLUMN is_read SET NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for user"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Enable update for user"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS applies on top of GRANTs, so a revoked GRANT also reads as an empty
-- table. Notifications are written server-side with the service role only
-- (lib/notify.js), never by the browser.
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
REVOKE INSERT, DELETE ON public.notifications FROM authenticated;

-- Lets the bell receive INSERT events instead of waiting for its 60s poll
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- ============================================================================
-- TRANSACTIONS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Enable read for student and writer" ON public.transactions;

CREATE POLICY "Enable read for student and writer" 
ON public.transactions FOR SELECT 
TO authenticated
USING (auth.uid() = student_id OR auth.uid() = writer_id);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VERIFY ALL POLICIES
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  roles
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
