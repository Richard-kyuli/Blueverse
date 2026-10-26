import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Mark Messages Read API Endpoint - POST /api/messages/read
 *
 * Flags every unread message the caller has received in one assignment
 * conversation as read.
 *
 * This runs on the server for the same reason sending does: the deployed
 * database has no UPDATE policy on `messages`, so the browser-side update this
 * replaced was rejected by RLS and silently did nothing, leaving unread badges
 * stuck forever. The receiver is taken from the verified token, never the body.
 *
 * Request Body:
 * - assignmentId: string (required)
 *
 * Headers:
 * - Authorization: Bearer <supabase access token> (required)
 *
 * Response:
 * - success: true
 * - markedRead: number
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

    const userId = authData.user.id;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const assignmentId = body?.assignmentId;

    if (!assignmentId || typeof assignmentId !== 'string') {
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
      console.error('Failed to load assignment for read receipts:', assignmentError);
      return NextResponse.json(
        { success: false, error: 'Could not load the assignment' },
        { status: 500 }
      );
    }

    if (!assignment) {
      return NextResponse.json({ success: false, error: 'Assignment not found' }, { status: 404 });
    }

    if (assignment.student_id !== userId && assignment.assigned_writer_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'You are not part of this assignment' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('assignment_id', assignmentId)
      .eq('receiver_id', userId)
      .eq('is_read', false)
      .select('id');

    if (error) {
      console.error('Failed to mark messages as read:', {
        code: error.code,
        message: error.message,
        details: error.details,
        assignmentId,
        userId,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to mark messages as read',
          details: error.message || 'The database rejected the update',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, markedRead: data?.length ?? 0 }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error in POST /api/messages/read:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
