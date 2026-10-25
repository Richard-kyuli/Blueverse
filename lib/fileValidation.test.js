/**
 * Unit Tests for File Validation Utilities
 * 
 * Tests for FR-1, US-W1.3 requirements
 */

import { describe, it, expect } from 'vitest';
import {
  validateFileType,
  validateFileSize,
  validateFileCount,
  getFileIcon,
  formatFileSize,
  validateFile,
  validateFiles,
  getAcceptedFileExtensions,
  getAcceptedMimeTypes,
  MAX_FILE_SIZE,
  MAX_FILE_COUNT,
} from './fileValidation.js';

describe('validateFileType', () => {
  it('accepts PDF files', () => {
    const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });
    expect(validateFileType(file)).toBe(true);
  });

  it('accepts DOC files', () => {
    const file = new File(['content'], 'essay.doc', { type: 'application/msword' });
    expect(validateFileType(file)).toBe(true);
  });

  it('accepts DOCX files', () => {
    const file = new File(['content'], 'essay.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    expect(validateFileType(file)).toBe(true);
  });

  it('accepts TXT files', () => {
    const file = new File(['content'], 'notes.txt', { type: 'text/plain' });
    expect(validateFileType(file)).toBe(true);
  });

  it('accepts ZIP files', () => {
    const file = new File(['content'], 'archive.zip', { type: 'application/zip' });
    expect(validateFileType(file)).toBe(true);
  });

  it('accepts ZIP files with alternative MIME type', () => {
    const file = new File(['content'], 'archive.zip', { type: 'application/x-zip-compressed' });
    expect(validateFileType(file)).toBe(true);
  });

  it('rejects image files', () => {
    const file = new File(['content'], 'image.jpg', { type: 'image/jpeg' });
    expect(validateFileType(file)).toBe(false);
  });

  it('rejects JavaScript files', () => {
    const file = new File(['content'], 'script.js', { type: 'application/javascript' });
    expect(validateFileType(file)).toBe(false);
  });

  it('rejects executable files', () => {
    const file = new File(['content'], 'malware.exe', { type: 'application/x-msdownload' });
    expect(validateFileType(file)).toBe(false);
  });

  it('returns false for null file', () => {
    expect(validateFileType(null)).toBe(false);
  });

  it('returns false for undefined file', () => {
    expect(validateFileType(undefined)).toBe(false);
  });

  it('validates by extension when MIME type is missing', () => {
    const file = new File(['content'], 'document.pdf', { type: '' });
    expect(validateFileType(file)).toBe(true);
  });
});

describe('validateFileSize', () => {
  it('accepts files under the size limit', () => {
    const file = new File(['x'.repeat(1000)], 'small.txt');
    expect(validateFileSize(file, MAX_FILE_SIZE)).toBe(true);
  });

  it('accepts files at exactly the size limit', () => {
    const maxSize = 1024; // 1KB
    const content = 'x'.repeat(1024);
    const file = new File([content], 'exact.txt');
    expect(validateFileSize(file, maxSize)).toBe(true);
  });

  it('rejects files over the size limit', () => {
    const maxSize = 100; // 100 bytes
    const content = 'x'.repeat(200);
    const file = new File([content], 'large.txt');
    expect(validateFileSize(file, maxSize)).toBe(false);
  });

  it('rejects empty files (0 bytes)', () => {
    const file = new File([], 'empty.txt');
    expect(validateFileSize(file, MAX_FILE_SIZE)).toBe(false);
  });

  it('uses default max size when not specified', () => {
    const file = new File(['content'], 'test.txt');
    expect(validateFileSize(file)).toBe(true);
  });

  it('returns false for null file', () => {
    expect(validateFileSize(null, MAX_FILE_SIZE)).toBe(false);
  });

  it('returns false for undefined file', () => {
    expect(validateFileSize(undefined, MAX_FILE_SIZE)).toBe(false);
  });
});

