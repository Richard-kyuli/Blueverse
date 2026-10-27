import { describe, it, expect } from 'vitest';
import {
  ASSIGNMENT_ACTIONS,
  REVENUE_WINDOW_MONTHS,
  USER_ACTIONS,
  assignmentValue,
  buildAssignmentUpdate,
  buildPlatformStats,
  buildRevenueReport,
  buildUserUpdate,
  buildVerificationSignals,
  canApplyUserAction,
  canResolveAssignment,
  matchesQuery,
  pageCount,
  resolvePaging,
  summariseUserAccount,
} from './admin';

const NOW = new Date('2026-10-27T12:00:00.000Z');
const daysAgo = (days) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

describe('assignmentValue', () => {
  it('prefers the agreed price and falls back through the budget', () => {
    expect(assignmentValue({ final_price: 120, budget_max: 200 })).toBe(120);
    expect(assignmentValue({ final_price: null, budget_max: 200 })).toBe(200);
    expect(assignmentValue({ budget_min: 80 })).toBe(80);
    expect(assignmentValue(null)).toBe(0);
  });
});

describe('matchesQuery', () => {
  const record = { full_name: 'Grace Writer', email: 'grace@example.com' };

  it('matches any listed field without case sensitivity', () => {
    expect(matchesQuery(record, ['full_name', 'email'], 'GRACE')).toBe(true);
    expect(matchesQuery(record, ['email'], 'example.com')).toBe(true);
    expect(matchesQuery(record, ['full_name'], 'student')).toBe(false);
  });

  it('treats an empty query as a match', () => {
    expect(matchesQuery(record, ['full_name'], '   ')).toBe(true);
  });
});

describe('resolvePaging', () => {
  it('converts page numbers into a range window', () => {
    expect(resolvePaging({ page: 3, pageSize: 20 })).toEqual({
      page: 3,
      pageSize: 20,
      from: 40,
      to: 59,
    });
  });

  it('clamps nonsense input', () => {
    expect(resolvePaging({ page: 0, pageSize: 5000 })).toMatchObject({ page: 1, pageSize: 100 });
    expect(resolvePaging({ page: -2, pageSize: 0 })).toMatchObject({ page: 1, pageSize: 20 });
  });
});

describe('pageCount', () => {
  it('rounds up and never reports zero pages', () => {
    expect(pageCount(41, 20)).toBe(3);
    expect(pageCount(0, 20)).toBe(1);
    expect(pageCount(undefined, 20)).toBe(1);
  });
});

describe('buildPlatformStats', () => {
  const profiles = [
    { id: 's1', user_type: 'student', is_active: true, is_verified: true, created_at: daysAgo(2) },
    { id: 's2', user_type: 'student', is_active: false, is_verified: false, created_at: daysAgo(40) },
    { id: 'w1', user_type: 'writer', is_active: true, is_verified: false, created_at: daysAgo(5) },
    { id: 'a1', user_type: 'admin', is_active: true, is_verified: true, created_at: daysAgo(60) },
  ];

  const assignments = [
    { id: 'a1', status: 'open', budget_max: 100, created_at: daysAgo(1) },
    { id: 'a2', status: 'in_progress', final_price: 200, created_at: daysAgo(2) },
    { id: 'a3', status: 'under_review', final_price: 300, created_at: daysAgo(3) },
    { id: 'a4', status: 'completed', final_price: 400, created_at: daysAgo(4) },
    { id: 'a5', status: 'disputed', final_price: 100, created_at: daysAgo(5) },
    { id: 'a6', status: 'cancelled', final_price: 50, created_at: daysAgo(6) },
  ];

  const stats = buildPlatformStats(
    { profiles, assignments, reviews: [{ rating: 5 }, { rating: 4 }, { rating: 'nonsense' }] },
    NOW
  );

  it('counts accounts by role and moderation state', () => {
    expect(stats.users).toEqual({
      total: 4,
      students: 2,
      writers: 1,
      admins: 1,
      suspended: 1,
      verified: 2,
      unverified: 2,
    });
  });

  it('counts assignments by bucket', () => {
    expect(stats.assignments).toEqual({
      total: 6,
      open: 1,
      active: 1,
      underReview: 1,
      completed: 1,
      disputed: 1,
      cancelled: 1,
    });
  });

  it('separates released money from money still held', () => {
    expect(stats.money.released).toBe(400);
    expect(stats.money.held).toBe(100);
    expect(stats.money.platformRevenue).toBe(60);
    expect(stats.money.writerPayouts).toBe(340);
    expect(stats.money.averageValue).toBe(400);
  });

  it('summarises reviews and the last 30 days', () => {
    expect(stats.reviews).toEqual({ count: 2, average: 4.5 });
    // s1 and w1 registered inside the window; s2 (40d) and a1 (60d) did not
    expect(stats.activity.newUsers).toBe(2);
    expect(stats.activity.newAssignments).toBe(6);
  });

  it('survives empty input', () => {
    const empty = buildPlatformStats({}, NOW);

    expect(empty.users.total).toBe(0);
    expect(empty.assignments.total).toBe(0);
    expect(empty.money).toMatchObject({ released: 0, platformRevenue: 0, averageValue: 0 });
    expect(empty.reviews).toEqual({ count: 0, average: 0 });
  });
});

