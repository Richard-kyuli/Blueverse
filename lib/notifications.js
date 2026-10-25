/**
 * Notification Utility Functions
 * 
 * Provides helper functions for creating and managing notifications for the assignment
 * submission workflow. Handles notification creation for key events like submission
 * creation, revision requests, work approval, and payment release.
 * 
 * Requirements: FR-6, US-W3.1, US-S1
 */

import { supabase } from './supabase';

/**
 * Notification types for the submission workflow
 */
export const NOTIFICATION_TYPES = {
  SUBMISSION_CREATED: 'submission_created',
  REVISION_REQUESTED: 'revision_requested',
  WORK_APPROVED: 'work_approved',
  PAYMENT_RELEASED: 'payment_released',
};

/**
 * Create a notification record in the database
 * 
 * @param {string} userId - UUID of the user to notify
 * @param {string} type - Notification type (use NOTIFICATION_TYPES constants)
 * @param {string} message - Notification message text
 * @param {object} metadata - Additional metadata (title, link, etc.)
 * @returns {Promise<{ data: object | null, error: Error | null }>}
 * 
 * @example
 * const result = await createNotification(
 *   'user-uuid',
 *   NOTIFICATION_TYPES.SUBMISSION_CREATED,
 *   'New submission received for Assignment #123',
 *   { title: 'New Submission', link: '/dashboard/assignments/123/submissions' }
 * );
 */
