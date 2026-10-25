'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Send, Paperclip, ArrowLeft, User, Clock } from 'lucide-react';

export default function MessagesPage() {
  const { profile } = useAuth();
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.id;
  
  const [assignment, setAssignment] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherParty, setOtherParty] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (assignmentId && profile) {
      fetchAssignment();
      fetchMessages();
      
      // Subscribe to new messages
      const subscription = supabase
        .channel(`messages:${assignmentId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `assignment_id=eq.${assignmentId}`
        }, (payload) => {
          setMessages(prev => [...prev, payload.new]);
          scrollToBottom();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [assignmentId, profile]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchAssignment = async () => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          student:profiles!student_id(id, full_name, avatar_url),
          writer:profiles!assigned_writer_id(id, full_name, avatar_url)
        `)
        .eq('id', assignmentId)
        .single();

      if (error) throw error;

      setAssignment(data);
      
      // Determine the other party
      if (profile.user_type === 'student') {
        setOtherParty(data.writer);
      } else {
        setOtherParty(data.student);
      }
    } catch (error) {
      console.error('Error fetching assignment:', error);
      toast.error('Failed to load assignment');
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!sender_id(id, full_name, avatar_url)
        `)
        .eq('assignment_id', assignmentId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data || []);
      
      // Mark messages as read
      await markMessagesAsRead();
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('assignment_id', assignmentId)
        .eq('receiver_id', profile.id)
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setSending(true);

    try {
      const receiverId = profile.user_type === 'student' 
        ? assignment.assigned_writer_id 
        : assignment.student_id;

      const { error } = await supabase
        .from('messages')
        .insert([{
          assignment_id: assignmentId,
          sender_id: profile.id,
          receiver_id: receiverId,
          message: newMessage.trim()
        }]);

      if (error) throw error;

      setNewMessage('');
      toast.success('Message sent');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Less than 1 minute
    if (diff < 60000) return 'Just now';
    
    // Less than 1 hour
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins}m ago`;
    }
    
    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }
    
    // Show date
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brandBlue border-r-transparent" />
          <p className="mt-4 text-textBody">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-textBody">Assignment not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            
            {otherParty && (
              <div className="flex items-center gap-3">
                {otherParty.avatar_url ? (
                  <img
                    src={otherParty.avatar_url}
                    alt={otherParty.full_name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-brandBlue/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-brandBlue" />
                  </div>
                )}
                <div>
                  <h2 className="font-semibold text-brandNavy">{otherParty.full_name}</h2>
                  <p className="text-sm text-textMuted capitalize">
                    {profile.user_type === 'student' ? 'Writer' : 'Student'}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <div className="text-right">
            <p className="text-sm font-medium text-textDark">{assignment.title}</p>
            <p className="text-xs text-textMuted">Assignment ID: {assignmentId.slice(0, 8)}</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-textMuted">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.sender_id === profile.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-2xl ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    {!isOwn && msg.sender?.avatar_url ? (
                      <img
                        src={msg.sender.avatar_url}
                        alt={msg.sender.full_name}
                        className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : !isOwn ? (
                      <div className="h-8 w-8 rounded-full bg-brandBlue/10 flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-brandBlue" />
                      </div>
                    ) : null}
                    
                    {/* Message Bubble */}
                    <div>
                      <div
                        className={`rounded-2xl px-4 py-2 ${
                          isOwn
                            ? 'bg-brandBlue text-white'
                            : 'bg-white text-textDark border border-gray-200'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      </div>
                      <div className={`flex items-center gap-1 mt-1 text-xs text-textMuted ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <Clock className="h-3 w-3" />
                        <span>{formatTime(msg.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <form onSubmit={sendMessage} className="max-w-4xl mx-auto">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brandBlue focus:border-transparent resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(e);
                  }
                }}
              />
            </div>
            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="flex items-center gap-2 bg-brandBlue text-white px-6 py-3 rounded-lg hover:bg-brandAccent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-solid border-white border-r-transparent" />
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  <span>Send</span>
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-textMuted mt-2">Press Enter to send, Shift+Enter for new line</p>
        </form>
      </div>
    </div>
  );
}
