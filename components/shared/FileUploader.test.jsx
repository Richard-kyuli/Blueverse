import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileUploader from './FileUploader';

// Helper to create mock files
const createMockFile = (name, size, type) => {
  const file = new File(['a'.repeat(size)], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('FileUploader Component', () => {
  let mockOnFilesSelected;

  beforeEach(() => {
    mockOnFilesSelected = vi.fn();
  });

  describe('Rendering', () => {
    it('renders upload zone with correct text', () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);

      expect(screen.getByText(/Drag and drop files here/i)).toBeInTheDocument();
      expect(screen.getByText(/or click to browse/i)).toBeInTheDocument();
      expect(screen.getByText(/Accepted: PDF, DOC, DOCX, TXT, ZIP/i)).toBeInTheDocument();
    });

    it('has accessible attributes', () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);

      const uploadZone = screen.getByRole('button', { name: /File upload area/i });
      expect(uploadZone).toBeInTheDocument();
      expect(uploadZone).toHaveAttribute('tabIndex', '0');
    });

    it('displays file count limits', () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} maxFiles={5} />);
      
      expect(screen.getByText(/Up to 5 files/i)).toBeInTheDocument();
    });
  });

  describe('File Selection via Click', () => {
    it('opens file browser when upload zone is clicked', () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
      
      const uploadZone = screen.getByRole('button', { name: /File upload area/i });
      const fileInput = uploadZone.querySelector('input[type="file"]');
      
      const clickSpy = vi.fn();
      fileInput.click = clickSpy;
      
      fireEvent.click(uploadZone);
      
      expect(clickSpy).toHaveBeenCalled();
    });

    it('calls onFilesSelected with valid files', async () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
      
      const fileInput = document.querySelector('input[type="file"]');
      const validFile = createMockFile('document.pdf', 1024, 'application/pdf');
      
      fireEvent.change(fileInput, { target: { files: [validFile] } });
      
      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalledWith([validFile]);
      });
    });

    it('handles multiple file selection', async () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} multiple={true} />);
      
      const fileInput = document.querySelector('input[type="file"]');
      const file1 = createMockFile('doc1.pdf', 1024, 'application/pdf');
      const file2 = createMockFile('doc2.docx', 2048, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      
      fireEvent.change(fileInput, { target: { files: [file1, file2] } });
      
      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalledWith([file1, file2]);
      });
    });
  });

  describe('File Validation', () => {
    it('accepts valid PDF files', async () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
      
      const fileInput = document.querySelector('input[type="file"]');
      const validFile = createMockFile('document.pdf', 1024, 'application/pdf');
      
      fireEvent.change(fileInput, { target: { files: [validFile] } });
      
      await waitFor(() => {
        expect(screen.getByText(/document.pdf/i)).toBeInTheDocument();
      });
    });

    it('accepts valid DOCX files', async () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
      
      const fileInput = document.querySelector('input[type="file"]');
      const validFile = createMockFile('essay.docx', 2048, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      
      fireEvent.change(fileInput, { target: { files: [validFile] } });
      
      await waitFor(() => {
        expect(screen.getByText(/essay.docx/i)).toBeInTheDocument();
      });
    });

    it('accepts valid ZIP files', async () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
      
      const fileInput = document.querySelector('input[type="file"]');
      const validFile = createMockFile('archive.zip', 5120, 'application/zip');
      
      fireEvent.change(fileInput, { target: { files: [validFile] } });
      
      await waitFor(() => {
        expect(screen.getByText(/archive.zip/i)).toBeInTheDocument();
      });
    });

    it('rejects files exceeding size limit', async () => {
      const maxSize = 10 * 1024; // 10KB
      render(<FileUploader onFilesSelected={mockOnFilesSelected} maxFileSize={maxSize} />);
      
      const fileInput = document.querySelector('input[type="file"]');
      const largeFile = createMockFile('large.pdf', 20 * 1024, 'application/pdf');
      
      fireEvent.change(fileInput, { target: { files: [largeFile] } });
      
      await waitFor(() => {
        expect(screen.getByText(/File size exceeds maximum limit/i)).toBeInTheDocument();
      });
      
      expect(mockOnFilesSelected).not.toHaveBeenCalled();
    });

    it('rejects invalid file types', async () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
      
      const fileInput = document.querySelector('input[type="file"]');
      const invalidFile = createMockFile('image.jpg', 1024, 'image/jpeg');
      
      fireEvent.change(fileInput, { target: { files: [invalidFile] } });
      
      await waitFor(() => {
        expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
      });
      
      expect(mockOnFilesSelected).not.toHaveBeenCalled();
    });

    it('enforces maximum file count', async () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} maxFiles={2} />);
      
      const fileInput = document.querySelector('input[type="file"]');
      
      // Add first 2 files
      const file1 = createMockFile('doc1.pdf', 1024, 'application/pdf');
      const file2 = createMockFile('doc2.pdf', 1024, 'application/pdf');
      fireEvent.change(fileInput, { target: { files: [file1, file2] } });
      
      await waitFor(() => {
        expect(screen.getByText(/doc1.pdf/i)).toBeInTheDocument();
      });
      
      // Try to add third file
      const file3 = createMockFile('doc3.pdf', 1024, 'application/pdf');
      fireEvent.change(fileInput, { target: { files: [file3] } });
      
      await waitFor(() => {
        expect(screen.getByText(/Maximum 2 files allowed/i)).toBeInTheDocument();
      });
    });

    it('prevents duplicate file names', async () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
      
      const fileInput = document.querySelector('input[type="file"]');
      const file1 = createMockFile('document.pdf', 1024, 'application/pdf');
      
      // Add file first time
      fireEvent.change(fileInput, { target: { files: [file1] } });
      
      await waitFor(() => {
        expect(screen.getByText(/document.pdf/i)).toBeInTheDocument();
      });
      
      // Try to add same file again
      const file2 = createMockFile('document.pdf', 2048, 'application/pdf');
      fireEvent.change(fileInput, { target: { files: [file2] } });
      
      await waitFor(() => {
        expect(screen.getByText(/File already added/i)).toBeInTheDocument();
      });
    });
  });

  describe('File Display and Icons', () => {
    it('displays selected files with correct information', async () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
      
      const fileInput = document.querySelector('input[type="file"]');
      const file = createMockFile('document.pdf', 2048, 'application/pdf');
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
        expect(screen.getByText('2.00 KB')).toBeInTheDocument();
      });
    });

    it('shows file count', async () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
      
      const fileInput = document.querySelector('input[type="file"]');
      const file1 = createMockFile('doc1.pdf', 1024, 'application/pdf');
      const file2 = createMockFile('doc2.pdf', 1024, 'application/pdf');
      
      fireEvent.change(fileInput, { target: { files: [file1, file2] } });
      
      await waitFor(() => {
        expect(screen.getByText(/Selected Files \(2\/10\)/i)).toBeInTheDocument();
      });
    });
  });

  describe('File Removal', () => {
    it('removes file when remove button is clicked', async () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
      
      const fileInput = document.querySelector('input[type="file"]');
      const file = createMockFile('document.pdf', 1024, 'application/pdf');
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });
      
      const removeButton = screen.getByLabelText(/Remove document.pdf/i);
      fireEvent.click(removeButton);
      
      await waitFor(() => {
        expect(screen.queryByText('document.pdf')).not.toBeInTheDocument();
      });
      
      // Should call onFilesSelected with empty array
      expect(mockOnFilesSelected).toHaveBeenLastCalledWith([]);
    });

    it('removes correct file when multiple files exist', async () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
      
      const fileInput = document.querySelector('input[type="file"]');
      const file1 = createMockFile('doc1.pdf', 1024, 'application/pdf');
      const file2 = createMockFile('doc2.pdf', 1024, 'application/pdf');
      
      fireEvent.change(fileInput, { target: { files: [file1, file2] } });
      
      await waitFor(() => {
        expect(screen.getByText('doc1.pdf')).toBeInTheDocument();
        expect(screen.getByText('doc2.pdf')).toBeInTheDocument();
      });
      
      // Remove first file
      const removeButton = screen.getByLabelText(/Remove doc1.pdf/i);
      fireEvent.click(removeButton);
      
      await waitFor(() => {
        expect(screen.queryByText('doc1.pdf')).not.toBeInTheDocument();
        expect(screen.getByText('doc2.pdf')).toBeInTheDocument();
      });
    });
  });

  describe('Drag and Drop', () => {
    it('shows hover state during drag over', () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
      
      const uploadZone = screen.getByRole('button', { name: /File upload area/i });
      
      fireEvent.dragOver(uploadZone);
      
      expect(screen.getByText('Drop files here')).toBeInTheDocument();
    });

    it('removes hover state on drag leave', () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
      
      const uploadZone = screen.getByRole('button', { name: /File upload area/i });
      
      fireEvent.dragOver(uploadZone);
      expect(screen.getByText('Drop files here')).toBeInTheDocument();
      
      fireEvent.dragLeave(uploadZone);
      expect(screen.getByText('Drag and drop files here')).toBeInTheDocument();
    });

    it('handles file drop', async () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
      
      const uploadZone = screen.getByRole('button', { name: /File upload area/i });
      const file = createMockFile('dropped.pdf', 1024, 'application/pdf');
      
      fireEvent.drop(uploadZone, {
        dataTransfer: {
          files: [file],
        },
      });
      
      await waitFor(() => {
        expect(screen.getByText('dropped.pdf')).toBeInTheDocument();
      });
      
      expect(mockOnFilesSelected).toHaveBeenCalledWith([file]);
    });
  });

  describe('Keyboard Navigation', () => {
    it('opens file browser on Enter key', () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
      
      const uploadZone = screen.getByRole('button', { name: /File upload area/i });
      const fileInput = uploadZone.querySelector('input[type="file"]');
      
      const clickSpy = vi.fn();
      fileInput.click = clickSpy;
      
      fireEvent.keyDown(uploadZone, { key: 'Enter' });
      
      expect(clickSpy).toHaveBeenCalled();
    });

    it('opens file browser on Space key', () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
      
      const uploadZone = screen.getByRole('button', { name: /File upload area/i });
      const fileInput = uploadZone.querySelector('input[type="file"]');
      
      const clickSpy = vi.fn();
      fileInput.click = clickSpy;
      
      fireEvent.keyDown(uploadZone, { key: ' ' });
      
      expect(clickSpy).toHaveBeenCalled();
    });

    it('removes file on Enter key on remove button', async () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
      
      const fileInput = document.querySelector('input[type="file"]');
      const file = createMockFile('document.pdf', 1024, 'application/pdf');
      
      fireEvent.change(fileInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });
      
      const removeButton = screen.getByLabelText(/Remove document.pdf/i);
      fireEvent.keyDown(removeButton, { key: 'Enter' });
      
      await waitFor(() => {
        expect(screen.queryByText('document.pdf')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Display', () => {
    it('displays validation errors', async () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
      
      const fileInput = document.querySelector('input[type="file"]');
      const invalidFile = createMockFile('image.png', 1024, 'image/png');
      
      fireEvent.change(fileInput, { target: { files: [invalidFile] } });
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/Upload Error/i)).toBeInTheDocument();
      });
    });

    it('clears errors when file is removed', async () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
      
      const fileInput = document.querySelector('input[type="file"]');
      const validFile = createMockFile('document.pdf', 1024, 'application/pdf');
      const invalidFile = createMockFile('image.png', 1024, 'image/png');
      
      // Add invalid file first (shows error)
      fireEvent.change(fileInput, { target: { files: [invalidFile] } });
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
      
      // Add valid file
      fireEvent.change(fileInput, { target: { files: [validFile] } });
      
      await waitFor(() => {
        expect(screen.getByText('document.pdf')).toBeInTheDocument();
      });
      
      // Remove the valid file
      const removeButton = screen.getByLabelText(/Remove document.pdf/i);
      fireEvent.click(removeButton);
      
      // Errors should be cleared
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty file drop', () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} />);
      
      const uploadZone = screen.getByRole('button', { name: /File upload area/i });
      
      fireEvent.drop(uploadZone, {
        dataTransfer: {
          files: [],
        },
      });
      
      expect(mockOnFilesSelected).not.toHaveBeenCalled();
    });

    it('handles single file mode correctly', async () => {
      render(<FileUploader onFilesSelected={mockOnFilesSelected} multiple={false} />);
      
      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).not.toHaveAttribute('multiple');
      
      const file1 = createMockFile('doc1.pdf', 1024, 'application/pdf');
      const file2 = createMockFile('doc2.pdf', 1024, 'application/pdf');
      
      fireEvent.change(fileInput, { target: { files: [file1, file2] } });
      
      await waitFor(() => {
        // Should only show the second file (replaces first)
        expect(screen.queryByText('doc1.pdf')).not.toBeInTheDocument();
        expect(screen.getByText('doc2.pdf')).toBeInTheDocument();
      });
    });
  });
});
