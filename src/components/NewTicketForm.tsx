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

      // First check if any membership exists
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

      if (profile.role !== 'admin' && (!membershipData || membershipData.length === 0)) {
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
  }, [profile?.id, organizationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Insert the ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert([
          {
            organization_id: organizationId,
            subject,
            priority,
            category,
            created_by: profile?.id,
          },
        ])
        .select()
        .single();

      if (ticketError) throw ticketError;

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

      if (messageError) throw messageError;

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