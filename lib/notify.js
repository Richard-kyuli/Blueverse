/**
 * Server-side notification helper
 *
 * `lib/notifications.js` talks to the `notifications` table through the browser
 * Supabase client. API routes have no browser session, so they need to write
 * notifications with an explicit (service-role) client instead.
 *
 * Notifications are best-effort: the workflow status change is already
 * committed by the time these run, so a failed insert is logged and swallowed
 * rather than surfaced as a failed request.
 */

/**
 * Insert a notification row for a user.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client - Server-side client
 * @param {Object} payload
 * @param {string} payload.userId - UUID of the user to notify
 * @param {string} payload.type - One of NOTIFICATION_TYPES in lib/notifications.js
 * @param {string} payload.title - Short notification title
 * @param {string} payload.message - Notification body
 * @param {string} [payload.link] - In-app path to open when clicked
 * @returns {Promise<{ success: boolean, error?: Object }>}
 */
export async function sendNotification(client, { userId, type, title, message, link = null }) {
  if (!userId) {
    return { success: false, error: new Error('userId is required') };
  }

  try {
    const { error } = await client.from('notifications').insert({
      user_id: userId,
      type,
      title,
      message,
      link,
      is_read: false,
    });

    if (error) {
      console.error('Failed to create notification:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error creating notification:', error);
    return { success: false, error };
  }
}
