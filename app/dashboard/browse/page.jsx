'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Check, RefreshCw, Search } from 'lucide-react';

export default function BrowseAssignmentsPage() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    subject: '',
    academic_level: '',
    min_budget: '',
    max_budget: '',
  });

  const userId = profile?.id;

  useEffect(() => {
    fetchAssignments();
  }, [userId]);

  const fetchAssignments = async () => {
    // The profile arrives asynchronously; DashboardLayout shows a spinner until
    // then, so there is nothing to query yet.
    if (!userId) return;

    setLoading(true);

    try {
      setError(null);

      // Only open work from other people: writers can post assignments too and
      // should never be able to bid on their own job.
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          profiles:student_id (
            full_name
          ),
          bids!left (
            id,
            writer_id
          )
        `)
        .eq('status', 'open')
        .neq('student_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const assignmentsWithBidStatus = (data || []).map((assignment) => ({
        ...assignment,
        hasBid: assignment.bids?.some((bid) => bid.writer_id === userId),
      }));

      setAssignments(assignmentsWithBidStatus);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setError(error.message || 'Failed to fetch assignments');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = assignments;

    if (filters.subject) {
      filtered = filtered.filter((a) =>
        a.subject.toLowerCase().includes(filters.subject.toLowerCase())
      );
    }

    if (filters.academic_level) {
      filtered = filtered.filter((a) => a.academic_level === filters.academic_level);
    }

    if (filters.min_budget) {
      filtered = filtered.filter((a) => a.budget_max >= parseFloat(filters.min_budget));
    }

    if (filters.max_budget) {
      filtered = filtered.filter((a) => a.budget_min <= parseFloat(filters.max_budget));
    }

    return filtered;
  };

  const filteredAssignments = applyFilters();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">Loading opportunities...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-brandNavy mb-3">Browse Assignments</h1>
              <p className="text-lg text-textBody">Find assignments that match your expertise</p>
            </div>
            <button
              onClick={fetchAssignments}
              className="inline-flex items-center gap-2 px-5 py-3 bg-brandBlue text-white rounded-lg hover:bg-brandAccent transition-colors font-medium"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Refresh
            </button>
          </div>
          {error && (
            <div className="mt-5 bg-red-50 border border-red-200 rounded-lg p-5">
              <p className="text-red-800 font-medium">Error: {error}</p>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-brandGrid p-7">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div>
              <label className="block text-sm font-medium text-brandNavy mb-2">Subject</label>
              <input
                type="text"
                value={filters.subject}
                onChange={(e) => setFilters({ ...filters, subject: e.target.value })}
                placeholder="e.g., English"
                className="w-full px-4 py-2 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brandNavy mb-2">Academic Level</label>
              <select
                value={filters.academic_level}
                onChange={(e) => setFilters({ ...filters, academic_level: e.target.value })}
                className="w-full px-4 py-2 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent"
              >
                <option value="">All Levels</option>
                <option value="high_school">High School</option>
                <option value="undergraduate">Undergraduate</option>
                <option value="masters">Master's</option>
                <option value="phd">PhD</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-brandNavy mb-2">Min Budget</label>
              <input
                type="number"
                value={filters.min_budget}
                onChange={(e) => setFilters({ ...filters, min_budget: e.target.value })}
                placeholder="$ 0"
                className="w-full px-4 py-2 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brandNavy mb-2">Max Budget</label>
              <input
                type="number"
                value={filters.max_budget}
                onChange={(e) => setFilters({ ...filters, max_budget: e.target.value })}
                placeholder="$ 500"
                className="w-full px-4 py-2 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent"
              />
            </div>
          </div>

          <div className="mt-5">
            <button
              onClick={() => setFilters({ subject: '', academic_level: '', min_budget: '', max_budget: '' })}
              className="text-sm text-brandBlue hover:text-brandAccent font-medium"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Results Count */}
        <div className="flex justify-between items-center">
          <p className="text-textBody">
            Showing <span className="font-semibold">{filteredAssignments.length}</span> available assignments
            {assignments.length > 0 && ` (${assignments.length} total)`}
          </p>
        </div>

        {/* Assignments List */}
        {filteredAssignments.length === 0 ? (
          <div className="bg-white rounded-xl border border-brandGrid p-12 text-center">
            <div className="h-20 w-20 bg-brandIce rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="h-10 w-10 text-brandBlue" />
            </div>
            <h3 className="text-xl font-bold text-brandNavy mb-2">No assignments found</h3>
            <p className="text-textBody">
              {assignments.length === 0
                ? 'No open assignments at the moment. Check back soon!'
                : 'Try adjusting your filters to see more results'}
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="bg-white rounded-xl border border-brandGrid p-7 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {assignment.hasBid && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                          <Check className="h-3 w-3" aria-hidden="true" />
                          You bid on this
                        </span>
                      )}
                      <h3 className="text-xl font-bold text-brandNavy">{assignment.title}</h3>
                    </div>
                    <p className="text-textBody line-clamp-2 mb-3">{assignment.description}</p>
                    <p className="text-sm text-textMuted">Posted by {assignment.profiles?.full_name}</p>
                  </div>
                  <div className="ml-6 text-right">
                    {assignment.budget_min && assignment.budget_max ? (
                      <>
                        <p className="text-2xl font-bold text-brandBlue">
                          ${assignment.budget_min} - ${assignment.budget_max}
                        </p>
                        <p className="text-sm text-textMuted">Budget</p>
                      </>
                    ) : (
                      <p className="text-sm text-textMuted">Budget not set</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-textMuted">Subject</p>
                    <p className="font-medium text-textDark text-sm">{assignment.subject}</p>
                  </div>
                  <div>
                    <p className="text-xs text-textMuted">Level</p>
                    <p className="font-medium text-textDark text-sm capitalize">
                      {assignment.academic_level.replace('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-textMuted">Deadline</p>
                    <p className="font-medium text-textDark text-sm">
                      {new Date(assignment.deadline).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-textMuted">Bids</p>
                    <p className="font-medium text-textDark text-sm">
                      {assignment.bids?.filter((b) => b.id).length || 0}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Link
                    href={`/dashboard/browse/${assignment.id}`}
                    className="flex-1 text-center bg-brandBlue text-white py-2 rounded-lg font-medium hover:bg-brandAccent transition-colors"
                  >
                    {assignment.hasBid ? 'View Your Bid' : 'View & Bid'}
                  </Link>
                  <Link
                    href={`/dashboard/browse/${assignment.id}`}
                    className="px-6 border-2 border-brandGrid text-textDark py-2 rounded-lg font-medium hover:border-brandBlue transition-colors"
                  >
                    Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
