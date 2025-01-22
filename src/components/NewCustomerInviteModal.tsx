import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

interface NewCustomerInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organizationId: string;
}

export default function NewCustomerInviteModal({ isOpen, onClose, onSuccess, organizationId }: NewCustomerInviteModalProps) {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // First check if the user already exists in organization_users
      const { data: existingUser, error: existingError } = await supabase
        .from('organization_users')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_email', email)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existingUser) {
        throw new Error('This user has already been invited to the organization');
      }

      // Check if the current user is a creator for this organization
      const { data: creatorAccess, error: creatorError } = await supabase
        .from('organization_users')
        .select('is_creator')
        .eq('organization_id', organizationId)
        .eq('user_email', user?.email)
        .maybeSingle();

      if (creatorError) {
        throw creatorError;
      }

      if (!creatorAccess?.is_creator) {
        throw new Error('You do not have permission to invite users to this organization. Only creators can invite users.');
      }

      // Insert the invitation into organization_users table
      const { error: inviteError } = await supabase
        .from('organization_users')
        .insert({
          organization_id: organizationId,
          user_email: email,
          role: 'user',
          status: 'pending',
          is_creator: false
        });

      if (inviteError) {
        throw inviteError;
      }

      setFullName('');
      setEmail('');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error inviting customer:', err);
      setError(err.message || 'Failed to send invitation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div>
            <div className="mt-3 text-center sm:mt-0 sm:text-left">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Add New Customer
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  Enter the customer's details. They will receive an invitation email to join your organization.
                </p>
              </div>
              <form onSubmit={handleSubmit} className="mt-5">
                {error && (
                  <div className="mb-4 p-2 text-sm text-red-700 bg-red-100 rounded">
                    {error}
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      id="fullName"
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email Address
                    </label>
                    <input
                      type="email"
                      name="email"
                      id="email"
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:col-start-2 sm:text-sm disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Send Invitation'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 