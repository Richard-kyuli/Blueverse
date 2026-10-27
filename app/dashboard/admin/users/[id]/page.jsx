'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Star,
  XCircle,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import AdminOnly from '@/components/admin/AdminOnly';
import { adminFetch } from '@/lib/adminApi';
import { USER_ACTIONS, canApplyUserAction } from '@/lib/admin';
import { useAuth } from '@/contexts/AuthContext';
import { statusLabel, statusTone } from '@/lib/status';

/**
 * One account, everything it has done.
 *
 * Backed by /api/admin/users/[id], which caps each list at the most recent 50
 * rows: this screen answers "who is this person and what is their record", and
 * the Users directory stays the place to page through volume.
 */

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function initials(profile) {
  const source = String(profile.full_name || profile.email || '?').trim();
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-brandGrid bg-white p-4">
      <p className="text-xs font-medium uppercase text-textMuted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brandNavy">{value}</p>
      {hint ? <p className="mt-1 text-xs text-textMuted">{hint}</p> : null}
    </div>
  );
}

function EmptyRow({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-6 text-center text-sm text-textMuted md:px-6">
        {children}
      </td>
    </tr>
  );
}

function AssignmentsTable({ rows, counterpartLabel, emptyText, startLabel }) {
  return (
    <div className="overflow-hidden rounded-xl border border-brandGrid bg-white">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-brandIce">
            <tr>
              <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted">Assignment</th>
              <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted hidden sm:table-cell">{counterpartLabel}</th>
              <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted">Status</th>
              <th scope="col" className="px-4 md:px-6 py-3 text-right text-xs font-medium uppercase text-textMuted hidden sm:table-cell">Value</th>
              <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted hidden lg:table-cell">{startLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brandGrid">
            {rows.length === 0 ? (
              <EmptyRow colSpan={5}>{emptyText}</EmptyRow>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-brandIce/50">
                  <td className="px-4 md:px-6 py-3">
                    <Link
                      href={`/dashboard/assignments/${row.id}`}
                      className="text-sm font-medium text-brandNavy hover:text-brandBlue"
                    >
                      {row.title}
                    </Link>
                    <p className="text-xs text-textMuted">{row.subject || 'No subject'}</p>
                  </td>
                  <td className="px-4 md:px-6 py-3 text-sm text-textBody hidden sm:table-cell">
                    {row.counterpart_id ? (
                      <Link
                        href={`/dashboard/admin/users/${row.counterpart_id}`}
                        className="hover:text-brandBlue"
                      >
                        {row.counterpart_name || 'Unknown account'}
                      </Link>
                    ) : (
                      <span className="text-textMuted">Nobody yet</span>
                    )}
                  </td>
                  <td className="px-4 md:px-6 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(row.status)}`}>
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-3 text-right text-sm text-textBody hidden sm:table-cell">
                    {money(row.final_price ?? row.budget_max)}
                  </td>
                  <td className="px-4 md:px-6 py-3 text-sm text-textBody hidden lg:table-cell">
                    {formatDate(row.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const BID_TONES = {
  accepted: 'bg-green-100 text-green-800',
  pending: 'bg-blue-100 text-blue-800',
  rejected: 'bg-gray-100 text-gray-700',
  withdrawn: 'bg-gray-100 text-gray-700',
};

function AccountDetail() {
  const params = useParams();
  const { profile: viewer } = useAuth();
  const userId = params?.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const payload = await adminFetch(`/api/admin/users/${userId}`);
      setData(payload);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load this account');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const runAction = async (action) => {
    if (!data) return;

    setBusy(true);

    try {
      const payload = await adminFetch('/api/admin/users', {
        method: 'PATCH',
        body: { userId: data.user.id, action },
      });
      toast.success(payload.message || 'Account updated');
      setReloadKey((key) => key + 1);
    } catch (actionError) {
      toast.error(actionError.message || 'Could not update that account');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/admin/users"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brandBlue hover:text-brandAccent"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to users
        </Link>
        <p className="rounded-xl border border-brandGrid bg-white p-10 text-center text-textBody" role="status">
          Loading account...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/admin/users"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brandBlue hover:text-brandAccent"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to users
        </Link>
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5">
          <p className="font-medium text-red-800">Could not load this account</p>
          <p className="mt-1 text-sm text-red-600">{error || 'The account was not found'}</p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="mt-3 rounded-lg bg-brandBlue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brandAccent"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { user, summary, signals, asStudent, asWriter, bids, reviews, submissions } = data;
  const suspended = user.is_active === false;

  const verifyAction = user.is_verified ? USER_ACTIONS.unverify : USER_ACTIONS.verify;
  const verifyCheck = canApplyUserAction(user, verifyAction, { actorId: viewer?.id });

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/admin/users"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brandBlue hover:text-brandAccent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to users
      </Link>

      <header className="flex flex-col gap-4 rounded-xl border border-brandGrid bg-white p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar_url}
              alt=""
              className="h-16 w-16 flex-shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-brandBlue/10 text-lg font-bold text-brandBlue"
              aria-hidden="true"
            >
              {initials(user)}
            </span>
          )}

          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-brandNavy md:text-3xl">
              {user.full_name || 'Unnamed account'}
            </h1>
            <p className="truncate text-sm text-textBody">{user.email}</p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brandIce px-2.5 py-1 text-xs font-medium capitalize text-textBody">
                {user.user_type || 'unknown'}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  suspended ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                }`}
              >
                {suspended ? 'Suspended' : 'Active'}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  user.is_verified ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {user.is_verified ? 'Verified' : 'Unverified'}
              </span>
              {user.location ? (
                <span className="text-xs text-textMuted">{user.location}</span>
              ) : null}
            </div>

            <p className="mt-2 text-xs text-textMuted">
              Joined {formatDate(user.created_at)} · last activity{' '}
              {summary.lastActivityAt ? formatDateTime(summary.lastActivityAt) : 'never'}
            </p>

            {suspended && user.suspension_reason ? (
              <p className="mt-2 text-xs text-red-600">Suspension reason: {user.suspension_reason}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => runAction(verifyAction)}
            disabled={busy || !verifyCheck.ok}
            title={verifyCheck.ok ? undefined : verifyCheck.reason}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brandGrid px-3 py-2 text-sm font-medium text-brandBlue transition-colors hover:border-brandBlue hover:bg-brandIce disabled:opacity-40"
          >
            {user.is_verified ? (
              <ShieldOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            )}
            {user.is_verified ? 'Remove verification' : 'Verify account'}
          </button>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brandGrid px-3 py-2 text-sm font-medium text-textBody transition-colors hover:bg-brandIce"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      <section aria-label="Verification evidence" className="rounded-xl border border-brandGrid bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-brandNavy">Verification evidence</h2>
          <p className="text-sm text-textMuted">
            {signals.score}/{signals.total} signals · {signals.ready ? 'meets the advisory bar' : 'below the advisory bar'}
          </p>
        </div>

        <ul className="mt-3 flex flex-wrap gap-2">
          {signals.items.map((item) => (
            <li
              key={item.key}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                item.ok ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {item.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {item.label}
            </li>
          ))}
        </ul>

        {user.bio ? (
          <p className="mt-4 whitespace-pre-line rounded-lg bg-brandIce/60 p-4 text-sm text-textBody">
            {user.bio}
          </p>
        ) : (
          <p className="mt-4 text-sm text-textMuted">No bio written.</p>
        )}

        {Array.isArray(user.expertise) && user.expertise.length > 0 ? (
          <p className="mt-3 text-sm text-textBody">
            <span className="text-textMuted">Expertise: </span>
            {user.expertise.join(', ')}
          </p>
        ) : null}
      </section>

      <section aria-label="Account totals" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Posted as student"
          value={summary.asStudent.posted}
          hint={`${summary.asStudent.completed} completed · ${money(summary.asStudent.spent)} spent`}
        />
        <Stat
          label="Worked as writer"
          value={summary.asWriter.awarded}
          hint={`${summary.asWriter.completed} completed · ${money(summary.asWriter.earned)} earned`}
        />
        <Stat
          label="Bids placed"
          value={summary.bids.total}
          hint={`${summary.bids.accepted} accepted · ${summary.bids.winRate}% win rate`}
        />
        <Stat
          label="Reviews received"
          value={summary.reviews.received}
          hint={
            summary.reviews.received
              ? `${summary.reviews.average.toFixed(2)} average · ${summary.reviews.lowRatings} low`
              : 'No reviews yet'
          }
        />
      </section>

      {summary.asStudent.disputed > 0 || summary.asWriter.disputed > 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This account is party to{' '}
          {summary.asStudent.disputed + summary.asWriter.disputed} open dispute
          {summary.asStudent.disputed + summary.asWriter.disputed === 1 ? '' : 's'} —{' '}
          <Link href="/dashboard/admin/disputes" className="font-medium underline">
            review the queue
          </Link>
          .
        </p>
      ) : null}

      {summary.asWriter.awarded > 0 ? (
        <section aria-label="Assignments as writer">
          <h2 className="mb-3 text-xl font-bold text-brandNavy">Assignments as writer</h2>
          <AssignmentsTable
            rows={asWriter}
            counterpartLabel="Student"
            startLabel="Awarded"
            emptyText="No work awarded yet."
          />
        </section>
      ) : null}

      {summary.asStudent.posted > 0 ? (
        <section aria-label="Assignments as student">
          <h2 className="mb-3 text-xl font-bold text-brandNavy">Assignments as student</h2>
          <AssignmentsTable
            rows={asStudent}
            counterpartLabel="Writer"
            startLabel="Posted"
            emptyText="Nothing posted yet."
          />
        </section>
      ) : null}

      <section aria-label="Bids">
        <h2 className="mb-3 text-xl font-bold text-brandNavy">Bids</h2>
        <div className="overflow-hidden rounded-xl border border-brandGrid bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-brandIce">
                <tr>
                  <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted">Assignment</th>
                  <th scope="col" className="px-4 md:px-6 py-3 text-right text-xs font-medium uppercase text-textMuted">Proposed</th>
                  <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted">Status</th>
                  <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted hidden sm:table-cell">Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brandGrid">
                {bids.length === 0 ? (
                  <EmptyRow colSpan={4}>No bids placed.</EmptyRow>
                ) : (
                  bids.map((bid) => (
                    <tr key={bid.id} className="transition-colors hover:bg-brandIce/50">
                      <td className="px-4 md:px-6 py-3">
                        {bid.assignment_title ? (
                          <Link
                            href={`/dashboard/assignments/${bid.assignment_id}`}
                            className="text-sm font-medium text-brandNavy hover:text-brandBlue"
                          >
                            {bid.assignment_title}
                          </Link>
                        ) : (
                          <span className="text-sm text-textMuted">Assignment no longer listed</span>
                        )}
                      </td>
                      <td className="px-4 md:px-6 py-3 text-right text-sm text-textBody">
                        {money(bid.proposed_price)}
                      </td>
                      <td className="px-4 md:px-6 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                            BID_TONES[bid.status] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {bid.status || 'unknown'}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-3 text-sm text-textBody hidden sm:table-cell">
                        {formatDate(bid.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section aria-label="Reviews received">
        <h2 className="mb-3 text-xl font-bold text-brandNavy">Reviews received</h2>
        <div className="overflow-hidden rounded-xl border border-brandGrid bg-white">
          <ul className="divide-y divide-brandGrid">
            {reviews.length === 0 ? (
              <li className="px-5 py-6 text-center text-sm text-textMuted">No reviews yet.</li>
            ) : (
              reviews.map((review) => (
                <li key={review.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-brandNavy">
                      <Star className="h-4 w-4 text-amber-500" aria-hidden="true" />
                      {Number(review.rating || 0).toFixed(1)}/5
                    </span>
                    <span className="text-xs text-textMuted">
                      {review.reviewer_name || 'Unknown reviewer'} · {formatDate(review.created_at)}
                    </span>
                    {review.review_type ? (
                      <span className="rounded-full bg-brandIce px-2 py-0.5 text-xs text-textBody">
                        {review.review_type.replaceAll('_', ' ')}
                      </span>
                    ) : null}
                  </div>
                  {review.comment ? (
                    <p className="mt-2 whitespace-pre-line text-sm text-textBody">{review.comment}</p>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      {data.submissionsAvailable ? (
        <section aria-label="Submissions">
          <h2 className="mb-3 text-xl font-bold text-brandNavy">Submissions</h2>
          <div className="overflow-hidden rounded-xl border border-brandGrid bg-white">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-brandIce">
                  <tr>
                    <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted">Assignment</th>
                    <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted">Status</th>
                    <th scope="col" className="px-4 md:px-6 py-3 text-right text-xs font-medium uppercase text-textMuted hidden sm:table-cell">Revision</th>
                    <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted hidden sm:table-cell">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brandGrid">
                  {submissions.length === 0 ? (
                    <EmptyRow colSpan={4}>No submissions yet.</EmptyRow>
                  ) : (
                    submissions.map((submission) => (
                      <tr key={submission.id} className="transition-colors hover:bg-brandIce/50">
                        <td className="px-4 md:px-6 py-3">
                          {submission.assignment_title ? (
                            <Link
                              href={`/dashboard/assignments/${submission.assignment_id}`}
                              className="text-sm font-medium text-brandNavy hover:text-brandBlue"
                            >
                              {submission.assignment_title}
                            </Link>
                          ) : (
                            <span className="text-sm text-textMuted">Assignment no longer listed</span>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-3 text-sm capitalize text-textBody">
                          {String(submission.status || 'unknown').replaceAll('_', ' ')}
                        </td>
                        <td className="px-4 md:px-6 py-3 text-right text-sm text-textBody hidden sm:table-cell">
                          {submission.revision_number ?? '—'}
                        </td>
                        <td className="px-4 md:px-6 py-3 text-sm text-textBody hidden sm:table-cell">
                          {formatDate(submission.created_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function AdminUserDetailPage() {
  return (
    <DashboardLayout>
      <AdminOnly>
        <AccountDetail />
      </AdminOnly>
    </DashboardLayout>
  );
}
