import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client using the service role key.
 *
 * This client bypasses Row Level Security, so callers MUST verify the end user's
 * identity themselves (for example by passing the user's access token to
 * `auth.getUser()`). Never import this module from client components.
 */

let adminClient = null;

/**
 * Get (and lazily create) the service-role Supabase client.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 * @throws {Error} When the required environment variables are missing
 */
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. ' +
        'Add it to .env.local (Supabase Dashboard > Settings > API > service_role key) ' +
        'and restart the dev server.'
    );
  }

  if (!adminClient) {
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return adminClient;
}
