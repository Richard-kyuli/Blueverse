import { describe, it, expect } from 'vitest';
import { CheckCircle2, FileText } from 'lucide-react';
import {
  PLATFORM_FEE_RATE,
  buildEarningsSummary,
  buildPaymentSummary,
  roundCurrency,
  splitPayment,
  toAmount,
  writerEarningsFor,
} from './payments';
import {
  ACTIVE_ASSIGNMENT_STATUSES,
  deadlineLabel,
  daysUntil,
  isOverdue,
  statusIcon,
  statusLabel,
  statusTone,
} from './status';

// Locally constructed dates keep these tests independent of the machine timezone.
const NOW = new Date(2026, 9, 26, 12, 0, 0); // 26 Oct 2026, midday

const assignment = (overrides = {}) => ({
  id: 'a',
  title: 'Essay',
  status: 'completed',
  final_price: 100,
  created_at: new Date(2026, 8, 1, 9).toISOString(),
  updated_at: new Date(2026, 8, 2, 9).toISOString(),
  completed_at: new Date(2026, 8, 3, 9).toISOString(),
  ...overrides,
});

describe('payment arithmetic', () => {
  it('exposes the 15% platform fee', () => {
    expect(PLATFORM_FEE_RATE).toBe(0.15);
  });

  it('splits a gross amount into fee and writer earnings', () => {
    expect(splitPayment(80)).toEqual({ amount: 80, platformFee: 12, writerEarnings: 68 });
  });

  it('rounds awkward numbers to cents', () => {
    expect(splitPayment('49.99')).toEqual({ amount: 49.99, platformFee: 7.5, writerEarnings: 42.49 });
  });

  it('treats missing values as zero', () => {
    expect(splitPayment(null)).toEqual({ amount: 0, platformFee: 0, writerEarnings: 0 });
    expect(splitPayment(undefined)).toEqual({ amount: 0, platformFee: 0, writerEarnings: 0 });
    expect(toAmount('not a number')).toBe(0);
  });

  it('rounds floats to two decimals', () => {
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
    expect(roundCurrency('1.005')).toBe(1.01);
  });

  it('reports the writer take-home for one job', () => {
    expect(writerEarningsFor(200)).toBe(170);
  });
});

describe('buildEarningsSummary', () => {
  it('only counts funded assignments', () => {
    const summary = buildEarningsSummary(
      [
        assignment({ id: 'open', status: 'open' }),
        assignment({ id: 'cancelled', status: 'cancelled' }),
        assignment({ id: 'no-price', status: 'completed', final_price: null }),
      ],
      NOW
    );

    expect(summary.completed).toHaveLength(0);
    expect(summary.pending).toHaveLength(0);
    expect(summary.totals.totalEarned).toBe(0);
  });

  it('separates released earnings from work still in flight', () => {
    const summary = buildEarningsSummary(
      [
        assignment({ id: 'done', status: 'completed', final_price: 100 }),
        assignment({ id: 'review', status: 'under_review', final_price: 50 }),
        assignment({ id: 'writing', status: 'in_progress', final_price: 20 }),
        assignment({ id: 'awarded', status: 'assigned', final_price: 10 }),
      ],
      NOW
    );

    expect(summary.completed.map((row) => row.id)).toEqual(['done']);
    expect(summary.pending.map((row) => row.id).sort()).toEqual(['awarded', 'review', 'writing']);
    expect(summary.totals).toMatchObject({
      totalEarned: 85,
      grossEarned: 100,
      platformFees: 15,
      pendingEarnings: 68,
      completedCount: 1,
      pendingCount: 3,
      averagePerJob: 85,
    });
  });

  it('treats a disputed job as money still in flight', () => {
    const summary = buildEarningsSummary(
      [assignment({ id: 'dispute', status: 'disputed', final_price: 30 })],
      NOW
    );

    expect(summary.completed).toHaveLength(0);
    expect(summary.pending.map((row) => row.id)).toEqual(['dispute']);
    expect(summary.totals.pendingEarnings).toBe(25.5);
  });

  it('counts only completions from the current month in earnedThisMonth', () => {
    const summary = buildEarningsSummary(
      [
        assignment({ id: 'last-month', final_price: 100, completed_at: new Date(2026, 8, 28, 9).toISOString() }),
        assignment({ id: 'this-month', final_price: 40, completed_at: new Date(2026, 9, 2, 9).toISOString() }),
      ],
      NOW
    );

    expect(summary.totals.totalEarned).toBe(119);
    expect(summary.totals.earnedThisMonth).toBe(34);
  });

  it('orders completed rows newest first and survives empty input', () => {
    const summary = buildEarningsSummary(
      [
        assignment({ id: 'older', completed_at: new Date(2026, 7, 1, 9).toISOString() }),
        assignment({ id: 'newer', completed_at: new Date(2026, 8, 20, 9).toISOString() }),
      ],
      NOW
    );

    expect(summary.completed.map((row) => row.id)).toEqual(['newer', 'older']);
    expect(buildEarningsSummary().totals.completedCount).toBe(0);
    expect(buildEarningsSummary(null).totals.totalEarned).toBe(0);
  });
});

