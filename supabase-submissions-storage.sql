-- ============================================================================
-- SUPABASE STORAGE SETUP FOR ASSIGNMENT SUBMISSIONS
-- Assignment Submission & Review Workflow
-- ============================================================================
-- This script creates the submissions storage bucket and sets up RLS policies
-- for secure file uploads and access control.
--
-- Requirements covered: FR-1, NFR-1, INT-1
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE STORAGE BUCKET
-- ============================================================================
-- Note: This must be done via Supabase Dashboard or using the Supabase Management API
-- The bucket should be created with the following settings:
--   - Name: submissions
--   - Public: NO (Private bucket - files require authentication)
--   - File size limit: 50MB (per file)
--   - Allowed MIME types: application/pdf, application/msword, 
--     application/vnd.openxmlformats-officedocument.wordprocessingml.document,
--     text/plain, application/zip

-- To create via Dashboard:
-- 1. Go to Supabase Dashboard → Storage
-- 2. Click "New Bucket"
-- 3. Name: submissions
-- 4. Public: UNCHECKED (keep private)
-- 5. Click "Create Bucket"

-- ============================================================================
-- STEP 2: STORAGE POLICIES FOR SUBMISSIONS BUCKET
-- ============================================================================

-- ----------------------------------------------------------------------------
-- POLICY 1: Writers can upload files to their assigned assignments
-- ----------------------------------------------------------------------------
-- Purpose: Allow writers to upload submission files only to assignments they're working on
-- Access: authenticated users (writers)
-- Operation: INSERT (upload)
CREATE POLICY "Writers can upload to their assigned assignments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'submissions' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.assignments 
    WHERE assigned_writer_id = auth.uid()
    AND status IN ('assigned', 'in_progress', 'under_review')
  )
);

-- ----------------------------------------------------------------------------
-- POLICY 2: Assignment parties can view submission files
-- ----------------------------------------------------------------------------
-- Purpose: Allow both students (assignment owners) and writers (assigned) to view/download files
-- Access: authenticated users (students and writers involved in the assignment)
-- Operation: SELECT (view/download)
CREATE POLICY "Assignment parties can view submission files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'submissions' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.assignments 
    WHERE student_id = auth.uid() OR assigned_writer_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- POLICY 3: Writers can update their submission files
-- ----------------------------------------------------------------------------
-- Purpose: Allow writers to replace/update files in their submissions (before review)
-- Access: authenticated users (writers)
-- Operation: UPDATE (replace file)
CREATE POLICY "Writers can update their submission files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'submissions' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.assignments 
    WHERE assigned_writer_id = auth.uid()
    AND status IN ('assigned', 'in_progress')
  )
);

-- ----------------------------------------------------------------------------
-- POLICY 4: Writers can delete their submission files
-- ----------------------------------------------------------------------------
-- Purpose: Allow writers to remove files from their submissions (before final submission)
-- Access: authenticated users (writers)
-- Operation: DELETE (remove file)
CREATE POLICY "Writers can delete their submission files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'submissions' 
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.assignments 
    WHERE assigned_writer_id = auth.uid()
    AND status IN ('assigned', 'in_progress')
  )
);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Use these queries to verify the policies are working correctly

-- Check if storage policies exist for submissions bucket
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%submission%' OR policyname LIKE '%assigned assignment%';

-- ============================================================================
-- FILE STRUCTURE REFERENCE
-- ============================================================================
-- Files will be organized as follows:
-- submissions/
--   {assignment_id}/
--     {submission_id}/
--       document1.pdf
--       essay.docx
--       sources.zip
--       ...
--
-- Example path: submissions/123e4567-e89b-12d3-a456-426614174000/456e7890-e89b-12d3-a456-426614174001/essay.pdf
--
-- URL format after upload:
-- https://{project-ref}.supabase.co/storage/v1/object/authenticated/submissions/{assignment_id}/{submission_id}/{filename}

-- ============================================================================
-- TESTING CHECKLIST
-- ============================================================================
-- After running this script:
-- [ ] 1. Create 'submissions' bucket via Supabase Dashboard (if not exists)
-- [ ] 2. Ensure bucket is set to PRIVATE (not public)
-- [ ] 3. Run this SQL script in Supabase SQL Editor
-- [ ] 4. Verify policies exist using verification query above
-- [ ] 5. Test writer upload to assigned assignment (should succeed)
-- [ ] 6. Test writer upload to unassigned assignment (should fail)
-- [ ] 7. Test student download from their assignment (should succeed)
-- [ ] 8. Test unauthorized user access (should fail)
-- [ ] 9. Test writer delete before submission (should succeed)
-- [ ] 10. Test writer delete after submission (should fail based on status)

-- ============================================================================
-- SECURITY NOTES
-- ============================================================================
-- 1. The bucket MUST be private (not public) to enforce authentication
-- 2. File access is controlled through RLS policies based on assignment ownership
-- 3. Writers can only upload to assignments they're assigned to
-- 4. Both students and writers can view files for their assignments
-- 5. Writers can only delete/update files before final submission
-- 6. Assignment status checks prevent unauthorized modifications
-- 7. All operations require authentication (no anonymous access)

-- ============================================================================
-- MAINTENANCE
-- ============================================================================
-- To update policies in the future:
-- 1. DROP existing policy: DROP POLICY "policy_name" ON storage.objects;
-- 2. CREATE new policy with updated logic
-- 3. Test thoroughly before deploying to production

-- ============================================================================
-- RELATED FILES
-- ============================================================================
-- Database schema: supabase-submissions-complete.sql
-- Storage setup guide: SUPABASE-STORAGE-SETUP.md (for profiles bucket)
-- Design document: .kiro/specs/assignment-submission-workflow/design.md
-- Requirements: .kiro/specs/assignment-submission-workflow/requirements.md

