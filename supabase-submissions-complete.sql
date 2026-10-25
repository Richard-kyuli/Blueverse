-- ============================================================================
-- COMPLETE SUBMISSIONS TABLE MIGRATION
-- Includes function definition + table + policies
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE HELPER FUNCTION
-- ============================================================================

-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 2: CREATE SUBMISSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE NOT NULL,
    writer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- Submission details
    submission_text TEXT,
    file_urls TEXT[] NOT NULL DEFAULT '{}',
    
    -- Status
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'revision_requested', 'rejected')),
    
    -- Feedback
    student_feedback TEXT,
    revision_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Track revisions
    revision_number INTEGER DEFAULT 1,
    parent_submission_id UUID REFERENCES public.submissions(id) ON DELETE SET NULL
);

-- ============================================================================
-- STEP 3: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON public.submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_writer ON public.submissions(writer_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON public.submissions(created_at DESC);

-- ============================================================================
-- STEP 4: CREATE TRIGGER
-- ============================================================================

DROP TRIGGER IF EXISTS update_submissions_updated_at ON public.submissions;

CREATE TRIGGER update_submissions_updated_at 
    BEFORE UPDATE ON public.submissions
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 5: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 6: DROP OLD POLICIES (if they exist)
-- ============================================================================

DROP POLICY IF EXISTS "Writers can view own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Writers can create submissions" ON public.submissions;
DROP POLICY IF EXISTS "Students can update submissions" ON public.submissions;
DROP POLICY IF EXISTS "Writers can update own submissions" ON public.submissions;

-- ============================================================================
-- STEP 7: CREATE RLS POLICIES
-- ============================================================================

-- Policy 1: View submissions
CREATE POLICY "Writers can view own submissions" ON public.submissions
    FOR SELECT USING (
        auth.uid() = writer_id OR
        auth.uid() IN (
            SELECT student_id FROM public.assignments WHERE id = assignment_id
        )
    );

-- Policy 2: Create submissions
CREATE POLICY "Writers can create submissions" ON public.submissions
    FOR INSERT WITH CHECK (
        auth.uid() = writer_id AND
        EXISTS (
            SELECT 1 FROM public.assignments 
            WHERE id = assignment_id 
            AND assigned_writer_id = auth.uid()
            AND status IN ('assigned', 'in_progress')
        )
    );

-- Policy 3: Students update submissions (approve/request revision)
CREATE POLICY "Students can update submissions" ON public.submissions
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT student_id FROM public.assignments WHERE id = assignment_id
        )
    );

-- Policy 4: Writers can update their own submissions (for revisions)
CREATE POLICY "Writers can update own submissions" ON public.submissions
    FOR UPDATE USING (
        auth.uid() = writer_id
    );

-- ============================================================================
-- STEP 8: VERIFICATION
-- ============================================================================

-- Check table exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'submissions'
    ) THEN
        RAISE NOTICE '✓ submissions table created successfully';
    END IF;
END $$;

-- Display table structure
SELECT 
    'Column' as info_type,
    column_name as name, 
    data_type as details
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'submissions'
ORDER BY ordinal_position;

-- Check policies
SELECT 
    'Policy' as info_type,
    policyname as name,
    cmd as details
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'submissions'
ORDER BY policyname;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$ 
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE '✓ Submissions table setup COMPLETE!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Table: public.submissions';
    RAISE NOTICE 'Policies: 4 RLS policies created';
    RAISE NOTICE 'Trigger: update_updated_at_column';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'NEXT STEPS:';
    RAISE NOTICE '1. Create "submissions" storage bucket';
    RAISE NOTICE '2. Run storage policies (see below)';
    RAISE NOTICE '3. Test submission workflow';
    RAISE NOTICE '===========================================';
END $$;

-- ============================================================================
-- STORAGE SETUP (Run AFTER creating bucket)
-- ============================================================================

/*
STORAGE BUCKET SETUP:
1. Go to Supabase Dashboard → Storage
2. Click "New Bucket"
3. Name: submissions
4. Private: YES (checked)
5. Click "Create Bucket"

Then run the policies below:
*/

-- Storage Policy 1: Writers upload
DROP POLICY IF EXISTS "Writers can upload to their assignments" ON storage.objects;
CREATE POLICY "Writers can upload to their assignments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'submissions' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.assignments 
    WHERE assigned_writer_id = auth.uid()
  )
);

-- Storage Policy 2: View access
DROP POLICY IF EXISTS "Assignment parties can view submissions" ON storage.objects;
CREATE POLICY "Assignment parties can view submissions"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'submissions' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.assignments 
    WHERE student_id = auth.uid() OR assigned_writer_id = auth.uid()
  )
);

-- Storage Policy 3: Delete files
DROP POLICY IF EXISTS "Writers can delete their submission files" ON storage.objects;
CREATE POLICY "Writers can delete their submission files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'submissions' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.assignments 
    WHERE assigned_writer_id = auth.uid()
  )
);

-- Final success
DO $$ 
BEGIN
    RAISE NOTICE '✓ Storage policies created successfully!';
END $$;