describe('buildPaymentSummary', () => {
  it('splits released charges from money held for active work', () => {
    const summary = buildPaymentSummary([
      assignment({ id: 'paid', status: 'completed', final_price: 80 }),
      assignment({ id: 'held', status: 'in_progress', final_price: 25 }),
      assignment({ id: 'shopping', status: 'open', final_price: null }),
    ]);

    expect(summary.charges).toHaveLength(2);
    expect(summary.totals).toMatchObject({
      totalSpent: 80,
      inEscrow: 25,
      completedCount: 1,
      inFlightCount: 1,
      averagePaid: 80,
    });
    expect(summary.charges.find((row) => row.id === 'paid').released).toBe(true);
    expect(summary.charges.find((row) => row.id === 'held').released).toBe(false);
  });

  it('keeps disputed amounts visible as held', () => {
    const summary = buildPaymentSummary([assignment({ id: 'dispute', status: 'disputed', final_price: 30 })]);

    expect(summary.totals).toMatchObject({ inEscrow: 30, totalSpent: 0, inFlightCount: 1 });
  });

  it('handles a student with no funded work', () => {
    expect(buildPaymentSummary([]).totals).toMatchObject({ totalSpent: 0, inEscrow: 0, averagePaid: 0 });
  });
});

describe('status helpers', () => {
  it('humanises underscore statuses', () => {
    expect(statusLabel('under_review')).toBe('under review');
    expect(statusLabel(undefined)).toBe('Unknown');
  });

  it('falls back to the open tone for unknown statuses', () => {
    expect(statusTone('completed')).toContain('green');
    expect(statusTone('mystery')).toBe(statusTone('open'));
    expect(statusIcon('completed')).toBe(CheckCircle2);
    expect(statusIcon('mystery')).toBe(FileText);
  });

  it('treats assigned and in_progress as the active statuses', () => {
    expect(ACTIVE_ASSIGNMENT_STATUSES).toEqual(['assigned', 'in_progress']);
  });
});

describe('deadline helpers', () => {
  it('counts whole days from today', () => {
    expect(daysUntil(new Date(2026, 9, 28, 8), NOW)).toBe(2);
    expect(daysUntil(null, NOW)).toBeNull();
  });

  it('describes overdue, today and upcoming deadlines', () => {
    expect(deadlineLabel(new Date(2026, 9, 24, 8), NOW)).toBe('2 days overdue');
    expect(deadlineLabel(new Date(2026, 9, 25, 8), NOW)).toBe('1 day overdue');
    expect(deadlineLabel(new Date(2026, 9, 26, 23), NOW)).toBe('Due today');
    expect(deadlineLabel(new Date(2026, 9, 27, 8), NOW)).toBe('Due tomorrow');
    expect(deadlineLabel(new Date(2026, 9, 30, 8), NOW)).toBe('Due in 4 days');
    expect(deadlineLabel(null, NOW)).toBe('No deadline');
  });

  it('flags overdue deadlines only', () => {
    expect(isOverdue(new Date(2026, 9, 25, 8), NOW)).toBe(true);
    expect(isOverdue(new Date(2026, 9, 26, 8), NOW)).toBe(false);
    expect(isOverdue(null, NOW)).toBe(false);
  });
});
