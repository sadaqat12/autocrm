import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { supabase } from '../lib/supabase';
import { commonStyles } from '../styles/theme';

interface NewCustomerInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organizationId: string;
}

export default function NewCustomerInviteModal({ isOpen, onClose, onSuccess, organizationId }: NewCustomerInviteModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // First get the user_id from auth.users
      const { data: userData, error: userError } = await supabase
        .rpc('get_user_id_by_email', {
          email_address: email
        });

      if (userError || !userData) {
        throw new Error('This email is not associated with any existing account. Users must have an account before they can be invited.');
      }

      // Then check if the user is already invited or a member
      const { data: existingUser, error: checkError } = await supabase
        .from('organization_users')
        .select('id, status')
        .eq('organization_id', organizationId)
        .eq('user_id', userData)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingUser) {
        if (existingUser.status === 'accepted') {
          throw new Error('User is already a member of this organization');
        } else if (existingUser.status === 'pending') {
          throw new Error('User has already been invited to this organization');
        }
      }

      // Create the invite with the user's ID
      const { error: inviteError } = await supabase
        .from('organization_users')
        .insert([
          {
            organization_id: organizationId,
            role: 'member',
            status: 'pending',
            user_id: userData,
            is_creator: false
          }
        ]);

      if (inviteError) throw inviteError;

      onSuccess();
      onClose();
      setEmail('');
    } catch (err: any) {
      console.error('Error inviting user:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={`${commonStyles.card} w-full max-w-md transform p-6`}>
                <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md text-gray-400 hover:text-gray-300 focus:outline-none"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-sm sm:mx-0 sm:h-10 sm:w-10 ring-1 ring-white/10">
                    <svg className="h-6 w-6 text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <Dialog.Title as="h3" className={commonStyles.heading}>
                      Invite Customer
                    </Dialog.Title>
                    <div className="mt-4">
                      <p className="text-sm text-gray-400 mb-4">
                        Note: Users must have an existing account in the application before they can be invited.
                      </p>
                      {error && (
                        <div className={commonStyles.messageBox.error}>
                          <p>{error}</p>
                        </div>
                      )}
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <label htmlFor="email" className={commonStyles.label}>
                            Email address
                          </label>
                          <input
                            type="email"
                            id="email"
                            name="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className={commonStyles.input}
                            placeholder="customer@example.com"
                          />
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={onClose}
                            className={commonStyles.buttonSecondary}
                          >
                            Cancel
                          </button>
                          <div className={commonStyles.buttonPrimary.wrapper}>
                            <div className={commonStyles.buttonPrimary.gradient} />
                            <button
                              type="submit"
                              disabled={loading}
                              className={commonStyles.buttonPrimary.content}
                            >
                              {loading ? (
                                <div className="flex items-center">
                                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                  Sending...
                                </div>
                              ) : (
                                'Send Invitation'
                              )}
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
} 