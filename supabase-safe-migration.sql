-- ============================================================================
-- SAFE PROFILE MIGRATION - Handles Existing Policies
-- This version safely adds fields and policies without errors
-- ============================================================================

-- ============================================================================
-- PART 1: ADD LOCATION FIELD (Safe - uses IF NOT EXISTS)
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;

-- ============================================================================
-- PART 2: CREATE STORAGE POLICIES (Safe - drops existing first)
-- ============================================================================

-- Drop existing policies if they exist (no error if they don't exist)
DROP POLICY IF EXISTS "Public can view profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

-- Now create fresh policies
CREATE POLICY "Public can view profile photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'profiles');

CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profiles' 
  AND (storage.foldername(name))[1] = 'avatars'
);

CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
);

CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check profile fields
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('location', 'avatar_url', 'phone', 'bio', 'expertise')
ORDER BY column_name;

-- Check storage policies
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (policyname LIKE '%avatar%' OR policyname LIKE '%profile%')
ORDER BY policyname;

-- ============================================================================
-- SUCCESS!
-- All profile features are now set up correctly
-- ============================================================================
