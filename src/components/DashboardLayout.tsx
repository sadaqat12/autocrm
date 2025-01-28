import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import OrganizationList from './OrganizationList';
import NewOrganizationModal from './NewOrganizationModal';
import InvitesModal from './InvitesModal';
import Logo from './Logo';
import { Organization } from '../lib/types';
import { commonStyles } from '../styles/theme';

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
    <div className={commonStyles.pageContainer}>
      {/* Background patterns */}
      <div className="absolute inset-0 z-0 opacity-30">
        <div className="absolute inset-0" style={commonStyles.patterns.dots}></div>
        <div className={`absolute h-screen w-screen ${commonStyles.patterns.grid}`}></div>
      </div>

      {/* Animated gradients */}
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-r from-blue-500/30 to-cyan-500/30 rounded-full mix-blend-screen filter blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-full mix-blend-screen filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-indigo-500/30 to-blue-500/30 rounded-full mix-blend-screen filter blur-3xl opacity-50 animate-pulse"></div>
      </div>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm transition-opacity md:hidden z-30"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className={`flex flex-col h-full ${commonStyles.card}`}>
          <div className="flex items-center justify-between h-16 px-4 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 backdrop-blur-xl rounded-t-xl">
            <Logo size="medium" className="text-white" />
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
            <OrganizationList 
              onNewOrganization={handleNewOrganization}
              onSelectOrganization={handleOrganizationSelect}
            />
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="md:pl-64 flex flex-col min-h-screen">
        {/* Header */}
        <header className={`${commonStyles.card} z-20`}>
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-300 hover:text-white hover:bg-black/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex items-center gap-4">
                <span className={commonStyles.text}>
                  {profile?.full_name}
                </span>
                {profile?.role === 'user' && (
                  <button
                    onClick={() => setShowInvitesModal(true)}
                    className={commonStyles.buttonSecondary}
                  >
                    <div className="flex items-center">
                      <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Invites
                      {invitations.length > 0 && (
                        <span className={`ml-1.5 ${commonStyles.badge.info}`}>
                          {invitations.length}
                        </span>
                      )}
                    </div>
                  </button>
                )}
                <button
                  onClick={signOut}
                  className={commonStyles.buttonSecondary}
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 ${commonStyles.contentContainer}`}>
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Modals */}
      <NewOrganizationModal
        isOpen={showNewOrgModal}
        onClose={() => setShowNewOrgModal(false)}
        onSuccess={() => {
          const event = new CustomEvent('organizationCreated');
          window.dispatchEvent(event);
        }}
      />

      <InvitesModal
        isOpen={showInvitesModal}
        onClose={() => setShowInvitesModal(false)}
        invitations={invitations}
        loading={loading}
        onAccept={acceptInvitation}
        onReject={rejectInvitation}
      />
    </div>
  );
} 