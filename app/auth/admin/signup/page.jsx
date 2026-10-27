'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { ArrowLeft, KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  ADMIN_HOME_PATH,
  ADMIN_SIGNIN_PATH,
  MIN_ADMIN_PASSWORD_LENGTH,
  isValidEmail,
  normaliseEmail,
} from '@/lib/adminProvisioning';

const EMPTY_FORM = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  code: '',
};

/**
 * Administrator sign up.
 *
 * The form never writes the role itself: it posts to /api/admin/signup, which
 * requires the deployment's ADMIN_SIGNUP_CODE and creates the profile with the
 * service role. The profiles guard trigger rejects any browser-side attempt to
 * write user_type = 'admin', so an open door here cannot mint privileges.
 */
export default function AdminSignUpPage() {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleChange = (event) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const validateLocally = () => {
    if (formData.fullName.trim().length < 2) return 'Enter the administrator’s full name.';
    if (!isValidEmail(formData.email)) return 'Enter a valid email address.';
    if (formData.password.length < MIN_ADMIN_PASSWORD_LENGTH) {
      return `Use a password of at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`;
    }
    if (formData.password !== formData.confirmPassword) return 'The two passwords do not match.';
    if (!formData.code.trim()) return 'Enter the deployment’s administrator code.';
    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const localError = validateLocally();
    if (localError) {
      setError(localError);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/admin/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          code: formData.code,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload.success === false) {
        setSubmitting(false);
        setError(payload.error || 'Could not create the administrator account.');
        return;
      }

      // Email is already confirmed server-side, so this normally succeeds.
      const signInResult = await signIn({
        email: normaliseEmail(formData.email),
        password: formData.password,
      });

      setSubmitting(false);

      if (!signInResult.success) {
        toast.success('Administrator account created. Please sign in.');
        router.replace(ADMIN_SIGNIN_PATH);
        return;
      }

      setFormData(EMPTY_FORM);
      toast.success('Administrator account created');
      router.replace(ADMIN_HOME_PATH);
    } catch (requestError) {
      console.error('Administrator sign up failed:', requestError);
      setSubmitting(false);
      setError('Could not reach the server. Check your connection and try again.');
    }
  };

  return (
    <div className="min-h-screen bg-brandIce flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-lg">
        <div className="bg-brandNavy px-8 py-7 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-brandBlue">
            <ShieldCheck className="h-6 w-6 text-white" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-2xl font-bold text-white">Create Administrator</h1>
          <p className="mt-1 text-sm text-brandIce/80">
            Requires this deployment&apos;s administrator code
          </p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-textDark">
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                value={formData.fullName}
                onChange={handleChange}
                disabled={submitting}
                className="w-full rounded-md border border-brandGrid px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-brandBlue disabled:opacity-60"
                placeholder="Jane Doe"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-textDark">
                Email Address
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
                placeholder="jane@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-textDark">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={formData.password}
                onChange={handleChange}
                disabled={submitting}
                className="w-full rounded-md border border-brandGrid px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-brandBlue disabled:opacity-60"
                placeholder={`At least ${MIN_ADMIN_PASSWORD_LENGTH} characters`}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-textDark">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={submitting}
                className="w-full rounded-md border border-brandGrid px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-brandBlue disabled:opacity-60"
                placeholder="Repeat the password"
              />
            </div>

            <div>
              <label htmlFor="code" className="mb-1 block text-sm font-medium text-textDark">
                Administrator Code
              </label>
              <input
                id="code"
                name="code"
                type="password"
                autoComplete="off"
                required
                value={formData.code}
                onChange={handleChange}
                disabled={submitting}
                className="w-full rounded-md border border-brandGrid px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-brandBlue disabled:opacity-60"
                placeholder="Deployment administrator code"
              />
              <p className="mt-1 flex items-center gap-1 text-xs text-textMuted">
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                Set as ADMIN_SIGNUP_CODE in the deployment environment.
              </p>
            </div>

            {error ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-brandNavy py-3 font-semibold text-white transition-colors hover:bg-brandBlue disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Creating account...' : 'Create Administrator'}
            </button>
          </form>

          <div className="mt-6 border-t border-brandGrid pt-5 text-center text-sm">
            <Link
              href={ADMIN_SIGNIN_PATH}
              className="inline-flex items-center gap-1 text-textBody hover:text-brandBlue"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to administrator sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
