'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';
import {
  MIN_ADMIN_PASSWORD_LENGTH,
  isValidEmail,
  normaliseEmail,
  validateNewAdminAccount,
} from '@/lib/adminProvisioning';

/**
 * Grant administrator access from the Users console.
 *
 * Two ways in, because both are needed and neither replaces the other:
 *
 * - Create: the person has no BlueVerse account yet, so one is minted for them.
 * - Promote: the person already signs in as a student or writer and only needs
 *   the role. Sending them through "create" would fail on the taken address.
 *
 * The client checks the same helpers the route uses, so an obvious mistake is
 * reported without a round trip; the server still decides, because a helper
 * agreeing with itself is not authorisation.
 */

const TABS = [
  { id: 'create', label: 'Create an account' },
  { id: 'promote', label: 'Promote a user' },
];

const FIELD_CLASS =
  'mt-1 w-full rounded-lg border border-brandGrid px-3 py-2 text-sm text-textDark focus:border-brandBlue focus:outline-none focus:ring-2 focus:ring-brandBlue/30';

const EMPTY_FIELDS = { fullName: '', email: '', password: '', confirmPassword: '' };

export default function AddAdminDialog({ onClose, onAdded }) {
  const [mode, setMode] = useState('create');
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [promoteEmail, setPromoteEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (key) => (event) => setFields((current) => ({ ...current, [key]: event.target.value }));

  const switchMode = (next) => {
    if (busy || next === mode) return;
    setMode(next);
    setError('');
  };

  /** Returns the request to send, or null after showing a validation message. */
  const prepareCreate = () => {
    const check = validateNewAdminAccount(fields);
    if (!check.ok) {
      setError(check.error);
      return null;
    }

    return { method: 'POST', body: check.payload };
  };

  const preparePromote = () => {
    const address = normaliseEmail(promoteEmail);
    if (!isValidEmail(address)) {
      setError('Enter a valid email address.');
      return null;
    }

    return { method: 'PATCH', body: { email: address } };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;

    setError('');
    const request = mode === 'create' ? prepareCreate() : preparePromote();
    if (!request) return;

    setBusy(true);
    try {
      const payload = await adminFetch('/api/admin/admins', request);
      toast.success(payload.message || 'Administrator access granted.');
      onAdded?.(payload);
    } catch (failure) {
      setError(failure.message || 'Could not grant administrator access.');
    } finally {
      setBusy(false);
    }
  };

  const submitLabel = mode === 'create' ? 'Create administrator' : 'Grant admin access';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brandNavy/40 p-4">
      <div
        className="w-full max-w-md rounded-xl border border-brandGrid bg-white p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-admin-dialog-title"
      >
        <h2 id="add-admin-dialog-title" className="text-lg font-bold text-brandNavy">
          Add an administrator
        </h2>
        <p className="mt-1 text-sm text-textBody">
          Administrators can read every assignment, moderate accounts and settle disputes.
          Only give this access to people who need the whole console.
        </p>

        <div className="mt-4 flex gap-2" role="tablist" aria-label="How to add the administrator">
          {TABS.map((tab) => {
            const selected = tab.id === mode;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => switchMode(tab.id)}
                disabled={busy}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                  selected
                    ? 'bg-brandBlue text-white'
                    : 'border border-brandGrid text-textBody hover:bg-brandIce'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="mt-4">
          {mode === 'create' ? (
            <>
              <label htmlFor="admin-full-name" className="block text-sm font-medium text-brandNavy">
                Full name
              </label>
              <input
                id="admin-full-name"
                type="text"
                value={fields.fullName}
                onChange={update('fullName')}
                disabled={busy}
                autoComplete="name"
                placeholder="Grace Hopper"
                className={FIELD_CLASS}
              />

              <label
                htmlFor="admin-email"
                className="mt-3 block text-sm font-medium text-brandNavy"
              >
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                value={fields.email}
                onChange={update('email')}
                disabled={busy}
                autoComplete="email"
                placeholder="grace@example.com"
                className={FIELD_CLASS}
              />

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="admin-password"
                    className="block text-sm font-medium text-brandNavy"
                  >
                    Password
                  </label>
                  <input
                    id="admin-password"
                    type="password"
                    value={fields.password}
                    onChange={update('password')}
                    disabled={busy}
                    autoComplete="new-password"
                    className={FIELD_CLASS}
                  />
                </div>
                <div>
                  <label
                    htmlFor="admin-confirm-password"
                    className="block text-sm font-medium text-brandNavy"
                  >
                    Confirm password
                  </label>
                  <input
                    id="admin-confirm-password"
                    type="password"
                    value={fields.confirmPassword}
                    onChange={update('confirmPassword')}
                    disabled={busy}
                    autoComplete="new-password"
                    className={FIELD_CLASS}
                  />
                </div>
              </div>

              <p className="mt-2 text-xs text-textMuted">
                At least {MIN_ADMIN_PASSWORD_LENGTH} characters. Share the password with them
                yourself — it is not emailed, and the account is created already confirmed.
              </p>
            </>
          ) : (
            <>
              <label
                htmlFor="promote-email"
                className="block text-sm font-medium text-brandNavy"
              >
                Email of an existing account
              </label>
              <input
                id="promote-email"
                type="email"
                value={promoteEmail}
                onChange={(event) => setPromoteEmail(event.target.value)}
                disabled={busy}
                autoComplete="email"
                placeholder="grace@example.com"
                className={FIELD_CLASS}
              />
              <p className="mt-2 text-xs text-textMuted">
                They keep their current password and profile; only the role changes. Their
                assignments stay exactly as they are.
              </p>
            </>
          )}

          {error ? (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-brandGrid px-4 py-2 text-sm font-medium text-textBody transition-colors hover:bg-brandIce disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-brandBlue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brandAccent disabled:opacity-50"
            >
              {mode === 'create' ? (
                <UserPlus className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              )}
              {busy ? (mode === 'create' ? 'Creating...' : 'Granting...') : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
