# Troubleshooting: Image Upload Not Showing

## Quick Fixes (Try These First)

### 1. **Hard Refresh the Browser**
- **Windows/Linux**: Press `Ctrl + Shift + R`
- **Mac**: Press `Cmd + Shift + R`
- This clears the cache and reloads the page

### 2. **Check if Bucket is Public**
1. Go to Supabase Dashboard
2. Navigate to **Storage** → **profiles** bucket
3. Click on **Settings** or **Configuration**
4. Ensure **"Public bucket"** is checked ✅
5. If not, check it and save

### 3. **Verify Upload in Database**
Run this SQL query to check if the avatar_url was saved:

```sql
SELECT id, full_name, avatar_url
FROM public.profiles
WHERE email = 'your-email@example.com'; -- Replace with your email
```

**Expected Result:** Should show your avatar_url with a Supabase Storage URL

### 4. **Check Browser Console**
1. Press `F12` to open Developer Tools
2. Go to **Console** tab
3. Look for error messages when uploading
4. Share any errors you see

## Common Issues & Solutions

### Issue 1: Image Uploads But Doesn't Show
**Symptoms:**
- Upload success message appears
- No errors shown
- Image still shows default avatar

**Solutions:**
A. **Bucket Not Public**
   ```sql
   -- Verify bucket is public
   SELECT id, name, public 
   FROM storage.buckets 
   WHERE id = 'profiles';
   ```
   Should return `public = true`

B. **Hard Refresh Browser**
   - Clear cache completely
   - Try incognito/private window

C. **Check avatar_url in Database**
   ```sql
   SELECT avatar_url FROM profiles WHERE id = 'your-user-id';
   ```
   If NULL, the database update failed

### Issue 2: Broken Image Icon Shows
**Symptoms:**
- Grey broken image icon appears
- Image placeholder with "?" or broken icon

**Solutions:**
A. **Check Public Access**
   - Copy the avatar_url from database
   - Paste in browser address bar
   - Should display the image
   - If 403/401 error, bucket not public

B. **Verify Storage Policies**
   ```sql
   SELECT policyname, cmd
   FROM pg_policies
   WHERE schemaname = 'storage'
     AND tablename = 'objects'
     AND bucket_id = 'profiles';
   ```
   Should show 4 policies (SELECT, INSERT, UPDATE, DELETE)

### Issue 3: Page Doesn't Reload After Upload
**Symptoms:**
- Upload succeeds
- Success message shows
- Page doesn't refresh
- Old avatar still showing

**Solution:**
- Manually refresh the page
- Check browser console for errors
- The code now has 1.5 second delay before reload

### Issue 4: Upload Succeeds But avatar_url is NULL
**Symptoms:**
- File uploads to storage successfully
- Database avatar_url remains NULL
- No error messages

**Solution:**
Check RLS policies on profiles table:
```sql
-- Verify users can update their own profile
SELECT * FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
  AND cmd = 'UPDATE';
```

Should have policy allowing users to update their own profile

## Step-by-Step Debugging

### Step 1: Open Browser Console
1. Press `F12`
2. Go to **Console** tab
3. Try uploading image
4. Watch for console logs:
   - "Uploading file: avatars/..."
   - "Upload successful: ..."
   - "Public URL: https://..."
   - "Profile updated successfully"
   - "Reloading page..."

### Step 2: Check Each Log Message

**If you see "Upload successful":**
✅ File uploaded to storage

**If you see "Public URL: https://...":**
✅ URL generated correctly
- Copy this URL
- Paste in browser
- Should show your image

**If you see "Profile updated successfully":**
✅ Database updated

**If you see "Reloading page...":**
✅ Page should refresh in 1.5 seconds

### Step 3: If Page Doesn't Refresh
Manually refresh and check:
1. Header (top right) - Should show your photo
2. Sidebar (bottom) - Should show your photo  
3. Profile modal - Should show your photo

## Manual Verification Steps

### 1. Check File in Storage
1. Go to Supabase Dashboard
2. Navigate to **Storage** → **profiles**
3. Open **avatars** folder
4. Should see your uploaded file: `{user-id}-{timestamp}.{ext}`

### 2. Check Database Record
```sql
SELECT 
    id,
    full_name,
    avatar_url,
    updated_at
FROM public.profiles
WHERE id = 'your-user-id'
ORDER BY updated_at DESC;
```

### 3. Test Public URL
- Copy avatar_url from database
- Open in new browser tab
- Should display image
- If error 403/401: Bucket not public

## Advanced Debugging

### Enable Detailed Logging
The ProfileModal now has console.log statements. Check console for:
1. File path being uploaded
2. Upload response
3. Public URL generated
4. Database update result

### Check Network Tab
1. Press `F12` → **Network** tab
2. Try upload
3. Look for requests to:
   - Supabase Storage API (upload)
   - Supabase REST API (database update)
4. Check response codes (should be 200/201)

### Verify Supabase Connection
```javascript
// Run in browser console
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Has Anon Key:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
```

## Still Not Working?

### Checklist:
- [ ] profiles bucket exists
- [ ] Bucket is set to public
- [ ] File uploads successfully (check Storage)
- [ ] avatar_url saved to database (check SQL)
- [ ] Public URL is accessible (test in browser)
- [ ] Storage policies applied (4 policies)
- [ ] Page refreshes after upload
- [ ] Browser console shows no errors

### Get Help:
1. **Check browser console** - Copy any errors
2. **Check Supabase logs** - Dashboard → Logs
3. **Run debug query** - `debug-avatar-upload.sql`
4. **Verify setup** - `check-profile-setup-status.sql`

## Quick Test Script

Run this in browser console after upload:

```javascript
// Check current profile
supabase
  .from('profiles')
  .select('avatar_url')
  .single()
  .then(({ data, error }) => {
    if (error) console.error('Error:', error);
    else console.log('Avatar URL:', data.avatar_url);
  });
```

## SQL Fixes

### If bucket exists but not public:
```sql
UPDATE storage.buckets 
SET public = true 
WHERE id = 'profiles';
```

### If avatar_url not updating:
```sql
-- Check RLS policies
SELECT * FROM pg_policies 
WHERE tablename = 'profiles' 
  AND cmd = 'UPDATE';
```

Should allow users to update their own records.
