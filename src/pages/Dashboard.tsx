import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

interface Organization {
  id: string;
  name: string;
}

interface Invitation {
  id: string;
  organization: Organization;
  created_at: string;
  email: string;
  status: string;
}

interface SupabaseInvitation {
  id: string;
  created_at: string;
  email: string;
  status: string;
  organization: Organization;
}

export default function Dashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.role !== 'user') {
      // Redirect to role-specific dashboard
      const dashboardRoutes: Record<string, string> = {
        admin: '/admin',
        agent: '/agent',
      };
      navigate(dashboardRoutes[profile?.role || ''] || '/login');
    } else {
      fetchInvitations();
    }
  }, [profile, navigate]);

  const fetchInvitations = async () => {
    if (!user?.email) return;
    
    try {
      const { data, error } = await supabase
        .from('customer_invitations')
        .select(`
          id,
          created_at,
          email,
          status,
          organization:organizations (
            id,
            name
          )
        `)
        .eq('email', user.email)
        .eq('status', 'pending')
        .returns<SupabaseInvitation[]>();

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const acceptInvitation = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('customer_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId);

      if (error) throw error;
      
      // Refresh the invitations list
      fetchInvitations();
    } catch (error) {
      console.error('Error accepting invitation:', error);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="sm:flex sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Welcome to AutoCRM</h1>
        </div>

        {invitations.length > 0 ? (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-lg font-medium text-gray-900">Organization Invitations</h2>
              <p className="mt-1 text-sm text-gray-500">
                You have been invited to join the following organizations
              </p>
            </div>
            <ul className="divide-y divide-gray-200">
              {invitations.map((invitation) => (
                <li key={invitation.id}>
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-blue-600 font-medium text-lg">
                              {invitation.organization.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <h3 className="text-lg font-medium text-gray-900">
                            {invitation.organization.name}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Invited on {new Date(invitation.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => acceptInvitation(invitation.id)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Accept Invitation
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">No Pending Invitations</h3>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>You currently don't have any pending invitations to join organizations.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
} 