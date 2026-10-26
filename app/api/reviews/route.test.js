import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from './route';

/**
 * Route-level tests for /api/reviews.
 *
 * The route talks to Supabase through a chainable query builder, so the mock
 * scripts one response per `from(table)` call in the order the route makes them.
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
  sendNotification: vi.fn(),
  client: { from: vi.fn(), auth: { getUser: vi.fn() } },
}));

vi.mock('@/lib/notify', () => ({ sendNotification: mocks.sendNotification }));

vi.mock('@/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => mocks.client,
}));

/** Chainable stand-in for the PostgREST builder. */
function createQuery(scripted = {}) {
  const query = {
    select: () => query,
    eq: () => query,
    in: () => query,
    order: () => query,
    limit: () => query,
    update: () => query,
    insert: () => query,
    maybeSingle: async () => scripted.maybeSingle || { data: null, error: null },
    single: async () => scripted.single || { data: null, error: null },
    then: (resolve, reject) =>
      Promise.resolve(scripted.list || { data: [], error: null }).then(resolve, reject),
  };

  return query;
}

function scriptTables(responses) {
  const queues = Object.fromEntries(
    Object.entries(responses).map(([table, entries]) => [table, [...entries]])
  );

  mocks.client.from.mockImplementation((table) => createQuery((queues[table] || []).shift() || {}));
}

const ASSIGNMENT = {
  id: 'assignment-1',
  title: 'Hotel Management System Development',
  student_id: 'student-1',
  assigned_writer_id: 'writer-1',
  status: 'completed',
};

const SAVED_REVIEW = {
  id: 'review-1',
  assignment_id: 'assignment-1',
  reviewer_id: 'student-1',
  reviewee_id: 'writer-1',
  rating: 5,
  comment: 'Excellent work',
  review_type: 'student_to_writer',
  created_at: '2026-10-26T10:00:00.000Z',
};

function reviewRequest(body, { token = 'valid-token' } = {}) {
  return {
    headers: {
      get: (name) =>
        name.toLowerCase() === 'authorization' ? (token ? `Bearer ${token}` : null) : null,
    },
    json: async () => body,
  };
}

function getRequest(queryString, { token = 'valid-token' } = {}) {
  return {
    url: `http://localhost:3000/api/reviews${queryString}`,
    headers: {
      get: (name) =>
        name.toLowerCase() === 'authorization' ? (token ? `Bearer ${token}` : null) : null,
    },
  };
}

describe('POST /api/reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.client.from.mockReset();
    mocks.client.auth.getUser.mockResolvedValue({
      data: { user: { id: 'student-1' } },
      error: null,
    });
    mocks.sendNotification.mockResolvedValue({ success: true });
  });

  it('rejects requests without a bearer token', async () => {
    const response = await POST(reviewRequest({ assignmentId: 'assignment-1', rating: 5 }, { token: null }));

    expect(response.status).toBe(401);
    expect(mocks.client.from).not.toHaveBeenCalled();
  });

  it('rejects a rating outside 1-5 before touching the database', async () => {
    const response = await POST(reviewRequest({ assignmentId: 'assignment-1', rating: 7 }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/1 to 5 stars/);
    expect(mocks.client.from).not.toHaveBeenCalled();
  });

  it('rejects a caller who is not the student who posted the assignment', async () => {
    mocks.client.auth.getUser.mockResolvedValue({
      data: { user: { id: 'someone-else' } },
      error: null,
    });
    scriptTables({ assignments: [{ maybeSingle: { data: ASSIGNMENT, error: null } }] });

    const response = await POST(reviewRequest({ assignmentId: 'assignment-1', rating: 5 }));

    expect(response.status).toBe(403);
  });

  it('rejects reviews on an assignment that is not completed yet', async () => {
    scriptTables({
      assignments: [
        { maybeSingle: { data: { ...ASSIGNMENT, status: 'under_review' }, error: null } },
      ],
    });

    const response = await POST(reviewRequest({ assignmentId: 'assignment-1', rating: 5 }));

    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/once the assignment is completed/);
  });

  it('saves the review, refreshes the writer stats and notifies them', async () => {
    scriptTables({
      assignments: [
        { maybeSingle: { data: ASSIGNMENT, error: null } },
        { list: { count: 4, error: null } },
      ],
      reviews: [
        { maybeSingle: { data: null, error: null } },
        { single: { data: SAVED_REVIEW, error: null } },
        { list: { data: [{ rating: 5 }, { rating: 4 }], error: null } },
      ],
      profiles: [
        { list: { data: null, error: null } },
        { maybeSingle: { data: { full_name: 'Grace Student' }, error: null } },
      ],
    });

    const response = await POST(
      reviewRequest({ assignmentId: 'assignment-1', rating: 5, comment: 'Excellent work' })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.summary).toMatchObject({ average: 4.5, count: 2 });
    expect(body.updated).toBe(false);

    expect(mocks.sendNotification).toHaveBeenCalledWith(
      mocks.client,
      expect.objectContaining({
        userId: 'writer-1',
        type: 'review_received',
        link: '/dashboard/assignments/assignment-1',
      })
    );
    expect(mocks.sendNotification.mock.calls[0][1].message).toContain('Grace Student rated you 5/5');
  });
});

describe('GET /api/reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.client.from.mockReset();
    mocks.client.auth.getUser.mockResolvedValue({
      data: { user: { id: 'student-1' } },
      error: null,
    });
  });

  it('requires an assignmentId', async () => {
    const response = await GET(getRequest(''));

    expect(response.status).toBe(400);
  });

  it('refuses callers who are not party to the assignment', async () => {
    mocks.client.auth.getUser.mockResolvedValue({
      data: { user: { id: 'stranger' } },
      error: null,
    });
    scriptTables({ assignments: [{ maybeSingle: { data: ASSIGNMENT, error: null } }] });

    const response = await GET(getRequest('?assignmentId=assignment-1'));

    expect(response.status).toBe(403);
  });

  it('returns reviews with the reviewer name attached', async () => {
    scriptTables({
      assignments: [{ maybeSingle: { data: ASSIGNMENT, error: null } }],
      reviews: [{ list: { data: [SAVED_REVIEW], error: null } }],
      profiles: [{ list: { data: [{ id: 'student-1', full_name: 'Grace Student' }], error: null } }],
    });

    const response = await GET(getRequest('?assignmentId=assignment-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reviews).toHaveLength(1);
    expect(body.reviews[0].reviewer_name).toBe('Grace Student');
    expect(body.summary).toMatchObject({ average: 5, count: 1 });
  });
});
