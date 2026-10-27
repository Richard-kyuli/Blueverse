import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH, POST } from './route';

/**
 * Route-level tests for /api/admin/admins.
 *
 * The first profiles lookup of every request is authenticateAdmin reading the
 * caller, so each scripted queue starts with that.
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
  client: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
      admin: { createUser: vi.fn(), deleteUser: vi.fn() },
    },
  },
  sendNotification: vi.fn(),
  inserts: [],
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
    order: () => query,
    range: () => query,
    insert: (payload) => {
      mocks.inserts.push(payload);
      return query;
    },
    update: (payload) => {
      mocks.updates.push(payload);
      return query;
    },
    maybeSingle: async () => scripted.maybeSingle || { data: null, error: null },
    single: async () => scripted.single || { data: null, error: null },
    then: (resolve, reject) =>
      Promise.resolve(scripted.list || { data: null, error: null }).then(resolve, reject),
  };

  return query;
}

function scriptTables(responses) {
  const queues = Object.fromEntries(
    Object.entries(responses).map(([table, entries]) => [table, [...entries]])
  );

  mocks.client.from.mockImplementation((table) => createQuery((queues[table] || []).shift() || {}));
}

const ADMIN = {
  id: 'admin-1',
  full_name: 'Ada Admin',
  email: 'ada@example.com',
  user_type: 'admin',
  is_active: true,
};

const STUDENT = {
  id: 'student-1',
  full_name: 'Grace Student',
  email: 'grace@example.com',
  user_type: 'student',
  is_active: true,
  is_verified: false,
};

const headers = (token = 'valid-token') => ({
  get: (name) =>
    name.toLowerCase() === 'authorization' ? (token ? `Bearer ${token}` : null) : null,
});

const signedInAs = (profile) => {
  mocks.client.auth.getUser.mockResolvedValue({ data: { user: { id: profile.id } }, error: null });
  return profile;
};

const postRequest = (body) => ({ headers: headers(), json: async () => body });
const patchRequest = (body) => ({ headers: headers(), json: async () => body });

const NEW_ADMIN = {
  fullName: 'Grace Hopper',
  email: 'grace.hopper@example.com',
  password: 'a-long-enough-password',
};

// Exactly what the dialog sends: one password, no confirmation. The dialog owns
// the comparison, so a body without confirmPassword must still be accepted.

describe('POST /api/admin/admins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.client.from.mockReset();
    mocks.inserts = [];
    mocks.updates = [];
    signedInAs(ADMIN);
    mocks.client.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: 'admin-2' } },
      error: null,
    });
    mocks.client.auth.admin.deleteUser.mockResolvedValue({ error: null });
    mocks.sendNotification.mockResolvedValue(undefined);
  });

  it('refuses a caller who is not an administrator', async () => {
    signedInAs(STUDENT);
    scriptTables({ profiles: [{ maybeSingle: { data: STUDENT, error: null } }] });

    const response = await POST(postRequest(NEW_ADMIN));

    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('Administrator access required');
    expect(mocks.client.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('rejects a body that is not JSON', async () => {
    scriptTables({ profiles: [{ maybeSingle: { data: ADMIN, error: null } }] });

    const request = {
      headers: headers(),
      json: async () => {
        throw new Error('Unexpected token');
      },
    };

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Invalid JSON body');
  });

  it('enforces the same password length as the public form', async () => {
    scriptTables({ profiles: [{ maybeSingle: { data: ADMIN, error: null } }] });

    const response = await POST(postRequest({ ...NEW_ADMIN, password: 'short' }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/at least 10 characters/);
    expect(mocks.client.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('ignores a confirmation field rather than comparing it', async () => {
    scriptTables({
      profiles: [{ maybeSingle: { data: ADMIN, error: null } }, { list: { error: null } }],
    });

    const response = await POST(postRequest({ ...NEW_ADMIN, confirmPassword: 'something-else' }));

    expect(response.status).toBe(201);
  });

  it('reports a taken email as a conflict and points at promotion', async () => {
    scriptTables({ profiles: [{ maybeSingle: { data: ADMIN, error: null } }] });
    mocks.client.auth.admin.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'A user with this email address has already been registered' },
    });

    const response = await POST(postRequest(NEW_ADMIN));

    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/promote it instead/i);
    expect(mocks.inserts).toHaveLength(0);
  });

  it('creates the account, an administrator profile row and a notification', async () => {
    // Regression: a body with no confirmPassword used to fail the route's own
    // field check after the dialog had already validated the pair.
    scriptTables({
      profiles: [{ maybeSingle: { data: ADMIN, error: null } }, { list: { error: null } }],
    });

    const response = await POST(postRequest(NEW_ADMIN));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/can now sign in/);

    expect(mocks.client.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'grace.hopper@example.com',
        email_confirm: true,
        user_metadata: { full_name: 'Grace Hopper' },
      })
    );

    expect(mocks.inserts).toHaveLength(1);
    expect(mocks.inserts[0]).toMatchObject({
      id: 'admin-2',
      email: 'grace.hopper@example.com',
      full_name: 'Grace Hopper',
      user_type: 'admin',
      is_active: true,
      is_verified: true,
    });

    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      mocks.client,
      expect.objectContaining({
        userId: 'admin-2',
        type: 'account_updated',
        title: 'Administrator access granted',
      })
    );
  });

  it('rolls the auth user back when the profile cannot be written', async () => {
    scriptTables({
      profiles: [
        { maybeSingle: { data: ADMIN, error: null } },
        { list: { error: { code: '23505', message: 'duplicate key value' } } },
      ],
    });

    const response = await POST(postRequest(NEW_ADMIN));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.details).toBe('duplicate key value');
    expect(mocks.client.auth.admin.deleteUser).toHaveBeenCalledWith('admin-2');
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it('retries with the minimal row when the table predates the moderation columns', async () => {
    scriptTables({
      profiles: [
        { maybeSingle: { data: ADMIN, error: null } },
        { list: { error: { code: '42703', message: 'column "is_verified" does not exist' } } },
        { list: { error: null } },
      ],
    });

    const response = await POST(postRequest(NEW_ADMIN));

    expect(response.status).toBe(201);
    expect(mocks.inserts).toHaveLength(2);
    expect(mocks.inserts[1]).toEqual({
      id: 'admin-2',
      email: 'grace.hopper@example.com',
      full_name: 'Grace Hopper',
      user_type: 'admin',
    });
  });
});

describe('PATCH /api/admin/admins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.client.from.mockReset();
    mocks.inserts = [];
    mocks.updates = [];
    signedInAs(ADMIN);
    mocks.sendNotification.mockResolvedValue(undefined);
  });

  it('requires an id or an email', async () => {
    scriptTables({ profiles: [{ maybeSingle: { data: ADMIN, error: null } }] });

    const response = await PATCH(patchRequest({}));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/id or the email/i);
  });

  it('rejects a malformed email before querying', async () => {
    scriptTables({ profiles: [{ maybeSingle: { data: ADMIN, error: null } }] });

    const response = await PATCH(patchRequest({ email: 'not-an-email' }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Enter a valid email address.');
  });

  it('returns 404 when no account uses that email', async () => {
    scriptTables({
      profiles: [
        { maybeSingle: { data: ADMIN, error: null } },
        { maybeSingle: { data: null, error: null } },
      ],
    });

    const response = await PATCH(patchRequest({ email: 'nobody@example.com' }));

    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe('No account uses nobody@example.com');
  });

  it('refuses an account that is already an administrator', async () => {
    scriptTables({
      profiles: [
        { maybeSingle: { data: ADMIN, error: null } },
        { maybeSingle: { data: { ...ADMIN, id: 'admin-9' }, error: null } },
      ],
    });

    const response = await PATCH(patchRequest({ userId: 'admin-9' }));

    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe('That account is already an administrator');
    expect(mocks.updates).toHaveLength(0);
  });

  it('refuses a suspended account rather than quietly reactivating it', async () => {
    scriptTables({
      profiles: [
        { maybeSingle: { data: ADMIN, error: null } },
        { maybeSingle: { data: { ...STUDENT, is_active: false }, error: null } },
      ],
    });

    const response = await PATCH(patchRequest({ userId: 'student-1' }));

    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/reactivate that account/i);
    expect(mocks.updates).toHaveLength(0);
  });

  it('promotes the account and notifies them', async () => {
    scriptTables({
      profiles: [
        { maybeSingle: { data: ADMIN, error: null } },
        { maybeSingle: { data: STUDENT, error: null } },
        { single: { data: { ...STUDENT, user_type: 'admin', is_verified: true }, error: null } },
      ],
    });

    const response = await PATCH(patchRequest({ email: 'Grace@Example.com ' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.user).toMatchObject({ id: 'student-1', user_type: 'admin' });
    expect(body.message).toBe('Grace Student is now an administrator.');

    expect(mocks.updates).toHaveLength(1);
    expect(mocks.updates[0]).toMatchObject({
      user_type: 'admin',
      is_active: true,
      is_verified: true,
    });

    expect(mocks.sendNotification).toHaveBeenCalledWith(
      mocks.client,
      expect.objectContaining({ userId: 'student-1', title: 'Administrator access granted' })
    );
  });

  it('falls back to a bare role change when the moderation columns are missing', async () => {
    scriptTables({
      profiles: [
        { maybeSingle: { data: ADMIN, error: null } },
        { maybeSingle: { data: STUDENT, error: null } },
        { single: { data: null, error: { code: '42703', message: 'column "is_verified" does not exist' } } },
        { single: { data: { ...STUDENT, user_type: 'admin' }, error: null } },
      ],
    });

    const response = await PATCH(patchRequest({ userId: 'student-1' }));

    expect(response.status).toBe(200);
    expect(mocks.updates[1]).toEqual({ user_type: 'admin' });
  });

  it('reports a failed update without notifying anybody', async () => {
    scriptTables({
      profiles: [
        { maybeSingle: { data: ADMIN, error: null } },
        { maybeSingle: { data: STUDENT, error: null } },
        { single: { data: null, error: { code: '42501', message: 'permission denied' } } },
      ],
    });

    const response = await PATCH(patchRequest({ userId: 'student-1' }));

    expect(response.status).toBe(500);
    expect((await response.json()).details).toBe('permission denied');
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/admins', () => {
  it('answers with 405', async () => {
    const response = await GET();

    expect(response.status).toBe(405);
  });
});
