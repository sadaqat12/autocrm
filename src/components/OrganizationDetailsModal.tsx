import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface OrganizationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface OrgStats {
  id: string;
  name: string;
  created_at: string;
  users: {
    total: number;
    by_role: {
      owner: number;
      admin: number;
      member: number;
    };
  };
  tickets: {
    total: number;
    open: number;
    closed: number;
    avg_resolution_time: number;
    by_priority: {
      high: number;
      medium: number;
      low: number;
    };
    by_category: Record<string, number>;
    by_month: {
      month: string;
      count: number;
    }[];
  };
  performance: {
    avg_response_time: number;
    avg_resolution_time: number;
    satisfaction_rate: number;
  };
}

export default function OrganizationDetailsModal({ isOpen, onClose }: OrganizationDetailsModalProps) {
  const [organizations, setOrganizations] = useState<OrgStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrgs, setExpandedOrgs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      fetchOrganizationStats();
      setExpandedOrgs({}); // Reset expanded state when modal opens
    }
  }, [isOpen]);

  async function fetchOrganizationStats() {
    try {
      setLoading(true);
      
      // Fetch all organizations
      const { data: orgs, error: orgsError } = await supabase
        .from('organizations')
        .select('id, name, created_at');

      if (orgsError) throw orgsError;

      const orgStats: OrgStats[] = [];

      // Get detailed stats for each organization
      for (const org of orgs || []) {
        // Get user counts by role
        const { data: usersByRole } = await supabase
          .from('organization_users')
          .select('role')
          .eq('organization_id', org.id);

        const roleCount = {
          owner: usersByRole?.filter(u => u.role === 'owner').length || 0,
          admin: usersByRole?.filter(u => u.role === 'admin').length || 0,
          member: usersByRole?.filter(u => u.role === 'member').length || 0,
        };

        // Get tickets data
        const { data: tickets } = await supabase
          .from('tickets')
          .select('*')
          .eq('organization_id', org.id);

        const openTickets = tickets?.filter(t => t.status === 'open').length || 0;
        const closedTickets = tickets?.filter(t => t.status === 'closed').length || 0;

        // Calculate tickets by priority
        const ticketsByPriority = {
          high: tickets?.filter(t => t.priority === 'high').length || 0,
          medium: tickets?.filter(t => t.priority === 'medium').length || 0,
          low: tickets?.filter(t => t.priority === 'low').length || 0,
        };

        // Calculate tickets by category
        const ticketsByCategory = tickets?.reduce((acc: Record<string, number>, ticket) => {
          const category = ticket.category || 'Uncategorized';
          acc[category] = (acc[category] || 0) + 1;
          return acc;
        }, {}) || {};

        // Calculate tickets by month
        const ticketsByMonth = tickets?.reduce((acc: Record<string, number>, ticket) => {
          const month = new Date(ticket.created_at).toLocaleString('default', { month: 'long', year: 'numeric' });
          acc[month] = (acc[month] || 0) + 1;
          return acc;
        }, {});

        // Calculate performance metrics
        const closedTicketsData = tickets?.filter(t => t.status === 'closed' && t.closed_at && t.created_at) || [];
        const avgResolutionTime = closedTicketsData.length
          ? closedTicketsData.reduce((sum, t) => {
              return sum + (new Date(t.closed_at).getTime() - new Date(t.created_at).getTime());
            }, 0) / closedTicketsData.length / (1000 * 60 * 60) // Convert to hours
          : 0;

        const ticketsWithResponse = tickets?.filter(t => t.first_response_at && t.created_at) || [];
        const avgResponseTime = ticketsWithResponse.length
          ? ticketsWithResponse.reduce((sum, t) => {
              return sum + (new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime());
            }, 0) / ticketsWithResponse.length / (1000 * 60 * 60) // Convert to hours
          : 0;

        // Calculate satisfaction rate (assuming there's a satisfaction_rating field, 1-5)
        const ratedTickets = tickets?.filter(t => t.satisfaction_rating) || [];
        const satisfactionRate = ratedTickets.length
          ? (ratedTickets.reduce((sum, t) => sum + (t.satisfaction_rating || 0), 0) / ratedTickets.length) * 20 // Convert to percentage
          : 0;

        orgStats.push({
          id: org.id,
          name: org.name,
          created_at: org.created_at,
          users: {
            total: Object.values(roleCount).reduce((a, b) => a + b, 0),
            by_role: roleCount,
          },
          tickets: {
            total: tickets?.length || 0,
            open: openTickets,
            closed: closedTickets,
            avg_resolution_time: Math.round(avgResolutionTime * 10) / 10,
            by_priority: ticketsByPriority,
            by_category: ticketsByCategory,
            by_month: Object.entries(ticketsByMonth || {}).map(([month, count]) => ({
              month,
              count: count as number,
            })),
          },
          performance: {
            avg_response_time: Math.round(avgResponseTime * 10) / 10,
            avg_resolution_time: Math.round(avgResolutionTime * 10) / 10,
            satisfaction_rate: Math.round(satisfactionRate * 10) / 10,
          },
        });
      }

      setOrganizations(orgStats);
    } catch (error) {
      console.error('Error fetching organization stats:', error);
    } finally {
      setLoading(false);
    }
  }

  const toggleOrg = (orgId: string) => {
    setExpandedOrgs(prev => ({
      ...prev,
      [orgId]: !prev[orgId]
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Organization Details</h2>
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
            <div className="space-y-4">
              {organizations.map((org) => (
                <div key={org.id} className="bg-gray-50 rounded-lg overflow-hidden">
                  <div 
                    className="p-4 cursor-pointer hover:bg-gray-100 transition-colors duration-150 flex justify-between items-center"
                    onClick={() => toggleOrg(org.id)}
                  >
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{org.name}</h3>
                      <p className="text-sm text-gray-500">Created {new Date(org.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right mr-4">
                        <p className="text-sm font-medium text-gray-900">{org.tickets.total} Total Tickets</p>
                        <p className="text-sm text-gray-500">{org.users.total} Users</p>
                      </div>
                      <svg 
                        className={`h-5 w-5 text-gray-500 transform transition-transform duration-200 ${expandedOrgs[org.id] ? 'rotate-180' : ''}`}
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {expandedOrgs[org.id] && (
                    <div className="p-6 border-t border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* User Distribution */}
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <h4 className="text-sm font-medium text-gray-500 mb-3">User Distribution</h4>
                          <dl className="space-y-2">
                            <div className="flex justify-between">
                              <dt className="text-sm text-gray-500">Owners</dt>
                              <dd className="text-sm font-medium text-purple-600">{org.users.by_role.owner}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-sm text-gray-500">Admins</dt>
                              <dd className="text-sm font-medium text-blue-600">{org.users.by_role.admin}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-sm text-gray-500">Members</dt>
                              <dd className="text-sm font-medium text-gray-600">{org.users.by_role.member}</dd>
                            </div>
                          </dl>
                        </div>

                        {/* Ticket Status */}
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <h4 className="text-sm font-medium text-gray-500 mb-3">Ticket Status</h4>
                          <dl className="space-y-2">
                            <div className="flex justify-between">
                              <dt className="text-sm text-gray-500">Open Tickets</dt>
                              <dd className="text-sm font-medium text-green-600">{org.tickets.open}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-sm text-gray-500">Closed Tickets</dt>
                              <dd className="text-sm font-medium text-blue-600">{org.tickets.closed}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-sm text-gray-500">Resolution Time (hrs)</dt>
                              <dd className="text-sm font-medium text-gray-900">{org.tickets.avg_resolution_time}</dd>
                            </div>
                          </dl>
                        </div>

                        {/* Performance Metrics */}
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <h4 className="text-sm font-medium text-gray-500 mb-3">Performance</h4>
                          <dl className="space-y-2">
                            <div className="flex justify-between">
                              <dt className="text-sm text-gray-500">Avg Response (hrs)</dt>
                              <dd className="text-sm font-medium text-gray-900">{org.performance.avg_response_time}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-sm text-gray-500">Satisfaction Rate</dt>
                              <dd className="text-sm font-medium text-gray-900">{org.performance.satisfaction_rate}%</dd>
                            </div>
                          </dl>
                        </div>

                        {/* Ticket Priority */}
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <h4 className="text-sm font-medium text-gray-500 mb-3">By Priority</h4>
                          <dl className="space-y-2">
                            <div className="flex justify-between">
                              <dt className="text-sm text-gray-500">High Priority</dt>
                              <dd className="text-sm font-medium text-red-600">{org.tickets.by_priority.high}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-sm text-gray-500">Medium Priority</dt>
                              <dd className="text-sm font-medium text-yellow-600">{org.tickets.by_priority.medium}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-sm text-gray-500">Low Priority</dt>
                              <dd className="text-sm font-medium text-green-600">{org.tickets.by_priority.low}</dd>
                            </div>
                          </dl>
                        </div>

                        {/* Monthly Trend */}
                        <div className="bg-white rounded-lg p-4 shadow-sm md:col-span-2">
                          <h4 className="text-sm font-medium text-gray-500 mb-3">Monthly Trend</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {org.tickets.by_month.map(({ month, count }) => (
                              <div key={month} className="flex justify-between">
                                <dt className="text-sm text-gray-500">{month}</dt>
                                <dd className="text-sm font-medium text-gray-900">{count}</dd>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Categories */}
                        <div className="bg-white rounded-lg p-4 shadow-sm">
                          <h4 className="text-sm font-medium text-gray-500 mb-3">By Category</h4>
                          <div className="space-y-2">
                            {Object.entries(org.tickets.by_category).map(([category, count]) => (
                              <div key={category} className="flex justify-between">
                                <dt className="text-sm text-gray-500">{category}</dt>
                                <dd className="text-sm font-medium text-gray-900">{count}</dd>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 