import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from './route';
import { NextResponse } from 'next/server';

/**
 * Tests for POST /api/submissions/review
 *
 * Covers authorization, validation, optimistic-locking guards and both
 * outcomes (approve -> completed, revision -> in_progress).
 */

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({
      json: async () => data,
      status: options?.status || 200
    }))
  }
}));

const mockSupabaseClient = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn()
  },
  storage: {
    from: vi.fn()
  }
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}));

describe('POST /api/submissions/review', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabaseClient.from.mockReset();
    mockSupabaseClient.storage.from.mockReset();

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    // Default: the request carries a valid token for the student
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'student-123' } },
      error: null
    });
  });

  const createMockRequest = (body, token = 'test-access-token') => ({
    headers: {
      get: (name) =>
        name.toLowerCase() === 'authorization'
          ? (token ? `Bearer ${token}` : null)
          : null
    },
    json: async () => {
      if (body === '__INVALID__') {
        throw new Error('Unexpected token');
      }
      return body;
    }
  });

  /** select().eq().single() */
  const selectSingle = (result) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result)
  });

  /** update().eq().eq().select() */
  const updateChain = (result, updateSpy = vi.fn().mockReturnThis()) => ({
    update: updateSpy,
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue(result)
  });

  /** insert() - awaited directly, so a resolved value is enough */
  const insertChain = (result = { error: null }, insertSpy = vi.fn().mockResolvedValue(result)) => ({
    insert: insertSpy
  });

  const mockSubmission = {
    id: 'submission-1',
    assignment_id: 'assignment-1',
    writer_id: 'writer-123',
    status: 'submitted',
    revision_number: 1
  };

  const mockAssignment = {
    id: 'assignment-1',
    title: 'Essay on Climate Policy',
    student_id: 'student-123',
    status: 'under_review',
    assigned_writer_id: 'writer-123'
  };

  describe('Authentication and validation', () => {
    it('returns 401 when the authorization header is missing', async () => {
      const request = createMockRequest({ submissionId: 'submission-1', action: 'approve' }, null);

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Missing authorization token' }),
        expect.objectContaining({ status: 401 })
      );
    });

    it('returns 401 when the access token is invalid', async () => {
      const request = createMockRequest({ submissionId: 'submission-1', action: 'approve' });

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'invalid JWT' }
      });

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Invalid or expired session') }),
        expect.objectContaining({ status: 401 })
      );
    });

    it('returns 400 when the body is not valid JSON', async () => {
      const request = createMockRequest('__INVALID__');

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid JSON body' }),
        expect.objectContaining({ status: 400 })
      );
    });

    it('returns 400 when required fields are missing', async () => {
      const request = createMockRequest({ action: 'approve' });

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Missing required fields') }),
        expect.objectContaining({ status: 400 })
      );
    });

    it('returns 400 for an unsupported action', async () => {
      const request = createMockRequest({ submissionId: 'submission-1', action: 'delete' });

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("'approve' or 'revision'") }),
        expect.objectContaining({ status: 400 })
      );
    });

    it('returns 400 when a revision is requested without feedback', async () => {
      const request = createMockRequest({ submissionId: 'submission-1', action: 'revision', feedback: '   ' });

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Feedback is required') }),
        expect.objectContaining({ status: 400 })
      );
    });
  });

  describe('Authorization', () => {
    it('returns 404 when the submission does not exist', async () => {
      const request = createMockRequest({ submissionId: 'missing', action: 'approve' });

      mockSupabaseClient.from.mockReturnValueOnce(
        selectSingle({ data: null, error: { message: 'No rows' } })
      );

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Submission not found' }),
        expect.objectContaining({ status: 404 })
      );
    });

    it('returns 403 when the caller is not the assignment owner', async () => {
      const request = createMockRequest({ submissionId: 'submission-1', action: 'approve' });

      mockSupabaseClient.from
        .mockReturnValueOnce(selectSingle({ data: mockSubmission, error: null }))
        .mockReturnValueOnce(
          selectSingle({ data: { ...mockAssignment, student_id: 'other-student' }, error: null })
        );

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'You are not authorized to review this submission' }),
        expect.objectContaining({ status: 403 })
      );
    });

    it('returns 403 when studentId does not match the authenticated user', async () => {
      const request = createMockRequest({
        submissionId: 'submission-1',
        action: 'approve',
        studentId: 'someone-else'
      });

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'studentId does not match the authenticated user' }),
        expect.objectContaining({ status: 403 })
      );
    });
  });

  describe('State guards', () => {
    it('returns 409 when the submission was already reviewed', async () => {
      const request = createMockRequest({ submissionId: 'submission-1', action: 'approve' });

      mockSupabaseClient.from
        .mockReturnValueOnce(
          selectSingle({ data: { ...mockSubmission, status: 'approved' }, error: null })
        )
        .mockReturnValueOnce(selectSingle({ data: mockAssignment, error: null }));

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('already been reviewed') }),
        expect.objectContaining({ status: 409 })
      );
    });

    it('returns 409 when the assignment is not under review', async () => {
      const request = createMockRequest({ submissionId: 'submission-1', action: 'approve' });

      mockSupabaseClient.from
        .mockReturnValueOnce(selectSingle({ data: mockSubmission, error: null }))
        .mockReturnValueOnce(
          selectSingle({ data: { ...mockAssignment, status: 'in_progress' }, error: null })
        );

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('not awaiting review') }),
        expect.objectContaining({ status: 409 })
      );
    });

    it('returns 409 when the submission is reviewed concurrently', async () => {
      const request = createMockRequest({ submissionId: 'submission-1', action: 'approve' });

      mockSupabaseClient.from
        .mockReturnValueOnce(selectSingle({ data: mockSubmission, error: null }))
        .mockReturnValueOnce(selectSingle({ data: mockAssignment, error: null }))
        .mockReturnValueOnce(updateChain({ data: [], error: null }));

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('already reviewed') }),
        expect.objectContaining({ status: 409 })
      );
    });
  });

  describe('Successful review', () => {
    it('approves the submission and completes the assignment', async () => {
      const request = createMockRequest({
        submissionId: 'submission-1',
        action: 'approve',
        feedback: 'Great work'
      });

      const submissionUpdate = vi.fn().mockReturnThis();
      const assignmentUpdate = vi.fn().mockReturnThis();
      const notificationInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from
        .mockReturnValueOnce(selectSingle({ data: mockSubmission, error: null }))
        .mockReturnValueOnce(selectSingle({ data: mockAssignment, error: null }))
        .mockReturnValueOnce(updateChain({ data: [{ id: 'submission-1' }], error: null }, submissionUpdate))
        .mockReturnValueOnce(updateChain({ data: [{ id: 'assignment-1' }], error: null }, assignmentUpdate))
        .mockReturnValueOnce(insertChain({ error: null }, notificationInsert));

      await POST(request);

      expect(submissionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved', student_feedback: 'Great work' })
      );
      expect(assignmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' })
      );
      expect(notificationInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'writer-123',
          type: 'work_approved',
          is_read: false
        })
      );
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          action: 'approve',
          assignmentStatus: 'completed'
        }),
        expect.objectContaining({ status: 200 })
      );
    });

    it('requests a revision and returns the assignment to in_progress', async () => {
      const request = createMockRequest({
        submissionId: 'submission-1',
        action: 'revision',
        feedback: 'Please add a conclusion'
      });

      const submissionUpdate = vi.fn().mockReturnThis();
      const assignmentUpdate = vi.fn().mockReturnThis();
      const notificationInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from
        .mockReturnValueOnce(selectSingle({ data: mockSubmission, error: null }))
        .mockReturnValueOnce(selectSingle({ data: mockAssignment, error: null }))
        .mockReturnValueOnce(updateChain({ data: [{ id: 'submission-1' }], error: null }, submissionUpdate))
        .mockReturnValueOnce(updateChain({ data: [{ id: 'assignment-1' }], error: null }, assignmentUpdate))
        .mockReturnValueOnce(insertChain({ error: null }, notificationInsert));

      await POST(request);

      expect(submissionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'revision_requested',
          student_feedback: 'Please add a conclusion',
          revision_notes: 'Please add a conclusion'
        })
      );
      expect(assignmentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'in_progress' })
      );
      expect(notificationInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'writer-123',
          type: 'revision_requested',
          message: expect.stringContaining('Please add a conclusion'),
          link: '/dashboard/assignments/assignment-1/submit'
        })
      );
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          action: 'revision',
          assignmentStatus: 'in_progress'
        }),
        expect.objectContaining({ status: 200 })
      );
    });

    it('still succeeds when the notification cannot be created', async () => {
      const request = createMockRequest({
        submissionId: 'submission-1',
        action: 'approve'
      });

      mockSupabaseClient.from
        .mockReturnValueOnce(selectSingle({ data: mockSubmission, error: null }))
        .mockReturnValueOnce(selectSingle({ data: mockAssignment, error: null }))
        .mockReturnValueOnce(updateChain({ data: [{ id: 'submission-1' }], error: null }))
        .mockReturnValueOnce(updateChain({ data: [{ id: 'assignment-1' }], error: null }))
        .mockReturnValueOnce(insertChain({ error: { message: 'permission denied' } }));

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, assignmentStatus: 'completed' }),
        expect.objectContaining({ status: 200 })
      );
    });
  });
});

describe('GET /api/submissions/review', () => {
  it('returns 405 Method Not Allowed', async () => {
    await GET();

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Method not allowed. Use POST to review a submission.'
      }),
      expect.objectContaining({ status: 405 })
    );
  });
});
