import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import NewCustomerInviteModal from '../components/NewCustomerInviteModal';
import NewTicketModal from '../components/NewTicketModal';

interface Organization {
  id: string;
  name: string;
}

interface OrganizationDetailsProps {
  organization: Organization;
}

interface Metrics {
  totalTickets: number;
  activeUsers: number;
  avgResponseTime: string;
  openTickets: number;
}

interface Ticket {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  customer: {
    id: string;
    full_name: string;
  };
}

interface Customer {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  total_tickets: number;
}

interface TicketCount {
  count: number;
}

export default function OrganizationDetails({ organization }: OrganizationDetailsProps) {
  const { profile, user } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [closedTickets, setClosedTickets] = useState<Ticket[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (organization && user?.email) {
      checkUserRole();
      fetchOrganizationData();
    }
  }, [organization, user?.email]);

  async function checkUserRole() {
    if (!user?.email) return;
    
    const { data, error } = await supabase
      .from('organization_users')
      .select('is_creator')
      .eq('organization_id', organization.id)
      .eq('user_email', user.email)
      .single();

    if (error) {
      console.error('Error checking user role:', error);
      return;
    }

    console.log('User role check:', { email: user.email, isCreator: data?.is_creator });
    setIsOwner(data?.is_creator || false);
  }

  async function fetchOrganizationData() {
    try {
      setLoading(true);

      // Fetch all tickets for metrics calculation
      const { data: allTicketsData, error: allTicketsError } = await supabase
        .from('tickets')
        .select(`
          id,
          status,
          created_at,
          created_by,
          updated_at
        `)
        .eq('organization_id', organization.id);

      if (allTicketsError) throw allTicketsError;

      // Calculate metrics
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const totalTickets = allTicketsData?.length || 0;
      const openTickets = allTicketsData?.filter(t => t.status === 'open').length || 0;
      
      // Calculate average response time for closed tickets in last 30 days
      // Using updated_at as the resolution time for closed tickets
      const recentClosedTickets = allTicketsData?.filter(t => {
        const updatedDate = new Date(t.updated_at);
        return t.status === 'closed' && updatedDate >= thirtyDaysAgo;
      }) || [];
      
      const totalResponseTime = recentClosedTickets.reduce((sum, ticket) => {
        const created = new Date(ticket.created_at);
        const updated = new Date(ticket.updated_at);
        return sum + (updated.getTime() - created.getTime());
      }, 0);
      
      const avgResponseTimeMs = recentClosedTickets.length > 0 
        ? totalResponseTime / recentClosedTickets.length 
        : 0;
      
      // Convert to hours and minutes
      const avgResponseHours = Math.floor(avgResponseTimeMs / (1000 * 60 * 60));
      const avgResponseMinutes = Math.floor((avgResponseTimeMs % (1000 * 60 * 60)) / (1000 * 60));
      
      // Get unique active users (customers who have tickets in last 30 days)
      const recentTickets = allTicketsData?.filter(t => {
        const createdDate = new Date(t.created_at);
        return createdDate >= thirtyDaysAgo;
      }) || [];
      const activeUserIds = new Set(recentTickets.map(t => t.created_by));

      setMetrics({
        totalTickets,
        activeUsers: activeUserIds.size,
        avgResponseTime: `${avgResponseHours}h ${avgResponseMinutes}m`,
        openTickets,
      });

      // Fetch open tickets
      const { data: openTicketData, error: openTicketError } = await supabase
        .from('tickets')
        .select(`
          id,
          subject,
          status,
          priority,
          created_at,
          customer:created_by(
            id,
            full_name
          )
        `)
        .eq('organization_id', organization.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10);

      if (openTicketError) throw openTicketError;
      
      // Fetch closed tickets
      const { data: closedTicketData, error: closedTicketError } = await supabase
        .from('tickets')
        .select(`
          id,
          subject,
          status,
          priority,
          created_at,
          customer:created_by(
            id,
            full_name
          )
        `)
        .eq('organization_id', organization.id)
        .eq('status', 'closed')
        .order('created_at', { ascending: false })
        .limit(10);

      if (closedTicketError) throw closedTicketError;
      
      // Transform the data to match the Ticket interface
      const transformedOpenTickets = (openTicketData || []).map((ticket: any) => ({
        id: ticket.id,
        title: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        created_at: ticket.created_at,
        customer: {
          id: ticket.customer?.id || '',
          full_name: ticket.customer?.full_name || 'Unknown'
        }
      }));

      const transformedClosedTickets = (closedTicketData || []).map((ticket: any) => ({
        id: ticket.id,
        title: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        created_at: ticket.created_at,
        customer: {
          id: ticket.customer?.id || '',
          full_name: ticket.customer?.full_name || 'Unknown'
        }
      }));
      
      setTickets(transformedOpenTickets);
      setClosedTickets(transformedClosedTickets);

      // Only fetch customers if user is owner
      if (isOwner && user?.email) {
        console.log('Fetching customers for organization:', organization.id);
        // Get all organization users except the owner
        const { data: orgUsersData, error: orgUsersError } = await supabase
          .from('organization_users')
          .select(`
            user_email,
            status,
            role,
            created_at
          `)
          .eq('organization_id', organization.id)
          .eq('is_creator', false); // Only get non-creators

        if (orgUsersError) {
          console.error('Error fetching org users:', orgUsersError);
          console.error('Query params:', { organizationId: organization.id });
          setCustomers([]);
          return;
        }

        console.log('Found org users:', orgUsersData);

        if (orgUsersData && orgUsersData.length > 0) {
          // Get profiles for these users
          const { data: customerData, error: customerError } = await supabase
            .from('profiles')
            .select(`
              id,
              full_name,
              email:id,
              created_at,
              tickets!created_by(count)
            `)
            .in('id', orgUsersData.map(u => u.user_email));

          if (customerError) {
            console.error('Error fetching customer profiles:', customerError);
            setCustomers([]);
            return;
          }

          console.log('Found profiles:', customerData);

          const transformedCustomers = (customerData || []).map((customer: any) => ({
            id: customer.id,
            full_name: customer.full_name || 'Unknown',
            email: customer.email,
            created_at: customer.created_at,
            total_tickets: customer.tickets[0]?.count || 0
          }));

          console.log('Transformed customers:', transformedCustomers);
          setCustomers(transformedCustomers);
        } else {
          console.log('No org users found');
          setCustomers([]);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching organization data:', error);
      setLoading(false);
    }
  }

  const handleInviteSuccess = () => {
    fetchOrganizationData(); // Refresh the customers list
  };

  const handleTicketCreated = () => {
    fetchOrganizationData(); // Refresh the tickets list
    setShowNewTicketModal(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Regular user view
  if (!isOwner) {
    return (
      <div className="space-y-6">
        <NewTicketModal
          isOpen={showNewTicketModal}
          onClose={() => setShowNewTicketModal(false)}
          onSuccess={handleTicketCreated}
          organizationId={organization.id}
        />

        {/* Organization Header */}
        <div className="sm:flex sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">{organization.name}</h1>
          <div className="mt-4 sm:mt-0">
            <button
              onClick={() => setShowNewTicketModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create New Ticket
            </button>
          </div>
        </div>

        {/* Open Tickets */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Open Tickets</h3>
            <div className="mt-4">
              {tickets.length === 0 ? (
                <p className="text-gray-500">No open tickets</p>
              ) : (
                <div className="space-y-4">
                  {tickets.map((ticket) => (
                    <Link
                      key={ticket.id}
                      to={`/ticket/${ticket.id}`}
                      className={`block p-4 rounded-lg hover:bg-opacity-90 transition-colors duration-200 ${
                        ticket.priority === 'high' ? 'bg-red-50 border-l-4 border-red-500' :
                        ticket.priority === 'medium' ? 'bg-yellow-50 border-l-4 border-yellow-500' :
                        'bg-green-50 border-l-4 border-green-500'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className={`font-medium ${
                            ticket.priority === 'high' ? 'text-red-900' :
                            ticket.priority === 'medium' ? 'text-yellow-900' :
                            'text-green-900'
                          }`}>{ticket.title}</h4>
                          <div className="mt-1 text-sm text-gray-600">
                            Created by: {ticket.customer.full_name}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            ticket.priority === 'high' ? 'bg-red-100 text-red-800 border border-red-200' :
                            ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                            'bg-green-100 text-green-800 border border-green-200'
                          }`}>
                            {ticket.priority}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-600 space-x-4">
                        <span>Created: {new Date(ticket.created_at).toLocaleString()}</span>
                        <span>•</span>
                        <span>Status: {ticket.status}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Closed Tickets */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Closed Tickets</h3>
            <div className="mt-4">
              {closedTickets.length === 0 ? (
                <p className="text-gray-500">No closed tickets</p>
              ) : (
                <div className="space-y-4">
                  {closedTickets.map((ticket) => (
                    <Link
                      key={ticket.id}
                      to={`/ticket/${ticket.id}`}
                      className={`block p-4 rounded-lg hover:bg-opacity-90 transition-colors duration-200 ${
                        ticket.priority === 'high' ? 'bg-red-50/50 border-l-4 border-red-500' :
                        ticket.priority === 'medium' ? 'bg-yellow-50/50 border-l-4 border-yellow-500' :
                        'bg-green-50/50 border-l-4 border-green-500'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className={`font-medium ${
                            ticket.priority === 'high' ? 'text-red-900' :
                            ticket.priority === 'medium' ? 'text-yellow-900' :
                            'text-green-900'
                          }`}>{ticket.title}</h4>
                          <div className="mt-1 text-sm text-gray-600">
                            Created by: {ticket.customer.full_name}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            ticket.priority === 'high' ? 'bg-red-100 text-red-800 border border-red-200' :
                            ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                            'bg-green-100 text-green-800 border border-green-200'
                          }`}>
                            {ticket.priority}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-600 space-x-4">
                        <span>Closed: {new Date(ticket.created_at).toLocaleString()}</span>
                        <span>•</span>
                        <span>Status: {ticket.status}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Tickets */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Tickets</h3>
            <div className="mt-4">
              {tickets.length === 0 ? (
                <p className="text-gray-500">No recent tickets</p>
              ) : (
                <div className="space-y-4">
                  {tickets.map((ticket) => (
                    <div key={ticket.id} className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900">{ticket.title}</h4>
                      <div className="mt-2 flex items-center text-sm text-gray-500">
                        <span className="mr-2">Status: {ticket.status}</span>
                        <span className="mr-2">Priority: {ticket.priority}</span>
                        <span>Created: {new Date(ticket.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Owner view
  return (
    <div className="space-y-6">
      <NewCustomerInviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSuccess={handleInviteSuccess}
        organizationId={organization.id}
      />

      {/* Organization Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{organization.name}</h1>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Invite Customer
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Tickets</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">{metrics?.totalTickets}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Active Users</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">{metrics?.activeUsers}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Avg Response Time</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">{metrics?.avgResponseTime}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Open Tickets</dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">{metrics?.openTickets}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Open Tickets */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Open Tickets</h3>
            <button
              onClick={() => setShowNewTicketModal(true)}
              className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="-ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New Ticket
            </button>
          </div>
          <div className="mt-4">
            {tickets.length === 0 ? (
              <p className="text-gray-500">No open tickets</p>
            ) : (
              <div className="space-y-4">
                {tickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    to={`/ticket/${ticket.id}`}
                    className={`block p-4 rounded-lg hover:bg-opacity-90 transition-colors duration-200 ${
                      ticket.priority === 'high' ? 'bg-red-50 border-l-4 border-red-500' :
                      ticket.priority === 'medium' ? 'bg-yellow-50 border-l-4 border-yellow-500' :
                      'bg-green-50 border-l-4 border-green-500'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className={`font-medium ${
                          ticket.priority === 'high' ? 'text-red-900' :
                          ticket.priority === 'medium' ? 'text-yellow-900' :
                          'text-green-900'
                        }`}>{ticket.title}</h4>
                        <div className="mt-1 text-sm text-gray-600">
                          Created by: {ticket.customer.full_name}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          ticket.priority === 'high' ? 'bg-red-100 text-red-800 border border-red-200' :
                          ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                          'bg-green-100 text-green-800 border border-green-200'
                        }`}>
                          {ticket.priority}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-600 space-x-4">
                      <span>Created: {new Date(ticket.created_at).toLocaleString()}</span>
                      <span>•</span>
                      <span>Status: {ticket.status}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Closed Tickets */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Closed Tickets</h3>
          <div className="mt-4">
            {closedTickets.length === 0 ? (
              <p className="text-gray-500">No closed tickets</p>
            ) : (
              <div className="space-y-4">
                {closedTickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    to={`/ticket/${ticket.id}`}
                    className={`block p-4 rounded-lg hover:bg-opacity-90 transition-colors duration-200 ${
                      ticket.priority === 'high' ? 'bg-red-50/50 border-l-4 border-red-500' :
                      ticket.priority === 'medium' ? 'bg-yellow-50/50 border-l-4 border-yellow-500' :
                      'bg-green-50/50 border-l-4 border-green-500'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className={`font-medium ${
                          ticket.priority === 'high' ? 'text-red-900' :
                          ticket.priority === 'medium' ? 'text-yellow-900' :
                          'text-green-900'
                        }`}>{ticket.title}</h4>
                        <div className="mt-1 text-sm text-gray-600">
                          Created by: {ticket.customer.full_name}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          ticket.priority === 'high' ? 'bg-red-100 text-red-800 border border-red-200' :
                          ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                          'bg-green-100 text-green-800 border border-green-200'
                        }`}>
                          {ticket.priority}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-600 space-x-4">
                      <span>Closed: {new Date(ticket.created_at).toLocaleString()}</span>
                      <span>•</span>
                      <span>Status: {ticket.status}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Customers */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Customers</h3>
          <div className="mt-4">
            {customers.length === 0 ? (
              <p className="text-gray-500">No customers yet</p>
            ) : (
              <div className="space-y-4">
                {customers.map((customer) => (
                  <div key={customer.id} className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900">{customer.full_name}</h4>
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                      <span className="mr-2">Email: {customer.email}</span>
                      <span>Total Tickets: {customer.total_tickets}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 