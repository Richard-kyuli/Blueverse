'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function SignUpPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    userType: 'student',
  });
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  // The landing page sends writers here with ?role=writer, so start on the
  // choice they clicked instead of making them correct a Student default.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const requested = new URLSearchParams(window.location.search).get('role');
    if (requested === 'writer' || requested === 'student') {
      setFormData((current) => ({ ...current, userType: requested }));
    }
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const result = await signUp({
      email: formData.email,
      password: formData.password,
      fullName: formData.fullName,
      userType: formData.userType,
    });

    setLoading(false);

    if (result.success) {
      toast.success('Account created successfully! Please check your email to verify.');
      router.push('/auth/signin');
    } else {
      toast.error(result.error || 'Failed to create account');
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
          <h1 className="mt-6 text-3xl font-bold text-brandNavy">Create Account</h1>
          <p className="mt-2 text-textBody">Join our academic marketplace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name */}
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-textDark mb-1">
              Full Name
            </label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-brandGrid rounded-md focus:ring-2 focus:ring-brandBlue focus:border-transparent"
              placeholder="John Doe"
            />
          </div>

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

          {/* User Type */}
          <div>
            <label className="block text-sm font-medium text-textDark mb-2">
              I am a...
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, userType: 'student' })}
                className={`px-4 py-3 border-2 rounded-md font-medium transition-all ${
                  formData.userType === 'student'
                    ? 'border-brandBlue bg-brandBlue/10 text-brandBlue'
                    : 'border-brandGrid text-textBody hover:border-brandBlue/50'
                }`}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, userType: 'writer' })}
                className={`px-4 py-3 border-2 rounded-md font-medium transition-all ${
                  formData.userType === 'writer'
                    ? 'border-brandBlue bg-brandBlue/10 text-brandBlue'
                    : 'border-brandGrid text-textBody hover:border-brandBlue/50'
                }`}
              >
                Writer
              </button>
            </div>
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

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-textDark mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-brandGrid rounded-md focus:ring-2 focus:ring-brandBlue focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brandBlue text-white py-3 rounded-md font-semibold hover:bg-brandAccent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        {/* Sign In Link */}
        <p className="mt-6 text-center text-textBody">
          Already have an account?{' '}
          <Link href="/auth/signin" className="text-brandBlue font-medium hover:text-brandAccent">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
