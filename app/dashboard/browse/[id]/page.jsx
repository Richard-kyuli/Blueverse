'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/dashboard/DashboardLayout';

export default function AssignmentBidPage() {
  const { id } = useParams();
  const { profile } = useAuth();
  const router = useRouter();
  const [assignment, setAssignment] = useState(null);
  const [existingBid, setExistingBid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bidForm, setBidForm] = useState({
    proposed_price: '',
    estimated_delivery: '',
    cover_letter: '',
  });

  useEffect(() => {
    fetchAssignmentAndBid();
  }, [id]);

  const fetchAssignmentAndBid = async () => {
    try {
      // Fetch assignment with student profile (specify the relationship)
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .select(`
          *,
          profiles:student_id (
            full_name,
            email
          )
        `)
        .eq('id', id)
        .single();

      if (assignmentError) throw assignmentError;
      setAssignment(assignmentData);

      // Check if writer has already bid
      const { data: bidData, error: bidError } = await supabase
        .from('bids')
        .select('*')
        .eq('assignment_id', id)
        .eq('writer_id', profile.id)
        .maybeSingle();

      if (bidError && bidError.code !== 'PGRST116') throw bidError;
      
      if (bidData) {
        setExistingBid(bidData);
        setBidForm({
          proposed_price: bidData.proposed_price.toString(),
          estimated_delivery: new Date(bidData.estimated_delivery).toISOString().slice(0, 16),
          cover_letter: bidData.cover_letter,
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load assignment');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitBid = async (e) => {
    e.preventDefault();

    if (!bidForm.proposed_price || !bidForm.estimated_delivery || !bidForm.cover_letter) {
      toast.error('Please fill in all fields');
      return;
    }

    if (new Date(bidForm.estimated_delivery) < new Date()) {
      toast.error('Delivery date must be in the future');
      return;
    }

    if (new Date(bidForm.estimated_delivery) > new Date(assignment.deadline)) {
      if (!confirm('Your estimated delivery is after the deadline. Continue anyway?')) {
        return;
      }
    }

    setSubmitting(true);

    try {
      if (existingBid) {
        // Update existing bid
        const { error } = await supabase
          .from('bids')
          .update({
            proposed_price: parseFloat(bidForm.proposed_price),
            estimated_delivery: bidForm.estimated_delivery,
            cover_letter: bidForm.cover_letter,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingBid.id);

        if (error) throw error;
        toast.success('Bid updated successfully!');
      } else {
        // Create new bid
        const { error } = await supabase.from('bids').insert([
          {
            assignment_id: id,
            writer_id: profile.id,
            proposed_price: parseFloat(bidForm.proposed_price),
            estimated_delivery: bidForm.estimated_delivery,
            cover_letter: bidForm.cover_letter,
            status: 'pending',
          },
        ]);

        if (error) throw error;
        toast.success('Bid submitted successfully!');
      }

      router.push('/dashboard/bids');
    } catch (error) {
      console.error('Error submitting bid:', error);
      toast.error('Failed to submit bid');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdrawBid = async () => {
    if (!confirm('Are you sure you want to withdraw your bid?')) {
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('bids')
        .update({ status: 'withdrawn' })
        .eq('id', existingBid.id);

      if (error) throw error;

      toast.success('Bid withdrawn');
      router.push('/dashboard/browse');
    } catch (error) {
      console.error('Error withdrawing bid:', error);
      toast.error('Failed to withdraw bid');
    } finally {
      setSubmitting(false);
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
          <Link href="/dashboard/browse" className="text-brandBlue hover:underline">
            Back to browse
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  if (assignment.status !== 'open') {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔒</div>
          <h3 className="text-xl font-bold text-brandNavy mb-2">Assignment Not Available</h3>
          <p className="text-textBody mb-6">This assignment is no longer accepting bids</p>
          <Link
            href="/dashboard/browse"
            className="inline-block bg-brandBlue text-white px-6 py-3 rounded-md font-medium hover:bg-brandAccent transition-colors"
          >
            Browse Other Assignments
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl">
        {/* Back Button */}
        <Link
          href="/dashboard/browse"
          className="inline-flex items-center text-brandBlue hover:text-brandAccent mb-6"
        >
          ← Back to Browse
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Assignment Details */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-brandGrid p-8 mb-6">
              <h1 className="text-3xl font-bold text-brandNavy mb-4">{assignment.title}</h1>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 pb-6 border-b border-brandGrid">
                <div>
                  <p className="text-sm text-textMuted mb-1">Subject</p>
                  <p className="font-medium text-textDark">{assignment.subject}</p>
                </div>
                <div>
                  <p className="text-sm text-textMuted mb-1">Level</p>
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
                  <p className="text-sm text-textMuted mb-1">Budget</p>
                  <p className="font-medium text-brandBlue">
                    {assignment.budget_min && assignment.budget_max
                      ? `$${assignment.budget_min} - $${assignment.budget_max}`
                      : 'Not set'}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-bold text-brandNavy mb-3">Description & Requirements</h3>
                <p className="text-textBody whitespace-pre-wrap">{assignment.description}</p>
              </div>

              {(assignment.pages || assignment.words) && (
                <div className="pt-6 border-t border-brandGrid">
                  <h3 className="font-bold text-brandNavy mb-3">Details</h3>
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
              )}
            </div>

            {/* Student Info */}
            <div className="bg-white rounded-xl border border-brandGrid p-6">
              <h3 className="font-bold text-brandNavy mb-4">Posted By</h3>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-brandBlue/10 flex items-center justify-center">
                  <span className="text-xl font-bold text-brandBlue">
                    {assignment.profiles?.full_name?.[0] || 'S'}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-brandNavy">{assignment.profiles?.full_name}</p>
                  <p className="text-sm text-textMuted">Student</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bid Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border-2 border-brandBlue p-6 sticky top-6">
              <h2 className="text-2xl font-bold text-brandNavy mb-6">
                {existingBid ? 'Update Your Bid' : 'Submit Your Bid'}
              </h2>

              {existingBid && existingBid.status !== 'pending' && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Your bid status: <span className="font-medium capitalize">{existingBid.status}</span>
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmitBid} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-brandNavy mb-2">
                    Your Price (USD) *
                  </label>
                  <input
                    type="number"
                    value={bidForm.proposed_price}
                    onChange={(e) => setBidForm({ ...bidForm, proposed_price: e.target.value })}
                    required
                    min="1"
                    step="0.01"
                    className="w-full px-4 py-3 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent"
                    placeholder="e.g., 75.00"
                    disabled={existingBid && existingBid.status === 'accepted'}
                  />
                  {assignment.budget_min && assignment.budget_max && (
                    <p className="mt-1 text-xs text-textMuted">
                      Student budget: ${assignment.budget_min} - ${assignment.budget_max}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-brandNavy mb-2">
                    Estimated Delivery *
                  </label>
                  <input
                    type="datetime-local"
                    value={bidForm.estimated_delivery}
                    onChange={(e) => setBidForm({ ...bidForm, estimated_delivery: e.target.value })}
                    required
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-4 py-3 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent"
                    disabled={existingBid && existingBid.status === 'accepted'}
                  />
                  <p className="mt-1 text-xs text-textMuted">
                    Assignment deadline: {new Date(assignment.deadline).toLocaleString()}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-brandNavy mb-2">
                    Cover Letter / Proposal *
                  </label>
                  <textarea
                    value={bidForm.cover_letter}
                    onChange={(e) => setBidForm({ ...bidForm, cover_letter: e.target.value })}
                    required
                    rows={6}
                    className="w-full px-4 py-3 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent"
                    placeholder="Explain why you're the best fit for this assignment, your relevant experience, and approach..."
                    disabled={existingBid && existingBid.status === 'accepted'}
                  />
                </div>

                {(!existingBid || existingBid.status === 'pending') && (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-brandBlue text-white py-3 rounded-lg font-semibold hover:bg-brandAccent transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : existingBid ? 'Update Bid' : 'Submit Bid'}
                  </button>
                )}

                {existingBid && existingBid.status === 'pending' && (
                  <button
                    type="button"
                    onClick={handleWithdrawBid}
                    disabled={submitting}
                    className="w-full border-2 border-red-500 text-red-500 py-3 rounded-lg font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    Withdraw Bid
                  </button>
                )}

                {existingBid && existingBid.status === 'accepted' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-800 font-medium text-center">✅ Your Bid Was Accepted!</p>
                    <p className="text-sm text-green-600 text-center mt-1">
                      Wait for the student to complete payment
                    </p>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
