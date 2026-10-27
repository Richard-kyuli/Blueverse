import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockSupabase = { from: vi.fn(), auth: { signOut: vi.fn() } };

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

const toastSuccess = vi.fn();

vi.mock('react-hot-toast', () => ({
  default: { success: toastSuccess, error: vi.fn() },
}));

const { useAuth } = await import('@/contexts/AuthContext');
const AdminSignInPage = (await import('./page')).default;

const signIn = vi.fn();

function profileLookup(payload) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => payload,
  };
  mockSupabase.from.mockReturnValue(chain);
}

async function submitCredentials() {
  fireEvent.change(screen.getByLabelText('Administrator Email'), {
    target: { value: 'admin@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'a long enough password' },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /sign in to console/i }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  useAuth.mockReturnValue({
    user: null,
    isAdmin: false,
    loading: false,
    signIn,
  });

  signIn.mockResolvedValue({ success: true, user: { id: 'user-1' } });
  mockSupabase.auth.signOut.mockResolvedValue({ error: null });
});

describe('AdminSignInPage', () => {
  it('refuses to admit a student and drops the session', async () => {
    profileLookup({ data: { user_type: 'student', is_active: true }, error: null });

    render(<AdminSignInPage />);
    await submitCredentials();

    await waitFor(() => expect(mockSupabase.auth.signOut).toHaveBeenCalled());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /does not have administrator access/i
    );
    expect(replace).not.toHaveBeenCalledWith('/dashboard');
  });

  it('refuses a writer', async () => {
    profileLookup({ data: { user_type: 'writer', is_active: true }, error: null });

    render(<AdminSignInPage />);
    await submitCredentials();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /does not have administrator access/i
    );
    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
  });

  it('refuses a suspended administrator', async () => {
    profileLookup({ data: { user_type: 'admin', is_active: false }, error: null });

    render(<AdminSignInPage />);
    await submitCredentials();

    expect(await screen.findByRole('alert')).toHaveTextContent(/suspended/i);
    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
  });

  it('admits an active administrator', async () => {
    profileLookup({ data: { user_type: 'admin', is_active: true }, error: null });

    render(<AdminSignInPage />);
    await submitCredentials();

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
    expect(toastSuccess).toHaveBeenCalled();
    expect(mockSupabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('refuses to admit anyone when the profile cannot be read', async () => {
    profileLookup({ data: null, error: { message: 'network down' } });

    render(<AdminSignInPage />);
    await submitCredentials();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not verify your administrator access/i
    );
    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
  });

  it('reports rejected credentials without signing anything out', async () => {
    signIn.mockResolvedValue({ success: false, error: 'Invalid login credentials' });

    render(<AdminSignInPage />);
    await submitCredentials();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /credentials were not accepted/i
    );
    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(mockSupabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('renders the form when nobody is signed in', () => {
    render(<AdminSignInPage />);
    expect(screen.getByRole('button', { name: /sign in to console/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Administrator Email')).toBeInTheDocument();
  });
});
