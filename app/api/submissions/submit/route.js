import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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
 * - writerId: string (required)
 * - submissionText: string (optional)
 * - files: File[] (required, at least 1 file)
 * 
 * Response:
 * - success: boolean
 * - submissionId: string
 * - fileUrls: string[]
 * - message: string
 * - error: string (if failure)
 */
export async function POST(request) {
  try {
    // Initialize Supabase client with service role for server-side operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse form data
    const formData = await request.formData();
    const assignmentId = formData.get('assignmentId');
    const writerId = formData.get('writerId');
    const submissionText = formData.get('submissionText');
    
    // Extract files from form data
    const files = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file_') && value instanceof File) {
        files.push(value);
      }
    }

    // Validation: Check required fields
    if (!assignmentId || !writerId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: assignmentId and writerId are required' 
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
      .select('id, status, assigned_writer_id, student_id')
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
      const uploadResult = await uploadMultipleFiles(
        files,
        assignmentId,
        submissionId
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

      // Step 3: Update submission with file URLs
      const { error: updateError } = await supabase
        .from('submissions')
        .update({ 
          file_urls: uploadResult.uploadedUrls,
          updated_at: new Date().toISOString()
        })
        .eq('id', submissionId);

      if (updateError) {
        console.error('Failed to update submission with file URLs:', updateError);
        
        // Attempt rollback
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
      }

      // Success response
      return NextResponse.json(
        {
          success: true,
          submissionId: submissionId,
          fileUrls: uploadResult.uploadedUrls,
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
