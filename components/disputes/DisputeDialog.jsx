'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  DISPUTE_CATEGORIES,
  MAX_DISPUTE_DETAILS,
  MIN_DISPUTE_DETAILS,
  validateDisputeInput,
} from '@/lib/disputes';

/**
 * Dialog for opening a dispute on an assignment.
 *
 * Used by both parties on the assignment page. Validation happens here first so
 * the user gets an inline message instead of a round trip, but the API route
 * re-validates because this component is not the trust boundary.
 *
 * @param {Object} props
 * @param {Object} props.assignment - The assignment being disputed
 * @param {Function} props.onCancel - Close without opening anything
 * @param {Function} props.onOpened - Called with the API result after success
 */
export default function DisputeDialog({ assignment, onCancel, onOpened }) {
  const [category, setCategory] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const typed = details.trim().length;
  const missing = MIN_DISPUTE_DETAILS - typed;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    const validated = validateDisputeInput({ category, details });
    if (!validated.ok) {
      setError(validated.error);
      return;
    }

    setSubmitting(true);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const response = await fetch(`/api/assignments/${assignment.id}/dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ category: validated.category, details: validated.details }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not open the dispute');
      }

      toast.success(result.message || 'Dispute opened');
      setSubmitting(false);

      if (onOpened) {
        await onOpened(result);
      }
    } catch (submitError) {
      console.error('Dispute error:', submitError);
      setError(submitError.message || 'Could not open the dispute');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brandNavy/40 p-4">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-brandGrid bg-white p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispute-dialog-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="dispute-dialog-title" className="text-lg font-bold text-brandNavy">
              Open a dispute
            </h2>
            <p className="mt-1 text-sm text-textBody">
              <span className="font-medium text-brandNavy">{assignment.title}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Close"
            className="rounded-lg p-1 text-textMuted transition-colors hover:bg-brandIce hover:text-brandNavy disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p className="text-xs leading-relaxed text-amber-900">
            Both parties are notified and the payment stays on hold while support reviews
            it. You cannot withdraw a dispute from this screen, so only open one when the
            work has genuinely broken down.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5">
          <fieldset>
            <legend className="text-sm font-medium text-brandNavy">What went wrong?</legend>
            <div className="mt-2 space-y-2">
              {DISPUTE_CATEGORIES.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    category === option.value
                      ? 'border-brandAccent bg-brandIce'
                      : 'border-brandGrid hover:bg-brandIce'
                  }`}
                >
                  <input
                    type="radio"
                    name="dispute-category"
                    value={option.value}
                    checked={category === option.value}
                    onChange={(event) => setCategory(event.target.value)}
                    disabled={submitting}
                    className="mt-1 h-4 w-4 accent-brandAccent"
                  />
                  <span>
                    <span className="block text-sm font-medium text-brandNavy">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-textMuted">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-5">
            <label htmlFor="dispute-details" className="text-sm font-medium text-brandNavy">
              What happened?
            </label>
            <p className="mt-1 text-xs text-textMuted">
              Dates, messages and the files involved all help support decide without asking
              you again.
            </p>
            <textarea
              id="dispute-details"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={5}
              maxLength={MAX_DISPUTE_DETAILS}
              disabled={submitting}
              className="mt-2 w-full rounded-lg border border-brandGrid p-3 text-sm text-textDark focus:border-brandAccent focus:outline-none disabled:bg-brandIce"
              placeholder="The deadline was Friday and the last message from the writer was three days ago."
            />
            <div className="mt-1 flex justify-between text-xs text-textMuted">
              <span>
                {missing > 0
                  ? `${missing} more character${missing === 1 ? '' : 's'} needed`
                  : 'Minimum reached'}
              </span>
              <span>
                {typed}/{MAX_DISPUTE_DETAILS}
              </span>
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded-lg border border-brandGrid px-4 py-2 text-sm font-medium text-textBody transition-colors hover:bg-brandIce disabled:opacity-50"
            >
              Keep working
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Opening...' : 'Open dispute'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
