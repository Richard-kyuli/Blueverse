'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  UserPlus,
  UserX,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import AddAdminDialog from '@/components/admin/AddAdminDialog';
import AdminOnly from '@/components/admin/AdminOnly';
import { adminFetch } from '@/lib/adminApi';
import { USER_ACTIONS } from '@/lib/admin';

const PAGE_SIZE = 20;

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'student', label: 'Students' },
  { value: 'writer', label: 'Writers' },
  { value: 'admin', label: 'Admins' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'unverified', label: 'Unverified' },
];

function formatDate(value) {
  if (!value) return 'n/a';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'n/a' : date.toLocaleDateString();
}

function StatusPills({ user }) {
  const suspended = user.is_active === false;

  return (
    <div className="flex flex-wrap gap-1.5">
      <span
        className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
          suspended ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
        }`}
      >
        {suspended ? 'Suspended' : 'Active'}
      </span>
      <span
        className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
          user.is_verified ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
        }`}
      >
        {user.is_verified ? 'Verified' : 'Unverified'}
      </span>
    </div>
  );
}

function SuspendDialog({ target, busy, onCancel, onConfirm }) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brandNavy/40 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-brandGrid bg-white p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="suspend-dialog-title"
      >
        <h2 id="suspend-dialog-title" className="text-lg font-bold text-brandNavy">
          Suspend {target.full_name || target.email}?
        </h2>
        <p className="mt-1 text-sm text-textBody">
          They will not be able to sign in to the console until you reactivate the account.
          The reason is sent to them as a notification.
        </p>

        <label htmlFor="suspension-reason" className="mt-4 block text-sm font-medium text-brandNavy">
          Reason
        </label>
        <textarea
          id="suspension-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Optional, but helpful if the account holder appeals."
          className="mt-1 w-full rounded-lg border border-brandGrid px-3 py-2 text-sm text-textDark focus:border-brandBlue focus:outline-none focus:ring-2 focus:ring-brandBlue/30"
        />

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
            onClick={() => onConfirm(reason)}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            <UserX className="h-4 w-4" aria-hidden="true" />
            {busy ? 'Suspending...' : 'Suspend account'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UsersConsole() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [addingAdmin, setAddingAdmin] = useState(false);

  // Deep links such as /dashboard/admin/users?status=unverified come from the
  // overview card, so the first filter comes from the URL rather than the default.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const initialStatus = new URLSearchParams(window.location.search).get('status');
    if (initialStatus) setStatus(initialStatus);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (role) params.set('role', role);
      if (status) params.set('status', status);
      if (appliedSearch) params.set('search', appliedSearch);

      const payload = await adminFetch(`/api/admin/users?${params.toString()}`);
      setUsers(payload.users || []);
      setTotal(payload.total || 0);
      setTotalPages(payload.totalPages || 1);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, role, status, appliedSearch]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const runAction = async (user, action, reason) => {
    setBusy(`${user.id}:${action}`);

    try {
      const payload = await adminFetch('/api/admin/users', {
        method: 'PATCH',
        body: { userId: user.id, action, reason },
      });
      toast.success(payload.message || 'Account updated');
      setSuspendTarget(null);
      setReloadKey((key) => key + 1);
    } catch (actionError) {
      toast.error(actionError.message || 'Could not update that account');
    } finally {
      setBusy(null);
    }
  };

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  // A promoted account leaves the current filter list when, say, the filter is
  // "Students", so land on the administrator list where the result is visible.
  const handleAdminAdded = () => {
    setAddingAdmin(false);
    setPage(1);
    setRole('admin');
    setReloadKey((key) => key + 1);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-brandNavy mb-2">Users</h1>
          <p className="text-base md:text-lg text-textBody">
            {total} account{total === 1 ? '' : 's'} on the platform
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAddingAdmin(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brandBlue px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brandAccent"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Add administrator
          </button>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-brandGrid bg-white px-4 py-2.5 text-sm font-medium text-brandBlue transition-colors hover:border-brandBlue hover:bg-brandIce"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-3 rounded-xl border border-brandGrid bg-white p-4 lg:flex-row lg:items-center">
        <form onSubmit={submitSearch} className="flex flex-1 items-center gap-2">
          <label htmlFor="user-search" className="sr-only">
            Search users by name or email
          </label>
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textMuted"
              aria-hidden="true"
            />
            <input
              id="user-search"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name or email"
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

        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="role-filter" className="sr-only">
            Filter by role
          </label>
          <select
            id="role-filter"
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

          <label htmlFor="status-filter" className="sr-only">
            Filter by account status
          </label>
          <select
            id="status-filter"
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
            className="rounded-lg border border-brandGrid bg-white px-3 py-2 text-sm text-textDark focus:border-brandBlue focus:outline-none focus:ring-2 focus:ring-brandBlue/30"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5">
          <p className="font-medium text-red-800">Could not load users</p>
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
          Loading users...
        </p>
      ) : users.length === 0 && !error ? (
        <div className="rounded-xl border border-brandGrid bg-white p-12 text-center">
          <div
            className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-brandIce"
            aria-hidden="true"
          >
            <Search className="h-10 w-10 text-brandBlue" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-brandNavy">No accounts match</h2>
          <p className="text-textBody">Try a different search term or clear the filters.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-brandGrid bg-white">
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Platform users">
              <thead className="bg-brandIce">
                <tr>
                  <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted">Account</th>
                  <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted">Role</th>
                  <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted hidden sm:table-cell">Status</th>
                  <th scope="col" className="px-4 md:px-6 py-3 text-right text-xs font-medium uppercase text-textMuted hidden md:table-cell">Rating</th>
                  <th scope="col" className="px-4 md:px-6 py-3 text-right text-xs font-medium uppercase text-textMuted hidden lg:table-cell">Jobs</th>
                  <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted hidden lg:table-cell">Joined</th>
                  <th scope="col" className="px-4 md:px-6 py-3 text-right text-xs font-medium uppercase text-textMuted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brandGrid">
                {users.map((user) => {
                  const suspended = user.is_active === false;

                  return (
                    <tr key={user.id} className="transition-colors hover:bg-brandIce/50">
                      <td className="px-4 md:px-6 py-4">
                        <p className="text-sm font-medium text-brandNavy">{user.full_name || 'Unnamed'}</p>
                        <p className="text-xs text-textMuted">{user.email}</p>
                        {suspended && user.suspension_reason ? (
                          <p className="mt-1 text-xs text-red-600">Reason: {user.suspension_reason}</p>
                        ) : null}
                      </td>
                      <td className="px-4 md:px-6 py-4 text-sm capitalize text-textBody">{user.user_type}</td>
                      <td className="px-4 md:px-6 py-4 hidden sm:table-cell">
                        <StatusPills user={user} />
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right text-sm text-textBody hidden md:table-cell">
                        {user.rating ? Number(user.rating).toFixed(1) : 'n/a'}
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right text-sm text-textBody hidden lg:table-cell">
                        {user.completed_assignments ?? 0}
                      </td>
                      <td className="px-4 md:px-6 py-4 text-sm text-textBody hidden lg:table-cell">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              runAction(user, user.is_verified ? USER_ACTIONS.unverify : USER_ACTIONS.verify)
                            }
                            disabled={Boolean(busy)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-brandGrid px-3 py-1.5 text-xs font-medium text-brandBlue transition-colors hover:border-brandBlue hover:bg-brandIce disabled:opacity-50"
                          >
                            {user.is_verified ? (
                              <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            {user.is_verified ? 'Unverify' : 'Verify'}
                          </button>

                          {suspended ? (
                            <button
                              type="button"
                              onClick={() => runAction(user, USER_ACTIONS.reactivate)}
                              disabled={Boolean(busy)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-brandGrid px-3 py-1.5 text-xs font-medium text-brandBlue transition-colors hover:border-brandBlue hover:bg-brandIce disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Reactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSuspendTarget(user)}
                              disabled={Boolean(busy)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                            >
                              <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                              Suspend
                            </button>
                          )}
                        </div>
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

      {suspendTarget && (
        <SuspendDialog
          target={suspendTarget}
          busy={busy === `${suspendTarget.id}:${USER_ACTIONS.suspend}`}
          onCancel={() => setSuspendTarget(null)}
          onConfirm={(reason) => runAction(suspendTarget, USER_ACTIONS.suspend, reason)}
        />
      )}

      {addingAdmin && (
        <AddAdminDialog
          onClose={() => setAddingAdmin(false)}
          onAdded={handleAdminAdded}
        />
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <DashboardLayout>
      <AdminOnly>
        <UsersConsole />
      </AdminOnly>
    </DashboardLayout>
  );
}
