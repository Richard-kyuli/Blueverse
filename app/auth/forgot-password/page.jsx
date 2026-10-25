'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;

      setEmailSent(true);
      toast.success('Password reset email sent! Check your inbox.');
    } catch (error) {
      console.error('Error sending reset email:', error);
      toast.error(error.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-brandIce flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brandBlue text-xl font-extrabold text-white">
                B
              </span>
              <span className="text-xl font-bold text-brandBlue">BlueVerse</span>
            </Link>
          </div>

          {/* Success State */}
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-brandNavy mb-2">Check Your Email</h1>
            <p className="text-textBody mb-6">
              We've sent password reset instructions to <strong>{email}</strong>
            </p>
            <p className="text-sm text-textMuted mb-6">
              Didn't receive the email? Check your spam folder or try again.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setEmailSent(false)}
                className="w-full bg-brandBlue text-white py-3 rounded-lg font-medium hover:bg-brandAccent transition-colors"
              >
                Try Another Email
              </button>
              <Link
                href="/auth/signin"
                className="block w-full text-center text-brandBlue hover:text-brandAccent font-medium py-2"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brandIce flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brandBlue text-xl font-extrabold text-white">
              B
            </span>
            <span className="text-xl font-bold text-brandBlue">BlueVerse</span>
          </Link>
          <h1 className="mt-6 text-3xl font-bold text-brandNavy">Forgot Password?</h1>
          <p className="mt-2 text-textBody">
            No worries, we'll send you reset instructions
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-textDark mb-1">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-textMuted" />
              </div>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2 border border-brandGrid rounded-md focus:ring-2 focus:ring-brandBlue focus:border-transparent"
                placeholder="john@example.com"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brandBlue text-white py-3 rounded-md font-semibold hover:bg-brandAccent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Reset Password'}
          </button>
        </form>

        {/* Back to Sign In */}
        <Link
          href="/auth/signin"
          className="mt-6 flex items-center justify-center gap-2 text-textBody hover:text-brandBlue transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