export async function createNotification(userId, type, message, metadata = {}) {
  try {
    // Validate required parameters
    if (!userId) {
      throw new Error('userId is required');
    }
    if (!type) {
      throw new Error('type is required');
    }
    if (!message) {
      throw new Error('message is required');
    }

    // Extract metadata fields
    const { title = 'Notification', link = null } = metadata;

    // Insert notification into database
    const { data, error } = await supabase
      .from('notifications')
      .insert([
        {
          user_id: userId,
          type,
          title,
          message,
          link,
          is_read: false,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in createNotification:', error);
    return { data: null, error };
  }
}

/**
 * Notify student when a writer submits work
 * 
 * Fetches assignment details and creates a notification for the student
 * that a new submission has been received and is ready for review.
 * 
 * @param {string} assignmentId - UUID of the assignment
 * @param {string} submissionId - UUID of the submission
 * @returns {Promise<{ success: boolean, error: Error | null }>}
 * 
 * @example
 * const result = await notifySubmissionCreated('assignment-uuid', 'submission-uuid');
 * if (!result.success) {
 *   console.error('Failed to notify student:', result.error);
 * }
 */
export async function notifySubmissionCreated(assignmentId, submissionId) {
  try {
    // Fetch assignment details to get student ID and assignment title
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('id, title, student_id')
      .eq('id', assignmentId)
      .single();

    if (assignmentError || !assignment) {
      console.error('Error fetching assignment:', assignmentError);
      return { success: false, error: assignmentError || new Error('Assignment not found') };
    }

    // Create notification for student
    const notificationResult = await createNotification(
      assignment.student_id,
      NOTIFICATION_TYPES.SUBMISSION_CREATED,
      `New submission received for "${assignment.title}". Click to review the work.`,
      {
        title: 'New Submission',
        link: `/dashboard/assignments/${assignmentId}/submissions`,
      }
    );

    if (notificationResult.error) {
      return { success: false, error: notificationResult.error };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error in notifySubmissionCreated:', error);
    return { success: false, error };
  }
}

/**
 * Notify writer when student requests revision
 * 
 * Fetches assignment and submission details and creates a notification for the writer
 * that the student has requested revisions with specific feedback.
 * 
 * @param {string} assignmentId - UUID of the assignment
 * @param {string} submissionId - UUID of the submission
 * @param {string} feedback - Student's feedback/revision notes
 * @returns {Promise<{ success: boolean, error: Error | null }>}
 * 
 * @example
 * const result = await notifyRevisionRequested(
 *   'assignment-uuid',
 *   'submission-uuid',
 *   'Please add more citations and expand the conclusion section.'
 * );
 */
export async function notifyRevisionRequested(assignmentId, submissionId, feedback) {
  try {
    // Fetch assignment details to get writer ID and assignment title
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('id, title, assigned_writer_id')
      .eq('id', assignmentId)
      .single();

    if (assignmentError || !assignment) {
      console.error('Error fetching assignment:', assignmentError);
      return { success: false, error: assignmentError || new Error('Assignment not found') };
    }

    if (!assignment.assigned_writer_id) {
      console.error('No writer assigned to assignment');
      return { success: false, error: new Error('No writer assigned') };
    }

    // Create notification for writer
    const message = feedback
      ? `Revision requested for "${assignment.title}". Feedback: ${feedback.substring(0, 100)}${feedback.length > 100 ? '...' : ''}`
      : `Revision requested for "${assignment.title}". Click to view feedback.`;

    const notificationResult = await createNotification(
      assignment.assigned_writer_id,
      NOTIFICATION_TYPES.REVISION_REQUESTED,
      message,
      {
        title: 'Revision Required',
        link: `/dashboard/assignments/${assignmentId}/submissions`,
      }
    );

    if (notificationResult.error) {
      return { success: false, error: notificationResult.error };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error in notifyRevisionRequested:', error);
    return { success: false, error };
  }
}

/**
 * Notify writer when student approves their work
 * 
 * Fetches assignment details and creates a notification for the writer
 * that their work has been approved and the assignment is complete.
 * 
 * @param {string} assignmentId - UUID of the assignment
 * @param {string} submissionId - UUID of the approved submission
 * @returns {Promise<{ success: boolean, error: Error | null }>}
 * 
 * @example
 * const result = await notifyWorkApproved('assignment-uuid', 'submission-uuid');
 */
export async function notifyWorkApproved(assignmentId, submissionId) {
  try {
    // Fetch assignment details to get writer ID and assignment title
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('id, title, assigned_writer_id, final_price')
      .eq('id', assignmentId)
      .single();

    if (assignmentError || !assignment) {
      console.error('Error fetching assignment:', assignmentError);
      return { success: false, error: assignmentError || new Error('Assignment not found') };
    }

    if (!assignment.assigned_writer_id) {
      console.error('No writer assigned to assignment');
      return { success: false, error: new Error('No writer assigned') };
    }

    // Create notification for writer
    const notificationResult = await createNotification(
      assignment.assigned_writer_id,
      NOTIFICATION_TYPES.WORK_APPROVED,
      `Your work for "${assignment.title}" has been approved! The assignment is now complete.`,
      {
        title: 'Work Approved',
        link: `/dashboard/assignments/${assignmentId}`,
      }
    );

    if (notificationResult.error) {
      return { success: false, error: notificationResult.error };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error in notifyWorkApproved:', error);
    return { success: false, error };
  }
}

/**
 * Notify both student and writer when payment is released
 * 
 * Creates notifications for both parties confirming that payment has been
 * successfully released to the writer.
 * 
 * @param {string} assignmentId - UUID of the assignment
 * @param {string} transactionId - UUID of the transaction record
 * @param {number} amount - Payment amount released (in cents or smallest currency unit)
 * @returns {Promise<{ success: boolean, studentNotified: boolean, writerNotified: boolean, error: Error | null }>}
 * 
 * @example
 * const result = await notifyPaymentReleased('assignment-uuid', 'transaction-uuid', 5000);
 * if (!result.success) {
 *   console.error('Payment notification failed:', result.error);
 * }
 */
export async function notifyPaymentReleased(assignmentId, transactionId, amount) {
  try {
    // Fetch assignment details to get both student and writer IDs
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('id, title, student_id, assigned_writer_id')
      .eq('id', assignmentId)
      .single();

    if (assignmentError || !assignment) {
      console.error('Error fetching assignment:', assignmentError);
      return { 
        success: false, 
        studentNotified: false, 
        writerNotified: false, 
        error: assignmentError || new Error('Assignment not found') 
      };
    }

    if (!assignment.assigned_writer_id) {
      console.error('No writer assigned to assignment');
      return { 
        success: false, 
        studentNotified: false, 
        writerNotified: false, 
        error: new Error('No writer assigned') 
      };
    }

    // Format amount for display (assuming cents, convert to dollars)
    const formattedAmount = (amount / 100).toFixed(2);

    // Notify writer about payment received
    const writerNotification = await createNotification(
      assignment.assigned_writer_id,
      NOTIFICATION_TYPES.PAYMENT_RELEASED,
      `Payment of $${formattedAmount} has been released for "${assignment.title}".`,
      {
        title: 'Payment Received',
        link: `/dashboard/assignments/${assignmentId}`,
      }
    );

    // Notify student about payment completion
    const studentNotification = await createNotification(
      assignment.student_id,
      NOTIFICATION_TYPES.PAYMENT_RELEASED,
      `Payment of $${formattedAmount} has been released to writer for "${assignment.title}".`,
      {
        title: 'Payment Complete',
        link: `/dashboard/assignments/${assignmentId}`,
      }
    );

    const studentNotified = !studentNotification.error;
    const writerNotified = !writerNotification.error;

    // Both notifications should succeed for full success
    const success = studentNotified && writerNotified;

    if (!success) {
      console.error('Some notifications failed:', {
        student: studentNotification.error,
        writer: writerNotification.error,
      });
    }

    return {
      success,
      studentNotified,
      writerNotified,
      error: success ? null : new Error('One or more notifications failed'),
    };
  } catch (error) {
    console.error('Error in notifyPaymentReleased:', error);
    return {
      success: false,
      studentNotified: false,
      writerNotified: false,
      error,
    };
  }
}

/**
 * Mark a notification as read
 * 
 * @param {string} notificationId - UUID of the notification
 * @returns {Promise<{ success: boolean, error: Error | null }>}
 * 
 * @example
 * const result = await markNotificationAsRead('notification-uuid');
 */
export async function markNotificationAsRead(notificationId) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notificationId)
      .select()
      .single();

    if (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error in markNotificationAsRead:', error);
    return { success: false, error };
  }
}

/**
 * Fetch unread notifications for a user
 * 
 * @param {string} userId - UUID of the user
 * @param {number} limit - Maximum number of notifications to fetch (default: 50)
 * @returns {Promise<{ data: Array | null, error: Error | null }>}
 * 
 * @example
 * const result = await getUnreadNotifications('user-uuid', 10);
 * if (result.data) {
 *   console.log(`You have ${result.data.length} unread notifications`);
 * }
 */
export async function getUnreadNotifications(userId, limit = 50) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching unread notifications:', error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in getUnreadNotifications:', error);
    return { data: null, error };
  }
}

/**
 * Get all notifications for a user (paginated)
 * 
 * @param {string} userId - UUID of the user
 * @param {object} options - Pagination options
 * @param {number} options.page - Page number (1-indexed)
 * @param {number} options.pageSize - Number of notifications per page
 * @returns {Promise<{ data: Array | null, error: Error | null, hasMore: boolean }>}
 * 
 * @example
 * const result = await getAllNotifications('user-uuid', { page: 1, pageSize: 20 });
 */
export async function getAllNotifications(userId, options = {}) {
  try {
    const { page = 1, pageSize = 20 } = options;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching notifications:', error);
      return { data: null, error, hasMore: false };
    }

    const hasMore = count > to + 1;

    return { data, error: null, hasMore };
  } catch (error) {
    console.error('Error in getAllNotifications:', error);
    return { data: null, error, hasMore: false };
  }
}
