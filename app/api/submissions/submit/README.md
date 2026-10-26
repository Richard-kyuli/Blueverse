# Submission API Endpoint

## Overview

This API endpoint handles the creation of assignment submissions with file uploads. It provides comprehensive validation, error handling, and rollback capabilities to ensure data integrity.

**Location:** `app/api/submissions/submit/route.js`

**Requirements:** US-W1.1, US-W1.2, US-W1.6, FR-2

---

## Endpoint Details

### POST /api/submissions/submit

Creates a new submission record and uploads associated files to Supabase Storage.

**Content-Type:** `multipart/form-data`

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `assignmentId` | string | Yes | UUID of the assignment |
| `writerId` | string | No | Not used for authorization — the writer is taken from the bearer token. If sent, it must match the authenticated user |
| `submissionText` | string | No | Optional notes/description from writer |
| `file_0`, `file_1`, ... | File | Yes | At least one file required. Use `file_N` naming pattern |

### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | `Bearer <supabase access token>` belonging to the assigned writer |

### File Requirements

- **Accepted Types:** PDF, DOC, DOCX, TXT, ZIP
- **Maximum Size:** 50MB per file
- **Maximum Count:** 10 files per submission
- **Validation:** Performed by `uploadMultipleFiles` helper

---

## Response Format

### Success Response (201 Created)

```json
{
  "success": true,
  "submissionId": "uuid-string",
  "filePaths": [
    "{assignment_id}/{submission_id}/1698345600000-essay.pdf"
  ],
  "revisionNumber": 1,
  "message": "Work submitted successfully! The student will be notified to review your submission."
}
```

`filePaths` are storage paths inside the private `submissions` bucket, not public URLs.
Generate a signed URL with `getFileUrl(path)` from `lib/supabaseStorage` when rendering them.

### Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "error": "Error message describing the validation failure"
}
```

**Common 400 Errors:**
- Missing required field (assignmentId)
- No files provided
- Invalid assignment status (not 'assigned' or 'in_progress')
- Submission already under review (concurrent submission prevention)

#### 401 Unauthorized
```json
{
  "success": false,
  "error": "Missing authorization token"
}
```

**Cause:** The `Authorization: Bearer <access token>` header is absent or the token is invalid/expired

#### 403 Forbidden
```json
{
  "success": false,
  "error": "writerId does not match the authenticated user"
}
```

**Cause:** The `writerId` form field does not match the user identified by the access token

#### 403 Forbidden (not assigned)
```json
{
  "success": false,
  "error": "You are not authorized to submit work for this assignment"
}
```

**Cause:** Writer is not assigned to the assignment

#### 404 Not Found
```json
{
  "success": false,
  "error": "Assignment not found"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details"
}
```

**Common 500 Errors:**
- File upload failures
- Database operation failures
- Unexpected server errors

---

## Validation Rules

### Assignment Validation

1. **Authenticated:** A valid Supabase access token must be presented, and the token's user must match any `writerId` sent in the body
2. **Assignment Exists:** Assignment must exist in database
3. **Writer Authorization:** The authenticated user must equal `assignment.assigned_writer_id`
4. **Valid Status:** Assignment status must be `assigned` or `in_progress`
5. **No Pending Review:** No other submission can have status `submitted` for this assignment

### File Validation

Performed by `uploadMultipleFiles` from `lib/supabaseStorage.js`:

1. At least one file required
2. Maximum 10 files per submission
3. Each file must be ≤ 50MB
4. Only accepted file types (PDF, DOC, DOCX, TXT, ZIP)

---

## Workflow

### Successful Submission Flow

```
1. Parse form data (assignmentId, writerId, files, submissionText)
   ↓
2. Validate required fields
   ↓
3. Fetch and validate assignment
   ↓
4. Check for existing submissions under review
   ↓
5. Calculate revision number (count existing + 1)
   ↓
6. Find parent submission (most recent)
   ↓
7. Create submission record in database (status: 'submitted')
   ↓
8. Upload files to Supabase Storage
   ↓
9. Update submission with file URLs
   ↓
10. Update assignment status to 'under_review'
   ↓
11. Return success response
```

### Error Handling with Rollback

If any step fails after submission record creation (step 7):

```
Error occurs during file upload or database update
   ↓
Delete submission record from database
   ↓
Delete any uploaded files from storage (if applicable)
   ↓
