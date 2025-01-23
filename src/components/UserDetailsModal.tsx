import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserDetails {
  id: string;
  full_name: string;
  organizations: {
    org_name: string;
    role: string;
    tickets_created: number;
  }[];
}

interface OrgUser {
  role: string;
  organizations: {
    id: string;
    name: string;
  };
}

interface Profile {
  id: string;
  full_name: string;
}

export default function UserDetailsModal({ isOpen, onClose }: UserDetailsModalProps) {
  const [users, setUsers] = useState<UserDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchUserDetails();
    }
  }, [isOpen]);

  async function fetchUserDetails() {
    try {
      setLoading(true);
      
      // Fetch all users with their profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name');

      if (profilesError) throw profilesError;

      const userDetails: UserDetails[] = [];

      // For each user, fetch their organization memberships and tickets
      for (const profile of (profiles as Profile[] || [])) {
        // Get user's organizations and roles
        const { data: orgUsers } = await supabase
          .from('organization_users')
          .select(`
            role,
            organizations!inner (
              id,
              name
            )
          `)
          .eq('user_id', profile.id);

        // Get tickets created by user per organization
        const userOrgs = await Promise.all(((orgUsers || []) as unknown as OrgUser[]).map(async (orgUser) => {
          const { count } = await supabase
            .from('tickets')
            .select('*', { count: 'exact' })
            .eq('created_by', profile.id)
            .eq('organization_id', orgUser.organizations.id);

          return {
            org_name: orgUser.organizations.name,
            role: orgUser.role,
            tickets_created: count || 0
          };
        }));

        userDetails.push({
          id: profile.id,
          full_name: profile.full_name,
          organizations: userOrgs
        });
      }

      setUsers(userDetails);
    } catch (error) {
      console.error('Error fetching user details:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">User Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="px-6 py-4 overflow-auto max-h-[calc(90vh-8rem)]">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-8">
              {users.map((user) => (
                <div key={user.id} className="bg-gray-50 rounded-lg p-4">
                  <div className="mb-4">
                    <h3 className="text-lg font-medium text-gray-900">{user.full_name}</h3>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tickets Created</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {user.organizations.map((org, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-sm text-gray-900">{org.org_name}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                ${org.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                                  org.role === 'agent' ? 'bg-blue-100 text-blue-800' :
                                    'bg-gray-100 text-gray-800'}`}>
                                {org.role}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">{org.tickets_created}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 