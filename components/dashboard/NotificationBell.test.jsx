import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import NotificationBell from './NotificationBell';
import {
  getAllNotifications,
  getUnreadCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/lib/notifications';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/lib/notifications', () => ({
  getAllNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
  markNotificationAsRead: vi.fn(),
}));

vi.mock('@/lib/supabase', () => {
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);

  return {
    supabase: {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    },
  };
});

describe('NotificationBell', () => {
  const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60 * 1000).toISOString();

  const unreadRevision = {
    id: 'notification-1',
    type: 'revision_requested',
    title: 'Revision Required',
    message: 'The student requested a revision for "Hotel Management System".',
    link: '/dashboard/assignments/assignment-1/submit',
    is_read: false,
    created_at: minutesAgo(5),
  };

  const readApproval = {
    id: 'notification-2',
    type: 'work_approved',
    title: 'Work Approved',
    message: 'Your work for "Essay on Climate Policy" has been approved.',
    link: '/dashboard/assignments/assignment-2',
    is_read: true,
    created_at: minutesAgo(120),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    getAllNotifications.mockResolvedValue({
      data: [unreadRevision, readApproval],
      error: null,
      hasMore: false,
    });
    getUnreadCount.mockResolvedValue({ count: 1, error: null });
    markNotificationAsRead.mockResolvedValue({ success: true, error: null });
    markAllNotificationsAsRead.mockResolvedValue({ success: true, error: null });
  });

  it('shows the unread count on the bell', async () => {
    render(<NotificationBell userId="writer-1" />);

    expect(
      await screen.findByRole('button', { name: 'Notifications, 1 unread' })
    ).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('caps the badge at 9+', async () => {
    getUnreadCount.mockResolvedValue({ count: 14, error: null });

    render(<NotificationBell userId="writer-1" />);

    expect(await screen.findByText('9+')).toBeInTheDocument();
  });

  it('shows no badge when everything is read', async () => {
    getUnreadCount.mockResolvedValue({ count: 0, error: null });

    render(<NotificationBell userId="writer-1" />);

    expect(
      await screen.findByRole('button', { name: 'Notifications, none unread' })
    ).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('opens the panel and lists notification titles and messages', async () => {
    const user = userEvent.setup();
    render(<NotificationBell userId="writer-1" />);

    await user.click(await screen.findByRole('button', { name: /Notifications/ }));

    expect(screen.getByText('Revision Required')).toBeInTheDocument();
    expect(
      screen.getByText('The student requested a revision for "Hotel Management System".')
    ).toBeInTheDocument();
    expect(screen.getByText('Work Approved')).toBeInTheDocument();
    expect(screen.getByText('5m ago')).toBeInTheDocument();
    expect(screen.getByText('2h ago')).toBeInTheDocument();
  });

  it('shows an empty state when there are no notifications', async () => {
    getAllNotifications.mockResolvedValue({ data: [], error: null, hasMore: false });
    getUnreadCount.mockResolvedValue({ count: 0, error: null });

    const user = userEvent.setup();
    render(<NotificationBell userId="writer-1" />);

    await user.click(await screen.findByRole('button', { name: /Notifications/ }));

    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  });

  it('marks a notification read and follows its link', async () => {
    const user = userEvent.setup();
    render(<NotificationBell userId="writer-1" />);

    await user.click(await screen.findByRole('button', { name: /Notifications/ }));
    await user.click(screen.getByText('Revision Required'));

    await waitFor(() => {
      expect(markNotificationAsRead).toHaveBeenCalledWith('notification-1');
    });
    expect(mockPush).toHaveBeenCalledWith('/dashboard/assignments/assignment-1/submit');
  });

  it('does not call the API again for an already read notification', async () => {
    const user = userEvent.setup();
    render(<NotificationBell userId="writer-1" />);

    await user.click(await screen.findByRole('button', { name: /Notifications/ }));
    await user.click(screen.getByText('Work Approved'));

    expect(markNotificationAsRead).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/dashboard/assignments/assignment-2');
  });

  it('marks everything read and clears the badge', async () => {
    const user = userEvent.setup();
    render(<NotificationBell userId="writer-1" />);

    await user.click(await screen.findByRole('button', { name: /Notifications/ }));
    await user.click(screen.getByRole('button', { name: /Mark all read/ }));

    await waitFor(() => {
      expect(markAllNotificationsAsRead).toHaveBeenCalledWith('writer-1');
    });
    expect(
      screen.getByRole('button', { name: 'Notifications, none unread' })
    ).toBeInTheDocument();
  });

  it('surfaces a failed query with a retry instead of an empty state', async () => {
    getAllNotifications.mockResolvedValue({ data: null, error: new Error('boom'), hasMore: false });
    getUnreadCount.mockResolvedValue({ count: 0, error: new Error('boom') });

    const user = userEvent.setup();
    render(<NotificationBell userId="writer-1" />);

    await user.click(await screen.findByRole('button', { name: /Notifications/ }));

    expect(await screen.findByText('Could not load notifications.')).toBeInTheDocument();
    expect(screen.queryByText("You're all caught up.")).not.toBeInTheDocument();
  });

  it('recovers when retried after a failed query', async () => {
    getAllNotifications.mockResolvedValue({ data: null, error: new Error('boom'), hasMore: false });
    getUnreadCount.mockResolvedValue({ count: 0, error: new Error('boom') });

    const user = userEvent.setup();
    render(<NotificationBell userId="writer-1" />);

    await user.click(await screen.findByRole('button', { name: /Notifications/ }));

    getAllNotifications.mockResolvedValue({
      data: [unreadRevision],
      error: null,
      hasMore: false,
    });
    getUnreadCount.mockResolvedValue({ count: 1, error: null });

    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Revision Required')).toBeInTheDocument();
  });
});
