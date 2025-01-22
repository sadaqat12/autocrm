import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Organization {
  id: string;
  name: string;
  created_at: string;
}

interface OrganizationListProps {
  onNewOrganization: () => void;
  onSelectOrganization: (org: Organization) => void;
}

export default function OrganizationList({ onNewOrganization, onSelectOrganization }: OrganizationListProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrganizations();

    // Listen for organization creation events
    const handleOrgCreated = () => {
      fetchOrganizations();
    };

    window.addEventListener('organizationCreated', handleOrgCreated);

    return () => {
      window.removeEventListener('organizationCreated', handleOrgCreated);
    };
  }, []);

  async function fetchOrganizations() {
    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // First get the organizations where the user is a member
      const { data: memberOrgs, error: memberError } = await supabase
        .from('organization_users')
        .select('organization_id')
        .eq('user_email', userData.user.email);

      if (memberError) throw memberError;

      if (!memberOrgs?.length) {
        setOrganizations([]);
        return;
      }

      // Then get the organization details
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, created_at')
        .in('id', memberOrgs.map(org => org.organization_id))
        .order('name');

      if (error) throw error;

      setOrganizations(data || []);
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onNewOrganization}
        className="w-full flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-800 rounded-md hover:bg-blue-600 transition-colors"
      >
        <svg className="mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        New Organization
      </button>
      
      <div className="px-3">
        <h3 className="text-xs font-semibold text-blue-200 uppercase tracking-wider">
          Your Organizations
        </h3>
        <div className="mt-2 space-y-1">
          {loading ? (
            <div className="text-blue-100 text-sm">Loading organizations...</div>
          ) : organizations.length === 0 ? (
            <div className="text-blue-100 text-sm">No organizations yet</div>
          ) : (
            organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => onSelectOrganization(org)}
                className="w-full text-left px-3 py-2 text-sm text-blue-100 rounded-md hover:bg-blue-600 transition-colors"
              >
                {org.name}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 