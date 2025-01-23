import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { Organization } from '../lib/types';

interface DatabaseResponse {
  organizations: Organization;
}

export default function OrganizationList() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizations = async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('organization_users')
        .select(`
          organizations (
            id,
            name,
            created_at
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      if (error) throw error;

      if (data) {
        // First cast to unknown to reset type inference
        const typedData = data as unknown as DatabaseResponse[];
        const orgs = typedData
          .map(item => item.organizations)
          .filter(Boolean);
        setOrganizations(orgs);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
      setError('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, [user]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  return (
    <div>
      {organizations.map(org => (
        <div key={org.id}>
          <h2>{org.name}</h2>
          <p>Created: {new Date(org.created_at).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
} 