describe('validateFileCount', () => {
  const createMockFiles = (count) => {
    return Array.from({ length: count }, (_, i) => 
      new File(['content'], `file${i}.txt`, { type: 'text/plain' })
    );
  };

  it('accepts file count within limit', () => {
    const files = createMockFiles(5);
    expect(validateFileCount(files, MAX_FILE_COUNT)).toBe(true);
  });

  it('accepts file count at exactly the limit', () => {
    const files = createMockFiles(10);
    expect(validateFileCount(files, 10)).toBe(true);
  });

  it('rejects file count over the limit', () => {
    const files = createMockFiles(15);
    expect(validateFileCount(files, MAX_FILE_COUNT)).toBe(false);
  });

  it('rejects empty file array', () => {
    expect(validateFileCount([], MAX_FILE_COUNT)).toBe(false);
  });

  it('accepts single file', () => {
    const files = createMockFiles(1);
    expect(validateFileCount(files, MAX_FILE_COUNT)).toBe(true);
  });

  it('uses default max count when not specified', () => {
    const files = createMockFiles(5);
    expect(validateFileCount(files)).toBe(true);
  });

  it('returns false for non-array input', () => {
    expect(validateFileCount(null, MAX_FILE_COUNT)).toBe(false);
    expect(validateFileCount(undefined, MAX_FILE_COUNT)).toBe(false);
    expect(validateFileCount({}, MAX_FILE_COUNT)).toBe(false);
  });
});

describe('getFileIcon', () => {
  it('returns FileText for PDF files', () => {
    expect(getFileIcon('document.pdf')).toBe('FileText');
  });

  it('returns FileText for DOC files', () => {
    expect(getFileIcon('essay.doc')).toBe('FileText');
  });

  it('returns FileText for DOCX files', () => {
    expect(getFileIcon('report.docx')).toBe('FileText');
  });

  it('returns FileType for TXT files', () => {
    expect(getFileIcon('notes.txt')).toBe('FileType');
  });

  it('returns FolderArchive for ZIP files', () => {
    expect(getFileIcon('archive.zip')).toBe('FolderArchive');
  });

  it('returns File for unknown file types', () => {
    expect(getFileIcon('unknown.xyz')).toBe('File');
  });

  it('handles uppercase extensions', () => {
    expect(getFileIcon('DOCUMENT.PDF')).toBe('FileText');
  });

  it('handles mixed case extensions', () => {
    expect(getFileIcon('Report.DocX')).toBe('FileText');
  });

  it('returns File for null filename', () => {
    expect(getFileIcon(null)).toBe('File');
  });

  it('returns File for undefined filename', () => {
    expect(getFileIcon(undefined)).toBe('File');
  });

  it('returns File for empty string', () => {
    expect(getFileIcon('')).toBe('File');
  });
});

describe('formatFileSize', () => {
  it('formats bytes correctly', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(500)).toBe('500.00 B');
    expect(formatFileSize(1023)).toBe('1023.00 B');
  });

  it('formats kilobytes correctly', () => {
    expect(formatFileSize(1024)).toBe('1.00 KB');
    expect(formatFileSize(1536)).toBe('1.50 KB');
    expect(formatFileSize(10240)).toBe('10.00 KB');
  });

  it('formats megabytes correctly', () => {
    expect(formatFileSize(1048576)).toBe('1.00 MB');
    expect(formatFileSize(1572864)).toBe('1.50 MB');
    expect(formatFileSize(52428800)).toBe('50.00 MB');
  });

  it('formats gigabytes correctly', () => {
    expect(formatFileSize(1073741824)).toBe('1.00 GB');
    expect(formatFileSize(2147483648)).toBe('2.00 GB');
  });

  it('handles edge cases', () => {
    expect(formatFileSize(-1)).toBe('0 B');
    expect(formatFileSize(null)).toBe('0 B');
    expect(formatFileSize(undefined)).toBe('0 B');
    expect(formatFileSize('not a number')).toBe('0 B');
  });

  it('uses 2 decimal places', () => {
    expect(formatFileSize(1536000)).toBe('1.46 MB');
    expect(formatFileSize(999999)).toBe('976.56 KB');
  });
});

