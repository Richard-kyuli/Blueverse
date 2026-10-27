import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

/**
 * Route-level tests for /api/admin/users/[id].
 *
 * Every request starts with authenticateAdmin reading the caller's profile, so
 * each profiles queue begins with the admin row.
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

function createQuery(result = {}) {
  const query = {
    select: () => query,
    eq: () => query,
    or: () => query,
    in: () => query,
    order: () => query,
    limit: () => query,
    range: () => query,
    maybeSingle: async () => result,
    single: async () => result,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

function scriptTables(responses) {
  const queues = Object.fromEntries(
    Object.entries(responses).map(([table, entries]) => [table, [...entries]])
  );

  mocks.client.from.mockImplementation((table) => createQuery((queues[table] || []).shift() || {}));
}

const ADMIN = { id: 'admin-1', user_type: 'admin', is_active: true };

const WRITER = {
  id: 'user-1',
  full_name: 'Grace Writer',
  email: 'grace@example.com',
  user_type: 'writer',
  avatar_url: 'https://example.com/a.png',
  bio: 'I write about climate policy and statistics.',
  expertise: ['Economics'],
  rating: 4.5,
  completed_assignments: 1,
  is_verified: true,
  is_active: true,
};

const COMPLETED_WORK = {
  id: 'a1',
  title: 'Climate Policy Essay',
  subject: 'Politics',
  status: 'completed',
  final_price: 100,
  student_id: 'student-1',
  assigned_writer_id: 'user-1',
  created_at: '2026-10-10T10:00:00.000Z',
  completed_at: '2026-10-20T10:00:00.000Z',
};

function request(token) {
  return new Request('http://localhost/api/admin/users/user-1', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function callParams(id = 'user-1') {
  return { params: { id } };
}

async function respond(response) {
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.auth.getUser.mockResolvedValue({ data: { user: { id: ADMIN.id } }, error: null });
});

describe('GET /api/admin/users/[id]', () => {
  it('refuses a request without a token', async () => {
    const { status } = await respond(await GET(request(null), callParams()));
    expect(status).toBe(401);
    expect(mocks.client.from).not.toHaveBeenCalled();
  });

  it('requires a user id', async () => {
    scriptTables({ profiles: [{ data: ADMIN, error: null }] });

    const { status, body } = await respond(await GET(request('token'), { params: {} }));
    expect(status).toBe(400);
    expect(body.error).toMatch(/user id is required/i);
  });

  it('returns 404 for an account that does not exist', async () => {
    scriptTables({
      profiles: [{ data: ADMIN, error: null }, { data: null, error: null }],
    });

    const { status, body } = await respond(await GET(request('token'), callParams()));
    expect(status).toBe(404);
    expect(body.error).toMatch(/user not found/i);
  });

  it('returns the account footprint with resolved counterparts', async () => {
    scriptTables({
      profiles: [
        { data: ADMIN, error: null },
        { data: WRITER, error: null },
        { data: [{ id: 'student-1', full_name: 'Ada Student', email: 'ada@example.com' }], error: null },
      ],
      assignments: [
        { data: [], error: null },
        { data: [COMPLETED_WORK], error: null },
      ],
      bids: [
        {
          data: [
            {
              id: 'b1',
              assignment_id: 'a1',
              status: 'accepted',
              proposed_price: 100,
              created_at: '2026-10-09T10:00:00.000Z',
            },
          ],
          error: null,
        },
      ],
      reviews: [
        {
          data: [
            { id: 'r1', rating: 5, reviewer_id: 'student-1', review_type: 'student_to_writer', created_at: '2026-10-21T10:00:00.000Z' },
          ],
          error: null,
        },
      ],
      submissions: [
        {
          data: [
            { id: 's1', assignment_id: 'a1', status: 'approved', revision_number: 2, created_at: '2026-10-19T10:00:00.000Z' },
          ],
          error: null,
        },
      ],
    });

    const { status, body } = await respond(await GET(request('token'), callParams()));

    expect(status).toBe(200);
    expect(body.user.email).toBe('grace@example.com');
    expect(body.summary.asWriter).toEqual({ awarded: 1, completed: 1, disputed: 0, earned: 85 });
    expect(body.summary.asStudent).toEqual({ posted: 0, completed: 0, disputed: 0, spent: 0 });
    expect(body.summary.bids).toMatchObject({ total: 1, accepted: 1, winRate: 100 });
    expect(body.summary.reviews).toEqual({ received: 1, average: 5, lowRatings: 0 });
    expect(body.summary.submissions).toMatchObject({ total: 1, approved: 1 });

    expect(body.signals.ready).toBe(true);
    expect(body.asWriter[0].counterpart_name).toBe('Ada Student');
    expect(body.bids[0].assignment_title).toBe('Climate Policy Essay');
    expect(body.reviews[0].reviewer_name).toBe('Ada Student');
    expect(body.submissions[0].assignment_title).toBe('Climate Policy Essay');
    expect(body.submissionsAvailable).toBe(true);
  });

  it('still renders when the submissions table was never created', async () => {
    scriptTables({
      profiles: [
        { data: ADMIN, error: null },
        { data: WRITER, error: null },
        { data: [{ id: 'student-1', full_name: 'Ada Student' }], error: null },
      ],
      assignments: [
        { data: [], error: null },
        { data: [COMPLETED_WORK], error: null },
      ],
      bids: [{ data: [], error: null }],
      reviews: [{ data: [], error: null }],
      submissions: [{ data: null, error: { code: '42P01', message: 'relation does not exist' } }],
    });

    const { status, body } = await respond(await GET(request('token'), callParams()));

    expect(status).toBe(200);
    expect(body.submissionsAvailable).toBe(false);
    expect(body.submissions).toEqual([]);
    expect(body.summary.asWriter.earned).toBe(85);
  });

  it('reports a failed activity query as 500', async () => {
    scriptTables({
      profiles: [{ data: ADMIN, error: null }, { data: WRITER, error: null }],
      assignments: [
        { data: [], error: null },
        { data: null, error: { message: 'timeout' } },
      ],
      bids: [{ data: [], error: null }],
      reviews: [{ data: [], error: null }],
      submissions: [{ data: [], error: null }],
    });

    const { status, body } = await respond(await GET(request('token'), callParams()));
    expect(status).toBe(500);
    expect(body.error).toMatch(/could not load this account activity/i);
    expect(body.details).toBe('timeout');
  });
});
