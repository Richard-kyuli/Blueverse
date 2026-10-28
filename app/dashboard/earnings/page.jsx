'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { DollarSign, Search, TrendingUp } from 'lucide-react';
import { PLATFORM_FEE_RATE, buildEarningsSummary } from '@/lib/payments';
import { statusLabel, statusTone } from '@/lib/status';

const ASSIGNMENT_SELECT = `
  id,
  title,
  subject,
  status,
  final_price,
  created_at,
  updated_at,
  submitted_at,
  completed_at,
  student_id,
  profiles:student_id ( full_name )
`;

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

function formatDate(value) {
  if (!value) return 'n/a';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'n/a' : date.toLocaleDateString();
}

export default function EarningsPage() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const userId = profile?.id;
  const isWriter = profile?.user_type === 'writer';

  useEffect(() => {
    if (!userId || !isWriter) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from('assignments')
          .select(ASSIGNMENT_SELECT)
          .eq('assigned_writer_id', userId)
          .order('created_at', { ascending: false });

        if (queryError) throw queryError;
        if (!cancelled) setAssignments(data || []);
      } catch (loadError) {
        console.error('Error loading earnings:', loadError);
        if (!cancelled) setError(loadError.message || 'Failed to load your earnings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [userId, isWriter, reloadKey]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-textBody">Loading earnings...</div>
      </DashboardLayout>
    );
  }

  const { completed, pending, totals } = buildEarningsSummary(assignments);
  const hasHistory = completed.length > 0 || pending.length > 0;
  const feePercent = Math.round(PLATFORM_FEE_RATE * 100);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-brandNavy mb-2">Earnings</h1>
            <p className="text-base md:text-lg text-textBody">
              What you have earned after the {feePercent}% BlueVerse fee
            </p>
          </div>
          <Link
            href="/dashboard/active"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-brandGrid bg-white px-4 py-2.5 text-sm font-medium text-brandBlue hover:border-brandBlue hover:bg-brandIce transition-colors"
          >
            View active jobs
          </Link>
        </header>

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5">
            <p className="font-medium text-red-800">Could not load your earnings</p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="mt-3 rounded-lg bg-brandBlue px-4 py-2 text-sm font-medium text-white hover:bg-brandAccent transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {!isWriter && !error && (
          <div className="rounded-xl border border-brandGrid bg-white p-10 text-center">
            <h2 className="text-lg font-bold text-brandNavy mb-2">This page is for writers</h2>
            <p className="text-textBody mb-6">See what you have spent on completed work instead.</p>
            <Link
              href="/dashboard/payments"
              className="inline-flex items-center gap-2 rounded-lg bg-brandBlue px-5 py-2.5 text-sm font-medium text-white hover:bg-brandAccent transition-colors"
            >
              Go to Payments
            </Link>
          </div>
        )}

        {isWriter && !error && (
          <>
            <section aria-label="Earnings summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-brandGrid bg-white p-6">
                <p className="mb-1 text-sm font-medium text-textMuted">Total earned</p>
                <p className="text-3xl font-bold text-brandNavy" aria-label={`Total earned ${money(totals.totalEarned)}`}>
                  {money(totals.totalEarned)}
                </p>
                <p className="mt-1 text-xs text-textMuted">from {money(totals.grossEarned)} gross</p>
              </div>
              <div className="rounded-xl border border-brandGrid bg-white p-6">
                <p className="mb-1 text-sm font-medium text-textMuted">Pending approval</p>
                <p className="text-3xl font-bold text-brandNavy">{money(totals.pendingEarnings)}</p>
                <p className="mt-1 text-xs text-textMuted">
                  {totals.pendingCount} job{totals.pendingCount === 1 ? '' : 's'} in progress
                </p>
              </div>
              <div className="rounded-xl border border-brandGrid bg-white p-6">
                <p className="mb-1 text-sm font-medium text-textMuted">This month</p>
                <p className="text-3xl font-bold text-brandNavy">{money(totals.earnedThisMonth)}</p>
                <p className="mt-1 text-xs text-textMuted">paid out since the 1st</p>
              </div>
              <div className="rounded-xl border border-brandGrid bg-white p-6">
                <p className="mb-1 text-sm font-medium text-textMuted">Completed jobs</p>
                <p className="text-3xl font-bold text-brandNavy">{totals.completedCount}</p>
                <p className="mt-1 text-xs text-textMuted">{money(totals.averagePerJob)} average</p>
              </div>
            </section>

            {!hasHistory && (
              <div className="rounded-xl border border-brandGrid bg-white p-12 text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-brandIce" aria-hidden="true">
                  <DollarSign className="h-10 w-10 text-brandBlue" />
                </div>
                <h2 className="text-xl font-bold text-brandNavy mb-2">No earnings yet</h2>
                <p className="text-textBody mb-6 max-w-md mx-auto">
                  Accept a job, submit the work and it will show up here as soon as the student approves it.
                </p>
                <Link
                  href="/dashboard/browse"
                  className="inline-flex items-center gap-2 rounded-lg bg-brandBlue px-5 py-2.5 text-sm font-medium text-white hover:bg-brandAccent transition-colors"
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Browse assignments
                </Link>
              </div>
            )}

            {pending.length > 0 && (
              <section aria-label="Pending earnings">
                <h2 className="text-xl font-bold text-brandNavy mb-1">Pending approval</h2>
                <p className="text-sm text-textMuted mb-4">
                  Released when the student approves your submission. Disputed jobs stay held until resolved.
                </p>
                <div className="space-y-3">
                  {pending.map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-col gap-2 rounded-xl border border-brandGrid bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-brandNavy truncate">{row.title}</p>
                        <p className="text-sm text-textBody">
                          {row.profiles?.full_name || 'Student'} • {row.subject}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(row.status)}`}>
                          {statusLabel(row.status)}
                        </span>
                        <p className="font-bold text-brandNavy">{money(row.writerEarnings)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {completed.length > 0 && (
              <section aria-label="Payment history">
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-brandNavy">Completed &amp; paid</h2>
                  <p className="text-sm text-textMuted mt-1">
                    BlueVerse keeps {money(totals.platformFees)} in fees across these jobs.
                  </p>
                </div>
                <div className="overflow-hidden rounded-xl border border-brandGrid bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full" aria-label="Completed assignments and earnings">
                      <thead className="bg-brandIce">
                        <tr>
                          <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted">Job</th>
                          <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted hidden sm:table-cell">Completed</th>
                          <th scope="col" className="px-4 md:px-6 py-3 text-right text-xs font-medium uppercase text-textMuted">Gross</th>
                          <th scope="col" className="px-4 md:px-6 py-3 text-right text-xs font-medium uppercase text-textMuted hidden md:table-cell">Fee</th>
                          <th scope="col" className="px-4 md:px-6 py-3 text-right text-xs font-medium uppercase text-textMuted">You earned</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brandGrid">
                        {completed.map((row) => (
                          <tr key={row.id} className="hover:bg-brandIce/50 transition-colors">
                            <td className="px-4 md:px-6 py-4">
                              <Link
                                href={`/dashboard/assignments/${row.id}`}
                                className="text-sm font-medium text-brandNavy hover:text-brandBlue"
                              >
                                {row.title}
                              </Link>
                              <p className="text-xs text-textMuted mt-0.5">
                                {row.profiles?.full_name || 'Student'}
                              </p>
                            </td>
                            <td className="px-4 md:px-6 py-4 text-sm text-textBody hidden sm:table-cell">
                              {formatDate(row.completed_at || row.updated_at)}
                            </td>
                            <td className="px-4 md:px-6 py-4 text-right text-sm text-textBody">{money(row.amount)}</td>
                            <td className="px-4 md:px-6 py-4 text-right text-sm text-textMuted hidden md:table-cell">
                              −{money(row.platformFee)}
                            </td>
                            <td className="px-4 md:px-6 py-4 text-right text-sm font-bold text-brandNavy">
                              {money(row.writerEarnings)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-brandIce">
                        <tr>
                          <th scope="row" colSpan={4} className="px-4 md:px-6 py-3 text-left text-sm font-medium text-textBody">
                            Total
                          </th>
                          <td className="px-4 md:px-6 py-3 text-right text-sm font-bold text-brandNavy">
                            {money(totals.totalEarned)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </section>
            )}

            <section aria-label="Payout information" className="rounded-xl border border-brandGrid bg-brandIce p-5">
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 flex-shrink-0 text-brandBlue" aria-hidden="true" />
                <p className="text-sm text-textBody">
                  Earnings are recorded when the student approves your submission. Automatic bank payouts
                  through Stripe are not enabled in this build, so figures here are what you are owed
                  rather than a transfer history.
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
