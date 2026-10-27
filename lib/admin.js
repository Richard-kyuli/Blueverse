/**
 * Admin console rules and arithmetic.
 *
 * Every admin screen reads through a service-role API route rather than the
 * browser client, because the tables have no admin RLS policies: `bids` is
 * scoped to the bidder and the assignment owner, and `messages` to its two
 * participants, so an admin query under RLS would silently return nothing.
 *
 * The helpers here are pure so the routes and the pages share one definition of
 * "active", "released" and "resolvable", and so the numbers can be tested
 * without a database.
 */

import { roundCurrency, splitPayment, toAmount } from './payments';
import { computeRatingSummary } from './reviews';
import { ACTIVE_ASSIGNMENT_STATUSES } from './status';

export const ADMIN_ROLES = ['student', 'writer', 'admin'];

/** Moderation actions available on a user account. */
export const USER_ACTIONS = Object.freeze({
  suspend: 'suspend',
  reactivate: 'reactivate',
  verify: 'verify',
  unverify: 'unverify',
});

export const USER_ACTION_LABELS = Object.freeze({
  suspend: 'Suspend',
  reactivate: 'Reactivate',
  verify: 'Verify',
  unverify: 'Remove verification',
});

/** Actions available on an assignment, used to resolve a dispute. */
export const ASSIGNMENT_ACTIONS = Object.freeze({
  release: 'release',
  refund: 'refund',
  cancel: 'cancel',
});

export const ASSIGNMENT_ACTION_LABELS = Object.freeze({
  release: 'Release payment to writer',
  refund: 'Refund the student',
  cancel: 'Cancel assignment',
});

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

/** What an assignment is worth, tolerating the columns a draft may not have. */
export function assignmentValue(assignment) {
  if (!assignment) return 0;
  return roundCurrency(
    toAmount(assignment.final_price) ||
      toAmount(assignment.budget_max) ||
      toAmount(assignment.budget_min)
  );
}

/**
 * Case-insensitive substring match across the given fields.
 *
 * @param {object} record row to test
 * @param {string[]} fields field names to search
 * @param {string} query user input
 */
export function matchesQuery(record, fields, query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return true;

  return fields.some((field) => String(record?.[field] ?? '').toLowerCase().includes(needle));
}

/**
 * Translate page/pageSize into a PostgREST `range()` window.
 *
 * @param {{page?: number|string, pageSize?: number|string}} input
 */
