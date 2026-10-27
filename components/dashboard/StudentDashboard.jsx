'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { FileText, Zap, CheckCircle, DollarSign, PlusCircle, MessageSquare, Eye, ArrowRight, AlertTriangle } from 'lucide-react';
import { statusLabel, statusTone } from '@/lib/status';
import DisputeNotice from '@/components/disputes/DisputeNotice';

export default function StudentDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    totalAssignments: 0,
    activeAssignments: 0,
    completedAssignments: 0,
    totalSpent: 0,
  });
  const [recentAssignments, setRecentAssignments] = useState([]);
  const [disputedAssignments, setDisputedAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (profile?.id) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [profile]);

  const fetchDashboardData = async () => {
    try {
      setError(null);

      // Fetch every assignment so the totals are accurate, then list only the
      // five most recent ones.
      const { data: assignments, error: queryError } = await supabase
        .from('assignments')
        .select('*')
        .eq('student_id', profile.id)
        .order('created_at', { ascending: false });

      if (queryError) {
        console.error('Supabase error:', queryError);
        throw queryError;
      }

      const all = assignments || [];
      setRecentAssignments(all.slice(0, 5));
      // Disputes are surfaced on their own because they need attention and
      // would otherwise look like ordinary work in progress.
      setDisputedAssignments(all.filter((a) => a.status === 'disputed'));

      // Calculate stats
      const total = all.length;
      const active = all.filter(a => ['open', 'assigned', 'in_progress'].includes(a.status)).length;
      const completed = all.filter(a => a.status === 'completed').length;
      // Only money already released to a writer counts as spent.
      const spent = all
        .filter(a => a.status === 'completed' && a.final_price)
        .reduce((sum, a) => sum + parseFloat(a.final_price), 0);

      setStats({
        totalAssignments: total,
        activeAssignments: active,
        completedAssignments: completed,
        totalSpent: spent,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError(error.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-2xl mx-auto">
          <h3 className="text-xl font-bold text-yellow-800 mb-2">Profile Not Loaded</h3>
          <p className="text-yellow-600">Please refresh the page or sign in again.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto">
          <h3 className="text-xl font-bold text-red-800 mb-2">Error Loading Dashboard</h3>
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-4 bg-brandBlue text-white px-6 py-2 rounded-lg hover:bg-brandAccent transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <header>
        <h1 className="text-3xl md:text-4xl font-bold text-brandNavy mb-2">Welcome back, {profile.full_name}!</h1>
        <p className="text-base md:text-lg text-textBody">Here's what's happening with your assignments</p>
      </header>

      {/* Disputes: the one thing on this page that needs a decision */}
      {disputedAssignments.length > 0 && (
        <section aria-labelledby="disputes-heading">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2
              id="disputes-heading"
              className="flex items-center gap-2 text-xl md:text-2xl font-bold text-brandNavy"
            >
              <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden="true" />
              Disputes ({disputedAssignments.length})
            </h2>
            <span className="text-sm text-textBody">
              Payment is on hold until BlueVerse support settles {disputedAssignments.length === 1 ? 'it' : 'these'}.
            </span>
          </div>

          <ul className="space-y-3">
            {disputedAssignments.map((assignment) => (
              <li
                key={assignment.id}
                className="rounded-xl border border-brandGrid bg-white p-4 md:p-5"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/dashboard/assignments/${assignment.id}`}
                    className="font-medium text-brandNavy hover:text-brandBlue transition-colors"
                  >
                    {assignment.title}
                  </Link>
                  <Link
                    href={`/dashboard/assignments/${assignment.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-brandBlue hover:text-brandAccent"
                  >
                    Open assignment
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
                <DisputeNotice assignment={assignment} viewerRole="student" compact />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Stats Grid */}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">Assignment Statistics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <article className="bg-white rounded-xl border border-brandGrid p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-textMuted mb-1">Total Assignments</p>
              <p className="text-3xl font-bold text-brandNavy" aria-label={`${stats.totalAssignments} total assignments`}>{stats.totalAssignments}</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </article>

        <article className="bg-white rounded-xl border border-brandGrid p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-textMuted mb-1">Active</p>
              <p className="text-3xl font-bold text-brandNavy" aria-label={`${stats.activeAssignments} active assignments`}>{stats.activeAssignments}</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-yellow-50 flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <Zap className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </article>

        <article className="bg-white rounded-xl border border-brandGrid p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-textMuted mb-1">Completed</p>
              <p className="text-3xl font-bold text-brandNavy" aria-label={`${stats.completedAssignments} completed assignments`}>{stats.completedAssignments}</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </article>

        <article className="bg-white rounded-xl border border-brandGrid p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-textMuted mb-1">Total Spent</p>
              <p className="text-3xl font-bold text-brandNavy" aria-label={`$${stats.totalSpent.toFixed(2)} total spent`}>${stats.totalSpent.toFixed(2)}</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </article>
        </div>
      </section>

      {/* Quick Actions */}
      <section aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading" className="text-xl md:text-2xl font-bold text-brandNavy mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <Link
            href="/dashboard/post-assignment"
            className="group bg-gradient-to-br from-brandBlue to-brandAccent text-white rounded-xl p-5 md:p-6 hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-brandBlue focus:ring-offset-2"
            aria-label="Post a new assignment"
          >
            <div className="h-12 w-12 bg-white/20 rounded-lg flex items-center justify-center mb-3" aria-hidden="true">
              <PlusCircle className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-base md:text-lg">Post New Assignment</h3>
            <p className="text-sm text-blue-100 mt-1">Get help with your work</p>
          </Link>

          <Link
            href="/dashboard/assignments"
            className="group bg-white border-2 border-brandGrid rounded-xl p-5 md:p-6 hover:border-brandBlue hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-brandBlue focus:ring-offset-2"
            aria-label="View all your assignments"
          >
            <div className="h-12 w-12 bg-brandIce rounded-lg flex items-center justify-center mb-3" aria-hidden="true">
              <FileText className="h-6 w-6 text-brandBlue" />
            </div>
            <h3 className="font-bold text-base md:text-lg text-brandNavy">View Assignments</h3>
            <p className="text-sm text-textBody mt-1">Track your projects</p>
          </Link>

          <Link
            href="/dashboard/messages"
            className="group bg-white border-2 border-brandGrid rounded-xl p-5 md:p-6 hover:border-brandBlue hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-brandBlue focus:ring-offset-2"
            aria-label="View your messages"
          >
            <div className="h-12 w-12 bg-brandIce rounded-lg flex items-center justify-center mb-3" aria-hidden="true">
              <MessageSquare className="h-6 w-6 text-brandBlue" />
            </div>
            <h3 className="font-bold text-base md:text-lg text-brandNavy">Messages</h3>
            <p className="text-sm text-textBody mt-1">Chat with writers</p>
          </Link>
        </div>
      </section>

      {/* Recent Assignments */}
      <section aria-labelledby="recent-assignments-heading">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 id="recent-assignments-heading" className="text-xl md:text-2xl font-bold text-brandNavy">Recent Assignments</h2>
            <p className="text-sm text-textMuted mt-1">Your latest requests and their status</p>
          </div>
          {recentAssignments.length > 0 && (
            <Link 
              href="/dashboard/assignments" 
              className="text-brandBlue hover:text-brandAccent font-medium text-sm flex items-center gap-1 focus:outline-none focus:underline"
              aria-label="View all assignments"
            >
              View All
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>

        {recentAssignments.length === 0 ? (
          <div className="bg-white rounded-xl border border-brandGrid p-10 md:p-12 text-center">
            <div className="h-16 w-16 md:h-20 md:w-20 bg-brandIce rounded-full flex items-center justify-center mx-auto mb-4" aria-hidden="true">
              <FileText className="h-8 w-8 md:h-10 md:w-10 text-brandBlue" />
            </div>
            <h3 className="text-lg md:text-xl font-bold text-brandNavy mb-2">No assignments yet</h3>
            <p className="text-sm md:text-base text-textBody mb-6 max-w-md mx-auto">Post your first assignment to get started and connect with qualified writers</p>
            <Link
              href="/dashboard/post-assignment"
              className="inline-flex items-center gap-2 bg-brandBlue text-white px-5 md:px-6 py-2.5 md:py-3 rounded-lg font-medium hover:bg-brandAccent transition-colors focus:outline-none focus:ring-2 focus:ring-brandBlue focus:ring-offset-2"
            >
              <PlusCircle className="h-5 w-5" aria-hidden="true" />
              <span>Post Assignment</span>
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-brandGrid overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Recent assignments table">
                <thead className="bg-brandIce">
                  <tr>
                    <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium text-textMuted uppercase">Title</th>
                    <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium text-textMuted uppercase hidden sm:table-cell">Subject</th>
                    <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium text-textMuted uppercase hidden md:table-cell">Deadline</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-textMuted uppercase">Status</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-textMuted uppercase">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brandGrid">
                  {recentAssignments.map((assignment) => (
                    <tr key={assignment.id} className="hover:bg-brandIce/50 transition-colors">
                      <td className="px-4 md:px-6 py-4">
                        <div className="text-sm font-medium text-brandNavy">{assignment.title}</div>
                        <div className="text-sm text-textBody mt-1 sm:hidden">{assignment.subject}</div>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-sm text-textBody hidden sm:table-cell">{assignment.subject}</td>
                      <td className="px-4 md:px-6 py-4 text-sm text-textBody hidden md:table-cell">
                        <time dateTime={assignment.deadline}>
                          {new Date(assignment.deadline).toLocaleDateString()}
                        </time>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${statusTone(assignment.status)}`}>
                          {statusLabel(assignment.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/dashboard/assignments/${assignment.id}`}
                          className="inline-flex items-center gap-1 text-brandBlue hover:text-brandAccent font-medium text-sm transition-colors focus:outline-none focus:underline"
                          aria-label={`View details for ${assignment.title}`}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          <span className="hidden sm:inline">View</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