describe('validateFile', () => {
  it('validates a valid file successfully', () => {
    const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });
    const result = validateFile(file);
    
    expect(result.valid).toBe(true);
    expect(result.error).toBe(null);
  });

  it('rejects invalid file type', () => {
    const file = new File(['content'], 'image.jpg', { type: 'image/jpeg' });
    const result = validateFile(file);
    
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid file type');
  });

  it('rejects oversized file', () => {
    const maxSize = 100;
    const content = 'x'.repeat(200);
    const file = new File([content], 'large.pdf', { type: 'application/pdf' });
    const result = validateFile(file, maxSize);
    
    expect(result.valid).toBe(false);
    expect(result.error).toContain('File size exceeds');
  });

  it('handles null file', () => {
    const result = validateFile(null);
    
    expect(result.valid).toBe(false);
    expect(result.error).toBe('No file provided');
  });

  it('uses default max size', () => {
    const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });
    const result = validateFile(file);
    
    expect(result.valid).toBe(true);
  });
});

describe('validateFiles', () => {
  const createValidFiles = (count) => {
    return Array.from({ length: count }, (_, i) => 
      new File(['content'], `file${i}.pdf`, { type: 'application/pdf' })
    );
  };

  it('validates multiple valid files successfully', () => {
    const files = createValidFiles(3);
    const result = validateFiles(files);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects when no files provided', () => {
    const result = validateFiles([]);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('At least one file is required');
  });

  it('rejects when too many files', () => {
    const files = createValidFiles(15);
    const result = validateFiles(files, { maxCount: 10 });
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Too many files'))).toBe(true);
  });

  it('rejects files with invalid types', () => {
    const files = [
      new File(['content'], 'valid.pdf', { type: 'application/pdf' }),
      new File(['content'], 'invalid.jpg', { type: 'image/jpeg' }),
    ];
    const result = validateFiles(files);
    
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('invalid.jpg'))).toBe(true);
  });

  it('rejects files exceeding size limit', () => {
    const maxSize = 100;
    const files = [
      new File(['x'.repeat(50)], 'small.pdf', { type: 'application/pdf' }),
      new File(['x'.repeat(200)], 'large.pdf', { type: 'application/pdf' }),
    ];
    const result = validateFiles(files, { maxSize });
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('large.pdf'))).toBe(true);
  });

  it('handles non-array input', () => {
    const result = validateFiles(null);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Files must be provided as an array');
  });

  it('uses default options when not specified', () => {
    const files = createValidFiles(5);
    const result = validateFiles(files);
    
    expect(result.valid).toBe(true);
  });

  it('includes file index and name in error messages', () => {
    const files = [
      new File(['content'], 'good.pdf', { type: 'application/pdf' }),
      new File(['content'], 'bad.exe', { type: 'application/x-msdownload' }),
    ];
    const result = validateFiles(files);
    
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('File 2') && e.includes('bad.exe'))).toBe(true);
  });
});

describe('getAcceptedFileExtensions', () => {
  it('returns comma-separated list of extensions', () => {
    const extensions = getAcceptedFileExtensions();
    
    expect(extensions).toContain('.pdf');
    expect(extensions).toContain('.doc');
    expect(extensions).toContain('.docx');
    expect(extensions).toContain('.txt');
    expect(extensions).toContain('.zip');
  });

  it('returns a string', () => {
    const extensions = getAcceptedFileExtensions();
    expect(typeof extensions).toBe('string');
  });

  it('can be used in input accept attribute', () => {
    const extensions = getAcceptedFileExtensions();
    // Should be comma-separated
    expect(extensions.includes(',')).toBe(true);
  });
});

describe('getAcceptedMimeTypes', () => {
  it('returns array of MIME types', () => {
    const mimeTypes = getAcceptedMimeTypes();
    
    expect(Array.isArray(mimeTypes)).toBe(true);
    expect(mimeTypes).toContain('application/pdf');
    expect(mimeTypes).toContain('application/msword');
    expect(mimeTypes).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(mimeTypes).toContain('text/plain');
    expect(mimeTypes).toContain('application/zip');
  });

  it('includes all expected MIME types', () => {
    const mimeTypes = getAcceptedMimeTypes();
    expect(mimeTypes.length).toBeGreaterThan(0);
  });
});

describe('Constants', () => {
  it('exports MAX_FILE_SIZE constant', () => {
    expect(MAX_FILE_SIZE).toBe(50 * 1024 * 1024);
  });

  it('exports MAX_FILE_COUNT constant', () => {
    expect(MAX_FILE_COUNT).toBe(10);
  });
});
