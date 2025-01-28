import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { commonStyles } from '../styles/theme';
import { supabase } from '../lib/supabase';

interface TicketDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TicketStats {
  total: number;
  open: number;
  in_progress: number;
  closed: number;
  avg_response_time: string;
  avg_resolution_time: string;
  satisfaction_rate: number;
  by_organization: {
    name: string;
    total: number;
    open: number;
    closed: number;
  }[];
  by_agent: {
    name: string;
    assigned: number;
    resolved: number;
  }[];
}

export default function TicketDetailsModal({ isOpen, onClose }: TicketDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchTicketStats();
    }
  }, [isOpen]);

  async function fetchTicketStats() {
    try {
      // Fetch all tickets with their relationships
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select(`
          *,
          organization:organizations(name),
          assigned_to_profile:profiles!tickets_assigned_to_fkey(full_name)
        `);

      if (ticketsError) throw ticketsError;
      if (!tickets) throw new Error('No tickets found');

      // Calculate basic stats
      const total = tickets.length;
      const open = tickets.filter(t => t.status === 'open').length;
      const inProgress = tickets.filter(t => t.status === 'in_progress').length;
      const closed = tickets.filter(t => t.status === 'closed').length;

      // Calculate average response time
      const ticketsWithResponse = tickets.filter(t => t.first_response_at);
      const avgResponseTimeHours = ticketsWithResponse.length > 0
        ? ticketsWithResponse.reduce((acc, t) => {
            const responseTime = new Date(t.first_response_at).getTime() - new Date(t.created_at).getTime();
            return acc + (responseTime / (1000 * 60 * 60));
          }, 0) / ticketsWithResponse.length
        : 0;

      // Calculate average resolution time for closed tickets
      const closedTicketsWithDates = tickets.filter(t => t.status === 'closed' && t.closed_at);
      const avgResolutionTimeHours = closedTicketsWithDates.length > 0
        ? closedTicketsWithDates.reduce((acc, t) => {
            const resolutionTime = new Date(t.closed_at).getTime() - new Date(t.created_at).getTime();
            return acc + (resolutionTime / (1000 * 60 * 60));
          }, 0) / closedTicketsWithDates.length
        : 0;

      // Calculate satisfaction rate
      const ratedTickets = tickets.filter(t => t.satisfaction_rating !== null);
      const satisfactionRate = ratedTickets.length > 0
        ? (ratedTickets.filter(t => t.satisfaction_rating >= 4).length / ratedTickets.length) * 100
        : 0;

      // Group by organization
      const byOrganization = Object.values(
        tickets.reduce((acc: any, ticket) => {
          const orgName = ticket.organization?.name || 'Unknown';
          if (!acc[orgName]) {
            acc[orgName] = {
              name: orgName,
              total: 0,
              open: 0,
              closed: 0
            };
          }
          acc[orgName].total++;
          if (ticket.status === 'closed') acc[orgName].closed++;
          if (ticket.status === 'open') acc[orgName].open++;
          return acc;
        }, {})
      );

      // Group by agent
      const byAgent = Object.values(
        tickets.reduce((acc: any, ticket) => {
          const agentName = ticket.assigned_to_profile?.full_name || 'Unassigned';
          if (!acc[agentName]) {
            acc[agentName] = {
              name: agentName,
              assigned: 0,
              resolved: 0
            };
          }
          acc[agentName].assigned++;
          if (ticket.status === 'closed') acc[agentName].resolved++;
          return acc;
        }, {})
      );

      setStats({
        total,
        open,
        in_progress: inProgress,
        closed,
        avg_response_time: `${Math.round(avgResponseTimeHours)}h`,
        avg_resolution_time: `${Math.round(avgResolutionTimeHours)}h`,
        satisfaction_rate: Math.round(satisfactionRate),
        by_organization: byOrganization as { name: string; total: number; open: number; closed: number; }[],
        by_agent: byAgent as { name: string; assigned: number; resolved: number; }[]
      });

    } catch (err: any) {
      console.error('Error fetching ticket stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={`${commonStyles.card} w-full max-w-4xl transform p-6 overflow-y-auto max-h-[90vh]`}>
                <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                  <button
                    type="button"
                    className="rounded-md text-gray-400 hover:text-gray-300 focus:outline-none"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-sm sm:mx-0 sm:h-10 sm:w-10 ring-1 ring-white/10">
                    <svg className="h-6 w-6 text-yellow-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <Dialog.Title as="h3" className={commonStyles.heading}>
                      Ticket Statistics
                    </Dialog.Title>
                    <div className="mt-4">
                      {loading ? (
                        <div className="flex justify-center py-8">
                          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                        </div>
                      ) : error ? (
                        <div className={commonStyles.messageBox.error}>
                          <p>{error}</p>
                        </div>
                      ) : stats ? (
                        <div className="space-y-6">
                          {/* Overview */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className={commonStyles.cardWithHover}>
                              <div className="p-4">
                                <h4 className={`${commonStyles.text} font-medium mb-2`}>Total Tickets</h4>
                                <div className="text-2xl font-bold text-white">{stats.total}</div>
                              </div>
                            </div>
                          <div className={commonStyles.cardWithHover}>
                            <div className="p-4">
                                <h4 className={`${commonStyles.text} font-medium mb-2`}>Open</h4>
                                <div className="text-2xl font-bold text-green-400">{stats.open}</div>
                              </div>
                                </div>
                            <div className={commonStyles.cardWithHover}>
                              <div className="p-4">
                                <h4 className={`${commonStyles.text} font-medium mb-2`}>In Progress</h4>
                                <div className="text-2xl font-bold text-yellow-400">{stats.in_progress}</div>
                                </div>
                                </div>
                            <div className={commonStyles.cardWithHover}>
                              <div className="p-4">
                                <h4 className={`${commonStyles.text} font-medium mb-2`}>Closed</h4>
                                <div className="text-2xl font-bold text-blue-400">{stats.closed}</div>
                              </div>
                            </div>
                          </div>

                          {/* Performance Metrics */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className={commonStyles.cardWithHover}>
                              <div className="p-4">
                                <h4 className={`${commonStyles.text} font-medium mb-2`}>Avg Response Time</h4>
                                <div className="text-2xl font-bold text-white">{stats.avg_response_time}</div>
                              </div>
                            </div>
                            <div className={commonStyles.cardWithHover}>
                              <div className="p-4">
                                <h4 className={`${commonStyles.text} font-medium mb-2`}>Avg Resolution Time</h4>
                                <div className="text-2xl font-bold text-white">{stats.avg_resolution_time}</div>
                              </div>
                            </div>
                          <div className={commonStyles.cardWithHover}>
                            <div className="p-4">
                                <h4 className={`${commonStyles.text} font-medium mb-2`}>Satisfaction Rate</h4>
                                <div className="text-2xl font-bold text-purple-400">{stats.satisfaction_rate}%</div>
                              </div>
                            </div>
                          </div>

                          {/* By Organization */}
                          <div>
                            <h4 className={`${commonStyles.text} font-medium mb-4`}>By Organization</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {stats.by_organization.map((org) => (
                                <div key={org.name} className={commonStyles.cardWithHover}>
                                  <div className="p-4">
                                    <h5 className={`${commonStyles.text} font-medium mb-2`}>{org.name}</h5>
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                        <span className="text-sm text-gray-400">Total</span>
                                        <span className="text-sm text-white font-medium">{org.total}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-sm text-gray-400">Open</span>
                                        <span className="text-sm text-green-400 font-medium">{org.open}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-sm text-gray-400">Closed</span>
                                        <span className="text-sm text-blue-400 font-medium">{org.closed}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* By Agent */}
                          <div>
                            <h4 className={`${commonStyles.text} font-medium mb-4`}>By Agent</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {stats.by_agent.map((agent) => (
                                <div key={agent.name} className={commonStyles.cardWithHover}>
                                  <div className="p-4">
                                    <h5 className={`${commonStyles.text} font-medium mb-2`}>{agent.name}</h5>
                                    <div className="space-y-2">
                                      <div className="flex justify-between">
                                        <span className="text-sm text-gray-400">Assigned</span>
                                        <span className="text-sm text-white font-medium">{agent.assigned}</span>
                                </div>
                                <div className="flex justify-between">
                                        <span className="text-sm text-gray-400">Resolved</span>
                                        <span className="text-sm text-blue-400 font-medium">{agent.resolved}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-6">
                      <div className={commonStyles.buttonPrimary.wrapper}>
                        <div className={commonStyles.buttonPrimary.gradient} />
                        <button
                          type="button"
                          className={`${commonStyles.buttonPrimary.content} w-full !py-2`}
                          onClick={onClose}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
} 