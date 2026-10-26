'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Award,
  Bell,
  CheckCheck,
  RotateCcw,
  CheckCircle2,
  FileText,
  CreditCard,
  Loader2,
  MessageSquare,
  Star,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  getAllNotifications,
  getUnreadCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/lib/notifications';

const MAX_BADGE = 9;
const LIST_SIZE = 8;
const POLL_INTERVAL_MS = 60000;

const TYPE_ICONS = {
  submission_created: FileText,
  revision_requested: RotateCcw,
  work_approved: CheckCircle2,
  payment_released: CreditCard,
  message_received: MessageSquare,
  review_received: Star,
  bid_accepted: Award,
};

/**
 * Format how long ago a notification was created.
 *
 * @param {string} value - ISO timestamp
 * @returns {string}
 */
function formatRelativeTime(value) {
  if (!value) return '';

  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);

  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * NotificationBell Component
 *
 * Unread indicator plus a quick-view dropdown, rendered in the dashboard header so
 * users (students and writers) see workflow events — new submissions, revision
 * requests, approvals — without leaving the page they are on.
 *
 * Notifications are written server-side by /api/submissions/submit,
 * /api/submissions/review, /api/messages/send and /api/reviews (see
 * lib/notify.js), because the table has no INSERT policy for signed-in users.
 *
 * @param {Object} props
 * @param {string} props.userId - UUID of the signed-in user
 */
export default function NotificationBell({ userId }) {
  const router = useRouter();
  const containerRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;

    const [listResult, countResult] = await Promise.all([
      getAllNotifications(userId, { page: 1, pageSize: LIST_SIZE }),
      getUnreadCount(userId),
    ]);

    if (listResult.data) {
      setNotifications(listResult.data);
    }

    setUnreadCount(countResult.count || 0);
    // A failed read usually means the notifications SELECT policy is missing in
    // the deployed database, so say so instead of showing an empty bell.
    setLoadError(Boolean(countResult.error || listResult.error));
    setLoading(false);
  }, [userId]);

  // Initial load
  useEffect(() => {
    load();
  }, [load]);

  // Re-fetch when the tab regains focus so a notification raised while the user was
  // on another page shows up as soon as they come back
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        load();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', load);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  // Live updates when the row is inserted (no-op unless Realtime is enabled for the table)
  useEffect(() => {
    if (!userId) return undefined;

    let channel;

    try {
      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          load
        )
        .subscribe();
    } catch (error) {
      console.error('Notification subscription failed:', error);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [userId, load]);

  // Safety net for the realtime path above: the table is only published for
  // Realtime in some environments, so poll while the tab is in the foreground.
  useEffect(() => {
    if (!userId) return undefined;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        load();
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [userId, load]);

  // Close on outside click and Escape
  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    // Refresh on open so the panel is never showing a stale list
    if (nextOpen) {
      load();
    }
  };

  const handleItemClick = async (notification) => {
    setIsOpen(false);

    if (!notification.is_read) {
      setNotifications((prev) =>
        prev.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      await markNotificationAsRead(notification.id);
    }

    if (notification.link) {
      router.push(notification.link);
    }
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);

    const result = await markAllNotificationsAsRead(userId);

    if (result.success) {
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
    }

    setMarkingAll(false);
  };

  const badgeLabel = unreadCount > MAX_BADGE ? `${MAX_BADGE}+` : `${unreadCount}`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications, none unread'
        }
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-textBody hover:bg-brandIce hover:text-brandBlue transition-colors focus:outline-none focus:ring-2 focus:ring-brandBlue focus:ring-offset-2"
      >
        <Bell
          className={`h-5 w-5 ${unreadCount > 0 ? 'text-brandAccent' : ''}`}
          aria-hidden="true"
        />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brandAccent px-1 text-[11px] font-semibold leading-none text-white"
            aria-hidden="true"
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-brandGrid bg-white shadow-lg z-40 overflow-hidden"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-brandGrid">
            <p className="text-sm font-semibold text-brandNavy">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={markingAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-brandBlue hover:text-brandAccent disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brandBlue focus:ring-offset-2 rounded"
              >
                {markingAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-textMuted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading notifications...
              </div>
            ) : loadError ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-textMuted">Could not load notifications.</p>
                <button
                  type="button"
                  onClick={load}
                  className="mt-2 rounded text-xs font-medium text-brandBlue hover:text-brandAccent focus:outline-none focus:ring-2 focus:ring-brandBlue focus:ring-offset-2"
                >
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-textMuted">
                You&apos;re all caught up.
              </p>
            ) : (
              <ul className="divide-y divide-brandGrid">
                {notifications.map((notification) => {
                  const Icon = TYPE_ICONS[notification.type] || Bell;

                  return (
                    <li key={notification.id}>
                      <button
                        type="button"
                        onClick={() => handleItemClick(notification)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-brandIce focus:outline-none focus:bg-brandIce ${
                          notification.is_read ? '' : 'bg-brandIce/60'
                        }`}
                      >
                        <span
                          className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brandBlue/10"
                          aria-hidden="true"
                        >
                          <Icon className="h-4 w-4 text-brandBlue" />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-brandNavy">
                              {notification.title}
                            </span>
                            {!notification.is_read && (
                              <span
                                className="h-2 w-2 flex-shrink-0 rounded-full bg-brandAccent"
                                aria-label="Unread"
                              />
                            )}
                          </span>
                          <span className="mt-0.5 block text-sm text-textBody line-clamp-2">
                            {notification.message}
                          </span>
                          <span className="mt-1 block text-xs text-textMuted">
                            {formatRelativeTime(notification.created_at)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
