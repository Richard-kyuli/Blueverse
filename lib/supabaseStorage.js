import { supabase } from './supabase';

/**
 * Upload a single file to Supabase Storage
 * @param {File} file - The file to upload
 * @param {string} assignmentId - The assignment ID
 * @param {string} submissionId - The submission ID
 * @param {Object} client - Supabase client to use (defaults to the browser client)
 * @returns {Promise<{success: boolean, url?: string, path?: string, error?: string}>}
 */
export async function uploadFile(file, assignmentId, submissionId, client = supabase) {
  try {
    // Validate file
    if (!file) {
      return { success: false, error: 'No file provided' };
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/zip',
      'application/x-zip-compressed'
    ];

    if (!allowedTypes.includes(file.type)) {
      return { 
        success: false, 
        error: `Invalid file type: ${file.type}. Only PDF, DOC, DOCX, TXT, and ZIP files are allowed.` 
      };
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > maxSize) {
      return { 
        success: false, 
        error: `File size exceeds 50MB limit. File size: ${(file.size / (1024 * 1024)).toFixed(2)}MB` 
      };
    }

    // Generate unique filename with timestamp to prevent collisions
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${assignmentId}/${submissionId}/${timestamp}-${sanitizedFileName}`;

    // Upload to Supabase Storage
    const { data, error } = await client.storage
      .from('submissions')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Upload error:', error);
      return { success: false, error: error.message };
    }

    // Public URL is only resolvable when the bucket is public. The submissions
    // bucket is private, so callers should persist `path` and sign it on read
    // with getFileUrl().
    const { data: urlData } = client.storage
      .from('submissions')
      .getPublicUrl(filePath);

    return { 
      success: true, 
      url: urlData.publicUrl,
      path: filePath
    };

  } catch (error) {
    console.error('Unexpected upload error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to upload file' 
    };
  }
}

/**
 * Upload multiple files in parallel with progress tracking
 * @param {File[]} files - Array of files to upload
 * @param {string} assignmentId - The assignment ID
 * @param {string} submissionId - The submission ID
 * @param {Function} onProgress - Callback function to track progress (optional)
 * @param {Object} client - Supabase client to use (defaults to the browser client)
 * @returns {Promise<{success: boolean, results: Array, uploadedUrls?: string[], uploadedPaths?: string[], error?: string}>}
 */
export async function uploadMultipleFiles(files, assignmentId, submissionId, onProgress = null, client = supabase) {
  try {
    // Validate inputs
    if (!files || files.length === 0) {
      return { success: false, error: 'No files provided', results: [] };
    }

    if (files.length > 10) {
      return { 
        success: false, 
        error: 'Maximum 10 files allowed per submission', 
        results: [] 
      };
    }

    // Track progress
    let completed = 0;
    const total = files.length;
    const results = [];
    const uploadedUrls = [];
    const uploadedPaths = [];

    // Upload all files in parallel using Promise.allSettled
    const uploadPromises = files.map(async (file, index) => {
      try {
        const result = await uploadFile(file, assignmentId, submissionId, client);
        
        // Update progress
        completed++;
        if (onProgress) {
          onProgress({
            fileName: file.name,
            index,
            completed,
            total,
            progress: Math.round((completed / total) * 100)
          });
        }

        return { ...result, fileName: file.name, index };
      } catch (error) {
        completed++;
        if (onProgress) {
          onProgress({
            fileName: file.name,
            index,
            completed,
            total,
            progress: Math.round((completed / total) * 100)
          });
        }
        return { 
          success: false, 
          error: error.message, 
          fileName: file.name, 
          index 
        };
      }
    });

    // Wait for all uploads to complete
    const uploadResults = await Promise.allSettled(uploadPromises);

    // Process results
    uploadResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
        if (result.value.success) {
          uploadedUrls.push(result.value.url);
          uploadedPaths.push(result.value.path);
        }
      } else {
        results.push({
          success: false,
          error: result.reason?.message || 'Upload failed',
          fileName: files[index]?.name,
          index
        });
      }
    });

    // Check if any uploads failed
    const failedUploads = results.filter(r => !r.success);
    
    if (failedUploads.length > 0) {
      // Rollback: delete successfully uploaded files
      console.warn(`${failedUploads.length} file(s) failed to upload. Rolling back...`);
      
      if (uploadedPaths.length > 0) {
        await rollbackUploads(uploadedPaths, client);
      }

      return {
        success: false,
        error: `Failed to upload ${failedUploads.length} file(s). All uploads have been rolled back.`,
        results,
        failedFiles: failedUploads.map(f => f.fileName)
      };
    }

    return {
      success: true,
      results,
      uploadedUrls,
      uploadedPaths
    };

  } catch (error) {
    console.error('Unexpected error during multiple uploads:', error);
    return {
      success: false,
      error: error.message || 'Failed to upload files',
      results: []
    };
  }
}

/**
 * Rollback uploads by deleting files from storage
 * @param {string[]} filePaths - Array of file paths to delete
 * @param {Object} client - Supabase client to use (defaults to the browser client)
 * @returns {Promise<void>}
 */
async function rollbackUploads(filePaths, client = supabase) {
  try {
    if (!filePaths || filePaths.length === 0) {
      return;
    }

    const { error } = await client.storage
      .from('submissions')
      .remove(filePaths);

    if (error) {
      console.error('Rollback error:', error);
    } else {
      console.log(`Successfully rolled back ${filePaths.length} file(s)`);
    }
  } catch (error) {
    console.error('Unexpected rollback error:', error);
  }
}

/**
 * Delete a file from Supabase Storage using its URL
 * @param {string} fileUrl - The full URL of the file to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteFile(fileUrl) {
  try {
    if (!fileUrl) {
      return { success: false, error: 'No file URL provided' };
    }

    // Extract file path from URL
    // URL format: https://{project}.supabase.co/storage/v1/object/public/submissions/{path}
    const urlParts = fileUrl.split('/submissions/');
    if (urlParts.length < 2) {
      return { success: false, error: 'Invalid file URL format' };
    }

    const filePath = urlParts[1];

    // Delete from storage
    const { error } = await supabase.storage
      .from('submissions')
      .remove([filePath]);

    if (error) {
      console.error('Delete error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };

  } catch (error) {
    console.error('Unexpected delete error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to delete file' 
    };
  }
}

/**
 * Generate a signed URL for file download (valid for 1 hour)
 * @param {string} path - The file path in storage (e.g., "assignmentId/submissionId/filename.pdf")
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function getFileUrl(path) {
  try {
    if (!path) {
      return { success: false, error: 'No file path provided' };
    }

    // For public buckets, we can use getPublicUrl
    // For private buckets, use createSignedUrl
    const { data, error } = await supabase.storage
      .from('submissions')
      .createSignedUrl(path, 3600); // 1 hour expiry

    if (error) {
      console.error('Get URL error:', error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      url: data.signedUrl 
    };

  } catch (error) {
    console.error('Unexpected error getting file URL:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to get file URL' 
    };
  }
}

/**
 * Get the public URL for a file (for public buckets)
 * @param {string} path - The file path in storage
 * @returns {string} - The public URL
 */
export function getPublicFileUrl(path) {
  const { data } = supabase.storage
    .from('submissions')
    .getPublicUrl(path);

  return data.publicUrl;
}

/**
 * Validate file before upload
 * @param {File} file - The file to validate
 * @returns {{valid: boolean, error?: string}}
 */
export function validateFile(file) {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check file type
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed'
  ];

  if (!allowedTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: `Invalid file type: ${file.type}. Only PDF, DOC, DOCX, TXT, and ZIP files are allowed.` 
    };
  }

  // Check file size (50MB limit)
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: `File size exceeds 50MB limit. File size: ${(file.size / (1024 * 1024)).toFixed(2)}MB` 
    };
  }

  return { valid: true };
}

/**
 * Extract file extension from filename
 * @param {string} filename - The filename
 * @returns {string} - The file extension (e.g., "pdf")
 */
export function getFileExtension(filename) {
  return filename.split('.').pop().toLowerCase();
}

/**
 * Get file icon based on file extension
 * @param {string} filename - The filename
 * @returns {string} - Icon name for Lucide React icons
 */
export function getFileIcon(filename) {
  const ext = getFileExtension(filename);
  
  const iconMap = {
    'pdf': 'FileText',
    'doc': 'FileText',
    'docx': 'FileText',
    'txt': 'FileText',
    'zip': 'Archive'
  };

  return iconMap[ext] || 'File';
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size (e.g., "1.5 MB")
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
