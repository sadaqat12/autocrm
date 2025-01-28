import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Logo from '../../components/Logo';
import { useAuth } from '../../lib/AuthContext';
import { Organization } from '../../lib/types';

interface Customer {
  id: string;
  full_name: string;
}

interface TicketResponse {
  id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'closed';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
  first_response_at: string | null;
  created_by: string;
  customer: Customer;
  organization: Organization;
}

interface AgentStats {
  total_tickets: number;
  open_tickets: number;
  closed_tickets: number;
  avg_response_time: number;
  avg_resolution_time: number;
  satisfaction_rate: number;
}

export default function AgentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [myTickets, setMyTickets] = useState<TicketResponse[]>([]);
  const [availableTickets, setAvailableTickets] = useState<TicketResponse[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'open' | 'in_progress' | 'closed'>('all');
  const [selectedPriority, setSelectedPriority] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [viewMode, setViewMode] = useState<'assigned' | 'available'>('assigned');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  async function fetchDashboardData() {
    try {
      setLoading(true);

      // First, get the organizations this agent is assigned to
      const { data: agentOrgs, error: agentOrgsError } = await supabase
        .from('agent_organizations')
        .select('organization_id')
        .eq('agent_id', user?.id);

      if (agentOrgsError) throw agentOrgsError;

      const orgIds = agentOrgs?.map(ao => ao.organization_id) || [];

      // Fetch agent's assigned tickets
      const { data: assignedTicketsData, error: assignedTicketsError } = await supabase
        .from('tickets')
        .select(`
          id,
          subject,
          status,
          priority,
          created_at,
          updated_at,
          first_response_at,
          created_by,
          organization:organizations!inner(*)
        `)
        .eq('assigned_to', user?.id)
        .order('created_at', { ascending: false });

      if (assignedTicketsError) throw assignedTicketsError;

      // Fetch available tickets (unassigned tickets in agent's organizations)
      const { data: availableTicketsData, error: availableTicketsError } = await supabase
        .from('tickets')
        .select(`
          id,
          subject,
          status,
          priority,
          created_at,
          updated_at,
          first_response_at,
          created_by,
          organization:organizations!inner(*)
        `)
        .is('assigned_to', null)
        .in('organization_id', orgIds)
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (availableTicketsError) throw availableTicketsError;

      // Fetch customer information for all tickets
      const allTickets = [...(assignedTicketsData || []), ...(availableTicketsData || [])];
      const customerIds = [...new Set(allTickets.map(t => t.created_by))];
      const { data: customersData, error: customersError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', customerIds);

      if (customersError) throw customersError;

      // Process assigned tickets
      const processedAssignedTickets = (assignedTicketsData || []).map((ticket: any) => ({
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
        first_response_at: ticket.first_response_at,
        created_by: ticket.created_by,
        customer: customersData?.find(c => c.id === ticket.created_by) || {
          id: ticket.created_by,
          full_name: 'Unknown Customer'
        },
        organization: {
          id: ticket.organization.id,
          name: ticket.organization.name
        }
      })) as TicketResponse[];

      // Process available tickets
      const processedAvailableTickets = (availableTicketsData || []).map((ticket: any) => ({
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
        first_response_at: ticket.first_response_at,
        created_by: ticket.created_by,
        customer: customersData?.find(c => c.id === ticket.created_by) || {
          id: ticket.created_by,
          full_name: 'Unknown Customer'
        },
        organization: {
          id: ticket.organization.id,
          name: ticket.organization.name
        }
      })) as TicketResponse[];

      setMyTickets(processedAssignedTickets);
      setAvailableTickets(processedAvailableTickets);

      // Calculate agent stats
      const totalTickets = processedAssignedTickets.length;
      const openTickets = processedAssignedTickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
      const closedTickets = processedAssignedTickets.filter(t => t.status === 'closed').length;

      // Calculate average response time
      const ticketsWithResponse = processedAssignedTickets.filter(t => t.first_response_at !== null);
      const avgResponseTime = ticketsWithResponse.length
        ? ticketsWithResponse.reduce((sum, t) => {
            const responseTime = new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime();
            return sum + responseTime;
          }, 0) / ticketsWithResponse.length / (1000 * 60 * 60) // Convert to hours
        : 0;

      setStats({
        total_tickets: totalTickets,
        open_tickets: openTickets,
        closed_tickets: closedTickets,
        avg_response_time: Math.round(avgResponseTime * 10) / 10, // Round to 1 decimal place
        avg_resolution_time: 0,
        satisfaction_rate: 0
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoading(false);
    }
  }

  const filteredTickets = (viewMode === 'assigned' ? myTickets : availableTickets).filter(ticket => {
    const statusMatch = selectedFilter === 'all' || ticket.status === selectedFilter;
    const priorityMatch = selectedPriority === 'all' || ticket.priority === selectedPriority;
    return statusMatch && priorityMatch;
  });

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleAcceptTicket = async (ticketId: string) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('tickets')
        .update({
          assigned_to: user?.id
        })
        .eq('id', ticketId);

      if (error) throw error;

      // Refresh the dashboard data
      await fetchDashboardData();
    } catch (error) {
      console.error('Error accepting ticket:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900 relative overflow-hidden">
      {/* Tech-inspired background patterns */}
      <div className="absolute inset-0 z-0 opacity-30">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        <div className="absolute h-screen w-screen bg-[linear-gradient(to_right,rgba(55,65,81,0)_1px,transparent_1px),linear-gradient(to_bottom,rgba(55,65,81,0)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]"></div>
      </div>

      {/* Animated gradients */}
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-r from-blue-500/30 to-cyan-500/30 rounded-full mix-blend-screen filter blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-full mix-blend-screen filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-indigo-500/30 to-blue-500/30 rounded-full mix-blend-screen filter blur-3xl opacity-50 animate-pulse"></div>
      </div>

      <div className="relative z-10">
        {/* Navbar */}
        <nav className="bg-black/30 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Logo size="large" className="text-white" />
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center px-4 py-2 border border-white/10 rounded-md shadow-sm text-sm font-medium text-white bg-black/20 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 backdrop-blur-xl transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Overview */}
          {!loading && stats && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-8">
              <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-lg overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500/20 text-blue-400">
                        <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-300 truncate">Tickets</dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-white">{stats.total_tickets}</div>
                          <div className="ml-2">
                            <span className="text-green-400 text-sm">
                              {stats.open_tickets} open
                            </span>
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-lg overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center h-12 w-12 rounded-md bg-green-500/20 text-green-400">
                        <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-300 truncate">Response Time</dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-white">{stats.avg_response_time}h</div>
                          <div className="ml-2">
                            <span className="text-gray-400 text-sm">
                              average
                            </span>
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-lg overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center h-12 w-12 rounded-md bg-yellow-500/20 text-yellow-400">
                        <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-300 truncate">Satisfaction Rate</dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-white">{stats.satisfaction_rate}%</div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-lg mb-8">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0 mb-4 sm:mb-0">
                  <select
                    value={selectedFilter}
                    onChange={(e) => setSelectedFilter(e.target.value as any)}
                    className="block w-full pl-3 pr-10 py-2 text-sm text-white bg-black/20 border border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 backdrop-blur-xl"
                  >
                    <option value="all">All Status</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="closed">Closed</option>
                  </select>

                  <select
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value as any)}
                    className="block w-full pl-3 pr-10 py-2 text-sm text-white bg-black/20 border border-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 backdrop-blur-xl"
                  >
                    <option value="all">All Priority</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <button
                  onClick={fetchDashboardData}
                  className="inline-flex items-center px-4 py-2 border border-white/10 rounded-md shadow-sm text-sm font-medium text-white bg-black/20 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 backdrop-blur-xl transition-colors"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Tickets List */}
          <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              {/* View Mode Toggle */}
              <div className="flex justify-center mb-6">
                <div className="inline-flex rounded-md shadow-sm backdrop-blur-xl" role="group">
                  <button
                    type="button"
                    onClick={() => setViewMode('assigned')}
                    className={`px-4 py-2 text-sm font-medium rounded-l-lg border border-white/10 backdrop-blur-xl transition-colors ${
                      viewMode === 'assigned'
                        ? 'bg-blue-600 text-white'
                        : 'bg-black/20 text-white hover:bg-white/10'
                    }`}
                  >
                    My Tickets
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('available')}
                    className={`px-4 py-2 text-sm font-medium rounded-r-lg border border-white/10 backdrop-blur-xl transition-colors ${
                      viewMode === 'available'
                        ? 'bg-blue-600 text-white'
                        : 'bg-black/20 text-white hover:bg-white/10'
                    }`}
                  >
                    Available Tickets ({availableTickets.length})
                  </button>
                </div>
              </div>

              <h2 className="text-lg font-medium text-white mb-4">
                {viewMode === 'assigned' ? 'My Tickets' : 'Available Tickets'}
              </h2>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No tickets found
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="bg-black/20 border border-white/10 rounded-lg backdrop-blur-xl hover:bg-white/5 transition-colors duration-200 cursor-pointer"
                      onClick={() => navigate(`/ticket/${ticket.id}`)}
                    >
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-sm font-medium text-white line-clamp-2">{ticket.subject}</h3>
                          {viewMode === 'available' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcceptTicket(ticket.id);
                              }}
                              disabled={saving}
                              className="ml-2 inline-flex items-center px-2.5 py-1.5 border border-white/10 text-xs font-medium rounded text-white bg-blue-600/80 hover:bg-blue-700/80 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-xl transition-colors"
                            >
                              {saving ? 'Accepting...' : 'Accept'}
                            </button>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full backdrop-blur-xl
                            ${ticket.status === 'open' ? 'bg-green-500/20 text-green-400' : 
                              ticket.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-400' : 
                              'bg-gray-500/20 text-gray-400'}`}>
                            {ticket.status.replace('_', ' ')}
                          </span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full backdrop-blur-xl
                            ${ticket.priority === 'high' ? 'bg-red-500/20 text-red-400' : 
                              ticket.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 
                              'bg-blue-500/20 text-blue-400'}`}>
                            {ticket.priority}
                          </span>
                        </div>

                        <div className="text-sm text-gray-400">
                          <div className="flex items-center mb-1">
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            {ticket.organization.name}
                          </div>
                          <div className="flex items-center mb-1">
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {ticket.customer.full_name}
                          </div>
                          <div className="flex items-center">
                            <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {new Date(ticket.updated_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}