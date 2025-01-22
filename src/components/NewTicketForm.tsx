import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

interface NewTicketFormProps {
  onClose: () => void;
  onSuccess?: () => void;
  organizationId: string;
}

export default function NewTicketForm({ onClose, onSuccess, organizationId }: NewTicketFormProps) {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<'support' | 'bug' | 'feature'>('support');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // First ensure we have auth session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      setError('Authentication error. Please try logging in again.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // First create the ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert([
          {
            subject,
            category,
            priority,
            organization_id: organizationId,
            created_by: session.user.id,
            status: 'open'
          }
        ])
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Then create the initial message
      const { error: messageError } = await supabase
        .from('ticket_messages')
        .insert([
          {
            ticket_id: ticket.id,
            content,
            message_type: 'public',
            created_by: session.user.id
          }
        ]);

      if (messageError) throw messageError;

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Error creating ticket:', err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
      <div className="sm:flex sm:items-start">
        <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Create New Ticket</h3>
          <div className="mt-2">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
                  Subject
                </label>
                <input
                  type="text"
                  name="subject"
                  id="subject"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                  Category
                </label>
                <select
                  id="category"
                  name="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as 'support' | 'bug' | 'feature')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="support">Support</option>
                  <option value="bug">Bug Report</option>
                  <option value="feature">Feature Request</option>
                </select>
              </div>

              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                  Priority
                </label>
                <select
                  id="priority"
                  name="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>

              {error && (
                <div className="text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Ticket'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 