'use client';

import { supabase } from './supabase';

/**
 * Fetch wrapper for the admin API routes.
 *
 * Admin data cannot be read with the browser client because the tables have no
 * admin RLS policies, so every call goes through /api/admin/* with the caller's
 * access token. Errors are thrown with the server's message so pages can show it
 * directly instead of a generic failure.
 *
 * @param {string} path route under /api/admin
 * @param {{method?: string, body?: object}} options
 * @returns {Promise<object>} parsed JSON payload
 */
export async function adminFetch(path, { method = 'GET', body } = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const response = await fetch(path, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch {
    // A proxy or 500 may return HTML; fall through to the status-based message
  }

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  return payload;
}
