'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function SignInPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await signIn(formData);

    setLoading(false);

    if (result.success) {
      toast.success('Welcome back!');
      router.push('/dashboard');
    } else {
      toast.error(result.error || 'Failed to sign in');
    }
  };

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
          <h1 className="mt-6 text-3xl font-bold text-brandNavy">Welcome Back</h1>
          <p className="mt-2 text-textBody">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-textDark mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-brandGrid rounded-md focus:ring-2 focus:ring-brandBlue focus:border-transparent"
              placeholder="john@example.com"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-textDark mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-brandGrid rounded-md focus:ring-2 focus:ring-brandBlue focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {/* Forgot Password */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                className="h-4 w-4 rounded border-brandGrid text-brandBlue focus:ring-brandBlue"
              />
              <label htmlFor="remember" className="ml-2 text-sm text-textBody">
                Remember me
              </label>
            </div>
            <Link href="/auth/forgot-password" className="text-sm text-brandBlue hover:text-brandAccent">
              Forgot password?
            </Link>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brandBlue text-white py-3 rounded-md font-semibold hover:bg-brandAccent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {/* Sign Up Link */}
        <p className="mt-6 text-center text-textBody">
          Don't have an account?{' '}
          <Link href="/auth/signup" className="text-brandBlue font-medium hover:text-brandAccent">
            Create Account
          </Link>
        </p>
      </div>
    </div>
  );
}
