-- ============================================================================
-- NOTIFICATIONS FIX
--
-- The dashboard bell reads public.notifications with the anon key under RLS and
-- marks items read with an UPDATE, so it needs exactly two policies scoped to
-- auth.uid() = user_id. Earlier scripts created these under different names
-- ("Users can view own notifications" in supabase-schema.sql, "Enable read for
-- user" in supabase-all-tables-rls-fix.sql), so a partially applied run can
-- leave the table with no working policy. When that happens PostgREST returns
-- an empty result instead of an error and the bell looks "all caught up".
--
-- This script is idempotent: safe to run on a database in any state.
-- Writes stay server-side (service role in lib/notify.js), so signed-in users
-- are deliberately not granted INSERT or DELETE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table and columns
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,  -- built in on Postgres 13+, no extension needed
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Repair any columns missing from a partially created table
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- markNotificationAsRead() writes both of these; a NULL is_read would hide the badge
UPDATE public.notifications SET is_read = false WHERE is_read IS NULL;
ALTER TABLE public.notifications ALTER COLUMN is_read SET DEFAULT false;
ALTER TABLE public.notifications ALTER COLUMN is_read SET NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. Drop any CHECK constraint that restricts `type`
--    Valid types are defined in lib/notifications.js (NOTIFICATION_TYPES), which
--    now includes message_received, review_received and bid_accepted. An old
--    constraint here would make those notification inserts fail silently.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    constraint_row RECORD;
BEGIN
    FOR constraint_row IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.notifications'::regclass
          AND contype = 'c'
    LOOP
        EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', constraint_row.conname);
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Replace every existing policy on the table with the canonical pair
--    Dropped by name from the catalog so leftover policies from any earlier
--    script cannot AND-narrow the result set.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    policy_row RECORD;
BEGIN
    FOR policy_row IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'notifications'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', policy_row.policyname);
    END LOOP;
END $$;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- The bell's unread count and list: SELECT ... WHERE user_id = auth.uid()
CREATE POLICY "Users can read own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- markNotificationAsRead() / markAllNotificationsAsRead()
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4. Table privileges
--    RLS is applied on top of GRANTs; a revoked GRANT produces the same empty
--    result. Writes are service-role only.
-- ----------------------------------------------------------------------------
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
REVOKE INSERT, DELETE ON public.notifications FROM authenticated;
REVOKE ALL ON public.notifications FROM anon;

-- ----------------------------------------------------------------------------
-- 5. Indexes and live updates
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON public.notifications (user_id, created_at DESC);

-- Lets the bell receive INSERT events instead of waiting for its 60s poll.
-- Silently ignored when the publication is absent or the table is a member.
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 6. Verification
-- ----------------------------------------------------------------------------
-- Expect two rows, one SELECT and one UPDATE.
SELECT policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notifications'
ORDER BY cmd;

-- Expect 9 columns, all with the right types.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notifications'
ORDER BY ordinal_position;

-- Expect true for rowsecurity.
SELECT relname, relrowsecurity
FROM pg_class
WHERE oid = 'public.notifications'::regclass;

-- Expect at least one row after the next workflow event; shows who has unread
-- items. Zero rows here means the policies are fine and nothing has fired yet.
SELECT user_id,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE NOT is_read) AS unread
FROM public.notifications
GROUP BY user_id
ORDER BY total DESC
LIMIT 20;
