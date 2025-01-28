import { useParams, Link } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { Ticket as TicketType, TicketStatus, TicketPriority, MessageType, OrgRole } from '../lib/types';
import Logo from '../components/Logo';
import '../styles/animations.css';

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

interface OrganizationUser {
  user_id: string;
  role: OrgRole;
  status: string;
}

interface TicketWithProfiles extends TicketType {
  assigned_to_profile?: Profile;
  created_by_profile?: Profile;
  ticket_attachments: TicketAttachment[];
  organization_users?: OrganizationUser[];
}

interface AuditLogEntry {
  id: string;
  ticket_id: string;
  event_type: string;
  from_value: string | null;
  to_value: string;
  created_by: string;
  created_at: string;
  created_by_profile?: Profile;
  from_profile?: Profile;
  to_profile?: Profile;
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

// Add this helper function after the interfaces
const canUpdateTicket = (profile: Profile | null, ticket: TicketWithProfiles | null): boolean => {
  if (!profile || !ticket) return false;

  // System admins and agents can always update
  if (profile.role === 'admin' || profile.role === 'agent') return true;

  // Organization owners and admins can update if they have an accepted status
  return ticket.organization_users?.some(
    (u: OrganizationUser) => 
      u.user_id === profile.id && 
      (u.role === 'owner' || u.role === 'admin') &&
      u.status === 'accepted'
  ) || false;
};

// Add helper function after canUpdateTicket function
const canViewInternalNotes = (profile: Profile | null, ticket: TicketWithProfiles | null): boolean => {
  if (!profile || !ticket) return false;

  // System admins and agents can always view internal notes
  if (profile.role === 'admin' || profile.role === 'agent') return true;

  // Organization owners and admins can view internal notes if they have an accepted status
  return ticket.organization_users?.some(
    (u: OrganizationUser) => 
      u.user_id === profile.id && 
      (u.role === 'owner' || u.role === 'admin') &&
      u.status === 'accepted'
  ) || false;
};

export default function TicketDetails() {
  const { ticketId } = useParams();
  const { profile } = useAuth();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [messageType, setMessageType] = useState<MessageType>('public');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ticket, setTicket] = useState<TicketWithProfiles | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<Profile[]>([]);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const priorityDropdownRef = useRef<HTMLDivElement>(null);
  const assignDropdownRef = useRef<HTMLDivElement>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Add click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setShowStatusModal(false);
      }
      if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(event.target as Node)) {
        setShowPriorityModal(false);
      }
      if (assignDropdownRef.current && !assignDropdownRef.current.contains(event.target as Node)) {
        setShowAssignModal(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    async function loadTicketDetails() {
      if (!ticketId) return;

      // First get the ticket data
      const { data: ticketData, error: ticketError } = await supabase
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
        .single();

      if (ticketError) {
        console.error('Error fetching ticket:', ticketError);
        return;
      }

      // Then get the rest of the data
      const [messagesResult, attachmentsResult, auditLogsResult, orgUsersResult] = await Promise.all([
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
          .order('created_at', { ascending: false }),

        supabase
          .from('audit_log')
          .select(`
            *,
            created_by_profile:profiles(
              id,
              full_name,
              phone,
              role
            )
          `)
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: false }),

        supabase
          .from('organization_users')
          .select('user_id, role, status')
          .eq('organization_id', ticketData.organization_id)
      ]);

      if (ticketData) {
        setTicket({
          ...ticketData,
          organization_users: orgUsersResult.data || [],
          ticket_attachments: attachmentsResult.data || []
        } as TicketWithProfiles);
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

      if (auditLogsResult.data) {
        const typedAuditLogs = await Promise.all(auditLogsResult.data.map(async log => {
          const processedLog = {
            ...log,
            created_by_profile: Array.isArray(log.created_by_profile) 
              ? log.created_by_profile[0] 
              : log.created_by_profile
          };

          // Fetch profile information for assignment changes
          if (log.event_type === 'assignment_change') {
            if (log.from_value) {
              const { data: fromProfile } = await supabase
                .from('profiles')
                .select('id, full_name, phone, role')
                .eq('id', log.from_value)
                .single();
              processedLog.from_profile = fromProfile;
            }
            
            if (log.to_value) {
              const { data: toProfile } = await supabase
                .from('profiles')
                .select('id, full_name, phone, role')
                .eq('id', log.to_value)
                .single();
              processedLog.to_profile = toProfile;
            }
          }

          return processedLog as AuditLogEntry;
        }));
        setAuditLogs(typedAuditLogs);
      }

      setLoading(false);
    }

    loadTicketDetails();
  }, [ticketId]);

  // Load agents for the organization
  useEffect(() => {
    async function loadAgents() {
      if (!ticket?.organization_id) return;

      // Get agents from organization_users table (admins and agents)
      const { data: orgUsers, error: orgUsersError } = await supabase
        .from('organization_users')
        .select(`
          user_id,
          role,
          profile:profiles(
            id,
            full_name,
            role,
            phone
          )
        `)
        .eq('organization_id', ticket.organization_id)
        .eq('status', 'accepted')
        .in('role', ['admin', 'owner']);

      console.log('Org users query result:', { orgUsers, orgUsersError });

      if (!orgUsersError && orgUsers) {
        // Extract agent profiles
        const orgProfiles: Profile[] = [];
        for (const item of orgUsers) {
          const profile = item.profile as unknown as { id: string; full_name: string; role: string; phone?: string };
          if (profile) {
            orgProfiles.push({
              id: profile.id,
              full_name: profile.full_name,
              role: profile.role,
              phone: profile.phone
            });
          }
        }
        setAvailableAgents(orgProfiles);
      } else if (orgUsersError) {
        console.error('Error loading agents:', orgUsersError);
      }
    }

    loadAgents();
  }, [ticket?.organization_id]);

  // Add effect to get signed URLs for attachments
  useEffect(() => {
    async function getSignedUrls() {
      const urls: Record<string, string> = {};
      for (const attachment of ticket?.ticket_attachments || []) {
        const filePath = attachment.file_url;
        const signedUrl = await getSignedUrl(filePath);
        if (signedUrl) {
          urls[attachment.id] = signedUrl;
        }
      }
      setSignedUrls(urls);
    }

    if (ticket?.ticket_attachments && ticket.ticket_attachments.length > 0) {
      getSignedUrls();
    }
  }, [ticket?.ticket_attachments]);

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
    
    setSaving(true);
    try {
      // Create message
      const { data: messageData, error: messageError } = await supabase
        .from('ticket_messages')
        .insert([{
          ticket_id: ticketId,
          content: newMessage,
          message_type: messageType,
          created_by: profile?.id
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
      // Assuming setError is called elsewhere in the code
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!ticket || !ticketId || !profile?.id || !canUpdateTicket(profile, ticket)) return;
    setSaving(true);
    try {
      // First update the ticket status
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      // Then create the audit log entry
      const { error: auditError } = await supabase
        .from('audit_log')
        .insert([{
          ticket_id: ticketId,
          event_type: 'status_change',
          from_value: ticket.status,
          to_value: newStatus,
          user_id: profile.id,
          created_at: new Date().toISOString()
        }]);

      if (auditError) {
        console.error('Error creating audit log:', auditError);
      }

      // Fetch updated ticket data to refresh the UI
      const { data: updatedTicket, error: fetchError } = await supabase
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
        .single();

      if (fetchError) throw fetchError;

      // Get organization users for permission check
      const { data: orgUsers } = await supabase
        .from('organization_users')
        .select('user_id, role, status')
        .eq('organization_id', ticket.organization_id);

      // Fetch updated audit logs
      const { data: newAuditLogs, error: auditFetchError } = await supabase
        .from('audit_log')
        .select(`
          *,
          created_by_profile:profiles(
            id,
            full_name,
            phone,
            role
          )
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });

      if (!auditFetchError && newAuditLogs) {
        const typedAuditLogs = await Promise.all(newAuditLogs.map(async log => {
          const processedLog = {
            ...log,
            created_by_profile: Array.isArray(log.created_by_profile) 
              ? log.created_by_profile[0] 
              : log.created_by_profile
          };

          if (log.event_type === 'assignment_change') {
            if (log.from_value) {
              const { data: fromProfile } = await supabase
                .from('profiles')
                .select('id, full_name, phone, role')
                .eq('id', log.from_value)
                .single();
              processedLog.from_profile = fromProfile;
            }
            
            if (log.to_value) {
              const { data: toProfile } = await supabase
                .from('profiles')
                .select('id, full_name, phone, role')
                .eq('id', log.to_value)
                .single();
              processedLog.to_profile = toProfile;
            }
          }

          return processedLog as AuditLogEntry;
        }));
        setAuditLogs(typedAuditLogs);
      }

      // Combine the ticket data with organization users
      const updatedTicketWithOrgUsers = {
        ...updatedTicket,
        organization_users: orgUsers || []
      };

      setTicket(updatedTicketWithOrgUsers as TicketWithProfiles);
      setShowStatusModal(false);
    } catch (error: any) {
      console.error('Error updating ticket status:', error);
    } finally {
      setSaving(false);
    }
  };

  const handlePriorityChange = async (newPriority: TicketPriority) => {
    if (!ticket || !ticketId || !profile?.id || !canUpdateTicket(profile, ticket)) return;
    setSaving(true);
    try {
      // First update the ticket priority
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ 
          priority: newPriority,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      // Then create the audit log entry
      const { error: auditError } = await supabase
        .from('audit_log')
        .insert([{
          ticket_id: ticketId,
          event_type: 'priority_change',
          from_value: ticket.priority,
          to_value: newPriority,
          user_id: profile.id,
          created_at: new Date().toISOString()
        }]);

      if (auditError) {
        console.error('Error creating audit log:', auditError);
      }

      // Fetch updated ticket data to refresh the UI
      const { data: updatedTicket, error: fetchError } = await supabase
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
        .single();

      if (fetchError) throw fetchError;

      // Get organization users for permission check
      const { data: orgUsers } = await supabase
        .from('organization_users')
        .select('user_id, role, status')
        .eq('organization_id', ticket.organization_id);

      // Fetch updated audit logs
      const { data: newAuditLogs, error: auditFetchError } = await supabase
        .from('audit_log')
        .select(`
          *,
          created_by_profile:profiles(
            id,
            full_name,
            phone,
            role
          )
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });

      if (!auditFetchError && newAuditLogs) {
        const typedAuditLogs = await Promise.all(newAuditLogs.map(async log => {
          const processedLog = {
            ...log,
            created_by_profile: Array.isArray(log.created_by_profile) 
              ? log.created_by_profile[0] 
              : log.created_by_profile
          };

          if (log.event_type === 'assignment_change') {
            if (log.from_value) {
              const { data: fromProfile } = await supabase
                .from('profiles')
                .select('id, full_name, phone, role')
                .eq('id', log.from_value)
                .single();
              processedLog.from_profile = fromProfile;
            }
            
            if (log.to_value) {
              const { data: toProfile } = await supabase
                .from('profiles')
                .select('id, full_name, phone, role')
                .eq('id', log.to_value)
                .single();
              processedLog.to_profile = toProfile;
            }
          }

          return processedLog as AuditLogEntry;
        }));
        setAuditLogs(typedAuditLogs);
      }

      // Combine the ticket data with organization users
      const updatedTicketWithOrgUsers = {
        ...updatedTicket,
        organization_users: orgUsers || []
      };

      setTicket(updatedTicketWithOrgUsers as TicketWithProfiles);
      setShowPriorityModal(false);
    } catch (error: any) {
      console.error('Error updating ticket priority:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async (agentId: string) => {
    if (!ticket || !ticketId || !profile?.id || !canUpdateTicket(profile, ticket)) return;
    setSaving(true);
    try {
      // First update the ticket assignment
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ 
          assigned_to: agentId,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      // Then create the audit log entry
      const { error: auditError } = await supabase
        .from('audit_log')
        .insert([{
          ticket_id: ticketId,
          event_type: 'assignment_change',
          from_value: ticket.assigned_to || null,
          to_value: agentId,
          user_id: profile.id,
          created_at: new Date().toISOString()
        }]);

      if (auditError) {
        console.error('Error creating audit log:', auditError);
      }

      // Fetch updated ticket data to refresh the UI
      const { data: updatedTicket, error: fetchError } = await supabase
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
        .single();

      if (fetchError) throw fetchError;

      // Get organization users for permission check
      const { data: orgUsers } = await supabase
        .from('organization_users')
        .select('user_id, role, status')
        .eq('organization_id', ticket.organization_id);

      // Fetch updated audit logs
      const { data: newAuditLogs, error: auditFetchError } = await supabase
        .from('audit_log')
        .select(`
          *,
          created_by_profile:profiles(
            id,
            full_name,
            phone,
            role
          )
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });

      if (!auditFetchError && newAuditLogs) {
        const typedAuditLogs = await Promise.all(newAuditLogs.map(async log => {
          const processedLog = {
            ...log,
            created_by_profile: Array.isArray(log.created_by_profile) 
              ? log.created_by_profile[0] 
              : log.created_by_profile
          };

          if (log.event_type === 'assignment_change') {
            if (log.from_value) {
              const { data: fromProfile } = await supabase
                .from('profiles')
                .select('id, full_name, phone, role')
                .eq('id', log.from_value)
                .single();
              processedLog.from_profile = fromProfile;
            }
            
            if (log.to_value) {
              const { data: toProfile } = await supabase
                .from('profiles')
                .select('id, full_name, phone, role')
                .eq('id', log.to_value)
                .single();
              processedLog.to_profile = toProfile;
            }
          }

          return processedLog as AuditLogEntry;
        }));
        setAuditLogs(typedAuditLogs);
      }

      // Combine the ticket data with organization users
      const updatedTicketWithOrgUsers = {
        ...updatedTicket,
        organization_users: orgUsers || []
      };

      setTicket(updatedTicketWithOrgUsers as TicketWithProfiles);
      setShowAssignModal(false);
    } catch (error: any) {
      console.error('Error assigning ticket:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAttachmentUpload = async (files: FileList) => {
    setSaving(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${ticketId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const signedUrl = await getSignedUrl(filePath);
        if (!signedUrl) throw new Error('Failed to get signed URL');

        const { data: attachment, error: attachmentError } = await supabase
          .from('ticket_attachments')
          .insert([{
            ticket_id: ticketId,
            file_name: file.name,
            file_url: `${ticketId}/${fileName}`
          }])
          .select()
          .single();

        if (attachmentError) throw attachmentError;

        return attachment;
      });

      const newAttachments = await Promise.all(uploadPromises);
      setTicket(prev => prev ? {
        ...prev,
        ticket_attachments: [...newAttachments, ...(prev.ticket_attachments || [])]
      } : null);
    } catch (error: any) {
      console.error('Error uploading attachments:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900 relative overflow-hidden">
      {/* Tech-inspired background patterns */}
      <div className="absolute inset-0 z-0 opacity-30">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        <div className="absolute h-screen w-screen bg-[linear-gradient(to_right,rgba(55,65,81,0)_1px,transparent_1px),linear-gradient(to_bottom,rgba(55,65,81,0)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]"></div>
      </div>

      {/* Animated gradients */}
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-r from-blue-500/30 to-cyan-500/30 rounded-full mix-blend-screen filter blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-full mix-blend-screen filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-indigo-500/30 to-blue-500/30 rounded-full mix-blend-screen filter blur-3xl opacity-50 animate-pulse"></div>
      </div>

      {/* Navbar */}
      <div className="relative z-10">
        <nav className="bg-black/30 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Link to={getDashboardRoute()}>
                    <Logo size="small" />
                  </Link>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <Link
                  to={getDashboardRoute()}
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-black/30 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-4 text-gray-300">Loading ticket details...</p>
            </div>
          ) : ticket ? (
            <div className="divide-y divide-white/10">
              {/* Ticket Header */}
              <div className="p-6">
                <h1 className="text-3xl font-bold text-white mb-6">{ticket.subject}</h1>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-300 mb-6">
                  <div>
                    <span className="font-medium">Created at:</span>{' '}
                    {format(new Date(ticket.created_at), 'MMM d, yyyy h:mm a')}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>{' '}
                    <span className="capitalize">{ticket.status}</span>
                  </div>
                  <div>
                    <span className="font-medium">Priority:</span>{' '}
                    <span className="capitalize">{ticket.priority}</span>
                  </div>
                  <div>
                    <span className="font-medium">Category:</span>{' '}
                    <span className="capitalize">{ticket.category}</span>
                  </div>
                </div>

                {/* Action Buttons - Visible to admin, agent, and org owners/admins */}
                {(profile?.role === 'admin' || 
                  profile?.role === 'agent' || 
                  (profile?.id && ticket?.organization_users?.some(
                    (u: OrganizationUser) => 
                      u.user_id === profile.id && 
                      (u.role === 'owner' || u.role === 'admin') &&
                      u.status === 'accepted'
                  ))
                ) && (
                  <div className="flex flex-wrap gap-4">
                    {/* Status Dropdown */}
                    <div className="relative" ref={statusDropdownRef}>
                      <button
                        onClick={() => setShowStatusModal(!showStatusModal)}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-black/40 border border-white/10 text-gray-200 hover:bg-black/60 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Update Status
                      </button>
                      {showStatusModal && (
                        <div className="absolute left-0 mt-2 w-56 bg-indigo-600 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-10">
                          <div className="py-1">
                            {(['open', 'in_progress', 'closed'] as TicketStatus[]).map((status) => (
                              <button
                                key={status}
                                onClick={() => handleStatusChange(status)}
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

                    {/* Priority Dropdown */}
                    <div className="relative" ref={priorityDropdownRef}>
                      <button
                        onClick={() => setShowPriorityModal(!showPriorityModal)}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-black/40 border border-white/10 text-gray-200 hover:bg-black/60 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Update Priority
                      </button>
                      {showPriorityModal && (
                        <div className="absolute left-0 mt-2 w-56 bg-indigo-600 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-10">
                          <div className="py-1">
                            {(['low', 'medium', 'high'] as TicketPriority[]).map((priority) => (
                              <button
                                key={priority}
                                onClick={() => handlePriorityChange(priority)}
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

                    {/* Assign Dropdown */}
                    <div className="relative" ref={assignDropdownRef}>
                      <button
                        onClick={() => setShowAssignModal(!showAssignModal)}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-black/40 border border-white/10 text-gray-200 hover:bg-black/60 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Assign Ticket
                      </button>
                      {showAssignModal && (
                        <div className="absolute left-0 mt-2 w-56 bg-indigo-600 rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-10">
                          <div className="py-1">
                            {availableAgents.map((agent) => (
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

              {/* Customer and Agent Details */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Customer Details */}
                  <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                    <h3 className="text-lg font-semibold text-white mb-4">Customer Details</h3>
                    <div className="space-y-2 text-gray-300">
                  <div>
                        <span className="font-medium">Name:</span>{' '}
                    {ticket.created_by_profile?.full_name}
                  </div>
                  <div>
                        <span className="font-medium">Phone:</span>{' '}
                        {ticket.created_by_profile?.phone || 'Not provided'}
                  </div>
                    </div>
                  </div>

                  {/* Assigned Agent Details */}
                  <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                    <h3 className="text-lg font-semibold text-white mb-4">Assigned Agent</h3>
                    {ticket.assigned_to_profile ? (
                      <div className="space-y-2 text-gray-300">
                  <div>
                          <span className="font-medium">Name:</span>{' '}
                          {ticket.assigned_to_profile.full_name}
                  </div>
                  <div>
                          <span className="font-medium">Phone:</span>{' '}
                          {ticket.assigned_to_profile.phone || 'Not provided'}
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-400">No agent assigned</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Messages Section */}
              <div className="p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Messages</h2>
                <div className="space-y-6">
                  {messages.map((message) => {
                    // Skip internal messages if user doesn't have permission to view them
                    if (message.message_type === 'internal' && !canViewInternalNotes(profile, ticket)) {
                      return null;
                    }
                    
                    return (
                      <div
                        key={message.id}
                        className={`rounded-lg p-4 border ${
                          message.message_type === 'internal'
                            ? 'bg-indigo-900/30 border-indigo-500/50'
                            : 'bg-black/20 border-white/5'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-medium text-white">
                              {message.created_by_profile?.full_name}
                            </span>
                            <span className="text-sm text-gray-400 ml-2">
                              {format(new Date(message.created_at), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                          <span className={`text-sm ${
                            message.message_type === 'internal'
                              ? 'text-indigo-300'
                              : 'text-gray-400'
                          }`}>
                            {message.message_type === 'internal' ? 'Internal Note' : 'Public Message'}
                          </span>
                        </div>
                        <div className="text-gray-200 whitespace-pre-wrap">{message.content}</div>
                      </div>
                    );
                  })}
                </div>

                {/* New Message Form */}
                <form onSubmit={handleSendMessage} className="mt-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-2">
                        Message Type
                      </label>
                      <div className="flex space-x-4">
                        <button
                          type="button"
                          onClick={() => setMessageType('public')}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            messageType === 'public'
                              ? 'bg-blue-500 text-white'
                              : 'bg-black/40 text-gray-300 hover:bg-black/60'
                          }`}
                        >
                          Public Message
                        </button>
                        {canViewInternalNotes(profile, ticket) && (
                          <button
                            type="button"
                            onClick={() => setMessageType('internal')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              messageType === 'internal'
                                ? 'bg-blue-500 text-white'
                                : 'bg-black/40 text-gray-300 hover:bg-black/60'
                            }`}
                          >
                            Internal Note
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="message" className="block text-sm font-medium text-gray-200 mb-2">
                        Message
                      </label>
                      <textarea
                        id="message"
                        rows={4}
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="w-full rounded-lg bg-black/20 border border-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Type your message here..."
                      />
                    </div>

                    <div className="flex items-center justify-end">
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {saving ? 'Sending...' : 'Send Message'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Attachments Section */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">Attachments</h2>
                  <div>
                    <input
                      type="file"
                      ref={attachmentInputRef}
                      onChange={(e) => e.target.files && handleAttachmentUpload(e.target.files)}
                      className="hidden"
                      multiple
                    />
                    <button
                      type="button"
                      onClick={() => attachmentInputRef.current?.click()}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-black/40 border border-white/10 text-gray-200 hover:bg-black/60 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Upload Attachments
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(ticket?.ticket_attachments || []).map((attachment) => {
                    const fileType = getFileType(attachment.file_name);
                    return (
                      <a
                        key={attachment.id}
                        href={signedUrls[attachment.id]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center p-4 bg-black/20 rounded-lg border border-white/5 hover:border-blue-500/50 transition-colors"
                      >
                        {fileType === 'image' ? (
                          <svg className="h-8 w-8 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        ) : fileType === 'pdf' ? (
                          <svg className="h-8 w-8 text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        ) : (
                          <svg className="h-8 w-8 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                        )}
                        <div className="ml-3 flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-200 truncate group-hover:text-blue-400 transition-colors">
                            {attachment.file_name}
                          </p>
                          <p className="text-sm text-gray-400">
                            {format(new Date(attachment.created_at), 'MMM d, yyyy')}
                          </p>
                    </div>
                      </a>
                    );
                  })}
                  </div>
              </div>

              {/* Audit Log Section */}
              <div className="p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Audit Log</h2>
                <div className="space-y-4">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="text-sm text-gray-300 bg-black/20 rounded-lg p-3 border border-white/5"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-white">
                          {log.created_by_profile?.full_name || 'System'}
                        </span>
                        <span className="text-sm text-gray-400">
                          {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>
                      <div className="text-gray-300">
                        {log.event_type === 'status_change' && (
                          <>Changed status from <span className="font-medium text-white">{log.from_value || 'none'}</span> to <span className="font-medium text-white">{log.to_value}</span></>
                        )}
                        {log.event_type === 'priority_change' && (
                          <>Changed priority from <span className="font-medium text-white">{log.from_value || 'none'}</span> to <span className="font-medium text-white">{log.to_value}</span></>
                        )}
                        {log.event_type === 'assignment_change' && (
                          <>
                            {log.from_value 
                              ? <>Reassigned ticket from <span className="font-medium text-white">{log.from_profile?.full_name || log.from_value}</span> to <span className="font-medium text-white">{log.to_profile?.full_name || log.to_value}</span></>
                              : <>Assigned ticket to <span className="font-medium text-white">{log.to_profile?.full_name || log.to_value}</span></>
                            }
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-300">
              Ticket not found or you don't have permission to view it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 