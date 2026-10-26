'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Briefcase, Zap, CheckCircle, DollarSign, Search, TrendingUp, Star, Award, ArrowRight } from 'lucide-react';
import { buildEarningsSummary } from '@/lib/payments';
import { ACTIVE_ASSIGNMENT_STATUSES } from '@/lib/status';

export default function WriterDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    activeBids: 0,
    activeJobs: 0,
    completedJobs: 0,
    totalEarnings: 0,
  });
  const [recentOpportunities, setRecentOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const userId = profile?.id;

  useEffect(() => {
    if (!userId) return;
    fetchDashboardData();
  }, [userId]);

  const fetchDashboardData = async () => {
    if (!userId) return;

    try {
      setError(null);

      // Bids the writer has placed
      const { data: bids, error: bidsError } = await supabase
        .from('bids')
        .select('id, status')
        .eq('writer_id', userId);

      if (bidsError) throw bidsError;

      // Every job that has been awarded to this writer
      const { data: jobs, error: jobsError } = await supabase
        .from('assignments')
        .select('*')
        .eq('assigned_writer_id', userId)
        .in('status', [...ACTIVE_ASSIGNMENT_STATUSES, 'under_review', 'completed']);

      if (jobsError) throw jobsError;

      // Recent open assignments, excluding anything this writer posted
      const { data: opportunities, error: opportunitiesError } = await supabase
        .from('assignments')
        .select('*')
        .eq('status', 'open')
        .neq('student_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (opportunitiesError) throw opportunitiesError;

      setRecentOpportunities(opportunities || []);

      const rows = jobs || [];
      const activeJobs = rows.filter((job) => ACTIVE_ASSIGNMENT_STATUSES.includes(job.status));
      const completedJobs = rows.filter((job) => job.status === 'completed');

      setStats({
        activeBids: (bids || []).filter((bid) => bid.status === 'pending').length,
        activeJobs: activeJobs.length,
        completedJobs: completedJobs.length,
        // Same arithmetic as the earnings page, after the platform fee.
        totalEarnings: buildEarningsSummary(completedJobs).totals.totalEarned,
      });
    } catch (loadError) {
      console.error('Error fetching dashboard data:', loadError);
      setError(loadError.message || 'Failed to load your dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div>
      {/* Welcome Section */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between mb-10">
        <div>
          <p className="text-sm font-medium text-textMuted">Dashboard</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-brandNavy md:text-4xl">Welcome back, {profile.full_name}!</h1>
          <p className="mt-2 text-textBody">Here are your writing opportunities</p>
        </div>
      </header>

      {error && (
        <div role="alert" className="mb-8 rounded-lg border border-red-200 bg-red-50 p-5">
          <p className="font-medium text-red-800">Could not load your dashboard</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={fetchDashboardData}
            className="mt-3 rounded-lg bg-brandBlue px-4 py-2 text-sm font-medium text-white hover:bg-brandAccent transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <section aria-label="Overview" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="bg-white rounded-xl border border-brandGrid p-8 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-textMuted mb-2">Active Bids</p>
              <p className="text-3xl font-bold text-brandNavy">{stats.activeBids}</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-blue-50 flex items-center justify-center">
              <Briefcase className="h-7 w-7 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-brandGrid p-8 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-textMuted mb-2">Active Jobs</p>
              <p className="text-3xl font-bold text-brandNavy">{stats.activeJobs}</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-yellow-50 flex items-center justify-center">
              <Zap className="h-7 w-7 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-brandGrid p-8 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-textMuted mb-2">Completed</p>
              <p className="text-3xl font-bold text-brandNavy">{stats.completedJobs}</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircle className="h-7 w-7 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-brandGrid p-8 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-textMuted mb-2">Total Earnings</p>
              <p className="text-3xl font-bold text-brandNavy">${stats.totalEarnings.toFixed(2)}</p>
            </div>
            <div className="h-14 w-14 rounded-xl bg-purple-50 flex items-center justify-center">
              <DollarSign className="h-7 w-7 text-purple-600" />
            </div>
          </div>
        </div>
      </section>

      {/* Profile Stats */}
      <section aria-label="Profile stats" className="mt-10 bg-gradient-to-r from-brandBlue to-brandAccent rounded-xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold mb-6">Your Profile Stats</h3>
            <div className="flex gap-10">
              <div>
                <p className="text-blue-100 text-sm mb-2">Rating</p>
                <div className="flex items-center gap-2">
                  <Star className="h-6 w-6 fill-yellow-300 text-yellow-300" />
                  <p className="text-2xl font-bold">{Number(profile.rating ?? 0).toFixed(2)}</p>
                </div>
              </div>
              <div>
                <p className="text-blue-100 text-sm mb-2">Success Rate</p>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-6 w-6" />
                  <p className="text-2xl font-bold">{Number(profile.success_rate ?? 0).toFixed(0)}%</p>
                </div>
              </div>
              <div>
                <p className="text-blue-100 text-sm mb-2">Completed</p>
                <div className="flex items-center gap-2">
                  <Award className="h-6 w-6" />
                  <p className="text-2xl font-bold">{profile.completed_assignments || 0}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section aria-label="Quick actions" className="mt-10">
        <h2 className="text-lg font-semibold text-brandNavy mb-5">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Link
            href="/dashboard/browse"
            className="group bg-gradient-to-br from-brandBlue to-brandAccent text-white rounded-xl p-6 hover:shadow-lg transition-all"
          >
            <div className="h-12 w-12 bg-white/20 rounded-lg flex items-center justify-center mb-3">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-lg">Browse Jobs</h3>
            <p className="text-sm text-blue-100 mt-1">Find new opportunities</p>
          </Link>

          <Link
            href="/dashboard/active"
            className="group bg-white border-2 border-brandGrid rounded-xl p-6 hover:border-brandBlue hover:shadow-md transition-all"
          >
            <div className="h-12 w-12 bg-brandIce rounded-lg flex items-center justify-center mb-3">
              <Zap className="h-6 w-6 text-brandBlue" />
            </div>
            <h3 className="font-bold text-lg text-brandNavy">Active Jobs</h3>
            <p className="text-sm text-textBody mt-1">Manage current work</p>
          </Link>

          <Link
            href="/dashboard/earnings"
            className="group bg-white border-2 border-brandGrid rounded-xl p-6 hover:border-brandBlue hover:shadow-md transition-all"
          >
            <div className="h-12 w-12 bg-brandIce rounded-lg flex items-center justify-center mb-3">
              <DollarSign className="h-6 w-6 text-brandBlue" />
            </div>
            <h3 className="font-bold text-lg text-brandNavy">Earnings</h3>
            <p className="text-sm text-textBody mt-1">View your income</p>
          </Link>
        </div>
      </section>

      {/* Recent Opportunities */}
      <section aria-label="New opportunities" className="mt-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-brandNavy">New Opportunities</h2>
            <p className="mt-1 text-sm text-textMuted">Recent assignments you can bid on</p>
          </div>
          {recentOpportunities.length > 0 && (
            <Link href="/dashboard/browse" className="text-brandBlue hover:text-brandAccent font-medium text-sm flex items-center gap-1">
              Browse All
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>

        {recentOpportunities.length === 0 ? (
          <div className="bg-white rounded-xl border border-brandGrid p-12 text-center">
            <div className="h-20 w-20 bg-brandIce rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="h-10 w-10 text-brandBlue" />
            </div>
            <h3 className="text-xl font-bold text-brandNavy mb-2">No new opportunities</h3>
            <p className="text-textBody mb-6">Check back soon for new assignments</p>
            <Link
              href="/dashboard/browse"
              className="inline-flex items-center gap-2 bg-brandBlue text-white px-6 py-3 rounded-lg font-medium hover:bg-brandAccent transition-colors"
            >
              <Search className="h-5 w-5" />
              Browse Jobs
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {recentOpportunities.map((assignment) => (
              <div key={assignment.id} className="bg-white rounded-xl border border-brandGrid p-7 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-brandNavy mb-3">{assignment.title}</h3>
                    <p className="text-textBody line-clamp-2 mb-5">{assignment.description}</p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span className="flex items-center gap-1.5">
                        <span className="font-medium text-textDark">Subject:</span>
                        <span className="text-textBody">{assignment.subject}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="font-medium text-textDark">Level:</span>
                        <span className="text-textBody capitalize">{assignment.academic_level.replace('_', ' ')}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="font-medium text-textDark">Deadline:</span>
                        <span className="text-textBody">{new Date(assignment.deadline).toLocaleDateString()}</span>
                      </span>
                      {assignment.budget_max && (
                        <span className="flex items-center gap-1.5">
                          <span className="font-medium text-textDark">Budget:</span>
                          <span className="text-brandBlue font-bold">${assignment.budget_min} - ${assignment.budget_max}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/browse/${assignment.id}`}
                    className="ml-6 bg-brandBlue text-white px-6 py-3 rounded-lg font-medium hover:bg-brandAccent transition-colors"
                  >
                    View & Bid
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