export function resolvePaging({ page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const size = Math.min(
    Math.max(Math.trunc(Number(pageSize)) || DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  );
  const current = Math.max(Math.trunc(Number(page)) || 1, 1);

  return { page: current, pageSize: size, from: (current - 1) * size, to: current * size - 1 };
}

/** Number of pages for a result set; always at least 1 so the UI can render. */
export function pageCount(total, pageSize = DEFAULT_PAGE_SIZE) {
  return Math.max(Math.ceil(Number(total || 0) / Math.max(Number(pageSize) || 1, 1)), 1);
}

/**
 * Platform-wide totals for the admin overview.
 *
 * Money is only counted as released once an assignment is `completed`, which in
 * this build is also the moment the writer's earnings become payable. Disputed
 * assignments are reported separately as funds still held, since either a
 * release or a refund is still possible.
 *
 * @param {{profiles?: object[], assignments?: object[], reviews?: object[]}} rows
 * @param {Date} now reference date, injectable for tests
 */
export function buildPlatformStats({ profiles = [], assignments = [], reviews = [] } = {}, now = new Date()) {
  const users = {
    total: profiles.length,
    students: 0,
    writers: 0,
    admins: 0,
    suspended: 0,
    verified: 0,
    unverified: 0,
  };

  for (const profile of profiles) {
    if (profile.user_type === 'student') users.students += 1;
    else if (profile.user_type === 'writer') users.writers += 1;
    else if (profile.user_type === 'admin') users.admins += 1;

    if (profile.is_active === false) users.suspended += 1;
    if (profile.is_verified) users.verified += 1;
    else users.unverified += 1;
  }

  const work = {
    total: assignments.length,
    open: 0,
    active: 0,
    underReview: 0,
    completed: 0,
    disputed: 0,
    cancelled: 0,
  };

  let releasedGross = 0;
  let heldGross = 0;

  for (const assignment of assignments) {
    const { status } = assignment;

    if (status === 'open') work.open += 1;
    else if (ACTIVE_ASSIGNMENT_STATUSES.includes(status)) work.active += 1;
    else if (status === 'under_review') work.underReview += 1;
    else if (status === 'completed') {
      work.completed += 1;
      releasedGross += assignmentValue(assignment);
    } else if (status === 'disputed') {
      work.disputed += 1;
      heldGross += assignmentValue(assignment);
    } else if (status === 'cancelled') work.cancelled += 1;
  }

  const released = roundCurrency(releasedGross);
  const { platformFee, writerEarnings } = splitPayment(released);
  const rating = computeRatingSummary(reviews);

  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const withinPeriod = (value) => {
    if (!value) return false;
    const time = new Date(value).getTime();
    return !Number.isNaN(time) && time >= cutoff.getTime();
  };

  return {
    users,
    assignments: work,
    money: {
      released,
      held: roundCurrency(heldGross),
      platformRevenue: platformFee,
      writerPayouts: writerEarnings,
      averageValue: work.completed ? roundCurrency(released / work.completed) : 0,
    },
    reviews: { count: rating.count, average: rating.average },
    activity: {
      newUsers: profiles.filter((profile) => withinPeriod(profile.created_at)).length,
      newAssignments: assignments.filter((assignment) => withinPeriod(assignment.created_at)).length,
    },
  };
}

/**
 * Whether a moderation action makes sense for the target account.
 *
 * Role changes are deliberately absent. This module is moderation: it suspends,
 * reactivates and verifies. Granting administrator access is a privilege grant
 * and lives in its own resource, POST/PATCH /api/admin/admins, guarded by
 * canPromoteToAdmin in lib/adminProvisioning.js.
 *
 * @param {object} profile target account
 * @param {string} action one of USER_ACTIONS
 * @param {{actorId?: string}} options caller id, to block self-sabotage
 */
export function canApplyUserAction(profile, action, { actorId } = {}) {
  if (!profile) return { ok: false, reason: 'User not found' };
  if (!has(USER_ACTIONS, action)) return { ok: false, reason: 'Unknown action' };

  if (action === USER_ACTIONS.suspend && profile.is_active === false) {
    return { ok: false, reason: 'This account is already suspended' };
  }
  if (action === USER_ACTIONS.reactivate && profile.is_active !== false) {
    return { ok: false, reason: 'This account is not suspended' };
  }
  if (action === USER_ACTIONS.verify && profile.is_verified) {
    return { ok: false, reason: 'This account is already verified' };
  }
  if (action === USER_ACTIONS.unverify && !profile.is_verified) {
    return { ok: false, reason: 'This account is not verified' };
  }

  const selfBlocking = [USER_ACTIONS.suspend, USER_ACTIONS.unverify];
  if (actorId && actorId === profile.id && selfBlocking.includes(action)) {
    return { ok: false, reason: 'You cannot do that to your own account' };
  }

  return { ok: true, reason: '' };
}

/** Column values written by a user moderation action. */
export function buildUserUpdate(action, { reason, now = new Date() } = {}) {
  switch (action) {
    case USER_ACTIONS.suspend:
      return {
        is_active: false,
        suspended_at: now.toISOString(),
        suspension_reason: reason ? String(reason).trim().slice(0, 500) : null,
      };
    case USER_ACTIONS.reactivate:
      return { is_active: true, suspended_at: null, suspension_reason: null };
    case USER_ACTIONS.verify:
      return { is_verified: true, verified_at: now.toISOString() };
    case USER_ACTIONS.unverify:
      return { is_verified: false, verified_at: null };
    default:
      return null;
  }
}

/**
 * Whether a dispute action is legal for this assignment.
 *
 * Release and refund only exist to settle a dispute: a student releasing funds
 * normally goes through the submission approval route. Cancelling is broader,
 * but an already closed assignment stays closed.
 *
 * @param {object} assignment target assignment
 * @param {string} action one of ASSIGNMENT_ACTIONS
 */
export function canResolveAssignment(assignment, action) {
  if (!assignment) return { ok: false, reason: 'Assignment not found' };
  if (!has(ASSIGNMENT_ACTIONS, action)) return { ok: false, reason: 'Unknown action' };

  if (assignment.status === 'completed' || assignment.status === 'cancelled') {
    return { ok: false, reason: 'This assignment is already closed' };
  }

  if (action === ASSIGNMENT_ACTIONS.release && assignment.status !== 'disputed') {
    return { ok: false, reason: 'Only a disputed assignment can be released manually' };
  }
  if (action === ASSIGNMENT_ACTIONS.refund && assignment.status !== 'disputed') {
    return { ok: false, reason: 'Only a disputed assignment can be refunded' };
  }

  return { ok: true, reason: '' };
}

/** Column values written by a dispute action. */
export function buildAssignmentUpdate(action, { now = new Date() } = {}) {
  if (action === ASSIGNMENT_ACTIONS.release) {
    return { status: 'completed', completed_at: now.toISOString() };
  }
  if (action === ASSIGNMENT_ACTIONS.refund || action === ASSIGNMENT_ACTIONS.cancel) {
    return { status: 'cancelled' };
  }
  return null;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** How many months of history the revenue screen renders. */
export const REVENUE_WINDOW_MONTHS = 6;

/** Assignment statuses where money is committed but not yet settled either way. */
const PIPELINE_STATUSES = ['open', ...ACTIVE_ASSIGNMENT_STATUSES, 'under_review'];

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Money report for /dashboard/admin/revenue.
 *
 * This is a derivation, not a ledger: every figure comes from
 * `assignments.final_price` plus the status. The `transactions` table exists in
 * the schema but nothing writes to it yet, so there is no settled-money record
 * to reconcile against — the page says so rather than implying otherwise.
 *
 * Per-assignment fee splitting is summed rather than applying the fee rate to
 * the grand total, so the platform revenue and writer payout columns always add
 * up to the released column even at three cents per job.
 *
 * @param {{assignments?: object[], profiles?: object[]}} rows
 * @param {Date} now reference date, injectable for tests
 */
export function buildRevenueReport({ assignments = [], profiles = [] } = {}, now = new Date()) {
  const nameById = new Map(profiles.map((profile) => [profile.id, profile.full_name || profile.email]));

  const totals = {
    released: 0,
    held: 0,
    cancelled: 0,
    pipeline: 0,
    platformRevenue: 0,
    writerPayouts: 0,
    completed: 0,
    disputed: 0,
    averageValue: 0,
    averageDaysToComplete: 0,
  };

  const monthly = [];
  const buckets = new Map();
  const anchor = new Date(now.getFullYear(), now.getMonth(), 1);

  for (let offset = REVENUE_WINDOW_MONTHS - 1; offset >= 0; offset -= 1) {
    const month = new Date(anchor.getFullYear(), anchor.getMonth() - offset, 1);
    const bucket = {
      key: monthKey(month),
      label: `${MONTH_LABELS[month.getMonth()]} ${String(month.getFullYear()).slice(2)}`,
      released: 0,
      count: 0,
    };
    buckets.set(bucket.key, bucket);
    monthly.push(bucket);
  }

  const writerTotals = new Map();
  let completedDays = 0;

  for (const assignment of assignments) {
    const value = assignmentValue(assignment);

    if (assignment.status === 'completed') {
      const { platformFee, writerEarnings } = splitPayment(value);

      totals.completed += 1;
      totals.released = roundCurrency(totals.released + value);
      totals.platformRevenue = roundCurrency(totals.platformRevenue + platformFee);
      totals.writerPayouts = roundCurrency(totals.writerPayouts + writerEarnings);

      const finished = new Date(assignment.completed_at || assignment.updated_at || 0).getTime();
      const created = new Date(assignment.created_at || 0).getTime();

      if (!Number.isNaN(finished)) {
        const bucket = buckets.get(monthKey(new Date(finished)));
        if (bucket) {
          bucket.released = roundCurrency(bucket.released + value);
          bucket.count += 1;
        }
      }

      if (!Number.isNaN(finished) && !Number.isNaN(created) && finished > created) {
        completedDays += (finished - created) / 86400000;
      }

      if (assignment.assigned_writer_id) {
        const previous = writerTotals.get(assignment.assigned_writer_id);
        const entry = previous || {
          id: assignment.assigned_writer_id,
          name: nameById.get(assignment.assigned_writer_id) || 'Unknown writer',
          earnings: 0,
          jobs: 0,
        };
        entry.earnings = roundCurrency(entry.earnings + writerEarnings);
        entry.jobs += 1;
        writerTotals.set(assignment.assigned_writer_id, entry);
      }
    } else if (assignment.status === 'disputed') {
      totals.disputed += 1;
      totals.held = roundCurrency(totals.held + value);
    } else if (assignment.status === 'cancelled') {
      totals.cancelled = roundCurrency(totals.cancelled + value);
    } else if (PIPELINE_STATUSES.includes(assignment.status)) {
      totals.pipeline = roundCurrency(totals.pipeline + value);
    }
  }

  if (totals.completed > 0) {
    totals.averageValue = roundCurrency(totals.released / totals.completed);
    totals.averageDaysToComplete = Math.round((completedDays / totals.completed) * 10) / 10;
  }

  const topWriters = [...writerTotals.values()]
    .sort((a, b) => b.earnings - a.earnings || a.name.localeCompare(b.name))
    .slice(0, 5);

  return { totals, monthly, topWriters };
}

/**
 * Evidence available in `profiles` that a reviewer can weigh before verifying.
 *
 * Signals are advisory, not a gate: the console shows how many are present and
 * leaves the decision to the administrator.
 */
export function buildVerificationSignals(profile) {
  if (!profile) return { ready: false, score: 0, total: 0, items: [] };

  const expertise = Array.isArray(profile.expertise)
    ? profile.expertise.filter((entry) => Boolean(String(entry || '').trim()))
    : [];

  const items = [
    { key: 'name', label: 'Full name', ok: Boolean(String(profile.full_name || '').trim()) },
    { key: 'photo', label: 'Profile photo', ok: Boolean(profile.avatar_url) },
    {
      key: 'bio',
      label: 'Bio of 20+ characters',
      ok: String(profile.bio || '').trim().length >= 20,
    },
    { key: 'expertise', label: 'Subject expertise', ok: expertise.length > 0 },
    { key: 'history', label: 'Completed work', ok: Number(profile.completed_assignments || 0) > 0 },
    { key: 'rating', label: 'Rated by students', ok: Number(profile.rating || 0) > 0 },
  ];

  const score = items.filter((item) => item.ok).length;

  return { ready: score >= 4, score, total: items.length, items };
}

/**
 * One account's footprint across the marketplace, for the user detail page.
 *
 * @param {object} input rows already filtered to this user
 */
export function summariseUserAccount({
  profile,
  assignmentsAsStudent = [],
  assignmentsAsWriter = [],
  bids = [],
  reviewsReceived = [],
  submissions = [],
} = {}) {
  const sumValue = (rows) => roundCurrency(rows.reduce((total, row) => total + assignmentValue(row), 0));
  const completedAsStudent = assignmentsAsStudent.filter((row) => row.status === 'completed');
  const completedAsWriter = assignmentsAsWriter.filter((row) => row.status === 'completed');

  const earned = roundCurrency(
    completedAsWriter.reduce(
      (total, row) => total + splitPayment(assignmentValue(row)).writerEarnings,
      0
    )
  );

  const acceptedBids = bids.filter((bid) => bid.status === 'accepted').length;
  const rating = computeRatingSummary(reviewsReceived);

  const activityTimes = [...assignmentsAsStudent, ...assignmentsAsWriter, ...bids, ...reviewsReceived, ...submissions]
    .map((row) => new Date(row.created_at || row.updated_at || 0).getTime())
    .filter((time) => !Number.isNaN(time) && time > 0)
    .sort((a, b) => b - a);

  return {
    role: profile?.user_type || null,
    asStudent: {
      posted: assignmentsAsStudent.length,
      completed: completedAsStudent.length,
      disputed: assignmentsAsStudent.filter((row) => row.status === 'disputed').length,
      spent: sumValue(completedAsStudent),
    },
    asWriter: {
      awarded: assignmentsAsWriter.length,
      completed: completedAsWriter.length,
      disputed: assignmentsAsWriter.filter((row) => row.status === 'disputed').length,
      earned,
    },
    bids: {
      total: bids.length,
      accepted: acceptedBids,
      pending: bids.filter((bid) => bid.status === 'pending').length,
      winRate: bids.length ? Math.round((acceptedBids / bids.length) * 100) : 0,
    },
    reviews: {
      received: rating.count,
      average: rating.average,
      lowRatings: reviewsReceived.filter((row) => Number(row.rating) <= 2).length,
    },
    submissions: {
      total: submissions.length,
      approved: submissions.filter((row) => row.status === 'approved').length,
      revisionRequested: submissions.filter((row) => row.status === 'revision_requested').length,
      rejected: submissions.filter((row) => row.status === 'rejected').length,
      awaitingReview: submissions.filter((row) => row.status === 'submitted').length,
    },
    lastActivityAt: activityTimes.length ? new Date(activityTimes[0]).toISOString() : null,
  };
}