describe('canApplyUserAction', () => {
  const active = { id: 'u1', is_active: true, is_verified: false };

  it('rejects repeats of an action that is already in effect', () => {
    expect(canApplyUserAction({ ...active, is_active: false }, USER_ACTIONS.suspend).ok).toBe(false);
    expect(canApplyUserAction(active, USER_ACTIONS.reactivate).ok).toBe(false);
    expect(canApplyUserAction({ ...active, is_verified: true }, USER_ACTIONS.verify).ok).toBe(false);
    expect(canApplyUserAction(active, USER_ACTIONS.unverify).ok).toBe(false);
  });

  it('allows the meaningful direction', () => {
    expect(canApplyUserAction(active, USER_ACTIONS.suspend).ok).toBe(true);
    expect(canApplyUserAction({ ...active, is_active: false }, USER_ACTIONS.reactivate).ok).toBe(true);
    expect(canApplyUserAction(active, USER_ACTIONS.verify).ok).toBe(true);
  });

  it('blocks suspending or unverifying yourself', () => {
    expect(canApplyUserAction(active, USER_ACTIONS.suspend, { actorId: 'u1' }).ok).toBe(false);
    expect(canApplyUserAction(active, USER_ACTIONS.unverify, { actorId: 'u1' }).ok).toBe(false);
    expect(canApplyUserAction(active, USER_ACTIONS.verify, { actorId: 'u1' }).ok).toBe(true);
  });

  it('rejects unknown actions and missing users', () => {
    expect(canApplyUserAction(active, 'explode').ok).toBe(false);
    expect(canApplyUserAction(null, USER_ACTIONS.verify).ok).toBe(false);
  });
});

describe('buildUserUpdate', () => {
  it('stamps the suspension and trims the reason', () => {
    expect(buildUserUpdate(USER_ACTIONS.suspend, { reason: '  Fraud  ', now: NOW })).toEqual({
      is_active: false,
      suspended_at: NOW.toISOString(),
      suspension_reason: 'Fraud',
    });
  });

  it('clears the suspension on reactivation', () => {
    expect(buildUserUpdate(USER_ACTIONS.reactivate, { now: NOW })).toEqual({
      is_active: true,
      suspended_at: null,
      suspension_reason: null,
    });
  });

  it('stamps verification both ways', () => {
    expect(buildUserUpdate(USER_ACTIONS.verify, { now: NOW })).toEqual({
      is_verified: true,
      verified_at: NOW.toISOString(),
    });
    expect(buildUserUpdate(USER_ACTIONS.unverify, { now: NOW })).toEqual({
      is_verified: false,
      verified_at: null,
    });
  });

  it('returns null for an unknown action', () => {
    expect(buildUserUpdate('explode', { now: NOW })).toBeNull();
  });
});

