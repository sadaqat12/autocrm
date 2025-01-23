import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

interface NewCustomerInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organizationId: string;
}

export default function NewCustomerInviteModal({ isOpen, onClose, onSuccess, organizationId }: NewCustomerInviteModalProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('Current user:', user?.id);
      console.log('Organization ID:', organizationId);

      // Look up the user's profile by email in metadata
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .contains('metadata', { email: email })
        .single();

      console.log('Found profile:', profileData);
      console.log('Profile error:', profileError);

      if (profileError) {
        if (profileError.code === 'PGRST116') {
          throw new Error('No user found with this email address. The user must have an account before they can be invited.');
        }
        throw profileError;
      }

      if (!profileData) {
        throw new Error('No user found with this email address. The user must have an account before they can be invited.');
      }

      // Now check if the user already exists in organization_users
      const { data: existingUser, error: existingError } = await supabase
        .from('organization_users')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', profileData.id)
        .maybeSingle();

      console.log('Existing user check:', existingUser);
      console.log('Existing user error:', existingError);

      if (existingError) {
        throw existingError;
      }

      if (existingUser) {
        throw new Error('This user has already been invited to the organization');
      }

      // First check if the current user is a system admin
      const { data: adminData, error: adminError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single();

      if (adminError) {
        throw adminError;
      }

      let hasPermission = adminData?.role === 'admin';

      if (!hasPermission) {
        // If not admin, check if they're an owner/admin of the organization
        const { data: userAccess, error: accessError } = await supabase
          .from('organization_users')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('user_id', user?.id)
          .eq('status', 'accepted')
          .in('role', ['owner', 'admin'])
          .maybeSingle();

        console.log('User access check:', userAccess);
        console.log('Access error:', accessError);

        if (accessError) {
          throw accessError;
        }

        hasPermission = !!userAccess;
      }

      if (!hasPermission) {
        throw new Error('You do not have permission to invite users to this organization. Only owners and admins can invite users.');
      }

      // Insert the invitation into organization_users table
      console.log('Creating organization_users record with data:', {
        organization_id: organizationId,
        user_id: profileData.id,
        role: 'member',
        status: 'pending'
      });

      const { data: inviteData, error: inviteError } = await supabase
        .from('organization_users')
        .insert([{
          organization_id: organizationId,
          user_id: profileData.id,
          role: 'member',
          status: 'pending',
          is_creator: false
        }])
        .select()
        .single();

      console.log('Organization user record created:', { inviteData, error: inviteError });

      if (inviteError) {
        throw inviteError;
      }

      console.log('Invitation process completed successfully');
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
                  The customer must already have an account in the app to be invited to your organization.
                </p>
                <form onSubmit={handleSubmit} className="mt-4">
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        Customer Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        id="email"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter customer's email"
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
                        disabled={loading}
                        className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                      >
                        {loading ? 'Sending...' : 'Send Invitation'}
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 