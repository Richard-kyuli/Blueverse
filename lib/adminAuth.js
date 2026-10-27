import { getSupabaseAdmin } from './supabaseAdmin';

/**
 * Verify that an API request comes from a signed-in administrator.
 *
 * The admin routes read across every user's rows, which no RLS policy allows, so
 * they use the service-role client and therefore must prove identity themselves.
 * This is the single place that decision is made: every /api/admin handler calls
 * it first and returns its error verbatim when `ok` is false.
 *
 * @param {Request} request incoming route handler request
 * @returns {Promise<{ok: true, supabase: object, profile: object}
 *   | {ok: false, status: number, error: string, details?: string}>}
 */
export async function authenticateAdmin(request) {
  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    return { ok: false, status: 500, error: error.message };
  }

  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Missing authorization token' };
  }

  const accessToken = header.slice(7).trim();
  if (!accessToken) {
    return { ok: false, status: 401, error: 'Missing authorization token' };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  if (authError || !authData?.user) {
    return { ok: false, status: 401, error: 'Invalid or expired session. Please sign in again.' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false,
      status: 500,
      error: 'Could not verify your account',
      details: profileError.message,
    };
  }

  if (!profile) {
    return { ok: false, status: 403, error: 'No profile found for this account' };
  }

  if (profile.user_type !== 'admin') {
    return { ok: false, status: 403, error: 'Administrator access required' };
  }

  // A suspended admin keeps their role but loses access until reactivated.
  if (profile.is_active === false) {
    return { ok: false, status: 403, error: 'This account is suspended' };
  }

  return { ok: true, supabase, profile };
}

/** Standard JSON body for a failed authentication result. */
export function authFailure(auth) {
  return { success: false, error: auth.error, ...(auth.details ? { details: auth.details } : {}) };
}
