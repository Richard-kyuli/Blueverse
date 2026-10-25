-- ============================================================================
-- COMPLETE RLS FIX FOR PROFILES TABLE
-- This will allow users to create profiles during signup
-- ============================================================================

-- Step 1: Drop ALL existing policies on profiles table
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Step 2: Create new policies with correct permissions

-- Allow anyone to view profiles (needed for seeing writers/students)
CREATE POLICY "Enable read access for all users" 
ON public.profiles FOR SELECT 
USING (true);

-- Allow users to INSERT their own profile during signup
CREATE POLICY "Enable insert for authentication users" 
ON public.profiles FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- Allow users to UPDATE their own profile
CREATE POLICY "Enable update for users based on id" 
ON public.profiles FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Step 3: Verify RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Step 4: Check the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles';
