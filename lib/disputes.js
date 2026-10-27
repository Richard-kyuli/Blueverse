/**
 * Dispute rules shared by the API route, the dialog and the notice banner.
 *
 * A dispute is the only way an assignment reaches the `disputed` status, which
 * the admin console treats as "held funds awaiting a decision". Before this
 * module, nothing in the app ever wrote that status, so the admin queue could
 * only ever be empty.
 *
 * The helpers here are pure and side-effect free, following the same shape as
 * lib/admin.js: `can*` decides, `build*` produces the row update, so the route
 * and the page agree and both can be tested without a database.
 */

/** Reasons a participant can pick when opening a dispute. */
export const DISPUTE_CATEGORIES = Object.freeze([
  {
    value: 'not_delivered',
    label: 'Work has not been delivered',
    hint: 'The deadline has passed and nothing usable has arrived.',
  },
  {
    value: 'off_brief',
    label: 'Work does not match the brief',
    hint: 'Delivered files ignore the requirements, sources or format asked for.',
  },
  {
    value: 'quality',
    label: 'Quality is below the agreed standard',
    hint: 'The work is complete but not at the level the bid promised.',
  },
  {
    value: 'deadline',
    label: 'The agreed deadline was missed',
    hint: 'Work arrived late enough to miss your own submission date.',
  },
  {
    value: 'approval',
    label: 'We cannot agree on approval',
    hint: 'Revision requests and resubmissions have already gone back and forth.',
  },
  {
    value: 'other',
    label: 'Something else',
    hint: 'Anything the categories above do not cover.',
  },
]);

export const DISPUTE_CATEGORY_VALUES = Object.freeze(
  DISPUTE_CATEGORIES.map((category) => category.value)
);

/**
 * Statuses a dispute can be opened from.
 *
 * `open` has no writer to dispute; `completed` has already released the money
 * and would need a clawback the platform cannot perform; `cancelled` and
 * `disputed` are terminal for this flow.
 */
export const DISPUTABLE_STATUSES = Object.freeze(['assigned', 'in_progress', 'under_review']);

export const MIN_DISPUTE_DETAILS = 20;
export const MAX_DISPUTE_DETAILS = 2000;

/** Human label for a stored category, tolerating rows written before it existed. */
export function disputeCategoryLabel(value) {
  const match = DISPUTE_CATEGORIES.find((category) => category.value === value);
  return match ? match.label : 'Dispute';
}

/**
 * Whether this user may open a dispute on this assignment.
 *
 * @param {object|null} assignment assignment row
 * @param {string|null} userId authenticated user id
 * @returns {{ok: boolean, status: number, reason: string, role: string|null}}
 */
export function canRaiseDispute(assignment, userId) {
  if (!assignment) {
    return { ok: false, status: 404, reason: 'Assignment not found', role: null };
  }

  if (!userId) {
    return { ok: false, status: 401, reason: 'You must be signed in', role: null };
  }

  let role = null;
  if (assignment.student_id === userId) role = 'student';
  else if (assignment.assigned_writer_id === userId) role = 'writer';

  if (!role) {
    return {
      ok: false,
      status: 403,
      reason: 'Only the student and the assigned writer can open a dispute',
      role: null,
    };
  }

  if (assignment.status === 'disputed') {
    return { ok: false, status: 409, reason: 'This assignment is already in dispute', role };
  }

  if (!DISPUTABLE_STATUSES.includes(assignment.status)) {
    const readable = String(assignment.status || 'unknown').replace(/_/g, ' ');
    return {
      ok: false,
      status: 409,
      reason:
        assignment.status === 'open'
          ? 'No writer has been assigned yet, so there is nothing to dispute'
          : assignment.status === 'completed'
            ? 'This assignment is already completed; contact support instead'
            : `An assignment that is ${readable} cannot be disputed`,
      role,
    };
  }

  return { ok: true, status: 200, reason: '', role };
}

/**
 * Validate the text a participant sends with a dispute.
 *
 * The minimum length is deliberate: "not happy" gives a mediator nothing to
 * work with, and the whole point of the reason is to make the admin decision
 * possible without interviewing both sides first.
 */
export function validateDisputeInput({ category, details } = {}) {
  const value = String(category || '').trim();

  if (!DISPUTE_CATEGORY_VALUES.includes(value)) {
    return { ok: false, error: 'Choose a reason for the dispute' };
  }

  const text = typeof details === 'string' ? details.trim() : '';

  if (text.length < MIN_DISPUTE_DETAILS) {
    return {
      ok: false,
      error: `Describe what happened in at least ${MIN_DISPUTE_DETAILS} characters`,
    };
  }

  if (text.length > MAX_DISPUTE_DETAILS) {
    return {
      ok: false,
      error: `Keep the description under ${MAX_DISPUTE_DETAILS} characters`,
    };
  }

  return { ok: true, category: value, details: text };
}

/**
 * The row update that opens a dispute.
 *
 * `disputed_at` and `disputed_by` only exist once supabase-disputes-workflow.sql
 * has been applied; the route falls back to a bare status change when they do
 * not, so an un-migrated deployment still gets a working queue.
 */
export function buildDisputeUpdate({ category, details, userId }, now = new Date()) {
  return {
    status: 'disputed',
    dispute_category: category,
    dispute_details: details,
    disputed_at: now.toISOString(),
    disputed_by: userId,
  };
}

/**
 * Everything the UI needs to describe an open dispute.
 *
 * Returns null when the assignment is not disputed, so callers can use it as a
 * render guard. Missing columns degrade to a bare notice rather than throwing.
 */
export function disputeSummary(assignment) {
  if (!assignment || assignment.status !== 'disputed') return null;

  const raisedBy = assignment.disputed_by || null;
  let raisedByRole = null;
  if (raisedBy && raisedBy === assignment.student_id) raisedByRole = 'student';
  else if (raisedBy && raisedBy === assignment.assigned_writer_id) raisedByRole = 'writer';

  const details = typeof assignment.dispute_details === 'string' ? assignment.dispute_details.trim() : '';

  return {
    category: assignment.dispute_category || null,
    categoryLabel: disputeCategoryLabel(assignment.dispute_category),
    details,
    raisedAt: assignment.disputed_at || null,
    raisedBy,
    raisedByRole,
    hasReason: Boolean(assignment.dispute_category || details),
  };
}

/**
 * Who opened it, phrased for the person reading the screen.
 *
 * @param {object} assignment disputed assignment
 * @param {'student'|'writer'|'admin'|null} viewerRole
 */
export function disputeOpenedByLabel(assignment, viewerRole) {
  const summary = disputeSummary(assignment);
  if (!summary) return '';

  if (summary.raisedByRole && summary.raisedByRole === viewerRole) return 'You opened this dispute';
  if (summary.raisedByRole === 'student') return 'The student opened this dispute';
  if (summary.raisedByRole === 'writer') return 'The writer opened this dispute';
  return 'A dispute is open on this assignment';
}
