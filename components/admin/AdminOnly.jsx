'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Renders its children only for an administrator.
 *
 * The API routes check the role again on every request, so this is a usability
 * guard rather than the security boundary: it stops a student or writer from
 * seeing an empty console full of failed requests.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children admin-only content
 */
export default function AdminOnly({ children }) {
  const { profile, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <p className="py-12 text-center text-textBody" role="status">
        Checking your access...
      </p>
    );
  }

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-brandGrid bg-white p-10 text-center" role="alert">
        <div
          className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-brandIce"
          aria-hidden="true"
        >
          <ShieldAlert className="h-10 w-10 text-brandBlue" />
        </div>
        <h1 className="mb-2 text-xl font-bold text-brandNavy">Administrators only</h1>
        <p className="mx-auto mb-6 max-w-md text-textBody">
          This console is limited to BlueVerse staff. If you need access, ask an existing
          administrator to promote your account.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg bg-brandBlue px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brandAccent"
        >
          Back to dashboard
        </Link>
        {profile?.user_type ? (
          <p className="mt-4 text-xs text-textMuted">
            You are signed in as {profile.user_type}.
          </p>
        ) : null}
      </div>
    );
  }

  return children;
}
