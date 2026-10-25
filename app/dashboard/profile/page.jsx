'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { User, Mail, Phone, MapPin, Briefcase, Save, Lock, Eye, EyeOff, Award, DollarSign } from 'lucide-react';

export default function ProfilePage() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    phone: '',
    location: '',
    bio: '',
    expertise: '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (profile) {
      setProfileData({
        full_name: profile.full_name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        location: profile.location || '',
        bio: profile.bio || '',
        expertise: profile.expertise || '',
      });
    }
  }, [profile]);

  const handleProfileChange = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone,
          location: profileData.location,
          bio: profileData.bio,
          expertise: profileData.expertise,
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast.success('Profile updated successfully!');
      
      // Refresh the page to update the profile data
      window.location.reload();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setPasswordLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      toast.success('Password updated successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error(error.message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="text-center py-12">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brandBlue border-r-transparent" />
        <p className="mt-4 text-textBody">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-3xl md:text-4xl font-bold text-brandNavy mb-2">Profile Settings</h1>
        <p className="text-base md:text-lg text-textBody">Manage your account information and preferences</p>
      </header>

      {/* Profile Stats (for writers) */}
      {profile.user_type === 'writer' && (
        <section className="bg-gradient-to-r from-brandBlue to-brandAccent rounded-xl p-6 text-white">
          <h2 className="text-xl font-bold mb-4">Your Stats</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Award className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-blue-100">Completed Jobs</p>
                <p className="text-2xl font-bold">{profile.completed_assignments || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Award className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-blue-100">Rating</p>
                <p className="text-2xl font-bold">{profile.rating || '0.00'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-white/20 rounded-lg flex items-center justify-center">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-blue-100">Success Rate</p>
                <p className="text-2xl font-bold">{profile.success_rate || 0}%</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Profile Information Form */}
      <section className="bg-white rounded-xl border border-brandGrid p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-full bg-brandBlue/10 flex items-center justify-center">
            <User className="h-6 w-6 text-brandBlue" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-brandNavy">Personal Information</h2>
            <p className="text-sm text-textMuted">Update your personal details</p>
          </div>
        </div>

        <form onSubmit={handleProfileSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Full Name */}
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-textDark mb-1">
                Full Name *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-textMuted" />
                </div>
                <input
                  type="text"
                  id="full_name"
                  name="full_name"
                  value={profileData.full_name}
                  onChange={handleProfileChange}
                  required
                  className="w-full pl-10 pr-4 py-2 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent"
                />
              </div>
            </div>

            {/* Email (Read-only) */}
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
                  value={profileData.email}
                  disabled
                  className="w-full pl-10 pr-4 py-2 border border-brandGrid rounded-lg bg-gray-50 text-textMuted cursor-not-allowed"
                />
              </div>
              <p className="mt-1 text-xs text-textMuted">Email cannot be changed</p>
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-textDark mb-1">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-textMuted" />
                </div>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={profileData.phone}
                  onChange={handleProfileChange}
                  className="w-full pl-10 pr-4 py-2 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-textDark mb-1">
                Location
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="h-5 w-5 text-textMuted" />
                </div>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={profileData.location}
                  onChange={handleProfileChange}
                  className="w-full pl-10 pr-4 py-2 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent"
                  placeholder="City, Country"
                />
              </div>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-textDark mb-1">
              Bio
            </label>
            <textarea
              id="bio"
              name="bio"
              value={profileData.bio}
              onChange={handleProfileChange}
              rows={4}
              className="w-full px-4 py-2 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent resize-none"
              placeholder="Tell us about yourself..."
            />
          </div>

          {/* Expertise (Writers only) */}
          {profile.user_type === 'writer' && (
            <div>
              <label htmlFor="expertise" className="block text-sm font-medium text-textDark mb-1">
                Areas of Expertise
              </label>
              <div className="relative">
                <div className="absolute top-3 left-0 pl-3 flex items-start pointer-events-none">
                  <Briefcase className="h-5 w-5 text-textMuted" />
                </div>
                <textarea
                  id="expertise"
                  name="expertise"
                  value={profileData.expertise}
                  onChange={handleProfileChange}
                  rows={3}
                  className="w-full pl-10 pr-4 py-2 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent resize-none"
                  placeholder="e.g., Computer Science, Mathematics, English Literature..."
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-brandBlue text-white px-6 py-3 rounded-lg font-medium hover:bg-brandAccent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-5 w-5" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </section>

      {/* Change Password Section */}
      <section className="bg-white rounded-xl border border-brandGrid p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-full bg-purple-50 flex items-center justify-center">
            <Lock className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-brandNavy">Change Password</h2>
            <p className="text-sm text-textMuted">Update your password to keep your account secure</p>
          </div>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-5 max-w-md">
          {/* New Password */}
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-textDark mb-1">
              New Password *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-textMuted" />
              </div>
              <input
                type={showNewPassword ? 'text' : 'password'}
                id="newPassword"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                required
                minLength={6}
                className="w-full pl-10 pr-10 py-2 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-textMuted hover:text-textDark"
              >
                {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-textMuted">Must be at least 6 characters</p>
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-textDark mb-1">
              Confirm New Password *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-textMuted" />
              </div>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                required
                className="w-full pl-10 pr-4 py-2 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Password Match Indicator */}
          {passwordData.newPassword && passwordData.confirmPassword && (
            <div className={`text-sm ${passwordData.newPassword === passwordData.confirmPassword ? 'text-green-600' : 'text-red-600'}`}>
              {passwordData.newPassword === passwordData.confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={passwordLoading || passwordData.newPassword !== passwordData.confirmPassword}
              className="flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Lock className="h-5 w-5" />
              {passwordLoading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </section>

      {/* Account Type Badge */}
      <section className="bg-brandIce border border-brandGrid rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-textMuted">Account Type</p>
            <p className="text-lg font-bold text-brandNavy capitalize">{profile.user_type}</p>
          </div>
          <div className={`px-4 py-2 rounded-lg font-medium ${
            profile.user_type === 'writer' 
              ? 'bg-purple-100 text-purple-800' 
              : 'bg-blue-100 text-blue-800'
          }`}>
            {profile.user_type === 'writer' ? 'Writer Account' : 'Student Account'}
          </div>
        </div>
      </section>
    </div>
  );
}
