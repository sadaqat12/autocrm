import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import OrganizationList from './OrganizationList';
import NewOrganizationModal from './NewOrganizationModal';
import Logo from './Logo';
import { Organization } from '../lib/types';

interface Invitation {
  id: string;
  organization: Organization | null;
  created_at: string;
  email: string;
  status: string;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  onSelectOrg?: (org: Organization) => void;
}

export default function DashboardLayout({ children, onSelectOrg }: DashboardLayoutProps) {
  const { profile, user, signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default closed on mobile
  const [showNewOrgModal, setShowNewOrgModal] = useState(false);
  const [showInvitesModal, setShowInvitesModal] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleOpenNewOrgModal = () => {
      setShowNewOrgModal(true);
    };

    window.addEventListener('openNewOrgModal', handleOpenNewOrgModal);

    return () => {
      window.removeEventListener('openNewOrgModal', handleOpenNewOrgModal);
    };
  }, []);

  // Add periodic invitation check
  useEffect(() => {
    if (!user?.id || profile?.role !== 'user') return;

    // Initial check
    fetchInvitations();

    // Check every 30 seconds
    const intervalId = setInterval(fetchInvitations, 30000);

    return () => clearInterval(intervalId);
  }, [user?.id, profile?.role]);

  const fetchInvitations = async () => {
    if (!user?.id) return;
    
    // Don't set loading state if we're just doing background checks
    const isModalOpen = showInvitesModal;
    if (isModalOpen) {
      setLoading(true);
    }
    
    try {
      // First get the invitations
      const { data: invitationData, error: invitationError } = await supabase
        .from('organization_users')
        .select(`
          id,
          created_at,
          user_id,
          status,
          organization_id
        `)
        .eq('user_id', user.id)
        .eq('status', 'pending');

      if (invitationError) {
        console.error('Error fetching invitations:', invitationError);
        throw invitationError;
      }
      console.log('Raw invitation data:', invitationData);

      if (!invitationData?.length) {
        setInvitations([]);
        return;
      }

      // Then get the organizations through a separate query
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .in('id', invitationData.map(inv => inv.organization_id));

      if (orgError) {
        console.error('Error fetching organizations:', orgError);
        throw orgError;
      }
      console.log('Organization data:', orgData);

      // Map the data together
      const mappedInvitations = invitationData.map(invitation => {
        const orgInfo = orgData?.find(org => org.id === invitation.organization_id);
        return {
          id: invitation.id,
          created_at: invitation.created_at,
          email: invitation.user_id,
          status: invitation.status,
          organization: orgInfo ? {
            id: orgInfo.id,
            name: orgInfo.name
          } : null
        } as Invitation;
      });
      
      console.log('Final mapped invitations:', mappedInvitations);
      setInvitations(mappedInvitations);
    } catch (error) {
      console.error('Error in fetchInvitations:', error);
    } finally {
      if (isModalOpen) {
        setLoading(false);
      }
    }
  };

  const acceptInvitation = async (invitationId: string) => {
    try {
      console.log('Starting invitation acceptance for ID:', invitationId);
      console.log('Current user ID:', user?.id);

      // First verify the invitation exists and is pending
      const { data: invitation, error: verifyError } = await supabase
        .from('organization_users')
        .select('*')
        .eq('id', invitationId)
        .eq('user_id', user?.id)
        .eq('status', 'pending')
        .single();

      if (verifyError) {
        console.error('Error verifying invitation:', verifyError);
        throw new Error('Could not verify invitation status');
      }

      if (!invitation) {
        console.error('No invitation found with ID:', invitationId);
        throw new Error('Invitation not found');
      }

      console.log('Found invitation:', invitation);

      // Update the status - only include necessary conditions for RLS policy
      const { error: updateError } = await supabase
        .from('organization_users')
        .update({ status: 'accepted' })
        .eq('id', invitationId)
        .eq('user_id', user?.id);  // RLS policy will handle the status check

      if (updateError) {
        console.error('Error updating invitation:', updateError);
        throw updateError;
      }

      // Verify the update in a separate query
      const { data: verifyUpdate, error: verifyUpdateError } = await supabase
        .from('organization_users')
        .select('status')
        .eq('id', invitationId)
        .single();

      console.log('Status after update:', {
        status: verifyUpdate?.status,
        error: verifyUpdateError
      });

      if (verifyUpdate?.status !== 'accepted') {
        throw new Error('Failed to update invitation status');
      }

      // Refresh the invitations list
      await fetchInvitations();
      
      // Force refresh the page to update all components
      window.location.reload();
    } catch (error) {
      console.error('Error in acceptInvitation:', error);
      throw error;
    }
  };

  const rejectInvitation = async (invitationId: string) => {
    try {
      console.log('Starting invitation rejection for ID:', invitationId);

      // First verify the invitation exists and is pending
      const { data: invitation, error: verifyError } = await supabase
        .from('organization_users')
        .select('*')
        .eq('id', invitationId)
        .eq('user_id', user?.id)
        .eq('status', 'pending')
        .single();

      if (verifyError) {
        console.error('Error verifying invitation:', verifyError);
        throw new Error('Could not verify invitation status');
      }

      if (!invitation) {
        console.error('No invitation found with ID:', invitationId);
        throw new Error('Invitation not found');
      }

      console.log('Found invitation:', invitation);

      // Update with proper conditions
      const { data: updateData, error: updateError } = await supabase
        .from('organization_users')
        .update({ status: 'rejected' })
        .eq('id', invitationId)
        .eq('user_id', user?.id)
        .eq('status', 'pending')
        .select()
        .single();

      if (updateError) {
        console.error('Error updating invitation:', updateError);
        throw updateError;
      }

      console.log('Update result:', updateData);
      
      // Refresh the invitations list
      await fetchInvitations();
    } catch (error) {
      console.error('Error rejecting invitation:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (showInvitesModal) {
      fetchInvitations();
    }
  }, [showInvitesModal]);

  const handleNewOrganization = () => {
    setShowNewOrgModal(true);
  };

  const handleOrganizationSelect = (org: Organization) => {
    if (onSelectOrg) {
      onSelectOrg(org);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 transition-opacity md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-blue-700 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 bg-blue-800">
          <Logo size="medium" className="text-white" />
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="text-white md:hidden focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="mt-5 px-2 space-y-4">
          <OrganizationList 
            onNewOrganization={handleNewOrganization}
            onSelectOrganization={handleOrganizationSelect}
          />
        </nav>
      </div>

      {/* Main content */}
      <div className="md:pl-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className="bg-white shadow-sm z-10">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex items-center">
                <span className="text-gray-800 font-medium text-sm sm:text-base truncate max-w-[200px]">
                  {profile?.full_name}
                </span>
                {profile?.role === 'user' && (
                  <button
                    onClick={() => setShowInvitesModal(true)}
                    className="ml-4 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-md transition-colors inline-flex items-center"
                  >
                    <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Invites
                    {invitations.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full">
                        {invitations.length}
                      </span>
                    )}
                  </button>
                )}
                <button
                  onClick={signOut}
                  className="ml-4 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* New Organization Modal */}
      <NewOrganizationModal
        isOpen={showNewOrgModal}
        onClose={() => setShowNewOrgModal(false)}
        onSuccess={() => {
          // Trigger a refresh of the organizations list
          const event = new CustomEvent('organizationCreated');
          window.dispatchEvent(event);
        }}
      />

      {/* Invites Modal */}
      {showInvitesModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowInvitesModal(false)} />

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="relative inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <div className="mt-3 text-center sm:mt-0 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Organization Invitations</h3>
                  <div className="mt-2">
                    {loading ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    ) : invitations.length > 0 ? (
                      <ul className="divide-y divide-gray-200">
                        {invitations.map((invitation) => (
                          <li key={invitation.id} className="py-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center min-w-0">
                                <div className="flex-shrink-0">
                                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                    <span className="text-blue-600 font-medium text-lg">
                                      {invitation.organization?.name?.charAt(0).toUpperCase() || '?'}
                                    </span>
                                  </div>
                                </div>
                                <div className="ml-4">
                                  <h4 className="text-sm font-medium text-gray-900 truncate">
                                    {invitation.organization?.name || 'Unknown Organization'}
                                  </h4>
                                  <p className="text-sm text-gray-500">
                                    Invited on {new Date(invitation.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => rejectInvitation(invitation.id)}
                                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => acceptInvitation(invitation.id)}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                  Accept
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">You don't have any pending invitations.</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                  onClick={() => setShowInvitesModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 