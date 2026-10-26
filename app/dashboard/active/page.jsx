'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { AlertTriangle, Clock, Eye, MessageSquare, Search, Upload, Zap } from 'lucide-react';
import {
  ACTIVE_ASSIGNMENT_STATUSES,
  IN_REVIEW_STATUSES,
  OPEN_WORK_STATUSES,
  deadlineLabel,
  daysUntil,
  isOverdue,
  statusLabel,
  statusTone,
} from '@/lib/status';

const ASSIGNMENT_SELECT = `
  id,
  title,
  subject,
  academic_level,
  deadline,
  status,
  final_price,
  budget_min,
  budget_max,
  assigned_at,
  completed_at,
  student_id,
  profiles:student_id ( full_name )
`;

const SUBMISSION_SELECT = 'id, assignment_id, status, revision_notes, created_at';

function needsAttention(assignment, latestSubmission) {
  return assignment.status === 'disputed' || latestSubmission?.status === 'revision_requested';
}

function byDeadline(a, b) {
  return new Date(a.deadline || 0) - new Date(b.deadline || 0);
}

function JobCard({ assignment, submission }) {
  const revisionRequested = submission?.status === 'revision_requested';
  const overdue = isOverdue(assignment.deadline);

  return (
    <article className="bg-white rounded-xl border border-brandGrid p-6 hover:shadow-md transition-shadow">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusTone(assignment.status)}`}>
              {statusLabel(assignment.status)}
            </span>
            {revisionRequested && (
              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                revision requested
              </span>
            )}
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${overdue ? 'text-red-600' : 'text-textMuted'}`}>
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {deadlineLabel(assignment.deadline)}
            </span>
          </div>

          <h3 className="text-lg font-bold text-brandNavy truncate">{assignment.title}</h3>
          <p className="text-sm text-textBody mt-1">
            {assignment.subject}
            {assignment.profiles?.full_name ? ` • ${assignment.profiles.full_name}` : ''}
            {assignment.final_price ? ` • $${Number(assignment.final_price).toFixed(2)}` : ''}
          </p>

          {revisionRequested && submission.revision_notes && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <span className="font-medium">Revision notes: </span>
              {submission.revision_notes}
            </p>
          )}

          {assignment.status === 'disputed' && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
              This job is under dispute. Reply to the student in Messages.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 sm:flex-col sm:w-40 sm:flex-shrink-0">
          <Link
            href={`/dashboard/assignments/${assignment.id}`}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg border border-brandGrid px-4 py-2 text-sm font-medium text-textDark hover:border-brandBlue transition-colors"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            Open
          </Link>
          <Link
            href={`/dashboard/assignments/${assignment.id}/messages`}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg border border-brandGrid px-4 py-2 text-sm font-medium text-brandBlue hover:border-brandBlue hover:bg-brandIce transition-colors"
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            Messages
          </Link>
          {ACTIVE_ASSIGNMENT_STATUSES.includes(assignment.status) && (
            <Link
              href={`/dashboard/assignments/${assignment.id}/submit`}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg bg-brandBlue px-4 py-2 text-sm font-medium text-white hover:bg-brandAccent transition-colors"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {revisionRequested ? 'Resubmit' : 'Submit work'}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function JobSection({ title, description, jobs, submissions }) {
  if (jobs.length === 0) return null;

  return (
    <section aria-label={title}>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-brandNavy">{title}</h2>
        {description && <p className="text-sm text-textMuted mt-1">{description}</p>}
      </div>
      <div className="space-y-4">
        {jobs.map((assignment) => (
          <JobCard
            key={assignment.id}
            assignment={assignment}
            submission={submissions[assignment.id]}
          />
        ))}
      </div>
    </section>
  );
}

export default function ActiveJobsPage() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const userId = profile?.id;
  const isWriter = profile?.user_type === 'writer';

  useEffect(() => {
    if (!userId || !isWriter) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: assignmentsError } = await supabase
          .from('assignments')
          .select(ASSIGNMENT_SELECT)
          .eq('assigned_writer_id', userId)
          .in('status', OPEN_WORK_STATUSES)
          .order('deadline', { ascending: true });

        if (assignmentsError) throw assignmentsError;
        if (cancelled) return;

        const jobs = data || [];
        setAssignments(jobs);

        if (jobs.length === 0) {
          setSubmissions({});
          return;
        }

        const { data: submissionRows, error: submissionsError } = await supabase
          .from('submissions')
          .select(SUBMISSION_SELECT)
          .eq('writer_id', userId)
          .in('assignment_id', jobs.map((job) => job.id))
          .order('created_at', { ascending: false });

        if (submissionsError) {
          // The jobs themselves are still usable, so surface it as a soft warning.
          console.warn('Could not load submission history:', submissionsError.message);
          if (!cancelled) setSubmissions({});
          return;
        }
        if (cancelled) return;

        const latest = {};
        for (const submission of submissionRows || []) {
          if (!latest[submission.assignment_id]) latest[submission.assignment_id] = submission;
        }
        setSubmissions(latest);
      } catch (loadError) {
        console.error('Error loading active jobs:', loadError);
        if (!cancelled) setError(loadError.message || 'Failed to load your active jobs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [userId, isWriter, reloadKey]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12 text-textBody">Loading active jobs...</div>
      </DashboardLayout>
    );
  }

  const sorted = [...assignments].sort(byDeadline);
  const attention = sorted.filter((job) => needsAttention(job, submissions[job.id]));
  const active = sorted.filter(
    (job) => !needsAttention(job, submissions[job.id]) && ACTIVE_ASSIGNMENT_STATUSES.includes(job.status)
  );
  const inReview = sorted.filter(
    (job) => !needsAttention(job, submissions[job.id]) && IN_REVIEW_STATUSES.includes(job.status)
  );
  const dueSoon = sorted.filter((job) => {
    const days = daysUntil(job.deadline);
    return days !== null && days >= 0 && days <= 7;
  }).length;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-brandNavy mb-2">Active Jobs</h1>
            <p className="text-base md:text-lg text-textBody">Work you have been hired to deliver</p>
          </div>
          <Link
            href="/dashboard/browse"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-brandGrid bg-white px-4 py-2.5 text-sm font-medium text-brandBlue hover:border-brandBlue hover:bg-brandIce transition-colors"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Find more work
          </Link>
        </header>

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5">
            <p className="font-medium text-red-800">Could not load your active jobs</p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="mt-3 rounded-lg bg-brandBlue px-4 py-2 text-sm font-medium text-white hover:bg-brandAccent transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {!isWriter && !error && (
          <div className="rounded-xl border border-brandGrid bg-white p-10 text-center">
            <h2 className="text-lg font-bold text-brandNavy mb-2">This page is for writers</h2>
            <p className="text-textBody mb-6">
              Your posted assignments live under My Assignments.
            </p>
            <Link
              href="/dashboard/assignments"
              className="inline-flex items-center gap-2 rounded-lg bg-brandBlue px-5 py-2.5 text-sm font-medium text-white hover:bg-brandAccent transition-colors"
            >
              Go to My Assignments
            </Link>
          </div>
        )}

        {isWriter && !error && sorted.length === 0 && (
          <div className="rounded-xl border border-brandGrid bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-brandIce" aria-hidden="true">
              <Zap className="h-10 w-10 text-brandBlue" />
            </div>
            <h2 className="text-xl font-bold text-brandNavy mb-2">No active jobs yet</h2>
            <p className="text-textBody mb-6 max-w-md mx-auto">
              Once a student accepts your bid the job appears here with its deadline and submission button.
            </p>
            <Link
              href="/dashboard/browse"
              className="inline-flex items-center gap-2 rounded-lg bg-brandBlue px-5 py-2.5 text-sm font-medium text-white hover:bg-brandAccent transition-colors"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              Browse assignments
            </Link>
          </div>
        )}

        {isWriter && sorted.length > 0 && (
          <>
            <section aria-label="Job summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-xl border border-brandGrid bg-white p-6">
                <p className="mb-1 text-sm font-medium text-textMuted">Active jobs</p>
                <p className="text-3xl font-bold text-brandNavy">{active.length}</p>
              </div>
              <div className="rounded-xl border border-brandGrid bg-white p-6">
                <p className="mb-1 text-sm font-medium text-textMuted">Awaiting review</p>
                <p className="text-3xl font-bold text-brandNavy">{inReview.length}</p>
              </div>
              <div className="rounded-xl border border-brandGrid bg-white p-6">
                <p className="mb-1 text-sm font-medium text-textMuted">Needs attention</p>
                <p className="text-3xl font-bold text-brandNavy">{attention.length}</p>
              </div>
              <div className="rounded-xl border border-brandGrid bg-white p-6">
                <p className="mb-1 text-sm font-medium text-textMuted">Due in 7 days</p>
                <p className="text-3xl font-bold text-brandNavy">{dueSoon}</p>
              </div>
            </section>

            <JobSection
              title="Needs your attention"
              description="Changes the student asked for, or a job under dispute."
              jobs={attention}
              submissions={submissions}
            />
            <JobSection
              title="In progress"
              description="Jobs you are writing right now."
              jobs={active}
              submissions={submissions}
            />
            <JobSection
              title="Awaiting review"
              description="Submitted and waiting for the student to approve."
              jobs={inReview}
              submissions={submissions}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
