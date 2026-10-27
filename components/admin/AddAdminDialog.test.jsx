import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import toast from 'react-hot-toast';
import AddAdminDialog from './AddAdminDialog';
import { adminFetch } from '@/lib/adminApi';

vi.mock('@/lib/adminApi', () => ({ adminFetch: vi.fn() }));
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const PASSWORD = 'a-long-enough-password';

const fillCreateForm = async (user, overrides = {}) => {
  await user.type(screen.getByLabelText('Full name'), overrides.fullName ?? 'Grace Hopper');
  await user.type(screen.getByLabelText('Email'), overrides.email ?? 'Grace@Example.com');
  await user.type(screen.getByLabelText('Password'), overrides.password ?? PASSWORD);
  await user.type(
    screen.getByLabelText('Confirm password'),
    overrides.confirmPassword ?? PASSWORD
  );
};

describe('AddAdminDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminFetch.mockResolvedValue({ success: true, message: 'Grace Hopper can now sign in.' });
  });

  it('opens on the create form and explains the password rule', () => {
    render(<AddAdminDialog onClose={vi.fn()} onAdded={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /add an administrator/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /create an account/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
    expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument();
  });

  it('creates the account and reports the server message', async () => {
    const user = userEvent.setup();
    const onAdded = vi.fn();
    render(<AddAdminDialog onClose={vi.fn()} onAdded={onAdded} />);

    await fillCreateForm(user);
    await user.click(screen.getByRole('button', { name: /create administrator/i }));

    await waitFor(() => expect(adminFetch).toHaveBeenCalledTimes(1));

    expect(adminFetch).toHaveBeenCalledWith('/api/admin/admins', {
      method: 'POST',
      body: {
        fullName: 'Grace Hopper',
        email: 'grace@example.com',
        password: PASSWORD,
      },
    });
    expect(toast.success).toHaveBeenCalledWith('Grace Hopper can now sign in.');
    expect(onAdded).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Grace Hopper can now sign in.' })
    );
  });

  it('stops at a password mismatch without calling the API', async () => {
    const user = userEvent.setup();
    render(<AddAdminDialog onClose={vi.fn()} onAdded={vi.fn()} />);

    await fillCreateForm(user, { confirmPassword: 'something-else' });
    await user.click(screen.getByRole('button', { name: /create administrator/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('The two passwords do not match.');
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it('stops at a short password without calling the API', async () => {
    const user = userEvent.setup();
    render(<AddAdminDialog onClose={vi.fn()} onAdded={vi.fn()} />);

    await fillCreateForm(user, { password: 'short', confirmPassword: 'short' });
    await user.click(screen.getByRole('button', { name: /create administrator/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/at least 10 characters/i);
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it('promotes an existing account by its normalised email', async () => {
    const user = userEvent.setup();
    const onAdded = vi.fn();
    render(<AddAdminDialog onClose={vi.fn()} onAdded={onAdded} />);

    await user.click(screen.getByRole('tab', { name: /promote a user/i }));
    await user.type(screen.getByLabelText(/email of an existing account/i), ' Grace@Example.com ');
    await user.click(screen.getByRole('button', { name: /grant admin access/i }));

    await waitFor(() => expect(adminFetch).toHaveBeenCalledTimes(1));

    expect(adminFetch).toHaveBeenCalledWith('/api/admin/admins', {
      method: 'PATCH',
      body: { email: 'grace@example.com' },
    });
    expect(onAdded).toHaveBeenCalled();
  });

  it('rejects an address the browser accepts but the server does not', async () => {
    const user = userEvent.setup();
    render(<AddAdminDialog onClose={vi.fn()} onAdded={vi.fn()} />);

    await user.click(screen.getByRole('tab', { name: /promote a user/i }));
    // Type="email" lets this through, so the shared rule is what rejects it.
    await user.type(screen.getByLabelText(/email of an existing account/i), 'no@domain');
    await user.click(screen.getByRole('button', { name: /grant admin access/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
    expect(adminFetch).not.toHaveBeenCalled();
  });

  it('shows the server refusal and leaves the dialog open', async () => {
    adminFetch.mockRejectedValue(
      new Error('An account with that email already exists. Promote it instead of creating a new one.')
    );

    const user = userEvent.setup();
    const onAdded = vi.fn();
    render(<AddAdminDialog onClose={vi.fn()} onAdded={onAdded} />);

    await fillCreateForm(user);
    await user.click(screen.getByRole('button', { name: /create administrator/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/promote it instead/i)
    );
    expect(onAdded).not.toHaveBeenCalled();
  });

  it('clears a previous error when switching mode', async () => {
    const user = userEvent.setup();
    render(<AddAdminDialog onClose={vi.fn()} onAdded={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /create administrator/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/full name/i);

    await user.click(screen.getByRole('tab', { name: /promote a user/i }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('closes on cancel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<AddAdminDialog onClose={onClose} onAdded={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
  });
});
