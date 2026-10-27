-- ============================================================================
-- DISPUTES WORKFLOW
-- ============================================================================
-- Adds the audit trail for a dispute opened by a student or a writer.
--
-- Before this, the `disputed` status existed in the CHECK constraint and the
-- admin console could resolve it, but no code ever wrote it: the admin queue
-- was structurally always empty. POST /api/assignments/[id]/dispute now sets
-- the status and records who opened it, why, and when.
--
-- Safe to re-run. Apply in the Supabase SQL editor; the app degrades to a bare
-- status change (no reason stored) until this has been run, because the route
-- retries without these columns on error 42703.
-- ============================================================================

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS dispute_category TEXT,
  ADD COLUMN IF NOT EXISTS dispute_details TEXT,
  ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disputed_by UUID;

-- Added separately so a re-run does not fail on the duplicate constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assignments_disputed_by_fkey'
      AND conrelid = 'public.assignments'::regclass
  ) THEN
    ALTER TABLE public.assignments
      ADD CONSTRAINT assignments_disputed_by_fkey
      FOREIGN KEY (disputed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- The admin queue reads `status = 'disputed'` ordered by recency.
CREATE INDEX IF NOT EXISTS idx_assignments_disputed_at
  ON public.assignments (disputed_at DESC)
  WHERE status = 'disputed';

-- ----------------------------------------------------------------------------
-- Verify
-- ----------------------------------------------------------------------------
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'assignments'
  AND column_name IN ('dispute_category', 'dispute_details', 'disputed_at', 'disputed_by')
ORDER BY column_name;

-- Expected: four rows. If this returns fewer, the ALTERs above did not apply.

-- ============================================================================
-- KNOWN GAP, NOT FIXED HERE
-- ============================================================================
-- `assignments` still grants table-level UPDATE to `authenticated`, and its RLS
-- policies only check row ownership (`auth.uid() = student_id` or
-- `auth.uid() = assigned_writer_id`). A participant can therefore bypass this
-- workflow and set `status` directly from the browser client — the same class
-- of hole that supabase-profiles-privilege-guard.sql closes on `profiles`.
--
-- Closing it safely needs the remaining client-side assignment writes moved
-- behind API routes first. Bid acceptance in
-- app/dashboard/assignments/[id]/page.jsx still writes status, final_price and
-- assigned_writer_id with the anon-key client, so a blanket column REVOKE or a
-- status-pinning trigger would break hiring. Do that migration before adding:
--
--   REVOKE UPDATE ON public.assignments FROM authenticated, anon;
--   GRANT UPDATE (status, assigned_writer_id, assigned_at, final_price,
--                 started_at, submitted_at, completed_at, updated_at)
--     ON public.assignments TO authenticated;
--
-- ...plus a trigger pinning money columns once the work is awarded.
-- ============================================================================
