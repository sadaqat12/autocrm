export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      tickets: {
        Row: {
          id: string
          subject: string
          custom_fields: Json | null
          tags: string[] | null
          created_at: string
          updated_at: string
          priority: 'low' | 'medium' | 'high'
          status: 'open' | 'in_progress' | 'resolved' | 'closed'
          assigned_to: string | null
          created_by: string
          organization_id: string
          category: 'support' | 'billing' | 'feature' | 'bug'
        }
      }
      ticket_messages: {
        Row: {
          id: string
          content: string
          message_type: 'public' | 'private'
          created_by: string
          ticket_id: string
          created_at: string
        }
      }
      ticket_attachments: {
        Row: {
          id: string
          message_id: string | null
          file_name: string
          file_url: string
          created_at: string
          ticket_id: string
        }
      }
      profiles: {
        Row: {
          id: string
          created_at: string
          organization_id: string | null
          role: 'admin' | 'agent' | 'user'
          full_name: string
          phone: string | null
          metadata: Json | null
        }
      }
    }
  }
} 