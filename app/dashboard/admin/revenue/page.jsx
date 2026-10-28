'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw, TrendingUp, Wallet } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import AdminOnly from '@/components/admin/AdminOnly';
import { adminFetch } from '@/lib/adminApi';

/**
 * Money report.
 *
 * Every figure is derived from `assignments.final_price` plus the status, not
 * from a settlement ledger: the `transactions` table exists in the schema but
 * nothing writes to it yet. The page says so instead of implying that these
 * numbers reconcile against captured payments.
 */

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

function TotalsCard({ label, value, hint, tone = 'default' }) {
  return (
    <div className="rounded-xl border border-brandGrid bg-white p-5">
      <p className="text-sm font-medium text-textMuted">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          tone === 'held' ? 'text-amber-700' : tone === 'muted' ? 'text-textBody' : 'text-brandNavy'
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-textMuted">{hint}</p> : null}
    </div>
  );
}

function RevenueReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = await adminFetch('/api/admin/revenue');
      setReport(payload);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load the revenue report');
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
          <h1 className="text-3xl md:text-4xl font-bold text-brandNavy mb-2">Revenue</h1>
          <p className="text-base md:text-lg text-textBody">Released money, held funds and writer payouts.</p>
        </header>
        <p className="rounded-xl border border-brandGrid bg-white p-10 text-center text-textBody" role="status">
          Loading the revenue report...
        </p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl md:text-4xl font-bold text-brandNavy mb-2">Revenue</h1>
        </header>
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5">
          <p className="font-medium text-red-800">Could not load the revenue report</p>
          <p className="mt-1 text-sm text-red-600">{error || 'No report returned'}</p>
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

  const { totals, monthly, topWriters, generatedAt } = report;
  const maxMonth = Math.max(...monthly.map((bucket) => bucket.released), 0);
  const platformShare = totals.released ? (totals.platformRevenue / totals.released) * 100 : 0;
  const writerShare = totals.released ? 100 - platformShare : 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-brandNavy mb-2">Revenue</h1>
          <p className="text-base md:text-lg text-textBody">
            {totals.completed} completed assignment{totals.completed === 1 ? '' : 's'} released{' '}
            {money(totals.released)}
          </p>
          <p className="mt-1 text-xs text-textMuted">
            Generated {generatedAt ? new Date(generatedAt).toLocaleString() : 'just now'}
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

      <p className="rounded-lg border border-brandGrid bg-brandIce/60 p-4 text-sm text-textBody">
        These figures are derived from assignment prices and statuses. Card capture is not
        reconciled here yet. The <code className="text-xs">transactions</code> table exists but no
        code writes to it, so treat this as a pipeline report rather than a bank statement.
      </p>

      <section aria-label="Money totals" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TotalsCard
          label="Released"
          value={money(totals.released)}
          hint={`${totals.completed} completed · ${money(totals.averageValue)} average`}
        />
        <TotalsCard
          label="Held in disputes"
          value={money(totals.held)}
          hint={`${totals.disputed} dispute${totals.disputed === 1 ? '' : 's'} awaiting a decision`}
          tone="held"
        />
        <TotalsCard
          label="Pipeline"
          value={money(totals.pipeline)}
          hint="Open, assigned and under-review value not yet paid"
        />
        <TotalsCard
          label="Cancelled"
          value={money(totals.cancelled)}
          hint={
            totals.averageDaysToComplete
              ? `${totals.averageDaysToComplete} days average to complete`
              : 'Nothing cancelled'
          }
          tone="muted"
        />
      </section>

      <section aria-label="Fee split" className="rounded-xl border border-brandGrid bg-white p-6">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-brandBlue" aria-hidden="true" />
          <h2 className="text-lg font-bold text-brandNavy">Where released money went</h2>
        </div>

        {totals.released === 0 ? (
          <p className="mt-3 text-sm text-textMuted">
            Nothing has been released yet, so there is no split to show.
          </p>
        ) : (
          <>
            <div className="mt-4 flex h-4 overflow-hidden rounded-full bg-brandIce">
              <div
                className="bg-brandBlue"
                style={{ width: `${platformShare}%` }}
                aria-hidden="true"
              />
              <div
                className="bg-green-500"
                style={{ width: `${writerShare}%` }}
                aria-hidden="true"
              />
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase text-textMuted">Platform revenue</dt>
                <dd className="text-lg font-bold text-brandNavy">
                  {money(totals.platformRevenue)}{' '}
                  <span className="text-xs font-normal text-textMuted">
                    ({platformShare.toFixed(1)}%)
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-textMuted">Writer payouts</dt>
                <dd className="text-lg font-bold text-brandNavy">
                  {money(totals.writerPayouts)}{' '}
                  <span className="text-xs font-normal text-textMuted">
                    ({writerShare.toFixed(1)}%)
                  </span>
                </dd>
              </div>
            </dl>
          </>
        )}
      </section>

      <section aria-label="Monthly released value">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-brandBlue" aria-hidden="true" />
          <h2 className="text-lg font-bold text-brandNavy">Released by month</h2>
        </div>

        <div className="rounded-xl border border-brandGrid bg-white p-6">
          <ul className="space-y-3">
            {monthly.map((bucket) => (
              <li key={bucket.key} className="flex items-center gap-3">
                <span className="w-16 flex-shrink-0 text-xs text-textMuted">{bucket.label}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-brandIce">
                  <div
                    className="h-full rounded-full bg-brandBlue"
                    style={{ width: maxMonth ? `${(bucket.released / maxMonth) * 100}%` : '0%' }}
                    aria-hidden="true"
                  />
                </div>
                <span className="w-24 flex-shrink-0 text-right text-sm font-medium text-brandNavy">
                  {money(bucket.released)}
                </span>
                <span className="w-16 flex-shrink-0 text-right text-xs text-textMuted">
                  {bucket.count} job{bucket.count === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-label="Top earning writers">
        <h2 className="mb-3 text-lg font-bold text-brandNavy">Top earning writers</h2>
        <div className="overflow-hidden rounded-xl border border-brandGrid bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-brandIce">
                <tr>
                  <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium uppercase text-textMuted">Writer</th>
                  <th scope="col" className="px-4 md:px-6 py-3 text-right text-xs font-medium uppercase text-textMuted">Jobs completed</th>
                  <th scope="col" className="px-4 md:px-6 py-3 text-right text-xs font-medium uppercase text-textMuted">Paid out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brandGrid">
                {topWriters.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-sm text-textMuted md:px-6">
                      No completed work has been paid out yet.
                    </td>
                  </tr>
                ) : (
                  topWriters.map((writer) => (
                    <tr key={writer.id} className="transition-colors hover:bg-brandIce/50">
                      <td className="px-4 md:px-6 py-3">
                        <Link
                          href={`/dashboard/admin/users/${writer.id}`}
                          className="text-sm font-medium text-brandNavy hover:text-brandBlue"
                        >
                          {writer.name}
                        </Link>
                      </td>
                      <td className="px-4 md:px-6 py-3 text-right text-sm text-textBody">
                        {writer.jobs}
                      </td>
                      <td className="px-4 md:px-6 py-3 text-right text-sm font-medium text-brandNavy">
                        {money(writer.earnings)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function AdminRevenuePage() {
  return (
    <DashboardLayout>
      <AdminOnly>
        <RevenueReport />
      </AdminOnly>
    </DashboardLayout>
  );
}
