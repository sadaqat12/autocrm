import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import { Organization } from '../lib/types';
import { commonStyles } from '../styles/theme';

interface OrganizationListProps {
  onNewOrganization: () => void;
  onSelectOrganization: (org: Organization) => void;
}

interface OrganizationUser {
  organization_id: string;
  organizations: Organization;
}

export default function OrganizationList({ onNewOrganization, onSelectOrganization }: OrganizationListProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchOrganizations();
      window.addEventListener('organizationCreated', fetchOrganizations);
      return () => window.removeEventListener('organizationCreated', fetchOrganizations);
    }
  }, [user]);

  const fetchOrganizations = async () => {
    const { data: memberships, error } = await supabase
      .from('organization_users')
      .select('organization_id, organizations(*)')
      .eq('user_id', user?.id)
      .eq('status', 'accepted') as { data: OrganizationUser[] | null, error: any };

    if (error) {
      console.error('Error fetching organizations:', error);
      return;
    }

    const orgs = memberships?.map(m => m.organizations) || [];
    setOrganizations(orgs);
  };

  const handleOrgSelect = (org: Organization) => {
    setSelectedOrgId(org.id);
    onSelectOrganization(org);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className={`${commonStyles.heading} text-lg`}>Organizations</h2>
        <button
          onClick={onNewOrganization}
          className={`bg-white/5 hover:bg-white/10 border border-gray-700/30 hover:border-gray-600/50 text-gray-100 !py-2 !px-3 transition-all duration-200 rounded-lg flex items-center gap-2`}
        >
          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add</span>
        </button>
      </div>

      <div className="space-y-3">
        {organizations.map((org) => (
          <button
            key={org.id}
            onClick={() => handleOrgSelect(org)}
            className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ${
              selectedOrgId === org.id
                ? 'bg-gradient-to-r from-blue-500/30 to-indigo-500/30 backdrop-blur-sm border border-blue-400/40 shadow-lg'
                : 'hover:bg-white/10 border border-gray-700/30 hover:border-gray-600/50 bg-white/5'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className={`flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center ${
                selectedOrgId === org.id ? 'bg-blue-400/30 text-white' : 'bg-gray-600/40 text-gray-100'
              }`}>
                {org.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${selectedOrgId === org.id ? 'text-white' : 'text-gray-100'} truncate`}>
                  {org.name}
                </p>
              </div>
              {selectedOrgId === org.id && (
                <div className="flex-shrink-0">
                  <div className={`${commonStyles.badge.success} bg-emerald-500/20 text-emerald-300 border border-emerald-400/30`}>
                    Active
                  </div>
                </div>
              )}
            </div>
          </button>
        ))}

        {organizations.length === 0 && (
          <div className={commonStyles.messageBox.info}>
            <p>No organizations yet. Create your first one!</p>
          </div>
        )}
      </div>
    </div>
  );
} 