'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import DashboardLayout from '@/components/dashboard/DashboardLayout';

export default function AssignmentsPage() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchAssignments();
  }, [profile, filter]);

  const fetchAssignments = async () => {
    try {
      let query = supabase
        .from('assignments')
        .select('*, bids(count)')
        .eq('student_id', profile.id)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      open: 'bg-blue-100 text-blue-800',
      assigned: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-purple-100 text-purple-800',
      under_review: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800',
      disputed: 'bg-red-100 text-red-800',
    };
    return badges[status] || badges.open;
  };

  const getStatusIcon = (status) => {
    const icons = {
      open: '📢',
      assigned: '👤',
      in_progress: '✍️',
      under_review: '👀',
      completed: '✅',
      cancelled: '❌',
      disputed: '⚠️',
    };
    return icons[status] || '📝';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">Loading assignments...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-brandNavy mb-3">My Assignments</h1>
            <p className="text-lg text-textBody">Manage and track all your assignments</p>
          </div>
          <Link
            href="/dashboard/post-assignment"
            className="bg-brandBlue text-white px-6 py-3 rounded-lg font-medium hover:bg-brandAccent transition-colors"
          >
            + Post New Assignment
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'open', label: 'Open' },
            { value: 'assigned', label: 'Assigned' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'under_review', label: 'Under Review' },
            { value: 'completed', label: 'Completed' },
          ].map((filterOption) => (
            <button
              key={filterOption.value}
              onClick={() => setFilter(filterOption.value)}
              className={`px-5 py-2.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === filterOption.value
                  ? 'bg-brandBlue text-white'
                  : 'bg-white border border-brandGrid text-textBody hover:border-brandBlue'
              }`}
            >
              {filterOption.label}
            </button>
          ))}
        </div>

        {/* Assignments List */}
        {assignments.length === 0 ? (
          <div className="bg-white rounded-xl border border-brandGrid p-12 text-center">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-bold text-brandNavy mb-2">
              {filter === 'all' ? 'No assignments yet' : `No ${filter.replace('_', ' ')} assignments`}
            </h3>
            <p className="text-textBody mb-6">
              {filter === 'all'
                ? 'Post your first assignment to get started'
                : 'Try changing the filter or post a new assignment'}
            </p>
            {filter === 'all' && (
              <Link
                href="/dashboard/post-assignment"
                className="inline-block bg-brandBlue text-white px-6 py-3 rounded-md font-medium hover:bg-brandAccent transition-colors"
              >
                Post Assignment
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {assignments.map((assignment) => (
              <Link
                key={assignment.id}
                href={`/dashboard/assignments/${assignment.id}`}
                className="block bg-white rounded-xl border border-brandGrid p-7 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-5">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{getStatusIcon(assignment.status)}</span>
                      <h3 className="text-xl font-bold text-brandNavy">{assignment.title}</h3>
                    </div>
                    <p className="text-textBody line-clamp-2">{assignment.description}</p>
                  </div>
                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ml-4 ${getStatusBadge(
                      assignment.status
                    )}`}
                  >
                    {assignment.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mt-5 pt-5 border-t border-brandGrid">
                  <div>
                    <p className="text-xs text-textMuted">Subject</p>
                    <p className="font-medium text-textDark">{assignment.subject}</p>
                  </div>
                  <div>
                    <p className="text-xs text-textMuted">Deadline</p>
                    <p className="font-medium text-textDark">
                      {new Date(assignment.deadline).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-textMuted">Budget</p>
                    <p className="font-medium text-brandBlue">
                      {assignment.budget_min && assignment.budget_max
                        ? `$${assignment.budget_min} - $${assignment.budget_max}`
                        : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-textMuted">Bids Received</p>
                    <p className="font-medium text-textDark">{assignment.bids?.[0]?.count || 0}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
