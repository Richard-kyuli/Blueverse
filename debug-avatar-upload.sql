-- ============================================================================
-- DEBUG: Check Avatar Upload Status
-- Run this to see if the avatar_url was saved to the database
-- ============================================================================

-- Check your profile's avatar_url
SELECT 
    id,
    full_name,
    email,
    avatar_url,
    CASE 
        WHEN avatar_url IS NULL THEN '✗ No avatar URL'
        WHEN avatar_url = '' THEN '✗ Empty avatar URL'
        ELSE '✓ Avatar URL exists'
    END as status
FROM public.profiles
WHERE email = 'YOUR_EMAIL@example.com'; -- Replace with your email

-- Check all uploaded files in storage
SELECT 
    name as file_path,
    bucket_id,
    created_at,
    metadata
FROM storage.objects
WHERE bucket_id = 'profiles'
ORDER BY created_at DESC
LIMIT 10;

-- Test if the public URL is accessible
-- Copy the avatar_url from the first query and paste it in your browser
-- You should see your image

-- ============================================================================
-- COMMON ISSUES & SOLUTIONS
-- ============================================================================

/*
ISSUE 1: avatar_url is NULL
- Solution: Upload didn't complete or database update failed
- Fix: Try uploading again

ISSUE 2: avatar_url exists but image doesn't show
- Solution: Bucket might not be public
- Fix: Go to Storage → profiles bucket → Settings → Make public

ISSUE 3: File uploaded but avatar_url is old URL
- Solution: Page didn't refresh
- Fix: Hard refresh browser (Ctrl+Shift+R)

ISSUE 4: Image shows broken icon
- Solution: URL is not accessible
- Fix: Check bucket is public and policies are set

ISSUE 5: Upload succeeds but avatar_url is empty string
- Solution: getPublicUrl returned empty
- Fix: Verify bucket exists and is public
*/
