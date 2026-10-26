-- ============================================================================
-- BlueVerse: student <-> writer messaging flow
--
-- Run this once in the Supabase SQL editor. It is idempotent: safe to re-run.
--
-- The original schema (supabase-schema.sql) created policies for reading and
-- sending messages but never granted UPDATE, so the client-side "mark as read"
-- call was rejected by RLS and silently did nothing. Worse, any authenticated
-- user could insert a row with an arbitrary receiver_id, because the INSERT
-- policy only checked that sender_id matched the caller.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table (no-op if supabase-schema.sql already created it) ---------------------
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,

    message TEXT NOT NULL,
    attachment_urls TEXT[],

    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_assignment_created
    ON public.messages (assignment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread
    ON public.messages (receiver_id, is_read);

-- Drop every policy name this table has ever carried in the repo -------------
DROP POLICY IF EXISTS "Users can view their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Enable read for sender and receiver" ON public.messages;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.messages;
DROP POLICY IF EXISTS "Enable update for receiver" ON public.messages;
DROP POLICY IF EXISTS "Message participants can read their conversation" ON public.messages;
DROP POLICY IF EXISTS "Message participants can send messages" ON public.messages;
DROP POLICY IF EXISTS "Recipients can mark messages as read" ON public.messages;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 1. Read: only the two parties of a message can see it ----------------------
CREATE POLICY "Message participants can read their conversation"
ON public.messages FOR SELECT
TO authenticated
USING (
  auth.uid() = sender_id
  OR auth.uid() = receiver_id
);

-- 2. Send: the sender must be a party of the assignment, and the receiver
--    must be the *other* party. This stops a user from messaging strangers
--    by guessing a profile id.
CREATE POLICY "Message participants can send messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND receiver_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.assignments a
    WHERE a.id = assignment_id
      AND (a.student_id = auth.uid() OR a.assigned_writer_id = auth.uid())
      AND (a.student_id = receiver_id OR a.assigned_writer_id = receiver_id)
  )
);

-- 3. Read receipts: the receiver may update their own incoming messages.
--    WITH CHECK pins receiver_id so an UPDATE cannot hand a thread to someone
--    else, and sender_id stays untouched by the client code.
CREATE POLICY "Recipients can mark messages as read"
ON public.messages FOR UPDATE
TO authenticated
USING (auth.uid() = receiver_id)
WITH CHECK (
  auth.uid() = receiver_id
  AND sender_id <> auth.uid()
);

-- 4. Realtime: the thread page and the inbox subscribe to INSERT events.
--    Without the table in the publication, no event is ever delivered.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
