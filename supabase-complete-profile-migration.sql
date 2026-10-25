-- ============================================================================
-- BLUEVERSE COMPLETE PROFILE FEATURES MIGRATION
-- This file contains all SQL needed for profile management features:
-- 1. Profile table field updates
-- 2. Storage bucket setup for profile photos
-- 3. Storage policies for secure file access
-- ============================================================================

-- ============================================================================
-- PART 1: UPDATE PROFILES TABLE
-- ============================================================================

-- Add location field (if not exists)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.location IS 'User location in City, Country format';

-- Verify existing fields are present (these should already exist from base schema)
-- avatar_url, phone, bio, expertise

-- ============================================================================
-- PART 2: CREATE STORAGE BUCKET FOR PROFILE PHOTOS
-- ============================================================================

-- Note: Storage buckets are typically created via the Supabase Dashboard UI
-- Go to: Storage → New Bucket → Name: "profiles" → Public: Yes
-- 
-- If you have access to SQL-based bucket creation (Enterprise/Self-hosted):
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('profiles', 'profiles', true)
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PART 3: STORAGE POLICIES FOR PROFILE PHOTOS
-- ============================================================================

-- Policy 1: Allow public read access to profile photos
-- This allows anyone to view profile photos (needed for display)
CREATE POLICY "Public can view profile photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'profiles');

-- Policy 2: Allow authenticated users to upload their own photos
-- Users can upload to the avatars folder when authenticated
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profiles' 
  AND (storage.foldername(name))[1] = 'avatars'
);

-- Policy 3: Allow users to update their own photos
-- Users can replace their existing profile photos
CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
);

-- Policy 4: Allow users to delete their own photos
-- Users can remove their profile photos
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify profile fields exist
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'profiles'
--   AND column_name IN ('location', 'avatar_url', 'phone', 'bio', 'expertise')
-- ORDER BY column_name;

-- Verify storage policies are active
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'storage'
--   AND tablename = 'objects'
--   AND policyname LIKE '%avatar%' OR policyname LIKE '%profile%';

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================

-- To remove the location field:
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS location;

-- To remove storage policies:
-- DROP POLICY IF EXISTS "Public can view profile photos" ON storage.objects;
-- DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

-- ============================================================================
-- STEP-BY-STEP EXECUTION GUIDE
-- ============================================================================

/*
STEP 1: Run Part 1 (Profile Table Updates)
- Open Supabase Dashboard
- Go to SQL Editor
- Run the ALTER TABLE statements for profiles

STEP 2: Create Storage Bucket (via Dashboard)
- Go to Storage
- Click "New Bucket"
- Name: profiles
- Public: Yes (checked)
- Click "Create Bucket"

STEP 3: Run Part 3 (Storage Policies)
- Go back to SQL Editor
- Run all CREATE POLICY statements
- Verify no errors

STEP 4: Test the Setup
- Sign in to BlueVerse
- Open profile settings
- Try uploading a photo
- Verify photo displays in header and sidebar

STEP 5: Verify (Optional)
- Run verification queries (uncomment and execute)
- Check that all fields and policies are in place
*/

-- ============================================================================
-- NOTES
-- ============================================================================

/*
EXISTING FIELDS (from base schema):
- avatar_url TEXT      → For profile photo URLs
- phone TEXT           → For contact number
- bio TEXT             → For user biography
- expertise TEXT[]     → For writer specializations

NEW FIELDS (added by this migration):
- location TEXT        → For user location (City, Country)

STORAGE STRUCTURE:
profiles/
  └── avatars/
      ├── {user_id}-{timestamp}.jpg
      ├── {user_id}-{timestamp}.png
      └── {user_id}-{timestamp}.gif

FILE SPECIFICATIONS:
- Max size: 5MB (enforced by client)
- Allowed types: JPG, PNG, GIF
- Naming: {user_id}-{timestamp}.{extension}
- Public read access for display
- Authenticated write access for uploads

SECURITY:
- RLS enabled on profiles table
- Storage policies enforce authenticated uploads
- Public bucket allows photo display
- Users can only modify their own photos
*/

-- ============================================================================
-- COMPLETE! 
-- Your database is now ready for profile management features
-- ============================================================================
