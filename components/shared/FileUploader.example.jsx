/**
 * FileUploader Component - Usage Examples
 * 
 * This file demonstrates how to use the FileUploader component in different scenarios
 */

'use client';

import { useState } from 'react';
import FileUploader from './FileUploader';

// Example 1: Basic Usage with Default Settings
export function BasicFileUploader() {
  const [files, setFiles] = useState([]);

  const handleFilesSelected = (selectedFiles) => {
    console.log('Files selected:', selectedFiles);
    setFiles(selectedFiles);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Basic File Upload</h2>
      <FileUploader onFilesSelected={handleFilesSelected} />
      
      {files.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-gray-600">
            {files.length} file(s) selected
          </p>
        </div>
      )}
    </div>
  );
}

// Example 2: Single File Upload
export function SingleFileUploader() {
  const [file, setFile] = useState(null);

  const handleFileSelected = (selectedFiles) => {
    setFile(selectedFiles[0] || null);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Single File Upload</h2>
      <FileUploader 
        onFilesSelected={handleFileSelected}
        multiple={false}
        maxFiles={1}
      />
      
      {file && (
        <div className="mt-4">
          <p className="text-sm text-gray-600">
            Selected: {file.name}
          </p>
        </div>
      )}
    </div>
  );
}

// Example 3: Custom File Limits
export function CustomLimitsUploader() {
  const [files, setFiles] = useState([]);

  const handleFilesSelected = (selectedFiles) => {
    setFiles(selectedFiles);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">
        Custom Limits (Max 3 files, 10MB each)
      </h2>
      <FileUploader 
        onFilesSelected={handleFilesSelected}
        maxFiles={3}
        maxFileSize={10 * 1024 * 1024} // 10MB
      />
    </div>
  );
}

// Example 4: Integration with Form Submission
export function FileUploadForm() {
  const [files, setFiles] = useState([]);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFilesSelected = (selectedFiles) => {
    setFiles(selectedFiles);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (files.length === 0) {
      alert('Please select at least one file');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('description', description);

      // Replace with your actual API endpoint
      const response = await fetch('/api/submissions/submit', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        alert('Files uploaded successfully!');
        setFiles([]);
        setDescription('');
      } else {
        alert('Upload failed. Please try again.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('An error occurred during upload.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Submission Form</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Files
          </label>
          <FileUploader onFilesSelected={handleFilesSelected} />
        </div>

        <div>
          <label 
            htmlFor="description" 
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Add any notes or comments about your submission..."
          />
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => {
              setFiles([]);
              setDescription('');
            }}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || files.length === 0}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Uploading...' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );
}

// Example 5: With Progress Tracking (for future enhancement)
export function FileUploaderWithProgress() {
  const [files, setFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});

  const handleFilesSelected = (selectedFiles) => {
    setFiles(selectedFiles);
    // Initialize progress for each file
    const initialProgress = {};
    selectedFiles.forEach(file => {
      initialProgress[file.name] = 0;
    });
    setUploadProgress(initialProgress);
  };

  const simulateUpload = async () => {
    for (const file of files) {
      // Simulate upload progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: progress
        }));
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Upload with Progress</h2>
      <FileUploader onFilesSelected={handleFilesSelected} />
      
      {files.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="text-lg font-medium">Upload Progress</h3>
          {files.map(file => (
            <div key={file.name} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{file.name}</span>
                <span>{uploadProgress[file.name] || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress[file.name] || 0}%` }}
                />
              </div>
            </div>
          ))}
          
          <button
            onClick={simulateUpload}
            className="mt-4 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Start Upload
          </button>
        </div>
      )}
    </div>
  );
}

// Export all examples
export default {
  BasicFileUploader,
  SingleFileUploader,
  CustomLimitsUploader,
  FileUploadForm,
  FileUploaderWithProgress,
};
