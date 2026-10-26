import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from './route';
import { NextResponse } from 'next/server';

/**
 * Tests for POST /api/messages/read
 *
 * The receiver comes from the verified token, so one user can never clear
 * another user's unread badges.
 */

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({
      json: async () => data,
      status: options?.status || 200,
    })),
  },
}));

const mockSupabaseClient = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn(),
  },
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

describe('POST /api/messages/read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient.from.mockReset();

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'student-1' } },
      error: null,
    });
  });

  const createMockRequest = (body, token = 'test-access-token') => ({
    headers: {
      get: (name) =>
        name.toLowerCase() === 'authorization' ? (token ? `Bearer ${token}` : null) : null,
    },
    json: async () => {
      if (body === '__INVALID__') throw new Error('Unexpected token');
      return body;
    },
  });

  const selectSingle = (result) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  });

  const updateChain = (result, eqSpy = vi.fn()) => {
    const chain = {
      update: vi.fn(),
      eq: eqSpy,
      select: vi.fn().mockResolvedValue(result),
    };
    chain.update.mockReturnValue(chain);
    eqSpy.mockReturnValue(chain);
    return chain;
  };

  const assignment = {
    id: 'assignment-1',
    student_id: 'student-1',
    assigned_writer_id: 'writer-1',
  };

  it('returns 401 when the token is missing', async () => {
    await POST(createMockRequest({ assignmentId: 'assignment-1' }, null));

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Missing authorization token' }),
      expect.objectContaining({ status: 401 })
    );
  });

  it('returns 400 when assignmentId is missing', async () => {
    await POST(createMockRequest({}));

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'assignmentId is required' }),
      expect.objectContaining({ status: 400 })
    );
  });

  it('returns 403 when the caller is not a party of the assignment', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'stranger-1' } },
      error: null,
    });
    mockSupabaseClient.from.mockImplementation(() => selectSingle({ data: assignment, error: null }));

    await POST(createMockRequest({ assignmentId: 'assignment-1' }));

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'You are not part of this assignment' }),
      expect.objectContaining({ status: 403 })
    );
  });

  it('marks only the caller messages as read and reports the count', async () => {
    const eqSpy = vi.fn();
    const assignments = selectSingle({ data: assignment, error: null });
    const messages = updateChain({ data: [{ id: 'm1' }, { id: 'm2' }], error: null }, eqSpy);

    mockSupabaseClient.from.mockImplementation((table) =>
      table === 'assignments' ? assignments : messages
    );

    await POST(createMockRequest({ assignmentId: 'assignment-1' }));

    expect(eqSpy).toHaveBeenCalledWith('assignment_id', 'assignment-1');
    expect(eqSpy).toHaveBeenCalledWith('receiver_id', 'student-1');
    expect(eqSpy).toHaveBeenCalledWith('is_read', false);

    expect(NextResponse.json).toHaveBeenCalledWith(
      { success: true, markedRead: 2 },
      expect.objectContaining({ status: 200 })
    );
  });

  it('reports a database failure instead of pretending it worked', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const assignments = selectSingle({ data: assignment, error: null });
    const messages = updateChain({
      data: null,
      error: { code: '42501', message: 'permission denied for table messages' },
    });

    mockSupabaseClient.from.mockImplementation((table) =>
      table === 'assignments' ? assignments : messages
    );

    await POST(createMockRequest({ assignmentId: 'assignment-1' }));

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Failed to mark messages as read',
        details: 'permission denied for table messages',
      }),
      expect.objectContaining({ status: 500 })
    );

    consoleError.mockRestore();
  });

  it('returns 405 for GET', async () => {
    await GET();

    expect(NextResponse.json).toHaveBeenCalledWith(
      { error: 'Method not allowed' },
      expect.objectContaining({ status: 405 })
    );
  });
});
