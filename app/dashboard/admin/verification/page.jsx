'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import AdminOnly from '@/components/admin/AdminOnly';
import { adminFetch } from '@/lib/adminApi';
import { USER_ACTIONS, buildVerificationSignals } from '@/lib/admin';

/**
 * Verification queue.
 *
 * Reads /api/admin/users?status=unverified, the same filter the overview card
 * counts, so the number on the dashboard and the work list here agree. The
 * evidence chips come from buildVerificationSignals, which is advisory: a
 * profile with a thin bio can still be verified, the console just shows why it
 * looks thin.
 */

const PAGE_SIZE = 20;

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'writer', label: 'Writers' },
  { value: 'student', label: 'Students' },
];

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

function initials(profile) {
  const source = String(profile.full_name || profile.email || '?').trim();
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || '?';
}

function SignalChips({ signals }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Verification evidence">
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
          <span className="sr-only">{item.ok ? 'Has' : 'Missing'}: </span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function VerificationQueue() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        status: 'unverified',
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (role) params.set('role', role);

      const payload = await adminFetch(`/api/admin/users?${params.toString()}`);
      setUsers(payload.users || []);
      setTotal(payload.total || 0);
      setTotalPages(payload.totalPages || 1);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load the verification queue');
    } finally {
      setLoading(false);
    }
  }, [page, role]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const verify = async (user) => {
    setBusyId(user.id);

    try {
      const payload = await adminFetch('/api/admin/users', {
        method: 'PATCH',
        body: { userId: user.id, action: USER_ACTIONS.verify },
      });
      toast.success(payload.message || 'Account verified');
      setReloadKey((key) => key + 1);
    } catch (actionError) {
      toast.error(actionError.message || 'Could not verify that account');
    } finally {
      setBusyId(null);
    }
  };

  // Computed per page rather than per platform: the cards describe what the
  // reviewer can act on right now, and the header carries the platform total.
  const readyCount = users.filter((user) => buildVerificationSignals(user).ready).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-brandNavy mb-2">Verification</h1>
          <p className="text-base md:text-lg text-textBody">
            {total} account{total === 1 ? '' : 's'} waiting for a verification decision
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="verification-role" className="sr-only">
            Filter by role
          </label>
          <select
            id="verification-role"
            value={role}
            onChange={(event) => {
              setPage(1);
              setRole(event.target.value);
            }}
            className="rounded-lg border border-brandGrid bg-white px-3 py-2 text-sm text-textDark focus:border-brandBlue focus:outline-none focus:ring-2 focus:ring-brandBlue/30"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-brandGrid bg-white px-4 py-2 text-sm font-medium text-brandBlue transition-colors hover:border-brandBlue hover:bg-brandIce"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5">
          <p className="font-medium text-red-800">Could not load the queue</p>
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
          Loading the verification queue...
        </p>
      ) : users.length === 0 && !error ? (
        <div className="rounded-xl border border-brandGrid bg-white p-12 text-center">
          <div
            className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-brandIce"
            aria-hidden="true"
          >
            <ShieldCheck className="h-10 w-10 text-brandBlue" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-brandNavy">Nothing waiting</h2>
          <p className="text-textBody">
            Every account matching this filter has been verified.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-textMuted">
            {readyCount} of {users.length} on this page have at least half of the evidence signals.
          </p>

          <ul className="space-y-3">
            {users.map((user) => {
              const signals = buildVerificationSignals(user);

              return (
                <li
                  key={user.id}
                  className="rounded-xl border border-brandGrid bg-white p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 gap-4">
                      {user.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.avatar_url}
                          alt=""
                          className="h-12 w-12 flex-shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span
                          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brandBlue/10 text-sm font-bold text-brandBlue"
                          aria-hidden="true"
                        >
                          {initials(user)}
                        </span>
                      )}

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/dashboard/admin/users/${user.id}`}
                            className="text-sm font-medium text-brandNavy hover:text-brandBlue"
                          >
                            {user.full_name || 'Unnamed account'}
                          </Link>
                          <span className="rounded-full bg-brandIce px-2.5 py-1 text-xs font-medium capitalize text-textBody">
                            {user.user_type || 'unknown'}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              signals.ready
                                ? 'bg-green-100 text-green-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {signals.ready ? 'Ready to verify' : 'Needs more evidence'} ·{' '}
                            {signals.score}/{signals.total}
                          </span>
                        </div>
                        <p className="truncate text-xs text-textMuted">{user.email}</p>
                        <p className="mt-1 text-xs text-textMuted">
                          Joined {formatDate(user.created_at)} ·{' '}
                          {user.completed_assignments ?? 0} completed ·{' '}
                          {user.rating ? `${Number(user.rating).toFixed(1)} rating` : 'no rating yet'}
                        </p>

                        <div className="mt-3">
                          <SignalChips signals={signals} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-shrink-0 flex-wrap gap-2 lg:justify-end">
                      <Link
                        href={`/dashboard/admin/users/${user.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-brandGrid px-3 py-1.5 text-xs font-medium text-textBody transition-colors hover:bg-brandIce"
                      >
                        <Search className="h-3.5 w-3.5" aria-hidden="true" />
                        Open account
                      </Link>
                      <button
                        type="button"
                        onClick={() => verify(user)}
                        disabled={Boolean(busyId)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brandBlue px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brandAccent disabled:opacity-50"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        {busyId === user.id
                          ? 'Verifying...'
                          : signals.ready
                            ? 'Verify'
                            : 'Verify anyway'}
                      </button>
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
    </div>
  );
}

export default function AdminVerificationPage() {
  return (
    <DashboardLayout>
      <AdminOnly>
        <VerificationQueue />
      </AdminOnly>
    </DashboardLayout>
  );
}
