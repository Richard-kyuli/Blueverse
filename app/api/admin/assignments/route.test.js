import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH } from './route';

/**
 * Route-level tests for /api/admin/assignments.
 *
 * The GET handler enriches a page of assignments with two flat lookups
 * (profiles for the parties, bids for the counts) rather than nested embeds, so
 * the queues below run assignments, profiles, then bids.
 */

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({
      json: async () => data,
      status: options?.status || 200,
    })),
  },
}));

const mocks = vi.hoisted(() => ({
  client: { from: vi.fn(), auth: { getUser: vi.fn() } },
  sendNotification: vi.fn(),
  updates: [],
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => mocks.client,
}));

vi.mock('@/lib/notify', () => ({ sendNotification: mocks.sendNotification }));

function createQuery(scripted = {}) {
  const query = {
    select: () => query,
    eq: () => query,
    or: () => query,
    in: () => query,
    order: () => query,
    limit: () => query,
    range: () => query,
    insert: () => query,
    update: (payload) => {
      mocks.updates.push(payload);
      return query;
    },
    maybeSingle: async () => scripted.maybeSingle || { data: null, error: null },
    single: async () => scripted.single || { data: null, error: null },
    then: (resolve, reject) =>
      Promise.resolve(scripted.list || { data: [], error: null, count: 0 }).then(resolve, reject),
  };

  return query;
}

function scriptTables(responses) {
  const queues = Object.fromEntries(
    Object.entries(responses).map(([table, entries]) => [table, [...entries]])
  );

  mocks.client.from.mockImplementation((table) => createQuery((queues[table] || []).shift() || {}));
}

const ADMIN = { id: 'admin-1', full_name: 'Ada Admin', user_type: 'admin', is_active: true };

const DISPUTED = {
  id: 'assignment-1',
  title: 'Statistics Report',
  subject: 'Statistics',
  status: 'disputed',
  final_price: 300,
  student_id: 'student-1',
  assigned_writer_id: 'writer-1',
  created_at: '2026-10-20T10:00:00.000Z',
  updated_at: '2026-10-25T10:00:00.000Z',
};

const headers = (token = 'valid-token') => ({
  get: (name) =>
    name.toLowerCase() === 'authorization' ? (token ? `Bearer ${token}` : null) : null,
});

const getRequest = (query = '') => ({
  url: `http://localhost:3000/api/admin/assignments${query}`,
  headers: headers(),
});

const patchRequest = (body) => ({ headers: headers(), json: async () => body });

describe('GET /api/admin/assignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.client.from.mockReset();
    mocks.updates = [];
    mocks.client.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
  });

  it('rejects an unknown status filter', async () => {
    scriptTables({ profiles: [{ maybeSingle: { data: ADMIN, error: null } }] });

    const response = await GET(getRequest('?status=exploded'));

    expect(response.status).toBe(400);
  });

  it('attaches the parties and the bid summary to each row', async () => {
    scriptTables({
      profiles: [
        { maybeSingle: { data: ADMIN, error: null } },
        {
          list: {
            data: [
              { id: 'student-1', full_name: 'Grace Student', email: 'grace@example.com' },
              { id: 'writer-1', full_name: 'Alan Writer', email: 'alan@example.com' },
            ],
            error: null,
          },
        },
      ],
      assignments: [{ list: { data: [DISPUTED], error: null, count: 1 } }],
      bids: [
        {
          list: {
            data: [
              { assignment_id: 'assignment-1', status: 'accepted', proposed_price: 300 },
              { assignment_id: 'assignment-1', status: 'rejected', proposed_price: 280 },
            ],
            error: null,
          },
        },
      ],
    });

    const response = await GET(getRequest('?status=disputed'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.assignments[0]).toMatchObject({
      id: 'assignment-1',
      student_name: 'Grace Student',
      writer_name: 'Alan Writer',
      bid_count: 2,
      accepted_bid_price: 300,
    });
    expect(body).toMatchObject({ page: 1, total: 1, totalPages: 1 });
  });

  it('skips the enrichment queries when the page is empty', async () => {
    scriptTables({
      profiles: [{ maybeSingle: { data: ADMIN, error: null } }],
      assignments: [{ list: { data: [], error: null, count: 0 } }],
    });

    const response = await GET(getRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.assignments).toEqual([]);
    // authenticateAdmin reads profiles; no further profiles or bids lookup runs
    expect(mocks.client.from).toHaveBeenCalledTimes(2);
  });
});

describe('PATCH /api/admin/assignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.client.from.mockReset();
    mocks.updates = [];
    mocks.client.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
    mocks.sendNotification.mockResolvedValue({ success: true });
  });

  it('refuses to release an assignment that is not disputed', async () => {
    scriptTables({
      profiles: [{ maybeSingle: { data: ADMIN, error: null } }],
      assignments: [{ maybeSingle: { data: { ...DISPUTED, status: 'under_review' }, error: null } }],
    });

    const response = await PATCH(patchRequest({ assignmentId: 'assignment-1', action: 'release' }));

    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/Only a disputed assignment/);
    expect(mocks.updates).toHaveLength(0);
  });

  it('refuses to reopen a closed assignment', async () => {
    scriptTables({
      profiles: [{ maybeSingle: { data: ADMIN, error: null } }],
      assignments: [{ maybeSingle: { data: { ...DISPUTED, status: 'completed' }, error: null } }],
    });

    const response = await PATCH(patchRequest({ assignmentId: 'assignment-1', action: 'cancel' }));

    expect(response.status).toBe(409);
  });

  it('releases a disputed payment and refreshes the writer counters', async () => {
    const completed = { ...DISPUTED, status: 'completed', completed_at: '2026-10-27T12:00:00.000Z' };

    scriptTables({
      profiles: [{ maybeSingle: { data: ADMIN, error: null } }, { list: { error: null } }],
      assignments: [
        { maybeSingle: { data: DISPUTED, error: null } },
        { single: { data: completed, error: null } },
        { list: { count: 7, error: null } },
      ],
    });

    const response = await PATCH(patchRequest({ assignmentId: 'assignment-1', action: 'release' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.assignment).toMatchObject({ id: 'assignment-1', status: 'completed' });

    expect(mocks.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'completed' }),
        { completed_assignments: 7 },
      ])
    );
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      mocks.client,
      expect.objectContaining({
        userId: 'writer-1',
        type: 'dispute_resolved',
        title: 'Dispute resolved in your favour',
      })
    );
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      mocks.client,
      expect.objectContaining({ userId: 'student-1', type: 'dispute_resolved' })
    );
  });

  it('cancels an open assignment and tells both sides', async () => {
    const cancelled = { ...DISPUTED, status: 'cancelled' };

    scriptTables({
      profiles: [{ maybeSingle: { data: ADMIN, error: null } }],
      assignments: [
        { maybeSingle: { data: { ...DISPUTED, status: 'in_progress' }, error: null } },
        { single: { data: cancelled, error: null } },
      ],
    });

    const response = await PATCH(patchRequest({ assignmentId: 'assignment-1', action: 'cancel' }));

    expect(response.status).toBe(200);
    expect(mocks.updates).toContainEqual({ status: 'cancelled' });
    expect(mocks.sendNotification).toHaveBeenCalledTimes(2);
  });
});
