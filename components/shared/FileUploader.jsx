'use client';

import { useState, useRef } from 'react';
import { Upload, X, File, FileText, FileType, FolderArchive } from 'lucide-react';
import {
  validateFile,
  formatFileSize,
  getFileIcon,
  getAcceptedFileExtensions,
  MAX_FILE_SIZE,
  MAX_FILE_COUNT
} from '@/lib/fileValidation';

/**
 * FileUploader Component
 * 
 * A reusable drag-and-drop file upload component with validation
 * Supports multiple files, file type filtering, and size validation
 * 
 * Requirements: US-W1.3, NFR-3, UI-1
 * 
 * @param {Object} props
 * @param {Function} props.onFilesSelected - Callback when files are selected (files: File[])
 * @param {string[]} props.acceptedTypes - Array of accepted MIME types (optional)
 * @param {number} props.maxFileSize - Maximum file size in bytes (defaults to 50MB)
 * @param {number} props.maxFiles - Maximum number of files (defaults to 10)
 * @param {boolean} props.multiple - Allow multiple file selection (defaults to true)
 */
export default function FileUploader({
  onFilesSelected,
  acceptedTypes = null,
  maxFileSize = MAX_FILE_SIZE,
  maxFiles = MAX_FILE_COUNT,
  multiple = true,
}) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState([]);
  const fileInputRef = useRef(null);

  /**
   * Get the appropriate icon component for a file
   */
  const getIconComponent = (filename) => {
    const iconName = getFileIcon(filename);
    
    switch (iconName) {
      case 'FileText':
        return FileText;
      case 'FileType':
        return FileType;
      case 'FolderArchive':
        return FolderArchive;
      default:
        return File;
    }
  };

  /**
   * Validate and add files to the selected files list
   */
  const handleFiles = (files) => {
    const fileArray = Array.from(files);
    const newErrors = [];
    const validFiles = [];

    // Check total file count
    if (selectedFiles.length + fileArray.length > maxFiles) {
      newErrors.push(`Maximum ${maxFiles} files allowed. You have ${selectedFiles.length} file(s) already selected.`);
      setErrors(newErrors);
      return;
    }

    // Validate each file
    fileArray.forEach((file) => {
      const validation = validateFile(file, maxFileSize);
      
      if (!validation.valid) {
        newErrors.push(`${file.name}: ${validation.error}`);
      } else {
        // Check for duplicate file names
        const isDuplicate = selectedFiles.some(f => f.name === file.name);
        if (isDuplicate) {
          newErrors.push(`${file.name}: File already added`);
        } else {
          validFiles.push(file);
        }
      }
    });

    // Update state with valid files
    if (validFiles.length > 0) {
      // In single file mode, replace existing files; in multiple mode, append
      const updatedFiles = multiple 
        ? [...selectedFiles, ...validFiles]
        : [validFiles[validFiles.length - 1]]; // Take only the last file in single mode
      
      setSelectedFiles(updatedFiles);
      onFilesSelected(updatedFiles);
    }

    // Set errors if any
    if (newErrors.length > 0) {
      setErrors(newErrors);
      // Clear errors after 5 seconds
      setTimeout(() => setErrors([]), 5000);
    }
  };

  /**
   * Handle drag over event
   */
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  /**
   * Handle drag leave event
   */
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  /**
   * Handle drop event
   */
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const { files } = e.dataTransfer;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  /**
   * Handle file input change
   */
  const handleFileInputChange = (e) => {
    const { files } = e.target;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    // Reset input so same file can be selected again if removed
    e.target.value = '';
  };

  /**
   * Open file browser
   */
  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * Remove a file from the selected files list
   */
  const handleRemoveFile = (index) => {
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updatedFiles);
    onFilesSelected(updatedFiles);
    setErrors([]); // Clear errors when removing files
  };

  /**
   * Handle keyboard navigation for file browsing
   */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleBrowseClick();
    }
  };

  /**
   * Handle keyboard navigation for file removal
   */
  const handleRemoveKeyDown = (e, index) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRemoveFile(index);
    }
  };

  return (
    <div className="w-full">
      {/* Drag and Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label="File upload area. Click to browse or drag and drop files"
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${isDragging 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-102' 
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
          }
        `}
      >
        <Upload 
          className={`mx-auto mb-4 transition-colors ${
            isDragging ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'
          }`}
          size={48}
          aria-hidden="true"
        />
        
        <div className="space-y-2">
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
            {isDragging ? 'Drop files here' : 'Drag and drop files here'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            or click to browse from your computer
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Accepted: PDF, DOC, DOCX, TXT, ZIP • Max {formatFileSize(maxFileSize)} per file • Up to {maxFiles} files
          </p>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={getAcceptedFileExtensions()}
          onChange={handleFileInputChange}
          className="hidden"
          aria-hidden="true"
        />
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div 
          className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          role="alert"
          aria-live="polite"
        >
          <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
            {errors.length === 1 ? 'Upload Error:' : 'Upload Errors:'}
          </p>
          <ul className="list-disc list-inside space-y-1">
            {errors.map((error, index) => (
              <li key={index} className="text-sm text-red-700 dark:text-red-400">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Selected Files ({selectedFiles.length}/{maxFiles})
          </h3>
          <ul className="space-y-2" role="list" aria-label="Selected files">
            {selectedFiles.map((file, index) => {
              const IconComponent = getIconComponent(file.name);
              
              return (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <IconComponent 
                      className="text-blue-500 dark:text-blue-400 flex-shrink-0" 
                      size={20}
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(index);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      handleRemoveKeyDown(e, index);
                    }}
                    className="ml-3 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    aria-label={`Remove ${file.name}`}
                    type="button"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
