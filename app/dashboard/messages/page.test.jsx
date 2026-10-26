import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockSupabase = {
  from: vi.fn(),
};

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

vi.mock('@/components/dashboard/DashboardLayout', () => ({
  default: ({ children }) => <div data-testid="dashboard-layout">{children}</div>,
}));

const { useAuth } = await import('@/contexts/AuthContext');
const MessagesInboxPage = (await import('./page')).default;
const { buildConversations } = await import('./page');

function createChain(result) {
  const builder = { then: (resolve) => resolve(result) };
  for (const method of ['select', 'eq', 'order', 'limit', 'single', 'in', 'or']) {
    builder[method] = vi.fn(() => builder);
  }
  return builder;
}

const ME = { id: 'student-1', user_type: 'student', full_name: 'Ada Student' };

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

const ASSIGNMENTS = [
  {
    id: 'a1',
    title: 'Essay on Climate Policy',
    status: 'in_progress',
    student_id: ME.id,
    assigned_writer_id: 'writer-1',
    student: { id: ME.id, full_name: 'Ada Student', avatar_url: null },
    writer: { id: 'writer-1', full_name: 'Grace Writer', avatar_url: null },
  },
  {
    id: 'a2',
    title: 'Statistics Report',
    status: 'under_review',
    student_id: ME.id,
    assigned_writer_id: 'writer-2',
    student: { id: ME.id, full_name: 'Ada Student', avatar_url: null },
    writer: { id: 'writer-2', full_name: 'Alan Writer', avatar_url: null },
  },
  {
    id: 'a3',
    title: 'History Essay',
    status: 'assigned',
    student_id: 'student-9',
    assigned_writer_id: ME.id,
    student: { id: 'student-9', full_name: 'Sofia Student', avatar_url: null },
    writer: { id: ME.id, full_name: 'Ada Student', avatar_url: null },
  },
  {
    id: 'a4',
    title: 'Open Task With No Writer',
    status: 'open',
    student_id: ME.id,
    assigned_writer_id: null,
    student: { id: ME.id, full_name: 'Ada Student', avatar_url: null },
    writer: null,
  },
];

const MESSAGES = [
  {
    id: 'm1',
    assignment_id: 'a3',
    sender_id: 'student-9',
    receiver_id: ME.id,
    message: 'Can we move the deadline?',
    is_read: false,
    created_at: minutesAgo(2),
  },
  {
    id: 'm2',
    assignment_id: 'a1',
    sender_id: 'writer-1',
    receiver_id: ME.id,
    message: 'Here is the first draft.',
    is_read: false,
    created_at: minutesAgo(5),
  },
  {
    id: 'm3',
    assignment_id: 'a2',
    sender_id: ME.id,
    receiver_id: 'writer-2',
    message: 'Thanks, will start tomorrow.',
    is_read: true,
    created_at: minutesAgo(120),
  },
  {
    id: 'm4',
    assignment_id: 'a2',
    sender_id: 'writer-2',
    receiver_id: ME.id,
    message: 'Draft attached.',
    is_read: true,
    created_at: minutesAgo(180),
  },
];

describe('Messages inbox page', () => {
  let assignmentChain;
  let messageChain;

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ profile: ME });

    assignmentChain = createChain({ data: ASSIGNMENTS, error: null });
    messageChain = createChain({ data: MESSAGES, error: null });

    mockSupabase.from.mockImplementation((table) =>
      table === 'assignments' ? assignmentChain : messageChain
    );
  });

  it('lists one row per conversation, newest activity first', async () => {
    render(<MessagesInboxPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });

    const rows = screen.getAllByRole('listitem');
    expect(rows[0].textContent).toContain('History Essay');
    expect(rows[0].textContent).toContain('Sofia Student');
    expect(rows[1].textContent).toContain('Essay on Climate Policy');
    expect(rows[1].textContent).toContain('Grace Writer');
    expect(rows[2].textContent).toContain('Statistics Report');
  });

  it('shows the other party from the correct point of view', async () => {
    render(<MessagesInboxPage />);

    const rows = await screen.findAllByRole('listitem');

    // Student threads show the writer; the writer thread shows the student.
    expect(rows[1].textContent).toContain('Writer');
    expect(rows[0].textContent).toContain('Student');
  });

  it('surfaces unread counts in the header and on each conversation', async () => {
    render(<MessagesInboxPage />);

    await waitFor(() => {
      expect(screen.getByText('2 unread messages')).toBeInTheDocument();
    });

    const badges = screen.getAllByLabelText('1 unread');
    expect(badges).toHaveLength(2);
  });

  it('previews the latest message and marks the current user as the sender', async () => {
    render(<MessagesInboxPage />);

    const rows = await screen.findAllByRole('listitem');

    expect(rows[1].textContent).toContain('Here is the first draft.');
    expect(rows[2].textContent).toContain('You: Thanks, will start tomorrow.');
  });

  it('links each conversation to its assignment thread', async () => {
    render(<MessagesInboxPage />);

    const rows = await screen.findAllByRole('listitem');
    const links = rows.map((row) => row.querySelector('a'));

    expect(links[1]).toHaveAttribute('href', '/dashboard/assignments/a1/messages');
    expect(links[2]).toHaveAttribute('href', '/dashboard/assignments/a2/messages');
  });

  it('hides assignments that have no writer yet', async () => {
    render(<MessagesInboxPage />);

    await screen.findAllByRole('listitem');

    expect(screen.queryByText('Open Task With No Writer')).not.toBeInTheDocument();
  });

  it('shows an empty state when nothing is assigned', async () => {
    assignmentChain = createChain({ data: [], error: null });
    mockSupabase.from.mockImplementation((table) =>
      table === 'assignments' ? assignmentChain : messageChain
    );

    render(<MessagesInboxPage />);

    await waitFor(() => {
      expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: 'View assignments' })).toHaveAttribute(
      'href',
      '/dashboard/assignments'
    );
  });

  it('shows an error state with a retry that refetches', async () => {
    assignmentChain = createChain({ data: null, error: { message: 'boom' } });
    mockSupabase.from.mockImplementation((table) =>
      table === 'assignments' ? assignmentChain : messageChain
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<MessagesInboxPage />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load your conversations right now.')).toBeInTheDocument();
    });

    // Fix the underlying query, then retry from the UI.
    assignmentChain = createChain({ data: ASSIGNMENTS, error: null });
    mockSupabase.from.mockImplementation((table) =>
      table === 'assignments' ? assignmentChain : messageChain
    );

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });

    consoleError.mockRestore();
  });
});

describe('buildConversations', () => {
  it('uses only the newest message per assignment and counts unread incoming ones', () => {
    const conversations = buildConversations(ASSIGNMENTS, MESSAGES, ME.id);

    expect(conversations).toHaveLength(3);
    expect(conversations.map((conversation) => conversation.id)).toEqual(['a3', 'a1', 'a2']);

    const statistics = conversations.find((conversation) => conversation.id === 'a2');
    expect(statistics.lastMessage.message).toBe('Thanks, will start tomorrow.');
    expect(statistics.unreadCount).toBe(0);

    const history = conversations.find((conversation) => conversation.id === 'a3');
    expect(history.counterpart.full_name).toBe('Sofia Student');
    expect(history.counterpartRole).toBe('Student');
    expect(history.unreadCount).toBe(1);
  });

  it('returns an empty list when there are no assigned assignments', () => {
    expect(buildConversations([], [], ME.id)).toEqual([]);
  });
});
