'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  RefreshCw,
  ShieldCheck,
  Star,
  TrendingUp,
  UserX,
  Users,
  Wallet,
} from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';
import { statusLabel, statusTone } from '@/lib/status';

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

function StatCard({ label, value, hint, icon: Icon, tone = 'default', href }) {
  const isAlert = tone === 'alert';

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-textMuted">{label}</p>
        <span
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
            isAlert ? 'bg-red-50' : 'bg-brandBlue/10'
          }`}
          aria-hidden="true"
        >
          <Icon className={`h-4 w-4 ${isAlert ? 'text-red-600' : 'text-brandBlue'}`} />
        </span>
      </div>
      <p className={`mt-2 text-3xl font-bold ${isAlert ? 'text-red-700' : 'text-brandNavy'}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-textMuted">{hint}</p> : null}
    </>
  );

  // Only the cards backed by their own screen become links; a card that leads
  // nowhere is worse than one that plainly is not actionable.
  if (!href) {
    return <div className="rounded-xl border border-brandGrid bg-white p-6">{body}</div>;
  }

  return (
    <Link
      href={href}
      className="block rounded-xl border border-brandGrid bg-white p-6 transition-colors hover:border-brandBlue hover:bg-brandIce/40 focus:outline-none focus:ring-2 focus:ring-brandBlue focus:ring-offset-2"
    >
      {body}
    </Link>
  );
}

/**
 * Admin overview.
 *
 * Reads only through /api/admin/stats: the browser client cannot see platform-wide
 * rows under the participant-scoped RLS policies, so every number arrives from a
 * service-role route that has already verified the caller.
 */
export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = await adminFetch('/api/admin/stats');
      setData(payload);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load the platform overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  if (loading) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl md:text-4xl font-bold text-brandNavy mb-2">Admin console</h1>
          <p className="text-base md:text-lg text-textBody">Platform health, money and disputes.</p>
        </header>
        <p className="rounded-xl border border-brandGrid bg-white p-10 text-center text-textBody" role="status">
          Loading platform overview...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl md:text-4xl font-bold text-brandNavy mb-2">Admin console</h1>
        </header>
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5">
          <p className="font-medium text-red-800">Could not load the platform overview</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
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

  const { stats, disputes = [], recentAssignments = [], recentUsers = [] } = data;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-brandNavy mb-2">Admin console</h1>
          <p className="text-base md:text-lg text-textBody">
            Platform health, money and disputes in one place.
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

      <section aria-label="Platform totals" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Accounts"
          value={stats.users.total}
          hint={`${stats.users.students} students, ${stats.users.writers} writers`}
          icon={Users}
          href="/dashboard/admin/users"
        />
        <StatCard
          label="Live assignments"
          value={stats.assignments.active + stats.assignments.underReview}
          hint={`${stats.assignments.open} open, ${stats.assignments.completed} completed`}
          icon={Briefcase}
          href="/dashboard/admin/assignments"
        />
        <StatCard
          label="Released value"
          value={money(stats.money.released)}
          hint={`${money(stats.money.platformRevenue)} platform revenue`}
          icon={Wallet}
          href="/dashboard/admin/revenue"
        />
        <StatCard
          label="Open disputes"
          value={stats.assignments.disputed}
          hint={stats.assignments.disputed ? `${money(stats.money.held)} held` : 'Nothing waiting'}
          icon={AlertTriangle}
          tone={stats.assignments.disputed ? 'alert' : 'default'}
          href="/dashboard/admin/disputes"
        />
      </section>

      <section aria-label="Moderation signals" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Awaiting verification"
          value={stats.users.unverified}
          icon={ShieldCheck}
          href="/dashboard/admin/verification"
        />
        <StatCard
          label="Suspended accounts"
          value={stats.users.suspended}
          icon={UserX}
          href="/dashboard/admin/users?status=suspended"
        />
        <StatCard
          label="Average rating"
          value={stats.reviews.count ? stats.reviews.average.toFixed(2) : '—'}
          hint={`from ${stats.reviews.count} review${stats.reviews.count === 1 ? '' : 's'}`}
          icon={Star}
        />
        <StatCard
          label="New in 30 days"
          value={stats.activity.newUsers}
          hint={`${stats.activity.newAssignments} assignments posted`}
          icon={TrendingUp}
        />
      </section>

      <section aria-label="Disputes needing a decision">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-brandNavy">Disputes</h2>
            <p className="mt-1 text-sm text-textMuted">
              Held funds waiting on a release or refund decision.
            </p>
          </div>
          <Link
            href="/dashboard/admin/disputes"
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-brandBlue transition-colors hover:text-brandAccent"
          >
            Resolve
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {disputes.length === 0 ? (
          <p className="rounded-xl border border-brandGrid bg-white p-8 text-center text-sm text-textMuted">
            No open disputes. Every held payment has been settled.
          </p>
        ) : (
          <div className="space-y-3">
            {disputes.map((dispute) => (
              <div
                key={dispute.id}
                className="flex flex-col gap-2 rounded-xl border border-brandGrid bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-brandNavy">{dispute.title}</p>
                  <p className="text-sm text-textBody">
                    {dispute.student_name || 'Student'} against {dispute.writer_name || 'writer'}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(dispute.status)}`}>
                    {statusLabel(dispute.status)}
                  </span>
                  <p className="font-bold text-brandNavy">{money(dispute.final_price)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-label="Newest accounts">
          <h2 className="mb-3 text-xl font-bold text-brandNavy">Newest accounts</h2>
          <div className="overflow-hidden rounded-xl border border-brandGrid bg-white">
            {recentUsers.length === 0 ? (
              <p className="p-6 text-sm text-textMuted">No accounts yet.</p>
            ) : (
              <ul className="divide-y divide-brandGrid">
                {recentUsers.map((user) => (
                  <li key={user.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-brandNavy">
                        {user.full_name || user.email}
                      </p>
                      <p className="truncate text-xs text-textMuted">{user.email}</p>
                    </div>
                    <span className="whitespace-nowrap text-xs capitalize text-textBody">
                      {user.user_type}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section aria-label="Newest assignments">
          <h2 className="mb-3 text-xl font-bold text-brandNavy">Newest assignments</h2>
          <div className="overflow-hidden rounded-xl border border-brandGrid bg-white">
            {recentAssignments.length === 0 ? (
              <p className="p-6 text-sm text-textMuted">No assignments yet.</p>
            ) : (
              <ul className="divide-y divide-brandGrid">
                {recentAssignments.map((assignment) => (
                  <li key={assignment.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/assignments/${assignment.id}`}
                        className="truncate text-sm font-medium text-brandNavy hover:text-brandBlue"
                      >
                        {assignment.title}
                      </Link>
                      <p className="truncate text-xs text-textMuted">
                        {assignment.student_name || 'Student'} · {formatDate(assignment.created_at)}
                      </p>
                    </div>
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(assignment.status)}`}>
                      {statusLabel(assignment.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
