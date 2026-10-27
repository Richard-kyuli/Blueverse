import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

/**
 * Route-level tests for /api/admin/revenue.
 *
 * The first profiles read in every request is authenticateAdmin resolving the
 * caller, so the queues below start there and then serve the report's reads.
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

const ADMIN = { id: 'admin-1', user_type: 'admin', is_active: true, full_name: 'Richard' };

function request(token) {
  return new Request('http://localhost/api/admin/revenue', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

async function respond(response) {
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.auth.getUser.mockResolvedValue({ data: { user: { id: ADMIN.id } }, error: null });
});

describe('GET /api/admin/revenue', () => {
  it('refuses a request without a token', async () => {
    const { status } = await respond(await GET(request(null)));
    expect(status).toBe(401);
    expect(mocks.client.from).not.toHaveBeenCalled();
  });

  it('refuses a student', async () => {
    scriptTables({ profiles: [{ data: { id: 'u1', user_type: 'student' }, error: null }] });

    const { status, body } = await respond(await GET(request('token')));
    expect(status).toBe(403);
    expect(body.error).toMatch(/administrator access required/i);
  });

  it('returns the derived money report', async () => {
    scriptTables({
      profiles: [
        { data: ADMIN, error: null },
        {
          data: [
            { id: 'w1', full_name: 'Grace Writer', email: 'grace@example.com', user_type: 'writer' },
          ],
          error: null,
        },
      ],
      assignments: [
        {
          data: [
            {
              id: 'a1',
              status: 'completed',
              final_price: 100,
              assigned_writer_id: 'w1',
              created_at: '2026-10-10T10:00:00.000Z',
              completed_at: '2026-10-20T10:00:00.000Z',
            },
            { id: 'a2', status: 'disputed', final_price: 40 },
          ],
          error: null,
        },
      ],
    });

    const { status, body } = await respond(await GET(request('token')));

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.totals).toMatchObject({
      released: 100,
      held: 40,
      platformRevenue: 15,
      writerPayouts: 85,
      completed: 1,
      disputed: 1,
    });
    expect(body.monthly).toHaveLength(6);
    expect(body.topWriters[0]).toMatchObject({ id: 'w1', name: 'Grace Writer', earnings: 85 });
    expect(typeof body.generatedAt).toBe('string');
  });

  it('reports a query failure as 500 rather than an empty report', async () => {
    scriptTables({
      profiles: [{ data: ADMIN, error: null }, { data: [], error: null }],
      assignments: [{ data: null, error: { message: 'connection reset' } }],
    });

    const { status, body } = await respond(await GET(request('token')));
    expect(status).toBe(500);
    expect(body.error).toMatch(/could not load the revenue report/i);
    expect(body.details).toBe('connection reset');
  });
});
