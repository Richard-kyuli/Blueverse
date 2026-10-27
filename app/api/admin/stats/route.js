import { NextResponse } from 'next/server';
import { authenticateAdmin, authFailure } from '@/lib/adminAuth';
import { buildPlatformStats } from '@/lib/admin';

/**
 * GET /api/admin/stats
 *
 * Platform-wide numbers for the admin overview: accounts by role, work by status,
 * money released versus still held, review averages and the traffic in the last
 * 30 days, plus the short lists the overview renders underneath.
 *
 * Reads use the service-role client because no RLS policy grants an admin sight
 * of every row, so the caller is verified as an administrator first.
 *
 * Query: none.
 * Response: { success, stats, disputes, recentAssignments, recentUsers, generatedAt }
 */

/** Cap so a runaway table cannot turn this into an unbounded scan. */
const ROW_LIMIT = 5000;
const SHORTLIST = 5;

const timestamp = (value) => {
  const time = new Date(value || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const newestFirst = (a, b) => timestamp(b.created_at) - timestamp(a.created_at);

export async function GET(request) {
  const auth = await authenticateAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(authFailure(auth), { status: auth.status });
  }

  const { supabase } = auth;

  const [profilesResult, assignmentsResult, reviewsResult] = await Promise.all([
    supabase.from('profiles').select('*').limit(ROW_LIMIT),
    supabase.from('assignments').select('*').limit(ROW_LIMIT),
    supabase.from('reviews').select('rating').limit(ROW_LIMIT),
  ]);

  const failed = [profilesResult, assignmentsResult, reviewsResult].find((result) => result.error);
  if (failed) {
    console.error('Admin stats query failed:', failed.error);
    return NextResponse.json(
      {
        success: false,
        error: 'Could not load platform statistics',
        details: failed.error.message,
      },
      { status: 500 }
    );
  }

  const profiles = profilesResult.data || [];
  const assignments = assignmentsResult.data || [];
  const reviews = reviewsResult.data || [];

  const stats = buildPlatformStats({ profiles, assignments, reviews });

  // Resolve names locally instead of embedding profiles twice in the select: one
  // postgrest join here would fail the whole page if the FK were ever renamed.
  const nameById = new Map(profiles.map((profile) => [profile.id, profile.full_name]));

  const slim = (assignment) => ({
    id: assignment.id,
    title: assignment.title,
    status: assignment.status,
    final_price: assignment.final_price,
    budget_max: assignment.budget_max,
    created_at: assignment.created_at,
    updated_at: assignment.updated_at,
    student_id: assignment.student_id,
    assigned_writer_id: assignment.assigned_writer_id,
    student_name: nameById.get(assignment.student_id) || null,
    writer_name: nameById.get(assignment.assigned_writer_id) || null,
  });

  const disputes = assignments
    .filter((assignment) => assignment.status === 'disputed')
    .sort((a, b) => timestamp(b.updated_at || b.created_at) - timestamp(a.updated_at || a.created_at))
    .slice(0, SHORTLIST)
    .map(slim);

  const recentAssignments = [...assignments].sort(newestFirst).slice(0, SHORTLIST).map(slim);

  const recentUsers = [...profiles].sort(newestFirst).slice(0, SHORTLIST).map((profile) => ({
    id: profile.id,
    full_name: profile.full_name,
    email: profile.email,
    user_type: profile.user_type,
    created_at: profile.created_at,
  }));

  return NextResponse.json({
    success: true,
    stats,
    disputes,
    recentAssignments,
    recentUsers,
    generatedAt: new Date().toISOString(),
  });
}
