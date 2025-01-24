import { useParams, Link } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
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
  file_type?: string;
}

interface TicketWithProfiles extends TicketType {
  assigned_to_profile?: Profile;
  created_by_profile?: Profile;
}

interface AgentOrganizationWithProfile {
  agent_id: string;
  profiles: {
    id: string;
    full_name: string;
    role: string;
  };
}

interface UploadedFile {
  file_name: string;
  file_url: string;
}

// Add helper function to get file type
const getFileType = (fileName: string): 'image' | 'pdf' | 'other' => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
    return 'image';
  }
  if (extension === 'pdf') {
    return 'pdf';
  }
  return 'other';
};

// Add helper function to get signed URL
const getSignedUrl = async (filePath: string) => {
  const { data, error } = await supabase.storage
    .from('attachments')
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  if (error || !data) {
    console.error('Error getting signed URL:', error);
    return null;
  }

  return data.signedUrl;
};

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
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [agents, setAgents] = useState<Profile[]>([]);
  const [assigningTo, setAssigningTo] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [ticketAttachments, setTicketAttachments] = useState<TicketAttachment[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);

  useEffect(() => {
    async function loadTicketDetails() {
      if (!ticketId) return;

      const [ticketResult, messagesResult, attachmentsResult] = await Promise.all([
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
            id,
            ticket_id,
            content,
            message_type,
            created_by,
            created_at,
            created_by_profile:profiles(
              id,
              full_name,
              phone,
              role
            )
          `)
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true }),

        supabase
          .from('ticket_attachments')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: false })
      ]);

      if (ticketResult.data) {
        setTicket(ticketResult.data as TicketWithProfiles);
      }

      if (messagesResult.data) {
        const typedMessages = messagesResult.data.map(msg => ({
          ...msg,
          created_by_profile: Array.isArray(msg.created_by_profile) 
            ? msg.created_by_profile[0] 
            : msg.created_by_profile
        })) as TicketMessage[];
        setMessages(typedMessages);
      }

      if (attachmentsResult.data) {
        setTicketAttachments(attachmentsResult.data);
      }

      setLoading(false);
    }

    loadTicketDetails();
  }, [ticketId]);

  // Load agents for the organization
  useEffect(() => {
    async function loadAgents() {
      if (!ticket?.organization_id) return;

      const { data, error } = await supabase
        .from('agent_organizations')
        .select(`
          agent_id,
          profiles:agent_id(
            id,
            full_name,
            role,
            phone
          )
        `)
        .eq('organization_id', ticket.organization_id);

      if (!error && data) {
        // Extract agent profiles from the response
        const profiles: Profile[] = [];
        for (const item of data) {
          const profile = item.profiles as unknown as { id: string; full_name: string; role: string; phone?: string };
          if (profile) {
            profiles.push({
              id: profile.id,
              full_name: profile.full_name,
              role: profile.role,
              phone: profile.phone
            });
          }
        }
        setAgents(profiles);
      }
    }

    loadAgents();
  }, [ticket?.organization_id]);

  // Add effect to get signed URLs for attachments
  useEffect(() => {
    async function getSignedUrls() {
      const urls: Record<string, string> = {};
      for (const attachment of ticketAttachments) {
        const filePath = attachment.file_url.split('/').slice(-2).join('/');
        const signedUrl = await getSignedUrl(filePath);
        if (signedUrl) {
          urls[attachment.id] = signedUrl;
        }
      }
      setSignedUrls(urls);
    }

    if (ticketAttachments.length > 0) {
      getSignedUrls();
    }
  }, [ticketAttachments]);

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
    setError(null);
    
    try {
      // Create message
      const { data: messageData, error: messageError } = await supabase
        .from('ticket_messages')
        .insert([{
          ticket_id: ticketId,
          content: newMessage,
          message_type: messageType,
          created_by: user?.id
        }])
        .select(`
          id,
          ticket_id,
          content,
          message_type,
          created_by,
          created_at,
          created_by_profile:profiles!ticket_messages_created_by_fkey(
            id,
            full_name,
            phone,
            role
          )
        `)
        .single();

      if (messageError) throw messageError;

      if (messageData) {
        const typedMessage = {
          ...messageData,
          created_by_profile: Array.isArray(messageData.created_by_profile) 
            ? messageData.created_by_profile[0] 
            : messageData.created_by_profile,
        } as unknown as TicketMessage;
        setMessages(prev => [...prev, typedMessage]);
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

  const handleAssign = async (agentId: string) => {
    if (!ticket || !ticketId) return;
    
    setAssigningTo(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ assigned_to: agentId })
        .eq('id', ticketId);

      if (error) throw error;

      // Update local state
      const updatedTicket = { ...ticket };
      const assignedAgent = agents.find(agent => agent.id === agentId);
      if (assignedAgent) {
        updatedTicket.assigned_to_profile = assignedAgent;
      }
      setTicket(updatedTicket);
      setShowAssignDropdown(false);
    } catch (error: any) {
      console.error('Error assigning ticket:', error);
      setError('Error assigning ticket: ' + error.message);
    } finally {
      setAssigningTo(false);
    }
  };

  const handleFileSelect = (files: FileList) => {
    setSelectedFiles(prev => [...prev, ...Array.from(files)]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAttachmentUpload = async (files: FileList) => {
    setUploadingFiles(true);
    setError(null);
    
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${ticketId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get signed URL instead of public URL
        const signedUrl = await getSignedUrl(filePath);
        if (!signedUrl) throw new Error('Failed to get signed URL');

        // Create attachment record
        const { data: attachment, error: attachmentError } = await supabase
          .from('ticket_attachments')
          .insert([{
            ticket_id: ticketId,
            file_name: file.name,
            file_url: `${ticketId}/${fileName}` // Store relative path
          }])
          .select()
          .single();

        if (attachmentError) throw attachmentError;

        // Update signed URLs state
        setSignedUrls(prev => ({
          ...prev,
          [attachment.id]: signedUrl
        }));

        return attachment;
      });

      const newAttachments = await Promise.all(uploadPromises);
      setTicketAttachments(prev => [...newAttachments, ...prev]);
    } catch (error: any) {
      console.error('Error uploading attachments:', error);
      setError('Error uploading attachments: ' + error.message);
    } finally {
      setUploadingFiles(false);
    }
  };

  const handlePriorityChange = async (newPriority: TicketPriority) => {
    if (!ticket || !ticketId) return;
    
    setUpdatingPriority(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ priority: newPriority })
        .eq('id', ticketId);

      if (error) throw error;

      setTicket(prev => prev ? { ...prev, priority: newPriority } : null);
    } catch (error: any) {
      console.error('Error updating priority:', error);
      setError('Error updating priority: ' + error.message);
    } finally {
      setUpdatingPriority(false);
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
              <div className="relative group">
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  disabled={updatingStatus}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 font-medium"
                >
                  {updatingStatus ? 'Updating...' : (
                    <>
                      Update Status
                      <svg className="ml-2 -mr-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </>
                  )}
                </button>
                {showStatusDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-indigo-600 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-10">
                    <div className="py-1">
                      {(['open', 'in_progress', 'closed'] as TicketStatus[]).map((status) => (
                        <button
                          key={status}
                          onClick={() => {
                            handleStatusChange(status);
                            setShowStatusDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-white hover:bg-indigo-700 flex items-center space-x-2"
                        >
                          <span className={`w-2 h-2 rounded-full ${
                            status === 'open' ? 'bg-green-300' :
                            status === 'in_progress' ? 'bg-yellow-300' :
                            'bg-gray-300'
                          }`} />
                          <span className="capitalize text-white">{status.replace('_', ' ')}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="relative group">
                <button
                  onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                  disabled={updatingPriority}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 font-medium"
                >
                  {updatingPriority ? 'Updating...' : (
                    <>
                      Update Priority
                      <svg className="ml-2 -mr-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </>
                  )}
                </button>
                {showPriorityDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-indigo-600 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-10">
                    <div className="py-1">
                      {(['low', 'medium', 'high'] as TicketPriority[]).map((priority) => (
                        <button
                          key={priority}
                          onClick={() => {
                            handlePriorityChange(priority);
                            setShowPriorityDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-white hover:bg-indigo-700 flex items-center space-x-2"
                        >
                          <span className={`w-2 h-2 rounded-full ${
                            priority === 'high' ? 'bg-red-300' :
                            priority === 'medium' ? 'bg-yellow-300' :
                            'bg-green-300'
                          }`} />
                          <span className="capitalize text-white">{priority}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                  disabled={assigningTo}
                  className="inline-flex items-center px-4 py-2 bg-white border border-indigo-300 text-indigo-700 rounded hover:bg-indigo-50 disabled:opacity-50 font-medium"
                >
                  {assigningTo ? 'Assigning...' : (
                    <>
                      Assign
                      <svg className="ml-2 -mr-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </>
                  )}
                </button>
                {showAssignDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-indigo-600 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-10">
                    <div className="py-1">
                      {agents.map((agent) => (
                        <button
                          key={agent.id}
                          onClick={() => handleAssign(agent.id)}
                          className="w-full text-left px-4 py-2 text-sm text-white hover:bg-indigo-700 flex items-center space-x-2"
                        >
                          <svg className="h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                          </svg>
                          <span className="text-white">{agent.full_name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Customer Info and Properties Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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

      {/* Messages Thread */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Messages</h2>
        <div className="space-y-6">
          {messages
            .filter(message => {
              // Only show internal messages to agents and admins
              if (message.message_type === 'internal') {
                return profile?.role === 'admin' || profile?.role === 'agent';
              }
              return true;
            })
            .map((message) => {
              console.log('Rendering message:', {
                id: message.id,
                hasAttachments: !!message.attachments,
                attachmentsLength: message.attachments?.length,
                attachments: message.attachments
              });
              return (
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
                          <div className="text-sm text-gray-500 mb-1">Attachments:</div>
                          <div className="flex flex-wrap gap-2">
                            {message.attachments.map((attachment) => (
                              <a
                                key={attachment.id}
                                href={attachment.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                              >
                                <svg className="h-4 w-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                {attachment.file_name}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Message Input Form */}
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
          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-2"
          rows={4}
          placeholder={messageType === 'internal' ? "Add an internal note..." : "Type your message..."}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          disabled={sendingMessage}
        />
        <div className="flex justify-end mt-2">
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

      {/* Attachments Section */}
      <div className="col-span-2">
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Attachments</h2>
            <button 
              onClick={() => attachmentInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center"
              disabled={uploadingFiles}
            >
              {uploadingFiles ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                <>
                  <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Files
                </>
              )}
            </button>
            <input
              type="file"
              ref={attachmentInputRef}
              onChange={(e) => e.target.files && handleAttachmentUpload(e.target.files)}
              className="hidden"
              multiple
            />
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {ticketAttachments.map((attachment) => {
              const fileType = getFileType(attachment.file_name);
              const signedUrl = signedUrls[attachment.id];

              return (
                <a
                  key={attachment.id}
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group p-4 border rounded-lg hover:border-blue-500 transition-colors"
                >
                  <div className="flex items-center justify-center h-32 mb-2">
                    {fileType === 'image' && signedUrl ? (
                      <img
                        src={signedUrl}
                        alt={attachment.file_name}
                        className="max-h-full max-w-full object-contain rounded"
                      />
                    ) : fileType === 'pdf' ? (
                      <svg className="h-16 w-16 text-red-400 group-hover:text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      <svg className="h-16 w-16 text-gray-400 group-hover:text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    )}
                  </div>
                  <div className="text-sm text-center">
                    <div className="font-medium text-gray-900 truncate group-hover:text-blue-600">
                      {attachment.file_name}
                    </div>
                    <div className="text-gray-500 text-xs mt-1">
                      {format(new Date(attachment.created_at), 'PPp')}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
} 