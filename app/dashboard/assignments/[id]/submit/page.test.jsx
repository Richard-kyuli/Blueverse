import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock dependencies BEFORE importing component
vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockSupabase = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/components/dashboard/DashboardLayout', () => ({
  default: ({ children }) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/components/submissions/SubmissionForm', () => ({
  default: ({ assignment, writerId, onSuccess, onCancel }) => (
    <div data-testid="submission-form">
      <div>Assignment: {assignment.title}</div>
      <div>Writer: {writerId}</div>
      <button onClick={() => onSuccess('test-submission-id')}>Submit</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

// Now import after mocks are set up
const { useParams, useRouter } = await import('next/navigation');
const { useAuth } = await import('@/contexts/AuthContext');
const toast = (await import('react-hot-toast')).default;
const SubmissionPage = (await import('./page')).default;

describe('SubmissionPage', () => {
  const mockPush = vi.fn();
  const mockProfile = {
    id: 'writer-123',
    role: 'writer',
  };

  const mockAssignment = {
    id: 'assignment-123',
    title: 'Test Assignment',
    subject: 'Mathematics',
    status: 'assigned',
    assigned_writer_id: 'writer-123',
    deadline: '2024-12-31T23:59:59Z',
    final_price: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useParams.mockReturnValue({ id: 'assignment-123' });
    useRouter.mockReturnValue({ push: mockPush });
    useAuth.mockReturnValue({ profile: mockProfile });
  });

  describe('Authorization Checks', () => {
    it('allows assigned writer to access submission page', async () => {
      // Mock successful assignment fetch
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockAssignment,
              error: null,
            }),
          }),
        }),
      });

      // Mock no existing submissions
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      render(<SubmissionPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submission-form')).toBeInTheDocument();
      });

      expect(screen.getByText('Assignment: Test Assignment')).toBeInTheDocument();
      expect(screen.getByText('Writer: writer-123')).toBeInTheDocument();
    });

    it('blocks non-assigned writer from submitting', async () => {
      // Mock assignment with different writer
      const assignmentWithDifferentWriter = {
        ...mockAssignment,
        assigned_writer_id: 'different-writer-456',
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: assignmentWithDifferentWriter,
              error: null,
            }),
          }),
        }),
      });

      render(<SubmissionPage />);

      await waitFor(() => {
        expect(screen.getByText('Access Denied')).toBeInTheDocument();
      });

      expect(toast.error).toHaveBeenCalledWith(
        'You are not authorized to submit work for this assignment'
      );
    });

    it('blocks submission for invalid assignment status', async () => {
      // Mock assignment with completed status
      const completedAssignment = {
        ...mockAssignment,
        status: 'completed',
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: completedAssignment,
              error: null,
            }),
          }),
        }),
      });

      render(<SubmissionPage />);

      await waitFor(() => {
        expect(screen.getByText(/Cannot submit work for assignment with status/)).toBeInTheDocument();
      });
    });

    it('blocks submission when submission is already under review', async () => {
      // Mock assignment fetch
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockAssignment,
              error: null,
            }),
          }),
        }),
      });

      // Mock existing submission under review
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [{ id: 'submission-123', status: 'submitted' }],
          error: null,
        }),
      });

      render(<SubmissionPage />);

      await waitFor(() => {
        expect(screen.getByText(/already have a submission under review/)).toBeInTheDocument();
      });

      expect(toast.error).toHaveBeenCalledWith(
        'Cannot submit while previous submission is under review'
      );
    });
  });

  describe('Loading States', () => {
    it('shows loading spinner while fetching assignment', () => {
      // Mock slow loading
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockReturnValue(
              new Promise(() => {}) // Never resolves
            ),
          }),
        }),
      });

      render(<SubmissionPage />);

      expect(screen.getByText('Loading assignment details...')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('shows error when assignment not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      });

      render(<SubmissionPage />);

      await waitFor(() => {
        expect(screen.getByText('Assignment not found')).toBeInTheDocument();
      });

      expect(toast.error).toHaveBeenCalledWith('Assignment not found');
    });
  });

  describe('Navigation', () => {
    it('redirects to assignment detail on cancel', async () => {
      // Mock successful assignment fetch
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockAssignment,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      render(<SubmissionPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submission-form')).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('Cancel');
      cancelButton.click();

      expect(mockPush).toHaveBeenCalledWith('/dashboard/assignments/assignment-123');
    });

    it('redirects to assignment detail on successful submission', async () => {
      // Mock successful assignment fetch
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockAssignment,
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      render(<SubmissionPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submission-form')).toBeInTheDocument();
      });

      const submitButton = screen.getByText('Submit');
      submitButton.click();

      expect(mockPush).toHaveBeenCalledWith('/dashboard/assignments/assignment-123');
    });
  });

  describe('Valid Assignment Statuses', () => {
    it('allows submission for assigned status', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockAssignment, status: 'assigned' },
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      render(<SubmissionPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submission-form')).toBeInTheDocument();
      });
    });

    it('allows submission for in_progress status', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockAssignment, status: 'in_progress' },
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      render(<SubmissionPage />);

      await waitFor(() => {
        expect(screen.getByTestId('submission-form')).toBeInTheDocument();
      });
    });

    it('blocks submission for completed status', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { ...mockAssignment, status: 'completed' },
              error: null,
            }),
          }),
        }),
      });

      render(<SubmissionPage />);

      await waitFor(() => {
        expect(screen.getByText(/Cannot submit work for assignment with status/)).toBeInTheDocument();
      });
    });
  });
});
