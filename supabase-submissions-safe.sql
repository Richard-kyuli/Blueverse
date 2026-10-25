-- ============================================================================
-- SAFE SUBMISSIONS TABLE MIGRATION
-- Creates submissions table with error handling
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE SUBMISSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE NOT NULL,
    writer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- Submission details
    submission_text TEXT,
    file_urls TEXT[] NOT NULL DEFAULT '{}', -- Array of submitted document URLs
    
    -- Status
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'revision_requested', 'rejected')),
    
    -- Feedback
    student_feedback TEXT,
    revision_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Track revision submissions
    revision_number INTEGER DEFAULT 1,
    parent_submission_id UUID REFERENCES public.submissions(id) ON DELETE SET NULL
);

-- ============================================================================
-- PART 2: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON public.submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_writer ON public.submissions(writer_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);

-- ============================================================================
-- PART 3: ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 4: DROP EXISTING POLICIES (if any)
-- ============================================================================

DROP POLICY IF EXISTS "Writers can view own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Writers can create submissions" ON public.submissions;
DROP POLICY IF EXISTS "Students can update submissions" ON public.submissions;

-- ============================================================================
-- PART 5: CREATE RLS POLICIES
-- ============================================================================

-- Writers can view their own submissions + Students can view submissions for their assignments
CREATE POLICY "Writers can view own submissions" ON public.submissions
    FOR SELECT USING (
        auth.uid() = writer_id OR
        auth.uid() IN (
            SELECT student_id FROM public.assignments WHERE id = assignment_id
        )
    );

-- Writers can create submissions for their assigned assignments
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

-- Students can update submissions (approve/request revision)
CREATE POLICY "Students can update submissions" ON public.submissions
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT student_id FROM public.assignments WHERE id = assignment_id
        )
    );

-- ============================================================================
-- PART 6: CREATE TRIGGER FOR UPDATED_AT
-- ============================================================================

-- Check if trigger function exists, if not it should already exist from base schema
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
    ) THEN
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $func$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql;
    END IF;
END $$;

-- Create trigger
DROP TRIGGER IF EXISTS update_submissions_updated_at ON public.submissions;
CREATE TRIGGER update_submissions_updated_at 
    BEFORE UPDATE ON public.submissions
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 7: VERIFICATION
-- ============================================================================

-- Check if table was created successfully
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'submissions'
    ) THEN
        RAISE NOTICE '✓ submissions table created successfully';
    ELSE
        RAISE EXCEPTION '✗ submissions table was not created';
    END IF;
END $$;

-- Display table structure
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'submissions'
ORDER BY ordinal_position;

-- ============================================================================
-- STORAGE POLICIES (Run AFTER creating 'submissions' bucket)
-- ============================================================================

-- NOTE: First create the bucket via Dashboard:
-- 1. Go to Storage
-- 2. Create bucket named 'submissions'
-- 3. Set as PRIVATE (not public)
-- 
-- Then run the storage policies below:

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Writers can upload to their assignments" ON storage.objects;
DROP POLICY IF EXISTS "Assignment parties can view submissions" ON storage.objects;

-- Writers can upload to their assignments
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

-- Assignment parties (student + writer) can view submissions
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

-- Writers can delete their own submission files
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

-- ============================================================================
-- COMPLETE!
-- ============================================================================

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE '✓ Submissions table setup complete!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Create "submissions" storage bucket (Private)';
    RAISE NOTICE '2. Test creating a submission';
    RAISE NOTICE '3. Test file upload';
    RAISE NOTICE '===========================================';
END $$;
