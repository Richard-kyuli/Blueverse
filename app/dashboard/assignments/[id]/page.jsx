'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle2, Inbox, MessageSquare, Star, XCircle } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import SubmissionReview from '@/components/submissions/SubmissionReview';
import ReviewCard from '@/components/reviews/ReviewCard';
import ReviewForm from '@/components/reviews/ReviewForm';
import { statusLabel, statusTone } from '@/lib/status';

export default function AssignmentDetailPage() {
  const { id } = useParams();
  const { profile } = useAuth();
  const router = useRouter();
  const [assignment, setAssignment] = useState(null);
  const [bids, setBids] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchAssignmentDetails();
  }, [id]);

  /**
   * Reviews are read through the API rather than the anon client: the deployed
   * `reviews` policies only guarantee what the API route already verifies.
   */
  const fetchReviews = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      const response = await fetch(`/api/reviews?assignmentId=${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        console.error('Failed to load reviews:', result?.error || response.status);
        return;
      }

      setReviews(result.reviews || []);
    } catch (reviewError) {
      console.error('Failed to load reviews:', reviewError);
    }
  };

  const fetchAssignmentDetails = async () => {
    try {
      // Fetch assignment
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .select('*')
        .eq('id', id)
        .single();

      if (assignmentError) throw assignmentError;
      setAssignment(assignmentData);

      // Fetch bids with writer profiles
      const { data: bidsData, error: bidsError } = await supabase
        .from('bids')
        .select('*, profiles(*)')
        .eq('assignment_id', id)
        .order('created_at', { ascending: false });

      if (bidsError) throw bidsError;
      setBids(bidsData || []);

      // Fetch submissions (newest first) so the student can review the latest work
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('submissions')
        .select('*')
        .eq('assignment_id', id)
        .order('revision_number', { ascending: false });

      if (submissionsError) throw submissionsError;
      setSubmissions(submissionsData || []);

      // Only completed work can be reviewed
      if (assignmentData.status === 'completed') {
        await fetchReviews();
      }
    } catch (error) {
      console.error('Error fetching assignment:', error);
      toast.error('Failed to load assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptBid = async (bidId, writerId, proposedPrice) => {
    if (!confirm('Are you sure you want to accept this bid? This action cannot be undone.')) {
      return;
    }

    setActionLoading(true);

    try {
      // Update bid status
      const { error: bidError } = await supabase
        .from('bids')
        .update({ status: 'accepted' })
        .eq('id', bidId);

      if (bidError) throw bidError;

      // Reject other bids
      const { error: rejectError } = await supabase
        .from('bids')
        .update({ status: 'rejected' })
        .eq('assignment_id', id)
        .neq('id', bidId);

      if (rejectError) throw rejectError;

      // Update assignment
      const { error: assignmentError } = await supabase
        .from('assignments')
        .update({
          status: 'assigned',
          assigned_writer_id: writerId,
          assigned_at: new Date().toISOString(),
          final_price: proposedPrice,
        })
        .eq('id', id);

      if (assignmentError) throw assignmentError;

      toast.success('Bid accepted! Proceed to payment.');

      // Ring the writer's bell. Best-effort: the award is already committed, and a
      // failure here only costs a notification.
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        fetch('/api/bids/accepted', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ bidId }),
        }).catch((notifyError) => console.error('Bid notification failed:', notifyError));
      }

      // In a real app, redirect to payment page
      // For now, just refresh the page
      fetchAssignmentDetails();
    } catch (error) {
      console.error('Error accepting bid:', error);
      toast.error('Failed to accept bid');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectBid = async (bidId) => {
    if (!confirm('Are you sure you want to reject this bid?')) {
      return;
    }

    setActionLoading(true);

    try {
      const { error } = await supabase
        .from('bids')
        .update({ status: 'rejected' })
        .eq('id', bidId);

      if (error) throw error;

      toast.success('Bid rejected');
      fetchAssignmentDetails();
    } catch (error) {
      console.error('Error rejecting bid:', error);
      toast.error('Failed to reject bid');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!assignment) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-textBody">Assignment not found</p>
          <Link href="/dashboard/assignments" className="text-brandBlue hover:underline">
            Back to assignments
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const getStatusBadge = (status) => statusTone(status);

  const latestSubmission = submissions[0] || null;
  const isOwner = profile?.id === assignment.student_id;
  const isAssignedWriter = profile?.id === assignment.assigned_writer_id;
  const canMessage = Boolean(assignment.assigned_writer_id) && (isOwner || isAssignedWriter);

  const acceptedBid = bids.find((bid) => bid.status === 'accepted') || null;
  const myReview = reviews.find((review) => review.reviewer_id === profile?.id) || null;
  const receivedReview = reviews.find((review) => review.reviewee_id === profile?.id) || null;
  const canReview =
    isOwner && assignment.status === 'completed' && Boolean(assignment.assigned_writer_id);

  return (
    <DashboardLayout>
      <div className="max-w-6xl">
        {/* Back Button */}
        <Link
          href="/dashboard/assignments"
          className="inline-flex items-center gap-2 text-brandBlue hover:text-brandAccent mb-6"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Assignments
        </Link>

        {/* Assignment Details Card */}
        <div className="bg-white rounded-xl border border-brandGrid p-8 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-brandNavy mb-2">{assignment.title}</h1>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(
                    assignment.status
                  )}`}
                >
                  {statusLabel(assignment.status)}
                </span>

                {canMessage && (
                  <Link
                    href={`/dashboard/assignments/${assignment.id}/messages`}
                    className="inline-flex items-center gap-2 rounded-lg border border-brandGrid px-3 py-1.5 text-sm font-medium text-brandBlue transition-colors hover:border-brandBlue hover:bg-brandIce"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Message {isOwner ? 'writer' : 'student'}
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Assignment Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6 pb-6 border-b border-brandGrid">
            <div>
              <p className="text-sm text-textMuted mb-1">Subject</p>
              <p className="font-medium text-textDark">{assignment.subject}</p>
            </div>
            <div>
              <p className="text-sm text-textMuted mb-1">Academic Level</p>
              <p className="font-medium text-textDark capitalize">
                {assignment.academic_level.replace('_', ' ')}
              </p>
            </div>
            <div>
              <p className="text-sm text-textMuted mb-1">Deadline</p>
              <p className="font-medium text-textDark">
                {new Date(assignment.deadline).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-textMuted mb-1">Budget Range</p>
              <p className="font-medium text-brandBlue">
                {assignment.budget_min && assignment.budget_max
                  ? `$${assignment.budget_min} - $${assignment.budget_max}`
                  : 'Not set'}
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="font-bold text-brandNavy mb-3">Description & Requirements</h3>
            <p className="text-textBody whitespace-pre-wrap">{assignment.description}</p>
          </div>

          {assignment.pages || assignment.words ? (
            <div className="mt-6 pt-6 border-t border-brandGrid">
              <h3 className="font-bold text-brandNavy mb-3">Assignment Details</h3>
              <div className="flex gap-6">
                {assignment.pages && (
                  <p className="text-textBody">
                    <span className="font-medium">Pages:</span> {assignment.pages}
                  </p>
                )}
                {assignment.words && (
                  <p className="text-textBody">
                    <span className="font-medium">Words:</span> {assignment.words}
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Submission Review (student only) */}
        {isOwner && latestSubmission && (
          <SubmissionReview
            submission={latestSubmission}
            submissions={submissions}
            onActionComplete={fetchAssignmentDetails}
          />
        )}

        {/* Rating the writer (student, after approval) */}
        {canReview && (
          <div className="mb-6">
            <ReviewForm
              assignmentId={assignment.id}
              writerName={acceptedBid?.profiles?.full_name}
              existingReview={myReview}
              onSaved={fetchReviews}
            />
          </div>
        )}

        {/* The review the student left (writer) */}
        {isAssignedWriter && receivedReview && (
          <div className="mb-6">
            <ReviewCard review={receivedReview} heading="Student review" />
          </div>
        )}

        {/* Bids Section */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-brandNavy">
              Bids Received ({bids.filter((b) => b.status === 'pending').length})
            </h2>
          </div>

          {bids.length === 0 ? (
            <div className="bg-white rounded-xl border border-brandGrid p-12 text-center">
              <div className="h-20 w-20 bg-brandIce rounded-full flex items-center justify-center mx-auto mb-4">
                <Inbox className="h-10 w-10 text-brandBlue" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-bold text-brandNavy mb-2">No bids yet</h3>
              <p className="text-textBody">
                Writers will start bidding on your assignment soon. Check back later!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {bids.map((bid) => (
                <div
                  key={bid.id}
                  className={`bg-white rounded-xl border-2 p-6 ${
                    bid.status === 'accepted'
                      ? 'border-green-500'
                      : bid.status === 'rejected'
                      ? 'border-gray-300 opacity-60'
                      : 'border-brandGrid'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-12 w-12 rounded-full bg-brandBlue/10 flex items-center justify-center">
                          <span className="text-xl font-bold text-brandBlue">
                            {bid.profiles?.full_name?.[0] || 'W'}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-bold text-brandNavy">{bid.profiles?.full_name || 'Writer'}</h3>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="inline-flex items-center gap-1 text-textMuted">
                              <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                              {bid.profiles?.rating?.toFixed(1) || '0.0'}
                            </span>
                            <span className="text-textMuted">•</span>
                            <span className="text-textMuted">
                              {bid.profiles?.completed_assignments || 0} completed
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-brandBlue">${bid.proposed_price}</p>
                      <p className="text-sm text-textMuted">
                        Delivery: {new Date(bid.estimated_delivery).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Cover Letter */}
                  <div className="mb-4">
                    <p className="text-sm font-medium text-brandNavy mb-2">Proposal:</p>
                    <p className="text-textBody">{bid.cover_letter}</p>
                  </div>

                  {/* Actions */}
                  {bid.status === 'pending' && assignment.status === 'open' && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleAcceptBid(bid.id, bid.writer_id, bid.proposed_price)}
                        disabled={actionLoading}
                        className="flex-1 bg-brandBlue text-white py-2 rounded-lg font-medium hover:bg-brandAccent transition-colors disabled:opacity-50"
                      >
                        Accept Bid
                      </button>
                      <button
                        onClick={() => handleRejectBid(bid.id)}
                        disabled={actionLoading}
                        className="px-6 border-2 border-brandGrid text-textDark py-2 rounded-lg font-medium hover:border-red-500 hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {bid.status === 'accepted' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="flex items-center gap-2 text-green-800 font-medium">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        Bid Accepted
                      </p>
                      <p className="text-sm text-green-600 mt-1">
                        Proceed to payment to start the work
                      </p>
                    </div>
                  )}

                  {bid.status === 'rejected' && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="flex items-center gap-2 text-gray-600">
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                        Bid Rejected
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
