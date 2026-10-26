/**
 * Money helpers shared by the student payments page, the writer earnings page
 * and both dashboards.
 *
 * `transactions` is reserved for real Stripe records, which this build does not
 * create yet, so both pages derive their numbers from the assignments the user
 * actually took part in. Keeping the arithmetic here means the dashboard card
 * and the earnings page can never disagree.
 */

import { FUNDED_ASSIGNMENT_STATUSES } from './status';

/** BlueVerse keeps 15% of every completed assignment. */
export const PLATFORM_FEE_RATE = 0.15;

/**
 * A disputed assignment still holds the student's money, so it belongs in both
 * ledgers even though it is neither released nor ordinary active work.
 */
const BILLABLE_ASSIGNMENT_STATUSES = [...FUNDED_ASSIGNMENT_STATUSES, 'disputed'];

/** Round to cents so floating point noise never reaches the UI. */
export function roundCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  // Number.EPSILON nudges values like 1.005 (stored as 1.00499999…) up to the
  // cent a human expects instead of silently truncating them.
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** Parse a numeric column that may arrive as a string, null or undefined. */
export function toAmount(value) {
  if (value === null || value === undefined || value === '') return 0;
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? amount : 0;
}

/**
 * Split a gross price into the platform fee and what the writer keeps.
 */
export function splitPayment(gross) {
  const amount = roundCurrency(toAmount(gross));
  const platformFee = roundCurrency(amount * PLATFORM_FEE_RATE);
  return {
    amount,
    platformFee,
    writerEarnings: roundCurrency(amount - platformFee),
  };
}

/** Net amount a writer keeps for a single job. */
export function writerEarningsFor(gross) {
  return splitPayment(gross).writerEarnings;
}

function sum(values) {
  return roundCurrency(values.reduce((total, value) => total + value, 0));
}

function timestampOf(assignment) {
  return assignment.completed_at || assignment.submitted_at || assignment.updated_at || assignment.created_at;
}

function startedThisMonth(assignment, now) {
  const stamp = timestampOf(assignment);
  if (!stamp) return false;
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return false;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return date >= monthStart;
}

/**
 * Writer side: what has been earned, what is still pending approval and what
 * landed this month.
 *
 * @param {Array<object>} assignments assignments assigned to the writer
 * @param {Date} now reference date, injectable for tests
 */
export function buildEarningsSummary(assignments = [], now = new Date()) {
  const completed = [];
  const pending = [];

  for (const assignment of assignments || []) {
    if (!assignment || assignment.final_price === null || assignment.final_price === undefined) continue;
    if (!BILLABLE_ASSIGNMENT_STATUSES.includes(assignment.status)) continue;

    const row = { ...assignment, ...splitPayment(assignment.final_price) };
    if (assignment.status === 'completed') {
      completed.push({ ...row, released: true });
    } else {
      pending.push({ ...row, released: false });
    }
  }

  const mostRecentFirst = (a, b) => new Date(timestampOf(b) || 0) - new Date(timestampOf(a) || 0);
  completed.sort(mostRecentFirst);
  pending.sort(mostRecentFirst);

  const grossEarned = sum(completed.map((row) => row.amount));
  const totalEarned = sum(completed.map((row) => row.writerEarnings));

  return {
    completed,
    pending,
    totals: {
      totalEarned,
      grossEarned,
      platformFees: sum(completed.map((row) => row.platformFee)),
      pendingEarnings: sum(pending.map((row) => row.writerEarnings)),
      earnedThisMonth: sum(
        completed.filter((row) => startedThisMonth(row, now)).map((row) => row.writerEarnings)
      ),
      completedCount: completed.length,
      pendingCount: pending.length,
      averagePerJob: completed.length ? roundCurrency(totalEarned / completed.length) : 0,
    },
  };
}

/**
 * Student side: what has been paid out and what is currently held for work in
 * flight.
 *
 * @param {Array<object>} assignments assignments owned by the student
 */
export function buildPaymentSummary(assignments = []) {
  const charges = [];

  for (const assignment of assignments || []) {
    if (!assignment || assignment.final_price === null || assignment.final_price === undefined) continue;
    if (!BILLABLE_ASSIGNMENT_STATUSES.includes(assignment.status)) continue;

    charges.push({
      ...assignment,
      ...splitPayment(assignment.final_price),
      released: assignment.status === 'completed',
    });
  }

  charges.sort((a, b) => new Date(timestampOf(b) || 0) - new Date(timestampOf(a) || 0));

  const released = charges.filter((row) => row.released);
  const held = charges.filter((row) => !row.released);
  const totalSpent = sum(released.map((row) => row.amount));

  return {
    charges,
    totals: {
      totalSpent,
      inEscrow: sum(held.map((row) => row.amount)),
      completedCount: released.length,
      inFlightCount: held.length,
      averagePaid: released.length ? roundCurrency(totalSpent / released.length) : 0,
    },
  };
}
