import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import NewCustomerInviteModal from '../components/NewCustomerInviteModal';
import NewTicketModal from '../components/NewTicketModal';
import { Organization, OrgRole } from '../lib/types';

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

interface CustomerProfile {
  id: string;
  full_name: string;
  created_at: string;
}

interface CustomerData {
  user_id: string;
  profiles: CustomerProfile;
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

interface SupabaseTicketResponse {
  id: string;
  organization_id: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  updated_at: string;
  created_by: {
    id: string;
    full_name: string;
  };
}

interface SupabaseCustomerResponse {
  user_id: string;
  profiles: {
    id: string;
    full_name: string;
    created_at: string;
  };
}

export default function OrganizationDetails({ organization }: OrganizationDetailsProps) {
  const { profile } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [closedTickets, setClosedTickets] = useState<Ticket[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [userRole, setUserRole] = useState<OrgRole | null>(null);

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

      // Fetch open tickets
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
        .order('created_at', { ascending: false })
        .limit(10);

      if (openTicketError) throw openTicketError;
      
      // Fetch closed tickets
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
        .order('created_at', { ascending: false })
        .limit(10);

      if (closedTicketError) throw closedTicketError;

      // Transform ticket data to match the Ticket type
      const transformOpenTickets = (openTicketData || []).map((ticket: any): Ticket => ({
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

      const transformClosedTickets = (closedTicketData || []).map((ticket: any): Ticket => ({
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

      setTickets(transformOpenTickets);
      setClosedTickets(transformClosedTickets);

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
        .eq('status', 'accepted');

      if (customerError) throw customerError;

      // Get ticket counts for each customer
      const customerTicketCounts = await Promise.all(
        (customerData || []).map(async (customer: any): Promise<Customer> => {
          const { count } = await supabase
            .from('tickets')
            .select('id', { count: 'exact' })
            .eq('organization_id', organization.id)
            .eq('created_by', customer.profiles.id)
            .single();

          return {
            id: customer.profiles.id,
            full_name: customer.profiles.full_name,
            created_at: customer.profiles.created_at,
            total_tickets: count || 0
          };
        })
      );

      setCustomers(customerTicketCounts);

      // Calculate metrics
      const totalTickets = openTicketData?.length || 0 + closedTicketData?.length || 0;
      const activeUsers = customerTicketCounts.length;

      setMetrics({
        totalTickets,
        activeUsers,
        avgResponseTime: '2h 30m', // This should be calculated based on actual data
        openTickets: openTicketData?.length || 0
      });

    } catch (error) {
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

  return (
    <div className="space-y-6">
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

      {/* Organization Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{organization.name}</h1>
        <div className="mt-4 sm:mt-0 space-x-3">
          <button
            onClick={() => setShowNewTicketModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create New Ticket
          </button>
          
          {canManageOrg && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Invite Customer
            </button>
          )}
        </div>
      </div>

      {/* Metrics - Only shown for admins/owners */}
      {canManageOrg && metrics && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">Total Tickets</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">{metrics.totalTickets}</dd>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">Active Users</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">{metrics.activeUsers}</dd>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">Avg. Response Time</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">{metrics.avgResponseTime}</dd>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">Open Tickets</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">{metrics.openTickets}</dd>
            </div>
          </div>
        </div>
      )}

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
                        }`}>{ticket.subject}</h4>
                        <div className="mt-1 text-sm text-gray-600">
                          Created by: {ticket.created_by.full_name}
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
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {ticket.category}
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
                        }`}>{ticket.subject}</h4>
                        <div className="mt-1 text-sm text-gray-600">
                          Created by: {ticket.created_by.full_name}
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
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {ticket.category}
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

      {/* Customers - Only shown for admins/owners */}
      {canManageOrg && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Customers</h3>
              <button
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="-ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Invite
              </button>
            </div>
            <div className="mt-4">
              {customers.length === 0 ? (
                <p className="text-gray-500">No customers yet</p>
              ) : (
                <div className="space-y-4">
                  {customers.map((customer) => (
                    <div key={customer.id} className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900">{customer.full_name}</h4>
                      <div className="mt-2 flex items-center text-sm text-gray-500">
                        <span className="mr-4">Total Tickets: {customer.total_tickets}</span>
                        <span>Joined: {new Date(customer.created_at).toLocaleDateString()}</span>
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
  );
} 