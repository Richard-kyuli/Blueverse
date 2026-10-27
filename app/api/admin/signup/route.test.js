import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from './route';

/**
 * Route-level tests for /api/admin/signup.
 *
 * This route is the only place a browser can cause an administrator row to be
 * created, so the gate has to be proven closed in every direction: no code
 * configured, wrong code, bad fields, duplicate email, and a failed profile
 * insert that must roll the auth user back.
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
    auth: { admin: { createUser: vi.fn(), deleteUser: vi.fn() } },
  },
  inserts: [],
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => mocks.client,
}));

const CODE = 'bootstrap-code';

const VALID_BODY = {
  fullName: 'Richard Kyuli',
  email: 'Richard@Example.com',
  password: 'a long enough password',
  confirmPassword: 'a long enough password',
  code: CODE,
};

function buildRequest(body) {
  return { json: async () => body };
}

function brokenRequest() {
  return {
    json: async () => {
      throw new Error('Unexpected token');
    },
  };
}

async function respond(response) {
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  mocks.inserts.length = 0;
  mocks.client.auth.admin.createUser.mockReset();
  mocks.client.auth.admin.deleteUser.mockReset();
  mocks.client.from.mockReset();

  mocks.client.auth.admin.createUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'richard@example.com' } },
    error: null,
  });
  mocks.client.auth.admin.deleteUser.mockResolvedValue({ error: null });
  mocks.client.from.mockImplementation(() => ({
    insert: async (payload) => {
      mocks.inserts.push(payload);
      return { error: null };
    },
  }));

  vi.stubEnv('ADMIN_SIGNUP_CODE', CODE);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/admin/signup — gate', () => {
  it('rejects a body that is not JSON', async () => {
    const { status, body } = await respond(await POST(brokenRequest()));
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(mocks.client.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('fails closed when ADMIN_SIGNUP_CODE is not configured', async () => {
    vi.stubEnv('ADMIN_SIGNUP_CODE', '');

    const { status, body } = await respond(await POST(buildRequest(VALID_BODY)));
    expect(status).toBe(503);
    expect(body.error).toMatch(/not configured/i);
    expect(mocks.client.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('rejects a wrong bootstrap code with 401', async () => {
    const { status } = await respond(await POST(buildRequest({ ...VALID_BODY, code: 'nope' })));
    expect(status).toBe(401);
    expect(mocks.client.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('rejects a missing bootstrap code', async () => {
    const body = { ...VALID_BODY };
    delete body.code;

    const { status } = await respond(await POST(buildRequest(body)));
    expect(status).toBe(401);
    expect(mocks.client.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('validates the fields once the code is accepted', async () => {
    const { status, body } = await respond(
      await POST(buildRequest({ ...VALID_BODY, password: 'short', confirmPassword: 'short' }))
    );
    expect(status).toBe(400);
    expect(body.error).toMatch(/10 characters/i);
    expect(mocks.client.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('never echoes the bootstrap code back', async () => {
    const { body } = await respond(await POST(buildRequest({ ...VALID_BODY, code: 'wrong' })));
    expect(JSON.stringify(body)).not.toContain(CODE);
  });
});

describe('POST /api/admin/signup — provisioning', () => {
  it('creates a confirmed auth user and an admin profile', async () => {
    const { status, body } = await respond(await POST(buildRequest(VALID_BODY)));

    expect(status).toBe(201);
    expect(body).toMatchObject({ success: true, userId: 'user-1' });

    expect(mocks.client.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'richard@example.com',
        email_confirm: true,
        user_metadata: { full_name: 'Richard Kyuli' },
      })
    );

    expect(mocks.inserts).toHaveLength(1);
    expect(mocks.inserts[0]).toMatchObject({
      id: 'user-1',
      email: 'richard@example.com',
      full_name: 'Richard Kyuli',
      user_type: 'admin',
      is_active: true,
      is_verified: true,
    });
    expect(mocks.inserts[0].verified_at).toEqual(expect.any(String));
  });

  it('lowercases and trims the email before creating anything', async () => {
    await POST(buildRequest({ ...VALID_BODY, email: '  Richard@Example.COM  ' }));
    expect(mocks.client.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'richard@example.com' })
    );
  });

  it('refuses an email that already has an account', async () => {
    mocks.client.auth.admin.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'A user with this email address has already been registered' },
    });

    const { status, body } = await respond(await POST(buildRequest(VALID_BODY)));
    expect(status).toBe(409);
    expect(body.error).toMatch(/already exists/i);
    expect(mocks.inserts).toHaveLength(0);
  });

  it('reports a genuine auth failure without the duplicate wording', async () => {
    mocks.client.auth.admin.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Password is too weak' },
    });

    const { status, body } = await respond(await POST(buildRequest(VALID_BODY)));
    expect(status).toBe(500);
    expect(body.error).toMatch(/could not create/i);
    expect(body.details).toBe('Password is too weak');
  });

  it('treats a null user id as a failure', async () => {
    mocks.client.auth.admin.createUser.mockResolvedValue({ data: { user: null }, error: null });

    const { status } = await respond(await POST(buildRequest(VALID_BODY)));
    expect(status).toBe(500);
    expect(mocks.inserts).toHaveLength(0);
  });

  it('retries with the minimal columns when the moderation columns are missing', async () => {
    let attempt = 0;
    mocks.client.from.mockImplementation(() => ({
      insert: async (payload) => {
        mocks.inserts.push(payload);
        attempt += 1;
        return attempt === 1
          ? { error: { code: '42703', message: 'column "is_verified" does not exist' } }
          : { error: null };
      },
    }));

    const { status } = await respond(await POST(buildRequest(VALID_BODY)));

    expect(status).toBe(201);
    expect(mocks.inserts).toHaveLength(2);
    expect(mocks.inserts[1]).toEqual({
      id: 'user-1',
      email: 'richard@example.com',
      full_name: 'Richard Kyuli',
      user_type: 'admin',
    });
  });

  it('rolls the auth user back when the profile cannot be saved', async () => {
    mocks.client.from.mockImplementation(() => ({
      insert: async (payload) => {
        mocks.inserts.push(payload);
        return { error: { code: '23505', message: 'duplicate key value' } };
      },
    }));

    const { status, body } = await respond(await POST(buildRequest(VALID_BODY)));

    expect(status).toBe(500);
    expect(body.error).toMatch(/rolled back/i);
    expect(mocks.client.auth.admin.deleteUser).toHaveBeenCalledWith('user-1');
  });

  it('survives a failed rollback without masking the original error', async () => {
    mocks.client.from.mockImplementation(() => ({
      insert: async () => ({ error: { code: '42501', message: 'permission denied' } }),
    }));
    mocks.client.auth.admin.deleteUser.mockResolvedValue({
      error: { message: 'user not found' },
    });

    const { status, body } = await respond(await POST(buildRequest(VALID_BODY)));
    expect(status).toBe(500);
    expect(body.details).toBe('permission denied');
  });
});
