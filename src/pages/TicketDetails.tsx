import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { Ticket as TicketType, TicketStatus, TicketPriority, TicketCategory, MessageType } from '../lib/types';

interface Profile {
  id: string;
  full_name: string;
  phone?: string;
  role: string;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  content: string;
  message_type: MessageType;
  created_by: string;
  created_at: string;
  created_by_profile?: Profile;
  attachments?: TicketAttachment[];
}

interface TicketAttachment {
  id: string;
  ticket_id: string;
  message_id?: string;
  file_name: string;
  file_url: string;
  created_at: string;
}

interface TicketWithProfiles extends TicketType {
  assigned_to_profile?: Profile;
  created_by_profile?: Profile;
}

export default function TicketDetails() {
  const { ticketId } = useParams();
  const { user, profile } = useAuth();
  const [ticket, setTicket] = useState<TicketWithProfiles | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('public');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    async function loadTicketDetails() {
      if (!ticketId) return;

      const [ticketResult, messagesResult] = await Promise.all([
        supabase
          .from('tickets')
          .select(`
            *,
            assigned_to_profile:profiles!tickets_assigned_to_fkey(
              id,
              full_name,
              phone,
              role
            ),
            created_by_profile:profiles!tickets_created_by_fkey(
              id,
              full_name,
              phone,
              role
            )
          `)
          .eq('id', ticketId)
          .single(),
        
        supabase
          .from('ticket_messages')
          .select(`
            *,
            created_by_profile:profiles(
              id,
              full_name,
              phone,
              role
            ),
            attachments:ticket_attachments(*)
          `)
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true })
      ]);

      if (ticketResult.data) {
        setTicket(ticketResult.data as TicketWithProfiles);
      }

      if (messagesResult.data) {
        setMessages(messagesResult.data as TicketMessage[]);
      }

      setLoading(false);
    }

    loadTicketDetails();
  }, [ticketId]);

  // Get the correct dashboard route based on user role
  const getDashboardRoute = () => {
    if (!profile) return '/login';
    switch (profile.role) {
      case 'admin':
        return '/admin';
      case 'agent':
        return '/agent';
      case 'user':
        return '/dashboard';
      default:
        return '/dashboard';
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    setSendingMessage(true);
    
    try {
      const { data, error } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticketId,
          content: newMessage,
          message_type: messageType,
          created_by: user?.id
        })
        .select(`
          *,
          created_by_profile:profiles(
            id,
            full_name,
            phone,
            role
          ),
          attachments:ticket_attachments(*)
        `);
        
      if (error) throw error;

      if (data && data[0]) {
        setMessages(prev => [...prev, data[0] as TicketMessage]);
        setNewMessage('');
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      setError('Error sending message: ' + error.message);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!ticket || !ticketId) return;
    
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: newStatus })
        .eq('id', ticketId);

      if (error) throw error;

      setTicket(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (error: any) {
      console.error('Error updating status:', error);
      setError('Error updating status: ' + error.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-4">
        <div className="text-red-600">Ticket not found</div>
      </div>
    );
  }

  const canUpdateTicket = profile?.role === 'admin' || profile?.role === 'agent';

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Navigation */}
      <div className="mb-6">
        <Link
          to={getDashboardRoute()}
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      {/* Ticket Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold mb-2">{ticket.subject}</h1>
            <div className="flex gap-4 text-sm text-gray-600">
              <span>Created {format(new Date(ticket.created_at), 'PPp')}</span>
              <span>•</span>
              <span className="capitalize">Status: {ticket.status}</span>
              <span>•</span>
              <span className="capitalize">Priority: {ticket.priority}</span>
              <span>•</span>
              <span className="capitalize">Category: {ticket.category}</span>
            </div>
          </div>
          {canUpdateTicket && (
            <div className="flex gap-2">
              <div className="relative">
                <button
                  disabled={updatingStatus}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {updatingStatus ? 'Updating...' : 'Update Status'}
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 hidden group-hover:block">
                  <div className="py-1">
                    {(['open', 'in_progress', 'resolved', 'closed'] as TicketStatus[]).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 capitalize"
                      >
                        {status.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                Assign
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Messages Thread */}
        <div className="col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Messages</h2>
            <div className="space-y-6">
              {messages.map((message) => (
                <div 
                  key={message.id} 
                  className={`border-b pb-4 last:border-b-0 ${
                    message.message_type === 'internal' ? 'bg-yellow-50 -mx-6 px-6' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">
                          {message.created_by_profile?.full_name}
                        </span>
                        <span className="text-sm text-gray-500">
                          {format(new Date(message.created_at), 'PPp')}
                        </span>
                        {message.message_type === 'internal' && (
                          <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">
                            Internal Note
                          </span>
                        )}
                        {message.message_type === 'system' && (
                          <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">
                            System
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{message.content}</p>
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2">
                          <div className="text-sm text-gray-500">Attachments:</div>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {message.attachments.map((attachment) => (
                              <a
                                key={attachment.id}
                                href={attachment.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-sm"
                              >
                                {attachment.file_name}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* New Message Form */}
            <div className="mt-6">
              <div className="flex gap-4 mb-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="messageType"
                    value="public"
                    checked={messageType === 'public'}
                    onChange={(e) => setMessageType(e.target.value as MessageType)}
                    className="mr-2"
                  />
                  Public Reply
                </label>
                {canUpdateTicket && (
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="messageType"
                      value="internal"
                      checked={messageType === 'internal'}
                      onChange={(e) => setMessageType(e.target.value as MessageType)}
                      className="mr-2"
                    />
                    Internal Note
                  </label>
                )}
              </div>
              <textarea
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                placeholder={messageType === 'internal' ? "Add an internal note..." : "Type your message..."}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={sendingMessage}
              />
              <div className="flex justify-between mt-2">
                <button 
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                  disabled={sendingMessage}
                >
                  Attach Files
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !newMessage.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {sendingMessage ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </>
                  ) : (
                    messageType === 'internal' ? 'Add Note' : 'Send Message'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Details */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Customer Details</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-500">Name</label>
                <div>{ticket.created_by_profile?.full_name}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Phone</label>
                <div>{ticket.created_by_profile?.phone || 'Not provided'}</div>
              </div>
            </div>
          </div>

          {/* Ticket Properties */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Ticket Properties</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-500">Category</label>
                <div className="capitalize">{ticket.category}</div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Assigned To</label>
                <div>
                  {ticket.assigned_to_profile?.full_name || 'Unassigned'}
                </div>
              </div>
              {ticket.tags && ticket.tags.length > 0 && (
                <div>
                  <label className="text-sm text-gray-500">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {ticket.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-gray-100 rounded-full text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 