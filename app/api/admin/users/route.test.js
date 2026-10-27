import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH } from './route';

/**
 * Route-level tests for /api/admin/users.
 *
 * The first profiles lookup in every request is authenticateAdmin reading the
 * caller; the queues below start from there.
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

const ADMIN = { id: 'admin-1', full_name: 'Ada Admin', email: 'ada@example.com', user_type: 'admin', is_active: true };

const STUDENT = {
  id: 'student-1',
  full_name: 'Grace Student',
  email: 'grace@example.com',
  user_type: 'student',
  is_active: true,
  is_verified: false,
  rating: 4.5,
  completed_assignments: 2,
  created_at: '2026-10-01T10:00:00.000Z',
};

const headers = (token = 'valid-token') => ({
  get: (name) =>
    name.toLowerCase() === 'authorization' ? (token ? `Bearer ${token}` : null) : null,
});

const getRequest = (query = '') => ({
  url: `http://localhost:3000/api/admin/users${query}`,
  headers: headers(),
});

const patchRequest = (body) => ({
  headers: headers(),
  json: async () => body,
});

describe('GET /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.client.from.mockReset();
    mocks.updates = [];
    mocks.client.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
    mocks.sendNotification.mockResolvedValue({ success: true });
  });

  it('requires an administrator', async () => {
    scriptTables({ profiles: [{ maybeSingle: { data: { ...ADMIN, user_type: 'writer' }, error: null } }] });

    const response = await GET(getRequest());

    expect(response.status).toBe(403);
  });

  it('rejects an unknown role filter', async () => {
    scriptTables({ profiles: [{ maybeSingle: { data: ADMIN, error: null } }] });

    const response = await GET(getRequest('?role=hacker'));

    expect(response.status).toBe(400);
  });

  it('returns a page of accounts with the paging metadata', async () => {
    scriptTables({
      profiles: [
        { maybeSingle: { data: ADMIN, error: null } },
        { list: { data: [STUDENT, ADMIN], error: null, count: 42 } },
      ],
    });

    const response = await GET(getRequest('?role=student&page=2&pageSize=20'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.users).toHaveLength(2);
    expect(body.users[0]).toMatchObject({ id: 'student-1', user_type: 'student', rating: 4.5 });
    expect(body).toMatchObject({ page: 2, pageSize: 20, total: 42, totalPages: 3 });
  });
});

describe('PATCH /api/admin/users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.client.from.mockReset();
    mocks.updates = [];
    mocks.client.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
    mocks.sendNotification.mockResolvedValue({ success: true });
  });

  it('rejects an unknown action', async () => {
    scriptTables({ profiles: [{ maybeSingle: { data: ADMIN, error: null } }] });

    const response = await PATCH(patchRequest({ userId: 'student-1', action: 'delete' }));

    expect(response.status).toBe(400);
  });

  it('returns 404 when the account does not exist', async () => {
    scriptTables({
      profiles: [
        { maybeSingle: { data: ADMIN, error: null } },
        { maybeSingle: { data: null, error: null } },
      ],
    });

    const response = await PATCH(patchRequest({ userId: 'ghost', action: 'suspend' }));

    expect(response.status).toBe(404);
  });

  it('refuses to suspend an account that is already suspended', async () => {
    scriptTables({
      profiles: [
        { maybeSingle: { data: ADMIN, error: null } },
        { maybeSingle: { data: { ...STUDENT, is_active: false }, error: null } },
      ],
    });

    const response = await PATCH(patchRequest({ userId: 'student-1', action: 'suspend' }));

    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/already suspended/);
    expect(mocks.updates).toHaveLength(0);
  });

  it('refuses to let an administrator suspend themselves', async () => {
    scriptTables({
      profiles: [
        { maybeSingle: { data: ADMIN, error: null } },
        { maybeSingle: { data: ADMIN, error: null } },
      ],
    });

    const response = await PATCH(patchRequest({ userId: 'admin-1', action: 'suspend' }));

    expect(response.status).toBe(409);
    expect(mocks.updates).toHaveLength(0);
  });

  it('refuses to remove the last active administrator', async () => {
    scriptTables({
      profiles: [
        { maybeSingle: { data: { ...ADMIN, id: 'admin-2' }, error: null } },
        { maybeSingle: { data: ADMIN, error: null } },
        { list: { count: 1, error: null } },
      ],
    });

    const response = await PATCH(patchRequest({ userId: 'admin-1', action: 'suspend' }));

    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/at least one active administrator/);
    expect(mocks.updates).toHaveLength(0);
  });

  it('suspends the account and notifies its owner', async () => {
    const suspended = { ...STUDENT, is_active: false, suspension_reason: 'Chargeback fraud' };

    scriptTables({
      profiles: [
        { maybeSingle: { data: ADMIN, error: null } },
        { maybeSingle: { data: STUDENT, error: null } },
        { single: { data: suspended, error: null } },
      ],
    });

    const response = await PATCH(
      patchRequest({ userId: 'student-1', action: 'suspend', reason: '  Chargeback fraud  ' })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.updates[0]).toMatchObject({
      is_active: false,
      suspension_reason: 'Chargeback fraud',
    });
    expect(body.user).toMatchObject({ id: 'student-1', is_active: false });
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      mocks.client,
      expect.objectContaining({
        userId: 'student-1',
        type: 'account_updated',
        title: 'Account suspended',
      })
    );
  });

  it('explains a missing moderation column instead of a generic failure', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    scriptTables({
      profiles: [
        { maybeSingle: { data: ADMIN, error: null } },
        { maybeSingle: { data: STUDENT, error: null } },
        {
          single: {
            data: null,
            error: { code: '42703', message: 'column "is_active" does not exist' },
          },
        },
      ],
    });

    const response = await PATCH(patchRequest({ userId: 'student-1', action: 'suspend' }));

    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/supabase-profile-fields-update\.sql/);

    consoleError.mockRestore();
  });
});
