'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  FileText,
  Loader2,
  RotateCcw,
  Download,
  Clock,
  History,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getFileUrl } from '@/lib/supabaseStorage';

/**
 * SubmissionReview Component
 *
 * Student-facing panel for reviewing a writer's submission: download the files,
 * then approve the work (completing the assignment) or request a revision with
 * feedback (returning the assignment to 'in_progress' so the writer can resubmit).
 *
 * Design reference: .kiro/specs/assignment-submission-workflow/design.md
 *
 * @param {Object} props
 * @param {Object} props.submission - The latest submission for the assignment
 * @param {Object[]} props.submissions - All submissions, newest first (for history)
 * @param {Function} props.onActionComplete - Called after a successful review
 */
export default function SubmissionReview({ submission, submissions = [], onActionComplete }) {
  const [feedback, setFeedback] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [processing, setProcessing] = useState(null); // 'approve' | 'revision'
  const [downloading, setDownloading] = useState(null);

  if (!submission) return null;

  const isPending = submission.status === 'submitted';
  const files = submission.file_urls || [];

  const getStatusBadge = (status) => {
    const badges = {
      submitted: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      revision_requested: 'bg-amber-100 text-amber-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (value) =>
    value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  // Stored paths look like "{assignmentId}/{submissionId}/{timestamp}-essay.pdf"
  const getDisplayName = (path) => path.split('/').pop().replace(/^\d+-/, '');

  const handleDownload = async (path) => {
    setDownloading(path);

    try {
      const result = await getFileUrl(path);

      if (!result.success) {
        throw new Error(result.error || 'Could not create a download link');
      }

      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Download error:', error);
      toast.error(error.message || 'Failed to open file');
    } finally {
      setDownloading(null);
    }
  };

  const handleReview = async (action) => {
    if (action === 'revision' && !feedback.trim()) {
      toast.error('Please explain what needs to change');
      return;
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      toast.error('Your session has expired. Please sign in again.');
      return;
    }

    setProcessing(action);

    try {
      const response = await fetch('/api/submissions/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          submissionId: submission.id,
          action,
          feedback: feedback.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to review submission');
      }

      toast.success(
        action === 'approve'
          ? 'Work approved — the assignment is complete'
          : 'Revision requested — the writer can resubmit'
      );

      setFeedback('');
      setShowRevisionForm(false);

      if (onActionComplete) {
        await onActionComplete();
      }
    } catch (error) {
      console.error('Review error:', error);
      toast.error(error.message || 'Failed to review submission');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-brandGrid p-8 mb-6" aria-label="Submission review">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-brandNavy">Writer&apos;s Submission</h2>
          <p className="text-sm text-textMuted mt-1">
            Revision {submission.revision_number} · submitted {formatDate(submission.created_at)}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getStatusBadge(submission.status)}`}
        >
          {submission.status.replace('_', ' ')}
        </span>
      </div>

      {submission.submission_text && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-brandNavy mb-2">Notes from the writer</h3>
          <p className="text-textBody whitespace-pre-wrap">{submission.submission_text}</p>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-sm font-semibold text-brandNavy mb-2">
          Files ({files.length})
        </h3>

        {files.length === 0 ? (
          <p className="text-sm text-textMuted">No files were attached.</p>
        ) : (
          <ul className="space-y-2">
            {files.map((path) => (
              <li
                key={path}
                className="flex items-center justify-between gap-4 border border-brandGrid rounded-lg px-4 py-3"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-brandBlue flex-shrink-0" aria-hidden="true" />
                  <span className="text-sm text-textDark truncate">{getDisplayName(path)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleDownload(path)}
                  disabled={downloading === path}
                  className="flex items-center gap-2 text-sm font-medium text-brandBlue hover:text-brandAccent disabled:opacity-50"
                >
                  {downloading === path ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="h-4 w-4" aria-hidden="true" />
                  )}
                  Download
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isPending && (
        <div className="border-t border-brandGrid pt-6">
          <label htmlFor="review-feedback" className="block text-sm font-semibold text-brandNavy mb-2">
            {showRevisionForm ? 'What needs to change?' : 'Feedback for the writer (optional)'}
            {showRevisionForm && <span className="text-red-600"> *</span>}
          </label>
          <textarea
            id="review-feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            placeholder={
              showRevisionForm
                ? 'Describe specifically what the writer needs to fix or improve...'
                : 'Optional note to the writer...'
            }
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent resize-none"
          />

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button
              type="button"
              onClick={() => handleReview('approve')}
              disabled={processing !== null}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {processing === 'approve' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              )}
              Approve &amp; Complete
            </button>

            {showRevisionForm ? (
              <>
                <button
                  type="button"
                  onClick={() => handleReview('revision')}
                  disabled={processing !== null}
                  className="flex-1 flex items-center justify-center gap-2 bg-amber-600 text-white py-2.5 rounded-lg font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {processing === 'revision' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  )}
                  Send Revision Request
                </button>
                <button
                  type="button"
                  onClick={() => setShowRevisionForm(false)}
                  disabled={processing !== null}
                  className="px-6 border-2 border-brandGrid text-textDark py-2.5 rounded-lg font-medium hover:border-brandBlue transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowRevisionForm(true)}
                disabled={processing !== null}
                className="flex-1 flex items-center justify-center gap-2 border-2 border-amber-500 text-amber-700 py-2.5 rounded-lg font-medium hover:bg-amber-50 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Request Revision
              </button>
            )}
          </div>
        </div>
      )}

      {submission.status === 'approved' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 font-medium">Work approved — assignment completed</p>
          {submission.student_feedback && (
            <p className="text-sm text-green-700 mt-1">{submission.student_feedback}</p>
          )}
        </div>
      )}

      {submission.status === 'revision_requested' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-amber-900 font-medium">Revision requested</p>
          <p className="text-sm text-amber-800 mt-1">
            Waiting for the writer to resubmit.
          </p>
          {submission.student_feedback && (
            <p className="text-sm text-amber-800 mt-2 whitespace-pre-wrap">
              {submission.student_feedback}
            </p>
          )}
        </div>
      )}

      {submissions.length > 1 && (
        <div className="border-t border-brandGrid pt-6 mt-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-brandNavy mb-3">
            <History className="h-4 w-4" aria-hidden="true" />
            Revision history
          </h3>
          <ul className="space-y-2">
            {submissions.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 text-sm">
                <span className="flex items-center gap-2 text-textBody">
                  <Clock className="h-4 w-4 text-textMuted" aria-hidden="true" />
                  Revision {item.revision_number}
                  <span className="text-textMuted">· {formatDate(item.created_at)}</span>
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadge(item.status)}`}>
                  {item.status.replace('_', ' ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
