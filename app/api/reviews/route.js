import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendNotification } from '@/lib/notify';
import {
  REVIEW_COMMENT_MAX_LENGTH,
  REVIEW_TYPES,
  computeRatingSummary,
  isValidRating,
} from '@/lib/reviews';

/**
 * Reviews API Endpoint - /api/reviews
 *
 * A student rates the writer once an assignment is completed. Writes go through
 * the service-role client for the same reason submissions and messages do: the
 * deployed `reviews` policies only cover SELECT and the browser cannot INSERT.
 * The route verifies everything itself:
 *
 *   - the caller is authenticated (Bearer token -> auth.getUser)
 *   - the caller is the student who posted the assignment
 *   - the assignment is completed and has an assigned writer
 *   - the rating is a whole number of stars between 1 and 5
 *
 * After saving it refreshes the writer's denormalised profile stats
 * (`rating`, `completed_assignments`) and rings the writer's bell.
 *
 * POST body:
 * - assignmentId: string (required)
 * - rating: 1-5 (required)
 * - comment: string (optional, max 1000 characters)
 *
 * GET /api/reviews?assignmentId=<uuid>
 * - returns the reviews on that assignment (caller must be a party to it),
 *   newest first, each with `reviewer_name`
 */

function buildDisplayName(profile, fallback) {
  return profile?.full_name || fallback;
}

