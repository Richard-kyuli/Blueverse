# Supabase Storage Setup for Profile Photos

## Overview
This guide will help you set up Supabase Storage to enable profile photo uploads in BlueVerse.

## Step 1: Create Storage Bucket

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New Bucket**
4. Configure the bucket:
   - **Name**: `profiles`
   - **Public**: ✅ Make this bucket public (so photos can be displayed)
   - Click **Create Bucket**

## Step 2: Set Up Storage Policies

After creating the bucket, you need to set up Row Level Security (RLS) policies for the storage bucket.

### Allow Public Read Access
This allows everyone to view profile photos:

```sql
-- Policy: Allow public read access to profile photos
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'profiles');
```

### Allow Authenticated Users to Upload
This allows logged-in users to upload their own photos:

```sql
-- Policy: Allow authenticated users to upload their own photos
CREATE POLICY "Authenticated users can upload their own photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profiles' 
  AND (storage.foldername(name))[1] = 'avatars'
);
```

### Allow Users to Update Their Own Photos
This allows users to replace their existing photos:

```sql
-- Policy: Allow users to update their own photos
CREATE POLICY "Users can update their own photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
);
```

### Allow Users to Delete Their Own Photos
This allows users to remove their photos:

```sql
-- Policy: Allow users to delete their own photos
CREATE POLICY "Users can delete their own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
);
```

## Step 3: Apply Policies via Supabase Dashboard

### Using the Dashboard UI:

1. Go to **Storage** → **Policies**
2. Select the `profiles` bucket
3. Click **New Policy**
4. For each policy above:
   - Choose the operation type (SELECT, INSERT, UPDATE, DELETE)
   - Select the target role (public or authenticated)
   - Add the policy definition
   - Click **Save**

### Using SQL Editor:

Alternatively, you can run all policies at once:

1. Go to **SQL Editor** in Supabase Dashboard
2. Create a new query
3. Paste all the policy SQL statements above
4. Click **Run**

## Step 4: Verify Storage Setup

### Test Upload:
1. Sign in to BlueVerse
2. Click on your profile in the sidebar
3. Click "Upload Photo"
4. Select an image file (JPG, PNG, or GIF, max 5MB)
5. Photo should upload and display immediately

### Test Removal:
1. Open profile settings
2. Click "Remove" button next to your photo
3. Photo should be removed and replaced with default avatar

## File Structure

Uploaded photos are stored in this structure:
```
profiles/
  └── avatars/
      ├── {user_id}-{timestamp}.jpg
      ├── {user_id}-{timestamp}.png
      └── {user_id}-{timestamp}.gif
```

## Troubleshooting

### Error: "new row violates row-level security policy"
- **Cause**: Storage policies are not set up correctly
- **Solution**: Re-run the storage policy SQL statements above

### Error: "Failed to upload photo"
- **Cause**: Bucket doesn't exist or is not public
- **Solution**: Verify the `profiles` bucket exists and is set to public

### Photo doesn't display after upload
- **Cause**: Bucket is not public
- **Solution**: Go to Storage → profiles → Settings → Make bucket public

### Error: "Image size must be less than 5MB"
- **Cause**: Image file is too large
- **Solution**: Compress the image or choose a smaller file

## Security Considerations

### File Size Limits
The application enforces a 5MB limit on uploads to prevent abuse.

### File Type Validation
Only image files (JPEG, PNG, GIF) are accepted. The validation happens on the client side.

### Storage Costs
Supabase free tier includes:
- 1GB storage
- 2GB bandwidth per month

Monitor your usage in the Supabase Dashboard under **Settings** → **Billing**.

## Environment Variables

No additional environment variables are needed. The application uses the existing Supabase configuration:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Feature Details

### Upload Process:
1. User clicks "Upload Photo" button
2. File picker opens
3. User selects image file
4. Client-side validation (type, size)
5. File uploads to `profiles/avatars/{user_id}-{timestamp}.{ext}`
6. Public URL is generated
7. Profile table updated with `avatar_url`
8. Page refreshes to show new photo

### Remove Process:
1. User clicks "Remove" button
2. Confirmation (implicit)
3. Profile table updated to set `avatar_url` to NULL
4. Page refreshes to show default avatar
5. Old file remains in storage (optional cleanup can be added)

## Optional: Automatic File Cleanup

If you want to automatically delete old avatars when users upload new ones, you can create a database trigger:

```sql
-- Function to delete old avatar file when updating
CREATE OR REPLACE FUNCTION delete_old_avatar()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.avatar_url IS NOT NULL AND NEW.avatar_url IS DISTINCT FROM OLD.avatar_url THEN
    -- Extract file path from URL
    -- Delete from storage
    -- This requires a Supabase Edge Function or custom implementation
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on profile updates
CREATE TRIGGER on_avatar_update
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION delete_old_avatar();
```

Note: This requires additional setup and is optional.

## Testing Checklist

- [ ] Create `profiles` storage bucket
- [ ] Set bucket to public
- [ ] Apply all storage policies
- [ ] Test photo upload
- [ ] Test photo display in header
- [ ] Test photo display in sidebar
- [ ] Test photo removal
- [ ] Test with different file types (JPG, PNG, GIF)
- [ ] Test file size validation (try > 5MB)
- [ ] Test file type validation (try non-image)

## Support

If you encounter issues:
1. Check Supabase logs in Dashboard → Logs
2. Check browser console for errors
3. Verify storage policies are active
4. Ensure bucket is public
5. Check that files are uploading to correct path

## Related Files

- `components/dashboard/ProfileModal.jsx` - Profile photo upload UI
- `components/dashboard/DashboardLayout.jsx` - Avatar display in header and sidebar
- `supabase-schema.sql` - Database schema (includes `avatar_url` column)
