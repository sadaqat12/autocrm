import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Organization } from '../../lib/types';
import Logo from '../../components/Logo';
import UserDetailsModal from '../../components/UserDetailsModal';
import AgentDetailsModal from '../../components/AgentDetailsModal';
import TicketDetailsModal from '../../components/TicketDetailsModal';
import OrganizationDetailsModal from '../../components/OrganizationDetailsModal';

interface OrgStats {
  id: string;
  name: string;
  total_users: number;
  total_agents: number;
  open_tickets: number;
  closed_tickets: number;
  tickets_per_month: { month: string; count: number }[];
  tickets_per_agent: { agent: string; count: number }[];
}

interface TicketWithAssignee {
  id: string;
  assigned_to: {
    id: string;
    full_name: string;
  } | null;
}

export default function AdminDashboard() {
  const [organizations, setOrganizations] = useState<OrgStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({
    total_users: 0,
    total_tickets: 0,
    total_orgs: 0,
    total_agents: 0,
  });
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [showAgentDetails, setShowAgentDetails] = useState(false);
  const [showTicketDetails, setShowTicketDetails] = useState(false);
  const [showOrgDetails, setShowOrgDetails] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchOrganizationStats();
  }, []);

  async function fetchOrganizationStats() {
    try {
      // Fetch organizations
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('*');

      if (orgsError) throw orgsError;

      const orgStats: OrgStats[] = [];
      let totalUsers = 0;
      let totalTickets = 0;

      // Get total agents count directly from profiles
      const { count: totalAgents } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('role', 'agent');

      // Fetch stats for each organization
      for (const org of orgs) {
        // Get users count
        const { count: usersCount } = await supabase
          .from('organization_users')
          .select('*', { count: 'exact' })
          .eq('organization_id', org.id);

        // Get agents count for this organization
        const { data: orgAgents } = await supabase
          .from('organization_users')
          .select(`
            user_id,
            profiles!inner(role)
          `)
          .eq('organization_id', org.id)
          .eq('profiles.role', 'agent');

        const agentsCount = orgAgents?.length || 0;

        // Get tickets stats
        const { data: tickets } = await supabase
          .from('tickets')
          .select('*')
          .eq('organization_id', org.id);

        const openTickets = tickets?.filter(t => t.status !== 'closed').length || 0;
        const closedTickets = tickets?.filter(t => t.status === 'closed').length || 0;

        // Calculate tickets per month
        const ticketsPerMonth = tickets?.reduce((acc: any, ticket) => {
          const month = new Date(ticket.created_at).toLocaleString('default', { month: 'long', year: 'numeric' });
          acc[month] = (acc[month] || 0) + 1;
          return acc;
        }, {});

        // Calculate tickets per agent
        const { data: ticketsPerAgent } = await supabase
          .from('tickets')
          .select(`
            id,
            assigned_to:profiles!tickets_assigned_to_fkey (
              id,
              full_name
            )
          `)
          .eq('organization_id', org.id);

        const agentTickets = ((ticketsPerAgent || []) as unknown as TicketWithAssignee[]).reduce((acc: any, ticket) => {
          const agentName = ticket.assigned_to?.full_name || 'Unassigned';
          acc[agentName] = (acc[agentName] || 0) + 1;
          return acc;
        }, {});

        orgStats.push({
          id: org.id,
          name: org.name,
          total_users: usersCount || 0,
          total_agents: agentsCount,
          open_tickets: openTickets,
          closed_tickets: closedTickets,
          tickets_per_month: Object.entries(ticketsPerMonth || {}).map(([month, count]) => ({
            month,
            count: count as number,
          })),
          tickets_per_agent: Object.entries(agentTickets || {}).map(([agent, count]) => ({
            agent,
            count: count as number,
          })),
        });

        totalUsers += usersCount || 0;
        totalTickets += (tickets?.length || 0);
      }

      setOrganizations(orgStats);
      setTotalStats({
        total_users: totalUsers,
        total_tickets: totalTickets,
        total_orgs: orgs.length,
        total_agents: totalAgents || 0,
      });
    } catch (error) {
      console.error('Error fetching organization stats:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleRefresh = async () => {
    setLoading(true);
    await fetchOrganizationStats();
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="space-y-6">
        <div className="sm:flex sm:items-center sm:justify-between">
          <div className="flex items-center space-x-4">
            <Logo size="large" />
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <svg 
                className={`-ml-1 mr-2 h-5 w-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>

            <button
              onClick={() => navigate('/add-agent')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Add Agent
            </button>
            
            <button
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Organization
            </button>

            <button
              onClick={handleSignOut}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </div>

        {/* Overall Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div 
            onClick={() => setShowUserDetails(true)}
            className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow duration-200"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {loading ? 'Loading...' : totalStats.total_users}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div 
            onClick={() => setShowAgentDetails(true)}
            className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow duration-200"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Agents</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {loading ? 'Loading...' : totalStats.total_agents}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div 
            onClick={() => setShowTicketDetails(true)}
            className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow duration-200"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Tickets</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {loading ? 'Loading...' : totalStats.total_tickets}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div 
            onClick={() => setShowOrgDetails(true)}
            className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow duration-200"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                  <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Organizations</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {loading ? 'Loading...' : totalStats.total_orgs}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Organizations List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">Organizations</h3>
            {loading ? (
              <div className="text-center py-4">Loading...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {organizations.map((org) => (
                  <div key={org.id} className="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xl font-semibold text-gray-900">{org.name}</h4>
                        <Link
                          to={`/organization/${org.id}`}
                          className="text-sm text-blue-600 hover:text-blue-900"
                        >
                          View Details →
                        </Link>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Users</span>
                          <span className="text-sm font-medium text-gray-900">{org.total_users}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-500">Agents</span>
                          <span className="text-sm font-medium text-gray-900">{org.total_agents}</span>
                        </div>
                        <div className="pt-3 border-t">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-500">Tickets</span>
                            <span className="text-sm font-medium text-gray-900">{org.open_tickets + org.closed_tickets} total</span>
                          </div>
                          <div className="flex space-x-4">
                            <div className="flex-1">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500">Open</span>
                                <span className="text-xs font-medium text-green-600">{org.open_tickets}</span>
                              </div>
                              <div className="mt-1 h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-green-500 rounded-full" 
                                  style={{ 
                                    width: `${(org.open_tickets / (org.open_tickets + org.closed_tickets)) * 100}%` 
                                  }}
                                />
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500">Closed</span>
                                <span className="text-xs font-medium text-blue-600">{org.closed_tickets}</span>
                              </div>
                              <div className="mt-1 h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500 rounded-full" 
                                  style={{ 
                                    width: `${(org.closed_tickets / (org.open_tickets + org.closed_tickets)) * 100}%` 
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 pt-3 border-t">
                            <button
                              onClick={() => navigate(`/assign-agents/${org.id}`)}
                              className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-500 hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                            >
                              <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                              </svg>
                              Assign Agents
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <UserDetailsModal
        isOpen={showUserDetails}
        onClose={() => setShowUserDetails(false)}
      />
      <AgentDetailsModal
        isOpen={showAgentDetails}
        onClose={() => setShowAgentDetails(false)}
      />
      <TicketDetailsModal
        isOpen={showTicketDetails}
        onClose={() => setShowTicketDetails(false)}
      />
      <OrganizationDetailsModal
        isOpen={showOrgDetails}
        onClose={() => setShowOrgDetails(false)}
      />
    </div>
  );
} 