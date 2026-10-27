import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendNotification } from '@/lib/notify';
import {
  buildDisputeUpdate,
  canRaiseDispute,
  disputeCategoryLabel,
  validateDisputeInput,
} from '@/lib/disputes';

/**
 * POST /api/assignments/[id]/dispute
 *
 * Opens a dispute on an assignment. Either party may do it while the work is
 * awarded or in review; the status moves to `disputed`, which the admin console
 * treats as held funds awaiting a decision, and both the counterpart and every
 * active administrator are notified.
 *
 * Body: { category, details }
 * - category must be one of DISPUTE_CATEGORIES in lib/disputes.js
 * - details must be at least MIN_DISPUTE_DETAILS characters
 *
 * Service role is used because the workflow has to write the reason columns and
 * notify administrators, neither of which the participant-scoped RLS policies
 * allow. The caller is verified against the assignment's own party columns, so
 * nothing here trusts the request body for identity.
 *
 * Response: { success, assignmentId, status, role, storedReason, message }
 */

const DETAIL_EXCERPT = 180;

function excerpt(text) {
  return text.length > DETAIL_EXCERPT ? `${text.slice(0, DETAIL_EXCERPT).trim()}…` : text;
}

export async function POST(request, { params }) {
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

    const accessToken = (request.headers.get('authorization') || '')
      .replace(/^Bearer\s+/i, '')
      .trim();

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

    const userId = authData.user.id;
    const assignmentId = params?.id;

    if (!assignmentId || typeof assignmentId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'An assignment id is required' },
        { status: 400 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const { data: assignment, error: lookupError } = await supabase
      .from('assignments')
      .select('*')
      .eq('id', assignmentId)
      .maybeSingle();

    if (lookupError) {
      console.error('Dispute assignment lookup failed:', lookupError);
      return NextResponse.json(
        { success: false, error: 'Could not load that assignment', details: lookupError.message },
        { status: 500 }
      );
    }

    const allowed = canRaiseDispute(assignment, userId);
    if (!allowed.ok) {
      return NextResponse.json(
        { success: false, error: allowed.reason },
        { status: allowed.status }
      );
    }

    const validated = validateDisputeInput(body || {});
    if (!validated.ok) {
      return NextResponse.json({ success: false, error: validated.error }, { status: 400 });
    }

    const update = buildDisputeUpdate({
      category: validated.category,
      details: validated.details,
      userId,
    });

    // Optimistic lock on the status we read: a writer submitting work at the
    // same moment must not be silently overwritten by a stale dispute.
    let { data: updated, error: updateError } = await supabase
      .from('assignments')
      .update(update)
      .eq('id', assignmentId)
      .eq('status', assignment.status)
      .select('id, status');

    // A deployment that has not run supabase-disputes-workflow.sql has no reason
    // columns. The dispute is still the important part, so retry without them
    // and tell the caller the reason was not stored.
    let storedReason = true;
    if (updateError && (updateError.code === '42703' || /column .* does not exist/i.test(updateError.message || ''))) {
      console.warn('Dispute reason columns missing; recording the status only.');
      storedReason = false;

      ({ data: updated, error: updateError } = await supabase
        .from('assignments')
        .update({ status: 'disputed' })
        .eq('id', assignmentId)
        .eq('status', assignment.status)
        .select('id, status'));
    }

    if (updateError) {
      console.error('Dispute update failed:', updateError);
      return NextResponse.json(
        { success: false, error: 'Could not open the dispute', details: updateError.message },
        { status: 500 }
      );
    }

    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { success: false, error: 'This assignment changed while you were raising it. Reload and try again.' },
        { status: 409 }
      );
    }

    const categoryLabel = disputeCategoryLabel(validated.category);
    const openedBy = allowed.role === 'student' ? 'The student' : 'The writer';
    const counterpartId =
      allowed.role === 'student' ? assignment.assigned_writer_id : assignment.student_id;

    // Notifications are best-effort: the status change is already committed, and
    // a failed insert must not make the caller think the dispute did not open.
    await sendNotification(supabase, {
      userId: counterpartId,
      type: 'dispute_raised',
      title: 'A dispute was opened',
      message: `${openedBy} opened a dispute on "${assignment.title}" (${categoryLabel}): ${excerpt(validated.details)}`,
      link: `/dashboard/assignments/${assignmentId}`,
    });

    // Administrators are the only people who can settle it, so they are told too.
    const { data: admins, error: adminError } = await supabase
      .from('profiles')
      .select('id, is_active')
      .eq('user_type', 'admin');

    if (adminError) {
      console.error('Could not list administrators for the dispute notice:', adminError);
    } else {
      const activeAdmins = (admins || []).filter((admin) => admin.is_active !== false);

      for (const admin of activeAdmins) {
        await sendNotification(supabase, {
          userId: admin.id,
          type: 'dispute_raised',
          title: 'Dispute needs a decision',
          message: `${openedBy} disputed "${assignment.title}" (${categoryLabel}): ${excerpt(validated.details)}`,
          link: '/dashboard/admin/disputes',
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        assignmentId,
        status: 'disputed',
        role: allowed.role,
        storedReason,
        message: storedReason
          ? 'Dispute opened. BlueVerse will review it and both parties have been notified.'
          : 'Dispute opened, but the reason could not be stored. Contact support to add the details.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Unexpected error opening a dispute:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}

/** Only POST opens a dispute; listing them is the admin console's job. */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to open a dispute.' },
    { status: 405 }
  );
}
