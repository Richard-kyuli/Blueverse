/**
 * File Validation Utilities for Assignment Submission Workflow
 * 
 * Provides validation functions for file uploads including type checking,
 * size validation, count limits, and formatting utilities.
 * 
 * Requirements: FR-1, US-W1.3
 */

// Accepted file types for submissions
const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'application/zip': ['.zip'],
  'application/x-zip-compressed': ['.zip'],
};

// File size limits
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
const MAX_FILE_COUNT = 10;

/**
 * Validates if a file's MIME type is accepted for submission
 * 
 * @param {File} file - The file object to validate
 * @returns {boolean} - True if file type is accepted, false otherwise
 * 
 * @example
 * const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });
 * validateFileType(file); // returns true
 */
export function validateFileType(file) {
  if (!file) {
    return false;
  }

  // Check if the MIME type is in accepted types
  if (file.type && ACCEPTED_FILE_TYPES[file.type]) {
    return true;
  }

  // Fallback: check file extension if MIME type is missing or generic
  if (!file.name) {
    return false;
  }

  const fileName = file.name.toLowerCase();
  for (const [mimeType, extensions] of Object.entries(ACCEPTED_FILE_TYPES)) {
    if (extensions.some(ext => fileName.endsWith(ext))) {
      return true;
    }
  }

  return false;
}

/**
 * Validates if a file's size is within the specified limit
 * 
 * @param {File} file - The file object to validate
 * @param {number} maxSize - Maximum file size in bytes (defaults to 50MB)
 * @returns {boolean} - True if file size is within limit, false otherwise
 * 
 * @example
 * const file = new File(['content'], 'document.pdf');
 * validateFileSize(file, 50 * 1024 * 1024); // returns true if < 50MB
 */
export function validateFileSize(file, maxSize = MAX_FILE_SIZE) {
  if (!file || typeof file.size !== 'number') {
    return false;
  }

  return file.size <= maxSize && file.size > 0;
}

/**
 * Validates if the number of files is within the specified limit
 * 
 * @param {File[]} files - Array of file objects to validate
 * @param {number} maxCount - Maximum number of files allowed (defaults to 10)
 * @returns {boolean} - True if file count is within limit, false otherwise
 * 
 * @example
 * const files = [file1, file2, file3];
 * validateFileCount(files, 10); // returns true
 */
export function validateFileCount(files, maxCount = MAX_FILE_COUNT) {
  if (!Array.isArray(files)) {
    return false;
  }

  return files.length > 0 && files.length <= maxCount;
}

/**
 * Returns the appropriate Lucide icon name for a given file
 * 
 * @param {string} filename - The name of the file
 * @returns {string} - Lucide icon name for the file type
 * 
 * @example
 * getFileIcon('document.pdf'); // returns 'FileText'
 * getFileIcon('essay.docx'); // returns 'FileText'
 * getFileIcon('archive.zip'); // returns 'FolderArchive'
 */
export function getFileIcon(filename) {
  if (!filename || typeof filename !== 'string') {
    return 'File';
  }

  const extension = filename.toLowerCase().split('.').pop();

  switch (extension) {
    case 'pdf':
      return 'FileText';
    case 'doc':
    case 'docx':
      return 'FileText';
    case 'txt':
      return 'FileType';
    case 'zip':
      return 'FolderArchive';
    default:
      return 'File';
  }
}

/**
 * Formats file size in bytes to a human-readable format
 * 
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size (e.g., "1.5 MB", "250 KB")
 * 
 * @example
 * formatFileSize(1024); // returns "1.00 KB"
 * formatFileSize(1536000); // returns "1.46 MB"
 * formatFileSize(52428800); // returns "50.00 MB"
 */
export function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || bytes < 0) {
    return '0 B';
  }

  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const decimals = 2;

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unitIndex = Math.min(i, units.length - 1);

  const size = bytes / Math.pow(k, unitIndex);
  
  return `${size.toFixed(decimals)} ${units[unitIndex]}`;
}

/**
 * Validates a single file for type and size constraints
 * 
 * @param {File} file - The file object to validate
 * @param {number} maxSize - Maximum file size in bytes (defaults to 50MB)
 * @returns {{ valid: boolean, error: string | null }} - Validation result with error message if invalid
 * 
 * @example
 * const result = validateFile(file);
 * if (!result.valid) {
 *   console.error(result.error);
 * }
 */
export function validateFile(file, maxSize = MAX_FILE_SIZE) {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (!validateFileType(file)) {
    return {
      valid: false,
      error: `Invalid file type. Accepted types: PDF, DOC, DOCX, TXT, ZIP`,
    };
  }

  if (!validateFileSize(file, maxSize)) {
    return {
      valid: false,
      error: `File size exceeds maximum limit of ${formatFileSize(maxSize)}`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Validates an array of files for type, size, and count constraints
 * 
 * @param {File[]} files - Array of file objects to validate
 * @param {Object} options - Validation options
 * @param {number} options.maxSize - Maximum file size in bytes (defaults to 50MB)
 * @param {number} options.maxCount - Maximum number of files (defaults to 10)
 * @returns {{ valid: boolean, errors: string[] }} - Validation result with array of error messages
 * 
 * @example
 * const result = validateFiles(files);
 * if (!result.valid) {
 *   result.errors.forEach(error => console.error(error));
 * }
 */
export function validateFiles(files, options = {}) {
  const { maxSize = MAX_FILE_SIZE, maxCount = MAX_FILE_COUNT } = options;
  const errors = [];

  if (!Array.isArray(files)) {
    return { valid: false, errors: ['Files must be provided as an array'] };
  }

  if (files.length === 0) {
    return { valid: false, errors: ['At least one file is required'] };
  }

  if (!validateFileCount(files, maxCount)) {
    errors.push(`Too many files. Maximum ${maxCount} files allowed`);
  }

  // Validate each individual file
  files.forEach((file, index) => {
    const result = validateFile(file, maxSize);
    if (!result.valid) {
      errors.push(`File ${index + 1} (${file.name}): ${result.error}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Gets a list of accepted file extensions as a string for input accept attribute
 * 
 * @returns {string} - Comma-separated list of accepted file extensions
 * 
 * @example
 * const acceptString = getAcceptedFileExtensions();
 * <input type="file" accept={acceptString} />
 */
export function getAcceptedFileExtensions() {
  const extensions = Object.values(ACCEPTED_FILE_TYPES).flat();
  return extensions.join(',');
}

/**
 * Gets a list of accepted MIME types
 * 
 * @returns {string[]} - Array of accepted MIME types
 * 
 * @example
 * const mimeTypes = getAcceptedMimeTypes();
 * console.log(mimeTypes); // ['application/pdf', 'application/msword', ...]
 */
export function getAcceptedMimeTypes() {
  return Object.keys(ACCEPTED_FILE_TYPES);
}

// Export constants for use in components
export { MAX_FILE_SIZE, MAX_FILE_COUNT, ACCEPTED_FILE_TYPES };
