'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  RotateCcw,
  Undo2,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import AdminOnly from '@/components/admin/AdminOnly';
import AssignmentResolveDialog, { resolveActionTone } from '@/components/admin/AssignmentResolveDialog';
import { adminFetch } from '@/lib/adminApi';
import { ASSIGNMENT_ACTIONS, assignmentValue, canResolveAssignment } from '@/lib/admin';
import { statusLabel } from '@/lib/status';
import { disputeOpenedByLabel, disputeSummary } from '@/lib/disputes';

/**
 * Disputes queue.
 *
 * A focused view of `assignments?status=disputed`: the parties, what money is
 * held, and the delivery history that a decision should be based on. The
 * decision itself goes through the same PATCH /api/admin/assignments handler as
 * the full assignments table, so both screens cannot disagree about what an
 * action does.
 */

const PAGE_SIZE = 20;

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

function formatDate(value) {
  if (!value) return 'n/a';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'n/a' : date.toLocaleDateString();
}

const ACTION_ICONS = {
  [ASSIGNMENT_ACTIONS.release]: AlertTriangle,
  [ASSIGNMENT_ACTIONS.refund]: Undo2,
  [ASSIGNMENT_ACTIONS.cancel]: RotateCcw,
};

const ACTION_LABELS = {
  [ASSIGNMENT_ACTIONS.release]: 'Release to writer',
  [ASSIGNMENT_ACTIONS.refund]: 'Refund student',
  [ASSIGNMENT_ACTIONS.cancel]: 'Cancel',
};

