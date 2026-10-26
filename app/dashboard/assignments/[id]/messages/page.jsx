'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Send, ArrowLeft, User, MessageSquare, AlertCircle } from 'lucide-react';

const MAX_LENGTH = 2000;

const ASSIGNMENT_SELECT = `
  id,
  title,
  status,
  student_id,
  assigned_writer_id,
  student:profiles!student_id(id, full_name, avatar_url),
  writer:profiles!assigned_writer_id(id, full_name, avatar_url)
`;

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const diff = Date.now() - date.getTime();

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

// Message writes go through the API routes. The browser client can read the
// thread, but inserts and read receipts are rejected by the deployed RLS
// policies, so the server performs them with the service role after verifying
// the caller's token.
async function getAccessToken() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session?.access_token) return null;
    return data.session.access_token;
  } catch (error) {
    console.warn('Could not read the current session:', error);
    return null;
  }
}

async function markIncomingAsRead(assignmentId) {
  if (!assignmentId) return;

  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    const response = await fetch('/api/messages/read', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ assignmentId }),
    });

    if (!response.ok) {
      // Read receipts are cosmetic; never surface this to the user.
      console.warn('Could not mark messages as read:', response.status);
    }
  } catch (error) {
    console.warn('Could not mark messages as read:', error);
  }
}

