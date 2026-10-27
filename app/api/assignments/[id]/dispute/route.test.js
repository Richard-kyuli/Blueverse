import { POST, GET } from './route';
import { NextResponse } from 'next/server';

/**
 * Tests for POST /api/assignments/[id]/dispute
 *
 * Covers the party check, the disputable-status gate, input validation, the
 * optimistic lock, the un-migrated-database fallback and the notification
 * fan-out to the counterpart and to active administrators.
 */

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({
      json: async () => data,
      status: options?.status || 200
    }))
  }
}));

const { mockSupabaseClient, mockSendNotification } = vi.hoisted(() => ({
  mockSupabaseClient: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn()
    }
  },
  mockSendNotification: vi.fn()
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}));

vi.mock('@/lib/notify', () => ({
  sendNotification: mockSendNotification
}));

describe('POST /api/assignments/[id]/dispute', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabaseClient.from.mockReset();
    mockSendNotification.mockReset();
    mockSendNotification.mockResolvedValue(undefined);

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    // Default: the request carries a valid token for the student.
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'student-123' } },
      error: null
    });
  });

  const createMockRequest = (body, token = 'test-access-token') => ({
    headers: {
      get: (name) =>
        name.toLowerCase() === 'authorization'
          ? token
            ? `Bearer ${token}`
            : null
          : null
    },
    json: async () => {
      if (body === '__INVALID__') {
        throw new Error('Unexpected token');
      }
      return body;
    }
  });

  /** select().eq().maybeSingle() */
  const selectMaybeSingle = (result) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result)
  });

  /** select().eq() - awaited directly, used for the admin list */
  const selectList = (result) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue(result)
  });

  /** update().eq().eq().select() */
  const updateChain = (
    result,
    updateSpy = vi.fn().mockReturnThis(),
    eqSpy = vi.fn().mockReturnThis()
  ) => ({
    update: updateSpy,
    eq: eqSpy,
    select: vi.fn().mockResolvedValue(result)
  });

  const assignment = {
    id: 'assignment-1',
    title: 'Cold War essay',
    student_id: 'student-123',
    assigned_writer_id: 'writer-456',
    status: 'in_progress'
  };

  const validBody = {
    category: 'not_delivered',
    details: 'The deadline passed three days ago and no draft has been uploaded yet.'
  };

  const admins = {
    data: [
      { id: 'admin-1', is_active: true },
      { id: 'admin-2', is_active: false }
    ],
    error: null
  };

  /** Wires the three queries a successful request performs, in order. */
  const arrange = ({
    lookup = { data: assignment, error: null },
    update = { data: [{ id: 'assignment-1', status: 'disputed' }], error: null },
    adminResult = admins
  } = {}) => {
    const updateSpy = vi.fn().mockReturnThis();
    const eqSpy = vi.fn().mockReturnThis();

    mockSupabaseClient.from
      .mockImplementationOnce(() => selectMaybeSingle(lookup))
      .mockImplementationOnce(() => updateChain(update, updateSpy, eqSpy))
      .mockImplementationOnce(() => selectList(adminResult));

    return { updateSpy, eqSpy };
  };

  const paramsFor = (id = 'assignment-1') => ({ params: { id } });

  it('rejects a request with no bearer token', async () => {
    const response = await POST(createMockRequest(validBody, null), paramsFor());

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe('Missing authorization token');
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired session', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } });

    const response = await POST(createMockRequest(validBody), paramsFor());

    expect(response.status).toBe(401);
    expect((await response.json()).error).toMatch(/sign in again/i);
  });

  it('requires an assignment id in the route params', async () => {
    const response = await POST(createMockRequest(validBody), { params: {} });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('An assignment id is required');
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('rejects a body that is not valid JSON', async () => {
    const response = await POST(createMockRequest('__INVALID__'), paramsFor());

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Invalid JSON body');
  });

  it('returns 404 when the assignment does not exist', async () => {
    mockSupabaseClient.from.mockImplementationOnce(() => selectMaybeSingle({ data: null, error: null }));

    const response = await POST(createMockRequest(validBody), paramsFor());

    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe('Assignment not found');
  });

  it('returns 500 when the assignment lookup fails', async () => {
    mockSupabaseClient.from.mockImplementationOnce(() =>
      selectMaybeSingle({ data: null, error: { message: 'connection reset' } })
    );

    const response = await POST(createMockRequest(validBody), paramsFor());

    expect(response.status).toBe(500);
    expect((await response.json()).details).toBe('connection reset');
  });

  it('refuses a user who is neither the student nor the assigned writer', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'stranger-999' } },
      error: null
    });
    arrange();

    const response = await POST(createMockRequest(validBody), paramsFor());

    expect(response.status).toBe(403);
    expect((await response.json()).error).toMatch(/only the student and the assigned writer/i);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('refuses to reopen an assignment that is already disputed', async () => {
    mockSupabaseClient.from.mockImplementationOnce(() =>
      selectMaybeSingle({ data: { ...assignment, status: 'disputed' }, error: null })
    );

    const response = await POST(createMockRequest(validBody), paramsFor());

    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe('This assignment is already in dispute');
  });

  it('refuses a completed assignment and points at support', async () => {
    mockSupabaseClient.from.mockImplementationOnce(() =>
      selectMaybeSingle({ data: { ...assignment, status: 'completed' }, error: null })
    );

    const response = await POST(createMockRequest(validBody), paramsFor());

    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/contact support/i);
  });

  it('describes the status when it cannot be disputed', async () => {
    mockSupabaseClient.from.mockImplementationOnce(() =>
      selectMaybeSingle({ data: { ...assignment, status: 'cancelled' }, error: null })
    );

    const response = await POST(createMockRequest(validBody), paramsFor());

    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe('An assignment that is cancelled cannot be disputed');
  });

  it('rejects an unknown dispute category', async () => {
    arrange();

    const response = await POST(
      createMockRequest({ ...validBody, category: 'made_up' }),
      paramsFor()
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Choose a reason for the dispute');
  });

  it('rejects details shorter than the minimum', async () => {
    arrange();

    const response = await POST(createMockRequest({ category: 'off_brief', details: 'not happy' }), paramsFor());

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/at least 20 characters/i);
  });

  it('opens the dispute for the student and notifies the writer and active admins', async () => {
    const { updateSpy, eqSpy } = arrange();

    const response = await POST(createMockRequest(validBody), paramsFor());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      assignmentId: 'assignment-1',
      status: 'disputed',
      role: 'student',
      storedReason: true
    });

    // The reason columns and the audit trail travel with the status change.
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'disputed',
        dispute_category: 'not_delivered',
        dispute_details: validBody.details,
        disputed_by: 'student-123',
        disputed_at: expect.any(String)
      })
    );

    // The write is locked on the status that was read, not the new one.
    expect(eqSpy).toHaveBeenCalledWith('status', 'in_progress');

    // Counterpart first, then only the active administrator.
    expect(mockSendNotification).toHaveBeenCalledTimes(2);
    expect(mockSendNotification).toHaveBeenNthCalledWith(
      1,
      mockSupabaseClient,
      expect.objectContaining({
        userId: 'writer-456',
        type: 'dispute_raised',
        title: 'A dispute was opened',
        link: '/dashboard/assignments/assignment-1'
      })
    );
    expect(mockSendNotification).toHaveBeenNthCalledWith(
      2,
      mockSupabaseClient,
      expect.objectContaining({
        userId: 'admin-1',
        type: 'dispute_raised',
        title: 'Dispute needs a decision',
        link: '/dashboard/admin/disputes'
      })
    );
  });

  it('notifies the student when the writer opens the dispute', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'writer-456' } },
      error: null
    });
    const { updateSpy } = arrange();

    const response = await POST(createMockRequest(validBody), paramsFor());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.role).toBe('writer');
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ disputed_by: 'writer-456' }));
    expect(mockSendNotification).toHaveBeenNthCalledWith(
      1,
      mockSupabaseClient,
      expect.objectContaining({ userId: 'student-123' })
    );
  });

  it('still opens the dispute when the reason columns are missing', async () => {
    mockSupabaseClient.from
      .mockImplementationOnce(() => selectMaybeSingle({ data: assignment, error: null }))
      .mockImplementationOnce(() =>
        updateChain({
          data: null,
          error: { code: '42703', message: 'column "dispute_category" does not exist' }
        })
      )
      .mockImplementationOnce(() =>
        updateChain({ data: [{ id: 'assignment-1', status: 'disputed' }], error: null })
      )
      .mockImplementationOnce(() => selectList(admins));

    const response = await POST(createMockRequest(validBody), paramsFor());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.storedReason).toBe(false);
    expect(body.message).toMatch(/could not be stored/i);
    expect(mockSendNotification).toHaveBeenCalledTimes(2);
  });

  it('retries with a bare status change after a missing-column error', async () => {
    const firstSpy = vi.fn().mockReturnThis();
    const retrySpy = vi.fn().mockReturnThis();

    mockSupabaseClient.from
      .mockImplementationOnce(() => selectMaybeSingle({ data: assignment, error: null }))
      .mockImplementationOnce(() =>
        updateChain({ data: null, error: { code: '42703', message: 'undefined column' } }, firstSpy)
      )
      .mockImplementationOnce(() =>
        updateChain({ data: [{ id: 'assignment-1', status: 'disputed' }], error: null }, retrySpy)
      )
      .mockImplementationOnce(() => selectList(admins));

    await POST(createMockRequest(validBody), paramsFor());

    expect(firstSpy).toHaveBeenCalledWith(expect.objectContaining({ dispute_category: 'not_delivered' }));
    expect(retrySpy).toHaveBeenCalledWith({ status: 'disputed' });
  });

  it('returns 409 when the status moved between read and write', async () => {
    arrange({ update: { data: [], error: null } });

    const response = await POST(createMockRequest(validBody), paramsFor());

    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/changed while you were raising it/i);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('returns 500 when the update itself fails', async () => {
    arrange({ update: { data: null, error: { code: '23514', message: 'check constraint violated' } } });

    const response = await POST(createMockRequest(validBody), paramsFor());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Could not open the dispute');
    expect(body.details).toBe('check constraint violated');
  });

  it('answers a GET with 405', async () => {
    const response = await GET();

    expect(response.status).toBe(405);
    expect((await response.json()).error).toMatch(/method not allowed/i);
  });
});
