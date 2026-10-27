import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminOnly from './AdminOnly';
import { useAuth } from '@/contexts/AuthContext';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));

describe('AdminOnly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the console for an administrator', () => {
    useAuth.mockReturnValue({ loading: false, isAdmin: true, profile: { user_type: 'admin' } });

    render(
      <AdminOnly>
        <p>Console content</p>
      </AdminOnly>
    );

    expect(screen.getByText('Console content')).toBeInTheDocument();
    expect(screen.queryByText('Administrators only')).not.toBeInTheDocument();
  });

  it('tells a non-administrator that the console is restricted', () => {
    useAuth.mockReturnValue({ loading: false, isAdmin: false, profile: { user_type: 'writer' } });

    render(
      <AdminOnly>
        <p>Console content</p>
      </AdminOnly>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Administrators only');
    expect(screen.getByText('You are signed in as writer.')).toBeInTheDocument();
    expect(screen.queryByText('Console content')).not.toBeInTheDocument();
  });

  it('waits rather than flashing the restricted notice while auth loads', () => {
    useAuth.mockReturnValue({ loading: true, isAdmin: false, profile: null });

    render(
      <AdminOnly>
        <p>Console content</p>
      </AdminOnly>
    );

    expect(screen.getByRole('status')).toHaveTextContent('Checking your access...');
    expect(screen.queryByText('Administrators only')).not.toBeInTheDocument();
  });
});
