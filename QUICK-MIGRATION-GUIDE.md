# Quick Migration Guide - Profile Features

## Overview
This guide will help you quickly set up all profile management features in BlueVerse.

## What You Need to Update

### Database Changes:
- ✅ Add `location` field to profiles table
- ✅ Create storage bucket for profile photos
- ✅ Set up storage policies for secure uploads

## What to Do When Policies Already Exist

✅ **Good news!** The error means your storage policies are already set up. 

### Quick Check - Run This:

```sql
-- Check what's already configured
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('location', 'avatar_url', 'phone', 'bio', 'expertise');
```

**Expected:** Should return 5 rows

### If You See the "Policy Already Exists" Error:

**Option 1: Skip It (Recommended)**
The policies are already there, you're good to go! Just test the feature.

**Option 2: Use Safe Migration**
Run `supabase-safe-migration.sql` which drops and recreates policies safely.

**Option 3: Manual Check**
Run `check-profile-setup-status.sql` to see exactly what's configured.

## Quick Setup (5 Minutes)

### Step 1: Update Profiles Table
Run this in Supabase SQL Editor:

```sql
-- Add location field
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;
```

### Step 2: Create Storage Bucket
1. Go to Supabase Dashboard → **Storage**
2. Click **"New Bucket"**
3. Enter name: `profiles`
4. Check **"Public bucket"** ✅
5. Click **"Create Bucket"**

### Step 3: Apply Storage Policies
Run this in Supabase SQL Editor:

```sql
-- Allow public read access
CREATE POLICY "Public can view profile photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'profiles');

-- Allow authenticated uploads
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profiles' 
  AND (storage.foldername(name))[1] = 'avatars'
);

-- Allow users to update their photos
CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
);

-- Allow users to delete their photos
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
);
```

### Step 4: Test It!
1. Sign in to BlueVerse
2. Click your profile in the sidebar
3. Click "Upload Photo"
4. Select an image
5. Verify it displays in header and sidebar

## Complete SQL Files Available

### ✅ Recommended: Safe Migration (Handles Existing Policies)
- `supabase-safe-migration.sql` - Drops and recreates policies, no errors

### Option 1: Check Status First
- `check-profile-setup-status.sql` - See what's already configured

### Option 2: Individual Updates
- `supabase-profile-fields-update.sql` - Just the location field

### Option 2: All-in-One Migration
- `supabase-complete-profile-migration.sql` - Everything in one file with documentation

### Option 3: Detailed Setup Guide
- `SUPABASE-STORAGE-SETUP.md` - Step-by-step with troubleshooting

## Verification

### Check Profile Fields:
```sql
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('location', 'avatar_url', 'phone', 'bio', 'expertise');
```

Should return 5 rows showing all profile fields.

### Check Storage Policies:
```sql
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%avatar%';
```

Should return 4 policies (SELECT, INSERT, UPDATE, DELETE).

## Fields Summary

### Already in Schema (from base):
- ✅ `avatar_url` - Profile photo URL
- ✅ `phone` - Phone number
- ✅ `bio` - User biography
- ✅ `expertise` - Writer specializations (array)

### Added by Migration:
- 🆕 `location` - User location (City, Country)

## Storage Structure

```
profiles/
  └── avatars/
      ├── user-id-123-1234567890.jpg
      ├── user-id-456-1234567891.png
      └── user-id-789-1234567892.gif
```

## Common Issues

### "Policy already exists" Error
- **Solution**: Policies already created, skip and continue

### "Bucket does not exist" Error
- **Solution**: Create the `profiles` bucket via Dashboard UI first

### Photos don't upload
- **Solution**: Ensure bucket is marked as "Public"

### Photos don't display
- **Solution**: Check storage policies are applied

## Quick Test Checklist

After running migration:

- [ ] Location field added to profiles table
- [ ] Storage bucket "profiles" exists
- [ ] Bucket is set to public
- [ ] 4 storage policies created
- [ ] Can upload photo via profile settings
- [ ] Photo displays in header
- [ ] Photo displays in sidebar
- [ ] Can remove photo

## Need Help?

See detailed documentation:
- `SUPABASE-STORAGE-SETUP.md` - Complete storage setup guide
- `PROFILE-PHOTO-FEATURE.md` - Feature documentation
- `supabase-complete-profile-migration.sql` - Full SQL with comments

## Summary

**Minimum SQL to run:**
```sql
-- 1. Add location field
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;

-- 2. Then create bucket via UI

-- 3. Then apply all 4 storage policies (see Step 3 above)
```

That's it! You're ready to use profile management features! 🚀
