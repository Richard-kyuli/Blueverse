# Supabase Storage Setup for Assignment Submissions

## Overview
This guide walks through setting up Supabase Storage for the assignment submission workflow, enabling writers to upload files and students to review them securely.

---

## Prerequisites
- Supabase project created and configured
- Database schema deployed (`supabase-submissions-complete.sql`)
- Access to Supabase Dashboard
- SQL Editor access in Supabase

---

## Step 1: Create Storage Bucket

### Via Supabase Dashboard (Recommended)

1. **Navigate to Storage**
   - Open your Supabase Dashboard
   - Click **Storage** in the left sidebar

2. **Create New Bucket**
   - Click **"New Bucket"** button
   - Configure the bucket with these settings:

   **Bucket Configuration:**
   - **Name**: `submissions`
   - **Public**: ❌ **UNCHECKED** (Keep this bucket private)
   - **File size limit**: 50MB (if available in UI)
   - **Allowed MIME types**: Leave default or configure later

3. **Verify Bucket Created**
   - You should see `submissions` in your bucket list
   - Bucket should show as "Private" with a lock icon

---

## Step 2: Apply Storage Policies

Storage policies control who can upload, view, update, and delete files in the bucket.

### Apply via SQL Editor

1. **Open SQL Editor**
   - Go to **SQL Editor** in Supabase Dashboard
   - Click **"New Query"**

2. **Run the SQL Script**
   - Open the file `supabase-submissions-storage.sql` in your project
   - Copy all policy creation statements (STEP 2 section)
   - Paste into SQL Editor
   - Click **"Run"** or press `Ctrl+Enter`

3. **Verify Success**
   - You should see "Success" messages for each policy created
   - 4 policies should be created in total

---

## Step 3: Verify Policies

### Check Policies via SQL

Run this query in SQL Editor to verify policies exist:

```sql
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND (policyname LIKE '%submission%' OR policyname LIKE '%assigned assignment%');
```

**Expected Results:** 4 policies
1. `Writers can upload to their assigned assignments` (INSERT)
2. `Assignment parties can view submission files` (SELECT)
3. `Writers can update their submission files` (UPDATE)
4. `Writers can delete their submission files` (DELETE)

### View Policies via Dashboard

1. Go to **Storage** → **Policies** in Supabase Dashboard
2. Select the `submissions` bucket from dropdown
3. You should see the 4 policies listed
4. Each policy should show:
   - ✅ Enabled
   - Target role: `authenticated`
   - Operation type (SELECT, INSERT, UPDATE, DELETE)

---

## Step 4: Test the Setup

### Prerequisites for Testing
- At least 2 test users (1 student, 1 writer)
- 1 test assignment with writer assigned
- Sample files to upload (PDF, DOCX, TXT, ZIP)

### Test Case 1: Writer Upload (Should Succeed) ✅

**Setup:**
- Sign in as writer
- Writer is assigned to assignment A

**Test:**
- Navigate to assignment A
- Click "Submit Work"
- Upload a PDF file
- **Expected:** Upload succeeds, file stored in `submissions/{assignment_id}/{submission_id}/`

### Test Case 2: Writer Upload to Unassigned Assignment (Should Fail) ❌

**Setup:**
- Sign in as writer
- Writer is NOT assigned to assignment B

**Test:**
- Try to upload file to assignment B via API call
- **Expected:** Upload fails with RLS policy error

### Test Case 3: Student View Files (Should Succeed) ✅

**Setup:**
- Sign in as student (assignment owner)
- Writer has uploaded files to student's assignment

**Test:**
- Navigate to assignment submissions page
- Click download link for uploaded file
- **Expected:** File downloads successfully

### Test Case 4: Unauthorized View (Should Fail) ❌

**Setup:**
- Sign in as different user (not student or writer)
- Try to access submission files

**Test:**
- Attempt to download file via direct URL
- **Expected:** Access denied / 403 Forbidden