export default function MessagesPage() {
  const { profile } = useAuth();
  const params = useParams();
  const router = useRouter();
  const assignmentId = params?.id;
  const userId = profile?.id;

  const [assignment, setAssignment] = useState(null);
  const [otherParty, setOtherParty] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const messagesEndRef = useRef(null);

  const loadConversation = useCallback(async () => {
    if (!assignmentId || !userId) return;

    setLoading(true);
    try {
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .select(ASSIGNMENT_SELECT)
        .eq('id', assignmentId)
        .single();

      if (assignmentError) throw assignmentError;

      const isStudent = assignmentData.student_id === userId;
      const isWriter = assignmentData.assigned_writer_id === userId;

      if (!isStudent && !isWriter) {
        setAccessDenied(true);
        setAssignment(null);
        return;
      }

      setAssignment(assignmentData);
      setOtherParty(isStudent ? assignmentData.writer : assignmentData.student);

      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .select(`*, sender:profiles!sender_id(id, full_name, avatar_url)`)
        .eq('assignment_id', assignmentId)
        .order('created_at', { ascending: true });

      if (messageError) throw messageError;

      setMessages(messageData || []);
      markIncomingAsRead(assignmentId);
    } catch (error) {
      console.error('Error loading conversation:', error);
      setLoadError(error.message || 'Failed to load conversation');
      toast.error('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  }, [assignmentId, userId]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // Live delivery of the other party's messages.
  useEffect(() => {
    if (!assignmentId || !userId) return;

    let channel;
    try {
      channel = supabase
        .channel(`messages:${assignmentId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `assignment_id=eq.${assignmentId}`,
          },
          (payload) => {
            const incoming = payload.new;
            setMessages((prev) =>
              prev.some((message) => message.id === incoming.id) ? prev : [...prev, incoming]
            );
            if (incoming.receiver_id === userId) {
              markIncomingAsRead(assignmentId);
            }
          }
        )
        .subscribe();
    } catch (error) {
      // Realtime is optional: the thread still works on refresh without it.
      console.warn('Realtime messages unavailable:', error);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [assignmentId, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (event) => {
    event?.preventDefault();

    const body = newMessage.trim();
    if (!body || sending) {
      if (!body) toast.error('Please enter a message');
      return;
    }

    setSending(true);
    setSendError(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        toast.error('Your session has expired. Please sign in again.');
        return;
      }

      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ assignmentId, message: body }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.message) {
        const reason =
          payload.details || payload.error || `Request failed with status ${response.status}`;
        console.error('Error sending message:', payload);
        setSendError(reason);
        toast.error(payload.error || 'Failed to send message');
        return;
      }

      const sent = {
        ...payload.message,
        sender: { id: userId, full_name: profile?.full_name, avatar_url: profile?.avatar_url },
      };

      setMessages((prev) =>
        prev.some((message) => message.id === sent.id) ? prev : [...prev, sent]
      );
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      setSendError(error.message || 'Network error');
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div
              className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brandBlue border-r-transparent"
              role="status"
              aria-label="Loading"
            />
            <p className="mt-4 text-textBody">Loading messages...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (accessDenied) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto bg-white rounded-xl border border-brandGrid p-8 text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-brandNavy mb-2">Access Denied</h1>
          <p className="text-textBody mb-6">
            Only the student and the assigned writer can view this conversation.
          </p>
          <Link
            href="/dashboard/assignments"
            className="inline-block rounded-lg bg-brandBlue px-5 py-2.5 text-sm font-medium text-white hover:bg-brandAccent transition-colors"
          >
            Back to assignments
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  if (!assignment) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto bg-white rounded-xl border border-brandGrid p-8 text-center">
          <AlertCircle className="h-10 w-10 text-textMuted mx-auto mb-4" />
          <h1 className="text-xl font-bold text-brandNavy mb-2">Conversation unavailable</h1>
          <p className="text-textBody mb-6">{loadError || 'This assignment could not be loaded.'}</p>
          <Link
            href="/dashboard/assignments"
            className="inline-block rounded-lg bg-brandBlue px-5 py-2.5 text-sm font-medium text-white hover:bg-brandAccent transition-colors"
          >
            Back to assignments
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const isStudent = assignment.student_id === userId;
  const canReply = Boolean(assignment.assigned_writer_id);
  const counterpartRole = isStudent ? 'Writer' : 'Student';

  return (
    <DashboardLayout>
      <div className="mx-auto flex h-[calc(100vh-9rem)] min-h-[30rem] max-w-4xl flex-col overflow-hidden rounded-xl border border-brandGrid bg-white">
        {/* Conversation Header */}
        <div className="border-b border-brandGrid px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push(`/dashboard/assignments/${assignmentId}`)}
                className="rounded-lg p-2 text-textBody hover:bg-brandIce hover:text-brandBlue transition-colors"
                aria-label="Back to assignment"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              {otherParty ? (
                <div className="flex items-center gap-3">
                  {otherParty.avatar_url ? (
                    <img
                      src={otherParty.avatar_url}
                      alt={otherParty.full_name}
                      className="h-10 w-10 rounded-full object-cover border-2 border-brandGrid"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brandBlue/10">
                      <User className="h-5 w-5 text-brandBlue" />
                    </div>
                  )}
                  <div>
                    <h1 className="font-semibold text-brandNavy">{otherParty.full_name}</h1>
                    <p className="text-sm text-textMuted">{counterpartRole}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <h1 className="font-semibold text-brandNavy">No writer assigned yet</h1>
                  <p className="text-sm text-textMuted">Messaging opens once bidding closes</p>
                </div>
              )}
            </div>

            <div className="hidden text-right sm:block">
              <Link
                href={`/dashboard/assignments/${assignmentId}`}
                className="text-sm font-medium text-brandBlue hover:text-brandAccent"
              >
                {assignment.title}
              </Link>
              <p className="text-xs text-textMuted capitalize">
                {assignment.status?.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-brandIce px-4 py-5 sm:px-6">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <MessageSquare className="h-10 w-10 text-textMuted mb-3" />
              <p className="font-medium text-textDark">No messages yet</p>
              <p className="text-sm text-textBody">
                {canReply
                  ? `Start the conversation with the ${counterpartRole.toLowerCase()}.`
                  : 'A writer has not been assigned to this assignment yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => {
                const isOwn = message.sender_id === userId;
                return (
                  <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex max-w-2xl gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                      {!isOwn &&
                        (message.sender?.avatar_url ? (
                          <img
                            src={message.sender.avatar_url}
                            alt={message.sender.full_name || counterpartRole}
                            className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brandBlue/10">
                            <User className="h-4 w-4 text-brandBlue" />
                          </div>
                        ))}

                      <div>
                        <div
                          className={`rounded-2xl px-4 py-2 ${
                            isOwn
                              ? 'bg-brandBlue text-white'
                              : 'border border-brandGrid bg-white text-textDark'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
                        </div>
                        <p
                          className={`mt-1 text-xs text-textMuted ${isOwn ? 'text-right' : 'text-left'}`}
                        >
                          {formatTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-brandGrid px-4 py-4 sm:px-6">
          {sendError && (
            <p
              role="alert"
              className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700"
            >
              {sendError}
            </p>
          )}

          <form onSubmit={sendMessage}>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label htmlFor="messageInput" className="sr-only">
                  Message
                </label>
                <textarea
                  id="messageInput"
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  placeholder={canReply ? 'Type your message...' : 'Waiting for a writer to be assigned'}
                  rows={3}
                  maxLength={MAX_LENGTH}
                  disabled={!canReply}
                  className="w-full resize-none rounded-lg border border-brandGrid bg-white px-4 py-3 text-textDark placeholder:text-textMuted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brandBlue disabled:bg-brandIce disabled:cursor-not-allowed"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      sendMessage(event);
                    }
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={!canReply || sending || !newMessage.trim()}
                className="flex items-center gap-2 rounded-lg bg-brandBlue px-6 py-3 font-medium text-white transition-colors hover:bg-brandAccent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-solid border-white border-r-transparent" />
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    <span className="hidden sm:inline">Send</span>
                  </>
                )}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-textMuted">
              <span>Press Enter to send, Shift+Enter for a new line</span>
              <span>
                {newMessage.length}/{MAX_LENGTH}
              </span>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
