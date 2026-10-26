import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendNotification } from '@/lib/notify';

const PREVIEW_LENGTH = 120;

/**
 * Send Message API Endpoint - POST /api/messages/send
 *
 * Creates one message in an assignment conversation. The write goes through
 * the service-role client for the same reason submissions do: browser-side
 * inserts depend on the `messages` RLS policies being present and correct in
 * the deployed database, and they are not (the table has never accepted a row).
 * The service role bypasses RLS, so this route verifies everything itself:
 *
 *   - the caller is authenticated (Bearer token -> auth.getUser)
 *   - the caller is a party of the assignment
 *   - the receiver is derived from the assignment, never sent by the client
 *
 * Request Body:
 * - assignmentId: string (required)
 * - message: string (required, 1 - 2000 characters after trimming)
 *
 * Headers:
 * - Authorization: Bearer <supabase access token> (required)
 *
 * Response (201):
 * - success: true
 * - message: { id, assignment_id, sender_id, receiver_id, message, is_read, created_at }
 *
 * Side effect: a `message_received` notification is written for the recipient so
 * the dashboard bell shows an unread badge.
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

    const senderId = authData.user.id;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const assignmentId = body?.assignmentId;
    const rawMessage = body?.message;

    if (!assignmentId || typeof assignmentId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'assignmentId is required' },
        { status: 400 }
      );
    }

    if (typeof rawMessage !== 'string' || !rawMessage.trim()) {
      return NextResponse.json(
        { success: false, error: 'Message cannot be empty' },
        { status: 400 }
      );
    }

    const message = rawMessage.trim();

    if (message.length > 2000) {
      return NextResponse.json(
        { success: false, error: 'Message must be 2000 characters or fewer' },
        { status: 400 }
      );
    }

    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('id, title, student_id, assigned_writer_id')
      .eq('id', assignmentId)
      .maybeSingle();

    if (assignmentError) {
      console.error('Failed to load assignment for message:', assignmentError);
      return NextResponse.json(
        { success: false, error: 'Could not load the assignment' },
        { status: 500 }
      );
    }

    if (!assignment) {
      return NextResponse.json({ success: false, error: 'Assignment not found' }, { status: 404 });
    }

    const isStudent = assignment.student_id === senderId;
    const isWriter = assignment.assigned_writer_id === senderId;

    if (!isStudent && !isWriter) {
      return NextResponse.json(
        { success: false, error: 'You are not part of this assignment' },
        { status: 403 }
      );
    }

    const receiverId = isStudent ? assignment.assigned_writer_id : assignment.student_id;

    if (!receiverId) {
      return NextResponse.json(
        { success: false, error: 'No writer has been assigned to this assignment yet' },
        { status: 409 }
      );
    }

    // The bell shows the sender's name, so it is read here rather than trusted
    // from the client.
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', senderId)
      .maybeSingle();

    const senderName = senderProfile?.full_name || (isStudent ? 'Your student' : 'Your writer');

    const { data, error } = await supabase
      .from('messages')
      .insert({
        assignment_id: assignmentId,
        sender_id: senderId,
        receiver_id: receiverId,
        message,
      })
      .select('id, assignment_id, sender_id, receiver_id, message, is_read, created_at')
      .single();

    if (error) {
      // Log the full Postgres detail so the dev terminal explains the failure.
      console.error('Failed to create message:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        assignmentId,
        senderId,
        receiverId,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to send message',
          details: error.message || 'The database rejected the message',
        },
        { status: 500 }
      );
    }

    // Ring the recipient's bell. Best-effort: the message is already stored, so a
    // notification failure must not turn into a failed send.
    const preview =
      message.length > PREVIEW_LENGTH ? `${message.slice(0, PREVIEW_LENGTH)}…` : message;

    await sendNotification(supabase, {
      userId: receiverId,
      type: 'message_received',
      title: `New message from ${senderName}`,
      message: preview,
      link: `/dashboard/assignments/${assignmentId}/messages`,
    });

    return NextResponse.json({ success: true, message: data }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/messages/send:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
