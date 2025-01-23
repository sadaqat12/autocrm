export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high';
export type TicketCategory = 'bug' | 'feature_request' | 'support' | 'billing' | 'other';
export type MessageType = 'public' | 'internal' | 'system';
export type SystemRole = 'admin' | 'agent' | 'user';
export type OrgRole = 'owner' | 'admin' | 'member';
export type OrgUserStatus = 'pending' | 'accepted';

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  created_at: string;
  full_name: string;
  phone?: string;
  role: SystemRole;
  metadata?: Record<string, any>;
}

export interface OrganizationUser {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  status: OrgUserStatus;
  is_creator: boolean;
  created_at: string;
}

export interface AgentOrganization {
  id: string;
  agent_id: string;
  organization_id: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  organization_id: string;
  created_by: string;
  assigned_to?: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  created_by: string;
  content: string;
  message_type: MessageType;
  created_at: string;
}

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  message_id?: string;
  file_name: string;
  file_url: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  ticket_id?: string;
  user_id?: string;
  event_type: string;
  from_value?: string;
  to_value?: string;
  created_at: string;
} 