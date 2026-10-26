'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Bug, ClipboardList, LogOut, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function DebugPage() {
  const { user, profile, loading } = useAuth();
  const [testResults, setTestResults] = useState({});

  useEffect(() => {
    runTests();
  }, [user]);

  const runTests = async () => {
    const results = {};

    // Test 1: Check session
    const { data: { session } } = await supabase.auth.getSession();
    results.session = session ? 'EXISTS' : 'NONE';
    results.userId = session?.user?.id || 'NONE';

    // Test 2: Try to fetch profile directly
    if (session?.user?.id) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      results.profileQuery = {
        success: !error,
        error: error?.message,
        data: data,
      };
    }

    // Test 3: Check all profiles (to see if RLS is working)
    const { data: allProfiles, error: allError } = await supabase
      .from('profiles')
      .select('id, email, user_type');
    
    results.allProfiles = {
      count: allProfiles?.length || 0,
      error: allError?.message,
      canRead: !allError,
    };

    setTestResults(results);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="mb-8 flex items-center gap-2 text-3xl font-bold">
          <Bug className="h-7 w-7" aria-hidden="true" />
          Debug Page
        </h1>

        {/* Auth Context */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Auth Context</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {JSON.stringify({ user: user?.id, profile, loading }, null, 2)}
          </pre>
        </div>

        {/* Test Results */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Test Results</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {JSON.stringify(testResults, null, 2)}
          </pre>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4">Actions</h2>
          <div className="space-y-2">
            <button
              onClick={runTests}
              className="mr-2 inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Rerun Tests
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="mr-2 inline-flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              Go to Dashboard
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = '/auth/signin';
              }}
              className="inline-flex items-center gap-2 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="mb-2 flex items-center gap-2 font-bold">
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            What to Check:
          </h3>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>session:</strong> Should be "EXISTS"</li>
            <li><strong>userId:</strong> Should show a UUID</li>
            <li><strong>profileQuery.success:</strong> Should be true</li>
            <li><strong>profileQuery.data:</strong> Should show your profile</li>
            <li><strong>allProfiles.canRead:</strong> Should be true</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