Return error response to client
```

This ensures **data consistency** - either the entire submission succeeds or it's completely rolled back.

---

## Database Operations

### Tables Modified

1. **submissions**
   - `INSERT`: New submission record
   - `SELECT`: Check existing submissions, count revisions, find parent
   - `UPDATE`: Add file URLs after upload
   - `DELETE`: Rollback on error

2. **assignments**
   - `SELECT`: Fetch and validate assignment
   - `UPDATE`: Change status to 'under_review'

### Submission Record Fields

```javascript
{
  id: UUID (auto-generated),
  assignment_id: UUID,
  writer_id: UUID,
  submission_text: TEXT | NULL,
  file_urls: TEXT[],
  status: 'submitted',
  revision_number: INTEGER,
  parent_submission_id: UUID | NULL,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

---

## Storage Structure

Files are organized in Supabase Storage:

```
submissions/
  {assignmentId}/
    {submissionId}/
      timestamp-filename1.pdf
      timestamp-filename2.docx
      timestamp-filename3.zip
```

**Path Format:** `submissions/{assignmentId}/{submissionId}/{timestamp}-{sanitizedFilename}`

**Timestamp Prefix:** Prevents filename collisions across submissions

---

## Revision Tracking

### First Submission
- `revision_number`: 1
- `parent_submission_id`: NULL

### Subsequent Submissions (Revisions)
- `revision_number`: 2, 3, 4, ...
- `parent_submission_id`: ID of most recent submission

**Example Revision Chain:**
```
Submission 1 (revision: 1, parent: null)
   ↓ student requests revision
Submission 2 (revision: 2, parent: submission-1-id)
   ↓ student requests revision again
Submission 3 (revision: 3, parent: submission-2-id)
```

---

## Security Considerations

### Row Level Security (RLS)

The endpoint relies on Supabase RLS policies for:
- Writers can only insert submissions for their assigned assignments
- Storage bucket policies restrict file uploads to assigned writers
- Only assignment parties (student + writer) can view submission files

### Input Sanitization

- **Filename Sanitization:** Special characters removed before upload
- **SQL Injection Prevention:** Parameterized queries via Supabase client
- **File Type Validation:** MIME type checking in upload helpers

### Access Control

1. Writer must be `assigned_writer_id` for the assignment
2. Assignment must be in valid state for submission
3. Concurrent submission prevention

---

## Dependencies

### External Libraries
- `next/server` - NextResponse for API route handling
- `@supabase/supabase-js` - Database and storage operations

### Internal Modules
- `lib/supabaseStorage` - File upload/management utilities
  - `uploadMultipleFiles(files, assignmentId, submissionId)`

### Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` - Required
- `SUPABASE_SERVICE_ROLE_KEY` - Required (server-side DB/storage writes; the endpoint returns 500 without it)

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is still needed by the browser client, but is never used for writes in this endpoint.

---

## Error Codes Reference

| Status | Code | Meaning | Resolution |
|--------|------|---------|------------|
| 400 | Missing required field | assignmentId not provided | Include assignmentId |
| 400 | No files | No files in request | Add at least one file with `file_N` naming |
| 400 | Invalid status | Assignment status doesn't allow submission | Wait for appropriate status |
| 400 | Pending review | Another submission already under review | Wait for review completion |
| 401 | Unauthorized | Missing or invalid access token | Sign in again and resend the request |
| 403 | Not authorized | Writer not assigned to assignment, or writerId mismatch | Verify writer assignment |
| 404 | Not found | Assignment doesn't exist | Verify assignment ID |
| 500 | Upload failed | File upload to storage failed | Check storage bucket, retry |
| 500 | Database error | Database operation failed | Check logs, contact support |
| 500 | Server configuration error | `SUPABASE_SERVICE_ROLE_KEY` missing | Add it to `.env.local` and restart |

---

## Usage Examples

### JavaScript/TypeScript

```javascript
async function submitWork(assignmentId, files, notes) {
  const { data: { session } } = await supabase.auth.getSession();

  const formData = new FormData();
  formData.append('assignmentId', assignmentId);
  formData.append('submissionText', notes);
  
  files.forEach((file, index) => {
    formData.append(`file_${index}`, file);
  });
  
  const response = await fetch('/api/submissions/submit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }
  
  return await response.json();
}
```

### cURL

```bash
curl -X POST http://localhost:3000/api/submissions/submit \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -F "assignmentId=123e4567-e89b-12d3-a456-426614174000" \
  -F "submissionText=Completed work as per requirements" \
  -F "file_0=@essay.pdf" \
  -F "file_1=@sources.zip"
```

---

## Performance Considerations

### File Upload Performance

- **Parallel Uploads:** Multiple files uploaded concurrently via `uploadMultipleFiles`
- **Progress Tracking:** Optional progress callback supported in upload helper
- **Timeout Handling:** Large files may take time; ensure appropriate timeout settings

### Database Queries

- **Indexed Queries:** Assignment and submission lookups use indexed columns
- **Batch Operations:** Multiple validation checks performed efficiently
- **Transaction Safety:** Rollback ensures consistency without explicit transactions

### Recommendations

- **Client-side Validation:** Validate files before submission to reduce server load
- **Progress Indicators:** Show upload progress to users for better UX
- **Error Handling:** Implement retry logic for transient network errors

---

## Testing

See `TESTING.md` for comprehensive testing guide including:
- Manual test cases
- cURL examples
- Integration testing instructions
- Security testing scenarios

---

## Future Enhancements

1. **Chunked Upload:** For files > 5MB to prevent timeouts
2. **Progress Streaming:** Real-time upload progress via Server-Sent Events
3. **Async Processing:** Queue file processing for virus scanning, etc.
4. **Rate Limiting:** Prevent submission spam
5. **Notification Integration:** Automatic student notification on submission
6. **Webhook Support:** Trigger external systems on submission

---

## Troubleshooting

### "Server configuration error"
**Cause:** Missing environment variables  
**Fix:** Set `NEXT_PUBLIC_SUPABASE_URL` and Supabase key

### "Failed to upload files"
**Cause:** Storage bucket issues or file validation failure  
**Fix:** 
- Verify `submissions` bucket exists
- Check storage policies allow writer uploads
- Ensure files meet size/type requirements

### "Cannot submit while previous submission is under review"
**Cause:** Concurrent submission prevention  
**Fix:** Wait for student to review previous submission or change status

### Submission created but status not updated
**Cause:** Assignment update failed (logged but not rolled back)  
**Fix:** Manual intervention to update assignment status to `under_review`

---

## Support

For issues or questions:
1. Check logs for detailed error messages
2. Verify database and storage setup
3. Review requirements document: `.kiro/specs/assignment-submission-workflow/requirements.md`
4. Review design document: `.kiro/specs/assignment-submission-workflow/design.md`

---

## Related Files

- **Component:** `components/submissions/SubmissionForm.jsx`
- **Storage Helpers:** `lib/supabaseStorage.js`
- **File Validation:** `lib/fileValidation.js`
- **Tests:** `app/api/submissions/submit/route.test.js`
- **Testing Guide:** `app/api/submissions/submit/TESTING.md`
