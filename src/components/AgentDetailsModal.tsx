import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface AgentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AgentDetails {
  id: string;
  full_name: string;
  organizations: {
    org_name: string;
    open_tickets: number;
    closed_tickets: number;
    avg_response_time: number;
  }[];
}

export default function AgentDetailsModal({ isOpen, onClose }: AgentDetailsModalProps) {
  const [agents, setAgents] = useState<AgentDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchAgentDetails();
    }
  }, [isOpen]);

  async function fetchAgentDetails() {
    try {
      setLoading(true);
      
      // First get all users with system role 'agent'
      const { data: agentProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'agent');  // Look for system role 'agent'

      if (profilesError) throw profilesError;

      const agentDetails: AgentDetails[] = [];

      // For each agent, get their organization memberships and stats
      for (const profile of agentProfiles || []) {
        // Get organizations where this agent is a member
        const { data: agentOrgs } = await supabase
          .from('organization_users')
          .select(`
            role,
            organizations!inner (
              id,
              name
            )
          `)
          .eq('user_id', profile.id);
        
        const orgStats = await Promise.all((agentOrgs || []).map(async (agentOrg: any) => {
          // Get tickets assigned to agent in this org
          const { data: tickets } = await supabase
            .from('tickets')
            .select('*')
            .eq('assigned_to', profile.id)
            .eq('organization_id', agentOrg.organizations.id);

          const openTickets = tickets?.filter(t => t.status === 'open').length || 0;
          const closedTickets = tickets?.filter(t => t.status === 'closed').length || 0;

          // Calculate average response time (assuming there's a first_response_at field)
          const avgResponseTime = tickets?.reduce((sum, ticket) => {
            if (ticket.first_response_at && ticket.created_at) {
              const responseTime = new Date(ticket.first_response_at).getTime() - new Date(ticket.created_at).getTime();
              return sum + responseTime;
            }
            return sum;
          }, 0) || 0;

          const avgResponseHours = tickets?.length ? (avgResponseTime / tickets.length) / (1000 * 60 * 60) : 0;

          return {
            org_name: agentOrg.organizations.name,
            open_tickets: openTickets,
            closed_tickets: closedTickets,
            avg_response_time: Math.round(avgResponseHours * 10) / 10 // Round to 1 decimal
          };
        }));

        agentDetails.push({
          id: profile.id,
          full_name: profile.full_name,
          organizations: orgStats
        });
      }

      setAgents(agentDetails);
    } catch (error) {
      console.error('Error fetching agent details:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Agent Details</h2>
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
              {agents.map((agent) => (
                <div key={agent.id} className="bg-gray-50 rounded-lg p-4">
                  <div className="mb-4">
                    <h3 className="text-lg font-medium text-gray-900">{agent.full_name}</h3>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Open Tickets</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Closed Tickets</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Avg Response Time (hrs)</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {agent.organizations.map((org, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-sm text-gray-900">{org.org_name}</td>
                            <td className="px-4 py-2 text-sm">
                              <span className="text-green-600 font-medium">{org.open_tickets}</span>
                            </td>
                            <td className="px-4 py-2 text-sm">
                              <span className="text-blue-600 font-medium">{org.closed_tickets}</span>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">{org.avg_response_time}</td>
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