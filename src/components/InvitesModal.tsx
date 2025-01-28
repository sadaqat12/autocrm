import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { commonStyles } from '../styles/theme';
import { Organization } from '../lib/types';

interface Invitation {
  id: string;
  organization: Organization | null;
  created_at: string;
  email: string;
  status: string;
}

interface InvitesModalProps {
  isOpen: boolean;
  onClose: () => void;
  invitations: Invitation[];
  loading: boolean;
  onAccept: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

export default function InvitesModal({
  isOpen,
  onClose,
  invitations,
  loading,
  onAccept,
  onReject
}: InvitesModalProps) {
  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-50 overflow-y-auto" onClose={onClose}>
        <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm transition-opacity" />
          </Transition.Child>

          <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">
            &#8203;
          </span>

          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <div className={`relative inline-block transform overflow-hidden rounded-lg text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle ${commonStyles.card}`}>
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

              <div className="p-6">
                <Dialog.Title as="h3" className={`${commonStyles.heading} mb-6`}>
                  Organization Invitations
                </Dialog.Title>

                <div className="space-y-4">
                  {loading ? (
                    <div className="flex justify-center py-4">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                    </div>
                  ) : invitations.length > 0 ? (
                    <div className="space-y-4">
                      {invitations.map((invitation) => (
                        <div
                          key={invitation.id}
                          className={`${commonStyles.cardWithHover} p-4`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center min-w-0 space-x-4">
                              <div className="flex-shrink-0">
                                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10">
                                  <span className="text-blue-400 font-medium text-lg">
                                    {invitation.organization?.name?.charAt(0).toUpperCase() || '?'}
                                  </span>
                                </div>
                              </div>
                              <div className="min-w-0">
                                <h4 className={`${commonStyles.text} font-medium truncate`}>
                                  {invitation.organization?.name || 'Unknown Organization'}
                                </h4>
                                <p className="text-sm text-gray-400">
                                  Invited on {new Date(invitation.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => onReject(invitation.id)}
                                className={`${commonStyles.buttonSecondary} !py-1.5`}
                              >
                                Reject
                              </button>
                              <div className={commonStyles.buttonPrimary.wrapper}>
                                <div className={commonStyles.buttonPrimary.gradient} />
                                <button
                                  onClick={() => onAccept(invitation.id)}
                                  className={`${commonStyles.buttonPrimary.content} !py-1.5`}
                                >
                                  Accept
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={commonStyles.messageBox.info}>
                      <p>You don't have any pending invitations.</p>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className={commonStyles.buttonSecondary}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
} 