import { describe, it, expect } from 'vitest';
import {
  ADMIN_SIGNIN_PATH,
  ADMIN_SIGNUP_PATH,
  MIN_ADMIN_PASSWORD_LENGTH,
  SELF_SERVICE_ROLES,
  buildAdminProfileRow,
  buildAdminPromotion,
  buildMinimalAdminProfileRow,
  canPromoteToAdmin,
  codesMatch,
  evaluateAdminAccess,
  isValidEmail,
  normaliseEmail,
  validateAdminAccountFields,
  validateAdminCredentials,
  validateAdminSignup,
  validateNewAdminAccount,
} from './adminProvisioning';

const VALID = {
  fullName: 'Richard Kyuli',
  email: 'Richard@Example.com',
  password: 'correct horse battery',
  confirmPassword: 'correct horse battery',
  code: 'bootstrap-code',
  expectedCode: 'bootstrap-code',
};

describe('adminProvisioning constants', () => {
  it('keeps admin out of the self-service roles', () => {
    expect(SELF_SERVICE_ROLES).toEqual(['student', 'writer']);
    expect(SELF_SERVICE_ROLES).not.toContain('admin');
  });

  it('points at the admin auth routes', () => {
    expect(ADMIN_SIGNIN_PATH).toBe('/auth/admin/signin');
    expect(ADMIN_SIGNUP_PATH).toBe('/auth/admin/signup');
  });
});

