import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import SubmissionForm from './SubmissionForm';
import { supabase } from '@/lib/supabase';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock FileUploader component
vi.mock('@/components/shared/FileUploader', () => ({
  default: ({ onFilesSelected }) => (
    <div data-testid="file-uploader">
      <button
        onClick={() => {
          const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
          onFilesSelected([mockFile]);
        }}
      >
        Select Files
      </button>
    </div>
  ),
}));

// Mock Supabase client - the form only uses auth.getSession()
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

describe('SubmissionForm', () => {
  const mockAssignment = {
    id: 'test-assignment-id',
    title: 'Test Assignment',
    subject: 'Computer Science',
    deadline: new Date('2024-12-31').toISOString(),
    status: 'assigned',
    budget_max: 100,
    final_price: 100,
  };

  const mockWriterId = 'test-writer-id';
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    global.confirm = vi.fn(() => true);

    // Valid session by default so submissions can be attempted
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-access-token' } },
      error: null,
    });
  });

  it('renders the assignment details header', () => {
    render(
      <SubmissionForm
        assignment={mockAssignment}
        writerId={mockWriterId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Test Assignment')).toBeInTheDocument();
    expect(screen.getByText('Computer Science')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
  });

  it('renders the FileUploader component', () => {
    render(
      <SubmissionForm
        assignment={mockAssignment}
        writerId={mockWriterId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('file-uploader')).toBeInTheDocument();
  });

  it('renders submission notes textarea', () => {
    render(
      <SubmissionForm
        assignment={mockAssignment}
        writerId={mockWriterId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const textarea = screen.getByPlaceholderText(/I've completed the essay/i);
    expect(textarea).toBeInTheDocument();
  });

  it('disables submit button when no files are selected', () => {
    render(
      <SubmissionForm
        assignment={mockAssignment}
        writerId={mockWriterId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const submitButton = screen.getByRole('button', { name: /Submit Work/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when files are selected', async () => {
    const user = userEvent.setup();
    
    render(
      <SubmissionForm
        assignment={mockAssignment}
        writerId={mockWriterId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    // Select files using the mocked FileUploader
    const selectFilesButton = screen.getByText('Select Files');
    await user.click(selectFilesButton);

    const submitButton = screen.getByRole('button', { name: /Submit Work/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('calls API endpoint with correct data on form submission', async () => {
    const user = userEvent.setup();
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        submissionId: 'test-submission-id',
        message: 'Success',
      }),
    });

    render(
      <SubmissionForm
        assignment={mockAssignment}
        writerId={mockWriterId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    // Select files
    const selectFilesButton = screen.getByText('Select Files');
    await user.click(selectFilesButton);

    // Add submission notes
    const textarea = screen.getByPlaceholderText(/I've completed the essay/i);
    await user.type(textarea, 'Test submission notes');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /Submit Work/i });
    await user.click(submitButton);

    // Wait for API call
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/submissions/submit',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
    });
  });

  it('displays error message when submission fails', async () => {
    const user = userEvent.setup();
    const toast = await import('react-hot-toast');
    
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: 'Submission failed',
      }),
    });

    render(
      <SubmissionForm
        assignment={mockAssignment}
        writerId={mockWriterId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    // Select files
    const selectFilesButton = screen.getByText('Select Files');
    await user.click(selectFilesButton);

    // Submit form
    const submitButton = screen.getByRole('button', { name: /Submit Work/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Submission failed');
    });
  });

  it('calls onSuccess callback after successful submission', async () => {
    const user = userEvent.setup();
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        submissionId: 'test-submission-id',
        message: 'Success',
      }),
    });

    render(
      <SubmissionForm
        assignment={mockAssignment}
        writerId={mockWriterId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    // Select files
    const selectFilesButton = screen.getByText('Select Files');
    await user.click(selectFilesButton);

    // Submit form
    const submitButton = screen.getByRole('button', { name: /Submit Work/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith('test-submission-id');
    }, { timeout: 2000 });
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <SubmissionForm
        assignment={mockAssignment}
        writerId={mockWriterId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('shows confirmation dialog when canceling with unsaved changes', async () => {
    const user = userEvent.setup();
    global.confirm = vi.fn(() => false); // User cancels
    
    render(
      <SubmissionForm
        assignment={mockAssignment}
        writerId={mockWriterId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    // Make changes
    const textarea = screen.getByPlaceholderText(/I've completed the essay/i);
    await user.type(textarea, 'Some notes');

    // Try to cancel
    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    expect(global.confirm).toHaveBeenCalledWith(
      'You have unsaved changes. Are you sure you want to cancel?'
    );
    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it('displays upload progress bars during submission', async () => {
    const user = userEvent.setup();
    
    // Mock a delayed response to see progress bars
    global.fetch.mockImplementationOnce(() =>
      new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              ok: true,
              json: async () => ({
                success: true,
                submissionId: 'test-submission-id',
                message: 'Success',
              }),
            }),
          100
        )
      )
    );

    render(
      <SubmissionForm
        assignment={mockAssignment}
        writerId={mockWriterId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    // Select files
    const selectFilesButton = screen.getByText('Select Files');
    await user.click(selectFilesButton);

    // Submit form
    const submitButton = screen.getByRole('button', { name: /Submit Work/i });
    await user.click(submitButton);

    // Check for progress indicator
    await waitFor(() => {
      expect(screen.getByText(/Uploading files.../i)).toBeInTheDocument();
    });
  });

  it('disables buttons during upload', async () => {
    const user = userEvent.setup();
    
    // Mock a delayed response
    global.fetch.mockImplementationOnce(() =>
      new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              ok: true,
              json: async () => ({
                success: true,
                submissionId: 'test-submission-id',
                message: 'Success',
              }),
            }),
          100
        )
      )
    );

    render(
      <SubmissionForm
        assignment={mockAssignment}
        writerId={mockWriterId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    // Select files
    const selectFilesButton = screen.getByText('Select Files');
    await user.click(selectFilesButton);

    // Submit form
    const submitButton = screen.getByRole('button', { name: /Submit Work/i });
    await user.click(submitButton);

    // Check that buttons are disabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Uploading.../i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
    });
  });
});
