'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  RotateCcw,
  Search,
  Undo2,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import AdminOnly from '@/components/admin/AdminOnly';
import AssignmentResolveDialog, { resolveActionTone } from '@/components/admin/AssignmentResolveDialog';
import { adminFetch } from '@/lib/adminApi';
import { ASSIGNMENT_ACTIONS, canResolveAssignment } from '@/lib/admin';
import { ASSIGNMENT_STATUSES, statusLabel, statusTone } from '@/lib/status';

const PAGE_SIZE = 20;

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

function formatDate(value) {
  if (!value) return 'n/a';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'n/a' : date.toLocaleDateString();
}

function AssignmentsConsole() {
  const [assignments, setAssignments] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

  // The overview links here with ?status=disputed so a dispute decision is one
  // click away instead of a filter change.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const initialStatus = new URLSearchParams(window.location.search).get('status');
    if (initialStatus && ASSIGNMENT_STATUSES.includes(initialStatus)) setStatus(initialStatus);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (status) params.set('status', status);
      if (appliedSearch) params.set('search', appliedSearch);

      const payload = await adminFetch(`/api/admin/assignments?${params.toString()}`);
      setAssignments(payload.assignments || []);
      setTotal(payload.total || 0);
      setTotalPages(payload.totalPages || 1);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [page, status, appliedSearch]);

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
      toast.success(payload.message || 'Assignment updated');
      setPendingAction(null);
      setReloadKey((key) => key + 1);
    } catch (actionError) {
      toast.error(actionError.message || 'Could not update that assignment');
    } finally {
      setBusy(null);
    }
  };

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const actionsFor = (assignment) =>
    Object.values(ASSIGNMENT_ACTIONS).filter(
      (action) => canResolveAssignment(assignment, action).ok
    );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-brandNavy mb-2">Assignments</h1>
          <p className="text-base md:text-lg text-textBody">
            {total} assignment{total === 1 ? '' : 's'} across the platform
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

      <div className="flex flex-col gap-3 rounded-xl border border-brandGrid bg-white p-4 lg:flex-row lg:items-center">
        <form onSubmit={submitSearch} className="flex flex-1 items-center gap-2">
          <label htmlFor="assignment-search" className="sr-only">
            Search assignments by title or subject
          </label>
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textMuted"
              aria-hidden="true"
            />
            <input
              id="assignment-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by title or subject"
              className="w-full rounded-lg border border-brandGrid py-2 pl-9 pr-3 text-sm text-textDark focus:border-brandBlue focus:outline-none focus:ring-2 focus:ring-brandBlue/30"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-brandBlue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brandAccent"
          >
            Search
          </button>
        </form>

        <div>
          <label htmlFor="assignment-status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="assignment-status-filter"
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
            className="w-full rounded-lg border border-brandGrid bg-white px-3 py-2 text-sm capitalize text-textDark focus:border-brandBlue focus:outline-none focus:ring-2 focus:ring-brandBlue/30 sm:w-auto"
          >
            <option value="">Any status</option>
            {ASSIGNMENT_STATUSES.map((option) => (
              <option key={option} value={option}>
                {statusLabel(option)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5">
          <p className="font-medium text-red-800">Could not load assignments</p>
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
          Loading assignments...
        </p>
      ) : assignments.length === 0 && !error ? (
        <div className="rounded-xl border border-brandGrid bg-white p-12 text-center">
          <div
            className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-brandIce"
            aria-hidden="true"
          >
            <Search className="h-10 w-10 text-brandBlue" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-brandNavy">Nothing to show</h2>
          <p className="text-textBody">No assignment matches this filter.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-brandGrid bg-white">
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Platform assignments">
              <thead className="bg-brandIce">
                <tr>
                  <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted">Assignment</th>
                  <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted hidden md:table-cell">Parties</th>
                  <th scope="col" className="px-4 md:px-6 py-3 text-right text-xs font-medium uppercase text-textMuted hidden sm:table-cell">Value</th>
                  <th scope="col" className="px-4 md:px-6 py-3 text-right text-xs font-medium uppercase text-textMuted hidden lg:table-cell">Bids</th>
                  <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted">Status</th>
                  <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted hidden lg:table-cell">Created</th>
                  <th scope="col" className="px-4 md:px-6 py-3 text-right text-xs font-medium uppercase text-textMuted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brandGrid">
                {assignments.map((assignment) => {
                  const actions = actionsFor(assignment);

                  return (
                    <tr key={assignment.id} className="transition-colors hover:bg-brandIce/50">
                      <td className="px-4 md:px-6 py-4">
                        <Link
                          href={`/dashboard/assignments/${assignment.id}`}
                          className="text-sm font-medium text-brandNavy hover:text-brandBlue"
                        >
                          {assignment.title}
                        </Link>
                        <p className="text-xs text-textMuted">
                          {assignment.subject || 'No subject'} · {assignment.bid_count} bid
                          {assignment.bid_count === 1 ? '' : 's'}
                        </p>
                      </td>
                      <td className="px-4 md:px-6 py-4 hidden md:table-cell">
                        <p className="text-sm text-textBody">{assignment.student_name || 'Unknown student'}</p>
                        <p className="text-xs text-textMuted">
                          {assignment.writer_name || 'No writer assigned'}
                        </p>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right text-sm text-textBody hidden sm:table-cell">
                        {money(assignment.final_price ?? assignment.budget_max)}
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right text-sm text-textBody hidden lg:table-cell">
                        {assignment.bid_count}
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(assignment.status)}`}>
                          {statusLabel(assignment.status)}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-sm text-textBody hidden lg:table-cell">
                        {formatDate(assignment.created_at)}
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        {actions.length === 0 ? (
                          <p className="text-right text-xs text-textMuted">
                            {assignment.status === 'disputed' ? 'Decision pending' : 'Closed'}
                          </p>
                        ) : (
                          <div className="flex flex-wrap justify-end gap-2">
                            {actions.map((action) => (
                              <button
                                key={action}
                                type="button"
                                onClick={() => setPendingAction({ assignment, action })}
                                disabled={Boolean(busy)}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${resolveActionTone(action)}`}
                              >
                                {action === ASSIGNMENT_ACTIONS.release ? (
                                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                                ) : action === ASSIGNMENT_ACTIONS.refund ? (
                                  <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                                ) : (
                                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                                )}
                                {action === ASSIGNMENT_ACTIONS.release
                                  ? 'Release to writer'
                                  : action === ASSIGNMENT_ACTIONS.refund
                                    ? 'Refund student'
                                    : 'Cancel'}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-brandGrid px-4 py-3 md:px-6">
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
        </div>
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

export default function AdminAssignmentsPage() {
  return (
    <DashboardLayout>
      <AdminOnly>
        <AssignmentsConsole />
      </AdminOnly>
    </DashboardLayout>
  );
}
