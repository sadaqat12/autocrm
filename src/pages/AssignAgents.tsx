import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { commonStyles } from '../styles/theme';

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

  const backToDashboardAction = {
    label: 'Back to Dashboard',
    icon: (
      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
    ),
    onClick: () => navigate('/admin')
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

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Navbar
          title={`Assign Agents to ${organization?.name}`}
          actions={[backToDashboardAction]}
        />

        {error && (
          <div className={`${commonStyles.messageBox.error} mt-6`}>
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

        <div className={`${commonStyles.card} mt-6`}>
          <div className="p-6">
            <div className="space-y-4">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className={`${commonStyles.cardWithHover} p-4`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
                    <div className="flex items-center space-x-4 min-w-0 flex-1">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10">
                        <span className="text-blue-400 font-medium text-lg">
                          {agent.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <h4 className={`${commonStyles.text} font-medium truncate`}>{agent.full_name}</h4>
                    </div>
                    <div className="sm:ml-4 sm:flex-shrink-0">
                      <div className={commonStyles.buttonPrimary.wrapper}>
                        <div className={commonStyles.buttonPrimary.gradient} />
                        <button
                          onClick={() => toggleAgent(agent.id, agent.assigned)}
                          disabled={saving}
                          className={`${commonStyles.buttonPrimary.content} !py-2 w-full sm:w-24`}
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
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 