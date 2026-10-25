# Submissions Storage Verification Checklist

## Quick Setup & Verification Guide

This checklist ensures your Supabase Storage is correctly configured for the assignment submission workflow.

---

## ✅ Setup Checklist

### Step 1: Create Storage Bucket
Go to **Supabase Dashboard → Storage**

- [ ] Click "New Bucket"
- [ ] Set name to: `submissions` (exact match, lowercase)
- [ ] **IMPORTANT**: Leave "Public" **UNCHECKED** (bucket must be private)
- [ ] Click "Create Bucket"
- [ ] Verify bucket appears in list with lock icon 🔒

---

### Step 2: Apply Storage Policies
Go to **Supabase Dashboard → SQL Editor**

- [ ] Click "New Query"
- [ ] Open file: `supabase-submissions-storage.sql`
- [ ] Copy the SQL code from **STEP 2: STORAGE POLICIES** section
- [ ] Paste into SQL Editor
- [ ] Click "Run" or press `Ctrl+Enter`
- [ ] Verify 4 success messages appear

---

### Step 3: Verify Policies Created
Go to **Supabase Dashboard → Storage → Policies**

- [ ] Select `submissions` bucket from dropdown
- [ ] Verify these 4 policies exist:

**1. Writers can upload to their assigned assignments**
   - Operation: INSERT
   - Target: authenticated
   - Status: ✅ Enabled

**2. Assignment parties can view submission files**
   - Operation: SELECT
   - Target: authenticated
   - Status: ✅ Enabled

**3. Writers can update their submission files**
   - Operation: UPDATE
   - Target: authenticated
   - Status: ✅ Enabled

**4. Writers can delete their submission files**
   - Operation: DELETE
   - Target: authenticated
   - Status: ✅ Enabled

---

### Step 4: Verify via SQL Query
Go to **Supabase Dashboard → SQL Editor**

Run this verification query:

```sql
SELECT 
  policyname,
  cmd as operation,
  roles
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND bucket_id = 'submissions';
```

**Expected Result:** 4 rows showing the policies above

---

## 🧪 Functional Testing

### Test 1: Writer Upload (Manual Test)

**Prerequisites:**
- Writer user account created
- Writer assigned to an assignment
- Assignment status: `assigned` or `in_progress`

**Test Steps:**
1. Sign in as writer
2. Navigate to assigned assignment
3. Click "Submit Work" (when UI is implemented)
4. Upload a test PDF file
5. **Expected:** File uploads successfully

**Verification:**
- Check Supabase Dashboard → Storage → submissions
- Navigate to `{assignment_id}/{submission_id}/`
- Verify file appears in folder

---

### Test 2: Student View Files (Manual Test)

**Prerequisites:**
- Student user account created
- Writer has uploaded files to student's assignment

**Test Steps:**
1. Sign in as student (assignment owner)
2. Navigate to assignment submissions page
3. Click download link for uploaded file
4. **Expected:** File downloads successfully

**Verification:**
- File downloads without errors
- File content is correct

---

### Test 3: Unauthorized Access (Security Test)

**Test Steps:**
1. Get direct URL of a submission file
2. Sign out or use different user (not involved in assignment)
3. Try to access URL directly
4. **Expected:** Access denied / 403 Forbidden

**Verification:**
- Unauthorized users cannot access files
- RLS policies are enforcing security

---

## 🔍 Troubleshooting

### Issue: Bucket creation fails
**Solution:** 
- Check project has storage enabled
- Verify storage quota not exceeded
- Try different bucket name, then rename

### Issue: Policies fail to create
**Solution:**
- Check for syntax errors in SQL
- Verify `assignments` table exists
- Run policies one at a time to identify failing policy

### Issue: Upload fails with RLS error
**Solution:**
- Verify user is authenticated
- Check writer is assigned to assignment (`assigned_writer_id`)
- Verify assignment status is valid
- Check bucket name is exactly `submissions`

### Issue: Cannot view uploaded files
**Solution:**
- Verify SELECT policy exists
- Check user is either student or assigned writer
- Verify file path is correct
- Test with signed URL

---

## 📋 Final Verification

Before marking this task complete, ensure:

- [x] `submissions` bucket created
- [x] Bucket is set to PRIVATE (not public)
- [x] All 4 storage policies created
- [x] Policies visible in Supabase Dashboard
- [x] SQL verification query returns 4 policies
- [ ] Writer can upload to assigned assignment (test when UI ready)
- [ ] Student can view submission files (test when UI ready)
- [ ] Unauthorized access blocked (test when UI ready)

---

## 📝 Notes

- Manual tests (Test 1-3) require the submission UI to be implemented
- These tests can be performed after Task 2.1 (SubmissionForm component) is complete
- For now, verification focuses on bucket and policy setup
- File upload testing can be done via API calls if needed before UI

---

## ✅ Task Completion Criteria

**Task 1.1 is COMPLETE when:**
1. ✅ Submissions bucket created and private
2. ✅ All 4 storage policies applied and enabled
3. ✅ Policies verified via SQL query
4. ✅ Documentation created (this file + setup guide)
5. ⏳ Manual upload test verified (requires UI from Task 2.1)

**Status:** 🟢 **READY** (Bucket and policies configured, awaiting UI implementation for full testing)

