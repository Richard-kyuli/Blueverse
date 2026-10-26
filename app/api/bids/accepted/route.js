import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendNotification } from '@/lib/notify';

/**
 * Bid Award Notification API Endpoint - POST /api/bids/accepted
 *
 * Accepting a bid happens in the browser (three writes the student is allowed to
 * make under RLS: the winning bid, the losing bids, the assignment). This route
 * closes the loop for the writer, who otherwise only finds out by opening the
 * assignment: notifications have no INSERT policy for `authenticated`, so the
 * bell row has to be written server-side.
 *
 * Everything is derived from the stored rows, never from the client:
 *   - the caller must be the student who owns the assignment
 *   - the bid must already be `accepted` and belong to the assignment's writer
 *
 * Request Body:
 * - bidId: string (required)
 *
 * Headers:
 * - Authorization: Bearer <supabase access token> (required)
 *
 * Response (200):
 * - success: true
 * - notified: boolean (false when the writer already had this notification)
 */
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

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const bidId = body?.bidId;

    if (!bidId || typeof bidId !== 'string') {
      return NextResponse.json({ success: false, error: 'bidId is required' }, { status: 400 });
    }

    const { data: bid, error: bidError } = await supabase
      .from('bids')
      .select('id, assignment_id, writer_id, status, proposed_price')
      .eq('id', bidId)
      .maybeSingle();

    if (bidError) {
      console.error('Failed to load bid:', bidError);
      return NextResponse.json({ success: false, error: 'Could not load the bid' }, { status: 500 });
    }

    if (!bid) {
      return NextResponse.json({ success: false, error: 'Bid not found' }, { status: 404 });
    }

    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('id, title, student_id, status, assigned_writer_id')
      .eq('id', bid.assignment_id)
      .maybeSingle();

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found' },
        { status: 404 }
      );
    }

    if (assignment.student_id !== authData.user.id) {
      return NextResponse.json(
        { success: false, error: 'You are not authorized to award this bid' },
        { status: 403 }
      );
    }

    if (bid.status !== 'accepted' || assignment.assigned_writer_id !== bid.writer_id) {
      return NextResponse.json(
        { success: false, error: 'This bid has not been accepted on the assignment' },
        { status: 409 }
      );
    }

    const link = `/dashboard/assignments/${assignment.id}`;

    // Awarding is a one-shot action, but the button can be clicked twice before
    // the page refreshes; don't stack identical bell entries.
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', bid.writer_id)
      .eq('type', 'bid_accepted')
      .eq('link', link)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ success: true, notified: false }, { status: 200 });
    }

    const price = Number(bid.proposed_price);

    await sendNotification(supabase, {
      userId: bid.writer_id,
      type: 'bid_accepted',
      title: 'Bid Accepted',
      message: Number.isFinite(price)
        ? `Your bid of $${price.toFixed(2)} on "${assignment.title}" was accepted.`
        : `Your bid on "${assignment.title}" was accepted.`,
      link,
    });

    return NextResponse.json({ success: true, notified: true }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error in POST /api/bids/accepted:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