describe('canResolveAssignment', () => {
  it('only releases or refunds a disputed assignment', () => {
    expect(canResolveAssignment({ status: 'disputed' }, ASSIGNMENT_ACTIONS.release).ok).toBe(true);
    expect(canResolveAssignment({ status: 'disputed' }, ASSIGNMENT_ACTIONS.refund).ok).toBe(true);
    expect(canResolveAssignment({ status: 'under_review' }, ASSIGNMENT_ACTIONS.release).ok).toBe(false);
    expect(canResolveAssignment({ status: 'under_review' }, ASSIGNMENT_ACTIONS.refund).ok).toBe(false);
  });

  it('cancels anything still open', () => {
    for (const status of ['open', 'assigned', 'in_progress', 'under_review', 'disputed']) {
      expect(canResolveAssignment({ status }, ASSIGNMENT_ACTIONS.cancel).ok).toBe(true);
    }
  });

  it('refuses to touch a closed assignment', () => {
    expect(canResolveAssignment({ status: 'completed' }, ASSIGNMENT_ACTIONS.cancel).ok).toBe(false);
    expect(canResolveAssignment({ status: 'cancelled' }, ASSIGNMENT_ACTIONS.cancel).ok).toBe(false);
  });

  it('rejects unknown actions and missing assignments', () => {
    expect(canResolveAssignment({ status: 'disputed' }, 'explode').ok).toBe(false);
    expect(canResolveAssignment(null, ASSIGNMENT_ACTIONS.release).ok).toBe(false);
  });
});

describe('buildAssignmentUpdate', () => {
  it('completes the job on release', () => {
    expect(buildAssignmentUpdate(ASSIGNMENT_ACTIONS.release, { now: NOW })).toEqual({
      status: 'completed',
      completed_at: NOW.toISOString(),
    });
  });

  it('cancels on refund and on cancel', () => {
    expect(buildAssignmentUpdate(ASSIGNMENT_ACTIONS.refund)).toEqual({ status: 'cancelled' });
    expect(buildAssignmentUpdate(ASSIGNMENT_ACTIONS.cancel)).toEqual({ status: 'cancelled' });
  });

  it('returns null for an unknown action', () => {
    expect(buildAssignmentUpdate('explode')).toBeNull();
  });
});

