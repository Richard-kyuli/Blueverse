# Library Utilities

This directory contains shared utility functions used across the Blueverse application.

## File Validation Utilities (`fileValidation.js`)

Comprehensive file validation utilities for the assignment submission workflow.

### Features

- **File Type Validation**: Validates files against accepted MIME types (PDF, DOC, DOCX, TXT, ZIP)
- **File Size Validation**: Ensures files don't exceed the 50MB limit
- **File Count Validation**: Limits uploads to maximum 10 files
- **File Icons**: Returns appropriate Lucide icon names for different file types
- **Size Formatting**: Converts bytes to human-readable format (KB, MB, GB)

### Usage

```javascript
import {
  validateFileType,
  validateFileSize,
  validateFileCount,
  validateFile,
  validateFiles,
  getFileIcon,
  formatFileSize,
  getAcceptedFileExtensions,
  MAX_FILE_SIZE,
  MAX_FILE_COUNT,
} from '@/lib/fileValidation';

// Validate a single file
const file = document.querySelector('input[type="file"]').files[0];
const result = validateFile(file);

if (!result.valid) {
  console.error(result.error);
}

// Validate multiple files
const files = Array.from(document.querySelector('input[type="file"]').files);
const result = validateFiles(files);

if (!result.valid) {
  result.errors.forEach(error => console.error(error));
}

// Get file icon for display
const icon = getFileIcon('document.pdf'); // returns 'FileText'

// Format file size
const formattedSize = formatFileSize(1536000); // returns '1.46 MB'

// Use in file input
<input 
  type="file" 
  accept={getAcceptedFileExtensions()} 
  multiple 
/>
```

### API Reference

#### `validateFileType(file: File): boolean`
Checks if file MIME type or extension is accepted. Supports PDF, DOC, DOCX, TXT, ZIP.

#### `validateFileSize(file: File, maxSize?: number): boolean`
Validates file size. Default max is 50MB. Returns false for empty files.

#### `validateFileCount(files: File[], maxCount?: number): boolean`
Checks if file count is within limit. Default max is 10 files.

#### `validateFile(file: File, maxSize?: number): { valid: boolean, error: string | null }`
Comprehensive single file validation with error messages.

#### `validateFiles(files: File[], options?: { maxSize?: number, maxCount?: number }): { valid: boolean, errors: string[] }`
Validates array of files with detailed error messages for each invalid file.

#### `getFileIcon(filename: string): string`
Returns Lucide icon name based on file extension:
- PDF, DOC, DOCX → `'FileText'`
- TXT → `'FileType'`
- ZIP → `'FolderArchive'`
- Unknown → `'File'`

#### `formatFileSize(bytes: number): string`
Converts bytes to human-readable format with 2 decimal places.

#### `getAcceptedFileExtensions(): string`
Returns comma-separated list of accepted extensions for HTML input accept attribute.

#### `getAcceptedMimeTypes(): string[]`
Returns array of accepted MIME types.

### Constants

- `MAX_FILE_SIZE`: 52,428,800 bytes (50MB)
- `MAX_FILE_COUNT`: 10 files
- `ACCEPTED_FILE_TYPES`: Object mapping MIME types to extensions

### Testing

Run tests with:
```bash
npm run test:run lib/fileValidation.test.js
```

Test coverage: 63 unit tests covering all functions and edge cases.

### Requirements

Implements requirements:
- **FR-1**: File Upload System with validation
- **US-W1.3**: File type and size validation for writer submissions

---

## Other Utilities

### `supabase.js`
Supabase client configuration for database and storage operations.

### `stripe.js`
Stripe integration for payment processing.
