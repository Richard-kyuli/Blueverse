'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { CreditCard, PlusCircle, ShieldCheck } from 'lucide-react';
import { buildPaymentSummary } from '@/lib/payments';
import { statusLabel, statusTone } from '@/lib/status';

const ASSIGNMENT_SELECT = `
  id,
  title,
  subject,
  status,
  final_price,
  budget_min,
  budget_max,
  created_at,
  updated_at,
  submitted_at,
  completed_at,
  assigned_writer_id,
  profiles:assigned_writer_id ( full_name )
`;

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

function formatDate(value) {
  if (!value) return 'n/a';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'n/a' : date.toLocaleDateString();
}

export default function PaymentsPage() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const userId = profile?.id;
  const isStudent = profile?.user_type === 'student';

  useEffect(() => {
    if (!userId || !isStudent) {
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
          .eq('student_id', userId)
          .order('created_at', { ascending: false });

        if (queryError) throw queryError;
        if (!cancelled) setAssignments(data || []);
      } catch (loadError) {
        console.error('Error loading payments:', loadError);
        if (!cancelled) setError(loadError.message || 'Failed to load your payments');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [userId, isStudent, reloadKey]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-textBody">Loading payments...</div>
      </DashboardLayout>
    );
  }

  const { charges, totals } = buildPaymentSummary(assignments);
  const openRequests = assignments.filter((assignment) => assignment.status === 'open');
  const hasActivity = charges.length > 0 || openRequests.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-brandNavy mb-2">Payments</h1>
            <p className="text-base md:text-lg text-textBody">Every amount you have committed to a writer</p>
          </div>
          <Link
            href="/dashboard/post-assignment"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brandBlue px-4 py-2.5 text-sm font-medium text-white hover:bg-brandAccent transition-colors"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Post assignment
          </Link>
        </header>

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5">
            <p className="font-medium text-red-800">Could not load your payments</p>
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

        {!isStudent && !error && (
          <div className="rounded-xl border border-brandGrid bg-white p-10 text-center">
            <h2 className="text-lg font-bold text-brandNavy mb-2">This page is for students</h2>
            <p className="text-textBody mb-6">See what you have earned from completed work instead.</p>
            <Link
              href="/dashboard/earnings"
              className="inline-flex items-center gap-2 rounded-lg bg-brandBlue px-5 py-2.5 text-sm font-medium text-white hover:bg-brandAccent transition-colors"
            >
              Go to Earnings
            </Link>
          </div>
        )}

        {isStudent && !error && (
          <>
            <section aria-label="Payment summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-brandGrid bg-white p-6">
                <p className="mb-1 text-sm font-medium text-textMuted">Total paid</p>
                <p className="text-3xl font-bold text-brandNavy" aria-label={`Total paid ${money(totals.totalSpent)}`}>
                  {money(totals.totalSpent)}
                </p>
                <p className="mt-1 text-xs text-textMuted">
                  {totals.completedCount} completed job{totals.completedCount === 1 ? '' : 's'}
                </p>
              </div>
              <div className="rounded-xl border border-brandGrid bg-white p-6">
                <p className="mb-1 text-sm font-medium text-textMuted">Held for work in progress</p>
                <p className="text-3xl font-bold text-brandNavy">{money(totals.inEscrow)}</p>
                <p className="mt-1 text-xs text-textMuted">
                  {totals.inFlightCount} active job{totals.inFlightCount === 1 ? '' : 's'}
                </p>
              </div>
              <div className="rounded-xl border border-brandGrid bg-white p-6">
                <p className="mb-1 text-sm font-medium text-textMuted">Average per job</p>
                <p className="text-3xl font-bold text-brandNavy">{money(totals.averagePaid)}</p>
                <p className="mt-1 text-xs text-textMuted">across paid work</p>
              </div>
              <div className="rounded-xl border border-brandGrid bg-white p-6">
                <p className="mb-1 text-sm font-medium text-textMuted">Awaiting bids</p>
                <p className="text-3xl font-bold text-brandNavy">{openRequests.length}</p>
                <p className="mt-1 text-xs text-textMuted">no writer assigned yet</p>
              </div>
            </section>

            {!hasActivity && (
              <div className="rounded-xl border border-brandGrid bg-white p-12 text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-brandIce" aria-hidden="true">
                  <CreditCard className="h-10 w-10 text-brandBlue" />
                </div>
                <h2 className="text-xl font-bold text-brandNavy mb-2">No payments yet</h2>
                <p className="text-textBody mb-6 max-w-md mx-auto">
                  Post an assignment, accept a bid and the agreed price will appear here.
                </p>
                <Link
                  href="/dashboard/post-assignment"
                  className="inline-flex items-center gap-2 rounded-lg bg-brandBlue px-5 py-2.5 text-sm font-medium text-white hover:bg-brandAccent transition-colors"
                >
                  <PlusCircle className="h-4 w-4" aria-hidden="true" />
                  Post assignment
                </Link>
              </div>
            )}

            {charges.length > 0 && (
              <section aria-label="Payment history">
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-brandNavy">Payment history</h2>
                  <p className="text-sm text-textMuted mt-1">
                    An amount is released to the writer only after you approve their submission.
                  </p>
                </div>
                <div className="overflow-hidden rounded-xl border border-brandGrid bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full" aria-label="Payments per assignment">
                      <thead className="bg-brandIce">
                        <tr>
                          <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted">Assignment</th>
                          <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted hidden sm:table-cell">Writer</th>
                          <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted hidden md:table-cell">Date</th>
                          <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted">Status</th>
                          <th scope="col" className="px-4 md:px-6 py-3 text-right text-xs font-medium uppercase text-textMuted">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-brandGrid">
                        {charges.map((row) => (
                          <tr key={row.id} className="hover:bg-brandIce/50 transition-colors">
                            <td className="px-4 md:px-6 py-4">
                              <Link
                                href={`/dashboard/assignments/${row.id}`}
                                className="text-sm font-medium text-brandNavy hover:text-brandBlue"
                              >
                                {row.title}
                              </Link>
                              <p className="text-xs text-textMuted mt-0.5">{row.subject}</p>
                            </td>
                            <td className="px-4 md:px-6 py-4 text-sm text-textBody hidden sm:table-cell">
                              {row.profiles?.full_name || 'Unassigned'}
                            </td>
                            <td className="px-4 md:px-6 py-4 text-sm text-textBody hidden md:table-cell">
                              {formatDate(row.released ? row.completed_at || row.updated_at : row.created_at)}
                            </td>
                            <td className="px-4 md:px-6 py-4">
                              <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(row.status)}`}>
                                {statusLabel(row.status)}
                              </span>
                              <p className="mt-1 text-xs text-textMuted">
                                {row.released ? 'Released' : 'Held until approval'}
                              </p>
                            </td>
                            <td className="px-4 md:px-6 py-4 text-right text-sm font-bold text-brandNavy">
                              {money(row.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-brandIce">
                        <tr>
                          <th scope="row" colSpan={4} className="px-4 md:px-6 py-3 text-left text-sm font-medium text-textBody">
                            Total paid out
                          </th>
                          <td className="px-4 md:px-6 py-3 text-right text-sm font-bold text-brandNavy">
                            {money(totals.totalSpent)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {openRequests.length > 0 && (
              <section aria-label="Open requests">
                <h2 className="text-xl font-bold text-brandNavy mb-1">Waiting for a writer</h2>
                <p className="text-sm text-textMuted mb-4">
                  These assignments have no accepted bid yet, so nothing has been charged.
                </p>
                <div className="space-y-3">
                  {openRequests.map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-col gap-2 rounded-xl border border-brandGrid bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/assignments/${row.id}`}
                          className="font-medium text-brandNavy hover:text-brandBlue truncate block"
                        >
                          {row.title}
                        </Link>
                        <p className="text-sm text-textBody">
                          {row.subject}
                          {row.budget_min && row.budget_max
                            ? ` • budget ${money(row.budget_min)} to ${money(row.budget_max)}`
                            : ''}
                        </p>
                      </div>
                      <Link
                        href={`/dashboard/assignments/${row.id}`}
                        className="inline-flex items-center justify-center rounded-lg border border-brandGrid px-4 py-2 text-sm font-medium text-brandBlue hover:border-brandBlue hover:bg-brandIce transition-colors"
                      >
                        View bids
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section aria-label="Payment information" className="rounded-xl border border-brandGrid bg-brandIce p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 flex-shrink-0 text-brandBlue" aria-hidden="true" />
                <p className="text-sm text-textBody">
                  The agreed price is held for the writer until you approve the submitted work. Card
                  payments through Stripe are not enabled in this build, so these figures are commitments
                  recorded in BlueVerse rather than statements of a card charge.
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
