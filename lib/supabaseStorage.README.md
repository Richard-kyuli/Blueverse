# Supabase Storage Helper Functions

This module provides utilities for managing file uploads to Supabase Storage for the assignment submission workflow.

## Installation

The module is already installed with the project dependencies. Simply import the functions you need:

```javascript
import {
  uploadFile,
  uploadMultipleFiles,
  deleteFile,
  getFileUrl,
  validateFile,
  formatFileSize
} from '@/lib/supabaseStorage';
```

## Functions

### `uploadFile(file, assignmentId, submissionId)`

Upload a single file to Supabase Storage.

**Parameters:**
- `file` (File): The file to upload
- `assignmentId` (string): The assignment ID
- `submissionId` (string): The submission ID

**Returns:** `Promise<{success: boolean, url?: string, path?: string, error?: string}>`

**Example:**
```javascript
const result = await uploadFile(file, 'assignment-123', 'submission-456');

if (result.success) {
  console.log('File uploaded:', result.url);
} else {
  console.error('Upload failed:', result.error);
}
```

**Validation Rules:**
- File type must be: PDF, DOC, DOCX, TXT, or ZIP
- File size must not exceed 50MB
- Files are stored at: `submissions/{assignmentId}/{submissionId}/{timestamp}-{filename}`

---

### `uploadMultipleFiles(files, assignmentId, submissionId, onProgress)`

Upload multiple files in parallel with progress tracking.

**Parameters:**
- `files` (File[]): Array of files to upload
- `assignmentId` (string): The assignment ID
- `submissionId` (string): The submission ID
- `onProgress` (Function, optional): Callback function for progress updates

**Returns:** `Promise<{success: boolean, results: Array, uploadedUrls?: string[], error?: string}>`

**Example:**
```javascript
const files = [file1, file2, file3];

const result = await uploadMultipleFiles(
  files,
  'assignment-123',
  'submission-456',
  (progress) => {
    console.log(`Progress: ${progress.progress}% - ${progress.fileName}`);
  }
);

if (result.success) {
  console.log('All files uploaded:', result.uploadedUrls);
} else {
  console.error('Upload failed:', result.error);
  console.log('Failed files:', result.failedFiles);
}
```

**Progress Callback Data:**
```javascript
{
  fileName: string,     // Name of the file being uploaded
  index: number,        // Index in the array
  completed: number,    // Number of files completed
  total: number,        // Total number of files
  progress: number      // Percentage (0-100)
}
```

**Features:**
- Maximum 10 files per submission
- Automatic rollback on any failure (all-or-nothing)
- Parallel uploads for better performance
- Progress tracking per file

---

### `deleteFile(fileUrl)`

Delete a file from Supabase Storage using its URL.

**Parameters:**
- `fileUrl` (string): The full URL of the file to delete

**Returns:** `Promise<{success: boolean, error?: string}>`

**Example:**
```javascript
const result = await deleteFile(
  'https://iyxxudowlsjgzrmiwomm.supabase.co/storage/v1/object/public/submissions/...'
);

if (result.success) {
  console.log('File deleted successfully');
}
```

---

### `getFileUrl(path)`

Generate a signed URL for file download (valid for 1 hour).

**Parameters:**
- `path` (string): The file path in storage (e.g., "assignmentId/submissionId/filename.pdf")

**Returns:** `Promise<{success: boolean, url?: string, error?: string}>`

**Example:**
```javascript
const result = await getFileUrl('assignment-123/submission-456/document.pdf');

if (result.success) {
  window.open(result.url, '_blank'); // Download file
}
```

---

### `validateFile(file)`

Validate a file before upload (client-side validation).

**Parameters:**
- `file` (File): The file to validate

**Returns:** `{valid: boolean, error?: string}`

**Example:**
```javascript
const validation = validateFile(file);

if (!validation.valid) {
  alert(validation.error);
  return;
}

// Proceed with upload
```

---

### Utility Functions

#### `getFileExtension(filename)`

Extract file extension from filename.

```javascript
getFileExtension('document.pdf'); // Returns: 'pdf'
```

#### `getFileIcon(filename)`

Get Lucide React icon name based on file extension.

```javascript
getFileIcon('document.pdf'); // Returns: 'FileText'
getFileIcon('archive.zip');  // Returns: 'Archive'
```

**Icon Mapping:**
- PDF, DOC, DOCX, TXT → `FileText`
- ZIP → `Archive`
- Unknown → `File`

#### `formatFileSize(bytes)`

Format file size for display.

```javascript
formatFileSize(1024);        // Returns: '1 KB'
formatFileSize(1048576);     // Returns: '1 MB'
formatFileSize(5242880);     // Returns: '5 MB'
```

---

## Error Handling

All functions return a consistent error format:

```javascript
{
  success: false,
  error: 'Error message explaining what went wrong'
}
```

### Common Errors

1. **Invalid file type:**
   ```
   "Invalid file type: image/jpeg. Only PDF, DOC, DOCX, TXT, and ZIP files are allowed."
   ```

2. **File too large:**
   ```
   "File size exceeds 50MB limit. File size: 51.2MB"
   ```

3. **Too many files:**
   ```
   "Maximum 10 files allowed per submission"
   ```

4. **Upload failure:**
   ```
   "Failed to upload 2 file(s). All uploads have been rolled back."
   ```

---

## Storage Structure

Files are organized in Supabase Storage as follows:

```
submissions/
  {assignmentId}/
    {submissionId}/
      {timestamp}-document1.pdf
      {timestamp}-essay.docx
      {timestamp}-sources.zip
```

The timestamp prefix prevents filename collisions when resubmitting files with the same name.

---

## Testing

Run the test suite:

```bash
npm test -- lib/supabaseStorage.test.js --run
```

The module includes 35 unit tests covering:
- File validation (type, size, edge cases)
- File extension extraction
- Icon mapping
- File size formatting
- Upload error handling
- Delete error handling
- Progress tracking

---

## Security

### Row Level Security (RLS)

Storage bucket policies must be configured in Supabase to restrict access:

1. **Upload Policy**: Writers can only upload to their assigned assignments
2. **View Policy**: Only assignment parties (student and writer) can view files
3. **Delete Policy**: Writers can delete their submission files

See `SUPABASE-STORAGE-SETUP.md` for detailed policy configuration.

### Client-Side Validation

All validation is performed both client-side (for UX) and server-side (for security):
- File type checking
- File size limits
- File count limits

**Never trust client-side validation alone!**

---

## Requirements Fulfilled

This module implements:
- **FR-1**: File Upload System with validation and progress tracking
- **Design**: File Upload Optimization with parallel uploads and rollback
- **NFR-1**: Security with proper error handling
- **NFR-2**: Performance with parallel uploads and chunked processing

---

## Next Steps

To use these functions in the submission workflow:

1. Create the Supabase Storage bucket: `submissions`
2. Configure storage policies (see SUPABASE-STORAGE-SETUP.md)
3. Import and use in submission form components
4. Integrate with submission API endpoints

---

## Support

For issues or questions:
- Check Supabase logs in Dashboard → Logs
- Verify storage bucket exists and policies are active
- Review test cases for usage examples
