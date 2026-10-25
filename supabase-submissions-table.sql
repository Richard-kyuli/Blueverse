-- ============================================================================
-- ASSIGNMENT SUBMISSIONS TABLE
-- For writers to submit completed work to students
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE NOT NULL,
    writer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- Submission details
    submission_text TEXT,
    file_urls TEXT[] NOT NULL, -- Array of submitted document URLs
    
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
    parent_submission_id UUID REFERENCES public.submissions(id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_submissions_assignment ON public.submissions(assignment_id);
CREATE INDEX idx_submissions_writer ON public.submissions(writer_id);
CREATE INDEX idx_submissions_status ON public.submissions(status);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Writers can view their own submissions
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
-- TRIGGER FOR UPDATED_AT
-- ============================================================================
CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON public.submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STORAGE BUCKET FOR SUBMISSIONS
-- ============================================================================
-- Note: Create this bucket via Supabase Dashboard:
-- 1. Go to Storage
-- 2. Create bucket named 'submissions'
-- 3. Set as private (only authenticated users with proper assignment access)

-- Storage policies for submissions (run after creating bucket)
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

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run this to verify the table was created:
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'submissions'
-- ORDER BY ordinal_position;

