'use client';

import { AlertTriangle, Clock } from 'lucide-react';
import { disputeOpenedByLabel, disputeSummary } from '@/lib/disputes';

/**
 * Read-only panel describing an open dispute.
 *
 * Returns null unless the assignment is actually disputed, so pages can render
 * it unconditionally. Both dashboards and the assignment page use it so the
 * reason, the category and the held-payment message read the same everywhere.
 *
 * @param {Object} props
 * @param {Object} props.assignment - Assignment row (dispute_* columns optional)
 * @param {'student'|'writer'|'admin'|null} props.viewerRole - Who is reading
 * @param {React.ReactNode} [props.action] - Optional button, e.g. a link to Messages
 * @param {boolean} [props.compact] - Tighter layout for dashboard cards
 */
export default function DisputeNotice({ assignment, viewerRole = null, action = null, compact = false }) {
  const summary = disputeSummary(assignment);
  if (!summary) return null;

  const openedAt = summary.raisedAt
    ? new Date(summary.raisedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <section
      className={`rounded-xl border border-red-200 bg-red-50 ${compact ? 'p-3' : 'p-4'}`}
      aria-label="Open dispute"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className={`shrink-0 text-red-700 ${compact ? 'mt-0.5 h-4 w-4' : 'mt-0.5 h-5 w-5'}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className={`font-semibold text-red-900 ${compact ? 'text-sm' : 'text-base'}`}>
              {disputeOpenedByLabel(assignment, viewerRole)}
            </h3>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-red-800">
              {summary.categoryLabel}
            </span>
            {openedAt && (
              <span className="inline-flex items-center gap-1 text-xs text-red-800/70">
                <Clock className="h-3 w-3" />
                {openedAt}
              </span>
            )}
          </div>

          {summary.details ? (
            <p className={`mt-2 whitespace-pre-line text-red-900 ${compact ? 'text-xs' : 'text-sm'}`}>
              {summary.details}
            </p>
          ) : (
            <p className={`mt-2 text-red-800/80 ${compact ? 'text-xs' : 'text-sm'}`}>
              No reason was recorded with this dispute. Describe it in Messages so support
              has the full story.
            </p>
          )}

          <p className={`mt-2 text-red-800/80 ${compact ? 'text-xs' : 'text-sm'}`}>
            Payment stays on hold until BlueVerse support settles it. Keep talking in
            Messages, because those messages are part of the evidence.
          </p>

          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </section>
  );
}
