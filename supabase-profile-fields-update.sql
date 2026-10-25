-- ============================================================================
-- PROFILE FIELDS UPDATE MIGRATION
-- Adds location field to profiles table
-- Run this migration to update your existing database
-- ============================================================================

-- Add location field to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.location IS 'User location (City, Country format)';

-- ============================================================================
-- VERIFICATION QUERY
-- Run this to verify the column was added successfully
-- ============================================================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'profiles'
--   AND column_name IN ('location', 'avatar_url', 'phone', 'bio', 'expertise');

-- ============================================================================
-- NOTES
-- ============================================================================
-- The following fields already exist in the profiles table from the original schema:
-- - avatar_url TEXT (for profile photos)
-- - phone TEXT (for contact number)
-- - bio TEXT (for user biography)
-- - expertise TEXT[] (for writer areas of expertise)
--
-- Only 'location' is being added as a new field.
-- ============================================================================