describe('buildRevenueReport', () => {
  const profiles = [
    { id: 'w1', full_name: 'Grace Writer' },
    { id: 'w2', full_name: 'Alan Writer' },
  ];

  const completed = (overrides) => ({
    id: 'a',
    status: 'completed',
    final_price: 100,
    assigned_writer_id: 'w1',
    created_at: daysAgo(10),
    completed_at: daysAgo(4),
    ...overrides,
  });

  it('splits released money into platform revenue and writer payouts', () => {
    const report = buildRevenueReport(
      { assignments: [completed({}), completed({ id: 'b', final_price: 50 })], profiles },
      NOW
    );

    expect(report.totals.released).toBe(150);
    expect(report.totals.platformRevenue).toBe(22.5);
    expect(report.totals.writerPayouts).toBe(127.5);
    expect(report.totals.platformRevenue + report.totals.writerPayouts).toBe(report.totals.released);
  });

  it('separates held, cancelled and pipeline money', () => {
    const report = buildRevenueReport(
      {
        assignments: [
          completed({}),
          { id: 'd', status: 'disputed', final_price: 40, budget_max: 45 },
          { id: 'c', status: 'cancelled', budget_max: 20 },
          { id: 'p1', status: 'open', budget_max: 30 },
          { id: 'p2', status: 'in_progress', final_price: 25 },
        ],
        profiles,
      },
      NOW
    );

    expect(report.totals.held).toBe(40);
    expect(report.totals.cancelled).toBe(20);
    expect(report.totals.pipeline).toBe(55);
    expect(report.totals.released).toBe(100);
  });

  it('averages value and time to completion over completed work only', () => {
    const report = buildRevenueReport(
      {
        assignments: [
          completed({}),
          completed({ id: 'b', created_at: daysAgo(8), completed_at: daysAgo(6) }),
          { id: 'd', status: 'disputed', final_price: 999 },
        ],
        profiles,
      },
      NOW
    );

    expect(report.totals.completed).toBe(2);
    expect(report.totals.averageValue).toBe(100);
    // six days and two days separately, so four on average
    expect(report.totals.averageDaysToComplete).toBe(4);
  });

  it('builds a fixed window of months, oldest first, ending on the reference month', () => {
    const report = buildRevenueReport({ assignments: [], profiles }, NOW);

    expect(report.monthly).toHaveLength(REVENUE_WINDOW_MONTHS);
    expect(report.monthly.map((bucket) => bucket.label)).toEqual([
      'May 26',
      'Jun 26',
      'Jul 26',
      'Aug 26',
      'Sep 26',
      'Oct 26',
    ]);
  });

  it('files each completed assignment into the month it completed', () => {
    const report = buildRevenueReport(
      {
        assignments: [
          completed({ id: 'a', final_price: 100, completed_at: '2026-09-15T10:00:00.000Z' }),
          completed({ id: 'b', final_price: 60, completed_at: '2026-10-02T10:00:00.000Z' }),
        ],
        profiles,
      },
      NOW
    );

    const september = report.monthly.find((bucket) => bucket.key === '2026-09');
    const october = report.monthly.find((bucket) => bucket.key === '2026-10');

    expect(september.released).toBe(100);
    expect(september.count).toBe(1);
    expect(october.released).toBe(60);
  });

  it('ignores completions that fall outside the window', () => {
    const report = buildRevenueReport(
      { assignments: [completed({ completed_at: '2025-01-05T10:00:00.000Z' })], profiles },
      NOW
    );

    expect(report.totals.released).toBe(100);
    expect(report.monthly.every((bucket) => bucket.released === 0)).toBe(true);
  });

  it('ranks writers by earnings and names them from profiles', () => {
    const report = buildRevenueReport(
      {
        assignments: [
          completed({ id: 'a', final_price: 100, assigned_writer_id: 'w2' }),
          completed({ id: 'b', final_price: 300, assigned_writer_id: 'w1' }),
          completed({ id: 'c', final_price: 50, assigned_writer_id: 'w2' }),
        ],
        profiles,
      },
      NOW
    );

    expect(report.topWriters).toHaveLength(2);
    expect(report.topWriters[0]).toMatchObject({ id: 'w1', name: 'Grace Writer', earnings: 255 });
    expect(report.topWriters[1]).toMatchObject({ id: 'w2', name: 'Alan Writer', earnings: 127.5, jobs: 2 });
  });

  it('names an unlisted writer instead of dropping the earnings', () => {
    const report = buildRevenueReport(
      { assignments: [completed({ assigned_writer_id: 'missing' })], profiles }, 
      NOW
    );

    expect(report.topWriters[0]).toMatchObject({ id: 'missing', name: 'Unknown writer' });
  });

  it('returns zeroed totals for an empty marketplace', () => {
    const report = buildRevenueReport({}, NOW);
    expect(report.totals).toMatchObject({
      released: 0,
      held: 0,
      cancelled: 0,
      pipeline: 0,
      averageValue: 0,
      averageDaysToComplete: 0,
    });
    expect(report.topWriters).toEqual([]);
  });

  it('does not count a row with an unrecognised status anywhere', () => {
    const report = buildRevenueReport(
      { assignments: [{ id: 'x', status: null, final_price: 500 }], profiles },
      NOW
    );

    expect(report.totals.released).toBe(0);
    expect(report.totals.pipeline).toBe(0);
    expect(report.totals.held).toBe(0);
  });
});

