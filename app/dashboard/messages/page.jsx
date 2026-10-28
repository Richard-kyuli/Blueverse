'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { MessageSquare, User, ChevronRight, Loader2 } from 'lucide-react';

const ASSIGNMENT_SELECT = `
  id,
  title,
  status,
  student_id,
  assigned_writer_id,
  student:profiles!student_id(id, full_name, avatar_url),
  writer:profiles!assigned_writer_id(id, full_name, avatar_url)
`;

function formatRelativeTime(value) {
  if (!value) return '';
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Turns the flat message list into one row per assignment: the latest message
 * plus the number of unread messages this user has received in that thread.
 * Messages arrive newest-first, so the first hit per assignment wins.
 */
export function buildConversations(assignments, messages, userId) {
  const latestByAssignment = new Map();
  const unreadByAssignment = new Map();

  for (const message of messages) {
    if (!latestByAssignment.has(message.assignment_id)) {
      latestByAssignment.set(message.assignment_id, message);
    }
    if (message.receiver_id === userId && !message.is_read) {
      unreadByAssignment.set(
        message.assignment_id,
        (unreadByAssignment.get(message.assignment_id) || 0) + 1
      );
    }
  }

  return assignments
    .filter((assignment) => assignment.assigned_writer_id)
    .filter((assignment) => assignment.student_id === userId || assignment.assigned_writer_id === userId)
    .map((assignment) => {
      const isStudent = assignment.student_id === userId;
      return {
        id: assignment.id,
        title: assignment.title,
        status: assignment.status,
        counterpart: isStudent ? assignment.writer : assignment.student,
        counterpartRole: isStudent ? 'Writer' : 'Student',
        lastMessage: latestByAssignment.get(assignment.id) || null,
        unreadCount: unreadByAssignment.get(assignment.id) || 0,
      };
    })
    .sort((a, b) => {
      const aTime = a.lastMessage?.created_at ? new Date(a.lastMessage.created_at).getTime() : 0;
      const bTime = b.lastMessage?.created_at ? new Date(b.lastMessage.created_at).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return a.title.localeCompare(b.title);
    });
}

export default function MessagesInboxPage() {
  const { profile } = useAuth();
  const userId = profile?.id;

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadConversations = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const { data: assignments, error: assignmentError } = await supabase
        .from('assignments')
        .select(ASSIGNMENT_SELECT)
        .or(`student_id.eq.${userId},assigned_writer_id.eq.${userId}`);

      if (assignmentError) throw assignmentError;

      const assignmentIds = (assignments || [])
        .filter((assignment) => assignment.assigned_writer_id)
        .map((assignment) => assignment.id);

      if (assignmentIds.length === 0) {
        setConversations([]);
        return;
      }

      const { data: messages, error: messageError } = await supabase
        .from('messages')
        .select('id, assignment_id, sender_id, receiver_id, message, is_read, created_at')
        .in('assignment_id', assignmentIds)
        .order('created_at', { ascending: false });

      if (messageError) throw messageError;

      setConversations(buildConversations(assignments || [], messages || [], userId));
    } catch (loadError) {
      console.error('Error loading conversations:', loadError);
      setError('Unable to load your conversations right now.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Coming back to the tab is the moment someone expects a fresh unread count.
  useEffect(() => {
    const handleFocus = () => loadConversations();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadConversations]);

  const totalUnread = conversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-brandNavy">Messages</h1>
            <p className="text-textBody">
              {totalUnread > 0
                ? `${totalUnread} unread message${totalUnread === 1 ? '' : 's'}`
                : 'Conversations for the assignments you are part of'}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-brandGrid bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-brandBlue" />
              <span className="ml-3 text-textBody">Loading conversations...</span>
            </div>
          ) : error ? (
            <div className="px-6 py-16 text-center">
              <p className="text-textBody">{error}</p>
              <button
                type="button"
                onClick={loadConversations}
                className="mt-4 rounded-lg border border-brandGrid px-4 py-2 text-sm font-medium text-brandBlue hover:border-brandBlue hover:bg-brandIce transition-colors"
              >
                Try again
              </button>
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <MessageSquare className="mx-auto mb-3 h-10 w-10 text-textMuted" />
              <h2 className="font-semibold text-brandNavy">No conversations yet</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-textBody">
                A conversation opens as soon as an assignment you own or are working on has a
                writer assigned.
              </p>
              <Link
                href="/dashboard/assignments"
                className="mt-5 inline-block rounded-lg bg-brandBlue px-5 py-2.5 text-sm font-medium text-white hover:bg-brandAccent transition-colors"
              >
                View assignments
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-brandGrid">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <Link
                    href={`/dashboard/assignments/${conversation.id}/messages`}
                    className="flex items-center gap-4 px-4 py-4 hover:bg-brandIce transition-colors sm:px-6"
                  >
                    {conversation.counterpart?.avatar_url ? (
                      <img
                        src={conversation.counterpart.avatar_url}
                        alt={conversation.counterpart.full_name}
                        className="h-11 w-11 flex-shrink-0 rounded-full object-cover border-2 border-brandGrid"
                      />
                    ) : (
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brandBlue/10">
                        <User className="h-5 w-5 text-brandBlue" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p
                          className={`truncate ${
                            conversation.unreadCount > 0
                              ? 'font-semibold text-textDark'
                              : 'font-medium text-textDark'
                          }`}
                        >
                          {conversation.counterpart?.full_name || 'Unassigned'}
                          <span className="ml-2 text-xs font-normal text-textMuted">
                            {conversation.counterpartRole}
                          </span>
                        </p>
                        <span className="flex-shrink-0 text-xs text-textMuted">
                          {formatRelativeTime(conversation.lastMessage?.created_at)}
                        </span>
                      </div>

                      <p className="truncate text-xs text-brandBlue">{conversation.title}</p>

                      <div className="mt-0.5 flex items-center justify-between gap-3">
                        <p
                          className={`truncate text-sm ${
                            conversation.unreadCount > 0
                              ? 'font-medium text-textDark'
                              : 'text-textBody'
                          }`}
                        >
                          {conversation.lastMessage
                            ? `${
                                conversation.lastMessage.sender_id === userId ? 'You: ' : ''
                              }${conversation.lastMessage.message}`
                            : 'No messages yet. Start the conversation'}
                        </p>
                        {conversation.unreadCount > 0 && (
                          <span
                            aria-label={`${conversation.unreadCount} unread`}
                            className="flex-shrink-0 rounded-full bg-brandBlue px-2 py-0.5 text-xs font-semibold text-white"
                          >
                            {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="hidden h-5 w-5 flex-shrink-0 text-textMuted sm:block" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
