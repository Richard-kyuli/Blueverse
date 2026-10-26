import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendNotification } from '@/lib/notify';
import { uploadMultipleFiles } from '@/lib/supabaseStorage';

/**
 * Submission API Endpoint - POST /api/submissions/submit
 * 
 * Creates a new submission with file uploads
 * 
 * Requirements: US-W1.1, US-W1.2, US-W1.6, FR-2
 * 
 * Request Body:
 * - assignmentId: string (required)
 * - submissionText: string (optional)
 * - files: File[] (required, at least 1 file)
 *
 * Headers:
 * - Authorization: Bearer <supabase access token> (required)
 *
 * Response:
 * - success: boolean
 * - submissionId: string
 * - filePaths: string[] (storage paths in the private 'submissions' bucket)
 * - message: string
 * - error: string (if failure)
 */
export async function POST(request) {
  try {
    // Service-role client for server-side writes. It bypasses RLS, so the
    // caller must be authenticated explicitly below.
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

    // Authenticate the caller. The writer identity comes from the verified
    // token, never from the request body.
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

    const writerId = authData.user.id;

    // Parse form data
    const formData = await request.formData();
    const assignmentId = formData.get('assignmentId');
    const claimedWriterId = formData.get('writerId');
    const submissionText = formData.get('submissionText');

    // Reject attempts to submit work on behalf of another user
    if (claimedWriterId && claimedWriterId !== writerId) {
      return NextResponse.json(
        { success: false, error: 'writerId does not match the authenticated user' },
        { status: 403 }
      );
    }
    
    // Extract files from form data
    const files = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file_') && value instanceof File) {
        files.push(value);
      }
    }

    // Validation: Check required fields
    if (!assignmentId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required field: assignmentId is required' 
        },
        { status: 400 }
      );
    }

    // Validation: At least one file required
    if (files.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'At least one file is required for submission' 
        },
        { status: 400 }
      );
    }

    // Validate assignment exists
    const { data: assignment, error: assignmentFetchError } = await supabase
      .from('assignments')
      .select('id, title, status, assigned_writer_id, student_id')
      .eq('id', assignmentId)
      .single();

    if (assignmentFetchError || !assignment) {
      console.error('Assignment fetch error:', assignmentFetchError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Assignment not found' 
        },
        { status: 404 }
      );
    }

    // Validation: Writer must be assigned to this assignment
    if (assignment.assigned_writer_id !== writerId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'You are not authorized to submit work for this assignment' 
        },
        { status: 403 }
      );
    }

    // Validation: Assignment status must be 'assigned' or 'in_progress'
    const validStatuses = ['assigned', 'in_progress'];
    if (!validStatuses.includes(assignment.status)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Cannot submit work for assignment with status: ${assignment.status}. Assignment must be 'assigned' or 'in_progress'.` 
        },
        { status: 400 }
      );
    }

    // Check if there's already a submission under review (prevent multiple concurrent submissions)
    const { data: existingSubmissions, error: existingCheckError } = await supabase
      .from('submissions')
      .select('id, status')
      .eq('assignment_id', assignmentId)
      .eq('status', 'submitted');

    if (existingCheckError) {
      console.error('Error checking existing submissions:', existingCheckError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to verify submission status' 
        },
        { status: 500 }
      );
    }

    if (existingSubmissions && existingSubmissions.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot submit while a previous submission is under review' 
        },
        { status: 400 }
      );
    }

    // Calculate revision number (count existing submissions + 1)
    const { count: submissionCount, error: countError } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('assignment_id', assignmentId);

    if (countError) {
      console.error('Error counting submissions:', countError);
    }

    const revisionNumber = (submissionCount || 0) + 1;

    // Find parent submission (most recent submission for this assignment)
    const { data: parentSubmission } = await supabase
      .from('submissions')
      .select('id')
      .eq('assignment_id', assignmentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const parentSubmissionId = parentSubmission?.id || null;

    // Step 1: Create submission record first to get submission ID
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .insert({
        assignment_id: assignmentId,
        writer_id: writerId,
        submission_text: submissionText?.trim() || null,
        status: 'submitted',
        revision_number: revisionNumber,
        parent_submission_id: parentSubmissionId,
        file_urls: [], // Will update after upload
      })
      .select()
      .single();

    if (submissionError) {
      console.error('Submission creation error:', submissionError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create submission record',
          details: submissionError.message
        },
        { status: 500 }
      );
    }

    const submissionId = submission.id;

    // Step 2: Upload files to Supabase Storage
    try {
      // Pass the service-role client so uploads are not attempted as 'anon'
      const uploadResult = await uploadMultipleFiles(
        files,
        assignmentId,
        submissionId,
        null,
        supabase
      );

      if (!uploadResult.success) {
        // Rollback: Delete submission record if file upload fails
        console.error('File upload failed, rolling back submission');
        await supabase
          .from('submissions')
          .delete()
          .eq('id', submissionId);

        return NextResponse.json(
          { 
            success: false, 
            error: uploadResult.error || 'Failed to upload files',
            failedFiles: uploadResult.failedFiles
          },
          { status: 500 }
        );
      }

      // Step 3: Update submission with the uploaded file references
      const { error: updateError } = await supabase
        .from('submissions')
        .update({ 
          // The submissions bucket is private, so only the storage path is
          // persisted. Read it back with getFileUrl(path) to obtain a signed URL.
          file_urls: uploadResult.uploadedPaths,
          updated_at: new Date().toISOString()
        })
        .eq('id', submissionId);

      if (updateError) {
        console.error('Failed to update submission with file references:', updateError);
        
        // Attempt rollback: remove the uploaded files, then the record
        await supabase.storage
          .from('submissions')
          .remove(uploadResult.uploadedPaths);

        await supabase
          .from('submissions')
          .delete()
          .eq('id', submissionId);

        return NextResponse.json(
          { 
            success: false, 
            error: 'Failed to finalize submission',
            details: updateError.message
          },
          { status: 500 }
        );
      }

      // Step 4: Update assignment status to 'under_review'
      const { error: statusUpdateError } = await supabase
        .from('assignments')
        .update({ 
          status: 'under_review',
          updated_at: new Date().toISOString()
        })
        .eq('id', assignmentId);

      if (statusUpdateError) {
        console.error('Failed to update assignment status:', statusUpdateError);
        
        // Log warning but don't rollback - submission is valid
        // Manual intervention may be needed to update status
        console.warn(`Submission ${submissionId} created but assignment status update failed`);
      } else {
        // Tell the student there is work waiting for review. Best-effort only:
        // the submission is already saved, so a failure must not fail the request.
        await sendNotification(supabase, {
          userId: assignment.student_id,
          type: 'submission_created',
          title: 'New Submission',
          message: `Revision ${revisionNumber} was submitted for "${assignment.title}". Review the work to approve it or request changes.`,
          link: `/dashboard/assignments/${assignmentId}`,
        });
      }

      // Success response
      return NextResponse.json(
        {
          success: true,
          submissionId: submissionId,
          filePaths: uploadResult.uploadedPaths,
          revisionNumber: revisionNumber,
          message: 'Work submitted successfully! The student will be notified to review your submission.'
        },
        { status: 201 }
      );

    } catch (uploadError) {
      console.error('Unexpected upload error:', uploadError);
      
      // Rollback submission record
      await supabase
        .from('submissions')
        .delete()
        .eq('id', submissionId);

      return NextResponse.json(
        { 
          success: false, 
          error: 'An unexpected error occurred during file upload',
          details: uploadError.message
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Unexpected error in submission endpoint:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'An unexpected error occurred',
        details: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * GET method - Not supported
 * Only POST is allowed for submission creation
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to submit work.' },
    { status: 405 }
  );
}
