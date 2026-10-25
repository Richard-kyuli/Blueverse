-- ============================================================================
-- PROFILE SETUP STATUS CHECK
-- Run this to see what's already configured
-- ============================================================================

-- ============================================================================
-- CHECK 1: Profile Table Fields
-- ============================================================================
SELECT 
    'Profile Fields' as check_type,
    column_name,
    data_type,
    CASE 
        WHEN column_name IN ('location', 'avatar_url', 'phone', 'bio', 'expertise') 
        THEN '✓ Found'
        ELSE '? Unknown'
    END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('location', 'avatar_url', 'phone', 'bio', 'expertise')
ORDER BY column_name;

-- Expected Result: 5 rows
-- location, avatar_url, phone, bio, expertise

-- ============================================================================
-- CHECK 2: Storage Bucket
-- ============================================================================
SELECT 
    'Storage Bucket' as check_type,
    id as bucket_name,
    public as is_public,
    CASE 
        WHEN public = true THEN '✓ Public (Correct)'
        ELSE '✗ Not Public (Fix Required)'
    END as status
FROM storage.buckets
WHERE id = 'profiles';

-- Expected Result: 1 row showing 'profiles' bucket as public

-- ============================================================================
-- CHECK 3: Storage Policies
-- ============================================================================
SELECT 
    'Storage Policy' as check_type,
    policyname as policy_name,
    cmd as operation,
    '✓ Exists' as status
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND bucket_id = 'profiles'
ORDER BY cmd;

-- Expected Result: 4 rows (SELECT, INSERT, UPDATE, DELETE policies)

-- ============================================================================
-- CHECK 4: Quick Summary
-- ============================================================================
SELECT 
    'SUMMARY' as section,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = 'profiles' 
     AND column_name IN ('location', 'avatar_url', 'phone', 'bio', 'expertise')) as profile_fields_count,
    (SELECT COUNT(*) FROM storage.buckets WHERE id = 'profiles') as storage_bucket_exists,
    (SELECT COUNT(*) FROM pg_policies 
     WHERE schemaname = 'storage' AND tablename = 'objects' 
     AND policyname LIKE '%avatar%') as storage_policies_count;

-- Expected Result:
-- profile_fields_count: 5
-- storage_bucket_exists: 1
-- storage_policies_count: 4

-- ============================================================================
-- INTERPRETATION GUIDE
-- ============================================================================

/*
PROFILE FIELDS (Should be 5):
- location ✓
- avatar_url ✓
- phone ✓
- bio ✓
- expertise ✓

STORAGE BUCKET (Should be 1):
- profiles (public) ✓

STORAGE POLICIES (Should be 4):
- Public can view profile photos (SELECT) ✓
- Authenticated users can upload avatars (INSERT) ✓
- Users can update their own avatars (UPDATE) ✓
- Users can delete their own avatars (DELETE) ✓

IF SOMETHING IS MISSING:
1. Missing profile fields → Run: ALTER TABLE public.profiles ADD COLUMN location TEXT;
2. Missing bucket → Create via Dashboard: Storage → New Bucket → "profiles" (public)
3. Missing policies → Run: supabase-safe-migration.sql
*/