export async function POST(request) {
  try {
    let supabase;
    try {
      supabase = getSupabaseAdmin();
    } catch (configError) {
      console.error('Supabase server configuration error:', configError.message);
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Missing authorization token' },
        { status: 401 }
      );
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !authData?.user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired session. Please sign in again.' },
        { status: 401 }
      );
    }

    const reviewerId = authData.user.id;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const assignmentId = body?.assignmentId;
    const rating = Number(body?.rating);
    const comment = typeof body?.comment === 'string' ? body.comment.trim() : '';

    if (!assignmentId || typeof assignmentId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'assignmentId is required' },
        { status: 400 }
      );
    }

    if (!isValidRating(rating)) {
      return NextResponse.json(
        { success: false, error: 'Choose a rating from 1 to 5 stars' },
        { status: 400 }
      );
    }

    if (comment.length > REVIEW_COMMENT_MAX_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Keep your review under ${REVIEW_COMMENT_MAX_LENGTH} characters` },
        { status: 400 }
      );
    }

    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('id, title, student_id, assigned_writer_id, status')
      .eq('id', assignmentId)
      .maybeSingle();

    if (assignmentError) {
      console.error('Failed to load assignment for review:', assignmentError);
      return NextResponse.json(
        { success: false, error: 'Could not load the assignment' },
        { status: 500 }
      );
    }

    if (!assignment) {
      return NextResponse.json({ success: false, error: 'Assignment not found' }, { status: 404 });
    }

    if (assignment.student_id !== reviewerId) {
      return NextResponse.json(
        { success: false, error: 'Only the student who posted this assignment can review it' },
        { status: 403 }
      );
    }

    if (assignment.status !== 'completed') {
      return NextResponse.json(
        { success: false, error: 'You can review the writer once the assignment is completed' },
        { status: 409 }
      );
    }

    if (!assignment.assigned_writer_id) {
      return NextResponse.json(
        { success: false, error: 'This assignment has no assigned writer' },
        { status: 409 }
      );
    }

    const revieweeId = assignment.assigned_writer_id;

    // One review per assignment. Editing an existing review updates the row in
    // place instead of failing on the unique constraint.
    const { data: existing, error: existingError } = await supabase
      .from('reviews')
      .select('id')
      .eq('assignment_id', assignmentId)
      .eq('reviewer_id', reviewerId)
      .eq('reviewee_id', revieweeId)
      .maybeSingle();

    if (existingError) {
      console.error('Failed to look up an existing review:', existingError);
      return NextResponse.json(
        { success: false, error: 'Could not save your review', details: existingError.message },
        { status: 500 }
      );
    }

    const reviewFields = {
      assignment_id: assignmentId,
      reviewer_id: reviewerId,
      reviewee_id: revieweeId,
      rating,
      comment: comment || null,
      review_type: REVIEW_TYPES.STUDENT_TO_WRITER,
    };

    const reviewQuery = existing
      ? supabase.from('reviews').update(reviewFields).eq('id', existing.id)
      : supabase.from('reviews').insert(reviewFields);

    const { data: savedReview, error: saveError } = await reviewQuery
      .select('id, assignment_id, reviewer_id, reviewee_id, rating, comment, review_type, created_at')
      .single();

    if (saveError) {
      console.error('Failed to save review:', {
        code: saveError.code,
        message: saveError.message,
        details: saveError.details,
        hint: saveError.hint,
        assignmentId,
        reviewerId,
      });

      return NextResponse.json(
        { success: false, error: 'Could not save your review', details: saveError.message },
        { status: 500 }
      );
    }

    // Refresh the numbers shown on the writer's profile and dashboard cards.
    const { data: writerReviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('reviewee_id', revieweeId);

    const { count: completedCount } = await supabase
      .from('assignments')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_writer_id', revieweeId)
      .eq('status', 'completed');

    const summary = computeRatingSummary(writerReviews || []);

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        rating: summary.average,
        completed_assignments: completedCount || 0,
      })
      .eq('id', revieweeId);

    if (profileError) {
      // The review is already saved; a stale average is not worth failing the request.
      console.error('Failed to refresh writer rating:', profileError);
    }

    const { data: reviewerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', reviewerId)
      .maybeSingle();

    const reviewerName = buildDisplayName(reviewerProfile, 'Your student');
    const trimmedComment =
      comment.length > 140 ? `${comment.slice(0, 140)}…` : comment;

    await sendNotification(supabase, {
      userId: revieweeId,
      type: 'review_received',
      title: 'New Review',
      message: trimmedComment
        ? `${reviewerName} rated you ${rating}/5 for "${assignment.title}": ${trimmedComment}`
        : `${reviewerName} rated you ${rating}/5 for "${assignment.title}".`,
      link: `/dashboard/assignments/${assignmentId}`,
    });

    return NextResponse.json(
      {
        success: true,
        review: savedReview,
        summary,
        updated: Boolean(existing),
        message: existing ? 'Your review was updated.' : 'Thanks for reviewing this writer.',
      },
      { status: existing ? 200 : 201 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/reviews:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    let supabase;
    try {
      supabase = getSupabaseAdmin();
    } catch (configError) {
      console.error('Supabase server configuration error:', configError.message);
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Missing authorization token' },
        { status: 401 }
      );
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !authData?.user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired session. Please sign in again.' },
        { status: 401 }
      );
    }

    const assignmentId = new URL(request.url).searchParams.get('assignmentId');

    if (!assignmentId) {
      return NextResponse.json(
        { success: false, error: 'assignmentId is required' },
        { status: 400 }
      );
    }

    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('id, student_id, assigned_writer_id')
      .eq('id', assignmentId)
      .maybeSingle();

    if (assignmentError) {
      console.error('Failed to load assignment for reviews:', assignmentError);
      return NextResponse.json(
        { success: false, error: 'Could not load the assignment' },
        { status: 500 }
      );
    }

    if (!assignment) {
      return NextResponse.json({ success: false, error: 'Assignment not found' }, { status: 404 });
    }

    const userId = authData.user.id;

    if (assignment.student_id !== userId && assignment.assigned_writer_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'You are not part of this assignment' },
        { status: 403 }
      );
    }

    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('id, assignment_id, reviewer_id, reviewee_id, rating, comment, review_type, created_at')
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: false });

    if (reviewsError) {
      console.error('Failed to load reviews:', reviewsError);
      return NextResponse.json(
        { success: false, error: 'Could not load reviews', details: reviewsError.message },
        { status: 500 }
      );
    }

    const reviewerIds = [...new Set((reviews || []).map((review) => review.reviewer_id).filter(Boolean))];

    let namesById = new Map();

    if (reviewerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', reviewerIds);

      namesById = new Map((profiles || []).map((profile) => [profile.id, profile.full_name]));
    }

    return NextResponse.json(
      {
        success: true,
        reviews: (reviews || []).map((review) => ({
          ...review,
          reviewer_name: namesById.get(review.reviewer_id) || 'Anonymous',
        })),
        summary: computeRatingSummary(reviews || []),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in GET /api/reviews:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}
