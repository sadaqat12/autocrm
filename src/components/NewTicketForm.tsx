import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { TicketPriority, TicketCategory } from '../lib/types';

interface NewTicketFormProps {
  onClose: () => void;
  onSuccess: () => void;
  organizationId: string;
}

export default function NewTicketForm({ onClose, onSuccess, organizationId }: NewTicketFormProps) {
  const { profile } = useAuth();
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [category, setCategory] = useState<TicketCategory>('support');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Verify organization membership when component mounts
    const checkOrgMembership = async () => {
      if (!profile?.id) return;

      // If user is an admin, they can create tickets in any organization
      if (profile.role === 'admin') return;

      // For non-admins, check organization membership
      const { data: membershipData, error: membershipError } = await supabase
        .from('organization_users')
        .select('status, role')
        .eq('organization_id', organizationId)
        .eq('user_id', profile.id);

      if (membershipError) {
        setError('Error checking organization membership. Please try again.');
        console.error('Error checking organization membership:', membershipError);
        return;
      }

      if (!membershipData || membershipData.length === 0) {
        setError('You are not a member of this organization. Please request access from an administrator.');
        return;
      }

      const membership = membershipData[0];
      if (membership.status !== 'accepted') {
        setError(`Your membership is currently ${membership.status}. Please accept the invitation to create tickets.`);
        return;
      }
    };

    checkOrgMembership();
  }, [profile?.id, organizationId, profile?.role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // First check if user has permission
      if (profile?.role === 'admin') {
        // System admins can create tickets in any organization
        console.log('User is system admin, proceeding with ticket creation');
      } else {
        // Check if user is an agent for this organization
        const { data: agentData, error: agentError } = await supabase
          .from('agent_organizations')
          .select('agent_id')
          .eq('agent_id', profile?.id)
          .eq('organization_id', organizationId)
          .single();

        console.log('Agent check result:', { agentData, agentError });

        if (agentError && agentError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          console.error('Error checking agent status:', agentError);
          throw agentError;
        }

        if (!agentData) {
          // Not an agent, check if user is an accepted org member
          const { data: orgUser, error: orgUserError } = await supabase
            .from('organization_users')
            .select('status, role')
            .eq('user_id', profile?.id)
            .eq('organization_id', organizationId)
            .single();

          console.log('Organization member check result:', { orgUser, orgUserError });

          if (orgUserError) {
            console.error('Error checking organization membership:', orgUserError);
            throw orgUserError;
          }

          if (!orgUser || orgUser.status !== 'accepted') {
            console.error('User membership status:', orgUser?.status);
            throw new Error('User is not an accepted member of this organization');
          }

          console.log('Confirmed user is accepted member with role:', orgUser.role);
        }
      }

      const ticketData = {
        organization_id: organizationId,
        subject,
        priority,
        category,
        created_by: profile?.id,
        status: 'open',
        tags: [],
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        assigned_to: null
      };

      console.log('Attempting to create ticket with data:', ticketData);

      // Insert the ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert([ticketData])
        .select()
        .single();

      if (ticketError && !ticket) {
        console.error('Ticket creation error details:', ticketError);
        throw ticketError;
      }

      console.log('Ticket created successfully:', ticket);

      // Insert the initial message
      const { error: messageError } = await supabase
        .from('ticket_messages')
        .insert([
          {
            ticket_id: ticket.id,
            content,
            created_by: profile?.id,
            message_type: 'public',
          },
        ]);

      if (messageError) {
        console.error('Message creation error:', messageError);
        throw messageError;
      }

      onSuccess();
    } catch (err) {
      console.error('Error creating ticket:', err);
      setError('Failed to create ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{error}</h3>
            </div>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
          Subject
        </label>
        <input
          type="text"
          id="subject"
          name="subject"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm py-2.5 px-3 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
            Priority
          </label>
          <select
            id="priority"
            name="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TicketPriority)}
            className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm py-2.5 px-3 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors text-sm"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Category
          </label>
          <select
            id="category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as TicketCategory)}
            className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm py-2.5 px-3 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors text-sm"
          >
            <option value="bug">Bug</option>
            <option value="feature_request">Feature Request</option>
            <option value="support">Support</option>
            <option value="billing">Billing</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="content"
          name="content"
          rows={4}
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="mt-1 block w-full rounded-md border-2 border-gray-300 shadow-sm py-2.5 px-3 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors text-sm"
        />
      </div>

      <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
        <button
          type="submit"
          disabled={isSubmitting || !!error}
          className="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm disabled:opacity-50"
        >
          {isSubmitting ? 'Creating...' : 'Create Ticket'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
} 