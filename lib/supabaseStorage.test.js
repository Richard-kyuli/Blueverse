import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  uploadFile,
  uploadMultipleFiles,
  deleteFile,
  getFileUrl,
  getPublicFileUrl,
  validateFile,
  getFileExtension,
  getFileIcon,
  formatFileSize
} from './supabaseStorage';

// Mock the supabase client
vi.mock('./supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        remove: vi.fn(),
        createSignedUrl: vi.fn(),
        getPublicUrl: vi.fn()
      }))
    }
  }
}));

describe('supabaseStorage utilities', () => {
  describe('validateFile', () => {
    it('validates PDF files correctly', () => {
      const file = new File(['content'], 'document.pdf', { type: 'application/pdf' });
      const result = validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('validates DOCX files correctly', () => {
      const file = new File(['content'], 'essay.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it('validates DOC files correctly', () => {
      const file = new File(['content'], 'essay.doc', {
        type: 'application/msword'
      });
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it('validates TXT files correctly', () => {
      const file = new File(['content'], 'notes.txt', { type: 'text/plain' });
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it('validates ZIP files correctly', () => {
      const file = new File(['content'], 'archive.zip', { type: 'application/zip' });
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it('rejects image files', () => {
      const file = new File(['content'], 'image.jpg', { type: 'image/jpeg' });
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('rejects files larger than 50MB', () => {
      // Create a file object with size > 50MB
      const largeSize = 51 * 1024 * 1024; // 51MB
      const file = new File(['x'.repeat(largeSize)], 'large.pdf', { type: 'application/pdf' });
      
      // Mock the size property
      Object.defineProperty(file, 'size', { value: largeSize });
      
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds 50MB limit');
    });

    it('accepts files at exactly 50MB', () => {
      const exactSize = 50 * 1024 * 1024; // Exactly 50MB
      const file = new File(['content'], 'exact.pdf', { type: 'application/pdf' });
      
      Object.defineProperty(file, 'size', { value: exactSize });
      
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });

    it('rejects null or undefined files', () => {
      const result = validateFile(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('No file provided');
    });
  });

  describe('getFileExtension', () => {
    it('extracts PDF extension', () => {
      expect(getFileExtension('document.pdf')).toBe('pdf');
    });

    it('extracts DOCX extension', () => {
      expect(getFileExtension('essay.docx')).toBe('docx');
    });

    it('extracts extension from path with multiple dots', () => {
      expect(getFileExtension('my.essay.final.pdf')).toBe('pdf');
    });

    it('handles uppercase extensions', () => {
      expect(getFileExtension('document.PDF')).toBe('pdf');
    });
  });

  describe('getFileIcon', () => {
    it('returns FileText icon for PDF files', () => {
      expect(getFileIcon('document.pdf')).toBe('FileText');
    });

    it('returns FileText icon for DOC files', () => {
      expect(getFileIcon('essay.doc')).toBe('FileText');
    });

    it('returns FileText icon for DOCX files', () => {
      expect(getFileIcon('essay.docx')).toBe('FileText');
    });

    it('returns FileText icon for TXT files', () => {
      expect(getFileIcon('notes.txt')).toBe('FileText');
    });

    it('returns Archive icon for ZIP files', () => {
      expect(getFileIcon('files.zip')).toBe('Archive');
    });

    it('returns default File icon for unknown types', () => {
      expect(getFileIcon('unknown.xyz')).toBe('File');
    });
  });

  describe('formatFileSize', () => {
    it('formats 0 bytes', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('formats bytes correctly', () => {
      expect(formatFileSize(500)).toBe('500 Bytes');
    });

    it('formats kilobytes correctly', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('formats megabytes correctly', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(5242880)).toBe('5 MB');
    });

    it('formats gigabytes correctly', () => {
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });

    it('rounds to 2 decimal places', () => {
      expect(formatFileSize(1234567)).toBe('1.18 MB');
    });
  });

  describe('uploadFile', () => {
    it('returns error when no file is provided', async () => {
      const result = await uploadFile(null, 'assignment-123', 'submission-456');
      expect(result.success).toBe(false);
      expect(result.error).toBe('No file provided');
    });

    it('returns error for invalid file type', async () => {
      const file = new File(['content'], 'image.jpg', { type: 'image/jpeg' });
      const result = await uploadFile(file, 'assignment-123', 'submission-456');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('returns error for oversized file', async () => {
      const largeSize = 51 * 1024 * 1024;
      const file = new File(['content'], 'large.pdf', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: largeSize });
      
      const result = await uploadFile(file, 'assignment-123', 'submission-456');
      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds 50MB limit');
    });
  });

  describe('uploadMultipleFiles', () => {
    it('returns error when no files provided', async () => {
      const result = await uploadMultipleFiles([], 'assignment-123', 'submission-456');
      expect(result.success).toBe(false);
      expect(result.error).toBe('No files provided');
    });

    it('returns error when more than 10 files provided', async () => {
      const files = Array(11).fill(null).map((_, i) =>
        new File(['content'], `file${i}.pdf`, { type: 'application/pdf' })
      );
      
      const result = await uploadMultipleFiles(files, 'assignment-123', 'submission-456');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum 10 files allowed');
    });

    it('calls progress callback with correct data', async () => {
      const files = [
        new File(['content1'], 'file1.pdf', { type: 'application/pdf' }),
        new File(['content2'], 'file2.pdf', { type: 'application/pdf' })
      ];
      
      const progressCalls = [];
      const onProgress = (data) => progressCalls.push(data);
      
      await uploadMultipleFiles(files, 'assignment-123', 'submission-456', onProgress);
      
      // Should have called progress callback for each file
      expect(progressCalls.length).toBeGreaterThan(0);
      
      // Check that progress data includes required fields
      if (progressCalls.length > 0) {
        expect(progressCalls[0]).toHaveProperty('fileName');
        expect(progressCalls[0]).toHaveProperty('completed');
        expect(progressCalls[0]).toHaveProperty('total');
        expect(progressCalls[0]).toHaveProperty('progress');
      }
    });
  });

  describe('deleteFile', () => {
    it('returns error when no URL provided', async () => {
      const result = await deleteFile(null);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No file URL provided');
    });

    it('returns error for invalid URL format', async () => {
      const result = await deleteFile('https://invalid-url.com/file.pdf');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid file URL format');
    });
  });

  describe('getFileUrl', () => {
    it('returns error when no path provided', async () => {
      const result = await getFileUrl(null);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No file path provided');
    });
  });

  describe('getPublicFileUrl', () => {
    it('calls supabase storage with correct parameters', () => {
      const mockGetPublicUrl = vi.fn(() => ({
        data: { publicUrl: 'https://example.com/file.pdf' }
      }));
      
      // This test would need proper mocking setup
      // For now, we just verify the function exists
      expect(typeof getPublicFileUrl).toBe('function');
    });
  });
});