### Test Case 5: Writer Delete Before Submission (Should Succeed) ✅

**Setup:**
- Sign in as writer
- Assignment status is `in_progress`
- Writer has uploaded draft files

**Test:**
- Delete one of the uploaded files
- **Expected:** File deleted successfully

### Test Case 6: Writer Delete After Submission (Should Fail) ❌

**Setup:**
- Sign in as writer
- Assignment status is `under_review` or `completed`
- Files have been submitted for review

**Test:**
- Try to delete a submitted file
- **Expected:** Delete fails (status check in policy prevents it)

---

## Storage Structure

Files are organized hierarchically:

```
submissions/
├── {assignment_id_1}/
│   ├── {submission_id_1}/
│   │   ├── essay.pdf
│   │   ├── sources.docx
│   │   └── references.txt
│   ├── {submission_id_2}/  (revision)
│   │   ├── essay_revised.pdf
│   │   └── additional_notes.txt
│
├── {assignment_id_2}/
│   └── {submission_id_3}/
│       └── project_report.pdf
```

### Path Examples

**Storage Path:**
```
submissions/123e4567-e89b-12d3-a456-426614174000/456e7890-e89b-12d3-a456-426614174001/essay.pdf
```

**Authenticated URL:**
```
https://{project-ref}.supabase.co/storage/v1/object/authenticated/submissions/{assignment_id}/{submission_id}/essay.pdf
```

---

## Security Features

### Access Control
- ✅ **Writer Upload Restriction**: Writers can only upload to their assigned assignments
- ✅ **Status Validation**: Upload/update/delete checks assignment status
- ✅ **Party Access**: Only student and writer involved can view files
- ✅ **Authentication Required**: All operations require valid Supabase auth token

### File Type Validation
Implement on client side and server side:
- **Allowed types**: PDF, DOC, DOCX, TXT, ZIP
- **File size limit**: 50MB per file
- **Max files**: 10 per submission

### Privacy
- ❌ **Bucket is Private**: Files NOT publicly accessible
- ✅ **Authenticated URLs**: Require valid auth token
- ✅ **Assignment-Based Access**: RLS policies enforce ownership

---

## Troubleshooting

### Error: "new row violates row-level security policy"

**Cause:** Storage policies not set up correctly or user not authorized

**Solutions:**
1. Verify policies exist using verification query
2. Check that bucket is named exactly `submissions`
3. Ensure user is authenticated
4. Verify writer is assigned to the assignment
5. Check assignment status is valid for the operation

### Error: "Bucket not found"

**Cause:** Submissions bucket doesn't exist

**Solution:**
1. Go to Storage in Supabase Dashboard
2. Create bucket named `submissions` (exact match, lowercase)
3. Ensure bucket is set to PRIVATE

### Upload Fails with No Error

**Cause:** Client-side issue or network problem

**Solutions:**
1. Check browser console for JavaScript errors
2. Verify file size is under 50MB
3. Check file type is allowed
4. Test with small text file first
5. Verify Supabase client is initialized correctly

### Files Upload but Cannot Download

**Cause:** Missing SELECT policy or authentication issue

**Solutions:**
1. Verify SELECT policy exists and is enabled
2. Check that user is authenticated
3. Verify user is either student or assigned writer
4. Test with SQL query to check assignment relationship

### Policy Changes Don't Take Effect

**Cause:** Policy cache or syntax error

**Solutions:**
1. Drop existing policy and recreate
2. Check for SQL syntax errors
3. Refresh Supabase Dashboard
4. Test with new browser session (clear auth cache)

---

## Environment Variables

No additional environment variables needed. Uses existing Supabase config:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Storage Costs

### Supabase Free Tier Limits:
- **Storage**: 1GB
- **Bandwidth**: 2GB per month
- **API Requests**: Unlimited

### Cost Estimates (Paid Tier):
- **Storage**: $0.021 per GB/month
- **Bandwidth**: $0.09 per GB

