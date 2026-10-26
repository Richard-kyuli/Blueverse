'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { bidStatusIcon } from '@/lib/status';

export default function BidsPage() {
  const { profile } = useAuth();
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const userId = profile?.id;

  useEffect(() => {
    fetchBids();
  }, [userId]);

  const fetchBids = async () => {
    // The profile arrives asynchronously; there is nothing to query until then.
    if (!userId) return;

    setLoading(true);

    try {
      setError(null);

      const { data, error: queryError } = await supabase
        .from('bids')
        .select('*, assignments(*)')
        .eq('writer_id', userId)
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;
      setBids(data || []);
    } catch (loadError) {
      console.error('Error fetching bids:', loadError);
      setError(loadError.message || 'Failed to load your bids');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredBids = () => {
    if (filter === 'all') return bids;
    return bids.filter((bid) => bid.status === filter);
  };

  const filteredBids = getFilteredBids();

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      withdrawn: 'bg-gray-100 text-gray-800',
    };
    return badges[status] || badges.pending;
  };

  const getStatusIcon = (status) => {
    const Icon = bidStatusIcon(status);
    return <Icon className="h-6 w-6 text-brandBlue" aria-hidden="true" />;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">Loading bids...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-brandNavy">My Bids</h1>
          <p className="mt-2 text-textBody">Track all your submitted bids</p>
        </div>

        {error && (
          <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-5">
            <p className="font-medium text-red-800">Could not load your bids</p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={fetchBids}
              className="mt-3 rounded-lg bg-brandBlue px-4 py-2 text-sm font-medium text-white hover:bg-brandAccent transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { value: 'all', label: 'All Bids' },
            { value: 'pending', label: 'Pending' },
            { value: 'accepted', label: 'Accepted' },
            { value: 'rejected', label: 'Rejected' },
          ].map((filterOption) => (
            <button
              key={filterOption.value}
              onClick={() => setFilter(filterOption.value)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === filterOption.value
                  ? 'bg-brandBlue text-white'
                  : 'bg-white border border-brandGrid text-textBody hover:border-brandBlue'
              }`}
            >
              {filterOption.label}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-brandGrid p-4">
            <p className="text-sm text-textMuted">Total Bids</p>
            <p className="text-2xl font-bold text-brandNavy">{bids.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-brandGrid p-4">
            <p className="text-sm text-textMuted">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">
              {bids.filter((b) => b.status === 'pending').length}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-brandGrid p-4">
            <p className="text-sm text-textMuted">Accepted</p>
            <p className="text-2xl font-bold text-green-600">
              {bids.filter((b) => b.status === 'accepted').length}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-brandGrid p-4">
            <p className="text-sm text-textMuted">Success Rate</p>
            <p className="text-2xl font-bold text-brandBlue">
              {bids.length > 0
                ? Math.round((bids.filter((b) => b.status === 'accepted').length / bids.length) * 100)
                : 0}
              %
            </p>
          </div>
        </div>

        {/* Bids List */}
        {filteredBids.length === 0 ? (
          <div className="bg-white rounded-xl border border-brandGrid p-12 text-center">
            <div className="h-20 w-20 bg-brandIce rounded-full flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="h-10 w-10 text-brandBlue" aria-hidden="true" />
            </div>
            <h3 className="text-xl font-bold text-brandNavy mb-2">
              {bids.length === 0 ? 'No bids yet' : `No ${filter} bids`}
            </h3>
            <p className="text-textBody mb-6">
              {bids.length === 0
                ? 'Start bidding on assignments to see them here'
                : 'Try changing the filter or submit more bids'}
            </p>
            {bids.length === 0 && (
              <Link
                href="/dashboard/browse"
                className="inline-block bg-brandBlue text-white px-6 py-3 rounded-md font-medium hover:bg-brandAccent transition-colors"
              >
                Browse Assignments
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBids.map((bid) => (
              <div
                key={bid.id}
                className={`bg-white rounded-xl border-2 p-6 ${
                  bid.status === 'accepted'
                    ? 'border-green-500'
                    : bid.status === 'rejected'
                    ? 'border-red-300'
                    : 'border-brandGrid'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(bid.status)}
                      <h3 className="text-xl font-bold text-brandNavy">
                        {bid.assignments?.title || 'Assignment'}
                      </h3>
                    </div>
                    <p className="text-textBody line-clamp-2">{bid.assignments?.description}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-4 ${getStatusBadge(bid.status)}`}>
                    {bid.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-textMuted">Your Bid</p>
                    <p className="font-bold text-brandBlue">${bid.proposed_price}</p>
                  </div>
                  <div>
                    <p className="text-xs text-textMuted">Delivery Date</p>
                    <p className="font-medium text-textDark">
                      {new Date(bid.estimated_delivery).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-textMuted">Submitted</p>
                    <p className="font-medium text-textDark">
                      {new Date(bid.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-textMuted">Assignment Status</p>
                    <p className="font-medium text-textDark capitalize">
                      {bid.assignments?.status?.replace('_', ' ')}
                    </p>
                  </div>
                </div>

                {/* Proposal */}
                <div className="mb-4 pt-4 border-t border-brandGrid">
                  <p className="text-sm font-medium text-brandNavy mb-2">Your Proposal:</p>
                  <p className="text-textBody text-sm line-clamp-2">{bid.cover_letter}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Link
                    href={`/dashboard/browse/${bid.assignment_id}`}
                    className="flex-1 text-center border-2 border-brandGrid text-textDark py-2 rounded-lg font-medium hover:border-brandBlue transition-colors"
                  >
                    View Assignment
                  </Link>
                  {bid.status === 'pending' && (
                    <Link
                      href={`/dashboard/browse/${bid.assignment_id}`}
                      className="flex-1 text-center bg-brandBlue text-white py-2 rounded-lg font-medium hover:bg-brandAccent transition-colors"
                    >
                      Edit Bid
                    </Link>
                  )}
                  {bid.status === 'accepted' &&
                    (['assigned', 'in_progress'].includes(bid.assignments?.status) ? (
                      <Link
                        href={`/dashboard/assignments/${bid.assignment_id}/submit`}
                        className="flex-1 text-center bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
                      >
                        Submit Work
                      </Link>
                    ) : bid.assignments?.status === 'under_review' ? (
                      <div className="flex-1 text-center bg-amber-100 text-amber-800 py-2 rounded-lg font-medium">
                        Under Review
                      </div>
                    ) : (
                      <div className="flex-1 text-center bg-green-100 text-green-800 py-2 rounded-lg font-medium">
                        {bid.assignments?.status === 'completed' ? 'Completed' : 'Accepted'}
                      </div>
                    ))}
                  {bid.status === 'accepted' && (
                    <Link
                      href={`/dashboard/assignments/${bid.assignment_id}/messages`}
                      className="flex-1 text-center border-2 border-brandGrid text-brandBlue py-2 rounded-lg font-medium hover:border-brandBlue hover:bg-brandIce transition-colors"
                    >
                      Messages
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
