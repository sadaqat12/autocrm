import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import NewCustomerInviteModal from '../components/NewCustomerInviteModal';
import NewTicketModal from '../components/NewTicketModal';
import { Organization, OrgRole } from '../lib/types';
import Navbar from '../components/Navbar';
import { commonStyles } from '../styles/theme';

interface OrganizationDetailsProps {
  organization: Organization;
}

interface Metrics {
  totalTickets: number;
  activeUsers: number;
  avgResponseTime: string;
  openTickets: number;
}

interface Customer {
  id: string;
  full_name: string;
  created_at: string;
  total_tickets: number;
}

interface TicketCreator {
  id: string;
  full_name: string;
}

interface Ticket {
  id: string;
  organization_id: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  updated_at: string;
  created_by: TicketCreator;
}

interface OrganizationOwner {
  id: string;
  full_name: string;
  created_at: string;
}

interface Agent {
  id: string;
  full_name: string;
  created_at: string;
}

// Add interface for Supabase response
interface SupabaseUserWithProfile {
  user_id: string;
  profiles: {
    id: string;
    full_name: string;
    created_at: string;
  };
}

export default function OrganizationDetails({ organization }: OrganizationDetailsProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [closedTickets, setClosedTickets] = useState<Ticket[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [owner, setOwner] = useState<OrganizationOwner | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [userRole, setUserRole] = useState<OrgRole | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (organization && profile?.id) {
      checkUserRole();
      fetchOrganizationData();
    }
  }, [organization, profile?.id]);

  async function checkUserRole() {
    if (!profile?.id) return;
    
    const { data, error } = await supabase
      .from('organization_users')
      .select('role, status')
      .eq('organization_id', organization.id)
      .eq('user_id', profile.id)
      .eq('status', 'accepted');

    if (error) {
      console.error('Error checking user role:', error);
      return;
    }

    if (!data || data.length === 0) {
      setUserRole(null);
      return;
    }

    setUserRole(data[0].role || null);
  }

  async function fetchOrganizationData() {
    try {
      setLoading(true);

      // Check if user is a system admin
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', profile?.id)
        .single();
      
      setIsAdmin(profileData?.role === 'admin');

      // Fetch open tickets with full details
      const { data: openTicketData, error: openTicketError } = await supabase
        .from('tickets')
        .select(`
          id,
          organization_id,
          subject,
          status,
          priority,
          category,
          created_at,
          updated_at,
          created_by:profiles!tickets_created_by_fkey(
            id,
            full_name
          )
        `)
        .eq('organization_id', organization.id)
        .neq('status', 'closed')
        .order('created_at', { ascending: false });

      if (openTicketError) throw openTicketError;
      
      // Fetch closed tickets with full details
      const { data: closedTicketData, error: closedTicketError } = await supabase
        .from('tickets')
        .select(`
          id,
          organization_id,
          subject,
          status,
          priority,
          category,
          created_at,
          updated_at,
          created_by:profiles!tickets_created_by_fkey(
            id,
            full_name
          )
        `)
        .eq('organization_id', organization.id)
        .eq('status', 'closed')
        .order('created_at', { ascending: false });

      if (closedTicketError) throw closedTicketError;

      // Get total tickets count
      const totalTickets = (openTicketData?.length || 0) + (closedTicketData?.length || 0);

      // Get active customers count
      const { count: activeUsers, error: activeUsersError } = await supabase
        .from('organization_users')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .eq('status', 'accepted')
        .eq('role', 'member');

      if (activeUsersError) throw activeUsersError;

      // Calculate average response time
      const allTickets = [...(openTicketData || []), ...(closedTicketData || [])];
      const ticketIds = allTickets.map(t => t.id);

      // Get all messages for these tickets
      const { data: messages, error: messagesError } = await supabase
        .from('ticket_messages')
        .select('ticket_id, created_at, created_by')
        .in('ticket_id', ticketIds)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      // Get all staff IDs (agents and owners)
      const { data: orgStaff, error: orgStaffError } = await supabase
        .from('organization_users')
        .select('user_id')
        .eq('organization_id', organization.id)
        .eq('status', 'accepted')
        .in('role', ['admin', 'owner']);

      if (orgStaffError) throw orgStaffError;

      const staffIds = orgStaff?.map(staff => staff.user_id) || [];

      // Calculate average response time
      let totalResponseTime = 0;
      let ticketsWithResponses = 0;

      allTickets.forEach(ticket => {
        const ticketCreatedAt = new Date(ticket.created_at).getTime();
        const ticketMessages = messages?.filter(m => m.ticket_id === ticket.id) || [];
        
        // Find first response from staff (agent or owner)
        const firstStaffResponse = ticketMessages.find(m => staffIds.includes(m.created_by));
        
        if (firstStaffResponse) {
          const responseTime = new Date(firstStaffResponse.created_at).getTime() - ticketCreatedAt;
          if (responseTime > 0) { // Only count valid response times
            totalResponseTime += responseTime;
            ticketsWithResponses++;
          }
        }
      });

      const avgResponseTimeMs = ticketsWithResponses > 0 ? totalResponseTime / ticketsWithResponses : 0;
      let avgResponseTime = '0h';

      if (avgResponseTimeMs > 0) {
        const hours = Math.floor(avgResponseTimeMs / (1000 * 60 * 60));
        const minutes = Math.floor((avgResponseTimeMs % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
          avgResponseTime = `${hours}h ${minutes}m`;
        } else {
          avgResponseTime = `${minutes}m`;
        }
      }

      // Set metrics
      setMetrics({
        totalTickets,
        openTickets: openTicketData?.length || 0,
        activeUsers: activeUsers || 0,
        avgResponseTime
      });

      // Transform and set tickets
      const transformedOpenTickets = (openTicketData || []).map((ticket: any): Ticket => ({
        id: ticket.id,
        organization_id: ticket.organization_id,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
        created_by: {
          id: ticket.created_by.id,
          full_name: ticket.created_by.full_name
        }
      }));

      const transformedClosedTickets = (closedTicketData || []).map((ticket: any): Ticket => ({
        id: ticket.id,
        organization_id: ticket.organization_id,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
        created_by: {
          id: ticket.created_by.id,
          full_name: ticket.created_by.full_name
        }
      }));

      setTickets(transformedOpenTickets);
      setClosedTickets(transformedClosedTickets);

      // Fetch customers (organization users)
      const { data: customerData, error: customerError } = await supabase
        .from('organization_users')
        .select(`
          user_id,
          profiles:profiles!organization_users_user_id_fkey (
            id,
            full_name,
            created_at
          )
        `)
        .eq('organization_id', organization.id)
        .eq('status', 'accepted')
        .eq('role', 'member');

      if (customerError) throw customerError;

      // Fetch organization owner
      const { data: ownerData } = await supabase
        .from('organization_users')
        .select(`
          user_id,
          profiles:profiles!organization_users_user_id_fkey (
            id,
            full_name,
            created_at
          )
        `)
        .eq('organization_id', organization.id)
        .eq('role', 'owner')
        .eq('status', 'accepted')
        .single();

      if (ownerData) {
        const owner = ownerData as unknown as SupabaseUserWithProfile;
        setOwner({
          id: owner.profiles.id,
          full_name: owner.profiles.full_name,
          created_at: owner.profiles.created_at
        });
      }

      // Fetch organization agents
      const { data: agentData } = await supabase
        .from('organization_users')
        .select(`
          user_id,
          profiles:profiles!organization_users_user_id_fkey (
            id,
            full_name,
            created_at
          )
        `)
        .eq('organization_id', organization.id)
        .eq('role', 'admin')
        .eq('status', 'accepted');

      if (agentData) {
        const agents = agentData as unknown as SupabaseUserWithProfile[];
        const transformedAgents = agents.map(agent => ({
          id: agent.profiles.id,
          full_name: agent.profiles.full_name,
          created_at: agent.profiles.created_at
        }));
        setAgents(transformedAgents);
      }

      // Get ticket counts for each customer
      const customerTicketCounts = await Promise.all(
        (customerData || []).map(async (customer: any) => {
          const customerProfile = customer.profiles as unknown as { id: string; full_name: string; created_at: string };
          const { data: ticketCount } = await supabase
            .from('tickets')
            .select('id', { count: 'exact' })
            .eq('created_by', customerProfile.id);

          return {
            id: customerProfile.id,
            full_name: customerProfile.full_name,
            created_at: customerProfile.created_at,
            total_tickets: ticketCount?.length || 0
          };
        })
      );

      setCustomers(customerTicketCounts);

    } catch (error: any) {
      console.error('Error fetching organization data:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleInviteSuccess = () => {
    fetchOrganizationData();
  };

  const handleTicketCreated = () => {
    fetchOrganizationData();
    setShowNewTicketModal(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const canManageOrg = userRole === 'owner' || userRole === 'admin';

  const createTicketAction = {
    label: 'Create Ticket',
    icon: (
      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
    onClick: () => setShowNewTicketModal(true)
  };

  const inviteCustomerAction = {
    label: 'Invite Customer',
    icon: (
      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
    onClick: () => setShowInviteModal(true)
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

  const navbarActions = [
    backToDashboardAction,
    createTicketAction,
    ...(canManageOrg ? [inviteCustomerAction] : [])
  ];

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

      <div className="relative z-10 space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Logo and Navigation */}
        <Navbar
          title="Organization Details"
          actions={navbarActions}
        />

        {/* Organization Info */}
        <div className={commonStyles.card}>
          <div className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className={commonStyles.heading}>{organization.name}</h1>
                <p className={`${commonStyles.text} mt-1`}>
                  Created on {new Date(organization.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        {(canManageOrg || isAdmin) && metrics && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className={commonStyles.cardWithHover}>
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10">
                    <svg className="h-6 w-6 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className={`${commonStyles.text} truncate`}>Total Tickets</dt>
                      <dd className="text-2xl font-semibold text-white">{metrics.totalTickets}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className={commonStyles.cardWithHover}>
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10">
                    <svg className="h-6 w-6 text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className={`${commonStyles.text} truncate`}>Active Customers</dt>
                      <dd className="text-2xl font-semibold text-white">{metrics.activeUsers}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className={commonStyles.cardWithHover}>
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10">
                    <svg className="h-6 w-6 text-yellow-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className={`${commonStyles.text} truncate`}>Avg. Response Time</dt>
                      <dd className="text-2xl font-semibold text-white">{metrics.avgResponseTime}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className={commonStyles.cardWithHover}>
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-red-500/20 to-pink-500/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10">
                    <svg className="h-6 w-6 text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className={`${commonStyles.text} truncate`}>Open Tickets</dt>
                      <dd className="text-2xl font-semibold text-white">{metrics.openTickets}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin-only Organization Owner Info */}
        {isAdmin && owner && (
          <div className={commonStyles.card}>
            <div className="p-6">
              <div className="flex justify-between items-center">
                <h3 className={commonStyles.heading}>Organization Owner</h3>
              </div>
              <div className="mt-4">
                <div className={commonStyles.cardWithHover}>
                  <div className="p-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10">
                        <span className="text-blue-400 font-medium text-lg">
                          {owner.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-4">
                        <h4 className={`${commonStyles.text} font-medium`}>{owner.full_name}</h4>
                        <div className="mt-1 text-sm text-gray-400">
                          Member since: {new Date(owner.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin-only Assigned Agents */}
        {isAdmin && (
          <div className={commonStyles.card}>
            <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <h3 className={commonStyles.heading}>Assigned Agents</h3>
                <div className={`${commonStyles.buttonPrimary.wrapper} max-w-[200px]`}>
                  <div className={commonStyles.buttonPrimary.gradient} />
                  <Link
                    to={`/assign-agents/${organization.id}`}
                    className={`${commonStyles.buttonPrimary.content} !py-2`}
                  >
                    <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Manage Agents
                  </Link>
                </div>
              </div>
              <div className="mt-4">
                {agents.length === 0 ? (
                  <div className={commonStyles.messageBox.info}>
                    <p>No agents assigned</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {agents.map((agent) => (
                      <div key={agent.id} className={commonStyles.cardWithHover}>
                        <div className="p-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10">
                              <span className="text-yellow-400 font-medium text-lg">
                                {agent.full_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="ml-4">
                              <h4 className={`${commonStyles.text} font-medium`}>{agent.full_name}</h4>
                              <div className="mt-1 text-sm text-gray-400">
                                Assigned since: {new Date(agent.created_at).toLocaleDateString()}
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
        )}

        {/* Tickets Section */}
        <div className={commonStyles.card}>
          <div className="p-6">
            <h3 className={commonStyles.heading}>Tickets</h3>
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Open Tickets */}
              <div>
                <h4 className={`${commonStyles.text} font-medium mb-3`}>Open Tickets</h4>
                {tickets.length === 0 ? (
                  <div className={commonStyles.messageBox.info}>
                    <p>No open tickets</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tickets.map((ticket) => (
                      <Link
                        key={ticket.id}
                        to={`/ticket/${ticket.id}`}
                        className={commonStyles.cardWithHover}
                      >
                        <div className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className={`flex-shrink-0 w-2 h-2 rounded-full ${
                                ticket.priority === 'high' ? 'bg-red-400' :
                                ticket.priority === 'medium' ? 'bg-yellow-400' :
                                'bg-green-400'
                              }`} />
                              <div>
                                <h5 className={`${commonStyles.text} font-medium`}>{ticket.subject}</h5>
                                <p className="text-sm text-gray-400">
                                  Created by: {ticket.created_by.full_name}
                                </p>
                              </div>
                            </div>
                            <div className="text-sm text-gray-400">
                              {new Date(ticket.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Closed Tickets */}
              <div>
                <h4 className={`${commonStyles.text} font-medium mb-3`}>Closed Tickets</h4>
                {closedTickets.length === 0 ? (
                  <div className={commonStyles.messageBox.info}>
                    <p>No closed tickets</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {closedTickets.map((ticket) => (
                      <Link
                        key={ticket.id}
                        to={`/ticket/${ticket.id}`}
                        className={commonStyles.cardWithHover}
                      >
                        <div className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex-shrink-0 w-2 h-2 rounded-full bg-gray-400" />
                              <div>
                                <h5 className={`${commonStyles.text} font-medium`}>{ticket.subject}</h5>
                                <p className="text-sm text-gray-400">
                                  Created by: {ticket.created_by.full_name}
                                </p>
                              </div>
                            </div>
                            <div className="text-sm text-gray-400">
                              {new Date(ticket.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Customers Section */}
        {(canManageOrg || isAdmin) && (
          <div className={commonStyles.card}>
            <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <h3 className={commonStyles.heading}>Customers</h3>
                {canManageOrg && (
                  <div className={`${commonStyles.buttonPrimary.wrapper} w-full sm:w-auto max-w-[200px]`}>
                    <div className={commonStyles.buttonPrimary.gradient} />
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className={`${commonStyles.buttonPrimary.content} !py-2`}
                    >
                      <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      Invite Customer
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-4">
                {customers.length === 0 ? (
                  <div className={commonStyles.messageBox.info}>
                    <p>No customers yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {customers.map((customer) => (
                      <div key={customer.id} className={commonStyles.cardWithHover}>
                        <div className="p-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/10">
                              <span className="text-blue-400 font-medium text-lg">
                                {customer.full_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="ml-4">
                              <h4 className={`${commonStyles.text} font-medium`}>{customer.full_name}</h4>
                              <div className="mt-1 text-sm text-gray-400">
                                <div>Total Tickets: {customer.total_tickets}</div>
                                <div>Joined: {new Date(customer.created_at).toLocaleDateString()}</div>
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
        )}
      </div>

      <NewTicketModal
        isOpen={showNewTicketModal}
        onClose={() => setShowNewTicketModal(false)}
        onSuccess={handleTicketCreated}
        organizationId={organization.id}
      />

      {canManageOrg && (
        <NewCustomerInviteModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          onSuccess={handleInviteSuccess}
          organizationId={organization.id}
        />
      )}
    </div>
  );
} 