### Monitoring Usage:
1. Go to Supabase Dashboard → **Settings** → **Usage**
2. View storage and bandwidth consumption
3. Set up alerts for approaching limits

---

## Maintenance Tasks

### Regular Maintenance
- **Monitor storage usage** monthly
- **Review access logs** for suspicious activity
- **Test policies** after any schema changes

### Optional Cleanup
Implement automatic cleanup of old submission files:
- Delete files when assignment is completed + 30 days
- Delete files when user account is deleted
- Archive old submissions to cheaper storage

---

## Integration with Application

### Client-Side Upload (Next.js)

```javascript
import { supabase } from '@/lib/supabase';

async function uploadSubmissionFile(assignmentId, submissionId, file) {
  const filePath = `${assignmentId}/${submissionId}/${file.name}`;
  
  const { data, error } = await supabase.storage
    .from('submissions')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false, // Prevent accidental overwrites
    });

  if (error) {
    console.error('Upload failed:', error);
    throw error;
  }

  return data.path;
}
```

### Client-Side Download

```javascript
async function getSubmissionFileUrl(filePath) {
  const { data, error } = await supabase.storage
    .from('submissions')
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  if (error) {
    console.error('Failed to get URL:', error);
    throw error;
  }

  return data.signedUrl;
}
```

### Client-Side Delete

```javascript
async function deleteSubmissionFile(filePath) {
  const { error } = await supabase.storage
    .from('submissions')
    .remove([filePath]);

  if (error) {
    console.error('Delete failed:', error);
    throw error;
  }
}
```

---

## Testing Checklist

Complete this checklist after setup:

### Setup Verification
- [ ] `submissions` bucket created
- [ ] Bucket is set to PRIVATE (not public)
- [ ] 4 storage policies created successfully
- [ ] Policies verified via SQL query
- [ ] Policies visible in Dashboard

### Functional Testing
- [ ] Writer can upload file to assigned assignment
- [ ] Writer cannot upload to unassigned assignment
- [ ] Student can download files from their assignment
- [ ] Writer can download their own uploaded files
- [ ] Unauthorized user cannot access files
- [ ] Writer can delete file before submission
- [ ] Writer cannot delete after submission (status check)

### Integration Testing
- [ ] Upload progress tracking works
- [ ] File list displays uploaded files
- [ ] Download links work correctly
- [ ] File metadata stored in database
- [ ] Submission workflow completes end-to-end

### Edge Cases
- [ ] Multiple files upload successfully
- [ ] Large file (near 50MB limit) uploads
- [ ] File with special characters in name works
- [ ] Upload failure handles gracefully
- [ ] Network interruption recovery tested

---

## Related Documentation

- **SQL Script**: `supabase-submissions-storage.sql`
- **Database Schema**: `supabase-submissions-complete.sql`
- **Design Document**: `.kiro/specs/assignment-submission-workflow/design.md`
- **Requirements**: `.kiro/specs/assignment-submission-workflow/requirements.md`
- **Profile Storage Setup**: `SUPABASE-STORAGE-SETUP.md` (reference example)

---

## Support

If you encounter issues:

1. **Check Supabase Logs**
   - Dashboard → Logs → Filter by "storage"

2. **Verify RLS Policies**
   - Run verification query
   - Check policy syntax

3. **Test Authentication**
   - Ensure user is logged in
   - Check auth token is valid

4. **Review Assignment Data**
   - Verify assignment exists
   - Check assigned_writer_id matches
   - Confirm status is appropriate

5. **Contact Support**
   - Supabase Discord community
   - Supabase GitHub issues
   - Project documentation

---

## Success Criteria

✅ Setup is complete when:
- Bucket created and private
- All 4 policies active
- Writer can upload to assigned assignment
- Student can view submission files
- Unauthorized access blocked
- Status checks prevent inappropriate actions
- File structure follows specification

🎉 **Ready for Development**: Once all tests pass, the storage system is ready for integration with the submission UI components.

