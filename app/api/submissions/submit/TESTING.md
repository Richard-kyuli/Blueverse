# Submission API Endpoint Testing Guide

## Endpoint: POST /api/submissions/submit

This document provides manual testing instructions for the submission API endpoint.

## Prerequisites

1. Supabase instance configured with:
   - `assignments` table
   - `submissions` table
   - `submissions` storage bucket with appropriate policies
2. At least one assignment in the database with status `assigned` or `in_progress`
3. A writer user who is assigned to the test assignment

## Test Environment Setup

### Required Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key (optional, falls back to anon key)
```

### Test Data Requirements

**Assignment:**
- ID: test-assignment-id
- Status: `assigned` or `in_progress`
- assigned_writer_id: test-writer-id
- student_id: test-student-id

**Writer:**
- ID: test-writer-id
- Must be the assigned writer for the test assignment

## Manual Test Cases

### Test Case 1: Successful Submission

**Request:**
```bash
curl -X POST http://localhost:3000/api/submissions/submit \
  -F "assignmentId=test-assignment-id" \
  -F "writerId=test-writer-id" \
  -F "submissionText=This is my completed work" \
  -F "file_0=@test-essay.pdf" \
  -F "file_1=@sources.zip"
```

**Expected Response (201):**
```json
{
  "success": true,
  "submissionId": "uuid-here",
  "fileUrls": [
    "https://.../submissions/test-assignment-id/submission-id/timestamp-test-essay.pdf",
    "https://.../submissions/test-assignment-id/submission-id/timestamp-sources.zip"
  ],
  "revisionNumber": 1,
  "message": "Work submitted successfully! The student will be notified to review your submission."
}
```

**Verification Steps:**
1. Check `submissions` table - new record should exist
2. Check `assignments` table - status should be `under_review`
3. Check Supabase Storage - files should be in `submissions/{assignmentId}/{submissionId}/` folder
4. Verify file URLs are accessible

---

### Test Case 2: Missing Assignment ID

**Request:**
```bash
curl -X POST http://localhost:3000/api/submissions/submit \
  -F "writerId=test-writer-id" \
  -F "file_0=@test.pdf"
```

**Expected Response (400):**
```json
{
  "success": false,
  "error": "Missing required fields: assignmentId and writerId are required"
}
```

---

### Test Case 3: Missing Files

**Request:**
```bash
curl -X POST http://localhost:3000/api/submissions/submit \
  -F "assignmentId=test-assignment-id" \
  -F "writerId=test-writer-id" \
  -F "submissionText=Work without files"
```

**Expected Response (400):**
```json
{
  "success": false,
  "error": "At least one file is required for submission"
}
```

---

### Test Case 4: Assignment Not Found

**Request:**
```bash
curl -X POST http://localhost:3000/api/submissions/submit \
  -F "assignmentId=nonexistent-id" \
  -F "writerId=test-writer-id" \
  -F "file_0=@test.pdf"
```

**Expected Response (404):**
```json
{
  "success": false,
  "error": "Assignment not found"
}
```

---

### Test Case 5: Unauthorized Writer

**Request:**
```bash
curl -X POST http://localhost:3000/api/submissions/submit \
  -F "assignmentId=test-assignment-id" \
  -F "writerId=different-writer-id" \
  -F "file_0=@test.pdf"
```

**Expected Response (403):**
```json
{
  "success": false,
  "error": "You are not authorized to submit work for this assignment"
}
```

---

### Test Case 6: Invalid Assignment Status

**Setup:** Create assignment with status `completed` or `cancelled`

**Request:**
```bash
curl -X POST http://localhost:3000/api/submissions/submit \
  -F "assignmentId=completed-assignment-id" \
  -F "writerId=test-writer-id" \
  -F "file_0=@test.pdf"
```

**Expected Response (400):**
```json
{
  "success": false,
  "error": "Cannot submit work for assignment with status: completed. Assignment must be 'assigned' or 'in_progress'."
}
```

---

### Test Case 7: Concurrent Submission Prevention

**Setup:** Create a submission with status `submitted` for the assignment

**Request:**
```bash
curl -X POST http://localhost:3000/api/submissions/submit \
  -F "assignmentId=test-assignment-id" \
  -F "writerId=test-writer-id" \
  -F "file_0=@test.pdf"
```

**Expected Response (400):**
```json
{
  "success": false,
  "error": "Cannot submit while a previous submission is under review"
}
```

---

### Test Case 8: Multiple Files Upload

**Request:**
```bash
curl -X POST http://localhost:3000/api/submissions/submit \
  -F "assignmentId=test-assignment-id" \
  -F "writerId=test-writer-id" \
  -F "submissionText=Multiple files test" \
  -F "file_0=@file1.pdf" \
  -F "file_1=@file2.docx" \
  -F "file_2=@file3.txt" \
  -F "file_3=@file4.zip"
```

**Expected Response (201):**
```json
{
  "success": true,
  "submissionId": "uuid-here",
  "fileUrls": [
    "url-to-file1.pdf",
    "url-to-file2.docx",
    "url-to-file3.txt",
    "url-to-file4.zip"
  ],
  "revisionNumber": 1,
  "message": "Work submitted successfully! The student will be notified to review your submission."
}
```

---

### Test Case 9: Revision Submission (Second Submission)

**Setup:** Complete Test Case 1 first, then have student request revision

**Request:**
```bash
curl -X POST http://localhost:3000/api/submissions/submit \
  -F "assignmentId=test-assignment-id" \
  -F "writerId=test-writer-id" \
  -F "submissionText=Revised version based on feedback" \
  -F "file_0=@revised-essay.pdf"
