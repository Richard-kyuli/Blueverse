import { describe, it, expect } from 'vitest';
import {
  DISPUTABLE_STATUSES,
  DISPUTE_CATEGORIES,
  MAX_DISPUTE_DETAILS,
  MIN_DISPUTE_DETAILS,
  buildDisputeUpdate,
  canRaiseDispute,
  disputeCategoryLabel,
  disputeOpenedByLabel,
  disputeSummary,
  validateDisputeInput,
} from './disputes';

const NOW = new Date('2026-10-27T12:00:00.000Z');

const STUDENT = 'student-1';
const WRITER = 'writer-1';
const STRANGER = 'stranger-1';

function assignment(overrides = {}) {
  return {
    id: 'a1',
    title: 'Climate Policy Essay',
    status: 'in_progress',
    student_id: STUDENT,
    assigned_writer_id: WRITER,
    ...overrides,
  };
}

const LONG_ENOUGH = 'The writer delivered two of the four sections and stopped replying.';

describe('canRaiseDispute', () => {
  it('lets the student open a dispute on active work', () => {
    const result = canRaiseDispute(assignment(), STUDENT);
    expect(result).toMatchObject({ ok: true, status: 200, role: 'student' });
  });

  it('lets the assigned writer open one too', () => {
    const result = canRaiseDispute(assignment({ status: 'under_review' }), WRITER);
    expect(result).toMatchObject({ ok: true, role: 'writer' });
  });

  it('accepts every disputable status', () => {
    for (const status of DISPUTABLE_STATUSES) {
      expect(canRaiseDispute(assignment({ status }), STUDENT).ok).toBe(true);
    }
  });

  it('refuses anyone who is not a party to the assignment', () => {
    const result = canRaiseDispute(assignment(), STRANGER);
    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(result.reason).toMatch(/only the student and the assigned writer/i);
  });

  it('refuses a missing assignment with 404', () => {
    expect(canRaiseDispute(null, STUDENT)).toMatchObject({ ok: false, status: 404 });
  });

  it('refuses an anonymous caller with 401', () => {
    expect(canRaiseDispute(assignment(), null)).toMatchObject({ ok: false, status: 401 });
  });

  it('refuses a second dispute on the same assignment', () => {
    const result = canRaiseDispute(assignment({ status: 'disputed' }), STUDENT);
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(result.reason).toMatch(/already in dispute/i);
  });

  it('refuses an assignment with no writer yet', () => {
    const result = canRaiseDispute(assignment({ status: 'open', assigned_writer_id: null }), STUDENT);
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(result.reason).toMatch(/no writer has been assigned/i);
  });

  it('points a completed assignment at support instead of reopening it', () => {
    const result = canRaiseDispute(assignment({ status: 'completed' }), STUDENT);
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(result.reason).toMatch(/already completed/i);
  });

  it('names the status it will not reopen', () => {
    expect(canRaiseDispute(assignment({ status: 'cancelled' }), WRITER).reason).toMatch(
      /cancelled cannot be disputed/i
    );
  });
});

describe('validateDisputeInput', () => {
  it('accepts a category with enough detail and trims it', () => {
    const result = validateDisputeInput({ category: 'quality', details: `  ${LONG_ENOUGH}  ` });
    expect(result).toMatchObject({ ok: true, category: 'quality', details: LONG_ENOUGH });
  });

  it('rejects an unknown category', () => {
    const result = validateDisputeInput({ category: 'because', details: LONG_ENOUGH });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/choose a reason/i);
  });

  it('rejects a missing category', () => {
    expect(validateDisputeInput({ details: LONG_ENOUGH }).ok).toBe(false);
  });

  it('rejects a description shorter than the minimum', () => {
    const result = validateDisputeInput({ category: 'other', details: 'not happy' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain(String(MIN_DISPUTE_DETAILS));
  });

  it('treats whitespace-only detail as missing', () => {
    expect(validateDisputeInput({ category: 'other', details: '          ' }).ok).toBe(false);
  });

  it('rejects a description over the maximum', () => {
    const result = validateDisputeInput({
      category: 'other',
      details: 'x'.repeat(MAX_DISPUTE_DETAILS + 1),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain(String(MAX_DISPUTE_DETAILS));
  });

  it('accepts every offered category with valid detail', () => {
    for (const category of DISPUTE_CATEGORIES) {
      expect(validateDisputeInput({ category: category.value, details: LONG_ENOUGH }).ok).toBe(true);
    }
  });
});

describe('buildDisputeUpdate', () => {
  it('sets the status, the reason and who opened it', () => {
    expect(
      buildDisputeUpdate({ category: 'off_brief', details: LONG_ENOUGH, userId: STUDENT }, NOW)
    ).toEqual({
      status: 'disputed',
      dispute_category: 'off_brief',
      dispute_details: LONG_ENOUGH,
      disputed_at: NOW.toISOString(),
      disputed_by: STUDENT,
    });
  });
});

describe('disputeSummary', () => {
  const stored = {
    ...assignment({ status: 'disputed' }),
    dispute_category: 'deadline',
    dispute_details: LONG_ENOUGH,
    disputed_at: '2026-10-26T09:00:00.000Z',
    disputed_by: STUDENT,
  };

  it('returns null unless the assignment is disputed', () => {
    expect(disputeSummary(assignment())).toBeNull();
    expect(disputeSummary(null)).toBeNull();
  });

  it('describes a stored dispute, including who opened it', () => {
    const summary = disputeSummary(stored);
    expect(summary).toMatchObject({
      category: 'deadline',
      categoryLabel: 'The agreed deadline was missed',
      details: LONG_ENOUGH,
      raisedAt: '2026-10-26T09:00:00.000Z',
      raisedByRole: 'student',
      hasReason: true,
    });
  });

  it('attributes a writer-opened dispute to the writer', () => {
    expect(disputeSummary({ ...stored, disputed_by: WRITER }).raisedByRole).toBe('writer');
  });

  it('still reports an open dispute when the reason columns were never added', () => {
    const bare = disputeSummary(assignment({ status: 'disputed' }));
    expect(bare).toMatchObject({ category: null, details: '', raisedByRole: null, hasReason: false });
    expect(bare.categoryLabel).toBe('Dispute');
  });
});

describe('disputeCategoryLabel', () => {
  it('maps known values and falls back safely', () => {
    expect(disputeCategoryLabel('not_delivered')).toBe('Work has not been delivered');
    expect(disputeCategoryLabel('something_else')).toBe('Dispute');
    expect(disputeCategoryLabel(null)).toBe('Dispute');
  });
});

describe('disputeOpenedByLabel', () => {
  const disputed = {
    ...assignment({ status: 'disputed' }),
    disputed_by: STUDENT,
  };

  it('speaks in the first person to whoever opened it', () => {
    expect(disputeOpenedByLabel(disputed, 'student')).toBe('You opened this dispute');
  });

  it('names the other party for everyone else', () => {
    expect(disputeOpenedByLabel(disputed, 'writer')).toBe('The student opened this dispute');
    expect(disputeOpenedByLabel(disputed, 'admin')).toBe('The student opened this dispute');
  });

  it('falls back when the opener is unknown', () => {
    const unattributed = { ...assignment({ status: 'disputed' }) };
    expect(disputeOpenedByLabel(unattributed, 'writer')).toBe('A dispute is open on this assignment');
  });
});
