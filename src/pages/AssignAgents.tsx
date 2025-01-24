import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';

interface Agent {
  id: string;
  full_name: string;
  assigned: boolean;
}

interface Organization {
  id: string;
  name: string;
}

export default function AssignAgents() {
  const { orgId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [orgId]);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      // Fetch organization details
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', orgId)
        .single();

      if (orgError) throw orgError;
      setOrganization(orgData);

      // Fetch all agents - removed email field from select
      const { data: agentsData, error: agentsError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'agent');

      if (agentsError) throw agentsError;

      // Fetch current organization assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('organization_users')
        .select('user_id')
        .eq('organization_id', orgId)
        .eq('role', 'admin');

      if (assignmentsError) throw assignmentsError;

      // Create a set of assigned agent IDs for quick lookup
      const assignedAgentIds = new Set(assignmentsData.map(a => a.user_id));

      // Combine the data
      const agentsWithAssignment = agentsData.map(agent => ({
        ...agent,
        assigned: assignedAgentIds.has(agent.id)
      }));

      setAgents(agentsWithAssignment);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  const toggleAgent = async (agentId: string, currentlyAssigned: boolean) => {
    try {
      setSaving(true);
      setError(null);

      if (currentlyAssigned) {
        // Remove assignment
        const { error: orgUserError } = await supabase
          .from('organization_users')
          .delete()
          .eq('organization_id', orgId)
          .eq('user_id', agentId);

        if (orgUserError) throw orgUserError;

        // Also remove from agent_organizations
        const { error: agentOrgError } = await supabase
          .from('agent_organizations')
          .delete()
          .eq('organization_id', orgId)
          .eq('agent_id', agentId);

        if (agentOrgError) throw agentOrgError;
      } else {
        // Add assignment
        const { error: orgUserError } = await supabase
          .from('organization_users')
          .insert({
            organization_id: orgId,
            user_id: agentId,
            role: 'admin',
            status: 'accepted'  // Important: Set status to accepted
          });

        if (orgUserError) throw orgUserError;

        // Also add to agent_organizations
        const { error: agentOrgError } = await supabase
          .from('agent_organizations')
          .insert({
            organization_id: orgId,
            agent_id: agentId
          });

        if (agentOrgError) throw agentOrgError;
      }

      // Update local state
      setAgents(agents.map(agent => 
        agent.id === agentId 
          ? { ...agent, assigned: !currentlyAssigned }
          : agent
      ));
    } catch (error: any) {
      console.error('Error toggling agent assignment:', error);
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Organization not found</h3>
          <button
            onClick={() => navigate('/admin')}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Logo size="large" />
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Assign Agents to {organization.name}
            </h2>
          </div>
          <button
            onClick={() => navigate('/admin')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Return to Dashboard
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="space-y-4">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between py-4 border-b last:border-0"
                >
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">{agent.full_name}</h4>
                  </div>
                  <button
                    onClick={() => toggleAgent(agent.id, agent.assigned)}
                    disabled={saving}
                    className={`
                      inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md shadow-sm
                      ${agent.assigned
                        ? 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                        : 'border-transparent text-white bg-blue-600 hover:bg-blue-700'
                      }
                      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    {saving ? (
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : agent.assigned ? (
                      'Remove'
                    ) : (
                      'Assign'
                    )}
                  </button>
                </div>
              ))}

              {agents.length === 0 && (
                <div className="text-center py-6 text-gray-500">
                  No agents available to assign
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 