```

**Expected Response (201):**
```json
{
  "success": true,
  "submissionId": "new-uuid-here",
  "fileUrls": ["url-to-revised-essay.pdf"],
  "revisionNumber": 2,
  "message": "Work submitted successfully! The student will be notified to review your submission."
}
```

**Verification:**
- New submission should have `revision_number: 2`
- New submission should have `parent_submission_id` pointing to first submission

---

### Test Case 10: GET Request (Method Not Allowed)

**Request:**
```bash
curl -X GET http://localhost:3000/api/submissions/submit
```

**Expected Response (405):**
```json
{
  "error": "Method not allowed. Use POST to submit work."
}
```

---

## Using Postman/Thunder Client

### Setup

1. Create new POST request
2. URL: `http://localhost:3000/api/submissions/submit`
3. Body type: `form-data`
4. Add fields:
   - `assignmentId` (text): your-assignment-id
   - `writerId` (text): your-writer-id
   - `submissionText` (text): Your submission notes
   - `file_0` (file): Select file from disk
   - `file_1` (file): Optional additional file

### Example Screenshot

```
POST http://localhost:3000/api/submissions/submit

Body (form-data):
┌─────────────────┬──────────────────────────────────────┐
│ Key             │ Value                                │
├─────────────────┼──────────────────────────────────────┤
│ assignmentId    │ 123e4567-e89b-12d3-a456-426614174000 │
│ writerId        │ 987fcdeb-51a2-43d1-b789-123456789abc │
│ submissionText  │ Here is my completed essay           │
│ file_0          │ [Select File: essay.pdf]             │
│ file_1          │ [Select File: sources.zip]           │
└─────────────────┴──────────────────────────────────────┘
```

---

## Integration with Frontend

### JavaScript Fetch Example

```javascript
const submitWork = async (assignmentId, writerId, files, submissionText) => {
  const formData = new FormData();
  formData.append('assignmentId', assignmentId);
  formData.append('writerId', writerId);
  formData.append('submissionText', submissionText);
  
  files.forEach((file, index) => {
    formData.append(`file_${index}`, file);
  });
  
  const response = await fetch('/api/submissions/submit', {
    method: 'POST',
    body: formData,
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Submission failed');
  }
  
  return data;
};

// Usage
try {
  const result = await submitWork(
    'assignment-123',
    'writer-456',
    [file1, file2],
    'My submission notes'
  );
  console.log('Submission successful:', result.submissionId);
} catch (error) {
  console.error('Submission failed:', error.message);
}
```

---

## Rollback Testing

### Test File Upload Failure Rollback

To test rollback behavior:

1. Temporarily modify Supabase Storage bucket permissions to deny uploads
2. Submit work via API
3. Verify that:
   - No submission record exists in database
   - No files uploaded to storage
   - Error response returned to client

### Test Database Failure Rollback

1. Temporarily set invalid database credentials
2. Submit work via API
3. Verify appropriate error handling

---

## Performance Testing

### Large File Upload Test

**Test with 50MB file (maximum allowed):**
```bash
# Create a 50MB test file
dd if=/dev/zero of=large-file.pdf bs=1M count=50

# Submit
curl -X POST http://localhost:3000/api/submissions/submit \
  -F "assignmentId=test-assignment-id" \
  -F "writerId=test-writer-id" \
  -F "file_0=@large-file.pdf"
```

**Expected:** Should complete successfully within reasonable time (< 60 seconds)

### Multiple Files Test

**Test with 10 files (maximum allowed):**
```bash
curl -X POST http://localhost:3000/api/submissions/submit \
  -F "assignmentId=test-assignment-id" \
  -F "writerId=test-writer-id" \
  -F "file_0=@file1.pdf" \
  -F "file_1=@file2.pdf" \
  ... (up to file_9)
```

---

## Security Testing

### SQL Injection Test
Try submitting with malicious assignmentId:
```
assignmentId: "'; DROP TABLE submissions; --"
```
**Expected:** Should be safely handled by parameterized queries

### File Type Validation Test
Try uploading non-allowed file types:
```bash
curl -X POST http://localhost:3000/api/submissions/submit \
  -F "assignmentId=test-assignment-id" \
  -F "writerId=test-writer-id" \
  -F "file_0=@malicious.exe"
```
**Expected:** Should fail at upload stage with file validation error

---

## Troubleshooting

### Common Issues

1. **"Server configuration error"**
   - Check environment variables are set correctly
   - Verify Supabase URL and keys

2. **"Failed to upload files"**
   - Check Supabase Storage bucket exists
   - Verify storage policies allow uploads
   - Check file size limits

3. **"Assignment not found"**
   - Verify assignment exists in database
   - Check assignment ID is correct UUID format

4. **Upload hangs/times out**
   - Check network connectivity
   - Verify file size is within limits
   - Check Supabase Storage is accessible

---

## Success Criteria

✅ All validation test cases return appropriate error codes
✅ Successful submissions create database records
✅ Files are uploaded to correct storage paths
✅ Assignment status updates to `under_review`
✅ Revision numbers increment correctly
✅ Rollback works on upload failures
✅ Concurrent submission prevention works
✅ API handles errors gracefully

---

## Next Steps

After successful API testing:
1. Update SubmissionForm component to use API endpoint
2. Implement notification system for students
3. Add real-time status updates
4. Implement submission history viewing
5. Add student review functionality
