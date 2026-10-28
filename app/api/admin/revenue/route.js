import { NextResponse } from 'next/server';
import { authenticateAdmin, authFailure } from '@/lib/adminAuth';
import { buildRevenueReport } from '@/lib/admin';

/**
 * GET /api/admin/revenue
 *
 * Money report for the revenue screen: released, held, cancelled and pipeline
 * value, the platform/writer split, the last six months of completions and the
 * best-earning writers.
 *
 * This is a derivation over `assignments`, not a ledger. `transactions` exists
 * in the schema but no code writes to it yet, so there is nothing settled to
 * reconcile against.
 *
 * Query: none.
 * Response: { success, totals, monthly, topWriters, generatedAt }
 */

/** Cap so a runaway table cannot turn this into an unbounded scan. */
const ROW_LIMIT = 5000;

export async function GET(request) {
  const auth = await authenticateAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(authFailure(auth), { status: auth.status });
  }

  const { supabase } = auth;

  const [profilesResult, assignmentsResult] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, user_type').limit(ROW_LIMIT),
    supabase.from('assignments').select('*').limit(ROW_LIMIT),
  ]);

  const failed = [profilesResult, assignmentsResult].find((result) => result.error);
  if (failed) {
    console.error('Admin revenue query failed:', failed.error);
    return NextResponse.json(
      {
        success: false,
        error: 'Could not load the revenue report',
        details: failed.error.message,
      },
      { status: 500 }
    );
  }

  const report = buildRevenueReport({
    profiles: profilesResult.data || [],
    assignments: assignmentsResult.data || [],
  });

  return NextResponse.json({
    success: true,
    ...report,
    generatedAt: new Date().toISOString(),
  });
}
