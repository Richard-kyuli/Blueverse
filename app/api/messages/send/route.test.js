import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from './route';
import { NextResponse } from 'next/server';

/**
 * Tests for POST /api/messages/send
 *
 * Covers authentication, validation, party checks and receiver derivation.
 * The receiver is never taken from the request body.
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

// Notifications are written with the service-role client; assert on the call
// instead of replaying the insert.
const notifyMock = vi.hoisted(() => ({ sendNotification: vi.fn() }));

vi.mock('@/lib/notify', () => ({ sendNotification: notifyMock.sendNotification }));

describe('POST /api/messages/send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient.from.mockReset();

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'student-1' } },
      error: null,
    });

    notifyMock.sendNotification.mockResolvedValue({ success: true });
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

  /** select().eq().maybeSingle() */
  const selectSingle = (result) => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue(result),
    };
    return chain;
  };

  /** insert().select().single() */
  const insertSingle = (result) => {
    const chain = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue(result),
    };
    chain.insert.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    return chain;
  };

  const assignment = {
    id: 'assignment-1',
    title: 'Essay on Climate Policy',
    student_id: 'student-1',
    assigned_writer_id: 'writer-1',
  };

  /** Routes each table the route touches to its own scripted chain. */
  const routeTables = ({ assignments, messages, profile = { full_name: 'Grace Student' } }) => {
    const profiles = selectSingle({ data: profile, error: null });

    mockSupabaseClient.from.mockImplementation((table) => {
      if (table === 'assignments') return assignments;
      if (table === 'profiles') return profiles;
      return messages;
    });
  };

  it('returns 401 when the authorization header is missing', async () => {
    await POST(createMockRequest({ assignmentId: 'assignment-1', message: 'Hi' }, null));

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Missing authorization token' }),
      expect.objectContaining({ status: 401 })
    );
  });

  it('returns 401 when the access token is invalid', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid JWT' },
    });

    await POST(createMockRequest({ assignmentId: 'assignment-1', message: 'Hi' }));

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid or expired session. Please sign in again.' }),
      expect.objectContaining({ status: 401 })
    );
  });

  it('returns 400 for an unparsable body', async () => {
    await POST(createMockRequest('__INVALID__'));

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid JSON body' }),
      expect.objectContaining({ status: 400 })
    );
  });

  it('returns 400 when assignmentId is missing', async () => {
    await POST(createMockRequest({ message: 'Hi' }));

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'assignmentId is required' }),
      expect.objectContaining({ status: 400 })
    );
  });

  it('returns 400 for an empty or whitespace-only message', async () => {
    await POST(createMockRequest({ assignmentId: 'assignment-1', message: '   ' }));

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Message cannot be empty' }),
      expect.objectContaining({ status: 400 })
    );
  });

  it('returns 400 for a message longer than 2000 characters', async () => {
    await POST(createMockRequest({ assignmentId: 'assignment-1', message: 'x'.repeat(2001) }));

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Message must be 2000 characters or fewer' }),
      expect.objectContaining({ status: 400 })
    );
  });

  it('returns 404 when the assignment does not exist', async () => {
    mockSupabaseClient.from.mockImplementation(() => selectSingle({ data: null, error: null }));

    await POST(createMockRequest({ assignmentId: 'missing', message: 'Hi' }));

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Assignment not found' }),
      expect.objectContaining({ status: 404 })
    );
  });

  it('returns 403 when the caller is not a party of the assignment', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'stranger-1' } },
      error: null,
    });
    mockSupabaseClient.from.mockImplementation(() => selectSingle({ data: assignment, error: null }));

    await POST(createMockRequest({ assignmentId: 'assignment-1', message: 'Hi' }));

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'You are not part of this assignment' }),
      expect.objectContaining({ status: 403 })
    );
  });

  it('returns 409 when no writer has been assigned yet', async () => {
    mockSupabaseClient.from.mockImplementation(() =>
      selectSingle({ data: { ...assignment, assigned_writer_id: null }, error: null })
    );

    await POST(createMockRequest({ assignmentId: 'assignment-1', message: 'Hi' }));

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'No writer has been assigned to this assignment yet' }),
      expect.objectContaining({ status: 409 })
    );
  });

  it('creates the message for a student, deriving the receiver from the assignment', async () => {
    const created = {
      id: 'message-1',
      assignment_id: 'assignment-1',
      sender_id: 'student-1',
      receiver_id: 'writer-1',
      message: 'Could you add a conclusion?',
      is_read: false,
      created_at: '2026-01-01T00:00:00.000Z',
    };

    const assignments = selectSingle({ data: assignment, error: null });
    const messages = insertSingle({ data: created, error: null });

    routeTables({ assignments, messages });

    await POST(
      createMockRequest({ assignmentId: 'assignment-1', message: '  Could you add a conclusion?  ' })
    );

    expect(messages.insert).toHaveBeenCalledWith({
      assignment_id: 'assignment-1',
      sender_id: 'student-1',
      receiver_id: 'writer-1',
      message: 'Could you add a conclusion?',
    });

    expect(notifyMock.sendNotification).toHaveBeenCalledWith(
      mockSupabaseClient,
      expect.objectContaining({
        userId: 'writer-1',
        type: 'message_received',
        title: 'New message from Grace Student',
        link: '/dashboard/assignments/assignment-1/messages',
      })
    );

    expect(NextResponse.json).toHaveBeenCalledWith(
      { success: true, message: created },
      expect.objectContaining({ status: 201 })
    );
  });

  it('creates the message for the writer, addressing the student', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'writer-1' } },
      error: null,
    });

    const assignments = selectSingle({ data: assignment, error: null });
    const messages = insertSingle({
      data: {
        id: 'message-2',
        assignment_id: 'assignment-1',
        sender_id: 'writer-1',
        receiver_id: 'student-1',
        message: 'On it.',
        is_read: false,
        created_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    });

    routeTables({ assignments, messages });

    await POST(createMockRequest({ assignmentId: 'assignment-1', message: 'On it.' }));

    expect(messages.insert).toHaveBeenCalledWith(
      expect.objectContaining({ sender_id: 'writer-1', receiver_id: 'student-1' })
    );
  });

  it('ignores a receiver supplied by the client', async () => {
    const assignments = selectSingle({ data: assignment, error: null });
    const messages = insertSingle({ data: { id: 'message-3' }, error: null });

    routeTables({ assignments, messages });

    await POST(
      createMockRequest({
        assignmentId: 'assignment-1',
        message: 'Hi',
        receiverId: 'someone-else',
        senderId: 'someone-else',
      })
    );

    expect(messages.insert).toHaveBeenCalledWith(
      expect.objectContaining({ sender_id: 'student-1', receiver_id: 'writer-1' })
    );
  });

  it('returns 500 and exposes the database detail when the insert fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const assignments = selectSingle({ data: assignment, error: null });
    const messages = insertSingle({
      data: null,
      error: {
        code: '42501',
        message: 'new row violates row-level security policy for table "messages"',
        details: null,
        hint: null,
      },
    });

    routeTables({ assignments, messages });

    await POST(createMockRequest({ assignmentId: 'assignment-1', message: 'Hi' }));

    expect(NextResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Failed to send message',
        details: 'new row violates row-level security policy for table "messages"',
      }),
      expect.objectContaining({ status: 500 })
    );

    expect(consoleError).toHaveBeenCalledWith(
      'Failed to create message:',
      expect.objectContaining({ code: '42501' })
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
