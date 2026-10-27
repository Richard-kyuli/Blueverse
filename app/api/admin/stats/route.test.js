import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

/**
 * Route-level tests for /api/admin/stats.
 *
 * The handler verifies the caller through authenticateAdmin, which means the
 * first profiles lookup is the caller's own row; everything after it is the
 * platform-wide data this endpoint aggregates.
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
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => mocks.client,
}));

function createQuery(scripted = {}) {
  const query = {
    select: () => query,
    eq: () => query,
    or: () => query,
    in: () => query,
    order: () => query,
    limit: () => query,
    range: () => query,
    update: () => query,
    insert: () => query,
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

const request = (token = 'valid-token') => ({
  headers: {
    get: (name) =>
      name.toLowerCase() === 'authorization' ? (token ? `Bearer ${token}` : null) : null,
  },
});

describe('GET /api/admin/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.client.from.mockReset();
    mocks.client.auth.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1' } },
      error: null,
    });
  });

  it('rejects a request with no bearer token before touching the database', async () => {
    const response = await GET(request(null));

    expect(response.status).toBe(401);
    expect(mocks.client.from).not.toHaveBeenCalled();
  });

  it('rejects a signed-in user who is not an administrator', async () => {
    scriptTables({
      profiles: [
        {
          maybeSingle: {
            data: { ...ADMIN, user_type: 'student' },
            error: null,
          },
        },
      ],
    });

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect((await response.json()).error).toMatch(/Administrator access required/);
  });

  it('aggregates platform totals and names the parties on each dispute', async () => {
    scriptTables({
      profiles: [
        { maybeSingle: { data: ADMIN, error: null } },
        {
          list: {
            data: [
              ADMIN,
              { id: 'student-1', full_name: 'Grace Student', user_type: 'student', is_active: true },
              { id: 'writer-1', full_name: 'Alan Writer', user_type: 'writer', is_verified: true },
            ],
            error: null,
          },
        },
      ],
      assignments: [
        {
          list: {
            data: [
              {
                id: 'assignment-1',
                title: 'Statistics Report',
                status: 'disputed',
                final_price: 300,
                student_id: 'student-1',
                assigned_writer_id: 'writer-1',
                created_at: '2026-10-20T10:00:00.000Z',
                updated_at: '2026-10-25T10:00:00.000Z',
              },
              {
                id: 'assignment-2',
                title: 'History Essay',
                status: 'completed',
                final_price: 200,
                student_id: 'student-1',
                assigned_writer_id: 'writer-1',
                created_at: '2026-10-10T10:00:00.000Z',
              },
            ],
            error: null,
          },
        },
      ],
      reviews: [{ list: { data: [{ rating: 5 }, { rating: 4 }], error: null } }],
    });

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stats.users).toMatchObject({ total: 3, students: 1, writers: 1, admins: 1 });
    expect(body.stats.assignments).toMatchObject({ disputed: 1, completed: 1 });
    expect(body.stats.money).toMatchObject({ released: 200, held: 300, platformRevenue: 30 });
    expect(body.stats.reviews).toEqual({ count: 2, average: 4.5 });

    expect(body.disputes).toHaveLength(1);
    expect(body.disputes[0]).toMatchObject({
      id: 'assignment-1',
      student_name: 'Grace Student',
      writer_name: 'Alan Writer',
    });
    expect(body.recentUsers).toHaveLength(3);
    // Newest first: assignment-1 was created 2026-10-20, assignment-2 on 2026-10-10
    expect(body.recentAssignments[0].title).toBe('Statistics Report');
  });

  it('reports a query failure instead of a half-filled summary', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    scriptTables({
      profiles: [
        { maybeSingle: { data: ADMIN, error: null } },
        { list: { data: null, error: { message: 'permission denied' } } },
      ],
    });

    const response = await GET(request());

    expect(response.status).toBe(500);
    expect((await response.json()).error).toMatch(/Could not load platform statistics/);

    consoleError.mockRestore();
  });
});