function DisputesQueue() {
  const [disputes, setDisputes] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        status: 'disputed',
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });

      const payload = await adminFetch(`/api/admin/assignments?${params.toString()}`);
      setDisputes(payload.assignments || []);
      setTotal(payload.total || 0);
      setTotalPages(payload.totalPages || 1);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load open disputes');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const runAction = async () => {
    if (!pendingAction) return;

    const { assignment, action } = pendingAction;
    setBusy(`${assignment.id}:${action}`);

    try {
      const payload = await adminFetch('/api/admin/assignments', {
        method: 'PATCH',
        body: { assignmentId: assignment.id, action },
      });
      toast.success(payload.message || 'Dispute resolved');
      setPendingAction(null);
      setReloadKey((key) => key + 1);
    } catch (actionError) {
      toast.error(actionError.message || 'Could not resolve that dispute');
    } finally {
      setBusy(null);
    }
  };

  const actionsFor = (assignment) =>
    Object.values(ASSIGNMENT_ACTIONS).filter((action) => canResolveAssignment(assignment, action).ok);

  const heldOnPage = disputes.reduce((sum, row) => sum + assignmentValue(row), 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-brandNavy mb-2">Disputes</h1>
          <p className="text-base md:text-lg text-textBody">
            {total} open dispute{total === 1 ? '' : 's'} · {money(heldOnPage)} held on this page
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-brandGrid bg-white px-4 py-2.5 text-sm font-medium text-brandBlue transition-colors hover:border-brandBlue hover:bg-brandIce"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </button>
      </header>

      <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Releasing pays the writer from held funds. Refunding closes the assignment and returns
        the money to the student. Both parties receive a notification either way, so check the
        delivery history below before choosing.
      </p>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5">
          <p className="font-medium text-red-800">Could not load open disputes</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="mt-3 rounded-lg bg-brandBlue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brandAccent"
          >
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <p className="rounded-xl border border-brandGrid bg-white p-10 text-center text-textBody" role="status">
          Loading open disputes...
        </p>
      ) : disputes.length === 0 && !error ? (
        <div className="rounded-xl border border-brandGrid bg-white p-12 text-center">
          <div
            className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-brandIce"
            aria-hidden="true"
          >
            <AlertTriangle className="h-10 w-10 text-brandBlue" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-brandNavy">No open disputes</h2>
          <p className="text-textBody">Every held payment has been settled.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {disputes.map((dispute) => {
              const actions = actionsFor(dispute);
              const summary = disputeSummary(dispute);

              return (
                <li key={dispute.id} className="rounded-xl border border-red-200 bg-white p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/assignments/${dispute.id}`}
                        className="text-base font-medium text-brandNavy hover:text-brandBlue"
                      >
                        {dispute.title}
                      </Link>
                      <p className="mt-1 text-xs text-textMuted">
                        {dispute.subject || 'No subject'} ·{' '}
                        {dispute.academic_level || 'level not set'} · created{' '}
                        {formatDate(dispute.created_at)} · deadline {formatDate(dispute.deadline)}
                      </p>

                      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                        <div className="flex gap-1">
                          <dt className="text-textMuted">Student:</dt>
                          <dd>
                            <Link
                              href={`/dashboard/admin/users/${dispute.student_id}`}
                              className="text-textBody hover:text-brandBlue"
                            >
                              {dispute.student_name || 'Unknown student'}
                            </Link>
                          </dd>
                        </div>
                        <div className="flex gap-1">
                          <dt className="text-textMuted">Writer:</dt>
                          <dd>
                            {dispute.assigned_writer_id ? (
                              <Link
                                href={`/dashboard/admin/users/${dispute.assigned_writer_id}`}
                                className="text-textBody hover:text-brandBlue"
                              >
                                {dispute.writer_name || 'Unknown writer'}
                              </Link>
                            ) : (
                              <span className="text-textBody">No writer assigned</span>
                            )}
                          </dd>
                        </div>
                        <div className="flex gap-1">
                          <dt className="text-textMuted">Bids:</dt>
                          <dd className="text-textBody">
                            {dispute.bid_count}
                            {dispute.accepted_bid_price != null
                              ? ` · accepted at ${money(dispute.accepted_bid_price)}`
                              : ''}
                          </dd>
                        </div>
                        <div className="flex gap-1">
                          <dt className="text-textMuted">Deliveries:</dt>
                          <dd className="text-textBody">
                            {dispute.submission_count === 0 ? (
                              'none submitted'
                            ) : (
                              <>
                                {dispute.submission_count} · latest{' '}
                                {statusLabel(dispute.latest_submission_status)}
                                {dispute.latest_revision_number
                                  ? ` (revision ${dispute.latest_revision_number})`
                                  : ''}
                              </>
                            )}
                          </dd>
                        </div>
                      </dl>

                      {/* The reason the participant gave, so the decision does not
                          need a round trip through Messages first. */}
                      {summary?.hasReason ? (
                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                          <p className="text-xs font-medium text-red-800">
                            {disputeOpenedByLabel(dispute, 'admin')} · {summary.categoryLabel}
                            {summary.raisedAt ? ` · ${formatDate(summary.raisedAt)}` : ''}
                          </p>
                          <p className="mt-1 whitespace-pre-line text-sm text-red-900">
                            {summary.details}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                          No reason was recorded with this dispute. Read the messages before
                          deciding.
                        </p>
                      )}

                      <Link
                        href={`/dashboard/assignments/${dispute.id}`}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brandBlue transition-colors hover:text-brandAccent"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        Open the assignment, files and messages
                      </Link>
                    </div>

                    <div className="flex flex-shrink-0 flex-col items-start gap-3 lg:items-end">
                      <div className="text-right">
                        <p className="text-xs uppercase text-textMuted">Held</p>
                        <p className="text-xl font-bold text-brandNavy">
                          {money(dispute.final_price ?? dispute.budget_max)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        {actions.length === 0 ? (
                          <p className="text-xs text-textMuted">No valid action for this state</p>
                        ) : (
                          actions.map((action) => {
                            const Icon = ACTION_ICONS[action];

                            return (
                              <button
                                key={action}
                                type="button"
                                onClick={() => setPendingAction({ assignment: dispute, action })}
                                disabled={Boolean(busy)}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${resolveActionTone(action)}`}
                              >
                                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                {ACTION_LABELS[action]}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between rounded-xl border border-brandGrid bg-white px-4 py-3 md:px-6">
            <p className="text-xs text-textMuted">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 rounded-lg border border-brandGrid px-3 py-1.5 text-xs font-medium text-textBody transition-colors hover:bg-brandIce disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                disabled={page >= totalPages || loading}
                className="inline-flex items-center gap-1 rounded-lg border border-brandGrid px-3 py-1.5 text-xs font-medium text-textBody transition-colors hover:bg-brandIce disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </>
      )}

      {pendingAction && (
        <AssignmentResolveDialog
          assignment={pendingAction.assignment}
          action={pendingAction.action}
          busy={busy === `${pendingAction.assignment.id}:${pendingAction.action}`}
          onCancel={() => setPendingAction(null)}
          onConfirm={runAction}
        />
      )}
    </div>
  );
}

export default function AdminDisputesPage() {
  return (
    <DashboardLayout>
      <AdminOnly>
        <DisputesQueue />
      </AdminOnly>
    </DashboardLayout>
  );
}