describe('normaliseEmail / isValidEmail', () => {
  it('trims and lowercases', () => {
    expect(normaliseEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });

  it('returns an empty string for non-strings', () => {
    expect(normaliseEmail(null)).toBe('');
    expect(normaliseEmail(undefined)).toBe('');
    expect(normaliseEmail(42)).toBe('');
  });

  it('accepts a normal address and rejects malformed ones', () => {
    expect(isValidEmail('richardkca84@gmail.com')).toBe(true);
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('nope')).toBe(false);
    expect(isValidEmail('no@domain')).toBe(false);
    expect(isValidEmail('spaces in@mail.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('codesMatch', () => {
  it('accepts an exact match', () => {
    expect(codesMatch('abc123', 'abc123')).toBe(true);
  });

  it('ignores surrounding whitespace on the candidate', () => {
    expect(codesMatch('  abc123  ', 'abc123')).toBe(true);
  });

  it('rejects a different code of the same length', () => {
    expect(codesMatch('abc124', 'abc123')).toBe(false);
  });

  it('rejects a shorter or longer candidate', () => {
    expect(codesMatch('abc12', 'abc123')).toBe(false);
    expect(codesMatch('abc1234', 'abc123')).toBe(false);
  });

  it('refuses to match when the deployment has no code configured', () => {
    expect(codesMatch('abc123', undefined)).toBe(false);
    expect(codesMatch('abc123', '')).toBe(false);
    expect(codesMatch('', '')).toBe(false);
  });

  it('refuses a non-string candidate', () => {
    expect(codesMatch(undefined, 'abc123')).toBe(false);
    expect(codesMatch(null, 'abc123')).toBe(false);
  });
});

describe('evaluateAdminAccess', () => {
  it('rejects a missing profile', () => {
    const result = evaluateAdminAccess(null);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no profile record/i);
  });

  it('rejects a profile without a user_type', () => {
    expect(evaluateAdminAccess({ id: 'u1' }).ok).toBe(false);
  });

  it('rejects students and writers', () => {
    expect(evaluateAdminAccess({ user_type: 'student' }).error).toMatch(/administrator access/i);
    expect(evaluateAdminAccess({ user_type: 'writer' }).error).toMatch(/administrator access/i);
  });

  it('accepts an active administrator', () => {
    expect(evaluateAdminAccess({ user_type: 'admin', is_active: true })).toEqual({ ok: true });
  });

  it('treats a NULL is_active as active', () => {
    expect(evaluateAdminAccess({ user_type: 'admin', is_active: null })).toEqual({ ok: true });
    expect(evaluateAdminAccess({ user_type: 'admin' })).toEqual({ ok: true });
  });

  it('rejects a suspended administrator', () => {
    const result = evaluateAdminAccess({ user_type: 'admin', is_active: false });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/suspended/i);
  });

  it('does not reveal suspension to non-admins', () => {
    const result = evaluateAdminAccess({ user_type: 'student', is_active: false });
    expect(result.error).toMatch(/administrator access/i);
  });
});

describe('validateAdminCredentials', () => {
  it('requires an email', () => {
    expect(validateAdminCredentials({ password: 'x' }).error).toMatch(/email address/i);
  });

  it('requires a valid email shape', () => {
    expect(validateAdminCredentials({ email: 'nope', password: 'x' }).error).toMatch(/valid email/i);
  });

  it('requires a password', () => {
    expect(validateAdminCredentials({ email: 'a@b.co' }).error).toMatch(/password/i);
    expect(validateAdminCredentials({ email: 'a@b.co', password: '' }).error).toMatch(/password/i);
  });

  it('normalises the email it returns', () => {
    const result = validateAdminCredentials({ email: ' Richard@Example.COM ', password: 'secret' });
    expect(result.ok).toBe(true);
    expect(result.payload).toEqual({ email: 'richard@example.com', password: 'secret' });
  });

  it('tolerates a missing argument', () => {
    expect(validateAdminCredentials().ok).toBe(false);
  });
});

describe('validateAdminSignup', () => {
  it('fails closed when the deployment has no bootstrap code', () => {
    const result = validateAdminSignup({ ...VALID, expectedCode: undefined });
    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(result.error).toMatch(/not configured/i);
  });

  it('fails closed when the bootstrap code is an empty string', () => {
    expect(validateAdminSignup({ ...VALID, expectedCode: '' }).status).toBe(503);
  });

  it('rejects a wrong code with 401 before validating the fields', () => {
    const result = validateAdminSignup({ ...VALID, code: 'wrong-code', fullName: '' });
    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(result.error).toMatch(/code is not valid/i);
  });

  it('rejects a missing code', () => {
    expect(validateAdminSignup({ ...VALID, code: undefined }).status).toBe(401);
  });

  it('requires a real name', () => {
    expect(validateAdminSignup({ ...VALID, fullName: ' ' }).error).toMatch(/full name/i);
    expect(validateAdminSignup({ ...VALID, fullName: 'A' }).error).toMatch(/full name/i);
  });

  it('requires a valid email', () => {
    expect(validateAdminSignup({ ...VALID, email: 'richard' }).error).toMatch(/valid email/i);
  });

  it('requires the minimum password length', () => {
    const short = 'a'.repeat(MIN_ADMIN_PASSWORD_LENGTH - 1);
    const result = validateAdminSignup({ ...VALID, password: short, confirmPassword: short });
    expect(result.error).toMatch(new RegExp(`${MIN_ADMIN_PASSWORD_LENGTH} characters`));
  });

  it('requires the confirmation to match', () => {
    const result = validateAdminSignup({ ...VALID, confirmPassword: 'something else' });
    expect(result.error).toMatch(/do not match/i);
  });

  it('returns trimmed name, lowercased email and the password', () => {
    const result = validateAdminSignup({ ...VALID, fullName: '  Richard Kyuli  ' });
    expect(result.ok).toBe(true);
    expect(result.payload).toEqual({
      fullName: 'Richard Kyuli',
      email: 'richard@example.com',
      password: VALID.password,
    });
  });

  it('accepts a code typed with stray whitespace', () => {
    expect(validateAdminSignup({ ...VALID, code: ' bootstrap-code ' }).ok).toBe(true);
  });

  it('never returns the bootstrap code back to the caller', () => {
    const result = validateAdminSignup(VALID);
    expect(JSON.stringify(result)).not.toContain(VALID.expectedCode);
  });
});

describe('validateNewAdminAccount', () => {
  const ACCOUNT = {
    fullName: 'Grace Hopper',
    email: 'Grace.Hopper@Example.com',
    password: VALID.password,
    confirmPassword: VALID.password,
  };

  it('requires a real name', () => {
    expect(validateNewAdminAccount({ ...ACCOUNT, fullName: ' ' }).error).toMatch(/full name/i);
    expect(validateNewAdminAccount({ ...ACCOUNT, fullName: 'A' }).error).toMatch(/full name/i);
    expect(validateNewAdminAccount({ ...ACCOUNT, fullName: undefined }).error).toMatch(/full name/i);
  });

  it('requires a valid email', () => {
    expect(validateNewAdminAccount({ ...ACCOUNT, email: 'nope' }).error).toMatch(/valid email/i);
    expect(validateNewAdminAccount({ ...ACCOUNT, email: '' }).error).toMatch(/valid email/i);
  });

  it('enforces the same minimum password length as the public form', () => {
    const short = 'a'.repeat(MIN_ADMIN_PASSWORD_LENGTH - 1);
    const result = validateNewAdminAccount({ ...ACCOUNT, password: short, confirmPassword: short });
    expect(result.error).toMatch(new RegExp(`${MIN_ADMIN_PASSWORD_LENGTH} characters`));
    expect(validateNewAdminAccount({ ...ACCOUNT, password: undefined }).error).toMatch(
      /at least/i
    );
  });

  it('requires the confirmation to match', () => {
    expect(validateNewAdminAccount({ ...ACCOUNT, confirmPassword: 'something else' }).error).toMatch(
      /do not match/i
    );
  });

  it('does not accept a bootstrap code in place of a password', () => {
    expect(validateNewAdminAccount({ ...ACCOUNT, code: VALID.code }).ok).toBe(true);
    expect(
      validateNewAdminAccount({ fullName: ACCOUNT.fullName, email: ACCOUNT.email, code: VALID.code })
        .ok
    ).toBe(false);
  });

  it('returns trimmed name, lowercased email and the password', () => {
    const result = validateNewAdminAccount({ ...ACCOUNT, fullName: '  Grace Hopper  ' });
    expect(result.ok).toBe(true);
    expect(result.payload).toEqual({
      fullName: 'Grace Hopper',
      email: 'grace.hopper@example.com',
      password: ACCOUNT.password,
    });
    expect(result.payload).not.toHaveProperty('confirmPassword');
  });

  it('tolerates a missing argument', () => {
    expect(validateNewAdminAccount().ok).toBe(false);
  });
});

describe('validateAdminAccountFields', () => {
  const FIELDS = {
    fullName: 'Grace Hopper',
    email: 'Grace.Hopper@Example.com',
    password: VALID.password,
  };

  it('accepts a body that carries no confirmation at all', () => {
    // The route receives one password; the dialog compared the pair.
    const result = validateAdminAccountFields(FIELDS);
    expect(result.ok).toBe(true);
    expect(result.payload).toEqual({
      fullName: 'Grace Hopper',
      email: 'grace.hopper@example.com',
      password: VALID.password,
    });
  });

  it('does not compare a confirmation it was not asked to check', () => {
    expect(validateAdminAccountFields({ ...FIELDS, confirmPassword: 'something-else' }).ok).toBe(
      true
    );
  });

  it('still enforces every field rule', () => {
    expect(validateAdminAccountFields({ ...FIELDS, fullName: ' ' }).error).toMatch(/full name/i);
    expect(validateAdminAccountFields({ ...FIELDS, email: 'nope' }).error).toMatch(
      /valid email/i
    );
    expect(validateAdminAccountFields({ ...FIELDS, password: 'short' }).error).toMatch(
      /at least/i
    );
  });

  it('tolerates a missing argument', () => {
    expect(validateAdminAccountFields().ok).toBe(false);
  });
});

describe('canPromoteToAdmin', () => {
  const WRITER = { id: 'w1', user_type: 'writer', is_active: true };

  it('accepts an active student or writer', () => {
    expect(canPromoteToAdmin(WRITER).ok).toBe(true);
    expect(canPromoteToAdmin({ id: 's1', user_type: 'student' }).ok).toBe(true);
  });

  it('rejects a missing profile', () => {
    expect(canPromoteToAdmin(null).reason).toMatch(/not found/i);
  });

  it('rejects an account that is already an administrator', () => {
    const result = canPromoteToAdmin({ id: 'a2', user_type: 'admin', is_active: true });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/already an administrator/i);
  });

  it('rejects a suspended account instead of reactivating it', () => {
    const result = canPromoteToAdmin({ ...WRITER, is_active: false });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/reactivate that account/i);
  });

  it('treats a NULL is_active as active', () => {
    expect(canPromoteToAdmin({ ...WRITER, is_active: null }).ok).toBe(true);
  });

  it('refuses to promote the caller themselves', () => {
    const result = canPromoteToAdmin(WRITER, { actorId: 'w1' });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/already an administrator/i);
  });

  it('accepts when the caller is somebody else', () => {
    expect(canPromoteToAdmin(WRITER, { actorId: 'admin-1' }).ok).toBe(true);
  });
});

