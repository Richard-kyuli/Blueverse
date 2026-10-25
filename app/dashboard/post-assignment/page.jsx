'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/dashboard/DashboardLayout';

export default function PostAssignmentPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject: '',
    academic_level: 'undergraduate',
    pages: '',
    words: '',
    deadline: '',
    budget_min: '',
    budget_max: '',
  });

  const subjects = [
    'English & Literature',
    'Mathematics',
    'Science',
    'History',
    'Business',
    'Computer Science',
    'Psychology',
    'Nursing',
    'Law',
    'Engineering',
    'Economics',
    'Philosophy',
    'Sociology',
    'Other',
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title || !formData.description || !formData.subject) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (new Date(formData.deadline) < new Date()) {
      toast.error('Deadline must be in the future');
      return;
    }

    if (parseFloat(formData.budget_min) > parseFloat(formData.budget_max)) {
      toast.error('Minimum budget cannot be greater than maximum budget');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('assignments')
        .insert([
          {
            student_id: profile.id,
            title: formData.title,
            description: formData.description,
            subject: formData.subject,
            academic_level: formData.academic_level,
            pages: formData.pages ? parseInt(formData.pages) : null,
            words: formData.words ? parseInt(formData.words) : null,
            deadline: formData.deadline,
            budget_min: formData.budget_min ? parseFloat(formData.budget_min) : null,
            budget_max: formData.budget_max ? parseFloat(formData.budget_max) : null,
            status: 'open',
          },
        ])
        .select()
        .single();

      if (error) throw error;

      toast.success('Assignment posted successfully!');
      router.push(`/dashboard/assignments/${data.id}`);
    } catch (error) {
      console.error('Error posting assignment:', error);
      toast.error('Failed to post assignment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-brandNavy mb-4">Post New Assignment</h1>
          <p className="text-lg text-textBody">
            Fill in the details below and get competitive bids from qualified writers
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-brandGrid p-10 space-y-7">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-brandNavy mb-2">
              Assignment Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent"
              placeholder="e.g., Research Paper on Climate Change"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-brandNavy mb-2">
              Description & Requirements *
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={6}
              className="w-full px-4 py-3 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent"
              placeholder="Describe your assignment in detail. Include any specific requirements, formatting guidelines, or resources to use..."
            />
          </div>

          {/* Subject & Academic Level */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-brandNavy mb-2">
                Subject *
              </label>
              <select
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent"
              >
                <option value="">Select subject</option>
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="academic_level" className="block text-sm font-medium text-brandNavy mb-2">
                Academic Level *
              </label>
              <select
                id="academic_level"
                name="academic_level"
                value={formData.academic_level}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent"
              >
                <option value="high_school">High School</option>
                <option value="undergraduate">Undergraduate</option>
                <option value="masters">Master's</option>
                <option value="phd">PhD</option>
              </select>
            </div>
          </div>

          {/* Pages & Words */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="pages" className="block text-sm font-medium text-brandNavy mb-2">
                Number of Pages
              </label>
              <input
                type="number"
                id="pages"
                name="pages"
                value={formData.pages}
                onChange={handleChange}
                min="1"
                className="w-full px-4 py-3 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent"
                placeholder="e.g., 5"
              />
            </div>

            <div>
              <label htmlFor="words" className="block text-sm font-medium text-brandNavy mb-2">
                Number of Words
              </label>
              <input
                type="number"
                id="words"
                name="words"
                value={formData.words}
                onChange={handleChange}
                min="1"
                className="w-full px-4 py-3 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent"
                placeholder="e.g., 1500"
              />
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label htmlFor="deadline" className="block text-sm font-medium text-brandNavy mb-2">
              Deadline *
            </label>
            <input
              type="datetime-local"
              id="deadline"
              name="deadline"
              value={formData.deadline}
              onChange={handleChange}
              required
              min={new Date().toISOString().slice(0, 16)}
              className="w-full px-4 py-3 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent"
            />
          </div>

          {/* Budget Range */}
          <div>
            <label className="block text-sm font-medium text-brandNavy mb-2">Budget Range (USD)</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="budget_min" className="block text-xs text-textMuted mb-1">
                  Minimum
                </label>
                <input
                  type="number"
                  id="budget_min"
                  name="budget_min"
                  value={formData.budget_min}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent"
                  placeholder="e.g., 50"
                />
              </div>

              <div>
                <label htmlFor="budget_max" className="block text-xs text-textMuted mb-1">
                  Maximum
                </label>
                <input
                  type="number"
                  id="budget_max"
                  name="budget_max"
                  value={formData.budget_max}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 border border-brandGrid rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent"
                  placeholder="e.g., 100"
                />
              </div>
            </div>
            <p className="mt-2 text-sm text-textMuted">
              Setting a budget range helps writers understand your expectations
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4 pt-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 border-2 border-brandGrid rounded-lg font-medium text-textDark hover:border-brandNavy transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-brandBlue text-white py-3 rounded-lg font-semibold hover:bg-brandAccent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Posting...' : 'Post Assignment'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
