import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Logo from '../../components/Logo';
import Navbar from '../../components/Navbar';
import UserDetailsModal from '../../components/UserDetailsModal';
import AgentDetailsModal from '../../components/AgentDetailsModal';
import TicketDetailsModal from '../../components/TicketDetailsModal';
import OrganizationDetailsModal from '../../components/OrganizationDetailsModal';
import { commonStyles } from '../../styles/theme';

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
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const navigate = useNavigate();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    fetchOrganizationStats();
  }, []);

  async function fetchOrganizationStats() {
    try {
      setLoading(true);

      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('No authenticated user');

      // First check if the current user is an admin
      const { data: currentUser, error: userError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      const isAdmin = currentUser?.role === 'admin';

      // Fetch organizations - if admin, fetch all, otherwise only associated ones
      const organizationsQuery = supabase
        .from('organizations')
        .select('*');

      if (!isAdmin) {
        const { data: userOrgIds } = await supabase
          .from('organization_users')
          .select('organization_id')
          .eq('user_id', user.id);

        organizationsQuery.in('id', userOrgIds?.map(org => org.organization_id) || []);
      }

      const { data: orgs, error: orgsError } = await organizationsQuery;

      if (orgsError) throw orgsError;

      const orgStats: OrgStats[] = [];
      let totalUsers = 0;
      let totalTickets = 0;

      // Get total agents count directly from profiles
      const { count: totalAgents } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('role', 'agent');

      // First fetch all tickets since admin has access to all
      const { data: allTickets, error: ticketsError } = await supabase
        .from('tickets')
        .select(`
          *,
          first_response_at,
          organization:organizations(*),
          created_by_profile:profiles!tickets_created_by_fkey(*),
          assigned_to_profile:profiles!tickets_assigned_to_fkey(*)
        `);

      if (ticketsError) throw ticketsError;

      // Fetch stats for each organization
      for (const org of orgs || []) {
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

        // Filter tickets for this organization
        const orgTickets = allTickets?.filter(t => t.organization_id === org.id) || [];
        const openTickets = orgTickets.filter(t => t.status !== 'closed').length;
        const closedTickets = orgTickets.filter(t => t.status === 'closed').length;

        // Calculate tickets per month
        const ticketsPerMonth = orgTickets.reduce((acc: any, ticket) => {
          const month = new Date(ticket.created_at).toLocaleString('default', { month: 'long', year: 'numeric' });
          acc[month] = (acc[month] || 0) + 1;
          return acc;
        }, {});

        // Calculate tickets per agent using the full profile data
        const agentTickets = orgTickets.reduce((acc: any, ticket) => {
          const agentName = ticket.assigned_to_profile?.full_name || 'Unassigned';
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
        totalTickets += orgTickets.length;
      }

      setOrganizations(orgStats);
      setTotalStats({
        total_users: totalUsers,
        total_tickets: allTickets?.length || 0, // Use total tickets count for admins
        total_orgs: orgs?.length || 0,
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

  const addAgentAction = {
    label: 'Add Agent',
    icon: (
      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
    onClick: () => navigate('/add-agent')
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

      <div className="relative z-10 p-8 max-w-7xl mx-auto space-y-6">
        <Navbar
          title="Admin Dashboard"
          showRefresh={true}
          onRefresh={handleRefresh}
          isLoading={loading}
          actions={[addAgentAction]}
        />

        {/* Overall Stats */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div 
            onClick={() => setShowUserDetails(true)}
            className={`${commonStyles.cardWithHover} cursor-pointer`}
          >
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10">
                  <svg className="h-6 w-6 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className={`${commonStyles.text} truncate`}>Total Users</dt>
                    <dd className="text-2xl font-semibold text-white">
                      {loading ? 'Loading...' : totalStats.total_users}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div 
            onClick={() => setShowAgentDetails(true)}
            className={`${commonStyles.cardWithHover} cursor-pointer`}
          >
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10">
                  <svg className="h-6 w-6 text-yellow-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className={`${commonStyles.text} truncate`}>Total Agents</dt>
                    <dd className="text-2xl font-semibold text-white">
                      {loading ? 'Loading...' : totalStats.total_agents}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div 
            onClick={() => setShowTicketDetails(true)}
            className={`${commonStyles.cardWithHover} cursor-pointer`}
          >
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10">
                  <svg className="h-6 w-6 text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className={`${commonStyles.text} truncate`}>Total Tickets</dt>
                    <dd className="text-2xl font-semibold text-white">
                      {loading ? 'Loading...' : totalStats.total_tickets}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div 
            onClick={() => setShowOrgDetails(true)}
            className={`${commonStyles.cardWithHover} cursor-pointer`}
          >
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10">
                  <svg className="h-6 w-6 text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className={`${commonStyles.text} truncate`}>Total Organizations</dt>
                    <dd className="text-2xl font-semibold text-white">
                      {loading ? 'Loading...' : totalStats.total_orgs}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Organizations List */}
        <div className={commonStyles.card}>
          <div className="p-6">
            <h3 className={`${commonStyles.heading} mb-6`}>Organizations</h3>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
              </div>
            ) : organizations.length === 0 ? (
              <div className={commonStyles.messageBox.info}>
                <p>No organizations found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {organizations.map((org) => (
                  <div key={org.id} className={commonStyles.cardWithHover}>
                    <div className="p-6">
                      <div className="flex items-center mb-4">
                        <div className="flex items-center min-w-0 flex-1">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10">
                            <span className="text-blue-400 font-medium text-lg">
                              {org.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <h4 className={`${commonStyles.text} font-medium truncate ml-3`}>
                            {org.name}
                          </h4>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Users</span>
                          <span className="text-sm font-medium text-white">{org.total_users}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Agents</span>
                          <span className="text-sm font-medium text-white">{org.total_agents}</span>
                        </div>
                        <div className="pt-3 border-t border-white/10">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-gray-400">Tickets</span>
                            <span className="text-sm font-medium text-white">{org.open_tickets + org.closed_tickets} total</span>
                          </div>
                          <div className="flex space-x-4">
                            <div className="flex-1">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-400">Open</span>
                                <span className="text-xs font-medium text-green-400">{org.open_tickets}</span>
                              </div>
                              <div className="mt-1 h-1.5 w-full bg-black/20 rounded-full overflow-hidden backdrop-blur-xl">
                                <div 
                                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full" 
                                  style={{ 
                                    width: `${(org.open_tickets / (org.open_tickets + org.closed_tickets)) * 100}%` 
                                  }}
                                />
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-400">Closed</span>
                                <span className="text-xs font-medium text-blue-400">{org.closed_tickets}</span>
                              </div>
                              <div className="mt-1 h-1.5 w-full bg-black/20 rounded-full overflow-hidden backdrop-blur-xl">
                                <div 
                                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" 
                                  style={{ 
                                    width: `${(org.closed_tickets / (org.open_tickets + org.closed_tickets)) * 100}%` 
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 pt-3 border-t border-white/10">
                            <div className="space-y-3">
                              <div className={commonStyles.buttonPrimary.wrapper}>
                                <div className={commonStyles.buttonPrimary.gradient} />
                                <Link
                                  to={`/organization/${org.id}`}
                                  className={`${commonStyles.buttonPrimary.content} w-full !py-2`}
                                >
                                  <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  View Details
                                </Link>
                              </div>
                              <div className={commonStyles.buttonPrimary.wrapper}>
                                <div className={commonStyles.buttonPrimary.gradient} />
                                <button
                                  onClick={() => navigate(`/assign-agents/${org.id}`)}
                                  className={`${commonStyles.buttonPrimary.content} w-full !py-2`}
                                >
                                  <svg className="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                  </svg>
                                  Assign Agents
                                </button>
                              </div>
                            </div>
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
        ticketId={selectedTicketId}
      />
      <OrganizationDetailsModal
        isOpen={showOrgDetails}
        onClose={() => setShowOrgDetails(false)}
      />
    </div>
  );
} 