-- ============================================================================
-- FIX RLS POLICIES FOR ASSIGNMENTS TABLE
-- Allow students to create assignments
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Assignments are viewable by everyone" ON public.assignments;
DROP POLICY IF EXISTS "Students can create assignments" ON public.assignments;
DROP POLICY IF EXISTS "Students can update own assignments" ON public.assignments;

-- Recreate with correct permissions

-- Allow everyone to view assignments
CREATE POLICY "Enable read access for all users" 
ON public.assignments FOR SELECT 
USING (true);

-- Allow authenticated students to create assignments
CREATE POLICY "Enable insert for students" 
ON public.assignments FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = student_id);

-- Allow students to update their own assignments
CREATE POLICY "Enable update for assignment owners" 
ON public.assignments FOR UPDATE 
TO authenticated
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

-- Allow writers to update assignments they're assigned to (for status updates)
CREATE POLICY "Enable update for assigned writers" 
ON public.assignments FOR UPDATE 
TO authenticated
USING (auth.uid() = assigned_writer_id);

-- Ensure RLS is enabled
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'assignments';
