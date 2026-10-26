'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import SubmissionForm from '@/components/submissions/SubmissionForm';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Assignment Submission Page
 * 
 * Enables writers to submit completed work with files and notes
 * 
 * Requirements: US-W1, UI-1
 * 
 * Features:
 * - Fetch assignment data to display in form
 * - Check writer authorization (must be assigned writer)
 * - Render SubmissionForm component with props
 * - Handle unauthorized access (redirect to assignment detail)
 * - Add loading state while fetching data
 */
export default function SubmissionPage() {
  const { id } = useParams(); // assignment ID from URL
  const router = useRouter();
  const { profile } = useAuth();
  
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState(null);
  const [revisionFeedback, setRevisionFeedback] = useState('');

  useEffect(() => {
    if (profile) {
      fetchAssignmentAndValidate();
    }
  }, [id, profile]);

  /**
   * Fetch assignment data and validate writer authorization
   */
  const fetchAssignmentAndValidate = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch assignment details
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', id)
        .single();

      if (assignmentError) {
        throw new Error('Assignment not found');
      }

      if (!assignmentData) {
        throw new Error('Assignment not found');
      }

      // Check if current user is the assigned writer
      if (assignmentData.assigned_writer_id !== profile.id) {
        setUnauthorized(true);
        toast.error('You are not authorized to submit work for this assignment');
        return;
      }

      // Check if assignment status allows submission
      const validStatuses = ['assigned', 'in_progress'];
      if (!validStatuses.includes(assignmentData.status)) {
        setError(`Cannot submit work for assignment with status: ${assignmentData.status}`);
        toast.error(`This assignment is ${assignmentData.status}. Submission is not allowed.`);
        return;
      }

      // Look at previous deliveries: block if one is under review, and surface any
      // revision feedback the student left on the last delivery
      const { data: previousSubmissions, error: submissionError } = await supabase
        .from('submissions')
        .select('id, status, student_feedback, revision_notes, revision_number, created_at')
        .eq('assignment_id', id)
        .order('created_at', { ascending: false });

      if (submissionError) {
        console.error('Error checking existing submissions:', submissionError);
        // Don't block submission, just log the error
      }

      if (previousSubmissions?.some((s) => s.status === 'submitted')) {
        setError('You already have a submission under review for this assignment');
        toast.error('Cannot submit while previous submission is under review');
        return;
      }

      const latestRevision = previousSubmissions?.find((s) => s.status === 'revision_requested');

      setRevisionFeedback(
        latestRevision ? latestRevision.student_feedback || latestRevision.revision_notes || '' : ''
      );

      setAssignment(assignmentData);
    } catch (err) {
      console.error('Error fetching assignment:', err);
      setError(err.message || 'Failed to load assignment');
      toast.error(err.message || 'Failed to load assignment');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle successful submission
   * Redirect to assignment detail page
   */
  const handleSubmissionSuccess = (submissionId) => {
    // Redirect to assignment detail page
    router.push(`/dashboard/assignments/${id}`);
  };

  /**
   * Handle cancel - redirect to assignment detail page
   */
  const handleCancel = () => {
    router.push(`/dashboard/assignments/${id}`);
  };

  // Redirect if unauthorized
  useEffect(() => {
    if (unauthorized) {
      const timer = setTimeout(() => {
        router.push(`/dashboard/assignments/${id}`);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [unauthorized, id, router]);

  // Loading state
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-brandBlue animate-spin mx-auto mb-4" aria-hidden="true" />
            <p className="text-textBody">Loading assignment details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Unauthorized state
  if (unauthorized) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-brandNavy mb-2">
              Access Denied
            </h2>
            <p className="text-textBody mb-4">
              You are not authorized to submit work for this assignment. 
              Only the assigned writer can submit work.
            </p>
            <p className="text-sm text-textMuted">
              Redirecting to assignment details...
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (error || !assignment) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-brandNavy mb-2">
              {error || 'Assignment Not Found'}
            </h2>
            <p className="text-textBody mb-6">
              {error === 'You already have a submission under review for this assignment'
                ? 'Please wait for the student to review your current submission before submitting again.'
                : 'Unable to load the assignment details. Please try again.'}
            </p>
            <button
              onClick={handleCancel}
              className="px-6 py-2 bg-brandBlue hover:bg-brandAccent text-white font-medium rounded-lg transition-colors"
            >
              Back to Assignment
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Success - render submission form
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <button
            onClick={handleCancel}
            className="text-brandBlue hover:text-brandAccent font-medium mb-4 inline-flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Assignment
          </button>
          <h1 className="text-3xl font-bold text-brandNavy">
            Submit Your Work
          </h1>
          <p className="text-textBody mt-2">
            Upload your completed assignment files and add any notes for the student.
          </p>
        </div>

        {/* Revision feedback from the student */}
        {revisionFeedback && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6" role="status">
            <p className="font-medium text-amber-900">The student requested a revision</p>
            <p className="text-sm text-amber-800 mt-1 whitespace-pre-wrap">{revisionFeedback}</p>
          </div>
        )}

        {/* Submission Form */}
        <SubmissionForm
          assignment={assignment}
          writerId={profile.id}
          onSuccess={handleSubmissionSuccess}
          onCancel={handleCancel}
        />
      </div>
    </DashboardLayout>
  );
}