describe('buildVerificationSignals', () => {
  const COMPLETE = {
    full_name: 'Grace Writer',
    avatar_url: 'https://example.com/a.png',
    bio: 'I write about climate policy and statistics.',
    expertise: ['Economics'],
    completed_assignments: 3,
    rating: 4.8,
  };

  it('scores a complete profile as ready', () => {
    const signals = buildVerificationSignals(COMPLETE);
    expect(signals.score).toBe(6);
    expect(signals.total).toBe(6);
    expect(signals.ready).toBe(true);
  });

  it('scores an empty profile as zero signals', () => {
    const signals = buildVerificationSignals({ full_name: '', avatar_url: null });
    expect(signals.score).toBe(0);
    expect(signals.ready).toBe(false);
  });

  it('needs four signals before calling a profile ready', () => {
    const threeSignals = {
      full_name: 'A Writer',
      avatar_url: 'https://example.com/a.png',
      bio: 'Long enough biography text here.',
      completed_assignments: 0,
      rating: 0,
    };

    const three = buildVerificationSignals(threeSignals);
    expect(three.score).toBe(3);
    expect(three.ready).toBe(false);

    const four = buildVerificationSignals({ ...threeSignals, expertise: ['Law'] });
    expect(four.score).toBe(4);
    expect(four.ready).toBe(true);
  });

  it('requires a bio of at least twenty characters', () => {
    const short = buildVerificationSignals({ bio: 'Too short' });
    const bio = short.items.find((item) => item.key === 'bio');
    expect(bio.ok).toBe(false);
  });

  it('tolerates a null expertise column', () => {
    const signals = buildVerificationSignals({ expertise: null });
    expect(signals.items.find((item) => item.key === 'expertise').ok).toBe(false);
  });

  it('returns an empty result for a missing profile', () => {
    expect(buildVerificationSignals(null)).toEqual({ ready: false, score: 0, total: 0, items: [] });
  });
});

describe('summariseUserAccount', () => {
  const profile = { id: 'u1', user_type: 'writer' };

  it('counts activity on both sides of the marketplace', () => {
    const summary = summariseUserAccount({
      profile,
      assignmentsAsStudent: [
        { status: 'completed', final_price: 100, created_at: daysAgo(20) },
        { status: 'disputed', final_price: 50 },
        { status: 'open', budget_max: 40 },
      ],
      assignmentsAsWriter: [
        { status: 'completed', final_price: 200 },
        { status: 'in_progress', final_price: 80 },
      ],
      bids: [
        { status: 'accepted', created_at: daysAgo(1) },
        { status: 'pending' },
        { status: 'rejected' },
        { status: 'pending' },
      ],
      reviewsReceived: [{ rating: 5 }, { rating: 2 }],
      submissions: [
        { status: 'approved' },
        { status: 'revision_requested' },
        { status: 'submitted' },
      ],
    });

    expect(summary.asStudent).toEqual({ posted: 3, completed: 1, disputed: 1, spent: 100 });
    expect(summary.asWriter).toEqual({ awarded: 2, completed: 1, disputed: 0, earned: 170 });
    expect(summary.bids).toEqual({ total: 4, accepted: 1, pending: 2, winRate: 25 });
    expect(summary.reviews).toEqual({ received: 2, average: 3.5, lowRatings: 1 });
    expect(summary.submissions).toEqual({
      total: 3,
      approved: 1,
      revisionRequested: 1,
      rejected: 0,
      awaitingReview: 1,
    });
  });

  it('reports the most recent activity across every collection', () => {
    const summary = summariseUserAccount({
      profile,
      assignmentsAsStudent: [{ status: 'open', created_at: daysAgo(30) }],
      bids: [{ status: 'pending', created_at: daysAgo(2) }],
      submissions: [{ status: 'approved', created_at: daysAgo(9) }],
    });

    expect(summary.lastActivityAt).toBe(daysAgo(2));
  });

  it('returns zeros and no activity for a brand-new account', () => {
    const summary = summariseUserAccount({ profile });

    expect(summary.role).toBe('writer');
    expect(summary.asWriter.earned).toBe(0);
    expect(summary.bids.winRate).toBe(0);
    expect(summary.reviews).toEqual({ received: 0, average: 0, lowRatings: 0 });
    expect(summary.lastActivityAt).toBeNull();
  });

  it('does not divide by zero when there are no bids', () => {
    expect(summariseUserAccount({ profile }).bids.winRate).toBe(0);
  });
});
