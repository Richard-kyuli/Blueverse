import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockSupabase = {
  from: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
  auth: {
    getSession: vi.fn(),
  },
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/components/dashboard/DashboardLayout', () => ({
  default: ({ children }) => <div data-testid="dashboard-layout">{children}</div>,
}));

const { useParams, useRouter } = await import('next/navigation');
const { useAuth } = await import('@/contexts/AuthContext');
const toast = (await import('react-hot-toast')).default;
const MessagesPage = (await import('./page')).default;

// Fluent Supabase builder: every filter method returns the builder, and the
// builder resolves to the supplied result when awaited.
function createChain(result) {
  const builder = { then: (resolve) => resolve(result) };
  for (const method of ['select', 'eq', 'order', 'limit', 'single', 'in', 'or']) {
    builder[method] = vi.fn(() => builder);
  }
  return builder;
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const STUDENT = { id: 'student-1', user_type: 'student', full_name: 'Ada Student', avatar_url: null };
const WRITER = { id: 'writer-1', user_type: 'writer', full_name: 'Grace Writer', avatar_url: null };

const ASSIGNMENT = {
  id: 'assignment-1',
  title: 'Essay on Climate Policy',
  status: 'in_progress',
  student_id: STUDENT.id,
  assigned_writer_id: WRITER.id,
  student: { id: STUDENT.id, full_name: STUDENT.full_name, avatar_url: null },
  writer: { id: WRITER.id, full_name: WRITER.full_name, avatar_url: null },
};

const INCOMING = {
  id: 'message-1',
  assignment_id: ASSIGNMENT.id,
  sender_id: WRITER.id,
  receiver_id: STUDENT.id,
  message: 'Here is the first draft.',
  is_read: false,
  created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  sender: { id: WRITER.id, full_name: WRITER.full_name, avatar_url: null },
};

const OUTGOING = {
  id: 'message-2',
  assignment_id: ASSIGNMENT.id,
  sender_id: STUDENT.id,
  receiver_id: WRITER.id,
  message: 'Thanks, reviewing now.',
  is_read: true,
  created_at: new Date(Date.now() - 60 * 1000).toISOString(),
  sender: { id: STUDENT.id, full_name: STUDENT.full_name, avatar_url: null },
};

describe('Assignment messages page', () => {
  const mockPush = vi.fn();
  const fetchMock = vi.fn();
  let sendResponse;

  function mockSupabaseFor({ assignment = ASSIGNMENT, messages = [INCOMING, OUTGOING] } = {}) {
    const assignmentChain = createChain({ data: assignment, error: null });
    const messageListChain = createChain({ data: messages, error: null });

    mockSupabase.from.mockImplementation((table) =>
      table === 'assignments' ? assignmentChain : messageListChain
    );

    return { assignmentChain, messageListChain };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    useParams.mockReturnValue({ id: ASSIGNMENT.id });
    useRouter.mockReturnValue({ push: mockPush, back: vi.fn() });
    useAuth.mockReturnValue({ profile: STUDENT });

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'token-123' } },
      error: null,
    });

    const channel = { on: vi.fn(() => channel), subscribe: vi.fn(() => channel) };
    mockSupabase.channel.mockReturnValue(channel);

    sendResponse = jsonResponse(201, {
      success: true,
      message: {
        id: 'message-3',
        assignment_id: ASSIGNMENT.id,
        sender_id: STUDENT.id,
        receiver_id: WRITER.id,
        message: 'Could you add a conclusion?',
        is_read: false,
        created_at: new Date().toISOString(),
      },
    });

    fetchMock.mockImplementation(async (url) => {
      if (url === '/api/messages/read') {
        return jsonResponse(200, { success: true, markedRead: 0 });
      }
      if (url === '/api/messages/send') {
        return sendResponse;
      }
      return jsonResponse(404, { error: `Unexpected request to ${url}` });
    });

    vi.stubGlobal('fetch', fetchMock);

    mockSupabaseFor();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const sendCalls = () => fetchMock.mock.calls.filter(([url]) => url === '/api/messages/send');
  const readCalls = () => fetchMock.mock.calls.filter(([url]) => url === '/api/messages/read');

  it('renders the conversation for the student, with the writer as the counterpart', async () => {
    render(<MessagesPage />);

    await waitFor(() => {
      expect(screen.getByText('Here is the first draft.')).toBeInTheDocument();
    });

    expect(screen.getByText('Grace Writer')).toBeInTheDocument();
    expect(screen.getByText('Writer')).toBeInTheDocument();
    expect(screen.getByText('Thanks, reviewing now.')).toBeInTheDocument();
    expect(screen.getAllByText('Essay on Climate Policy').length).toBeGreaterThan(0);
  });

  it('marks the incoming messages as read through the API', async () => {
    render(<MessagesPage />);

    await waitFor(() => {
      expect(readCalls()).toHaveLength(1);
    });

    const [, options] = readCalls()[0];
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer token-123');
    expect(JSON.parse(options.body)).toEqual({ assignmentId: ASSIGNMENT.id });
  });

  it('sends a message through the API and shows it immediately', async () => {
    render(<MessagesPage />);

    await waitFor(() => {
      expect(screen.getByText('Here is the first draft.')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'Could you add a conclusion?' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(sendCalls()).toHaveLength(1);
    });

    const [, options] = sendCalls()[0];
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer token-123');
    expect(JSON.parse(options.body)).toEqual({
      assignmentId: ASSIGNMENT.id,
      message: 'Could you add a conclusion?',
    });

    // The row returned by the API is appended without a refetch.
    expect(await screen.findByText('Could you add a conclusion?')).toBeInTheDocument();
    expect(screen.getByLabelText('Message')).toHaveValue('');
  });

  it('lets the writer reply to the student through the same endpoint', async () => {
    useAuth.mockReturnValue({ profile: WRITER });
    sendResponse = jsonResponse(201, {
      success: true,
      message: {
        id: 'message-4',
        assignment_id: ASSIGNMENT.id,
        sender_id: WRITER.id,
        receiver_id: STUDENT.id,
        message: 'Adding the conclusion now.',
        is_read: false,
        created_at: new Date().toISOString(),
      },
    });

    render(<MessagesPage />);

    // The header names the student for a writer.
    await waitFor(() => {
      expect(screen.getByText('Ada Student')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'Adding the conclusion now.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(sendCalls()).toHaveLength(1);
    });

    // The receiver is derived on the server, so the body carries only the text.
    expect(JSON.parse(sendCalls()[0][1].body)).toEqual({
      assignmentId: ASSIGNMENT.id,
      message: 'Adding the conclusion now.',
    });
    expect(await screen.findByText('Adding the conclusion now.')).toBeInTheDocument();
  });

  it('sends the message when Enter is pressed', async () => {
    render(<MessagesPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Message')).toBeInTheDocument();
    });

    const textarea = screen.getByLabelText('Message');
    fireEvent.change(textarea, { target: { value: 'Quick question.' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() => {
      expect(sendCalls()).toHaveLength(1);
    });
  });

  it('does not send whitespace-only messages', async () => {
    render(<MessagesPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Message')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: '   ' } });
    fireEvent.keyDown(screen.getByLabelText('Message'), { key: 'Enter', shiftKey: false });

    expect(sendCalls()).toHaveLength(0);
    expect(toast.error).toHaveBeenCalledWith('Please enter a message');
  });

  it('surfaces the server detail when the message is rejected', async () => {
    sendResponse = jsonResponse(500, {
      success: false,
      error: 'Failed to send message',
      details: 'new row violates row-level security policy for table "messages"',
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<MessagesPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Message')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Will this fail?' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'new row violates row-level security policy'
      );
    });

    expect(toast.error).toHaveBeenCalledWith('Failed to send message');
    // The draft is kept so the user does not lose what they typed.
    expect(screen.getByLabelText('Message')).toHaveValue('Will this fail?');

    consoleError.mockRestore();
  });

  it('blocks users who are not part of the assignment', async () => {
    mockSupabaseFor({
      assignment: { ...ASSIGNMENT, student_id: 'someone-else', assigned_writer_id: 'another-writer' },
    });

    render(<MessagesPage />);

    await waitFor(() => {
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Only the student and the assigned writer can view this conversation.')
    ).toBeInTheDocument();
    // No conversation is loaded, and nothing is marked read, for an outsider.
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(readCalls()).toHaveLength(0);
  });

  it('disables the composer until a writer is assigned', async () => {
    mockSupabaseFor({
      assignment: {
        ...ASSIGNMENT,
        status: 'open',
        assigned_writer_id: null,
        writer: null,
      },
      messages: [],
    });

    render(<MessagesPage />);

    await waitFor(() => {
      expect(screen.getByText('No writer assigned yet')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Message')).toBeDisabled();
    expect(screen.getByPlaceholderText('Waiting for a writer to be assigned')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('shows a helpful message when the thread has no messages yet', async () => {
    mockSupabaseFor({ messages: [] });

    render(<MessagesPage />);

    await waitFor(() => {
      expect(screen.getByText('No messages yet')).toBeInTheDocument();
    });

    expect(screen.getByText('Start the conversation with the writer.')).toBeInTheDocument();
  });

  it('surfaces a load failure instead of an empty thread', async () => {
    const assignmentChain = createChain({ data: null, error: { message: 'Not found' } });
    mockSupabase.from.mockImplementation(() => assignmentChain);

    render(<MessagesPage />);

    await waitFor(() => {
      expect(screen.getByText('Conversation unavailable')).toBeInTheDocument();
    });

    expect(toast.error).toHaveBeenCalledWith('Failed to load conversation');
  });

  it('still renders the thread when realtime is unavailable', async () => {
    mockSupabase.channel.mockImplementation(() => {
      throw new Error('realtime disabled');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<MessagesPage />);

    await waitFor(() => {
      expect(screen.getByText('Here is the first draft.')).toBeInTheDocument();
    });

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
