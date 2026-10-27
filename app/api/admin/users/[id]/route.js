import { NextResponse } from 'next/server';
import { authenticateAdmin, authFailure } from '@/lib/adminAuth';
import { buildVerificationSignals, summariseUserAccount } from '@/lib/admin';

/**
 * GET /api/admin/users/[id]
 *
 * One account's whole footprint for the console drill-down: the profile row,
 * derived totals for both sides of the marketplace, the assignments where they
 * were the student and where they were the writer, their bids, reviews received
 * and submissions.
 *
 * Every list is capped at RECENT_LIMIT. This screen exists to answer "what has
 * this person been doing", not to be a second paginated directory — the Users
 * page already covers volume.
 *
 * Response: { success, user, summary, signals, asStudent, asWriter, bids,
 *            reviews, submissions, submissionsAvailable }
 */

const RECENT_LIMIT = 50;

const timestamp = (value) => {
  const time = new Date(value || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
};

export async function GET(request, { params }) {
  const auth = await authenticateAdmin(request);
  if (!auth.ok) {
    return NextResponse.json(authFailure(auth), { status: auth.status });
  }

  const { supabase } = auth;
  const userId = params?.id;

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ success: false, error: 'A user id is required' }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    console.error('Admin user detail lookup failed:', profileError);
    return NextResponse.json(
      { success: false, error: 'Could not load that user', details: profileError.message },
      { status: 500 }
    );
  }

  if (!profile) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  const [studentResult, writerResult, bidResult, reviewResult, submissionResult] = await Promise.all([
    supabase
      .from('assignments')
      .select('*')
      .eq('student_id', userId)
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT),
    supabase
      .from('assignments')
      .select('*')
      .eq('assigned_writer_id', userId)
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT),
    supabase
      .from('bids')
      .select('*')
      .eq('writer_id', userId)
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT),
    supabase
      .from('reviews')
      .select('*')
      .eq('reviewee_id', userId)
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT),
    supabase
      .from('submissions')
      .select('*')
      .eq('writer_id', userId)
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT),
  ]);

  const failed = [studentResult, writerResult, bidResult, reviewResult].find(
    (result) => result.error
  );

  if (failed) {
    console.error('Admin user detail query failed:', failed.error);
    return NextResponse.json(
      { success: false, error: 'Could not load this account activity', details: failed.error.message },
      { status: 500 }
    );
  }

  // submissions is optional: a deployment that never ran the submissions script
  // has no table to read, and the rest of the page is still useful without it.
  const submissionsAvailable = submissionResult.error?.code !== '42P01';
  if (!submissionsAvailable) {
    console.warn('Submissions table missing; rendering the user detail without it.');
  } else if (submissionResult.error) {
    console.error('Admin user submissions query failed:', submissionResult.error);
    return NextResponse.json(
      {
        success: false,
        error: 'Could not load this account submissions',
        details: submissionResult.error.message,
      },
      { status: 500 }
    );
  }

  const assignmentsAsStudent = studentResult.data || [];
  const assignmentsAsWriter = writerResult.data || [];
  const bids = bidResult.data || [];
  const reviews = reviewResult.data || [];
  const submissions = submissionsAvailable ? submissionResult.data || [] : [];

  // Names for every counterpart in one flat lookup, for the same reason the
  // other admin routes avoid nested embeds: a renamed FK breaks the page.
  const relatedIds = [
    ...new Set(
      [
        ...assignmentsAsStudent.map((row) => row.assigned_writer_id),
        ...assignmentsAsWriter.map((row) => row.student_id),
        ...reviews.map((row) => row.reviewer_id),
      ].filter(Boolean)
    ),
  ];

  let peopleById = new Map();
  if (relatedIds.length) {
    const { data: people, error: peopleError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', relatedIds);

    if (peopleError) {
      console.error('Admin user detail enrichment failed:', peopleError);
      return NextResponse.json(
        { success: false, error: 'Could not resolve related accounts', details: peopleError.message },
        { status: 500 }
      );
    }

    peopleById = new Map((people || []).map((person) => [person.id, person]));
  }

  const assignmentTitleById = new Map(
    [...assignmentsAsWriter, ...assignmentsAsStudent].map((row) => [row.id, row.title])
  );

  const slimAssignment = (row, counterpartId) => ({
    id: row.id,
    title: row.title,
    subject: row.subject,
    status: row.status,
    deadline: row.deadline,
    final_price: row.final_price,
    budget_max: row.budget_max,
    created_at: row.created_at,
    completed_at: row.completed_at,
    counterpart_id: counterpartId || null,
    counterpart_name: peopleById.get(counterpartId)?.full_name || null,
  });

  const summary = summariseUserAccount({
    profile,
    assignmentsAsStudent,
    assignmentsAsWriter,
    bids,
    reviewsReceived: reviews,
    submissions,
  });

  return NextResponse.json({
    success: true,
    user: profile,
    summary,
    signals: buildVerificationSignals(profile),
    asStudent: [...assignmentsAsStudent]
      .sort((a, b) => timestamp(b.created_at) - timestamp(a.created_at))
      .map((row) => slimAssignment(row, row.assigned_writer_id)),
    asWriter: [...assignmentsAsWriter]
      .sort((a, b) => timestamp(b.created_at) - timestamp(a.created_at))
      .map((row) => slimAssignment(row, row.student_id)),
    bids: bids.map((bid) => ({
      id: bid.id,
      assignment_id: bid.assignment_id,
      assignment_title: assignmentTitleById.get(bid.assignment_id) || null,
      proposed_price: bid.proposed_price,
      estimated_delivery: bid.estimated_delivery,
      status: bid.status,
      created_at: bid.created_at,
    })),
    reviews: reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      review_type: review.review_type,
      created_at: review.created_at,
      reviewer_name: peopleById.get(review.reviewer_id)?.full_name || null,
    })),
    submissions: submissions.map((submission) => ({
      id: submission.id,
      assignment_id: submission.assignment_id,
      assignment_title: assignmentTitleById.get(submission.assignment_id) || null,
      status: submission.status,
      revision_number: submission.revision_number,
      created_at: submission.created_at,
    })),
    submissionsAvailable,
  });
}
