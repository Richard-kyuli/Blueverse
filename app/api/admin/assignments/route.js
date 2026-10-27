import { NextResponse } from 'next/server';
import { authenticateAdmin, authFailure } from '@/lib/adminAuth';
import {
  ASSIGNMENT_ACTIONS,
  ASSIGNMENT_ACTION_LABELS,
  buildAssignmentUpdate,
  canResolveAssignment,
  pageCount,
  resolvePaging,
} from '@/lib/admin';
import { sendNotification } from '@/lib/notify';
import { ASSIGNMENT_STATUSES } from '@/lib/status';

/**
 * GET /api/admin/assignments
 *
 * Paginated view of every assignment, with the student and writer names and the
 * bid count attached, filterable by status and free text.
 *
 * PATCH /api/admin/assignments
 *
 * Settle a dispute. Body: { assignmentId, action } where action is one of
 * ASSIGNMENT_ACTIONS: `release` pays the writer, `refund` cancels and returns the
 * money to the student, `cancel` closes work that never reached delivery.
 *
 * Reads the whole table through the service role because the browser-facing
 * assignment policies are participant-scoped; authenticateAdmin gates it.
 */

/** Sanitise free text before it reaches PostgREST's `or` filter grammar. */
function sanitiseNeedle(value) {
  return String(value || '')
    .replace(/[,()*%]/g, ' ')
    .trim();
}

