import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from './route';
import { NextResponse } from 'next/server';

/**
 * Integration tests for Submission API endpoint
 * 
 * Tests the POST /api/submissions/submit endpoint
 * Requirements: US-W1.1, US-W1.2, US-W1.6, FR-2
 */

// Mock Next.js NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({
      json: async () => data,
      status: options?.status || 200
    }))
  }
}));

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn()
  },
  storage: {
    from: vi.fn()
  }
};

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}));

// Mock supabaseStorage helpers
vi.mock('@/lib/supabaseStorage', () => ({
  uploadMultipleFiles: vi.fn()
}));

// Import after mocking
import { createClient } from '@supabase/supabase-js';
import { uploadMultipleFiles } from '@/lib/supabaseStorage';

describe('POST /api/submissions/submit', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Drop any queued return values left over from previous tests
    mockSupabaseClient.from.mockReset();
    mockSupabaseClient.storage.from.mockReset();
    
    // Reset environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    // Default: the request carries a valid token for writer-123
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'writer-123' } },
      error: null
    });
  });

  /**
   * Helper function to create mock FormData
   */
  const createMockFormData = (data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((file, index) => {
          formData.append(`file_${index}`, file);
        });
      } else {
        formData.append(key, value);
      }
    });
    return formData;
  };

  /**
   * Helper to create mock request
   */
  const createMockRequest = (formData, token = 'test-access-token') => ({
    headers: {
      get: (name) =>
        name.toLowerCase() === 'authorization'
          ? (token ? `Bearer ${token}` : null)
          : null
    },
    formData: async () => formData
  });

  /**
   * Helper to create mock file
   */
  const createMockFile = (name, type = 'application/pdf') => {
    return new File(['content'], name, { type });
  };

  describe('Validation tests', () => {
    it('should return 400 when assignmentId is missing', async () => {
      const formData = createMockFormData({
        writerId: 'writer-123',
        files: [createMockFile('test.pdf')]
      });
      const request = createMockRequest(formData);

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('assignmentId is required')
        }),
        expect.objectContaining({ status: 400 })
      );
    });

    it('should return 401 when the authorization header is missing', async () => {
      const formData = createMockFormData({
        assignmentId: 'assignment-123',
        files: [createMockFile('test.pdf')]
      });
      const request = createMockRequest(formData, null);

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Missing authorization token'
        }),
        expect.objectContaining({ status: 401 })
      );
    });

    it('should return 401 when the access token is invalid', async () => {
      const formData = createMockFormData({
        assignmentId: 'assignment-123',
        files: [createMockFile('test.pdf')]
      });
      const request = createMockRequest(formData);

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'invalid JWT' }
      });

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Invalid or expired session')
        }),
        expect.objectContaining({ status: 401 })
      );
    });

    it('should return 403 when writerId does not match the authenticated user', async () => {
      const formData = createMockFormData({
        assignmentId: 'assignment-123',
        writerId: 'someone-else',
        files: [createMockFile('test.pdf')]
      });
      const request = createMockRequest(formData);

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'writerId does not match the authenticated user'
        }),
        expect.objectContaining({ status: 403 })
      );
    });

    it('should return 400 when no files are provided', async () => {
      const formData = createMockFormData({
        assignmentId: 'assignment-123',
        writerId: 'writer-123',
        submissionText: 'Test submission'
      });
      const request = createMockRequest(formData);

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'At least one file is required for submission'
        }),
        expect.objectContaining({ status: 400 })
      );
    });

    it('should return 404 when assignment does not exist', async () => {
      const formData = createMockFormData({
        assignmentId: 'nonexistent-assignment',
        writerId: 'writer-123',
        files: [createMockFile('test.pdf')]
      });
      const request = createMockRequest(formData);

      // Mock assignment not found
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Assignment not found' }
        })
      });

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Assignment not found'
        }),
        expect.objectContaining({ status: 404 })
      );
    });

    it('should return 403 when writer is not assigned to assignment', async () => {
      const formData = createMockFormData({
        assignmentId: 'assignment-123',
        writerId: 'wrong-writer-id',
        files: [createMockFile('test.pdf')]
      });
      const request = createMockRequest(formData);

      // The authenticated user matches the body but is not the assigned writer
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'wrong-writer-id' } },
        error: null
      });

      // Mock assignment with different writer
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'assignment-123',
            status: 'assigned',
            assigned_writer_id: 'correct-writer-id',
            student_id: 'student-123'
          },
          error: null
        })
      });

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'You are not authorized to submit work for this assignment'
        }),
        expect.objectContaining({ status: 403 })
      );
    });

    it('should return 400 when assignment status is not valid', async () => {
      const formData = createMockFormData({
        assignmentId: 'assignment-123',
        writerId: 'writer-123',
        files: [createMockFile('test.pdf')]
      });
      const request = createMockRequest(formData);

      // Mock assignment with invalid status
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'assignment-123',
            status: 'completed', // Invalid status for submission
            assigned_writer_id: 'writer-123',
            student_id: 'student-123'
          },
          error: null
        })
      });

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("Cannot submit work for assignment with status: completed")
        }),
        expect.objectContaining({ status: 400 })
      );
    });

    it('should return 400 when there is already a submission under review', async () => {
      const formData = createMockFormData({
        assignmentId: 'assignment-123',
        writerId: 'writer-123',
        files: [createMockFile('test.pdf')]
      });
      const request = createMockRequest(formData);

      // Mock valid assignment
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'assignment-123',
            status: 'in_progress',
            assigned_writer_id: 'writer-123',
            student_id: 'student-123'
          },
          error: null
        })
      });

      // Mock existing submission under review
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve) => resolve({
          data: [{ id: 'existing-submission', status: 'submitted' }],
          error: null
        })
      });

      await POST(request);

      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Cannot submit while a previous submission is under review'
        }),
        expect.objectContaining({ status: 400 })
      );
    });
  });

  describe('Successful submission tests', () => {
    it('should create submission and upload files successfully', async () => {
      const formData = createMockFormData({
        assignmentId: 'assignment-123',
        writerId: 'writer-123',
        submissionText: 'Test submission notes',
        files: [
          createMockFile('essay.pdf'),
          createMockFile('sources.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        ]
      });
      const request = createMockRequest(formData);

      // Mock assignment query - valid assignment
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'assignment-123',
            title: 'Essay on Climate Policy',
            status: 'assigned',
            assigned_writer_id: 'writer-123',
            student_id: 'student-123'
          },
          error: null
        })
      });

      // Mock check for existing submissions - none found
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve) => resolve({
          data: [],
          error: null
        })
      });

      // Mock count submissions - this is the first submission
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve) => resolve({
          count: 0,
          error: null
        })
      });

      // Mock find parent submission - none
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null
        })
      });

      // Mock submission creation
      const mockSubmissionId = 'submission-456';
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: mockSubmissionId,
            assignment_id: 'assignment-123',
            writer_id: 'writer-123',
            submission_text: 'Test submission notes',
            status: 'submitted',
            revision_number: 1
          },
          error: null
        })
      });

      // Mock file upload success
      uploadMultipleFiles.mockResolvedValue({
        success: true,
        uploadedUrls: [
          'https://example.com/submissions/assignment-123/submission-456/essay.pdf',
          'https://example.com/submissions/assignment-123/submission-456/sources.docx'
        ],
        uploadedPaths: [
          'assignment-123/submission-456/essay.pdf',
          'assignment-123/submission-456/sources.docx'
        ]
      });

      // Mock update submission with file URLs
      mockSupabaseClient.from.mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null
        })
      });

      // Mock update assignment status
      mockSupabaseClient.from.mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          error: null
        })
      });

      // Mock notification insert for the student
      const notificationInsert = vi.fn().mockResolvedValue({ error: null });
      mockSupabaseClient.from.mockReturnValueOnce({ insert: notificationInsert });

      await POST(request);

      // Verify successful response
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          submissionId: mockSubmissionId,
          filePaths: expect.arrayContaining([
            expect.stringContaining('essay.pdf'),
            expect.stringContaining('sources.docx')
          ]),
          revisionNumber: 1,
          message: expect.stringContaining('submitted successfully')
        }),
        expect.objectContaining({ status: 201 })
      );

      // Verify uploadMultipleFiles was called with the service-role client
      expect(uploadMultipleFiles).toHaveBeenCalledWith(
        expect.any(Array),
        'assignment-123',
        mockSubmissionId,
        null,
        mockSupabaseClient
      );

      // Verify the student was told there is work waiting for review
      expect(notificationInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'student-123',
          type: 'submission_created',
          is_read: false,
          link: '/dashboard/assignments/assignment-123'
        })
      );
    });
  });

  describe('Error handling and rollback tests', () => {
    it('should rollback submission when file upload fails', async () => {
      const formData = createMockFormData({
        assignmentId: 'assignment-123',
        writerId: 'writer-123',
        files: [createMockFile('test.pdf')]
      });
      const request = createMockRequest(formData);

      // Mock valid assignment
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'assignment-123',
            status: 'assigned',
            assigned_writer_id: 'writer-123',
            student_id: 'student-123'
          },
          error: null
        })
      });

      // Mock check for existing submissions
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve) => resolve({ data: [], error: null })
      });

      // Mock count and parent submission queries
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve) => resolve({ count: 0, error: null })
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
        });

      // Mock submission creation
      const mockSubmissionId = 'submission-456';
      mockSupabaseClient.from.mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: mockSubmissionId },
          error: null
        })
      });

      // Mock file upload failure
      uploadMultipleFiles.mockResolvedValue({
        success: false,
        error: 'Failed to upload files',
        failedFiles: ['test.pdf']
      });

      // Mock rollback delete
      const mockDelete = vi.fn().mockResolvedValue({ error: null });
      mockSupabaseClient.from.mockReturnValueOnce({
        delete: vi.fn().mockReturnThis(),
        eq: mockDelete
      });

      await POST(request);

      // Verify rollback was called
      expect(mockDelete).toHaveBeenCalled();

      // Verify error response
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Failed to upload files')
        }),
        expect.objectContaining({ status: 500 })
      );
    });
  });

  describe('Revision number tracking', () => {
    it('should set revision number to 1 for first submission', async () => {
      const formData = createMockFormData({
        assignmentId: 'assignment-123',
        writerId: 'writer-123',
        files: [createMockFile('test.pdf')]
      });
      const request = createMockRequest(formData);

      // Setup mocks for a successful submission
      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'assignment-123',
              title: 'Essay on Climate Policy',
              status: 'assigned',
              assigned_writer_id: 'writer-123',
              student_id: 'student-123'
            },
            error: null
          })
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve) => resolve({ data: [], error: null })
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve) => resolve({ count: 0, error: null })
        })
        .mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
        })
        .mockReturnValueOnce({
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'submission-456' }, error: null })
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null })
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null })
        })
        .mockReturnValueOnce({
          insert: vi.fn().mockResolvedValue({ error: null })
        });

      uploadMultipleFiles.mockResolvedValue({
        success: true,
        uploadedUrls: ['https://example.com/submissions/assignment-123/submission-456/test.pdf'],
        uploadedPaths: ['assignment-123/submission-456/test.pdf']
      });

      await POST(request);

      // Verify revision number is 1
      expect(NextResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          revisionNumber: 1
        }),
        expect.any(Object)
      );
    });
  });
});

describe('GET /api/submissions/submit', () => {
  it('should return 405 Method Not Allowed', async () => {
    await GET();

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Method not allowed. Use POST to submit work.'
      }),
      expect.objectContaining({ status: 405 })
    );
  });
});
