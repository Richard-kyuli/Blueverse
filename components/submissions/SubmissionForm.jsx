'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { AlertCircle, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import FileUploader from '@/components/shared/FileUploader';

/**
 * SubmissionForm Component
 * 
 * Enables writers to submit completed work with files and notes
 * 
 * Requirements: US-W1, UI-1, NFR-3
 * 
 * @param {Object} props
 * @param {Object} props.assignment - The assignment object with details
 * @param {string} props.writerId - The ID of the writer submitting
 * @param {Function} props.onSuccess - Callback when submission succeeds
 * @param {Function} props.onCancel - Callback when user cancels
 */
export default function SubmissionForm({ assignment, writerId, onSuccess, onCancel }) {
  const router = useRouter();
  const [files, setFiles] = useState([]);
  const [submissionText, setSubmissionText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Track unsaved changes for confirmation dialog
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges && !uploading) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, uploading]);

  /**
   * Handle file selection from FileUploader
   */
  const handleFilesSelected = (selectedFiles) => {
    setFiles(selectedFiles);
    setHasUnsavedChanges(true);
  };

  /**
   * Handle submission notes change
   */
  const handleNotesChange = (e) => {
    setSubmissionText(e.target.value);
    setHasUnsavedChanges(true);
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate at least one file is selected
    if (files.length === 0) {
      toast.error('Please select at least one file to submit');
      return;
    }

    // Confirm submission
    if (!confirm('Are you sure you want to submit this work? The student will be notified.')) {
      return;
    }

    setUploading(true);
    
    // Initialize progress for each file
    const initialProgress = {};
    files.forEach((file) => {
      initialProgress[file.name] = 0;
    });
    setUploadProgress(initialProgress);

    // Simulate progress updates for user feedback
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        const updated = { ...prev };
        let allComplete = true;
        
        Object.keys(updated).forEach((fileName) => {
          if (updated[fileName] < 90) {
            // Increment progress but keep under 90% until actual upload completes
            updated[fileName] = Math.min(90, updated[fileName] + Math.random() * 15);
            allComplete = false;
          }
        });
        
        return updated;
      });
    }, 500);

    try {
      // Prepare FormData for API endpoint
      const formData = new FormData();
      formData.append('assignmentId', assignment.id);
      formData.append('writerId', writerId);
      formData.append('submissionText', submissionText.trim());

      // Add files to FormData with file_N naming convention
      files.forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });

      // Call the submission API endpoint
      const response = await fetch('/api/submissions/submit', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to submit work');
      }

      // Set all progress to 100%
      clearInterval(progressInterval);
      const completeProgress = {};
      files.forEach((file) => {
        completeProgress[file.name] = 100;
      });
      setUploadProgress(completeProgress);

      // Success!
      setHasUnsavedChanges(false);
      toast.success(result.message || 'Work submitted successfully! The student will review your submission.');
      
      // Small delay to show 100% progress
      setTimeout(() => {
        // Call onSuccess callback or redirect
        if (onSuccess) {
          onSuccess(result.submissionId);
        } else {
          // Redirect to assignment detail page
          router.push(`/dashboard/assignments/${assignment.id}`);
        }
      }, 800);
    } catch (error) {
      clearInterval(progressInterval);
      console.error('Submission error:', error);
      toast.error(error.message || 'Failed to submit work. Please try again.');
      setUploading(false);
      setUploadProgress({});
    }
  };

  /**
   * Handle cancel with unsaved changes confirmation
   */
  const handleCancel = () => {
    if (hasUnsavedChanges && !uploading) {
      if (!confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        return;
      }
    }

    if (onCancel) {
      onCancel();
    } else {
      router.push(`/dashboard/assignments/${assignment.id}`);
    }
  };

  /**
   * Get status badge styling
   */
  const getStatusBadge = (status) => {
    const badges = {
      assigned: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-purple-100 text-purple-800',
    };
    return badges[status] || badges.assigned;
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      {/* Assignment Details Header (Read-only) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {assignment.title}
            </h2>
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(
                assignment.status
              )}`}
            >
              {assignment.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Subject</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">{assignment.subject}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Deadline</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {new Date(assignment.deadline).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Payment</p>
            <p className="font-medium text-blue-600 dark:text-blue-400">
              ${assignment.final_price || assignment.budget_max}
            </p>
          </div>
        </div>
      </div>

      {/* Submission Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* File Upload Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="text-blue-600 dark:text-blue-400" size={24} />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Upload Your Completed Work
            </h3>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Upload your completed assignment files. You can select multiple files (up to 10 files, 50MB each).
          </p>

          <FileUploader
            onFilesSelected={handleFilesSelected}
            multiple={true}
          />

          {/* Upload Progress Bars */}
          {uploading && Object.keys(uploadProgress).length > 0 && (
            <div className="mt-6 space-y-3">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Uploading files...
              </h4>
              {Object.entries(uploadProgress).map(([fileName, progress]) => (
                <div key={fileName} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400 truncate max-w-xs">
                      {fileName}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400 font-medium">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submission Notes Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
            Submission Notes (Optional)
          </h3>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Add any notes, comments, or instructions for the student about your submission.
          </p>

          <textarea
            value={submissionText}
            onChange={handleNotesChange}
            disabled={uploading}
            placeholder="Example: I've completed the essay according to your requirements. The main document is in PDF format, and I've included my research sources in a separate ZIP file."
            rows={6}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                     placeholder:text-gray-400 dark:placeholder:text-gray-500
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     disabled:opacity-50 disabled:cursor-not-allowed
                     resize-none"
          />
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex gap-3">
          <AlertCircle className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium mb-1">Important:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-400">
              <li>Once submitted, you cannot edit this submission until the student reviews it</li>
              <li>The student will be notified immediately of your submission</li>
              <li>Make sure all files are correct before submitting</li>
            </ul>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            type="submit"
            disabled={files.length === 0 || uploading}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 
                     bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {uploading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={20} />
                <span>Submit Work</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={uploading}
            className="sm:flex-initial px-6 py-3 border-2 border-gray-300 dark:border-gray-600 
                     text-gray-700 dark:text-gray-300 font-medium rounded-lg
                     hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