function timestamp(value) {
  const time = new Date(value || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export async function GET(request) {
  const auth = await authenticateAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(authFailure(auth), { status: auth.status });
  }

  const { supabase } = auth;
  const params = new URL(request.url).searchParams;

  const status = params.get('status');
  if (status && !ASSIGNMENT_STATUSES.includes(status)) {
    return NextResponse.json(
      { success: false, error: `status must be one of ${ASSIGNMENT_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  const needle = sanitiseNeedle(params.get('search'));
  const paging = resolvePaging({
    page: params.get('page'),
    pageSize: params.get('pageSize'),
  });

  let query = supabase.from('assignments').select('*', { count: 'exact' });

  if (status) query = query.eq('status', status);
  if (needle) query = query.or(`title.ilike.%${needle}%,subject.ilike.%${needle}%`);

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(paging.from, paging.to);

  if (error) {
    console.error('Admin assignment list failed:', error);
    return NextResponse.json(
      { success: false, error: 'Could not load assignments', details: error.message },
      { status: 500 }
    );
  }

  const rows = data || [];
  const total = count || 0;

  if (rows.length === 0) {
    return NextResponse.json({
      success: true,
      assignments: [],
      page: paging.page,
      pageSize: paging.pageSize,
      total,
      totalPages: pageCount(total, paging.pageSize),
    });
  }

  const assignmentIds = rows.map((row) => row.id);
  const peopleIds = [
    ...new Set(
      rows.flatMap((row) => [row.student_id, row.assigned_writer_id]).filter(Boolean)
    ),
  ];

  // Two flat lookups instead of nested embeds: a renamed FK would otherwise take
  // the whole endpoint down, and both queries are cheap against the indexes.
  const [peopleResult, bidResult, submissionResult] = await Promise.all([
    peopleIds.length
      ? supabase.from('profiles').select('id, full_name, email').in('id', peopleIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('bids').select('assignment_id, status, proposed_price').in('assignment_id', assignmentIds),
    supabase
      .from('submissions')
      .select('assignment_id, status, revision_number, created_at')
      .in('assignment_id', assignmentIds),
  ]);

  const failed = [peopleResult, bidResult].find((result) => result.error);
  if (failed) {
    console.error('Admin assignment enrichment failed:', failed.error);
    return NextResponse.json(
      { success: false, error: 'Could not load assignment details', details: failed.error.message },
      { status: 500 }
    );
  }

  // submissions is optional: a deployment that never ran the submissions script
  // has no table to read, and a dispute still has to be resolvable without it.
  const submissionRows = submissionResult.error?.code === '42P01'
    ? []
    : submissionResult.data || [];

  const peopleById = new Map((peopleResult.data || []).map((person) => [person.id, person]));

  const bidsByAssignment = new Map();
  for (const bid of bidResult.data || []) {
    const entry = bidsByAssignment.get(bid.assignment_id) || { count: 0, accepted: null };
    entry.count += 1;
    if (bid.status === 'accepted') entry.accepted = bid;
    bidsByAssignment.set(bid.assignment_id, entry);
  }

  // Newest submission wins, so a dispute screen can show what was last delivered
  // and whether it was a revision.
  const submissionsByAssignment = new Map();
  for (const submission of submissionRows) {
    const entry = submissionsByAssignment.get(submission.assignment_id) || {
      count: 0,
      latest: null,
    };
    entry.count += 1;
    if (!entry.latest || timestamp(submission.created_at) >= timestamp(entry.latest.created_at)) {
      entry.latest = submission;
    }
    submissionsByAssignment.set(submission.assignment_id, entry);
  }

  const assignments = rows.map((row) => {
    const student = peopleById.get(row.student_id);
    const writer = peopleById.get(row.assigned_writer_id);
    const bids = bidsByAssignment.get(row.id) || { count: 0, accepted: null };
    const submissions = submissionsByAssignment.get(row.id) || { count: 0, latest: null };

    return {
      id: row.id,
      title: row.title,
      subject: row.subject,
      status: row.status,
      academic_level: row.academic_level,
      deadline: row.deadline,
      final_price: row.final_price,
      budget_min: row.budget_min,
      budget_max: row.budget_max,
      created_at: row.created_at,
      updated_at: row.updated_at,
      completed_at: row.completed_at,
      student_id: row.student_id,
      assigned_writer_id: row.assigned_writer_id,
      student_name: student?.full_name || null,
      student_email: student?.email || null,
      writer_name: writer?.full_name || null,
      writer_email: writer?.email || null,
      bid_count: bids.count,
      accepted_bid_price: bids.accepted?.proposed_price ?? null,
      submission_count: submissions.count,
      latest_submission_status: submissions.latest?.status ?? null,
      latest_revision_number: submissions.latest?.revision_number ?? null,
    };
  });

  return NextResponse.json({
    success: true,
    assignments,
    page: paging.page,
    pageSize: paging.pageSize,
    total,
    totalPages: pageCount(total, paging.pageSize),
  });
}

export async function PATCH(request) {
  const auth = await authenticateAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(authFailure(auth), { status: auth.status });
  }

  const { supabase } = auth;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { assignmentId, action } = body || {};

  if (!assignmentId || typeof assignmentId !== 'string') {
    return NextResponse.json({ success: false, error: 'assignmentId is required' }, { status: 400 });
  }

  if (!action || !Object.prototype.hasOwnProperty.call(ASSIGNMENT_ACTIONS, action)) {
    return NextResponse.json(
      {
        success: false,
        error: `action must be one of ${Object.keys(ASSIGNMENT_ACTIONS).join(', ')}`,
      },
      { status: 400 }
    );
  }

  const { data: assignment, error: lookupError } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', assignmentId)
    .maybeSingle();

  if (lookupError) {
    console.error('Admin assignment lookup failed:', lookupError);
    return NextResponse.json(
      { success: false, error: 'Could not load that assignment', details: lookupError.message },
      { status: 500 }
    );
  }

  if (!assignment) {
    return NextResponse.json({ success: false, error: 'Assignment not found' }, { status: 404 });
  }

  const allowed = canResolveAssignment(assignment, action);
  if (!allowed.ok) {
    return NextResponse.json({ success: false, error: allowed.reason }, { status: 409 });
  }

  const update = buildAssignmentUpdate(action);

  const { data: updated, error: updateError } = await supabase
    .from('assignments')
    .update(update)
    .eq('id', assignmentId)
    .select('*')
    .single();

  if (updateError) {
    console.error('Admin assignment update failed:', updateError);
    return NextResponse.json(
      { success: false, error: 'Could not update that assignment', details: updateError.message },
      { status: 500 }
    );
  }

  // Releasing a dispute makes the job payable, so the writer's public counter has
  // to agree with the new status.
  if (action === ASSIGNMENT_ACTIONS.release && assignment.assigned_writer_id) {
    const { count } = await supabase
      .from('assignments')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_writer_id', assignment.assigned_writer_id)
      .eq('status', 'completed');

    if (typeof count === 'number') {
      await supabase
        .from('profiles')
        .update({ completed_assignments: count })
        .eq('id', assignment.assigned_writer_id);
    }
  }

  const money = Number(
    updated.final_price ?? updated.budget_max ?? updated.budget_min ?? 0
  ).toFixed(2);

  const notices = {
    [ASSIGNMENT_ACTIONS.release]: [
      {
        userId: updated.assigned_writer_id,
        title: 'Dispute resolved in your favour',
        message: `BlueVerse released $${money} for "${updated.title}".`,
      },
      {
        userId: updated.student_id,
        title: 'Dispute resolved',
        message: `We reviewed "${updated.title}" and released the payment to the writer.`,
      },
    ],
    [ASSIGNMENT_ACTIONS.refund]: [
      {
        userId: updated.student_id,
        title: 'Refund approved',
        message: `We reviewed "${updated.title}" and refunded $${money} to you.`,
      },
      {
        userId: updated.assigned_writer_id,
        title: 'Dispute resolved',
        message: `"${updated.title}" was resolved in the student's favour and refunded.`,
      },
    ],
    [ASSIGNMENT_ACTIONS.cancel]: [
      {
        userId: updated.student_id,
        title: 'Assignment cancelled',
        message: `BlueVerse support cancelled "${updated.title}".`,
      },
      {
        userId: updated.assigned_writer_id,
        title: 'Assignment cancelled',
        message: `BlueVerse support cancelled "${updated.title}".`,
      },
    ],
  };

  for (const notice of notices[action] || []) {
    if (!notice.userId) continue;
    await sendNotification(supabase, {
      userId: notice.userId,
      type: 'dispute_resolved',
      title: notice.title,
      message: notice.message,
      link: `/dashboard/assignments/${assignmentId}`,
    });
  }

  return NextResponse.json({
    success: true,
    assignment: {
      id: updated.id,
      title: updated.title,
      status: updated.status,
      final_price: updated.final_price,
      completed_at: updated.completed_at,
      updated_at: updated.updated_at,
    },
    message: `${ASSIGNMENT_ACTION_LABELS[action]}: "${updated.title}".`,
    resolvedAt: timestamp(updated.updated_at) || Date.now(),
  });
}