describe('buildAdminProfileRow', () => {
  const NOW = new Date('2026-10-27T09:15:00.000Z');

  it('marks the account active, verified and verified now', () => {
    const row = buildAdminProfileRow({
      userId: 'admin-2',
      email: 'grace@example.com',
      fullName: 'Grace Hopper',
      now: NOW,
    });

    expect(row).toEqual({
      id: 'admin-2',
      email: 'grace@example.com',
      full_name: 'Grace Hopper',
      user_type: 'admin',
      is_active: true,
      is_verified: true,
      verified_at: '2026-10-27T09:15:00.000Z',
      updated_at: '2026-10-27T09:15:00.000Z',
    });
  });

  it('stamps the current time by default', () => {
    const row = buildAdminProfileRow({ userId: 'a', email: 'a@b.co', fullName: 'A B' });
    expect(Number.isNaN(Date.parse(row.updated_at))).toBe(false);
    expect(row.verified_at).toBe(row.updated_at);
  });
});

describe('buildMinimalAdminProfileRow', () => {
  it('uses only the columns every schema version has', () => {
    expect(
      buildMinimalAdminProfileRow({ userId: 'admin-2', email: 'grace@example.com', fullName: 'G H' })
    ).toEqual({
      id: 'admin-2',
      email: 'grace@example.com',
      full_name: 'G H',
      user_type: 'admin',
    });
  });
});

describe('buildAdminPromotion', () => {
  const NOW = new Date('2026-10-27T09:15:00.000Z');

  it('grants the role and the verification that comes with it', () => {
    expect(buildAdminPromotion(NOW)).toEqual({
      user_type: 'admin',
      is_active: true,
      is_verified: true,
      verified_at: '2026-10-27T09:15:00.000Z',
      updated_at: '2026-10-27T09:15:00.000Z',
    });
  });

  it('never carries the previous role forward', () => {
    expect(buildAdminPromotion(NOW)).not.toHaveProperty('previous_role');
  });
});
