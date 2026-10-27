'use client';

import { ASSIGNMENT_ACTIONS, ASSIGNMENT_ACTION_LABELS } from '@/lib/admin';

/**
 * Confirmation dialog for settling a dispute.
 *
 * Shared by the assignments table and the disputes queue so the wording, the
 * money figure and the button tone stay identical wherever an administrator
 * makes the same decision.
 */

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

const ACTION_HINTS = {
  [ASSIGNMENT_ACTIONS.release]:
    'The held funds count as paid. The writer is notified and their completed job count increases.',
  [ASSIGNMENT_ACTIONS.refund]:
    'The assignment closes and the student is notified that their payment was refunded.',
  [ASSIGNMENT_ACTIONS.cancel]:
    'The assignment closes with no payment released. Both parties are notified.',
};

const ACTION_TONES = {
  [ASSIGNMENT_ACTIONS.release]:
    'bg-green-600 hover:bg-green-700 text-white border border-green-600',
  [ASSIGNMENT_ACTIONS.refund]: 'text-red-700 border border-red-200 hover:bg-red-50',
  [ASSIGNMENT_ACTIONS.cancel]: 'text-textBody border border-brandGrid hover:bg-brandIce',
};

/** Button classes for one resolve action, so rows and dialogs agree. */
export function resolveActionTone(action) {
  return ACTION_TONES[action] || ACTION_TONES[ASSIGNMENT_ACTIONS.cancel];
}

export default function AssignmentResolveDialog({ assignment, action, busy, onCancel, onConfirm }) {
  const label = ASSIGNMENT_ACTION_LABELS[action] || 'Resolve';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brandNavy/40 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-brandGrid bg-white p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resolve-dialog-title"
      >
        <h2 id="resolve-dialog-title" className="text-lg font-bold text-brandNavy">
          {label}?
        </h2>
        <p className="mt-2 text-sm text-textBody">
          <span className="font-medium text-brandNavy">{assignment.title}</span> is worth{' '}
          {money(assignment.final_price ?? assignment.budget_max)}.
        </p>
        <p className="mt-2 text-sm text-textMuted">{ACTION_HINTS[action]}</p>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-brandGrid px-4 py-2 text-sm font-medium text-textBody transition-colors hover:bg-brandIce disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${resolveActionTone(action)}`}
          >
            {busy ? 'Applying...' : label}
          </button>
        </div>
      </div>
    </div>
  );
}
