import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendNotification } from '@/lib/notify';

/**
 * Submission Review API Endpoint - POST /api/submissions/review
 *
 * Lets the student who owns an assignment approve a submission (completing the
 * assignment) or send it back with revision feedback (returning the assignment
 * to 'in_progress' so the writer can submit again).
 *
 * Design reference: .kiro/specs/assignment-submission-workflow/design.md
 * (POST /api/submissions/review). Payment release is intentionally NOT part of
 * this endpoint - Stripe checkout/escrow is not implemented yet.
 *
 * Request Body (JSON):
 * - submissionId: string (required)
 * - action: 'approve' | 'revision' (required)
 * - feedback: string (required for 'revision', optional for 'approve')
 * - revisionNotes: string (optional, defaults to feedback; only used for 'revision')
 * - studentId: string (optional, must match the authenticated user if sent)
 *
 * Headers:
 * - Authorization: Bearer <supabase access token> (required)
 *
 * Response:
 * - success: boolean
 * - submissionId: string
 * - action: 'approve' | 'revision'
 * - assignmentStatus / newStatus: 'completed' | 'in_progress'
 * - error: string (if failure)
 */
export async function POST(request) {
  try {
    // Service-role client: RLS is bypassed, so the caller is authenticated below
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

    // Authenticate the caller
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

    const studentId = authData.user.id;

    // Parse and validate the body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { submissionId, action, feedback, revisionNotes, studentId: claimedStudentId } = body || {};

    if (!submissionId || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: submissionId and action are required' },
        { status: 400 }
      );
    }

    if (!['approve', 'revision'].includes(action)) {
      return NextResponse.json(
        { success: false, error: "action must be either 'approve' or 'revision'" },
        { status: 400 }
      );
    }

    const trimmedFeedback = typeof feedback === 'string' ? feedback.trim() : '';

    if (action === 'revision' && !trimmedFeedback) {
      return NextResponse.json(
        { success: false, error: 'Feedback is required when requesting a revision' },
        { status: 400 }
      );
    }

    // revisionNotes is optional and only meaningful for a revision request; when
    // omitted the student's feedback doubles as the writer's instructions.
    const trimmedRevisionNotes =
      typeof revisionNotes === 'string' && revisionNotes.trim()
        ? revisionNotes.trim()
        : trimmedFeedback;

    // Reject attempts to review on behalf of another user
    if (claimedStudentId && claimedStudentId !== studentId) {
      return NextResponse.json(
        { success: false, error: 'studentId does not match the authenticated user' },
        { status: 403 }
      );
    }

    // Fetch the submission
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select('id, assignment_id, writer_id, status, revision_number')
      .eq('id', submissionId)
      .single();

    if (submissionError || !submission) {
      return NextResponse.json(
        { success: false, error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Fetch the parent assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('id, title, student_id, status, assigned_writer_id')
      .eq('id', submission.assignment_id)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // Only the student who posted the assignment may review it
    if (assignment.student_id !== studentId) {
      return NextResponse.json(
        { success: false, error: 'You are not authorized to review this submission' },
        { status: 403 }
      );
    }

    // Guard against double review / concurrent requests
    if (submission.status !== 'submitted') {
      return NextResponse.json(
        { success: false, error: `This submission has already been reviewed (status: ${submission.status}).` },
        { status: 409 }
      );
    }

    if (assignment.status !== 'under_review') {
      return NextResponse.json(
        { success: false, error: `Assignment is not awaiting review (status: ${assignment.status}).` },
        { status: 409 }
      );
    }

    const nextSubmissionStatus = action === 'approve' ? 'approved' : 'revision_requested';
    const nextAssignmentStatus = action === 'approve' ? 'completed' : 'in_progress';

    // Update the submission conditionally on it still being 'submitted' (optimistic lock)
    const { data: updatedSubmissions, error: updateError } = await supabase
      .from('submissions')
      .update({
        status: nextSubmissionStatus,
        student_feedback: trimmedFeedback || null,
        revision_notes: action === 'revision' ? trimmedRevisionNotes : null,
      })
      .eq('id', submissionId)
      .eq('status', 'submitted')
      .select('id');

    if (updateError) {
      console.error('Failed to update submission status:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update submission', details: updateError.message },
        { status: 500 }
      );
    }

    if (!updatedSubmissions || updatedSubmissions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'This submission was already reviewed by another request.' },
        { status: 409 }
      );
    }

    // Update the assignment, also guarded by the expected status
    const assignmentUpdate = {
      status: nextAssignmentStatus,
    };

    if (action === 'approve') {
      assignmentUpdate.completed_at = new Date().toISOString();
    }

    const { data: updatedAssignments, error: assignmentUpdateError } = await supabase
      .from('assignments')
      .update(assignmentUpdate)
      .eq('id', assignment.id)
      .eq('status', 'under_review')
      .select('id');

    if (assignmentUpdateError || !updatedAssignments || updatedAssignments.length === 0) {
      console.error(
        'Failed to update assignment status:',
        assignmentUpdateError || 'assignment status changed concurrently'
      );

      // Revert the submission so the review can be retried
      await supabase
        .from('submissions')
        .update({
          status: 'submitted',
          student_feedback: null,
          revision_notes: null,
        })
        .eq('id', submissionId);

      return NextResponse.json(
        { success: false, error: 'Failed to update assignment. Please try again.' },
        { status: 409 }
      );
    }

    // Tell the writer what happened. Best-effort: a notification failure must not
    // undo a review that is already committed.
    const approved = action === 'approve';

    await sendNotification(supabase, {
      userId: assignment.assigned_writer_id,
      type: approved ? 'work_approved' : 'revision_requested',
      title: approved ? 'Work Approved' : 'Revision Required',
      message: approved
        ? `Your work for "${assignment.title}" has been approved. The assignment is now complete.`
        : `The student requested a revision for "${assignment.title}": ${trimmedFeedback}`,
      link: approved
        ? `/dashboard/assignments/${assignment.id}`
        : `/dashboard/assignments/${assignment.id}/submit`,
    });

    return NextResponse.json(
      {
        success: true,
        submissionId,
        action,
        assignmentStatus: nextAssignmentStatus,
        newStatus: nextAssignmentStatus,
        message: approved
          ? 'Work approved. The assignment is now complete.'
          : 'Revision requested. The writer has been notified.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error in review endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET method - Not supported
 * Only POST is allowed for reviewing a submission
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to review a submission.' },
    { status: 405 }
  );
}
