-- ============================================================================
-- FIX: Add INSERT policy for profiles table
-- This allows users to create their own profile during signup
-- ============================================================================

-- Drop existing policies if they exist (optional, for clean slate)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Add INSERT policy to allow users to create their own profile
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Verify the policy was created
SELECT * FROM pg_policies WHERE tablename = 'profiles';
