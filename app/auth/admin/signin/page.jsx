'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  ADMIN_HOME_PATH,
  ADMIN_SIGNUP_PATH,
  evaluateAdminAccess,
  validateAdminCredentials,
} from '@/lib/adminProvisioning';

/**
 * Administrator sign in.
 *
 * This is a normal Supabase password sign in, with one addition: the account's
 * role is read back before the session is allowed to stand. A student or writer
 * who lands here is signed out again rather than dropped into a console their
 * API calls would reject anyway.
 *
 * The real authorisation is server-side: /api/admin/* re-checks the role with
 * the service role on every request. This page is the door, not the lock.
 */
export default function AdminSignInPage() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user, isAdmin, loading, signIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && isAdmin) {
      router.replace(ADMIN_HOME_PATH);
    }
  }, [loading, user, isAdmin, router]);

  const handleChange = (event) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const credentials = validateAdminCredentials(formData);
    if (!credentials.ok) {
      setError(credentials.error);
      return;
    }

    setSubmitting(true);
    const result = await signIn(credentials.payload);

    if (!result.success) {
      setSubmitting(false);
      setError('Those credentials were not accepted.');
      return;
    }

    // Read the profile here rather than waiting on AuthContext: its refresh
    // happens in the background, and this page must not admit anyone on a
    // promise that has not resolved yet.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_type, is_active')
      .eq('id', result.user.id)
      .maybeSingle();

    const access = profileError
      ? { ok: false, error: 'Could not verify your administrator access. Try again.' }
      : evaluateAdminAccess(profile);

    if (!access.ok) {
      // A console door must not leave a stranger holding a session.
      await supabase.auth.signOut();
      setSubmitting(false);
      setError(access.error);
      return;
    }

    toast.success('Administrator access confirmed');
    router.replace(ADMIN_HOME_PATH);
  };

  return (
    <div className="min-h-screen bg-brandIce flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-lg">
        <div className="bg-brandNavy px-8 py-7 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-brandBlue">
            <ShieldCheck className="h-6 w-6 text-white" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-white">Administrator Access</h1>
          <p className="mt-1 text-sm text-brandIce/80">BlueVerse moderation console</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-textDark">
                Administrator Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={formData.email}
                onChange={handleChange}
                disabled={submitting}
                className="w-full rounded-md border border-brandGrid px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-brandBlue disabled:opacity-60"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-textDark">
                  Password
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-brandBlue hover:text-brandAccent"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={formData.password}
                onChange={handleChange}
                disabled={submitting}
                className="w-full rounded-md border border-brandGrid px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-brandBlue disabled:opacity-60"
                placeholder="••••••••"
              />
            </div>

            {error ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-brandNavy py-3 font-semibold text-white transition-colors hover:bg-brandBlue disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Verifying access...' : 'Sign In to Console'}
            </button>
          </form>

          <div className="mt-6 space-y-2 border-t border-brandGrid pt-5 text-center text-sm">
            <p className="text-textMuted">
              Need to provision the first administrator?{' '}
              <Link href={ADMIN_SIGNUP_PATH} className="font-medium text-brandBlue hover:text-brandAccent">
                Administrator sign up
              </Link>
            </p>
            <Link
              href="/auth/signin"
              className="inline-flex items-center gap-1 text-textBody hover:text-brandBlue"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Student or writer sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
