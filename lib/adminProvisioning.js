/**
 * Rules for the administrator entry points (/auth/admin/signin and
 * /auth/admin/signup) and the provisioning route that backs them.
 *
 * Pure functions only: no Supabase, no fetch, no window. The route handler and
 * the pages all delegate here so the client and the server cannot drift.
 */

export const ADMIN_SIGNIN_PATH = '/auth/admin/signin';
export const ADMIN_SIGNUP_PATH = '/auth/admin/signup';
export const ADMIN_HOME_PATH = '/dashboard';
export const ADMIN_ROLE = 'admin';

/** Self-registration roles. 'admin' is deliberately absent. */
export const SELF_SERVICE_ROLES = ['student', 'writer'];

export const MIN_ADMIN_PASSWORD_LENGTH = 10;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normaliseEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(normaliseEmail(value));
}

/**
 * Best-effort constant-time comparison of the bootstrap code.
 *
 * The length check returns early, which does leak the code's length. That is
 * unavoidable without hashing both sides, and knowing the length is far
 * cheaper than knowing the code. Everything else is compared with a single
 * accumulating XOR so a wrong character early on costs the same as a wrong
 * character at the end.
 */
export function codesMatch(provided, expected) {
  if (typeof expected !== 'string' || expected.length === 0) return false;
  if (typeof provided !== 'string') return false;

  const candidate = provided.trim();
  if (candidate.length !== expected.length) return false;

  let mismatch = 0;
  for (let index = 0; index < candidate.length; index += 1) {
    mismatch |= candidate.charCodeAt(index) ^ expected.charCodeAt(index);
  }

  return mismatch === 0;
}

/**
 * Decide whether a signed-in account may use the admin console.
 *
 * `is_active === false` is the only suspended state; NULL columns from accounts
 * created before the moderation migration are treated as active, which matches
 * how /api/admin/users filters.
 */
export function evaluateAdminAccess(profile) {
  if (!profile || !profile.user_type) {
    return { ok: false, error: 'No profile record was found for this account.' };
  }

  if (profile.user_type !== ADMIN_ROLE) {
    return { ok: false, error: 'This account does not have administrator access.' };
  }

  if (profile.is_active === false) {
    return { ok: false, error: 'This administrator account has been suspended.' };
  }

  return { ok: true };
}

/** Credentials check for the console sign-in form. */
export function validateAdminCredentials({ email, password } = {}) {
  const address = normaliseEmail(email);

  if (!address) return { ok: false, error: 'Enter your email address.' };
  if (!isValidEmail(address)) return { ok: false, error: 'Enter a valid email address.' };
  if (typeof password !== 'string' || password.length === 0) {
    return { ok: false, error: 'Enter your password.' };
  }

  return { ok: true, payload: { email: address, password } };
}

/**
 * Validate a provisioning request.
 *
 * The bootstrap code is checked before the field rules: an unauthenticated
 * caller should not learn the form's validation behaviour, and a correct code is
 * still required for every other error message to be reachable.
 */
export function validateAdminSignup({
  fullName,
  email,
  password,
  confirmPassword,
  code,
  expectedCode,
} = {}) {
  if (typeof expectedCode !== 'string' || expectedCode.length === 0) {
    return {
      ok: false,
      status: 503,
      error: 'Administrator sign-up is not configured on this deployment.',
    };
  }

  if (!codesMatch(code, expectedCode)) {
    return { ok: false, status: 401, error: 'That administrator code is not valid.' };
  }

  const name = typeof fullName === 'string' ? fullName.trim() : '';
  if (name.length < 2) {
    return { ok: false, status: 400, error: 'Enter the administrator’s full name.' };
  }

  const address = normaliseEmail(email);
  if (!isValidEmail(address)) {
    return { ok: false, status: 400, error: 'Enter a valid email address.' };
  }

  if (typeof password !== 'string' || password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      status: 400,
      error: `Use a password of at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`,
    };
  }

  if (password !== confirmPassword) {
    return { ok: false, status: 400, error: 'The two passwords do not match.' };
  }

  return { ok: true, payload: { fullName: name, email: address, password } };
}

/**
 * Field rules for an account a signed-in administrator is adding.
 *
 * There is no bootstrap code here on purpose: the caller's own admin session is
 * the credential, and authenticateAdmin has already checked it. The field rules
 * stay identical to validateAdminSignup; a weak password is no better because
 * the account was created from the console rather than the public form.
 *
 * The password confirmation is deliberately absent. Only the form has a second
 * field, and only the form can compare it; the route is sent one password.
 * Re-checking a field the route never receives is how a pair that matched was
 * reported as "the two passwords do not match".
 */
export function validateAdminAccountFields({ fullName, email, password } = {}) {
  const name = typeof fullName === 'string' ? fullName.trim() : '';
  if (name.length < 2) {
    return { ok: false, error: 'Enter the administrator’s full name.' };
  }

  const address = normaliseEmail(email);
  if (!isValidEmail(address)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }

  if (typeof password !== 'string' || password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Use a password of at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`,
    };
  }

  return { ok: true, payload: { fullName: name, email: address, password } };
}

/**
 * Form-level rule: the account fields plus the confirmation the person typed.
 *
 * Kept separate from validateAdminAccountFields so the dialog can catch a typo
 * in a masked field without the route being asked to compare a value it is
 * never sent. A failed comparison never reaches the API.
 */
export function validateNewAdminAccount({ fullName, email, password, confirmPassword } = {}) {
  const fields = validateAdminAccountFields({ fullName, email, password });
  if (!fields.ok) return fields;

  if (password !== confirmPassword) {
    return { ok: false, error: 'The two passwords do not match.' };
  }

  return fields;
}

/**
 * Whether an existing account may be promoted to administrator.
 *
 * A suspended account is refused rather than quietly reactivated: suspension is
 * a decision somebody made, and reversing it silently while handing out full
 * platform access would hide that decision instead of asking about it.
 */
export function canPromoteToAdmin(profile, { actorId } = {}) {
  if (!profile) return { ok: false, reason: 'User not found' };

  if (profile.user_type === ADMIN_ROLE) {
    return { ok: false, reason: 'That account is already an administrator' };
  }

  if (profile.is_active === false) {
    return {
      ok: false,
      reason: 'Reactivate that account before granting administrator access',
    };
  }

  // Only reachable if the caller is looking at their own row, which the role
  // check above normally short-circuits first.
  if (actorId && actorId === profile.id) {
    return { ok: false, reason: 'You are already an administrator' };
  }

  return { ok: true, reason: '' };
}

/**
 * The profiles row for a newly minted administrator.
 *
 * Shared by the console route and the bootstrap route so "what an admin profile
 * looks like" has one definition: active, verified, and verified now, because
 * nobody else can vouch for an account that an administrator just created.
 */
export function buildAdminProfileRow({ userId, email, fullName, now = new Date() }) {
  const stamp = now.toISOString();

  return {
    id: userId,
    email,
    full_name: fullName,
    user_type: ADMIN_ROLE,
    is_active: true,
    is_verified: true,
    verified_at: stamp,
    updated_at: stamp,
  };
}

/** The same row using only the columns every schema version has (42703 retry). */
export function buildMinimalAdminProfileRow({ userId, email, fullName }) {
  return {
    id: userId,
    email,
    full_name: fullName,
    user_type: ADMIN_ROLE,
  };
}

/** Column values written when an existing account is promoted. */
export function buildAdminPromotion(now = new Date()) {
  const stamp = now.toISOString();

  return {
    user_type: ADMIN_ROLE,
    is_active: true,
    is_verified: true,
    verified_at: stamp,
    updated_at: stamp,
  };
}
