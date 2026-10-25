'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { X, User, Mail, Phone, MapPin, Briefcase, Save, Lock, Eye, EyeOff, Award, DollarSign, Camera, Upload } from 'lucide-react';

export default function ProfileModal({ isOpen, onClose }) {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const fileInputRef = useRef(null);
  
  const [profileData, setProfileData] = useState({
    full_name: '',
    email: '',
    phone: '',
    location: '',
    bio: '',
    expertise: '',
    avatar_url: '',
  });

  const [passwordData, setPasswordData] = useState({
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
        avatar_url: profile.avatar_url || '',
      });
    }
  }, [profile]);

  const handleProfileChange = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setUploadingPhoto(true);

    try {
      // Create unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      console.log('Uploading file:', filePath);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      console.log('Upload successful:', uploadData);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      console.log('Public URL:', publicUrl);

      if (!publicUrl) {
        throw new Error('Failed to get public URL');
      }

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) {
        console.error('Database update error:', updateError);
        throw updateError;
      }

      console.log('Profile updated successfully');

      // Update local state
      setProfileData({ ...profileData, avatar_url: publicUrl });
      toast.success('Profile photo updated successfully!');
      
      // Refresh page to show new photo everywhere
      setTimeout(() => {
        console.log('Reloading page...');
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error(error.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!profileData.avatar_url) return;

    try {
      setUploadingPhoto(true);

      // Update profile to remove avatar URL
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', profile.id);

      if (error) throw error;

      setProfileData({ ...profileData, avatar_url: '' });
      toast.success('Profile photo removed');
      
      // Refresh page
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Error removing photo:', error);
      toast.error('Failed to remove photo');
    } finally {
      setUploadingPhoto(false);
    }
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
        newPassword: '',
        confirmPassword: '',
      });
      setActiveTab('profile');
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error(error.message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!isOpen || !profile) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="absolute inset-y-0 right-0 max-w-2xl w-full bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-brandNavy">Profile Settings</h2>
            <p className="text-sm text-textMuted mt-1">Manage your account information</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close profile settings"
          >
            <X className="h-6 w-6 text-textBody" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-gray-50 px-6 py-3 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-2.5 font-medium text-sm rounded-lg transition-all ${
              activeTab === 'profile'
                ? 'bg-white text-brandBlue shadow-sm border border-gray-200'
                : 'text-textMuted hover:text-textBody hover:bg-white'
            }`}
          >
            Personal Information
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`px-6 py-2.5 font-medium text-sm rounded-lg transition-all ${
              activeTab === 'password'
                ? 'bg-white text-brandBlue shadow-sm border border-gray-200'
                : 'text-textMuted hover:text-textBody hover:bg-white'
            }`}
          >
            Change Password
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {activeTab === 'profile' ? (
            <div className="space-y-6">
              {/* Profile Stats (for writers) */}
              {profile.user_type === 'writer' && (
                <div className="bg-gradient-to-r from-brandBlue to-brandAccent rounded-xl p-6 text-white">
                  <h3 className="text-lg font-bold mb-4">Your Stats</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Award className="h-5 w-5" />
                        <p className="text-2xl font-bold">{profile.completed_assignments || 0}</p>
                      </div>
                      <p className="text-xs text-blue-100">Completed Jobs</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Award className="h-5 w-5" />
                        <p className="text-2xl font-bold">{profile.rating || '0.00'}</p>
                      </div>
                      <p className="text-xs text-blue-100">Rating</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <DollarSign className="h-5 w-5" />
                        <p className="text-2xl font-bold">{profile.success_rate || 0}%</p>
                      </div>
                      <p className="text-xs text-blue-100">Success Rate</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Profile Photo Upload */}
              <div className="bg-white border border-brandGrid rounded-xl p-6">
                <h3 className="text-lg font-bold text-brandNavy mb-4">Profile Photo</h3>
                <div className="flex items-center gap-6">
                  {/* Avatar Display */}
                  <div className="relative">
                    {profileData.avatar_url ? (
                      <img
                        src={profileData.avatar_url}
                        alt="Profile"
                        className="h-24 w-24 rounded-full object-cover border-2 border-brandGrid"
                      />
                    ) : (
                      <div className="h-24 w-24 rounded-full bg-brandBlue/10 flex items-center justify-center border-2 border-brandGrid">
                        <User className="h-12 w-12 text-brandBlue" />
                      </div>
                    )}
                    {uploadingPhoto && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-white border-r-transparent" />
                      </div>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1">
                    <p className="text-sm text-textBody mb-3">
                      Upload a professional photo. JPG, PNG or GIF. Max size 5MB.
                    </p>
                    <div className="flex gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        className="flex items-center gap-2 px-4 py-2 bg-brandBlue text-white rounded-lg hover:bg-brandAccent transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        <Upload className="h-4 w-4" />
                        {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                      </button>
                      {profileData.avatar_url && (
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          disabled={uploadingPhoto}
                          className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Profile Form */}
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
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 text-sm font-medium text-textBody hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 bg-brandBlue text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brandAccent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="h-4 w-4" />
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="max-w-md">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-full bg-brandIce flex items-center justify-center">
                  <Lock className="h-6 w-6 text-brandBlue" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-brandNavy">Change Password</h3>
                  <p className="text-sm text-textMuted">Update your password to keep your account secure</p>
                </div>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-5">
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
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2.5 text-sm font-medium text-textBody hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={passwordLoading || passwordData.newPassword !== passwordData.confirmPassword}
                    className="flex items-center gap-2 bg-brandBlue text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brandAccent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Lock className="h-4 w-4" />
                    {passwordLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
